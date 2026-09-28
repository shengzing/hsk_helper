import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    getRecordSummary,
    getStatsByUser,
    listRecordsByUser,
} from "../repositories/recordRepository.js";

export function createRecordRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/records — list user's completed attempts
    router.get("/", (req, res) => {
        const userId = res.locals.userId as string;
        const records = listRecordsByUser(db, userId);
        const stats = getStatsByUser(db, userId);
        res.json({ data: { records, stats } });
    });

    // GET /api/records/:attemptId — get a single record summary
    router.get("/:attemptId", (req, res) => {
        const userId = res.locals.userId as string;
        const record = getRecordSummary(db, req.params.attemptId, userId);
        if (!record) {
            return res.status(404).json({
                error: { code: "RECORD_NOT_FOUND", message: "Record not found" },
            });
        }
        res.json({ data: record });
    });

    return router;
}

