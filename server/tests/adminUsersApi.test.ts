import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import {
  createTestDbWithUsers,
  loginDirect,
  getJson,
  postJson,
  deleteJson,
  type TestDb,
} from "./helpers/db.js";

describe("Admin users API", () => {
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

  describe("GET /api/admin/users", () => {
    it("admin can list users", async () => {
      const { status, body } = await getJson(app, "/api/admin/users", adminCookie);
      expect(status).toBe(200);
      const users = (body as any).data;
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(users.some((u: any) => u.username === "admin")).toBe(true);
      expect(users.some((u: any) => u.username === "student")).toBe(true);
    });

    it("non-admin gets 403", async () => {
      const { status } = await getJson(app, "/api/admin/users", studentCookie);
      expect(status).toBe(403);
    });
  });

  describe("POST /api/admin/users", () => {
    it("creates a new user", async () => {
      const { status, body } = await postJson(app, "/api/admin/users", {
        username: "newuser",
        password: "Password123",
        displayName: "New User",
        expiresAt: "2099-12-31",
        isAdmin: false,
        uiLocale: "zh-CN",
      }, adminCookie);
      expect(status).toBe(201);
      expect((body as any).data.username).toBe("newuser");
    });

    it("rejects duplicate username", async () => {
      const { status } = await postJson(app, "/api/admin/users", {
        username: "student",
        password: "Password123",
        displayName: "Dup",
        expiresAt: "2099-12-31",
        isAdmin: false,
      }, adminCookie);
      expect(status).toBe(409);
    });

    it("rejects short password (< 6 chars)", async () => {
      const { status } = await postJson(app, "/api/admin/users", {
        username: "shortpw",
        password: "123",
        displayName: "Short",
        expiresAt: "2099-12-31",
        isAdmin: false,
      }, adminCookie);
      expect(status).toBe(400);
    });

    it("non-admin gets 403 when creating users", async () => {
      const { status } = await postJson(app, "/api/admin/users", {
        username: "hack",
        password: "Password123",
        displayName: "Hack",
        expiresAt: "2099-12-31",
        isAdmin: true,
      }, studentCookie);
      expect(status).toBe(403);
    });
  });

  describe("DELETE /api/admin/users/:userId", () => {
    it("admin can delete a regular user", async () => {
      const { body } = await getJson(app, "/api/admin/users", adminCookie);
      const student = (body as any).data.find((u: any) => u.username === "student");
      const { status } = await deleteJson(app, `/api/admin/users/${student.id}`, adminCookie);
      expect(status).toBe(200);
    });

    it("cannot delete self", async () => {
      const { body } = await getJson(app, "/api/admin/users", adminCookie);
      const admin = (body as any).data.find((u: any) => u.username === "admin");
      const { status } = await deleteJson(app, `/api/admin/users/${admin.id}`, adminCookie);
      expect(status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
      const { status } = await deleteJson(app, "/api/admin/users/user-nonexistent", adminCookie);
      expect(status).toBe(404);
    });
  });
});
