import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { listPendingEssayReviews, reviewEssay } from "../services/attemptService.js";
import { HttpError } from "../utils/httpError.js";

export function createEssayReviewRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/admin/reviews/essays — list pending essay reviews
    router.get("/essays", (_req, res) => {
        const items = listPendingEssayReviews(db);
        res.json({ data: items });
    });

    // PATCH /api/admin/reviews/essays/:resultId — score and complete review
    router.patch("/essays/:resultId", (req, res) => {
        const operatorId = res.locals.userId as string;
        const resultId = req.params.resultId;
        const body = req.body as Record<string, unknown>;
        const score = typeof body.score === "number" ? body.score : -1;
        const reviewComment = typeof body.reviewComment === "string" ? body.reviewComment : null;
        const rubricScores = body.rubricScores ?? null;
        const completed = body.completed !== false; // default true

        if (score < 0) {
            throw new HttpError(400, "INVALID_INPUT", "score is required and must be >= 0");
        }

        reviewEssay(db, resultId, operatorId, {
            score,
            reviewComment,
            rubricScores: rubricScores as Record<string, unknown> | null,
            completed,
        });
        res.json({ data: { reviewed: true } });
    });

    return router;
}

