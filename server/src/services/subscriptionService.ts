import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";
import { logOperation } from "./auditService.js";
import { createOrder } from "../repositories/orderRepository.js";
import {
    createSubscription,
    findActiveSubscription,
    findSubscription,
    listAccessibleBanks,
    listAllSubscriptions,
    listSubscriptionsByUser,
    listAllPublishedBanks,
    type SubscriptionWithBank,
    updateSubscriptionStatus,
} from "../repositories/subscriptionRepository.js";
import { HttpError } from "../utils/httpError.js";

/** Formats a Date as a SQLite-compatible UTC string: "YYYY-MM-DD HH:MM:SS" */
function sqliteTimestamp(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

export interface CreateSubscriptionInput {
    userId: string;
    bankId: string;
    startsAt: string;
    expiresAt: string | null;
    note?: string;
}

export const FULL_SUBSCRIPTION_PRICE = 99;
export const PER_BANK_PRICE = 19.9;
export const SUBSCRIPTION_DURATION_DAYS = 365;

export interface BankPlan {
    id: string;
    code: string;
    level: number;
    name: string;
    status: string;
    paperCount: number;
    subscribed: boolean;
}

export interface SubscriptionPlans {
    fullSubscription: { price: number; durationDays: number };
    perBank: { price: number; durationDays: number };
    banks: BankPlan[];
}

export function getSubscriptionPlans(db: AppDatabase, userId: string): SubscriptionPlans {
    const allBanks = listAllPublishedBanks(db);
    const subscribedBankIds = new Set(listAccessibleBanks(db, userId).map((b) => b.id));

    return {
        fullSubscription: {
            price: FULL_SUBSCRIPTION_PRICE,
            durationDays: SUBSCRIPTION_DURATION_DAYS,
        },
        perBank: {
            price: PER_BANK_PRICE,
            durationDays: SUBSCRIPTION_DURATION_DAYS,
        },
        banks: allBanks.map((b) => ({
            id: b.id,
            code: b.code,
            level: b.level,
            name: b.name,
            status: b.status,
            paperCount: b.paper_count,
            subscribed: subscribedBankIds.has(b.id),
        })),
    };
}

export interface PurchaseInput {
    orderType: "full" | "single";
    bankIds?: string[];  // required for "single" type
}

export interface PurchaseResult {
    orderId: string;
    orderType: string;
    totalPrice: number;
    createdBankIds: string[];
    skippedBankIds: string[];
}

export function purchaseSubscription(
    db: AppDatabase,
    input: PurchaseInput,
    userId: string
): PurchaseResult {
    const allBanks = listAllPublishedBanks(db);
    const bankMap = new Map(allBanks.map((b) => [b.id, b]));

    let targetBankIds: string[];
    let totalPrice: number;

    if (input.orderType === "full") {
        targetBankIds = allBanks.map((b) => b.id);
        totalPrice = FULL_SUBSCRIPTION_PRICE;
    } else if (input.orderType === "single") {
        if (!input.bankIds || input.bankIds.length === 0) {
            throw new HttpError(400, "INVALID_INPUT", "At least one bank ID is required for single purchase");
        }
        // Validate all bank IDs exist and are published
        for (const id of input.bankIds) {
            if (!bankMap.has(id)) {
                throw new HttpError(400, "BANK_NOT_FOUND", `Bank not found: ${id}`);
            }
        }
        targetBankIds = input.bankIds;
        totalPrice = Math.round(PER_BANK_PRICE * input.bankIds.length * 100) / 100;
    } else {
        throw new HttpError(400, "INVALID_INPUT", "orderType must be 'full' or 'single'");
    }

    const startsAt = sqliteTimestamp(new Date());
    const expiresAt = sqliteTimestamp(new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000));

    const createdBankIds: string[] = [];
    const skippedBankIds: string[] = [];

    const orderId = `order-${randomUUID()}`;
    const txn = db.transaction(() => {
        for (const bankId of targetBankIds) {
            const existing = findActiveSubscription(db, userId, bankId);
            if (existing) {
                skippedBankIds.push(bankId);
                continue;
            }
            const subId = `sub-${randomUUID()}`;
            createSubscription(db, {
                id: subId,
                userId,
                bankId,
                startsAt,
                expiresAt,
                source: "order",
                operatorId: userId,
                note: input.orderType === "full" ? "full-subscription" : "single-purchase",
            });
            createdBankIds.push(bankId);
        }
        createOrder(db, {
            id: orderId,
            userId,
            orderType: input.orderType,
            totalPrice,
            bankIds: targetBankIds,
        });
    });
    txn();

    return {
        orderId,
        orderType: input.orderType,
        totalPrice,
        createdBankIds,
        skippedBankIds,
    };
}

export function listMySubscriptions(
    db: AppDatabase,
    userId: string
): SubscriptionWithBank[] {
    return listSubscriptionsByUser(db, userId);
}

export function adminListSubscriptions(
    db: AppDatabase,
    filters: { userId?: string; bankId?: string; status?: string }
) {
    return listAllSubscriptions(db, filters);
}

export function listMyBanks(
    db: AppDatabase,
    userId: string
): Array<{ id: string; code: string; level: number; name: string; status: string }> {
    return listAccessibleBanks(db, userId);
}

export function createSubscriptionForUser(
    db: AppDatabase,
    input: CreateSubscriptionInput,
    operatorId: string
): string {
    const existing = findActiveSubscription(db, input.userId, input.bankId);
    if (existing) {
        throw new HttpError(
            409,
            "SUBSCRIPTION_EXISTS",
            "User already has an active or paused subscription for this bank"
        );
    }

    const subId = `sub-${randomUUID()}`;
    const txn = db.transaction(() => {
        createSubscription(db, {
            id: subId,
            userId: input.userId,
            bankId: input.bankId,
            startsAt: input.startsAt,
            expiresAt: input.expiresAt,
            source: "manual",
            operatorId,
            note: input.note ?? null,
        });
        logOperation(db, {
            operatorId,
            action: "create",
            objectType: "subscription",
            objectId: subId,
            afterState: {
                user_id: input.userId,
                bank_id: input.bankId,
                status: "active",
                starts_at: input.startsAt,
                expires_at: input.expiresAt,
            },
        });
    });
    txn();
    return subId;
}

export function batchCreateSubscriptions(
    db: AppDatabase,
    inputs: CreateSubscriptionInput[],
    operatorId: string
): string[] {
    const results: string[] = [];
    for (const input of inputs) {
        const existing = findActiveSubscription(db, input.userId, input.bankId);
        if (existing) continue; // skip duplicates silently
        const subId = createSubscriptionForUser(db, input, operatorId);
        results.push(subId);
    }
    return results;
}

export function pauseSubscription(
    db: AppDatabase,
    subscriptionId: string,
    operatorId: string
): void {
    const sub = findSubscription(db, subscriptionId);
    if (!sub) throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (sub.status !== "active") {
        throw new HttpError(400, "INVALID_STATUS", "Only active subscriptions can be paused");
    }
    const before = { status: sub.status, expires_at: sub.expires_at };
    const txn = db.transaction(() => {
        updateSubscriptionStatus(db, subscriptionId, "paused");
        logOperation(db, {
            operatorId,
            action: "pause",
            objectType: "subscription",
            objectId: subscriptionId,
            beforeState: before,
            afterState: { status: "paused" },
        });
    });
    txn();
}

export function resumeSubscription(
    db: AppDatabase,
    subscriptionId: string,
    operatorId: string
): void {
    const sub = findSubscription(db, subscriptionId);
    if (!sub) throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (sub.status !== "paused") {
        throw new HttpError(400, "INVALID_STATUS", "Only paused subscriptions can be resumed");
    }
    const before = { status: sub.status };
    const txn = db.transaction(() => {
        updateSubscriptionStatus(db, subscriptionId, "active");
        logOperation(db, {
            operatorId,
            action: "resume",
            objectType: "subscription",
            objectId: subscriptionId,
            beforeState: before,
            afterState: { status: "active" },
        });
    });
    txn();
}

export function cancelSubscription(
    db: AppDatabase,
    subscriptionId: string,
    operatorId: string
): void {
    const sub = findSubscription(db, subscriptionId);
    if (!sub) throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (sub.status === "canceled") {
        throw new HttpError(400, "INVALID_STATUS", "Subscription is already canceled");
    }
    const before = { status: sub.status };
    const txn = db.transaction(() => {
        updateSubscriptionStatus(db, subscriptionId, "canceled");
        logOperation(db, {
            operatorId,
            action: "cancel",
            objectType: "subscription",
            objectId: subscriptionId,
            beforeState: before,
            afterState: { status: "canceled" },
        });
    });
    txn();
}

export function renewSubscription(
    db: AppDatabase,
    subscriptionId: string,
    newExpiresAt: string,
    operatorId: string
): void {
    const sub = findSubscription(db, subscriptionId);
    if (!sub) throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (sub.status === "canceled") {
        throw new HttpError(400, "INVALID_STATUS", "Cannot renew a canceled subscription");
    }
    const before = { status: sub.status, expires_at: sub.expires_at };
    const txn = db.transaction(() => {
        updateSubscriptionStatus(db, subscriptionId, "active", newExpiresAt);
        logOperation(db, {
            operatorId,
            action: "renew",
            objectType: "subscription",
            objectId: subscriptionId,
            beforeState: before,
            afterState: { status: "active", expires_at: newExpiresAt },
        });
    });
    txn();
}

export function updateSubscription(
    db: AppDatabase,
    subscriptionId: string,
    updates: { status?: string; expiresAt?: string | null },
    operatorId: string
): void {
    const sub = findSubscription(db, subscriptionId);
    if (!sub) throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    const validStatuses = ["active", "paused", "expired", "canceled"];
    const newStatus = updates.status ?? sub.status;
    if (!validStatuses.includes(newStatus)) {
        throw new HttpError(400, "INVALID_STATUS", `Status must be one of: ${validStatuses.join(", ")}`);
    }
    const newExpiresAt = updates.expiresAt !== undefined ? updates.expiresAt : sub.expires_at;
    const before = { status: sub.status, expires_at: sub.expires_at };
    const txn = db.transaction(() => {
        updateSubscriptionStatus(db, subscriptionId, newStatus, newExpiresAt);
        logOperation(db, {
            operatorId,
            action: "update",
            objectType: "subscription",
            objectId: subscriptionId,
            beforeState: before,
            afterState: { status: newStatus, expires_at: newExpiresAt },
        });
    });
    txn();
}
