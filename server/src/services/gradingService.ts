import type { AnswerValue } from "../schemas/question.js";

// ============================================================
// Grading Service — T027
// Design: §8.1-8.3
// ============================================================

export interface QuestionVersionData {
    id: string;
    question_type: string;
    payload_json: string;
    answer_json: string;
    scoring_policy: string;
}

export interface GradingContext {
    paperQuestionId: string;
    maxScore: number;
}

export interface GradingResult {
    isCorrect: boolean;
    rawScore: number;
    finalScore: number;
    judgeStatus: "auto" | "manual_pending" | "ai_pending" | "accepted";
}

type Grader = (
    question: QuestionVersionData,
    answer: AnswerValue | null,
    context: GradingContext
) => GradingResult;

// ---------- Text normalization (§8.3) ----------
function normalizeText(text: string): string {
    return text
        .replace(/^[\s\u3000]+|[\s\u3000]+$/g, "")
        .replace(/\u3000/g, " ")
        .trim();
}

// ---------- Graders ----------

const exactChoiceGrader: Grader = (question, answer, ctx) => {
    const expected = JSON.parse(question.answer_json) as { value: string };
    const correct = answer?.type === "choice" && answer.value === expected.value;
    return { isCorrect: correct, rawScore: correct ? 1 : 0, finalScore: correct ? ctx.maxScore : 0, judgeStatus: "auto" as const };
};

const exactBooleanGrader: Grader = (question, answer, ctx) => {
    const expected = JSON.parse(question.answer_json) as { value: boolean };
    const correct = answer?.type === "boolean" && answer.value === expected.value;
    return { isCorrect: correct, rawScore: correct ? 1 : 0, finalScore: correct ? ctx.maxScore : 0, judgeStatus: "auto" as const };
};

const exactOrderGrader: Grader = (question, answer, ctx) => {
    const expected = JSON.parse(question.answer_json) as { value: string[] };
    const correct = answer?.type === "order" && Array.isArray(answer.value) &&
        answer.value.length === expected.value.length &&
        answer.value.every((v, i) => v === expected.value[i]);
    return { isCorrect: correct, rawScore: correct ? 1 : 0, finalScore: correct ? ctx.maxScore : 0, judgeStatus: "auto" as const };
};

const normalizedWordOrderGrader: Grader = (question, answer, ctx) => {
    const expected = JSON.parse(question.answer_json) as { accepted_orders: string[][] };
    const correct = answer?.type === "word_order" && Array.isArray(answer.value) &&
        expected.accepted_orders.some((order) =>
            order.length === answer.value.length &&
            order.every((word, i) => normalizeText(word) === normalizeText(answer.value[i]))
        );
    return { isCorrect: correct, rawScore: correct ? 1 : 0, finalScore: correct ? ctx.maxScore : 0, judgeStatus: "auto" as const };
};

const acceptedTextGrader: Grader = (question, answer, ctx) => {
    const expected = JSON.parse(question.answer_json) as { accepted_values: string[] };
    const correct = answer?.type === "text" &&
        expected.accepted_values.some((v) => normalizeText(v) === normalizeText(answer.value));
    return { isCorrect: correct, rawScore: correct ? 1 : 0, finalScore: correct ? ctx.maxScore : 0, judgeStatus: "auto" as const };
};

const subjectiveGrader: Grader = (_question, _answer, _ctx) => {
    return { isCorrect: false, rawScore: 0, finalScore: 0, judgeStatus: "manual_pending" as const };
};

const graders: Record<string, Grader> = {
    single_choice: exactChoiceGrader,
    true_false: exactBooleanGrader,
    sorting: exactOrderGrader,
    word_reorder: normalizedWordOrderGrader,
    drag_fill: exactChoiceGrader,
    text_fill: acceptedTextGrader,
    essay: subjectiveGrader,
};

export function gradeQuestion(
    question: QuestionVersionData,
    answer: AnswerValue | null,
    context: GradingContext
): GradingResult {
    const grader = graders[question.question_type];
    if (!grader) {
        throw new Error(`No grader for question type: ${question.question_type}`);
    }
    return grader(question, answer, context);
}

export function isObjectiveType(questionType: string): boolean {
    return questionType !== "essay";
}
