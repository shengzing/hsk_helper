import { describe, it, expect, beforeEach } from "vitest";
import {
  createSubscriptionForUser,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  renewSubscription,
  batchCreateSubscriptions,
  listMySubscriptions,
  listMyBanks,
  updateSubscription,
  getSubscriptionPlans,
  purchaseSubscription,
  FULL_SUBSCRIPTION_PRICE,
  PER_BANK_PRICE,
  SUBSCRIPTION_DURATION_DAYS,
} from "../src/services/subscriptionService.js";
import { hasValidSubscription, findSubscription } from "../src/repositories/subscriptionRepository.js";
import { HttpError } from "../src/utils/httpError.js";
import { createTestDbWithUsers, type TestDb } from "./helpers/db.js";

describe("Subscription service", () => {
  let db: TestDb;
  const adminId = "user-admin";
  const studentId = "user-student";

  beforeEach(() => {
    db = createTestDbWithUsers();
  });

  describe("createSubscriptionForUser", () => {
    it("creates an active subscription for HSK1", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
        adminId
      );
      expect(subId).toMatch(/^sub-/);
      const sub = findSubscription(db, subId);
      expect(sub?.status).toBe("active");
      expect(sub?.bank_id).toBe("hsk-level-1");
    });

    it("throws 409 for duplicate active subscription", () => {
      createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
        adminId
      );
      expect(() =>
        createSubscriptionForUser(
          db,
          { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-02-01T00:00:00Z", expiresAt: "2027-02-01T00:00:00Z" },
          adminId
        )
      ).toThrow(HttpError);
    });

    it("writes audit log entry", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-2", startsAt: "2026-01-01T00:00:00Z", expiresAt: null, note: "test" },
        adminId
      );
      const logs = db.prepare("SELECT * FROM admin_operation_logs WHERE object_id = ?").all(subId) as any[];
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("create");
      expect(logs[0].operator_id).toBe(adminId);
    });
  });

  describe("pauseSubscription", () => {
    it("changes status from active to paused", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-2", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      pauseSubscription(db, subId, adminId);
      expect(findSubscription(db, subId)?.status).toBe("paused");
    });

    it("throws 400 when pausing a non-active subscription", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-2", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      pauseSubscription(db, subId, adminId);
      expect(() => pauseSubscription(db, subId, adminId)).toThrow(HttpError);
    });

    it("throws 404 for non-existent subscription", () => {
      expect(() => pauseSubscription(db, "sub-nonexistent", adminId)).toThrow(HttpError);
    });
  });

  describe("resumeSubscription", () => {
    it("changes status from paused to active", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-3", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      pauseSubscription(db, subId, adminId);
      resumeSubscription(db, subId, adminId);
      expect(findSubscription(db, subId)?.status).toBe("active");
    });

    it("throws 400 when resuming a non-paused subscription", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-3", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      expect(() => resumeSubscription(db, subId, adminId)).toThrow(HttpError);
    });
  });

  describe("cancelSubscription", () => {
    it("changes status to canceled", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      cancelSubscription(db, subId, adminId);
      expect(findSubscription(db, subId)?.status).toBe("canceled");
    });

    it("throws 400 when canceling an already-canceled subscription", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      cancelSubscription(db, subId, adminId);
      expect(() => cancelSubscription(db, subId, adminId)).toThrow(HttpError);
    });
  });

  describe("renewSubscription", () => {
    it("updates expires_at and sets status to active", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: "2026-06-01T00:00:00Z" },
        adminId
      );
      renewSubscription(db, subId, "2027-12-31T23:59:59Z", adminId);
      const sub = findSubscription(db, subId);
      expect(sub?.status).toBe("active");
      expect(sub?.expires_at).toBe("2027-12-31T23:59:59Z");
    });

    it("throws 400 when renewing a canceled subscription", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      cancelSubscription(db, subId, adminId);
      expect(() => renewSubscription(db, subId, "2027-12-31T23:59:59Z", adminId)).toThrow(HttpError);
    });
  });

  describe("batchCreateSubscriptions", () => {
    it("creates multiple subscriptions for different users and banks", () => {
      // Create extra test users
      db.prepare("INSERT INTO users (id, username, display_name) VALUES ('u1', 'u1', 'User 1')").run();
      db.prepare("INSERT INTO users (id, username, display_name) VALUES ('u2', 'u2', 'User 2')").run();
      const ids = batchCreateSubscriptions(db, [
        { userId: "u1", bankId: "hsk-level-1", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        { userId: "u2", bankId: "hsk-level-2", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
      ], adminId);
      expect(ids).toHaveLength(2);
    });

    it("skips duplicates silently", () => {
      const ids = batchCreateSubscriptions(db, [
        { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-02-01T00:00:00Z", expiresAt: null },
      ], adminId);
      expect(ids).toHaveLength(1);
    });
  });

  describe("listMySubscriptions", () => {
    it("returns all subscriptions for a user", () => {
      createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-1", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      const subs = listMySubscriptions(db, studentId);
      // seed has HSK4 + newly created HSK1
      expect(subs.length).toBeGreaterThanOrEqual(2);
      const levels = subs.map((s) => s.bank_level).sort();
      expect(levels).toContain(1);
      expect(levels).toContain(4);
    });
  });

  describe("listMyBanks", () => {
    it("returns banks with active subscription (seed HSK4)", () => {
      const banks = listMyBanks(db, studentId);
      expect(banks).toHaveLength(2);
      expect(banks.map((b) => b.level).sort()).toEqual([4, 6]);
    });

    it("returns empty for user with no subscriptions", () => {
      const banks = listMyBanks(db, adminId);
      expect(banks).toHaveLength(0);
    });
  });

  describe("hasValidSubscription", () => {
    it("returns true for active, non-expired subscription", () => {
      expect(hasValidSubscription(db, studentId, "hsk-level-4")).toBe(true);
    });

    it("returns false for unsubscribed bank", () => {
      expect(hasValidSubscription(db, studentId, "hsk-level-5")).toBe(false);
    });

    it("returns false for paused subscription", () => {
      // The seed subscription is active; pause it
      db.prepare("UPDATE bank_subscriptions SET status = 'paused' WHERE user_id = ? AND bank_id = ?")
        .run(studentId, "hsk-level-4");
      expect(hasValidSubscription(db, studentId, "hsk-level-4")).toBe(false);
    });

    it("returns false for expired subscription", () => {
      db.prepare("UPDATE bank_subscriptions SET expires_at = '2020-01-01T00:00:00Z' WHERE user_id = ? AND bank_id = ?")
        .run(studentId, "hsk-level-4");
      expect(hasValidSubscription(db, studentId, "hsk-level-4")).toBe(false);
    });
  });

  describe("updateSubscription", () => {
    it("updates status and expires_at", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      updateSubscription(db, subId, { status: "expired", expiresAt: "2025-01-01T00:00:00Z" }, adminId);
      const sub = findSubscription(db, subId);
      expect(sub?.status).toBe("expired");
      expect(sub?.expires_at).toBe("2025-01-01T00:00:00Z");
    });

    it("throws 400 for invalid status", () => {
      const subId = createSubscriptionForUser(
        db,
        { userId: studentId, bankId: "hsk-level-5", startsAt: "2026-01-01T00:00:00Z", expiresAt: null },
        adminId
      );
      expect(() => updateSubscription(db, subId, { status: "bogus" }, adminId)).toThrow(HttpError);
   });
 });

  describe("pricing constants", () => {
    it("full subscription is 99 yuan", () => {
      expect(FULL_SUBSCRIPTION_PRICE).toBe(99);
    });

    it("per bank is 19.9 yuan", () => {
      expect(PER_BANK_PRICE).toBe(19.9);
    });

    it("duration is 365 days", () => {
      expect(SUBSCRIPTION_DURATION_DAYS).toBe(365);
    });
  });

  describe("getSubscriptionPlans", () => {
    it("returns all 6 published banks with pricing", () => {
      const plans = getSubscriptionPlans(db, studentId);
      expect(plans.fullSubscription.price).toBe(99);
      expect(plans.perBank.price).toBe(19.9);
      expect(plans.banks).toHaveLength(6);
      expect(plans.banks.map((b) => b.level).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("marks already-subscribed banks", () => {
      const plans = getSubscriptionPlans(db, studentId);
      const hsk4 = plans.banks.find((b) => b.level === 4);
      const hsk6 = plans.banks.find((b) => b.level === 6);
      const hsk1 = plans.banks.find((b) => b.level === 1);
      expect(hsk4?.subscribed).toBe(true);
      expect(hsk6?.subscribed).toBe(true);
      expect(hsk1?.subscribed).toBe(false);
    });

    it("shows no subscribed banks for admin", () => {
      const plans = getSubscriptionPlans(db, adminId);
      expect(plans.banks.every((b) => !b.subscribed)).toBe(true);
    });
  });

  describe("purchaseSubscription", () => {
    it("full purchase creates subscriptions for all unsubscribed banks", () => {
      const result = purchaseSubscription(db, { orderType: "full" }, studentId);
      expect(result.orderType).toBe("full");
      expect(result.totalPrice).toBe(99);
      expect(result.createdBankIds).toHaveLength(4);
      expect(result.skippedBankIds).toHaveLength(2);
      expect(result.skippedBankIds).toContain("hsk-level-4");
      expect(result.skippedBankIds).toContain("hsk-level-6");
      const banks = listMyBanks(db, studentId);
      expect(banks).toHaveLength(6);
    });

    it("full purchase for user with no subscriptions creates all 6", () => {
      const result = purchaseSubscription(db, { orderType: "full" }, adminId);
      expect(result.createdBankIds).toHaveLength(6);
      expect(result.skippedBankIds).toHaveLength(0);
      expect(result.totalPrice).toBe(99);
      const banks = listMyBanks(db, adminId);
      expect(banks).toHaveLength(6);
    });

    it("single purchase creates subscription for selected bank", () => {
      const result = purchaseSubscription(db, { orderType: "single", bankIds: ["hsk-level-1"] }, studentId);
      expect(result.orderType).toBe("single");
      expect(result.totalPrice).toBe(19.9);
      expect(result.createdBankIds).toEqual(["hsk-level-1"]);
      expect(result.skippedBankIds).toHaveLength(0);
      const banks = listMyBanks(db, studentId);
      expect(banks.some((b) => b.level === 1)).toBe(true);
    });

    it("single purchase with multiple banks charges per-bank price", () => {
      const result = purchaseSubscription(
        db,
        { orderType: "single", bankIds: ["hsk-level-1", "hsk-level-2", "hsk-level-3"] },
        studentId
      );
      expect(result.totalPrice).toBe(59.7);
      expect(result.createdBankIds).toHaveLength(3);
    });

    it("skips already-subscribed banks in single purchase", () => {
      const result = purchaseSubscription(
        db,
        { orderType: "single", bankIds: ["hsk-level-1", "hsk-level-4"] },
        studentId
      );
      expect(result.createdBankIds).toEqual(["hsk-level-1"]);
      expect(result.skippedBankIds).toEqual(["hsk-level-4"]);
    });

    it("throws 400 for single purchase without bankIds", () => {
      expect(() => purchaseSubscription(db, { orderType: "single" }, studentId)).toThrow(HttpError);
    });

    it("throws 400 for invalid bank ID", () => {
      expect(() =>
        purchaseSubscription(db, { orderType: "single", bankIds: ["nonexistent"] }, studentId)
      ).toThrow(HttpError);
    });

    it("throws 400 for invalid orderType", () => {
      expect(() =>
        purchaseSubscription(db, { orderType: "bogus" as any }, studentId)
      ).toThrow(HttpError);
    });

    it("creates an order record", () => {
      const result = purchaseSubscription(db, { orderType: "full" }, adminId);
      const orders = db.prepare("SELECT * FROM orders WHERE user_id = ?").all(adminId) as any[];
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe(result.orderId);
      expect(orders[0].order_type).toBe("full");
      expect(orders[0].total_price).toBe(99);
      expect(orders[0].status).toBe("completed");
      const bankIds = JSON.parse(orders[0].bank_ids_json);
      expect(bankIds).toHaveLength(6);
    });

    it("full purchase on already-fully-subscribed user creates nothing", () => {
      purchaseSubscription(db, { orderType: "full" }, studentId);
      const result = purchaseSubscription(db, { orderType: "full" }, studentId);
      expect(result.createdBankIds).toHaveLength(0);
      expect(result.skippedBankIds).toHaveLength(6);
      expect(result.totalPrice).toBe(99);
    });
  });
});
