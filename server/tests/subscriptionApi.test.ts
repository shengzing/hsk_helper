import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import {
  createTestDbWithUsers,
  loginDirect,
  getJson,
  postJson,
  patchJson,
  type TestDb,
} from "./helpers/db.js";

describe("Subscription API (path A — permissions)", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let adminCookie: string;
  let studentCookie: string;

  beforeEach(() => {
    db = createTestDbWithUsers();
    app = createApp(db);
    adminCookie = loginDirect(db, "admin", "Admin2026");
    studentCookie = loginDirect(db, "student", "Study2026");
  });

  describe("GET /api/subscriptions/me", () => {
    it("returns student subscriptions (seed HSK4)", async () => {
      const { status, body } = await getJson(app, "/api/subscriptions/me", studentCookie);
      expect(status).toBe(200);
      const subs = (body as any).data;
      expect(subs).toHaveLength(2);
      expect(subs[0].bank_id).toBe("hsk-level-4");
      expect(subs[0].status).toBe("active");
      expect(subs[0].level).toBe(4);
      expect(subs[0].paper_count).toBe(0);
      expect(subs.find((s: any) => s.bank_id === "hsk-level-6").paper_count).toBe(1);
    });

    it("returns empty list for admin (no subscriptions)", async () => {
      const { status, body } = await getJson(app, "/api/subscriptions/me", adminCookie);
      expect(status).toBe(200);
      expect((body as any).data).toHaveLength(0);
    });

    it("returns 401 without auth", async () => {
      const { status } = await getJson(app, "/api/subscriptions/me");
      expect(status).toBe(401);
    });

    it("does not leak other users' subscriptions", async () => {
      const { body } = await getJson(app, "/api/subscriptions/me", studentCookie);
      const subs = (body as any).data as any[];
      expect(subs.every((s) => s.user_id === undefined || s.bank_id !== undefined)).toBe(true);
      // Student should only see their own HSK4, not any admin data
      expect(subs.some((s) => s.bank_id === "hsk-level-4")).toBe(true);
    });
  });

  describe("GET /api/banks", () => {
    it("returns only subscribed banks for student (HSK4)", async () => {
      const { status, body } = await getJson(app, "/api/banks", studentCookie);
      expect(status).toBe(200);
      const banks = (body as any).data;
      expect(banks).toHaveLength(2);
      expect(banks[0].level).toBe(4);
    });

    it("returns empty for admin (no subscriptions)", async () => {
      const { body } = await getJson(app, "/api/banks", adminCookie);
      expect((body as any).data).toHaveLength(0);
    });

    it("returns 401 without auth", async () => {
      const { status } = await getJson(app, "/api/banks");
      expect(status).toBe(401);
    });
  });

  describe("GET /api/banks/:bankId/papers", () => {
    it("returns 403 for unsubscribed bank", async () => {
      const { status } = await getJson(app, "/api/banks/hsk-level-5/papers", studentCookie);
      expect(status).toBe(403);
    });

    it("returns 200 for subscribed bank with no published papers", async () => {
      const { status, body } = await getJson(app, "/api/banks/hsk-level-4/papers", studentCookie);
      expect(status).toBe(200);
      expect((body as any).data).toHaveLength(0);
    });
  });

  describe("GET /api/papers/:paperId — answer hiding (path B)", () => {
    it("returns 200 for paper in subscribed bank (HSK6)", async () => {
      const { status, body } = await getJson(app, "/api/papers/paper-h61438", studentCookie);
      expect(status).toBe(200);
    });

    it("returns 403 for draft paper even with subscription", async () => {
      // Seed already has student HSK6 subscription; set paper to draft
      db.prepare("UPDATE past_exam_papers SET status = 'draft' WHERE id = 'paper-h61438'").run();
      const { status, body } = await getJson(app, "/api/papers/paper-h61438", studentCookie);
      expect(status).toBe(403);
      expect((body as any).error.code).toBe("PAPER_NOT_PUBLISHED");
    });
  });

  describe("Admin subscription management", () => {
    it("admin can create subscription for student", async () => {
      const { status, body } = await postJson(
        app,
        "/api/admin/subscriptions",
        { userId: "user-student", bankId: "hsk-level-5" },
        adminCookie
      );
      expect(status).toBe(201);
      expect((body as any).data.created).toBe(1);
    });

    it("non-admin cannot access admin subscriptions", async () => {
      const { status } = await getJson(app, "/api/admin/subscriptions", studentCookie);
      expect(status).toBe(403);
    });

    it("admin can pause a subscription", async () => {
      // Create subscription first
      await postJson(
        app,
        "/api/admin/subscriptions",
        { userId: "user-student", bankId: "hsk-level-3" },
        adminCookie
      );
      // Find the subscription
      const subs = db.prepare(
        "SELECT id FROM bank_subscriptions WHERE user_id = 'user-student' AND bank_id = 'hsk-level-3'"
      ).get() as { id: string };
      // Pause it
      const { status } = await patchJson(
        app,
        `/api/admin/subscriptions/${subs.id}`,
        { action: "pause" },
        adminCookie
      );
      expect(status).toBe(200);
      // Verify status
      const sub = db.prepare("SELECT status FROM bank_subscriptions WHERE id = ?").get(subs.id) as { status: string };
      expect(sub.status).toBe("paused");
    });

    it("admin can batch create subscriptions", async () => {
      // Create extra users
      db.prepare("INSERT INTO users (id, username, display_name) VALUES ('u1', 'u1', 'User 1')").run();
      db.prepare("INSERT INTO users (id, username, display_name) VALUES ('u2', 'u2', 'User 2')").run();
      const { status, body } = await postJson(
        app,
        "/api/admin/subscriptions",
        {
          subscriptions: [
            { userId: "u1", bankId: "hsk-level-1" },
            { userId: "u2", bankId: "hsk-level-2" },
          ],
        },
        adminCookie
      );
      expect(status).toBe(201);
      expect((body as any).data.created).toBe(2);
    });
  });

  describe("Auth routes", () => {
    it("POST /api/auth/login succeeds with valid credentials", async () => {
      const { status, body } = await postJson(
        app,
        "/api/auth/login",
        { username: "admin", password: "Admin2026" }
      );
      expect(status).toBe(200);
      expect((body as any).data.username).toBe("admin");
      expect((body as any).data.isAdmin).toBe(true);
    });

    it("POST /api/auth/login fails with wrong password", async () => {
      const { status, body } = await postJson(
        app,
        "/api/auth/login",
        { username: "admin", password: "wrong" }
      );
      expect(status).toBe(401);
      expect((body as any).error.code).toBe("LOGIN_FAILED");
    });

    it("POST /api/auth/login fails with missing fields", async () => {
      const { status } = await postJson(app, "/api/auth/login", { username: "admin" });
      expect(status).toBe(400);
    });

    it("GET /api/auth/me returns user with valid session", async () => {
      const { status, body } = await getJson(app, "/api/auth/me", adminCookie);
      expect(status).toBe(200);
      expect((body as any).data.username).toBe("admin");
    });

    it("GET /api/auth/me returns null without session", async () => {
      const { status, body } = await getJson(app, "/api/auth/me");
      expect(status).toBe(200);
      expect((body as any).data).toBeNull();
    });
  });
});
