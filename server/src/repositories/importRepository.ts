import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

export interface ImportJobRow {
    id: string;
    paper_id: string | null;
    bank_id: string;
    status: string;
    source_dir: string | null;
    parsed_json: string | null;
    validation_errors_json: string | null;
    operator_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

export function createImportJob(
    db: AppDatabase,
    params: {
        bankId: string;
        sourceDir?: string | null;
        operatorId: string;
        note?: string | null;
    }
): string {
    const id = `import-${randomUUID()}`;
    db.prepare(
        `INSERT INTO import_jobs (id, bank_id, status, source_dir, operator_id, note)
         VALUES (?, ?, 'pending', ?, ?, ?)`
    ).run(id, params.bankId, params.sourceDir ?? null, params.operatorId, params.note ?? null);
    return id;
}

export function getImportJob(db: AppDatabase, jobId: string): ImportJobRow | undefined {
    return db
        .prepare(`SELECT * FROM import_jobs WHERE id = ?`)
        .get(jobId) as ImportJobRow | undefined;
}

export function listImportJobs(db: AppDatabase): ImportJobRow[] {
    return db
        .prepare(`SELECT * FROM import_jobs ORDER BY created_at DESC`)
        .all() as ImportJobRow[];
}

export function updateImportJob(
    db: AppDatabase,
    jobId: string,
    params: {
        status?: string;
        paperId?: string | null;
        parsedJson?: string | null;
        validationErrorsJson?: string | null;
        note?: string | null;
    }
): void {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (params.status) {
        sets.push("status = ?");
        args.push(params.status);
    }
    if (params.paperId !== undefined) {
        sets.push("paper_id = ?");
        args.push(params.paperId);
    }
    if (params.parsedJson !== undefined) {
        sets.push("parsed_json = ?");
        args.push(params.parsedJson);
    }
    if (params.validationErrorsJson !== undefined) {
        sets.push("validation_errors_json = ?");
        args.push(params.validationErrorsJson);
    }
    if (params.note !== undefined) {
        sets.push("note = ?");
        args.push(params.note);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = CURRENT_TIMESTAMP");
    args.push(jobId);
    db.prepare(`UPDATE import_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...args);
}

