import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    createFeedback,
    listFeedbackByUser,
    listAllFeedback,
    replyToFeedback,
    updateFeedbackStatus,
} from "../repositories/feedbackRepository.js";
import { HttpError } from "../utils/httpError.js";

const VALID_TYPES = ["bug", "suggestion", "question_error", "other"];
const VALID_STATUSES = ["open", "replied", "resolved", "closed"];

/** User-facing feedback routes (requires auth). */
export function createFeedbackRouter(db: AppDatabase): Router {
    const router = Router();

    // POST /api/feedback — submit feedback
    router.post("/", (req, res) => {
        const userId = res.locals.userId as string;
        const body = req.body as Record<string, unknown>;
        const type = typeof body.type === "string" ? body.type : "";
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const content = typeof body.content === "string" ? body.content.trim() : "";
        const paperQuestionId = typeof body.paperQuestionId === "string" ? body.paperQuestionId : null;
        if (!VALID_TYPES.includes(type)) {
            throw new HttpError(400, "INVALID_TYPE", `Type must be one of: ${VALID_TYPES.join(", ")}`);
        }
        if (!title || !content) {
            throw new HttpError(400, "INVALID_INPUT", "Title and content are required");
        }
        const id = createFeedback(db, { userId, type, title, content, paperQuestionId });
        res.status(201).json({ data: { id } });
    });

    // GET /api/feedback — list current user's feedback
    router.get("/", (_req, res) => {
        const userId = res.locals.userId as string;
        res.json({ data: listFeedbackByUser(db, userId) });
    });

    return router;
}

/** Admin feedback routes (requires admin). */
export function createAdminFeedbackRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/admin/feedback — list all feedback with filters
    router.get("/", (req, res) => {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const type = typeof req.query.type === "string" ? req.query.type : undefined;
        res.json({ data: listAllFeedback(db, { status, type }) });
    });

    // PATCH /api/admin/feedback/:id — reply or update status
    router.patch("/:id", (req, res) => {
        const operatorId = res.locals.userId as string;
        const feedbackId = req.params.id;
        const body = req.body as Record<string, unknown>;
        const adminReply = typeof body.adminReply === "string" ? body.adminReply : undefined;
        const status = typeof body.status === "string" ? body.status : undefined;
        if (adminReply && status) {
            if (!VALID_STATUSES.includes(status)) {
                throw new HttpError(400, "INVALID_STATUS", `Status must be one of: ${VALID_STATUSES.join(", ")}`);
            }
            replyToFeedback(db, feedbackId, { adminReply, status, repliedBy: operatorId });
        } else if (status) {
            if (!VALID_STATUSES.includes(status)) {
                throw new HttpError(400, "INVALID_STATUS", `Status must be one of: ${VALID_STATUSES.join(", ")}`);
            }
            updateFeedbackStatus(db, feedbackId, status);
        } else {
            throw new HttpError(400, "INVALID_INPUT", "Provide adminReply or status");
        }
        res.json({ data: { updated: true } });
    });

    return router;
}

