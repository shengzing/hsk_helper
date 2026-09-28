import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { requireAdmin } from "../middlewares/auth.js";
import { createAttemptRouter } from "./attempts.js";
import { createBankRouter } from "./banks.js";
import { createPaperRouter } from "./papers.js";
import { createRecordRouter } from "./records.js";
import { createKnowledgeRouter } from "./knowledge.js";
import { createFeedbackRouter, createAdminFeedbackRouter } from "./feedback.js";
import { createSubscriptionRouter, createAdminSubscriptionRouter } from "./subscriptions.js";
import { createWrongQuestionRouter } from "./wrongQuestions.js";
import { createPreferencesRouter } from "./preferences.js";
import { createAdminUserRouter } from "./adminUsers.js";
import { createEssayReviewRouter } from "./essayReviews.js";
import { createImportRouter } from "./imports.js";
import { createAdminPaperRouter } from "./adminPapers.js";
import { createAdminStatsRouter } from "./adminStats.js";
import { createAdminKnowledgeRouter } from "./adminKnowledge.js";

export function createApiRouter(db: AppDatabase): Router {
    const router = Router();

    // Authenticated routes (user-facing)
    router.use(createAttemptRouter(db));
    router.use("/banks", createBankRouter(db));
    router.use("/papers", createPaperRouter(db));
    router.use("/records", createRecordRouter(db));
    router.use("/knowledge", createKnowledgeRouter(db));
    router.use("/feedback", createFeedbackRouter(db));
    router.use("/subscriptions", createSubscriptionRouter(db));
    router.use("/wrong-questions", createWrongQuestionRouter(db));
    router.use("/me", createPreferencesRouter(db));

    // Admin routes
    router.use("/admin/users", requireAdmin(db), createAdminUserRouter(db));
    router.use("/admin/subscriptions", requireAdmin(db), createAdminSubscriptionRouter(db));
    router.use("/admin/reviews", requireAdmin(db), createEssayReviewRouter(db));
    router.use("/admin/imports", requireAdmin(db), createImportRouter(db));
    router.use("/admin/papers", requireAdmin(db), createAdminPaperRouter(db));
    router.use("/admin/feedback", requireAdmin(db), createAdminFeedbackRouter(db));
    router.use("/admin/stats", requireAdmin(db), createAdminStatsRouter(db));
    router.use("/admin/knowledge", requireAdmin(db), createAdminKnowledgeRouter(db));

    return router;
}
