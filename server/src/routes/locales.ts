import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";

export function createLocalesRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/locales — public, no auth required
    router.get("/", (_req, res) => {
        const rows = db.prepare(
            `SELECT id, language_name, endonym, direction, is_default
             FROM supported_locales
             WHERE status = 'published'
             ORDER BY display_order`
        ).all() as Array<{
            id: string;
            language_name: string;
            endonym: string;
            direction: string;
            is_default: number;
        }>;

        res.json({
            locales: rows.map((r) => ({
                id: r.id,
                language_name: r.language_name,
                endonym: r.endonym,
                direction: r.direction,
                is_default: r.is_default === 1,
            })),
        });
    });

    return router;
}

