import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

// ============================================================
// Attempt Repository — T026/T027
// ============================================================

export function findInProgressAttempt(
    db: AppDatabase,
    userId: string,
    paperId: string
): { id: string } | undefined {
    return db
        .prepare(
            `SELECT id FROM attempts
             WHERE user_id = ? AND paper_id = ? AND status = 'in_progress'
             ORDER BY started_at DESC LIMIT 1`
        )
        .get(userId, paperId) as { id: string } | undefined;
}

export function createAttempt(
    db: AppDatabase,
    params: {
        id: string;
        userId: string;
        paperId: string;
        bankId: string;
        mode: string;
        startedAt: string;
    }
): void {
    db.prepare(
        `INSERT INTO attempts (id, user_id, paper_id, bank_id, mode, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`
    ).run(
        params.id,
        params.userId,
        params.paperId,
        params.bankId,
        params.mode,
        params.startedAt
    );
}

export function initSectionStates(
    db: AppDatabase,
    attemptId: string,
    sectionIds: string[]
): void {
    const stmt = db.prepare(
        `INSERT OR IGNORE INTO attempt_section_states
            (attempt_id, section_id, status) VALUES (?, ?, 'pending')`
    );
    for (const sectionId of sectionIds) {
        stmt.run(attemptId, sectionId);
    }
}

export function getAttempt(
    db: AppDatabase,
    attemptId: string
): Record<string, unknown> | undefined {
    return db
        .prepare(`SELECT * FROM attempts WHERE id = ?`)
        .get(attemptId) as Record<string, unknown> | undefined;
}

export function getAttemptOwnership(
    db: AppDatabase,
    attemptId: string
): { user_id: string; paper_id: string; bank_id: string; status: string } | undefined {
    return db
        .prepare(
            `SELECT user_id, paper_id, bank_id, status FROM attempts WHERE id = ?`
        )
        .get(attemptId) as { user_id: string; paper_id: string; bank_id: string; status: string } | undefined;
}

export function upsertAnswer(
    db: AppDatabase,
    attemptId: string,
    paperQuestionId: string,
    answerJson: string
): void {
    db.prepare(
        `INSERT INTO attempt_answers (attempt_id, paper_question_id, answer_json, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(attempt_id, paper_question_id)
         DO UPDATE SET answer_json = excluded.answer_json, updated_at = CURRENT_TIMESTAMP`
    ).run(attemptId, paperQuestionId, answerJson);
}

export function getAnswers(
    db: AppDatabase,
    attemptId: string
): Array<{ paper_question_id: string; answer_json: string | null; updated_at: string }> {
    return db
        .prepare(
            `SELECT paper_question_id, answer_json, updated_at
             FROM attempt_answers WHERE attempt_id = ?`
        )
        .all(attemptId) as Array<{
        paper_question_id: string;
        answer_json: string | null;
        updated_at: string;
    }>;
}

export function submitAttempt(
    db: AppDatabase,
    attemptId: string,
    durationUsed: number
): void {
    db.prepare(
        `UPDATE attempts
         SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
             duration_used_seconds = ?
         WHERE id = ?`
    ).run(durationUsed, attemptId);
}

export function updateAttemptScores(
    db: AppDatabase,
    attemptId: string,
    totalScore: number,
    objectiveScore: number,
    subjectiveScore: number
): void {
    db.prepare(
        `UPDATE attempts
         SET total_score = ?, objective_score = ?, subjective_score = ?,
             status = CASE WHEN ? > 0 THEN 'graded' ELSE 'submitted' END
         WHERE id = ?`
    ).run(totalScore, objectiveScore, subjectiveScore, subjectiveScore, attemptId);
}

export function insertQuestionResult(
    db: AppDatabase,
    params: {
        id: string;
        attemptId: string;
        paperQuestionId: string;
        questionVersionId: string;
        questionType: string;
        answerJson: string | null;
        judgeStatus: string;
        isCorrect: number;
        rawScore: number;
        finalScore: number;
    }
): void {
    db.prepare(
        `INSERT INTO attempt_question_results
            (id, attempt_id, paper_question_id, question_version_id, question_type,
             answer_json, judge_status, is_correct, raw_score, final_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(attempt_id, paper_question_id)
         DO UPDATE SET answer_json = excluded.answer_json,
                        judge_status = excluded.judge_status,
                        is_correct = excluded.is_correct,
                        raw_score = excluded.raw_score,
                        final_score = excluded.final_score`
    ).run(
        params.id,
        params.attemptId,
        params.paperQuestionId,
        params.questionVersionId,
        params.questionType,
        params.answerJson,
        params.judgeStatus,
        params.isCorrect,
        params.rawScore,
        params.finalScore
    );
}

export function getQuestionResults(
    db: AppDatabase,
    attemptId: string
): Array<Record<string, unknown>> {
    return db
        .prepare(
            `SELECT r.*, pq.display_order, pq.score, pq.section_id,
                    qv.stem, qv.payload_json,
                    r.answer_json AS user_answer,
                    qv.answer_json AS correct_answer,
                    qv.explanation
             FROM attempt_question_results r
             INNER JOIN paper_questions pq ON pq.id = r.paper_question_id
             INNER JOIN question_versions qv ON qv.id = r.question_version_id
             WHERE r.attempt_id = ?
             ORDER BY pq.display_order`
        )
        .all(attemptId) as Array<Record<string, unknown>>;
}

export function getSectionStates(
    db: AppDatabase,
    attemptId: string
): Array<Record<string, unknown>> {
    return db
        .prepare(
            `SELECT ss.*, ps.code AS section_code, ps.title AS section_title
             FROM attempt_section_states ss
             INNER JOIN paper_sections ps ON ps.id = ss.section_id
             WHERE ss.attempt_id = ?`
        )
        .all(attemptId) as Array<Record<string, unknown>>;
}

export function updateSectionState(
    db: AppDatabase,
    attemptId: string,
    sectionId: string,
    status: string,
    remainingSeconds?: number
): void {
    if (remainingSeconds !== undefined) {
        db.prepare(
            `UPDATE attempt_section_states
             SET status = ?, remaining_seconds = ?
             WHERE attempt_id = ? AND section_id = ?`
        ).run(status, remainingSeconds, attemptId, sectionId);
    } else {
        db.prepare(
            `UPDATE attempt_section_states
             SET status = ?
             WHERE attempt_id = ? AND section_id = ?`
        ).run(status, attemptId, sectionId);
    }
}

export function getPendingEssayReviews(
    db: AppDatabase
): Array<Record<string, unknown>> {
    return db
        .prepare(
            `SELECT r.id AS result_id, r.attempt_id, r.paper_question_id,
                    r.question_version_id, r.judge_status, r.answer_json,
                    a.user_id, u.display_name AS user_name,
                    pq.score, qv.stem, qv.payload_json, qv.answer_json AS reference_answer,
                    p.title AS paper_title
             FROM attempt_question_results r
             INNER JOIN attempts a ON a.id = r.attempt_id
             INNER JOIN users u ON u.id = a.user_id
             INNER JOIN paper_questions pq ON pq.id = r.paper_question_id
             INNER JOIN question_versions qv ON qv.id = r.question_version_id
             INNER JOIN past_exam_papers p ON p.id = a.paper_id
             WHERE r.judge_status IN ('manual_pending', 'ai_pending')
             ORDER BY r.created_at ASC`
        )
        .all() as Array<Record<string, unknown>>;
}

export function getEssayReview(
    db: AppDatabase,
    resultId: string
): Record<string, unknown> | undefined {
    return db
        .prepare(
            `SELECT r.*, pq.score, qv.stem, qv.payload_json,
                    qv.answer_json AS reference_answer,
                    a.user_id, a.paper_id
             FROM attempt_question_results r
             INNER JOIN paper_questions pq ON pq.id = r.paper_question_id
             INNER JOIN question_versions qv ON qv.id = r.question_version_id
             INNER JOIN attempts a ON a.id = r.attempt_id
             WHERE r.id = ?`
        )
        .get(resultId) as Record<string, unknown> | undefined;
}

export function upsertEssayReview(
    db: AppDatabase,
    params: {
        resultId: string;
        reviewMode: string;
        reviewerType: string;
        reviewerId: string;
        score: number;
        reviewComment: string | null;
        rubricScoresJson: string | null;
        completed: boolean;
    }
): void {
    const completedAt = params.completed ? "CURRENT_TIMESTAMP" : null;
    db.prepare(
        `INSERT INTO essay_reviews
            (attempt_question_result_id, review_mode, reviewer_type, reviewer_id,
             score, review_comment, rubric_scores_json, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ${completedAt ?? "NULL"})
         ON CONFLICT(attempt_question_result_id)
         DO UPDATE SET review_mode = excluded.review_mode,
                        reviewer_type = excluded.reviewer_type,
                        reviewer_id = excluded.reviewer_id,
                        score = excluded.score,
                        review_comment = excluded.review_comment,
                        rubric_scores_json = excluded.rubric_scores_json,
                        completed_at = ${completedAt ?? "completed_at"}`
    ).run(
        params.resultId,
        params.reviewMode,
        params.reviewerType,
        params.reviewerId,
        params.score,
        params.reviewComment,
        params.rubricScoresJson
    );
}

export function finalizeEssayScore(
    db: AppDatabase,
    resultId: string,
    finalScore: number
): void {
    const txn = db.transaction(() => {
        db.prepare(
            `UPDATE attempt_question_results
             SET judge_status = 'accepted', final_score = ?
             WHERE id = ?`
        ).run(finalScore, resultId);

        // Recalculate attempt total
        const attemptRow = db
            .prepare(
                `SELECT a.id, 
                        COALESCE(SUM(CASE WHEN r.judge_status = 'auto' THEN r.final_score ELSE 0 END), 0) AS obj_score,
                        COALESCE(SUM(CASE WHEN r.judge_status = 'accepted' THEN r.final_score ELSE 0 END), 0) AS subj_score
                 FROM attempt_question_results r
                 INNER JOIN attempts a ON a.id = r.attempt_id
                 INNER JOIN (SELECT attempt_id FROM attempt_question_results WHERE id = ?) sub ON sub.attempt_id = a.id
                 GROUP BY a.id`
            )
            .get(resultId) as { id: string; obj_score: number; subj_score: number } | undefined;

        if (attemptRow) {
            updateAttemptScores(db, attemptRow.id, attemptRow.obj_score + attemptRow.subj_score, attemptRow.obj_score, attemptRow.subj_score);
        }
    });
    txn();
}

export function resultId(): string {
    return `result-${randomUUID()}`;
}
