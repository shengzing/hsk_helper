import type { AppDatabase } from "../db/connection.js";
import { randomUUID } from "node:crypto";
import {
    createImportJob,
    getImportJob,
    listImportJobs,
    updateImportJob,
} from "../repositories/importRepository.js";
import { validateQuestionVersion } from "../schemas/question.js";
import { logOperation } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";
import { createAsset, linkPaperAsset } from "../repositories/assetRepository.js";

// ============================================================
// Import Service — T016
// ============================================================

export interface ParsedSection {
    code: string;
    title: string;
    duration_seconds: number;
    questions: ParsedQuestion[];
}

export interface ParsedQuestion {
    question_type: string;
    stem: string;
    payload: Record<string, unknown>;
    answer: Record<string, unknown>;
    score: number;
    group_version_id?: string | null;
}

export interface ParsedPaper {
    paper_type: string;
    title: string;
    year: number | null;
    session: string | null;
    duration_seconds: number;
    total_score: number;
    passing_score: number;
    sections: ParsedSection[];
    assets?: Array<{
        id: string;
        asset_type: string;
        storage_key: string;
        url: string;
        mime_type: string;
        usage: string;
        duration_ms?: number;
    }>;
}

export function createJob(
    db: AppDatabase,
    params: { bankId: string; sourceDir?: string; operatorId: string; note?: string }
): string {
    return createImportJob(db, params);
}

export function listJobs(db: AppDatabase) {
    return listImportJobs(db);
}

export function getJob(db: AppDatabase, jobId: string) {
    const job = getImportJob(db, jobId);
    if (!job) throw new HttpError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found");
    return job;
}

export function parseJob(
    db: AppDatabase,
    jobId: string,
    parsedPaper: ParsedPaper
): void {
    const job = getJob(db, jobId);
    if (!job) throw new HttpError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found");

    const errors: string[] = [];

    // Validate each question against Zod schemas
    for (const section of parsedPaper.sections) {
        for (const q of section.questions) {
            try {
                validateQuestionVersion(
                    q.question_type,
                    JSON.stringify(q.payload),
                    JSON.stringify(q.answer)
                );
            } catch (e) {
                errors.push(
                    `Section ${section.code}: ${q.question_type} "${q.stem?.slice(0, 30) ?? ""}": ${(e as Error).message}`
                );
            }
        }
    }

    updateImportJob(db, jobId, {
        status: errors.length > 0 ? "failed" : "parsed",
        parsedJson: JSON.stringify(parsedPaper),
        validationErrorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
    });

    if (errors.length > 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "Parsed paper has validation errors", { errors });
    }
}

export function updateParsedJson(
    db: AppDatabase,
    jobId: string,
    parsedPaper: ParsedPaper
): void {
    const job = getJob(db, jobId);
    if (!job) throw new HttpError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found");
    updateImportJob(db, jobId, {
        status: "reviewing",
        parsedJson: JSON.stringify(parsedPaper),
    });
}

export function publishJob(
    db: AppDatabase,
    jobId: string,
    operatorId: string
): string {
    const job = getJob(db, jobId);
    if (!job) throw new HttpError(404, "IMPORT_JOB_NOT_FOUND", "Import job not found");
    if (!job.parsed_json) {
        throw new HttpError(400, "NOT_PARSED", "Import job has not been parsed yet");
    }
    if (job.status === "failed") {
        throw new HttpError(400, "HAS_VALIDATION_ERRORS", "Fix validation errors before publishing");
    }

    const paper = JSON.parse(job.parsed_json) as ParsedPaper;
    const paperId = `paper-${randomUUID()}`;

    const txn = db.transaction(() => {
        // Create paper
        db.prepare(
            `INSERT INTO past_exam_papers
                (id, bank_id, paper_type, year, session, title, duration_seconds,
                 total_score, passing_score, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`
        ).run(
            paperId,
            job.bank_id,
            paper.paper_type,
            paper.year,
            paper.session,
            paper.title,
            paper.duration_seconds,
            paper.total_score,
            paper.passing_score
        );

        // Create assets
        if (paper.assets) {
            for (const a of paper.assets) {
                createAsset(db, {
                    id: a.id,
                    assetType: a.asset_type,
                    storageKey: a.storage_key,
                    url: a.url,
                    mimeType: a.mime_type,
                    durationMs: a.duration_ms,
                });
                linkPaperAsset(db, paperId, a.id, a.usage);
            }
        }

        let displayOrder = 0;

        for (const section of paper.sections) {
            const sectionId = `section-${randomUUID()}`;
            db.prepare(
                `INSERT INTO paper_sections
                    (id, paper_id, code, title, display_order, duration_seconds)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(sectionId, paperId, section.code, section.title, ++displayOrder, section.duration_seconds);

            let qOrder = 0;
            for (const q of section.questions) {
                const questionId = `question-${randomUUID()}`;
                const versionId = `qv-${randomUUID()}`;
                const paperQuestionId = `pq-${randomUUID()}`;

                // Create question
                db.prepare(
                    `INSERT INTO questions (id, bank_id, status)
                     VALUES (?, ?, 'published')`
                ).run(questionId, job.bank_id);

                // Create question version
                db.prepare(
                    `INSERT INTO question_versions
                        (id, question_id, version_number, question_type, stem,
                         difficulty, payload_json, answer_json, status, is_current, is_enabled)
                     VALUES (?, ?, 1, ?, ?, 3, ?, ?, 'published', 1, 1)`
                ).run(
                    versionId,
                    questionId,
                    q.question_type,
                    q.stem,
                    JSON.stringify(q.payload),
                    JSON.stringify(q.answer)
                );

                // Create paper question
                db.prepare(
                    `INSERT INTO paper_questions
                        (id, paper_id, section_id, question_id, question_version_id,
                         display_order, score)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).run(
                    paperQuestionId,
                    paperId,
                    sectionId,
                    questionId,
                    versionId,
                    ++qOrder,
                    q.score
                );
            }
        }

        // Update import job
        updateImportJob(db, jobId, {
            status: "published",
            paperId,
        });

        // Audit log
        logOperation(db, {
            operatorId,
            action: "publish",
            objectType: "paper",
            objectId: paperId,
            afterState: { import_job_id: jobId, title: paper.title, bank_id: job.bank_id },
        });
    });
    txn();

    return paperId;
}

