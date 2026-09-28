import { z } from "zod";

// ============================================================
// HSK Question Type Schemas (T013)
// Design: docs/design/hsk-online-exam-platform-design.md §4-6
// ============================================================

export const HSK_QUESTION_TYPES = [
    "single_choice",
    "true_false",
    "sorting",
    "word_reorder",
    "drag_fill",
    "text_fill",
    "essay",
] as const;
export type HskQuestionType = (typeof HSK_QUESTION_TYPES)[number];

export const QUESTION_GROUP_TYPES = ["material", "option_set", "word_pool"] as const;
export type QuestionGroupType = (typeof QUESTION_GROUP_TYPES)[number];

// ---------- Shared option schema ----------
export const optionSchema = z.object({
    key: z.string().min(1),
    text: z.string(),
});

// ---------- Answer value union (§5.5) ----------
export const answerValueSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("choice"), value: z.string() }),
    z.object({ type: z.literal("boolean"), value: z.boolean() }),
    z.object({ type: z.literal("order"), value: z.array(z.string()) }),
    z.object({ type: z.literal("word_order"), value: z.array(z.string()) }),
    z.object({ type: z.literal("fill"), value: z.string() }),
    z.object({ type: z.literal("text"), value: z.string() }),
    z.object({ type: z.literal("essay"), value: z.string() }),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

// ============================================================
// Per-type Payload & Answer schemas (§6.1 – §6.7)
// ============================================================

// §6.1 single_choice
export const singleChoicePayloadSchema = z.object({
    options: z.array(optionSchema).min(2),
});
export const singleChoiceAnswerSchema = z.object({
    value: z.string(),
});

// §6.2 true_false
export const trueFalsePayloadSchema = z.object({
    display_text: z.string(),
    true_label: z.string().default("对"),
    false_label: z.string().default("错"),
});
export const trueFalseAnswerSchema = z.object({
    value: z.boolean(),
});

// §6.3 sorting
export const sortingPayloadSchema = z.object({
    items: z.array(optionSchema).min(2),
});
export const sortingAnswerSchema = z.object({
    value: z.array(z.string()),
});

// §6.4 word_reorder
export const wordReorderPayloadSchema = z.object({
    words: z.array(z.string()).min(2),
    punctuation: z.string().optional(),
});
export const wordReorderAnswerSchema = z.object({
    accepted_orders: z.array(z.array(z.string())).min(1),
});

// §6.5 drag_fill
export const dragFillPayloadSchema = z.object({
    blank_id: z.string(),
    context: z.string(),
});
export const dragFillAnswerSchema = z.object({
    value: z.string(),
});

// §6.6 text_fill
export const textFillPayloadSchema = z.object({
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    pinyin_hint: z.string().optional(),
});
export const textFillAnswerSchema = z.object({
    accepted_values: z.array(z.string()).min(1),
});

// §6.7 essay
export const essayPayloadSchema = z.object({
    task_type: z.string().optional(),
    reading_minutes: z.number().int().positive().optional(),
    writing_minutes: z.number().int().positive().optional(),
    target_length: z.number().int().positive().optional(),
    material_id: z.string().optional(),
    rules: z.array(z.string()).optional(),
});
export const essayAnswerSchema = z.object({
    reference_essay: z.string().optional(),
    rubrics: z
        .array(
            z.object({
                criterion: z.string(),
                weight: z.number(),
            })
        )
        .optional(),
});

// ============================================================
// Dispatch table: payload + answer validators per question type
// ============================================================

export const payloadSchemaByType: Record<HskQuestionType, z.ZodTypeAny> = {
    single_choice: singleChoicePayloadSchema,
    true_false: trueFalsePayloadSchema,
    sorting: sortingPayloadSchema,
    word_reorder: wordReorderPayloadSchema,
    drag_fill: dragFillPayloadSchema,
    text_fill: textFillPayloadSchema,
    essay: essayPayloadSchema,
};

export const answerSchemaByType: Record<HskQuestionType, z.ZodTypeAny> = {
    single_choice: singleChoiceAnswerSchema,
    true_false: trueFalseAnswerSchema,
    sorting: sortingAnswerSchema,
    word_reorder: wordReorderAnswerSchema,
    drag_fill: dragFillAnswerSchema,
    text_fill: textFillAnswerSchema,
    essay: essayAnswerSchema,
};

// ============================================================
// Group payload schemas (§6.5 option_set, etc.)
// ============================================================

export const optionSetPayloadSchema = z.object({
    options: z.array(optionSchema).min(2),
});

export const groupPayloadSchemaByType: Record<QuestionGroupType, z.ZodTypeAny> = {
    material: z.object({}).passthrough(),
    option_set: optionSetPayloadSchema,
    word_pool: z.object({ words: z.array(z.string()) }).passthrough(),
};

/**
 * Validates a question version's payload_json and answer_json
 * against the schema for the given question type.
 * Returns the parsed objects or throws a ZodError.
 */
export function validateQuestionVersion(
    questionType: string,
    payloadJson: string,
    answerJson: string
): { payload: unknown; answer: unknown } {
    const payloadSchema = payloadSchemaByType[questionType as HskQuestionType];
    const answerSchema = answerSchemaByType[questionType as HskQuestionType];
    if (!payloadSchema || !answerSchema) {
        throw new Error(`Unknown question type: ${questionType}`);
    }
    const payload = payloadSchema.parse(JSON.parse(payloadJson));
    const answer = answerSchema.parse(JSON.parse(answerJson));
    return { payload, answer };
}

/**
 * Validates a submitted answer value against the expected answer schema.
 */
export function validateAnswerValue(answer: unknown): AnswerValue {
    return answerValueSchema.parse(answer);
}

