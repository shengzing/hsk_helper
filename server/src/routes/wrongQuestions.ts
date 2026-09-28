import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    deleteWrongQuestion,
    listWrongQuestions,
} from "../repositories/wrongQuestionRepository.js";
import { HttpError } from "../utils/httpError.js";

export function createWrongQuestionRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/wrong-questions — list user's wrong questions with filters
    router.get("/", (req, res) => {
        const userId = res.locals.userId as string;
        const bankId = typeof req.query.bankId === "string" ? req.query.bankId : undefined;
        const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
        const questionType = typeof req.query.questionType === "string" ? req.query.questionType : undefined;
        const items = listWrongQuestions(db, userId, { bankId, sectionId, questionType });
        res.json({ data: items });
    });

    // DELETE /api/wrong-questions/:id — remove a wrong question from the user's collection
    router.delete("/:id", (req, res) => {
        const userId = res.locals.userId as string;
        const wrongQuestionId = req.params.id;
        const deleted = deleteWrongQuestion(db, wrongQuestionId, userId);
        if (!deleted) {
            throw new HttpError(404, "WRONG_QUESTION_NOT_FOUND", "Wrong question not found");
        }
        res.json({ data: null });
    });

    return router;
}

