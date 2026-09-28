import type { AppDatabase } from "../db/connection.js";
import type { PastExamPaper, PaperSection } from "../types.js";

export function listPublishedPapersByBank(
    db: AppDatabase,
    bankId: string
): PastExamPaper[] {
    return db
        .prepare(
            `SELECT * FROM past_exam_papers
             WHERE bank_id = ? AND status = 'published'
             ORDER BY year DESC, session DESC`
        )
        .all(bankId) as PastExamPaper[];
}

export function getPaper(db: AppDatabase, paperId: string): PastExamPaper | undefined {
    return db
        .prepare(`SELECT * FROM past_exam_papers WHERE id = ?`)
        .get(paperId) as PastExamPaper | undefined;
}

export function getSectionsByPaper(
    db: AppDatabase,
    paperId: string
): PaperSection[] {
    return db
        .prepare(
            `SELECT * FROM paper_sections WHERE paper_id = ? ORDER BY display_order`
        )
        .all(paperId) as PaperSection[];
}

interface PaperQuestionRow {
    id: string;
    display_order: number;
    score: number;
    question_id: string;
    question_version_id: string;
    question_type: string;
    stem: string | null;
    difficulty: number;
    payload_json: string;
    explanation: string | null;
    question_group_version_id: string | null;
    section_id: string;
    is_enabled: number;
}
interface GradingQuestionRow extends PaperQuestionRow {
    answer_json: string;
}

export function getPaperQuestions(
    db: AppDatabase,
    paperId: string
): GradingQuestionRow[] {
    return db
        .prepare(
            `SELECT pq.id, pq.display_order, pq.score, pq.question_id,
                    pq.question_version_id, qv.question_type, qv.stem,
                    qv.difficulty, qv.payload_json, qv.explanation,
                    qv.answer_json, pq.question_group_version_id, pq.section_id, qv.is_enabled
             FROM paper_questions pq
             INNER JOIN question_versions qv ON qv.id = pq.question_version_id
             WHERE pq.paper_id = ?
             ORDER BY pq.display_order`
        )
        .all(paperId) as GradingQuestionRow[];
}

export function getBankLevelByPaper(
    db: AppDatabase,
    paperId: string
): { bank_id: string; level: number } | undefined {
    return db
        .prepare(
            `SELECT p.bank_id, b.level
             FROM past_exam_papers p
             INNER JOIN question_banks b ON b.id = p.bank_id
             WHERE p.id = ?`
        )
        .get(paperId) as { bank_id: string; level: number } | undefined;
}

export function hasPaperAccess(
    db: AppDatabase,
    paperId: string,
    userId: string
): boolean {
    const row = db
        .prepare(
            `SELECT 1 AS flag
             FROM past_exam_papers p
             INNER JOIN bank_subscriptions s
                 ON s.bank_id = p.bank_id AND s.user_id = ?
             WHERE p.id = ? AND p.status = 'published'
               AND s.status = 'active'
               AND s.starts_at <= CURRENT_TIMESTAMP
               AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)`
        )
        .get(userId, paperId) as { flag: number } | undefined;
    return Boolean(row);
}

export function getQuestionGroupVersionsByPaper(
    db: AppDatabase,
    paperId: string
): Array<{
    id: string;
    question_group_id: string;
    group_type: string;
    instruction: string | null;
    material_id: string | null;
    payload_json: string;
}> {
    return db
        .prepare(
            `SELECT DISTINCT qgv.id, qgv.question_group_id, qgv.group_type,
                    qgv.instruction, qgv.material_id, qgv.payload_json
             FROM paper_questions pq
             INNER JOIN question_group_versions qgv ON qgv.id = pq.question_group_version_id
             WHERE pq.paper_id = ? AND pq.question_group_version_id IS NOT NULL`
        )
        .all(paperId) as Array<{
        id: string;
        question_group_id: string;
        group_type: string;
        instruction: string | null;
        material_id: string | null;
        payload_json: string;
    }>;
}

export function getMaterialById(
    db: AppDatabase,
    materialId: string
): {
    id: string;
    material_type: string;
    title: string | null;
    text_content: string | null;
    transcript: string | null;
    payload_json: string | null;
} | undefined {
    return db
        .prepare(
            `SELECT id, material_type, title, text_content, transcript, payload_json
             FROM materials WHERE id = ?`
        )
        .get(materialId) as {
        id: string;
        material_type: string;
        title: string | null;
        text_content: string | null;
        transcript: string | null;
        payload_json: string | null;
    } | undefined;
}
