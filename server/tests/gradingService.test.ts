import { describe, it, expect } from "vitest";
import {
  gradeQuestion,
  isObjectiveType,
  type QuestionVersionData,
  type GradingContext,
} from "../src/services/gradingService.js";
import type { AnswerValue } from "../src/schemas/question.js";

const ctx: GradingContext = { paperQuestionId: "pq-test", maxScore: 3 };

function makeQuestion(type: string, answerJson: string): QuestionVersionData {
  return {
    id: "qv-test",
    question_type: type,
    payload_json: "{}",
    answer_json: answerJson,
    scoring_policy: "exact",
  };
}

describe("Grading service — seven question types (path C)", () => {
  describe("single_choice grader", () => {
    const q = makeQuestion("single_choice", JSON.stringify({ value: "B" }));

    it("GRD-01: correct answer", () => {
      const result = gradeQuestion(q, { type: "choice", value: "B" }, ctx);
      expect(result.isCorrect).toBe(true);
      expect(result.finalScore).toBe(3);
      expect(result.judgeStatus).toBe("auto");
    });

    it("GRD-02: wrong answer", () => {
      const result = gradeQuestion(q, { type: "choice", value: "D" }, ctx);
      expect(result.isCorrect).toBe(false);
      expect(result.finalScore).toBe(0);
    });

    it("GRD-16: null answer (unanswered)", () => {
      const result = gradeQuestion(q, null, ctx);
      expect(result.isCorrect).toBe(false);
      expect(result.rawScore).toBe(0);
      expect(result.finalScore).toBe(0);
    });

    it("GRD-17: answer with key not in options (defensive)", () => {
      const result = gradeQuestion(q, { type: "choice", value: "Z" }, ctx);
      expect(result.isCorrect).toBe(false);
    });

    it("wrong answer type is incorrect", () => {
      const result = gradeQuestion(q, { type: "boolean", value: true }, ctx);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("true_false grader", () => {
    const q = makeQuestion("true_false", JSON.stringify({ value: true }));

    it("GRD-03: correct (true)", () => {
      const result = gradeQuestion(q, { type: "boolean", value: true }, ctx);
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-04: incorrect (false)", () => {
      const result = gradeQuestion(q, { type: "boolean", value: false }, ctx);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("sorting grader", () => {
    const q = makeQuestion("sorting", JSON.stringify({ value: ["B", "C", "A"] }));

    it("GRD-05: correct order", () => {
      const result = gradeQuestion(q, { type: "order", value: ["B", "C", "A"] }, ctx);
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-06: wrong order", () => {
      const result = gradeQuestion(q, { type: "order", value: ["A", "B", "C"] }, ctx);
      expect(result.isCorrect).toBe(false);
    });

    it("partial match (different length) is incorrect", () => {
      const result = gradeQuestion(q, { type: "order", value: ["B", "C"] }, ctx);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("word_reorder grader (with normalization)", () => {
    const q = makeQuestion(
      "word_reorder",
      JSON.stringify({ accepted_orders: [["那个", "小女孩", "长得", "很漂亮"]] })
    );

    it("GRD-07: correct order", () => {
      const result = gradeQuestion(
        q,
        { type: "word_order", value: ["那个", "小女孩", "长得", "很漂亮"] },
        ctx
      );
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-08: correct with extra spaces (normalization)", () => {
      const result = gradeQuestion(
        q,
        { type: "word_order", value: ["  那个  ", " 小女孩 ", " 长得 ", "很漂亮  "] },
        ctx
      );
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-09: wrong order", () => {
      const result = gradeQuestion(
        q,
        { type: "word_order", value: ["很漂亮", "那个", "小女孩", "长得"] },
        ctx
      );
      expect(result.isCorrect).toBe(false);
    });

    it("accepts any of the accepted_orders", () => {
      const q2 = makeQuestion(
        "word_reorder",
        JSON.stringify({
          accepted_orders: [
            ["A", "B", "C"],
            ["C", "B", "A"],
          ],
        })
      );
      expect(gradeQuestion(q2, { type: "word_order", value: ["C", "B", "A"] }, ctx).isCorrect).toBe(true);
      expect(gradeQuestion(q2, { type: "word_order", value: ["A", "B", "C"] }, ctx).isCorrect).toBe(true);
      expect(gradeQuestion(q2, { type: "word_order", value: ["B", "A", "C"] }, ctx).isCorrect).toBe(false);
    });
  });

  describe("drag_fill grader", () => {
    const q = makeQuestion("drag_fill", JSON.stringify({ value: "D" }));

    it("GRD-10: correct", () => {
      const result = gradeQuestion(q, { type: "choice", value: "D" }, ctx);
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-11: wrong", () => {
      const result = gradeQuestion(q, { type: "choice", value: "B" }, ctx);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("text_fill grader (with normalization)", () => {
    const q = makeQuestion("text_fill", JSON.stringify({ accepted_values: ["杯"] }));

    it("GRD-12: exact match", () => {
      const result = gradeQuestion(q, { type: "text", value: "杯" }, ctx);
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-13: match with surrounding spaces (normalized)", () => {
      const result = gradeQuestion(q, { type: "text", value: " 杯 " }, ctx);
      expect(result.isCorrect).toBe(true);
    });

    it("GRD-14: wrong answer", () => {
      const result = gradeQuestion(q, { type: "text", value: "杯子" }, ctx);
      expect(result.isCorrect).toBe(false);
    });

    it("full-width space is normalized", () => {
      const result = gradeQuestion(q, { type: "text", value: "\u3000杯\u3000" }, ctx);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe("essay grader", () => {
    const q = makeQuestion("essay", JSON.stringify({ reference_essay: "..." }));

    it("GRD-15: always returns manual_pending", () => {
      const result = gradeQuestion(q, { type: "essay", value: "远古时期..." }, ctx);
      expect(result.isCorrect).toBe(false);
      expect(result.rawScore).toBe(0);
      expect(result.finalScore).toBe(0);
      expect(result.judgeStatus).toBe("manual_pending");
    });

    it("null essay answer also returns manual_pending", () => {
      const result = gradeQuestion(q, null, ctx);
      expect(result.judgeStatus).toBe("manual_pending");
    });
  });

  describe("isObjectiveType", () => {
    it("returns true for all objective types", () => {
      expect(isObjectiveType("single_choice")).toBe(true);
      expect(isObjectiveType("true_false")).toBe(true);
      expect(isObjectiveType("sorting")).toBe(true);
      expect(isObjectiveType("word_reorder")).toBe(true);
      expect(isObjectiveType("drag_fill")).toBe(true);
      expect(isObjectiveType("text_fill")).toBe(true);
    });

    it("returns false for essay", () => {
      expect(isObjectiveType("essay")).toBe(false);
    });
  });

  describe("gradeQuestion — error handling", () => {
    it("throws for unknown question type", () => {
      const q = makeQuestion("unknown_type", "{}");
      expect(() => gradeQuestion(q, null, ctx)).toThrow();
    });
  });
});
