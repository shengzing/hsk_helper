import type { AppDatabase } from "../db/connection.js";
import {
    createAttempt,
    findInProgressAttempt,
    getAnswers,
    getAttempt,
    getAttemptOwnership,
    getQuestionResults,
    getSectionStates,
    initSectionStates,
    insertQuestionResult,
    resultId,
    submitAttempt,
    updateAttemptScores,
    updateSectionState,
    upsertAnswer,
    getPendingEssayReviews,
    getEssayReview,
    upsertEssayReview,
    finalizeEssayScore,
} from "../repositories/attemptRepository.js";
import { hasValidSubscription } from "../repositories/subscriptionRepository.js";
import { getPaper, getSectionsByPaper } from "../repositories/paperRepository.js";
import { getPaperQuestions } from "../repositories/paperRepository.js";
import { insertWrongQuestion } from "../repositories/wrongQuestionRepository.js";
import { gradeQuestion, isObjectiveType, type QuestionVersionData } from "./gradingService.js";
import { validateAnswerValue, type AnswerValue } from "../schemas/question.js";
import { HttpError } from "../utils/httpError.js";
import { randomUUID } from "node:crypto";

// ============================================================
// Attempt Service — T026/T027/T036
// ============================================================

export function startAttempt(
    db: AppDatabase,
    paperId: string,
    userId: string,
    mode: string
): string {
    const paper = getPaper(db, paperId);
    if (!paper) throw new HttpError(404, "PAPER_NOT_FOUND", "Paper not found");
    if (paper.status !== "published") {
        throw new HttpError(403, "PAPER_NOT_PUBLISHED", "Paper is not published");
    }
    if (!hasValidSubscription(db, userId, paper.bank_id)) {
        throw new HttpError(403, "NO_SUBSCRIPTION", "You do not have an active subscription for this bank");
    }

    const existing = findInProgressAttempt(db, userId, paperId);
    if (existing) {
        throw new HttpError(409, "ATTEMPT_IN_PROGRESS", "An in-progress attempt already exists for this paper", { attemptId: existing.id });
    }

    const attemptId = `attempt-${randomUUID()}`;
    const sections = getSectionsByPaper(db, paperId);
    const sectionIds = sections.map((s) => s.id);

    const txn = db.transaction(() => {
        createAttempt(db, {
            id: attemptId,
            userId,
            paperId,
            bankId: paper.bank_id,
            mode: mode || "exam",
            startedAt: new Date().toISOString(),
        });
        initSectionStates(db, attemptId, sectionIds);
    });
    txn();

    return attemptId;
}

export function saveAnswers(
    db: AppDatabase,
    attemptId: string,
    userId: string,
    answers: Record<string, unknown>
): void {
    const ownership = getAttemptOwnership(db, attemptId);
    if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    if (ownership.user_id !== userId) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
    }
    if (ownership.status !== "in_progress") {
        throw new HttpError(400, "ATTEMPT_LOCKED", "Attempt is no longer in progress");
    }

    for (const [paperQuestionId, rawAnswer] of Object.entries(answers)) {
        const answerJson = JSON.stringify(rawAnswer);
        upsertAnswer(db, attemptId, paperQuestionId, answerJson);
    }
}

export function submitAttemptNow(
    db: AppDatabase,
    attemptId: string,
    userId: string,
    durationUsedSeconds: number
): void {
    const ownership = getAttemptOwnership(db, attemptId);
    if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    if (ownership.user_id !== userId) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
    }
    if (ownership.status !== "in_progress") {
        throw new HttpError(400, "ATTEMPT_ALREADY_SUBMITTED", "Attempt has already been submitted");
    }

    // Get all paper questions with version data for grading
    const paperQuestions = getPaperQuestions(db, ownership.paper_id);
    const savedAnswers = getAnswers(db, attemptId);
    const answerMap = new Map(savedAnswers.map((a) => [a.paper_question_id, a.answer_json]));

    let totalObjective = 0;
    let totalSubjective = 0;
    let subjectivePending = 0;

    const txn = db.transaction(() => {
        submitAttempt(db, attemptId, Math.floor(durationUsedSeconds));

        for (const pq of paperQuestions) {
            const rawAnswer = answerMap.get(pq.id);
            let answer: AnswerValue | null = null;
            if (rawAnswer) {
                try {
                    answer = validateAnswerValue(JSON.parse(rawAnswer));
                } catch {
                    answer = null;
                }
            }

            const questionVersion: QuestionVersionData = {
                id: pq.question_version_id,
                question_type: pq.question_type,
                payload_json: pq.payload_json,
                answer_json: pq.answer_json ?? "",
                scoring_policy: "exact",
            };

            const result = gradeQuestion(questionVersion, answer, {
                paperQuestionId: pq.id,
                maxScore: pq.score,
            });

            const qResultId = resultId();
            insertQuestionResult(db, {
                id: qResultId,
                attemptId,
                paperQuestionId: pq.id,
                questionVersionId: pq.question_version_id,
                questionType: pq.question_type,
                answerJson: rawAnswer ?? null,
                judgeStatus: result.judgeStatus,
                isCorrect: result.isCorrect ? 1 : 0,
                rawScore: result.rawScore,
                finalScore: result.finalScore,
            });

            if (isObjectiveType(pq.question_type)) {
                totalObjective += result.finalScore;
                // Wrong question for incorrect or unanswered objective questions
                if (!result.isCorrect) {
                    insertWrongQuestion(db, {
                        userId,
                        attemptQuestionResultId: qResultId,
                        bankId: ownership.bank_id,
                        sectionId: pq.section_id,
                        questionType: pq.question_type,
                    });
                }
            } else {
                totalSubjective += result.finalScore;
                if (result.judgeStatus === "manual_pending") {
                    subjectivePending++;
                }
            }
        }

        // Update attempt scores (status stays 'submitted' if subjective pending, else 'graded')
        updateAttemptScores(db, attemptId, totalObjective + totalSubjective, totalObjective, totalSubjective);
    });
    txn();
}

export function getAttemptDetail(
    db: AppDatabase,
    attemptId: string,
    userId: string
) {
    const ownership = getAttemptOwnership(db, attemptId);
    if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    if (ownership.user_id !== userId) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
    }

    const attempt = getAttempt(db, attemptId) as Record<string, unknown>;
    const answers = getAnswers(db, attemptId);
    const sectionStates = getSectionStates(db, attemptId);

    return {
        id: attempt.id,
        paper_id: attempt.paper_id,
        bank_id: attempt.bank_id,
        mode: attempt.mode,
        status: attempt.status,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        duration_used_seconds: attempt.duration_used_seconds,
        total_score: attempt.total_score,
        answers: answers.map((a) => ({
            paper_question_id: a.paper_question_id,
            answer: a.answer_json ? JSON.parse(a.answer_json) : null,
            updated_at: a.updated_at,
        })),
        section_states: sectionStates.map((s) => ({
            section_id: s.section_id,
            section_code: s.section_code,
            section_title: s.section_title,
            status: s.status,
            started_at: s.started_at,
            ended_at: s.ended_at,
            remaining_seconds: s.remaining_seconds,
        })),
    };
}

export function getAttemptReport(
    db: AppDatabase,
    attemptId: string,
    userId: string
) {
    const ownership = getAttemptOwnership(db, attemptId);
    if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    if (ownership.user_id !== userId) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
    }
    if (ownership.status === "in_progress") {
        throw new HttpError(400, "ATTEMPT_IN_PROGRESS", "Cannot view report for an in-progress attempt");
    }

    const attempt = getAttempt(db, attemptId) as Record<string, unknown>;
    const results = getQuestionResults(db, attemptId);
    const mappedResults = results.map((r) => ({
        id: r.id,
        paper_question_id: r.paper_question_id,
        display_order: r.display_order,
        score: r.score,
        section_id: r.section_id,
        question_type: r.question_type,
        stem: r.stem,
        payload: r.payload_json ? JSON.parse(r.payload_json as string) : null,
        answer: r.user_answer ? JSON.parse(r.user_answer as string) : null,
        correct_answer: r.correct_answer ? JSON.parse(r.correct_answer as string) : null,
        explanation: r.explanation,
        judge_status: r.judge_status,
        is_correct: Boolean(r.is_correct),
        raw_score: r.raw_score,
        final_score: r.final_score,
    }));
    const paper = getPaper(db, attempt.paper_id as string);
    const passingScore = paper?.passing_score ?? 0;
    const sections = getSectionsByPaper(db, attempt.paper_id as string).map((section) => {
        const sectionResults = mappedResults.filter(
            (result) => result.section_id === section.id
        );
        return {
            section_id: section.id,
            code: section.code,
            title: section.title,
            scaled_score: sectionResults.reduce(
                (sum, result) => sum + Number(result.final_score ?? 0),
                0
            ),
            results: sectionResults,
        };
    });

    return {
        id: attempt.id,
        attempt_id: attempt.id,
        status: attempt.status,
        total_score: attempt.total_score,
        objective_score: attempt.objective_score,
        subjective_score: attempt.subjective_score,
        passing_score: passingScore,
        passed: Number(attempt.total_score ?? 0) >= passingScore,
        results: mappedResults,
        sections,
    };
}

// ---------- Section timing (T033) ----------

export function updateSectionTiming(
    db: AppDatabase,
    attemptId: string,
    userId: string,
    sectionId: string,
    status: string,
    remainingSeconds?: number
): void {
    const ownership = getAttemptOwnership(db, attemptId);
    if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    if (ownership.user_id !== userId) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
    }
    if (ownership.status !== "in_progress") {
        throw new HttpError(400, "ATTEMPT_LOCKED", "Attempt is no longer in progress");
    }
    updateSectionState(db, attemptId, sectionId, status, remainingSeconds);
}

// ---------- Essay review (T037) ----------

export function listPendingEssayReviews(db: AppDatabase) {
    return getPendingEssayReviews(db);
}

export function reviewEssay(
    db: AppDatabase,
    resultId: string,
    operatorId: string,
    params: {
        score: number;
        reviewComment?: string | null;
        rubricScores?: Record<string, unknown> | null;
        completed: boolean;
    }
): void {
    const review = getEssayReview(db, resultId);
    if (!review) {
        throw new HttpError(404, "RESULT_NOT_FOUND", "Essay result not found");
    }
    const maxScore = review.score as number;
    if (params.score < 0 || params.score > maxScore) {
        throw new HttpError(400, "INVALID_SCORE", `Score must be between 0 and ${maxScore}`);
    }

    const txn = db.transaction(() => {
        upsertEssayReview(db, {
            resultId,
            reviewMode: "manual",
            reviewerType: "admin",
            reviewerId: operatorId,
            score: params.score,
            reviewComment: params.reviewComment ?? null,
            rubricScoresJson: params.rubricScores ? JSON.stringify(params.rubricScores) : null,
            completed: params.completed,
        });

        if (params.completed) {
            finalizeEssayScore(db, resultId, params.score);
        }
    });
    txn();
}
