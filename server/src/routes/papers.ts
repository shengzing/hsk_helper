import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { getPaperDetail } from "../services/paperService.js";

export function createPaperRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/papers/:paperId — full paper detail (no answer_json)
    router.get("/:paperId", (req, res) => {
        const userId = res.locals.userId as string;
        const paperId = req.params.paperId;
        const paper = getPaperDetail(db, paperId, userId);
        res.json({ data: paper });
    });

    return router;
}

