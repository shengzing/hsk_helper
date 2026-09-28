import type { AppDatabase } from "../db/connection.js";

// ============================================================
// Record Repository — G-003
// ============================================================

export interface RecordSummary {
    id: string;
    paper_id: string;
    paper_title: string;
    bank_level: number;
    mode: string;
    status: string;
    total_score: number;
    objective_score: number;
    subjective_score: number;
    started_at: string;
    submitted_at: string | null;
    duration_used_seconds: number;
}

export function listRecordsByUser(
    db: AppDatabase,
    userId: string
): RecordSummary[] {
    return db
        .prepare(
            `SELECT a.id, a.paper_id, p.title AS paper_title, b.level AS bank_level,
                    a.mode, a.status, a.total_score, a.objective_score,
                    a.subjective_score, a.started_at, a.submitted_at,
                    a.duration_used_seconds
             FROM attempts a
             INNER JOIN past_exam_papers p ON p.id = a.paper_id
             INNER JOIN question_banks b ON b.id = a.bank_id
             WHERE a.user_id = ? AND a.status IN ('submitted', 'graded')
             ORDER BY a.submitted_at DESC`
        )
        .all(userId) as RecordSummary[];
}

export function getRecordSummary(
    db: AppDatabase,
    attemptId: string,
    userId: string
): RecordSummary | undefined {
    return db
        .prepare(
            `SELECT a.id, a.paper_id, p.title AS paper_title, b.level AS bank_level,
                    a.mode, a.status, a.total_score, a.objective_score,
                    a.subjective_score, a.started_at, a.submitted_at,
                    a.duration_used_seconds
             FROM attempts a
             INNER JOIN past_exam_papers p ON p.id = a.paper_id
             INNER JOIN question_banks b ON b.id = a.bank_id
             WHERE a.id = ? AND a.user_id = ?`
        )
        .get(attemptId, userId) as RecordSummary | undefined;
}

export function getStatsByUser(
    db: AppDatabase,
    userId: string
): { total_attempts: number; passed: number; avg_score: number } {
    const row = db
        .prepare(
            `SELECT
                COUNT(*) AS total_attempts,
                SUM(CASE WHEN a.total_score >= p.passing_score THEN 1 ELSE 0 END) AS passed,
                AVG(a.total_score) AS avg_score
             FROM attempts a
             INNER JOIN past_exam_papers p ON p.id = a.paper_id
             WHERE a.user_id = ? AND a.status IN ('submitted', 'graded')`
        )
        .get(userId) as { total_attempts: number; passed: number; avg_score: number } | undefined;
    return {
        total_attempts: row?.total_attempts ?? 0,
        passed: row?.passed ?? 0,
        avg_score: Math.round(row?.avg_score ?? 0),
    };
}

