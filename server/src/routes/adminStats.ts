import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";

interface CountRow {
    count: number;
}

function count(db: AppDatabase, sql: string): number {
    return (db.prepare(sql).get() as CountRow | undefined)?.count ?? 0;
}

export function createAdminStatsRouter(db: AppDatabase): Router {
    const router = Router();

    router.get("/", (_req, res) => {
        res.json({
            data: {
                stats: {
                    totalUsers: count(db, "SELECT COUNT(*) AS count FROM users"),
                    totalBanks: count(db, "SELECT COUNT(*) AS count FROM question_banks"),
                    totalPapers: count(db, "SELECT COUNT(*) AS count FROM past_exam_papers"),
                    totalKnowledgeDocs: count(db, "SELECT COUNT(*) AS count FROM knowledge_documents"),
                    activeSubscriptions: count(
                        db,
                        `SELECT COUNT(*) AS count
                         FROM bank_subscriptions
                         WHERE status = 'active'
                           AND starts_at <= CURRENT_TIMESTAMP
                           AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)`
                    ),
                    completedAttempts: count(
                        db,
                        "SELECT COUNT(*) AS count FROM attempts WHERE status IN ('submitted', 'graded')"
                    ),
                    openFeedback: count(
                        db,
                        "SELECT COUNT(*) AS count FROM feedback WHERE status = 'open'"
                    )
                }
            }
        });
    });

    return router;
}
