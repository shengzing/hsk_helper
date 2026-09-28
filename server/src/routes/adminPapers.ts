import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { getPaper, listPublishedPapersByBank, getSectionsByPaper } from "../repositories/paperRepository.js";
import { logOperation } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";
import { randomUUID } from "node:crypto";

// ============================================================
// Admin Paper Management — G-015 content review flow
// GET /api/admin/papers, POST, PATCH /:paperId
// ============================================================

export function createAdminPaperRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/admin/papers — list all papers (optionally filter by bank/status)
    router.get("/", (req, res) => {
        const bankId = typeof req.query.bankId === "string" ? req.query.bankId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;

        let query = `SELECT p.*, b.code AS bank_code, b.level AS bank_level, b.name AS bank_name,
                      (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count
                      FROM past_exam_papers p
                      INNER JOIN question_banks b ON b.id = p.bank_id`;
        const conditions: string[] = [];
        const args: unknown[] = [];
        if (bankId) { conditions.push("p.bank_id = ?"); args.push(bankId); }
        if (status) { conditions.push("p.status = ?"); args.push(status); }
        if (conditions.length > 0) query += ` WHERE ${conditions.join(" AND ")}`;
        query += " ORDER BY p.year DESC, p.session DESC";

        const papers = db.prepare(query).all(...args) as Array<Record<string, unknown>>;
        res.json({ data: papers });
    });

    // POST /api/admin/papers — create a new paper (draft)
    router.post("/", (req, res) => {
        const operatorId = res.locals.userId as string;
        const body = req.body as Record<string, unknown>;
        const bankId = typeof body.bankId === "string" ? body.bankId.trim() : "";
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : 0;
        const totalScore = typeof body.totalScore === "number" ? body.totalScore : 0;
        const passingScore = typeof body.passingScore === "number" ? body.passingScore : 0;
        const paperType = typeof body.paperType === "string" ? body.paperType : "past";
        const year = typeof body.year === "number" ? body.year : null;
        const session = typeof body.session === "string" ? body.session : null;

        if (!bankId || !title || durationSeconds <= 0) {
            throw new HttpError(400, "INVALID_INPUT", "bankId, title, durationSeconds are required");
        }

        const paperId = `paper-${randomUUID()}`;
        db.prepare(
            `INSERT INTO past_exam_papers
                (id, bank_id, paper_type, year, session, title, duration_seconds,
                 total_score, passing_score, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
        ).run(paperId, bankId, paperType, year, session, title, durationSeconds, totalScore, passingScore);

        logOperation(db, {
            operatorId, action: "create", objectType: "paper", objectId: paperId,
            afterState: { bank_id: bankId, title, status: "draft" },
        });

        res.status(201).json({ data: { paperId } });
    });

    // PATCH /api/admin/papers/:paperId — update paper (status, title, etc.)
    router.patch("/:paperId", (req, res) => {
        const operatorId = res.locals.userId as string;
        const paperId = req.params.paperId;
        const paper = getPaper(db, paperId);
        if (!paper) {
            throw new HttpError(404, "PAPER_NOT_FOUND", "Paper not found");
        }

        const body = req.body as Record<string, unknown>;
        const sets: string[] = [];
        const args: unknown[] = [];

        if (typeof body.title === "string") { sets.push("title = ?"); args.push(body.title); }
        if (typeof body.status === "string") { sets.push("status = ?"); args.push(body.status); }
        if (typeof body.durationSeconds === "number") { sets.push("duration_seconds = ?"); args.push(body.durationSeconds); }
        if (typeof body.totalScore === "number") { sets.push("total_score = ?"); args.push(body.totalScore); }
        if (typeof body.passingScore === "number") { sets.push("passing_score = ?"); args.push(body.passingScore); }

        if (sets.length === 0) {
            throw new HttpError(400, "INVALID_INPUT", "No fields to update");
        }

        const before = { title: paper.title, status: paper.status };
        args.push(paperId);

        const txn = db.transaction(() => {
            db.prepare(`UPDATE past_exam_papers SET ${sets.join(", ")} WHERE id = ?`).run(...args);
            logOperation(db, {
                operatorId, action: "update", objectType: "paper", objectId: paperId,
                beforeState: before,
                afterState: { ...before, ...(typeof body.title === "string" ? { title: body.title } : {}),
                              ...(typeof body.status === "string" ? { status: body.status } : {}) },
            });
        });
        txn();

        res.json({ data: { updated: true } });
    });

    // GET /api/admin/papers/:paperId — get paper with sections (review view)
    router.get("/:paperId", (req, res) => {
        const paperId = req.params.paperId;
        const paper = getPaper(db, paperId);
        if (!paper) {
            throw new HttpError(404, "PAPER_NOT_FOUND", "Paper not found");
        }
        const sections = getSectionsByPaper(db, paperId);
        const questionCount = db.prepare(
            `SELECT COUNT(*) AS count FROM paper_questions WHERE paper_id = ?`
        ).get(paperId) as { count: number };

        res.json({
            data: {
                ...paper,
                sections,
                question_count: questionCount.count,
            },
        });
    });

    return router;
}
