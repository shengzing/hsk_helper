import { describe, it, expect, beforeEach } from "vitest";
import {
    login,
    logout,
    getSessionAuthContext,
    register,
    RegistrationError,
    SESSION_COOKIE_NAME,
    SESSION_TTL_MS,
} from "../src/services/authService.js";
import { findUserByUsername } from "../src/repositories/authRepository.js";
import { createTestDbWithUsers, type TestDb } from "./helpers/db.js";

describe("Auth service", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDbWithUsers();
  });

  describe("login", () => {
    it("succeeds with correct admin credentials", () => {
      const result = login(db, "admin", "Admin2026");
      expect(result.user.username).toBe("admin");
      expect(result.user.isAdmin).toBe(true);
      expect(result.token).toBeTruthy();
      expect(result.maxAge).toBeGreaterThan(0);
      expect(result.maxAge).toBe(SESSION_TTL_MS);
      expect(SESSION_TTL_MS).toBe(2 * 60 * 60 * 1000);
    });

    it("succeeds with correct student credentials", () => {
      const result = login(db, "student", "Study2026");
      expect(result.user.username).toBe("student");
      expect(result.user.isAdmin).toBe(false);
    });

    it("fails with wrong password", () => {
      expect(() => login(db, "admin", "wrongpass")).toThrow();
    });

    it("fails with non-existent user", () => {
      expect(() => login(db, "nobody", "whatever")).toThrow();
    });

    it("fails with empty password", () => {
      expect(() => login(db, "admin", "")).toThrow();
    });
  });

  describe("getSessionAuthContext", () => {
    it("returns user context for valid token", () => {
      const { token } = login(db, "admin", "Admin2026");
      const ctx = getSessionAuthContext(db, token);
      expect(ctx).not.toBeNull();
      expect(ctx!.user.username).toBe("admin");
    });

    it("returns null for invalid token", () => {
      expect(getSessionAuthContext(db, "invalid-token")).toBeNull();
    });

    it("returns null for undefined token", () => {
      expect(getSessionAuthContext(db, undefined)).toBeNull();
    });

    it("extends the session by two hours on authenticated activity", () => {
      const { token } = login(db, "admin", "Admin2026");
      expect(getSessionAuthContext(db, token)).not.toBeNull();

      const session = db
        .prepare(`SELECT expires_at FROM user_sessions ORDER BY created_at DESC LIMIT 1`)
        .get() as { expires_at: string } | undefined;
      expect(session).toBeDefined();
      expect(new Date(session!.expires_at).getTime()).toBeGreaterThan(
        Date.now() + 60 * 60 * 1000
      );
    });

    it("returns null after logout", () => {
      const { token } = login(db, "admin", "Admin2026");
      logout(db, token);
      expect(getSessionAuthContext(db, token)).toBeNull();
    });

    it("revokes previous sessions on new login", () => {
      const { token: token1 } = login(db, "admin", "Admin2026");
      expect(getSessionAuthContext(db, token1)).not.toBeNull();
      const { token: token2 } = login(db, "admin", "Admin2026");
      expect(getSessionAuthContext(db, token1)).toBeNull();
      expect(getSessionAuthContext(db, token2)).not.toBeNull();
    });
  });

  describe("SESSION_COOKIE_NAME", () => {
    it("is a non-empty string", () => {
      expect(SESSION_COOKIE_NAME).toBe("hsk_session");
    });
  });

  describe("register", () => {
    it("creates a user and returns a session token", () => {
      const result = register(db, { email: "newuser@test.com", password: "Pass1234" });
      expect(result.user.username).toBeTruthy();
      expect(result.user.email).toBe("newuser@test.com");
      expect(result.user.isAdmin).toBe(false);
      expect(result.token).toBeTruthy();
      expect(result.maxAge).toBe(SESSION_TTL_MS);

      // Session is valid
      const ctx = getSessionAuthContext(db, result.token);
      expect(ctx).not.toBeNull();
      expect(ctx!.user.email).toBe("newuser@test.com");
    });

    it("auto-logs in after registration", () => {
      const result = register(db, { email: "auto@test.com", password: "Pass1234" });
      const ctx = getSessionAuthContext(db, result.token);
      expect(ctx).not.toBeNull();
      expect(ctx!.user.username).toBe(result.user.username);
    });

    it("uses provided display name", () => {
      const result = register(db, {
        email: "named@test.com",
        password: "Pass1234",
        displayName: "Test User",
      });
      expect(result.user.displayName).toBe("Test User");
    });

    it("derives display name from email when not provided", () => {
      const result = register(db, { email: "jane@example.com", password: "Pass1234" });
      expect(result.user.displayName).toBe("jane");
    });

    it("rejects duplicate email (case-insensitive)", () => {
      register(db, { email: "dup@test.com", password: "Pass1234" });
      expect(() => register(db, { email: "DUP@test.com", password: "Pass1234" })).toThrow(
        RegistrationError
      );
      try {
        register(db, { email: "DUP@TEST.COM", password: "Pass1234" });
      } catch (err) {
        expect((err as RegistrationError).code).toBe("EMAIL_EXISTS");
      }
    });

    it("rejects invalid email", () => {
      expect(() => register(db, { email: "not-an-email", password: "Pass1234" })).toThrow(
        RegistrationError
      );
      try {
        register(db, { email: "not-an-email", password: "Pass1234" });
      } catch (err) {
        expect((err as RegistrationError).code).toBe("INVALID_EMAIL");
      }
    });

    it("rejects short password", () => {
      expect(() =>
        register(db, { email: "short@test.com", password: "12345" })
      ).toThrow(RegistrationError);
      try {
        register(db, { email: "short@test.com", password: "12345" });
      } catch (err) {
        expect((err as RegistrationError).code).toBe("WEAK_PASSWORD");
      }
    });

    it("allows login by email", () => {
      register(db, { email: "login@test.com", password: "Pass1234", displayName: "LoginTest" });
      const result = login(db, "login@test.com", "Pass1234");
      expect(result.user.email).toBe("login@test.com");
      expect(result.user.displayName).toBe("LoginTest");
    });

    it("handles username collision by appending suffix", () => {
      // Register two users whose email prefix is the same
      const r1 = register(db, { email: "user@abc.com", password: "Pass1234" });
      const r2 = register(db, { email: "user@def.com", password: "Pass1234" });
      expect(r2.user.username).not.toBe(r1.user.username);
      expect(r2.user.email).toBe("user@def.com");
    });
  });
});
