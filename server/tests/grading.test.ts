import { describe, it, expect } from "vitest";
import { gradeQuestion, isObjectiveType, type QuestionVersionData } from "../src/services/gradingService.js";

function mkQuestion(type: string, answerJson: string): QuestionVersionData {
    return { id: "qv-test", question_type: type, payload_json: "{}", answer_json: answerJson, scoring_policy: "exact" };
}

describe("gradingService", () => {
    it("grades single_choice correctly", () => {
        const q = mkQuestion("single_choice", '{"value":"B"}');
        const correct = gradeQuestion(q, { type: "choice", value: "B" }, { paperQuestionId: "pq1", maxScore: 6 });
        expect(correct.isCorrect).toBe(true);
        expect(correct.finalScore).toBe(6);
        expect(correct.judgeStatus).toBe("auto");

        const wrong = gradeQuestion(q, { type: "choice", value: "A" }, { paperQuestionId: "pq1", maxScore: 6 });
        expect(wrong.isCorrect).toBe(false);
        expect(wrong.finalScore).toBe(0);
    });

    it("grades true_false correctly", () => {
        const q = mkQuestion("true_false", '{"value":true}');
        const correct = gradeQuestion(q, { type: "boolean", value: true }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(correct.isCorrect).toBe(true);
        expect(correct.finalScore).toBe(5);
        const wrong = gradeQuestion(q, { type: "boolean", value: false }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(wrong.isCorrect).toBe(false);
    });

    it("grades sorting correctly", () => {
        const q = mkQuestion("sorting", '{"value":["A","B","C"]}');
        const correct = gradeQuestion(q, { type: "order", value: ["A", "B", "C"] }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(correct.isCorrect).toBe(true);
        const wrong = gradeQuestion(q, { type: "order", value: ["C", "B", "A"] }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(wrong.isCorrect).toBe(false);
    });

    it("grades word_reorder with normalization", () => {
        const q = mkQuestion("word_reorder", '{"accepted_orders":[["\u90a3\u4e2a","\u5c0f\u5973\u5b69","\u957f\u5f97","\u5f88\u6f02\u4eae"]]}');
        const correct = gradeQuestion(q, { type: "word_order", value: ["那个", "小女孩", "长得", "很漂亮"] }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(correct.isCorrect).toBe(true);
        // With extra spaces
        const correctWithSpaces = gradeQuestion(q, { type: "word_order", value: [" 那个 ", "小女孩", " 长得 ", "很漂亮"] }, { paperQuestionId: "pq1", maxScore: 5 });
        expect(correctWithSpaces.isCorrect).toBe(true);
    });

    it("grades text_fill with normalization", () => {
        const q = mkQuestion("text_fill", '{"accepted_values":["\u676f"]}');
        const correct = gradeQuestion(q, { type: "text", value: "杯" }, { paperQuestionId: "pq1", maxScore: 4 });
        expect(correct.isCorrect).toBe(true);
        const correctWithSpaces = gradeQuestion(q, { type: "text", value: " 杯 " }, { paperQuestionId: "pq1", maxScore: 4 });
        expect(correctWithSpaces.isCorrect).toBe(true);
        const wrong = gradeQuestion(q, { type: "text", value: "碗" }, { paperQuestionId: "pq1", maxScore: 4 });
        expect(wrong.isCorrect).toBe(false);
    });

    it("sets essay to manual_pending", () => {
        const q = mkQuestion("essay", '{"reference_essay":"..."}');
        const result = gradeQuestion(q, { type: "essay", value: "some text" }, { paperQuestionId: "pq1", maxScore: 100 });
        expect(result.judgeStatus).toBe("manual_pending");
        expect(result.finalScore).toBe(0);
        expect(result.isCorrect).toBe(false);
    });

    it("handles null answer (unanswered)", () => {
        const q = mkQuestion("single_choice", '{"value":"B"}');
        const result = gradeQuestion(q, null, { paperQuestionId: "pq1", maxScore: 6 });
        expect(result.isCorrect).toBe(false);
        expect(result.finalScore).toBe(0);
    });

    it("grades drag_fill like single_choice", () => {
        const q = mkQuestion("drag_fill", '{"value":"D"}');
        const correct = gradeQuestion(q, { type: "choice", value: "D" }, { paperQuestionId: "pq1", maxScore: 3 });
        expect(correct.isCorrect).toBe(true);
        expect(correct.finalScore).toBe(3);
    });

    it("identifies objective vs subjective types", () => {
        expect(isObjectiveType("single_choice")).toBe(true);
        expect(isObjectiveType("true_false")).toBe(true);
        expect(isObjectiveType("essay")).toBe(false);
    });
});

