import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

export interface WrongQuestionDetail {
    id: string;
    user_id: string;
    attempt_question_result_id: string;
    bank_id: string;
    section_id: string | null;
    question_type: string;
    created_at: string;
    paper_question_id: string;
    paper_title: string | null;
    section_code: string | null;
    bank_level: number;
    your_answer: unknown;
    correct_answer: unknown;
    explanation: string | null;
    raw_score: number;
    final_score: number;
}

interface RawWrongQuestionRow {
    wq_id: string;
    wq_user_id: string;
    wq_attempt_question_result_id: string;
    wq_bank_id: string;
    wq_section_id: string | null;
    wq_question_type: string;
    wq_created_at: string;
    paper_question_id: string;
    paper_title: string | null;
    section_code: string | null;
    bank_level: number;
    r_answer_json: string | null;
    qv_answer_json: string;
    qv_explanation: string | null;
    r_raw_score: number;
    r_final_score: number;
}

export function listWrongQuestions(
    db: AppDatabase,
    userId: string,
    filters: { bankId?: string; sectionId?: string; questionType?: string }
): WrongQuestionDetail[] {
    const conditions = ["wq.user_id = ?"];
    const args: unknown[] = [userId];
    if (filters.bankId) {
        conditions.push("wq.bank_id = ?");
        args.push(filters.bankId);
    }
    if (filters.sectionId) {
        conditions.push("wq.section_id = ?");
        args.push(filters.sectionId);
    }
    if (filters.questionType) {
        conditions.push("wq.question_type = ?");
        args.push(filters.questionType);
    }
    const where = conditions.join(" AND ");

    const rows = db
        .prepare(
            `SELECT
                wq.id AS wq_id, wq.user_id AS wq_user_id,
                wq.attempt_question_result_id AS wq_attempt_question_result_id,
                wq.bank_id AS wq_bank_id, wq.section_id AS wq_section_id,
                wq.question_type AS wq_question_type, wq.created_at AS wq_created_at,
                p.title AS paper_title,
                pq.id AS paper_question_id,
                ps.code AS section_code,
                b.level AS bank_level,
                r.answer_json AS r_answer_json,
                qv.answer_json AS qv_answer_json,
                qv.explanation AS qv_explanation,
                r.raw_score AS r_raw_score,
                r.final_score AS r_final_score
             FROM wrong_questions wq
             INNER JOIN attempt_question_results r ON r.id = wq.attempt_question_result_id
             INNER JOIN paper_questions pq ON pq.id = r.paper_question_id
             INNER JOIN question_versions qv ON qv.id = pq.question_version_id
             INNER JOIN past_exam_papers p ON p.id = pq.paper_id
             INNER JOIN question_banks b ON b.id = wq.bank_id
             LEFT JOIN paper_sections ps ON ps.id = wq.section_id
             WHERE ${where}
             ORDER BY wq.created_at DESC`
        )
        .all(...args) as RawWrongQuestionRow[];

    return rows.map((row) => ({
        id: row.wq_id,
        user_id: row.wq_user_id,
        attempt_question_result_id: row.wq_attempt_question_result_id,
        bank_id: row.wq_bank_id,
        section_id: row.wq_section_id,
        question_type: row.wq_question_type,
        created_at: row.wq_created_at,
        paper_question_id: row.paper_question_id,
        paper_title: row.paper_title,
        section_code: row.section_code,
        bank_level: row.bank_level,
        your_answer: safeParseJson(row.r_answer_json),
        correct_answer: safeParseJson(row.qv_answer_json),
        explanation: row.qv_explanation,
        raw_score: row.r_raw_score,
        final_score: row.r_final_score,
    }));
}

function safeParseJson(json: string | null): unknown {
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function insertWrongQuestion(
    db: AppDatabase,
    params: {
        userId: string;
        attemptQuestionResultId: string;
        bankId: string;
        sectionId: string | null;
        questionType: string;
    }
): string {
    const id = `wq-${randomUUID()}`;
    db.prepare(
        `INSERT OR IGNORE INTO wrong_questions
            (id, user_id, attempt_question_result_id, bank_id, section_id, question_type)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.userId,
        params.attemptQuestionResultId,
        params.bankId,
        params.sectionId,
        params.questionType
    );
    return id;
}

export function deleteWrongQuestion(db: AppDatabase, wrongQuestionId: string, userId: string): boolean {
    const result = db
        .prepare(`DELETE FROM wrong_questions WHERE id = ? AND user_id = ?`)
        .run(wrongQuestionId, userId);
    return result.changes > 0;
}

export function countWrongQuestions(db: AppDatabase, userId: string): number {
    const row = db
        .prepare(`SELECT COUNT(*) AS count FROM wrong_questions WHERE user_id = ?`)
        .get(userId) as { count: number };
    return row.count;
}
