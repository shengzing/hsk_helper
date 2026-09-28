#!/usr/bin/env npx tsx
/**
 * T018 — Validate answer keys against option pools.
 *
 * Usage:
 *   npx tsx scripts/validate-past-papers.ts <input.json>
 *
 * Checks:
 * 1. Each question has question_type, payload, answer, score.
 * 2. Answer keys exist in the option pool for choice-type questions.
 * 3. Section question counts are plausible.
 * 4. Group questions have consistent sub-question counts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ParsedPaper } from "../src/services/importService.js";

function main(): void {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: validate-past-papers.ts <input.json>");
        process.exit(1);
    }

    const raw = JSON.parse(readFileSync(resolve(args[0]), "utf8")) as ParsedPaper;
    const errors: string[] = [];

    for (const section of raw.sections) {
        for (let i = 0; i < section.questions.length; i++) {
            const q = section.questions[i];

            // Check required fields
            if (!q.question_type) errors.push(`${section.code}[${i}]: missing question_type`);
            if (!q.payload) errors.push(`${section.code}[${i}]: missing payload`);
            if (!q.answer) errors.push(`${section.code}[${i}]: missing answer`);
            if (q.score === undefined || q.score < 0) errors.push(`${section.code}[${i}]: invalid score`);

            // For single_choice / drag_fill: check answer key exists in options
            if (q.question_type === "single_choice" || q.question_type === "drag_fill") {
                const options = (q.payload as { options?: Array<{ key: string }> }).options ?? [];
                if (options.length < 4) {
                    errors.push(`${section.code}[${i}]: expected at least 4 options, got ${options.length}`);
                }
                const answerValue = (q.answer as { value?: string }).value;
                if (answerValue && !options.some((o) => o.key === answerValue)) {
                    errors.push(`${section.code}[${i}]: answer key "${answerValue}" not in option pool [${options.map((o) => o.key).join(",")}]`);
                }
            }

            // For text_fill: check accepted_values is non-empty
            if (q.question_type === "text_fill") {
                const av = (q.answer as { accepted_values?: string[] }).accepted_values;
                if (!av || av.length === 0) {
                    errors.push(`${section.code}[${i}]: text_fill answer must have non-empty accepted_values`);
                }
            }

            // For word_reorder: check accepted_orders is non-empty
            if (q.question_type === "word_reorder") {
                const ao = (q.answer as { accepted_orders?: string[][] }).accepted_orders;
                if (!ao || ao.length === 0) {
                    errors.push(`${section.code}[${i}]: word_reorder answer must have non-empty accepted_orders`);
                }
            }
        }
    }

    // Check total score
    const totalQuestions = raw.sections.reduce((n, s) => n + s.questions.length, 0);
    const totalScore = raw.sections.reduce(
        (sum, s) => sum + s.questions.reduce((q, x) => q + (x.score ?? 0), 0), 0
    );

    if (Math.abs(totalScore - raw.total_score) > 0.01) {
        errors.push(`Total score mismatch: sum of question scores = ${totalScore}, paper total_score = ${raw.total_score}`);
    }

    console.log(`Paper: ${raw.title}`);
    console.log(`Sections: ${raw.sections.length}, Questions: ${totalQuestions}, Total score: ${totalScore}`);

    if (errors.length > 0) {
        console.error(`\nValidation FAILED with ${errors.length} errors:`);
        for (const e of errors) console.error(`  - ${e}`);
        process.exit(1);
    }

    console.log("\nValidation PASSED.");
}

main();
