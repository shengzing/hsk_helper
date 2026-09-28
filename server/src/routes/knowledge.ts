import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { listCategories, listDocumentsByCategory, getDocument } from "../repositories/knowledgeRepository.js";

export function createKnowledgeRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/knowledge — list categories (optionally filtered by bank)
    router.get("/", (req, res) => {
        const bankId = typeof req.query.bankId === "string" ? req.query.bankId : undefined;
        const categories = listCategories(db, bankId);
        res.json({ data: categories });
    });

    // GET /api/knowledge/:categoryId/documents — list documents in a category
    router.get("/:categoryId/documents", (req, res) => {
        const docs = listDocumentsByCategory(db, req.params.categoryId);
        res.json({ data: docs });
    });

    // GET /api/knowledge/documents/:documentId — get a single document
    router.get("/documents/:documentId", (req, res) => {
        const doc = getDocument(db, req.params.documentId);
        if (!doc) {
            return res.status(404).json({
                error: { code: "DOCUMENT_NOT_FOUND", message: "Knowledge document not found" },
            });
        }
        res.json({ data: doc });
    });

    return router;
}

