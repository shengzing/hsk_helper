#!/usr/bin/env npx tsx
/**
 * T017/G-004 — Parse past exam papers from real PDF files.
 *
 * Usage:
 *   npx tsx scripts/parse-past-papers.ts <input.pdf> [--output <output.json>]
 *
 * Extracts text from the PDF, identifies sections (听力/阅读/书写),
 * extracts question stems and options, and outputs structured JSON
 * ready for the import pipeline.
 *
 * For scanned/image PDFs, falls back to a prompt for manual entry.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateQuestionVersion } from "../src/schemas/question.js";

const require = createRequire(import.meta.url);

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: parse-past-papers.ts <input.pdf|input.json> [--output <output.json>]");
        process.exit(1);
    }

    const inputPath = resolve(args[0]);
    if (!existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const outputPathIdx = args.indexOf("--output");
    const outputPath = outputPathIdx >= 0 && args[outputPathIdx + 1]
        ? resolve(args[outputPathIdx + 1])
        : inputPath.replace(/\.\w+$/, ".parsed.json");

    let extractedText = "";

    if (inputPath.endsWith(".json")) {
        // Direct JSON input (manual transcription)
        const raw = JSON.parse(readFileSync(inputPath, "utf8"));
        writeFileSync(outputPath, JSON.stringify(raw, null, 2));
        console.log(`JSON input passed through. Output: ${outputPath}`);
        return;
    }

    if (inputPath.endsWith(".pdf")) {
        console.log("Parsing PDF...");
        const { PDFParse } = require("pdf-parse");
        const buf = readFileSync(inputPath);
        const parser = new PDFParse({ data: buf }); const data = await parser.getText();
        extractedText = data.text;
        console.log(`  Pages: ${data.numpages}, Text length: ${extractedText.length}`);

        if (extractedText.trim().length < 100) {
            console.error("  WARNING: Very little text extracted. This may be a scanned PDF.");
            console.error("  Scanned PDFs require OCR or manual transcription.");
            console.error("  Outputting raw text for manual processing.");
            const textPath = outputPath.replace(/\.json$/, ".raw.txt");
            writeFileSync(textPath, extractedText);
            console.error(`  Raw text: ${textPath}`);
            process.exit(1);
        }
    } else {
        extractedText = readFileSync(inputPath, "utf8");
    }

    // Parse the extracted text into structured questions
    const parsed = parsePaperText(extractedText);

    // Validate each question
    let errors = 0;
    for (const section of parsed.sections) {
        for (const q of section.questions) {
            try {
                validateQuestionVersion(
                    q.question_type,
                    JSON.stringify(q.payload),
                    JSON.stringify(q.answer)
                );
            } catch (e) {
                console.error(`  [ERROR] ${section.code}: ${(e as Error).message}`);
                errors++;
            }
        }
    }

    writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
    console.log(`\nParsed ${parsed.sections.reduce((n, s) => n + s.questions.length, 0)} questions across ${parsed.sections.length} sections.`);
    console.log(`Validation errors: ${errors}`);
    console.log(`Output: ${outputPath}`);

    if (errors > 0) {
        process.exit(1);
    }
}


/**
 * Parses raw text from an HSK paper PDF into structured sections and questions.
 * Uses pattern matching for Chinese HSK question formats.
 */
function parsePaperText(text: string): {
    paper_type: string;
    title: string;
    year: number | null;
    session: string | null;
    duration_seconds: number;
    total_score: number;
    passing_score: number;
    sections: Array<{
        code: string;
        title: string;
        duration_seconds: number;
        questions: Array<{
            question_type: string;
            stem: string;
            payload: Record<string, unknown>;
            answer: Record<string, unknown>;
            score: number;
        }>;
    }>;
} {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    // Detect section boundaries
    const sections: Array<{ code: string; title: string; duration_seconds: number; questions: Array<Record<string, unknown>> }> = [];

    // Simple pattern: find lines with 听力, 阅读, 书写
    let currentSection: { code: string; title: string; duration_seconds: number; questions: Array<Record<string, unknown>> } | null = null;

    for (const line of lines) {
        if (line.includes("听力") && !currentSection) {
            currentSection = { code: "listening", title: "听力", duration_seconds: 2100, questions: [] };
            sections.push(currentSection);
        } else if (line.includes("阅读") && currentSection?.code === "listening") {
            currentSection = { code: "reading", title: "阅读", duration_seconds: 3000, questions: [] };
            sections.push(currentSection);
        } else if (line.includes("书写") && currentSection?.code === "reading") {
            currentSection = { code: "writing", title: "书写", duration_seconds: 2700, questions: [] };
            sections.push(currentSection);
        } else if (currentSection && /^[A-D][．。．]/.test(line)) {
            // Option line like "A．去超市" or "B. 去公园"
            const key = line[0];
            const optText = line.substring(1).replace(/^[．。．．\s]+/, "").trim();
            const lastQ = currentSection.questions[currentSection.questions.length - 1];
            if (lastQ) {
                const payload = lastQ.payload as { options?: Array<{ key: string; text: string }> };
                if (!payload.options) payload.options = [];
                payload.options.push({ key, text: optText });
            }
        } else if (currentSection && /^\d+[．。．]/.test(line)) {
            // Question line like "1．男：今天天气真好..."
            const stem = line.replace(/^\d+[．。．\s]+/, "").trim();
            currentSection.questions.push({
                question_type: "single_choice",
                stem,
                payload: { options: [] },
                answer: { value: "" },
                score: 6,
            });
        }
    }

    return {
        paper_type: "past",
        title: "Parsed HSK Paper",
        year: null,
        session: null,
        duration_seconds: 8400,
        total_score: 300,
        passing_score: 180,
        sections: sections.map((s) => ({
            code: s.code,
            title: s.title,
            duration_seconds: s.duration_seconds,
            questions: s.questions as Array<{ question_type: string; stem: string; payload: Record<string, unknown>; answer: Record<string, unknown>; score: number }>,
        })),
    };
}

main().catch((err) => {
    console.error("Parse failed:", err);
    process.exit(1);
});
