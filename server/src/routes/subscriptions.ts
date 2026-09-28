import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    adminListSubscriptions,
    getSubscriptionPlans,
    purchaseSubscription,
    type PurchaseInput,
    batchCreateSubscriptions,
    cancelSubscription,
    listMySubscriptions,
    pauseSubscription,
    renewSubscription,
    resumeSubscription,
    updateSubscription,
} from "../services/subscriptionService.js";
import { HttpError } from "../utils/httpError.js";

/** Public-facing subscription routes (requires auth, not admin). */
export function createSubscriptionRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/subscriptions/me
    router.get("/me", (_req, res) => {
        const userId = res.locals.userId as string;
        const subs = listMySubscriptions(db, userId);
        res.json({
            data: subs.map((s) => ({
                bank_id: s.bank_id,
                level: s.bank_level,
                name: s.bank_name,
                status: s.status,
                starts_at: s.starts_at,
                expires_at: s.expires_at,
                paper_count: s.paper_count,
            })),
        });
    });

    // GET /api/subscriptions/plans — pricing info and available banks
    router.get("/plans", (_req, res) => {
        const userId = res.locals.userId as string;
        const plans = getSubscriptionPlans(db, userId);
        res.json({
            data: {
                full_subscription: {
                    price: plans.fullSubscription.price,
                    duration_days: plans.fullSubscription.durationDays,
                },
                per_bank: {
                    price: plans.perBank.price,
                    duration_days: plans.perBank.durationDays,
                },
                banks: plans.banks.map((b) => ({
                    id: b.id,
                    code: b.code,
                    level: b.level,
                    name: b.name,
                    paper_count: b.paperCount,
                    subscribed: b.subscribed,
                })),
            },
        });
    });

    // POST /api/subscriptions/purchase — purchase full or single bank subscription
    router.post("/purchase", (req, res) => {
        const userId = res.locals.userId as string;
        const orderType = typeof req.body?.orderType === "string" ? req.body.orderType : "";
        const bankIds = Array.isArray(req.body?.bankIds)
            ? req.body.bankIds.filter((id: unknown) => typeof id === "string")
            : undefined;

        if (orderType !== "full" && orderType !== "single") {
            res.status(400).json({
                error: { code: "INVALID_INPUT", message: "orderType must be 'full' or 'single'" },
            });
            return;
        }

        try {
            const result = purchaseSubscription(
                db,
                { orderType: orderType as PurchaseInput["orderType"], bankIds: bankIds as string[] | undefined },
                userId
            );
            res.status(201).json({
                data: {
                    order_id: result.orderId,
                    order_type: result.orderType,
                    total_price: result.totalPrice,
                    created_bank_ids: result.createdBankIds,
                    skipped_bank_ids: result.skippedBankIds,
                },
            });
        } catch (err) {
            if (err instanceof HttpError) {
                res.status(err.status).json({
                    error: { code: err.code, message: err.message },
                });
                return;
            }
            throw err;
        }
    });

    return router;
}

/** Admin subscription routes (requires admin). */
export function createAdminSubscriptionRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/admin/subscriptions
    router.get("/", (req, res) => {
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        const bankId = typeof req.query.bankId === "string" ? req.query.bankId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        res.json({ data: adminListSubscriptions(db, { userId, bankId, status }) });
    });

    // POST /api/admin/subscriptions — supports single or batch creation
    router.post("/", (req, res) => {
        const operatorId = res.locals.userId as string;
        const body = req.body;
        const items = Array.isArray(body?.subscriptions) ? body.subscriptions : [body];
        if (items.length === 0 || !items[0]) {
            throw new HttpError(400, "INVALID_INPUT", "At least one subscription is required");
        }
        const parsed = items.map((item: Record<string, unknown>) => {
            const userId = typeof item.userId === "string" ? item.userId.trim() : "";
            const bankId = typeof item.bankId === "string" ? item.bankId.trim() : "";
            const startsAt = typeof item.startsAt === "string" ? item.startsAt : new Date().toISOString();
            const expiresAt = typeof item.expiresAt === "string" ? item.expiresAt : null;
            const note = typeof item.note === "string" ? item.note : undefined;
            if (!userId || !bankId) {
                throw new HttpError(400, "INVALID_INPUT", "userId and bankId are required");
            }
            return { userId, bankId, startsAt, expiresAt, note };
        });
        const createdIds = batchCreateSubscriptions(db, parsed, operatorId);
        res.status(201).json({ data: { created: createdIds.length, ids: createdIds } });
    });

    // PATCH /api/admin/subscriptions/:subscriptionId
    router.patch("/:subscriptionId", (req, res) => {
        const operatorId = res.locals.userId as string;
        const subscriptionId = req.params.subscriptionId;
        const body = req.body as Record<string, unknown>;
        const action = typeof body.action === "string" ? body.action : undefined;

        if (action === "pause") {
            pauseSubscription(db, subscriptionId, operatorId);
        } else if (action === "resume") {
            resumeSubscription(db, subscriptionId, operatorId);
        } else if (action === "cancel") {
            cancelSubscription(db, subscriptionId, operatorId);
        } else if (action === "renew") {
            const newExpiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
            if (!newExpiresAt) {
                throw new HttpError(400, "INVALID_INPUT", "expiresAt is required for renew action");
            }
            renewSubscription(db, subscriptionId, newExpiresAt, operatorId);
        } else {
            const updates: { status?: string; expiresAt?: string | null } = {};
            if (typeof body.status === "string") updates.status = body.status;
            if (typeof body.expiresAt === "string") updates.expiresAt = body.expiresAt;
            if (body.expiresAt === null) updates.expiresAt = null;
            if (Object.keys(updates).length === 0) {
                throw new HttpError(400, "INVALID_INPUT", "Provide action or status/expiresAt fields");
            }
            updateSubscription(db, subscriptionId, updates, operatorId);
        }
        res.json({ data: { id: subscriptionId } });
    });

    return router;
}
