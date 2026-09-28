import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

export interface FeedbackRow {
    id: string;
    user_id: string;
    type: string;
    title: string;
    content: string;
    paper_question_id: string | null;
    status: string;
    admin_reply: string | null;
    replied_by: string | null;
    replied_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface FeedbackWithUser extends FeedbackRow {
    user_display_name: string;
    user_username: string;
}

export function createFeedback(
    db: AppDatabase,
    params: { userId: string; type: string; title: string; content: string; paperQuestionId?: string | null }
): string {
    const id = `fb-${randomUUID()}`;
    db.prepare(
        `INSERT INTO feedback (id, user_id, type, title, content, paper_question_id)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, params.userId, params.type, params.title, params.content, params.paperQuestionId ?? null);
    return id;
}

export function listFeedbackByUser(db: AppDatabase, userId: string): FeedbackRow[] {
    return db
        .prepare(`SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`)
        .all(userId) as FeedbackRow[];
}

export function listAllFeedback(
    db: AppDatabase,
    filters: { status?: string; type?: string }
): FeedbackWithUser[] {
    const conditions: string[] = [];
    const args: unknown[] = [];
    if (filters.status) { conditions.push("f.status = ?"); args.push(filters.status); }
    if (filters.type) { conditions.push("f.type = ?"); args.push(filters.type); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db
        .prepare(
            `SELECT f.*, u.display_name AS user_display_name, u.username AS user_username
             FROM feedback f
             INNER JOIN users u ON u.id = f.user_id
             ${where}
             ORDER BY f.created_at DESC`
        )
        .all(...args) as FeedbackWithUser[];
}

export function getFeedback(db: AppDatabase, feedbackId: string): FeedbackRow | undefined {
    return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(feedbackId) as FeedbackRow | undefined;
}

export function replyToFeedback(
    db: AppDatabase,
    feedbackId: string,
    params: { adminReply: string; status: string; repliedBy: string }
): void {
    db.prepare(
        `UPDATE feedback
         SET admin_reply = ?, status = ?, replied_by = ?, replied_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).run(params.adminReply, params.status, params.repliedBy, feedbackId);
}

export function updateFeedbackStatus(
    db: AppDatabase,
    feedbackId: string,
    status: string
): void {
    db.prepare(
        `UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(status, feedbackId);
}

export function countFeedback(db: AppDatabase): number {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM feedback`).get() as { count: number };
    return row.count;
}

export function countOpenFeedback(db: AppDatabase): number {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM feedback WHERE status = 'open'`).get() as { count: number };
    return row.count;
}

