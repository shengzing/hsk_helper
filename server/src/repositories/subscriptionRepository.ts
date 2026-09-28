import type { AppDatabase } from "../db/connection.js";
import type { BankSubscription } from "../types.js";

export interface SubscriptionWithBank extends BankSubscription {
    bank_code: string;
    bank_level: number;
    bank_name: string;
    paper_count: number;
}

export function listSubscriptionsByUser(
    db: AppDatabase,
    userId: string
): SubscriptionWithBank[] {
    return db
        .prepare(
            `SELECT s.*, b.code AS bank_code, b.level AS bank_level, b.name AS bank_name,
                    (
                        SELECT COUNT(*)
                        FROM past_exam_papers p
                        WHERE p.bank_id = s.bank_id AND p.status = 'published'
                    ) AS paper_count
             FROM bank_subscriptions s
             INNER JOIN question_banks b ON b.id = s.bank_id
             WHERE s.user_id = ?
             ORDER BY b.level ASC`
        )
        .all(userId) as SubscriptionWithBank[];
}

export function listAllSubscriptions(
    db: AppDatabase,
    filters: { userId?: string; bankId?: string; status?: string }
): SubscriptionWithBank[] {
    const conditions: string[] = [];
    const args: unknown[] = [];
    if (filters.userId) {
        conditions.push("s.user_id = ?");
        args.push(filters.userId);
    }
    if (filters.bankId) {
        conditions.push("s.bank_id = ?");
        args.push(filters.bankId);
    }
    if (filters.status) {
        conditions.push("s.status = ?");
        args.push(filters.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db
        .prepare(
            `SELECT s.*, b.code AS bank_code, b.level AS bank_level, b.name AS bank_name,
                    u.username AS user_username, u.display_name AS user_display_name
             FROM bank_subscriptions s
             INNER JOIN question_banks b ON b.id = s.bank_id
             INNER JOIN users u ON u.id = s.user_id
             ${where}
             ORDER BY b.level ASC, u.username ASC`
        )
        .all(...args) as (SubscriptionWithBank & {
            user_username: string;
            user_display_name: string;
        })[];
}

export function findSubscription(
    db: AppDatabase,
    subscriptionId: string
): BankSubscription | undefined {
    return db
        .prepare(
            `SELECT * FROM bank_subscriptions WHERE id = ?`
        )
        .get(subscriptionId) as BankSubscription | undefined;
}

export function findActiveSubscription(
    db: AppDatabase,
    userId: string,
    bankId: string
): BankSubscription | undefined {
    return db
        .prepare(
            `SELECT * FROM bank_subscriptions
             WHERE user_id = ? AND bank_id = ? AND status IN ('active', 'paused')`
        )
        .get(userId, bankId) as BankSubscription | undefined;
}

export function createSubscription(
    db: AppDatabase,
    params: {
        id: string;
        userId: string;
        bankId: string;
        startsAt: string;
        expiresAt: string | null;
        source: string;
        operatorId: string;
        note?: string | null;
    }
): void {
    db.prepare(
        `INSERT INTO bank_subscriptions
            (id, user_id, bank_id, status, starts_at, expires_at, source, operator_id, note)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).run(
        params.id,
        params.userId,
        params.bankId,
        params.startsAt,
        params.expiresAt,
        params.source,
        params.operatorId,
        params.note ?? null
    );
}

export function updateSubscriptionStatus(
    db: AppDatabase,
    subscriptionId: string,
    status: string,
    expiresAt?: string | null
): void {
    if (expiresAt !== undefined) {
        db.prepare(
            `UPDATE bank_subscriptions
             SET status = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).run(status, expiresAt, subscriptionId);
    } else {
        db.prepare(
            `UPDATE bank_subscriptions
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).run(status, subscriptionId);
    }
}

/** Returns true if user has an active, non-expired subscription for the given bank. */
export function hasValidSubscription(
    db: AppDatabase,
    userId: string,
    bankId: string
): boolean {
    const row = db
        .prepare(
            `SELECT 1 AS flag
             FROM bank_subscriptions
             WHERE user_id = ? AND bank_id = ? AND status = 'active'
               AND starts_at <= CURRENT_TIMESTAMP
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`
        )
        .get(userId, bankId) as { flag: number } | undefined;
    return Boolean(row);
}

export function listAccessibleBanks(
    db: AppDatabase,
    userId: string
): Array<{ id: string; code: string; level: number; name: string; status: string }> {
    return db
        .prepare(
            `SELECT b.id, b.code, b.level, b.name, b.status
             FROM question_banks b
             INNER JOIN bank_subscriptions s ON s.bank_id = b.id
             WHERE s.user_id = ? AND s.status = 'active'
               AND s.starts_at <= CURRENT_TIMESTAMP
               AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
             ORDER BY b.level ASC`
        )
        .all(userId) as Array<{
        id: string;
        code: string;
        level: number;
        name: string;
        status: string;
    }>;
}

export function listAllPublishedBanks(
    db: AppDatabase
): Array<{ id: string; code: string; level: number; name: string; status: string; paper_count: number }> {
    return db
        .prepare(
            `SELECT b.id, b.code, b.level, b.name, b.status,
                    (
                        SELECT COUNT(*)
                        FROM past_exam_papers p
                        WHERE p.bank_id = b.id AND p.status = 'published'
                    ) AS paper_count
             FROM question_banks b
             WHERE b.status = 'published'
             ORDER BY b.level ASC`
        )
        .all() as Array<{
        id: string;
        code: string;
        level: number;
        name: string;
        status: string;
        paper_count: number;
    }>;
}
