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

/**
 * Security tests — T047
 * Covers test plan paths A (subscription), B (answer hiding),
 * and §12 security requirements.
 */
describe("Security: subscription permissions (path A)", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let studentCookie: string;
  let adminCookie: string;

  beforeEach(() => {
    db = createTestDbWithUsers();
    app = createApp(db);
    adminCookie = loginDirect(db, "admin", "Admin2026");
    studentCookie = loginDirect(db, "student", "Study2026");
    // Seed: student has HSK4 + HSK6 active subscriptions
    // H61438 paper is published in HSK6
  });

  // SUB-01: No subscription → empty bank list
  it("SUB-01: user with no subscriptions sees empty bank list", async () => {
    // Admin has no subscriptions
    const { status, body } = await getJson(app, "/api/banks", adminCookie);
    expect(status).toBe(200);
    expect((body as any).data).toHaveLength(0);
  });

  // SUB-02: Active subscription → bank visible
  it("SUB-02: student sees HSK4 and HSK6 banks", async () => {
    const { body } = await getJson(app, "/api/banks", studentCookie);
    const levels = (body as any).data.map((b: any) => b.level).sort();
    expect(levels).toEqual([4, 6]);
  });

  // SUB-03: Cross-level access denied
  it("SUB-03: HSK4 student cannot access HSK1 papers", async () => {
    const { status } = await getJson(app, "/api/banks/hsk-level-1/papers", studentCookie);
    expect(status).toBe(403);
  });

  // SUB-05: Paused subscription cannot start attempt
  it("SUB-05: paused subscription cannot start attempt", async () => {
    db.prepare("UPDATE bank_subscriptions SET status = 'paused' WHERE bank_id = 'hsk-level-6' AND user_id = 'user-student'").run();
    const { status } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    expect(status).toBe(403);
  });

  // SUB-07: Expired subscription cannot start attempt
  it("SUB-07: expired subscription cannot start attempt", async () => {
    db.prepare("UPDATE bank_subscriptions SET expires_at = '2020-01-01T00:00:00Z' WHERE bank_id = 'hsk-level-6' AND user_id = 'user-student'").run();
    const { status } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    expect(status).toBe(403);
  });

  // SUB-11: Unauthenticated → 401
  it("SUB-11: unauthenticated requests return 401", async () => {
    const endpoints = ["/api/banks", "/api/subscriptions/me", "/api/wrong-questions"];
    for (const ep of endpoints) {
      const { status } = await getJson(app, ep);
      expect(status).toBe(401);
    }
  });

  // SUB-12: Non-admin → 403 for admin routes
  it("SUB-12: non-admin gets 403 for admin routes", async () => {
    const endpoints = ["/api/admin/users", "/api/admin/subscriptions", "/api/admin/reviews/essays"];
    for (const ep of endpoints) {
      const { status } = await getJson(app, ep, studentCookie);
      expect(status).toBe(403);
    }
  });

  // SUB-13: No attempt → cannot access assets
  it("SUB-13: cannot access attempt assets without creating attempt", async () => {
    const { status } = await getJson(app, "/api/attempts/fake-attempt/assets/asset-h61438-audio", studentCookie);
    expect(status).toBe(404);
  });
});

describe("Security: answer hiding (path B)", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let studentCookie: string;

  beforeEach(() => {
    db = createTestDbWithUsers();
    app = createApp(db);
    studentCookie = loginDirect(db, "student", "Study2026");
  });

  // ANS-01: Paper detail does not return answer_json
  it("ANS-01: GET /api/papers/:paperId does not return answer_json", async () => {
    const { status, body } = await getJson(app, "/api/papers/paper-h61438", studentCookie);
    expect(status).toBe(200);
    const paper = (body as any).data;
    // Check all questions across all sections and groups
    for (const section of paper.sections) {
      for (const group of section.groups) {
        for (const question of (group.questions || [])) {
          expect(question).not.toHaveProperty("answer_json");
          expect(question).not.toHaveProperty("explanation");
        }
      }
    }
  });

  // ANS-02: In-progress attempt detail does not return correct answers
  it("ANS-02: GET /api/attempts/:id does not return results for in-progress attempt", async () => {
    const { body: startBody } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    const attemptId = (startBody as any).data.attemptId;
    const { body } = await getJson(app, `/api/attempts/${attemptId}`, studentCookie);
    expect((body as any).data).not.toHaveProperty("results");
    expect((body as any).data).not.toHaveProperty("correct_answers");
  });

  // ANS-05: Cannot get report for in-progress attempt
  it("ANS-05: GET /api/attempts/:id/report returns error for in-progress attempt", async () => {
    const { body: startBody } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    const attemptId = (startBody as any).data.attemptId;
    const { status } = await getJson(app, `/api/attempts/${attemptId}/report`, studentCookie);
    expect(status).toBeGreaterThanOrEqual(400);
  });
});

describe("Security: cross-user and cross-attempt access", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let studentCookie: string;
  let adminCookie: string;
  let studentAttemptId: string;

  beforeEach(async () => {
    db = createTestDbWithUsers();
    app = createApp(db);
    adminCookie = loginDirect(db, "admin", "Admin2026");
    studentCookie = loginDirect(db, "student", "Study2026");
    // Student starts an attempt
    const { body } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    studentAttemptId = (body as any).data.attemptId;
  });

  // Cross-user: admin cannot access student's attempt
  it("admin cannot get student's attempt detail", async () => {
    const { status } = await getJson(app, `/api/attempts/${studentAttemptId}`, adminCookie);
    expect(status).toBe(403);
  });

  it("admin cannot save answers to student's attempt", async () => {
    const { status } = await patchJson(
      app,
      `/api/attempts/${studentAttemptId}/answers`,
      { answers: { "pq-h61438-l1": { type: "choice", value: "A" } } },
      adminCookie
    );
    expect(status).toBe(403);
  });

  it("admin cannot submit student's attempt", async () => {
    const { status } = await postJson(
      app,
      `/api/attempts/${studentAttemptId}/submit`,
      { durationUsedSeconds: 100 },
      adminCookie
    );
    expect(status).toBe(403);
  });

  it("admin cannot get student's attempt report", async () => {
    // First submit the attempt as student
    await postJson(app, `/api/attempts/${studentAttemptId}/submit`, { durationUsedSeconds: 100 }, studentCookie);
    const { status } = await getJson(app, `/api/attempts/${studentAttemptId}/report`, adminCookie);
    expect(status).toBe(403);
  });

  it("admin cannot update section timing for student's attempt", async () => {
    const { status } = await patchJson(
      app,
      `/api/attempts/${studentAttemptId}/sections/section-h61438-listening`,
      { status: "active", remainingSeconds: 1800 },
      adminCookie
    );
    expect(status).toBe(403);
  });

  it("admin cannot record audio events for student's attempt", async () => {
    const { status } = await postJson(
      app,
      `/api/attempts/${studentAttemptId}/audio-events`,
      { assetId: "asset-h61438-audio", eventType: "play", positionMs: 0 },
      adminCookie
    );
    expect(status).toBe(403);
  });
});

describe("Security: audio asset access control", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let studentCookie: string;
  let adminCookie: string;
  let studentAttemptId: string;

  beforeEach(async () => {
    db = createTestDbWithUsers();
    app = createApp(db);
    adminCookie = loginDirect(db, "admin", "Admin2026");
    studentCookie = loginDirect(db, "student", "Study2026");
    const { body } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    studentAttemptId = (body as any).data.attemptId;
  });

  it("non-owner cannot access audio assets via attempt route", async () => {
    const { status } = await getJson(app, `/api/attempts/${studentAttemptId}/assets/asset-h61438-audio`, adminCookie);
    expect(status).toBe(403);
  });

  it("returns 404 for non-existent attempt when accessing assets", async () => {
    const { status } = await getJson(app, "/api/attempts/fake-id/assets/asset-h61438-audio", studentCookie);
    expect(status).toBe(404);
  });

  it("returns 404 for non-existent asset", async () => {
    const { status } = await getJson(app, `/api/attempts/${studentAttemptId}/assets/fake-asset`, studentCookie);
    expect(status).toBe(404);
  });
});

describe("Security: subscription state transitions at API level", () => {
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

  it("admin can pause subscription and student loses access", async () => {
    // Student can access HSK6 before pause
    const { status: before } = await getJson(app, "/api/banks/hsk-level-6/papers", studentCookie);
    expect(before).toBe(200);

    // Pause HSK6 subscription
    const subs = db.prepare(
      "SELECT id FROM bank_subscriptions WHERE user_id = 'user-student' AND bank_id = 'hsk-level-6'"
    ).get() as { id: string };
    await patchJson(app, `/api/admin/subscriptionses/${subs.id}`, { action: "pause" }, adminCookie).catch(() => {});
    // Try correct path
    const { status } = await patchJson(app, `/api/admin/subscriptions/${subs.id}`, { action: "pause" }, adminCookie);
    expect(status).toBe(200);

    // Student can still see banks list but cannot start attempt
    const { status: attemptStatus } = await postJson(
      app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie
    );
    expect(attemptStatus).toBe(403);
  });

  it("admin can cancel subscription and student loses bank access", async () => {
    // Cancel HSK4 subscription
    const subs = db.prepare(
      "SELECT id FROM bank_subscriptions WHERE user_id = 'user-student' AND bank_id = 'hsk-level-4'"
    ).get() as { id: string };
    const { status } = await patchJson(app, `/api/admin/subscriptions/${subs.id}`, { action: "cancel" }, adminCookie);
    expect(status).toBe(200);

    // Student should not see HSK4 in banks
    const { body } = await getJson(app, "/api/banks", studentCookie);
    const levels = (body as any).data.map((b: any) => b.level);
    expect(levels).not.toContain(4);
  });
});
