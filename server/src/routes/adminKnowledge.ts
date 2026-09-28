import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    createCategory,
    createDocument,
    listAdminDocuments,
    listCategories,
    updateCategory,
    updateDocument,
} from "../repositories/knowledgeRepository.js";
import { HttpError } from "../utils/httpError.js";

const VALID_STATUSES = new Set(["draft", "published"]);

function requireStatus(status: unknown): string {
    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
        throw new HttpError(400, "INVALID_STATUS", "Status must be draft or published");
    }
    return status;
}

export function createAdminKnowledgeRouter(db: AppDatabase): Router {
    const router = Router();

    router.get("/categories", (_req, res) => {
        res.json({ data: listCategories(db) });
    });

    router.post("/categories", (req, res) => {
        const body = req.body as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) throw new HttpError(400, "INVALID_INPUT", "Name is required");

        const id = `kc-${randomUUID()}`;
        createCategory(db, {
            id,
            bankId: typeof body.bankId === "string" && body.bankId ? body.bankId : null,
            name,
            description: typeof body.description === "string" ? body.description : null,
            displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
        });
        updateCategory(db, id, { status: body.status === undefined ? "draft" : requireStatus(body.status) });
        res.status(201).json({ data: { id } });
    });

    router.patch("/categories/:categoryId", (req, res) => {
        const body = req.body as Record<string, unknown>;
        updateCategory(db, req.params.categoryId, {
            bankId: body.bankId === null ? null : typeof body.bankId === "string" ? body.bankId : undefined,
            name: typeof body.name === "string" ? body.name.trim() : undefined,
            description: typeof body.description === "string" ? body.description : undefined,
            displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
            status: body.status === undefined ? undefined : requireStatus(body.status),
        });
        res.json({ data: { updated: true } });
    });

    router.get("/documents", (req, res) => {
        const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
        res.json({ data: listAdminDocuments(db, { categoryId, status, search }) });
    });

    router.post("/documents", (req, res) => {
        const body = req.body as Record<string, unknown>;
        const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const content = typeof body.content === "string" ? body.content : "";
        if (!categoryId || !title || !content) {
            throw new HttpError(400, "INVALID_INPUT", "categoryId, title, and content are required");
        }

        const id = `kd-${randomUUID()}`;
        createDocument(db, {
            id,
            categoryId,
            title,
            content,
            tags: typeof body.tags === "string" ? body.tags : null,
            displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
        });
        updateDocument(db, id, { status: body.status === undefined ? "draft" : requireStatus(body.status) });
        res.status(201).json({ data: { id } });
    });

    router.patch("/documents/:documentId", (req, res) => {
        const body = req.body as Record<string, unknown>;
        updateDocument(db, req.params.documentId, {
            categoryId: typeof body.categoryId === "string" ? body.categoryId : undefined,
            title: typeof body.title === "string" ? body.title.trim() : undefined,
            content: typeof body.content === "string" ? body.content : undefined,
            tags: typeof body.tags === "string" ? body.tags : undefined,
            displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
            status: body.status === undefined ? undefined : requireStatus(body.status),
        });
        res.json({ data: { updated: true } });
    });

    return router;
}
