import { describe, it, expect } from "vitest";
import {
  validateQuestionVersion,
  validateAnswerValue,
  payloadSchemaByType,
  answerSchemaByType,
  singleChoicePayloadSchema,
  trueFalsePayloadSchema,
  sortingPayloadSchema,
  wordReorderPayloadSchema,
  dragFillPayloadSchema,
  textFillPayloadSchema,
  essayPayloadSchema,
  HSK_QUESTION_TYPES,
} from "../src/schemas/question.js";

describe("Zod question schemas", () => {
  describe("HSK_QUESTION_TYPES", () => {
    it("includes all 7 types", () => {
      expect(HSK_QUESTION_TYPES).toEqual([
        "single_choice",
        "true_false",
        "sorting",
        "word_reorder",
        "drag_fill",
        "text_fill",
        "essay",
      ]);
    });
  });

  describe("single_choice payload", () => {
    it("accepts valid payload", () => {
      const payload = { options: [{ key: "A", text: "去超市" }, { key: "B", text: "去爬山" }] };
      expect(() => singleChoicePayloadSchema.parse(payload)).not.toThrow();
    });

    it("rejects payload with fewer than 2 options", () => {
      const payload = { options: [{ key: "A", text: "only one" }] };
      expect(() => singleChoicePayloadSchema.parse(payload)).toThrow();
    });

    it("rejects payload with empty key", () => {
      const payload = { options: [{ key: "", text: "empty key" }, { key: "B", text: "ok" }] };
      expect(() => singleChoicePayloadSchema.parse(payload)).toThrow();
    });
  });

  describe("true_false payload", () => {
    it("accepts valid payload with defaults", () => {
      const payload = { display_text: "明天天气很好。" };
      const parsed = trueFalsePayloadSchema.parse(payload);
      expect(parsed.true_label).toBe("对");
      expect(parsed.false_label).toBe("错");
    });

    it("rejects payload without display_text", () => {
      expect(() => trueFalsePayloadSchema.parse({ true_label: "对" })).toThrow();
    });
  });

  describe("sorting payload", () => {
    it("accepts valid payload", () => {
      const payload = {
        items: [
          { key: "A", text: "第一句" },
          { key: "B", text: "第二句" },
        ],
      };
      expect(() => sortingPayloadSchema.parse(payload)).not.toThrow();
    });
  });

  describe("word_reorder payload", () => {
    it("accepts valid payload", () => {
      const payload = { words: ["很漂亮", "那个", "小女孩", "长得"], punctuation: "。" };
      expect(() => wordReorderPayloadSchema.parse(payload)).not.toThrow();
    });

    it("rejects payload with fewer than 2 words", () => {
      expect(() => wordReorderPayloadSchema.parse({ words: ["only"] })).toThrow();
    });
  });

  describe("drag_fill payload", () => {
    it("accepts valid payload", () => {
      const payload = { blank_id: "71", context: "《山海经》是一部著作。" };
      expect(() => dragFillPayloadSchema.parse(payload)).not.toThrow();
    });

    it("rejects payload without blank_id", () => {
      expect(() => dragFillPayloadSchema.parse({ context: "missing blank" })).toThrow();
    });
  });

  describe("text_fill payload", () => {
    it("accepts valid payload with all fields", () => {
      const payload = { prefix: "我想喝一", suffix: "温水。", pinyin_hint: "bēi" };
      expect(() => textFillPayloadSchema.parse(payload)).not.toThrow();
    });

    it("accepts empty payload (all fields optional)", () => {
      expect(() => textFillPayloadSchema.parse({})).not.toThrow();
    });
  });

  describe("essay payload", () => {
    it("accepts valid payload", () => {
      const payload = {
        task_type: "summary",
        reading_minutes: 10,
        writing_minutes: 35,
        target_length: 400,
        material_id: "mat-1",
        rules: ["只需复述文章内容", "不加入自己的观点"],
      };
      expect(() => essayPayloadSchema.parse(payload)).not.toThrow();
    });

    it("rejects negative reading_minutes", () => {
      expect(() => essayPayloadSchema.parse({ reading_minutes: -1 })).toThrow();
    });
  });

  describe("answer schemas", () => {
    it("single_choice answer accepts { value: string }", () => {
      expect(() => answerSchemaByType.single_choice.parse({ value: "B" })).not.toThrow();
    });

    it("true_false answer accepts { value: boolean }", () => {
      expect(() => answerSchemaByType.true_false.parse({ value: true })).not.toThrow();
      expect(() => answerSchemaByType.true_false.parse({ value: false })).not.toThrow();
    });

    it("sorting answer accepts { value: string[] }", () => {
      expect(() => answerSchemaByType.sorting.parse({ value: ["B", "C", "A"] })).not.toThrow();
    });

    it("word_reorder answer accepts { accepted_orders: string[][] }", () => {
      expect(() =>
        answerSchemaByType.word_reorder.parse({
          accepted_orders: [["那个", "小女孩", "长得", "很漂亮"]],
        })
      ).not.toThrow();
    });

    it("drag_fill answer accepts { value: string }", () => {
      expect(() => answerSchemaByType.drag_fill.parse({ value: "D" })).not.toThrow();
    });

    it("text_fill answer accepts { accepted_values: string[] }", () => {
      expect(() => answerSchemaByType.text_fill.parse({ accepted_values: ["杯"] })).not.toThrow();
      expect(() => answerSchemaByType.text_fill.parse({ accepted_values: [] })).toThrow();
    });

    it("essay answer accepts { reference_essay, rubrics }", () => {
      expect(() =>
        answerSchemaByType.essay.parse({
          reference_essay: "...",
          rubrics: [{ criterion: "内容覆盖", weight: 0.4 }],
        })
      ).not.toThrow();
    });
  });

  describe("validateAnswerValue", () => {
    it("accepts choice answer", () => {
      const result = validateAnswerValue({ type: "choice", value: "B" });
      expect(result.type).toBe("choice");
    });

    it("accepts boolean answer", () => {
      const result = validateAnswerValue({ type: "boolean", value: true });
      expect(result.type).toBe("boolean");
    });

    it("accepts order answer", () => {
      const result = validateAnswerValue({ type: "order", value: ["A", "B"] });
      expect(result.type).toBe("order");
    });

    it("accepts word_order answer", () => {
      const result = validateAnswerValue({ type: "word_order", value: ["那个", "小女孩"] });
      expect(result.type).toBe("word_order");
    });

    it("accepts fill answer", () => {
      const result = validateAnswerValue({ type: "fill", value: "D" });
      expect(result.type).toBe("fill");
    });

    it("accepts text answer", () => {
      const result = validateAnswerValue({ type: "text", value: "杯" });
      expect(result.type).toBe("text");
    });

    it("accepts essay answer", () => {
      const result = validateAnswerValue({ type: "essay", value: "远古时期..." });
      expect(result.type).toBe("essay");
    });

    it("rejects unknown answer type", () => {
      expect(() => validateAnswerValue({ type: "unknown", value: "x" })).toThrow();
    });

    it("rejects null", () => {
      expect(() => validateAnswerValue(null)).toThrow();
    });
  });

  describe("validateQuestionVersion", () => {
    it("validates single_choice version", () => {
      const payload = JSON.stringify({
        options: [{ key: "A", text: "去超市" }, { key: "B", text: "去爬山" }],
      });
      const answer = JSON.stringify({ value: "B" });
      const { payload: p, answer: a } = validateQuestionVersion("single_choice", payload, answer);
      expect(p).toBeDefined();
      expect(a).toBeDefined();
    });

    it("throws for unknown question type", () => {
      expect(() =>
        validateQuestionVersion("unknown_type", "{}", "{}")
      ).toThrow();
    });

    it("throws for invalid JSON", () => {
      expect(() =>
        validateQuestionVersion("single_choice", "not json", "{}")
      ).toThrow();
    });
  });
});
