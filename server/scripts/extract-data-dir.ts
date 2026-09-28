#!/usr/bin/env node --import tsx
/**
 * Extract HSK 1/2 past papers under data/ into design-format JSON.
 *
 * Usage:
 *   node --import tsx server/scripts/extract-data-dir.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Level = 1 | 2;
type AnswerValue = string | boolean;

interface SourceRecord {
    level: Level;
    folder: string;
    code: string;
    questionText: string;
    questionPdf: string | null;
    ocrPath: string | null;
    answerFile: string | null;
    answerText: string;
    answers: Map<number, AnswerValue>;
    audioPath: string | null;
    partPages: number[][];
}

interface ExtractedOption {
    key: string;
    text: string;
}

interface ExtractedQuestion {
    number: number;
    question_type: "single_choice" | "true_false";
    stem: string;
    payload: Record<string, unknown>;
    answer: Record<string, unknown>;
    score: number;
}

interface ExtractedGroup {
    key: string;
    instruction: string;
    material: string;
    questionNumbers: number[];
    payload: { partNumber: number };
}

interface ExtractedSection {
    code: "listening" | "reading";
    title: string;
    duration_seconds: number;
    questions: ExtractedQuestion[];
    groups: ExtractedGroup[];
}

interface ExtractedPaper {
    paper_type: "past";
    title: string;
    year: null;
    session: string;
    duration_seconds: number;
    total_score: number;
    passing_score: number;
    sections: ExtractedSection[];
    assets: Array<{
        id: string;
        asset_type: "audio" | "image";
        storage_key: string;
        url: string;
        mime_type: string;
        usage: "full_listening_audio" | "part_image";
        file_size?: number;
    }>;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_ROOT = resolve(PROJECT_ROOT, "data");
const OUTPUT_DIR = resolve(DATA_ROOT, "imported");
const EXTRACTED_DIR = resolve(DATA_ROOT, "extracted");
const ANSWERS_DIR = resolve(DATA_ROOT, "answers");
const OCR_DIR = resolve(DATA_ROOT, "ocr");
const LOCAL_PDFTOTEXT = "/Users/jcb/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext";
const PDFTOTEXT = process.env.PDFTOTEXT_BIN
    ?? (existsSync(LOCAL_PDFTOTEXT) ? LOCAL_PDFTOTEXT : "pdftotext");
const LOCAL_PDFTOPPM = "/Users/jcb/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftoppm";
const PDFTOPPM = process.env.PDFTOPPM_BIN
    ?? (existsSync(LOCAL_PDFTOPPM) ? LOCAL_PDFTOPPM : "pdftoppm");
const IMAGE_OUTPUT_DIR = resolve(DATA_ROOT, "assets", "images");

const ROOTS: Array<{ level: Level; path: string }> = [
    { level: 1, path: resolve(DATA_ROOT, "HSK1级真题 34套") },
    { level: 2, path: resolve(DATA_ROOT, "HSK2级真题 30套") },
];

const PART_RANGES: Record<Level, Record<"listening" | "reading", Array<[number, number]>>> = {
    1: {
        listening: [[1, 5], [6, 10], [11, 15], [16, 20]],
        reading: [[21, 25], [26, 30], [31, 35], [36, 40]],
    },
    2: {
        listening: [[1, 10], [11, 20], [21, 30], [31, 35]],
        reading: [[36, 40], [41, 45], [46, 50], [51, 60]],
    },
};

const INSTRUCTIONS: Record<Level, Record<"listening" | "reading", string[]>> = {
    1: {
        listening: [
            "第 1-5 题：每题听两次，根据图片判断对错。",
            "第 6-10 题：每题听两次，根据录音选出对应图片。",
            "第 11-15 题：每题听两次，根据对话选出对应图片。",
            "第 16-20 题：每题听两次，根据问题选出正确答案。",
        ],
        reading: [
            "第 21-25 题：判断图片与词语是否一致。",
            "第 26-30 题：根据句子选出对应图片。",
            "第 31-35 题：为问句选择对应回答。",
            "第 36-40 题：选词填空。",
        ],
    },
    2: {
        listening: [
            "第 1-10 题：每题听两次，根据图片判断对错。",
            "第 11-20 题：每题听两次，根据对话选出对应图片。",
            "第 21-30 题：每题听两次，根据问题选出正确答案。",
            "第 31-35 题：每题听两次，根据对话选出正确答案。",
        ],
        reading: [
            "第 36-40 题：根据句子选出对应图片。",
            "第 41-45 题：选词填空。",
            "第 46-50 题：判断第二句与第一句是否一致。",
            "第 51-60 题：为句子选择对应表达。",
        ],
    },
};

const TRUE_FALSE_PARTS: Record<Level, Record<"listening" | "reading", number[]>> = {
    1: { listening: [1], reading: [1] },
    2: { listening: [1], reading: [3] },
};

const PART_PAGE_LABELS: Record<Level, string[]> = {
    1: ["1-5", "6-10", "11-15", "16-20", "21-25", "26-30", "31-35", "36-40"],
    2: ["1-10", "11-15", "21-30", "31-35", "36-40", "41-45", "46-50", "51-55"],
};

function pdfText(file: string): string {
    const result = spawnSync(PDFTOTEXT, ["-layout", file, "-"], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    return result.stdout ?? "";
}

function documentText(file: string): string {
    if (/\.pdf$/i.test(file)) return pdfText(file);
    if (/\.txt$/i.test(file)) return readFileSync(file, "utf8");
    if (/\.docx$/i.test(file)) {
        const result = spawnSync("unzip", ["-p", file, "word/document.xml"], {
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        return (result.stdout ?? "")
            .replace(/<\/w:p>/g, "\n")
            .replace(/<[^>]+>/g, "");
    }
    if (/\.doc$/i.test(file)) {
        const result = spawnSync("textutil", ["-convert", "txt", "-stdout", file], {
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        return result.stdout ?? "";
    }
    return "";
}

function answerSlice(text: string): string {
    const markers = [...text.matchAll(/(?:H?\s*\d{5}[A-Z]?\s*)?卷\s*答案|Loesung/gi)]
        .map((match) => match.index + match[0].length);
    return markers.length ? text.slice(Math.max(...markers)) : text;
}

function parseAnswers(text: string): Map<number, AnswerValue> {
    const answers = new Map<number, AnswerValue>();
    const pattern = /([1-9]|[1-5][0-9]|60)\s*[.．、]?\s*([A-F√×X])/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const number = Number(match[1]);
        const raw = match[2];
        const value: AnswerValue =
            raw === "√" ? true : raw === "×" || raw === "X" ? false : raw;
        answers.set(number, value);
    }
    return answers;
}

function getPageCount(pdf: string): number {
    const result = spawnSync("pdfinfo", [pdf], { encoding: "utf8" });
    if (result.error) throw result.error;
    const match = /Pages:\s+(\d+)/.exec(result.stdout ?? "");
    if (!match) throw new Error(`Unable to read page count for ${pdf}`);
    return Number(match[1]);
}

function pageText(pdf: string, page: number): string {
    const result = spawnSync(PDFTOTEXT, ["-layout", "-f", String(page), "-l", String(page), pdf, "-"], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    return result.stdout ?? "";
}

function findPartPages(
    questionPdf: string | null,
    level: Level,
    questionText: string
): number[][] {
    const labels = PART_PAGE_LABELS[level];
    const pageTexts: string[] = [];

    if (/---\s*page\s+\d+\s*---/i.test(questionText)) {
        const chunks = questionText.split(/---\s*page\s+\d+\s*---/i);
        pageTexts.push(...chunks.slice(1).map((chunk) => chunk));
    } else if (questionPdf) {
        const pageCount = getPageCount(questionPdf);
        for (let page = 1; page <= pageCount; page += 1) {
            pageTexts.push(pageText(questionPdf, page));
        }
    }

    const starts: number[] = [];
    for (const label of labels) {
        const pattern = new RegExp(`第\\s*${label}\\s*题`);
        const pageIndex = pageTexts.findIndex((text) => pattern.test(text));
        starts.push(pageIndex >= 0 ? pageIndex + 1 : 1);
    }

    const markerPage = pageTexts.findIndex((text) =>
        /听\s*力\s*材\s*料|卷\s*答案|Loesung/i.test(text)
    );
    const lastEnd = markerPage > 0 ? markerPage : pageTexts.length;

    return labels.map((_, index) => {
        const start = starts[index];
        const nextStart = starts[index + 1] ?? lastEnd + 1;
        const end = Math.max(start, Math.min(nextStart - 1, lastEnd));
        return [start, end];
    });
}

function hasCompleteAnswers(text: string, expected: number): boolean {
    const answers = parseAnswers(answerSlice(text));
    return answers.size >= expected && Array.from({ length: expected }, (_, i) => i + 1)
        .every((number) => answers.has(number));
}

function normalizeCode(value: string): string {
    return value.replace(/[^0-9A-Za-z]/g, "").toLowerCase();
}

function discoverSources(): { sources: SourceRecord[]; pending: SourceRecord[] } {
    const unique = new Map<string, SourceRecord>();
    const pending: SourceRecord[] = [];

    for (const root of ROOTS) {
        const folders = readdirSync(root.path, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

        for (const folder of folders) {
            const folderCode = normalizeCode(folder.name);
            if (folderCode === "10000" || folderCode === "20000") continue;

            const dir = join(root.path, folder.name);
            const files = readdirSync(dir).map((file) => join(dir, file));
            const ocrPath = join(OCR_DIR, `h${folderCode}.txt`);
            const pdfs = files.filter((file) =>
                /\.pdf$/i.test(file) &&
                !/答案|Loesung|_31572__26696|听力|Transkript/i.test(file.split("/").pop() ?? file)
            );
            const ranked = pdfs
                .map((file) => ({ file, text: pdfText(file) }))
                .sort((a, b) => b.text.length - a.text.length);
            const questionPdf = ranked[0]?.file ?? null;
            const questionText = existsSync(ocrPath)
                ? readFileSync(ocrPath, "utf8")
                : ranked[0]?.text ?? "";
            const actualCode = (questionText.match(/H\s?([1-2]\d{4}[A-Z]?)/) ?? [null, folderCode])[1] ?? folderCode;
            const code = `h${actualCode.toLowerCase()}`;

            let answerFile: string | null = null;
            let answerText = "";
            for (const file of files.filter((file) => /\.(pdf|doc|docx|txt)$/i.test(file))) {
                try {
                    const text = documentText(file);
                    if (hasCompleteAnswers(text, root.level === 1 ? 40 : 60)) {
                        answerFile = file;
                        answerText = answerSlice(text);
                        break;
                    }
                } catch {
                    // Ignore files that macOS textutil or poppler cannot read.
                }
            }
            if (!answerFile && hasCompleteAnswers(questionText, root.level === 1 ? 40 : 60)) {
                answerFile = existsSync(ocrPath) ? ocrPath : questionPdf;
                answerText = answerSlice(questionText);
            }

            const convertedAudioPath = join(DATA_ROOT, "media", `${code}.mp3`);
            const audioPath = existsSync(convertedAudioPath)
                ? convertedAudioPath
                : files.find((file) => /\.mp3$/i.test(file))
                    ?? files.find((file) => /\.wma$/i.test(file))
                    ?? null;
            const partPages = findPartPages(questionPdf, root.level, questionText);
            const record: SourceRecord = {
                level: root.level,
                folder: folder.name,
                code,
                questionText,
                questionPdf,
                ocrPath: existsSync(ocrPath) ? ocrPath : null,
                answerFile,
                answerText,
                answers: parseAnswers(answerText),
                audioPath,
                partPages,
            };

            const expected = root.level === 1 ? 40 : 60;
            const complete = record.answers.size >= expected
                && Array.from({ length: expected }, (_, index) => index + 1)
                    .every((number) => record.answers.has(number));
            if (!complete) {
                pending.push(record);
                continue;
            }
            if (!unique.has(code)) unique.set(code, record);
        }
    }

    return {
        sources: [...unique.values()].sort((a, b) =>
            a.level - b.level || a.code.localeCompare(b.code, "en", { numeric: true })
        ),
        pending,
    };
}

function splitSection(questionText: string, level: Level): { listening: string; reading: string } {
    const lines = questionText.split(/\r?\n/);
    const listeningStart = lines.findIndex((line) =>
        /^(\s*[一二]\s*[、.．]\s*|\s*第\s*[一二]\s*节\s*)听\s*力/.test(line)
    );
    const headingReadingStart = lines.findIndex((line, index) =>
        index > listeningStart && /^(\s*[一二]\s*[、.．]\s*|\s*第\s*[一二]\s*节\s*)阅\s*读/.test(line)
    );
    const firstReadingQuestion = level === 1 ? 21 : 36;
    const markerReadingStart = lines.findIndex((line, index) =>
        index > listeningStart && new RegExp(`^\\s*${firstReadingQuestion}\\s*[.．、]`).test(line)
    );
    const readingCandidates = [headingReadingStart, markerReadingStart]
        .filter((index) => index > listeningStart);
    const readingStart = readingCandidates.length ? Math.min(...readingCandidates) : -1;
    const safeListeningStart = listeningStart >= 0 ? listeningStart : 0;
    const safeReadingStart = readingStart > safeListeningStart ? readingStart : lines.length;
    const readingEnd = lines.slice(safeReadingStart).findIndex((line) =>
        /听\s*力\s*材\s*料|卷\s*答案|Loesung/i.test(line)
    );
    const safeReadingEnd = readingEnd >= 0 ? safeReadingStart + readingEnd : lines.length;
    return {
        listening: lines.slice(safeListeningStart, safeReadingStart).join("\n"),
        reading: lines.slice(safeReadingStart, safeReadingEnd).join("\n"),
    };
}

function splitPart(sectionText: string, start: number, nextStart: number | null): string {
    const startPattern = new RegExp(
        `(^|\\n)([^\\n]*(第\\s*${start}\\s*[-–—]|第\\s*${start}\\s*[.．、])|^\\s*${start}\\s*[.．、])`,
        "i"
    );
    const startMatch = sectionText.match(startPattern);
    const safeStart = startMatch?.index ?? 0;
    let safeEnd = sectionText.length;
    if (nextStart !== null) {
        const nextPattern = new RegExp(
            `(^|\\n)([^\\n]*(第\\s*${nextStart}\\s*[-–—]|第\\s*${nextStart}\\s*[.．、])|^\\s*${nextStart}\\s*[.．、])`,
            "i"
        );
        const nextMatch = sectionText.slice(safeStart).match(nextPattern);
        if (nextMatch?.index !== undefined) safeEnd = safeStart + nextMatch.index;
    }
    return sectionText.slice(safeStart, safeEnd);
}

function cleanMaterial(text: string): string {
    const lines = text.split(/\r?\n/)
        .map((line) => line
            .replace(/^\s*-\s*\d+\s*-\s*$/, "")
            .replace(/^\s*H\s?\d{5}[A-Z]?\s*-\s*\d+\s*$/i, "")
            .replace(/\s+/g, " ")
            .trim())
        .filter(Boolean);
    const deduped: string[] = [];
    for (const line of lines) {
        if (deduped.at(-1) === line) continue;
        if (line.length < 2 && !/[A-F√×]/.test(line)) continue;
        deduped.push(line);
    }
    return deduped.join("\n").trim();
}

function isPinyinLine(line: string): boolean {
    const compact = line
        .replace(/[\s.,'’!?;:()\-—–，。．、！？；：“”‘’（）]/g, "")
        .trim();
    return compact.length > 0
        && !/\p{Script=Han}/u.test(compact)
        && /^[\p{Script=Latin}\p{N}]+$/u.test(compact);
}

function extractQuestionStems(material: string, start: number, end: number): Map<number, string> {
    const stems = new Map<number, string>();
    const lines = material.split(/\r?\n/);
    for (let number = start; number <= end; number += 1) {
        const pattern = new RegExp(`^\\s*${number}\\s*[.．、]?\\s*(.*)$`);
        const index = lines.findIndex((line) => pattern.test(line));
        if (index < 0) continue;
        const first = lines[index].replace(pattern, "$1").trim();
        const collected: string[] = first ? [first] : [];
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const next = lines[cursor];
            if (/^\s*\d{1,2}\s*[.．、]/.test(next)) break;
            if (/^(第\s*[一二三四五六七八九十]+\s*部\s*分|听力|阅读|答案)/.test(next)) break;
            if (next.trim() && !isPinyinLine(next.trim())) {
                collected.push(next.trim());
            }
            if (collected.join("").length > 180) break;
        }
        const stem = collected.join(" ").replace(/\s+/g, " ").trim();
        // Pinyin/option fragments are common in OCR output. Keep stems Chinese-only;
        // the full part text remains in the group material for review.
        stems.set(number, /[A-Za-z]/.test(stem) || /^\d+\s*[.．、]?$/.test(stem) ? "" : stem);
    }
    return stems;
}

function optionCount(level: Level, section: "listening" | "reading", partNumber: number, questionNumber: number): number {
    if (level === 1) {
        if (section === "listening") return partNumber === 2 ? 3 : partNumber === 3 ? 6 : 3;
        return partNumber === 1 ? 0 : 6;
    }
    if (section === "listening") {
        if (partNumber === 1) return 0;
        if (partNumber === 2) return questionNumber <= 15 ? 6 : 5;
        return 3;
    }
    if (partNumber === 1) return 6;
    if (partNumber === 3) return 0;
    return 6;
}

function buildOptions(count: number): ExtractedOption[] {
    return Array.from({ length: count }, (_, index) => ({
        key: String.fromCharCode(65 + index),
        text: `图片 ${String.fromCharCode(65 + index)}`,
    }));
}

function sanitizeOptionText(raw: string): string {
    return raw
        .replace(/[√×]/g, "")
        .replace(/[A-Za-z\u00C0-\u024F]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseOptionsFromLine(line: string, count: number): ExtractedOption[] | null {
    const labelPattern = /(^|[^A-Za-z])([A-F])(?=\s|[\u4e00-\u9fff0-9])/g;
    const labels: Array<{ key: string; start: number; contentStart: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = labelPattern.exec(line)) !== null) {
        labels.push({
            key: match[2],
            start: match.index + match[1].length,
            contentStart: match.index + match[0].length,
        });
    }
    if (labels.length < count) return null;

    return labels.slice(0, count).map((label, index) => {
        const next = labels[index + 1];
        const raw = line.slice(
            label.contentStart,
            next?.start ?? line.length
        ).trim();
        return {
            key: label.key,
            text: sanitizeOptionText(raw) || `图片 ${label.key}`,
        };
    });
}

function parseOptionsFromBlock(lines: string[], count: number): ExtractedOption[] | null {
    const firstIndex = lines.findIndex((line) => /^A\s*[\u4e00-\u9fff0-9]/.test(line));
    if (firstIndex < 0) return null;
    const sameLine = parseOptionsFromLine(lines[firstIndex], count);
    if (sameLine) return sameLine;

    const options: ExtractedOption[] = [];
    for (let index = firstIndex; index < lines.length && options.length < count; index += 1) {
        const line = lines[index].trim();
        const expectedKey = String.fromCharCode(65 + options.length);
        const pattern = new RegExp(`^${expectedKey}\\s*(.*)$`);
        const match = line.match(pattern);
        if (!match) continue;
        const text = sanitizeOptionText(match[1]);
        if (!text) continue;
        options.push({ key: expectedKey, text });
    }
    return options.length === count ? options : null;
}

function extractOptionsForQuestion(
    material: string,
    number: number,
    count: number
): ExtractedOption[] | null {
    const lines = material.split(/\r?\n/);
    const pattern = new RegExp(`^\\s*${number}\\s*[.．、]?\\s*(.*)$`);
    const currentIndex = lines.findIndex((line) => pattern.test(line));
    if (currentIndex < 0) return null;

    const sameLine = parseOptionsFromLine(lines[currentIndex], count);
    if (sameLine) return sameLine;

    for (let index = currentIndex - 1; index >= 0; index -= 1) {
        if (/^\s*\d{1,2}\s*[.．、]/.test(lines[index])) break;
        if (/^A\s*[\u4e00-\u9fff0-9]/.test(lines[index])) {
            const parsed = parseOptionsFromBlock(lines.slice(index, currentIndex + 1), count);
            if (parsed) return parsed;
        }
    }
    return null;
}

function buildQuestions(
    source: SourceRecord,
    section: "listening" | "reading",
    partNumber: number,
    material: string
): ExtractedQuestion[] {
    const [start, end] = PART_RANGES[source.level][section][partNumber - 1];
    const stems = extractQuestionStems(material, start, end);
    const isTrueFalse = TRUE_FALSE_PARTS[source.level][section].includes(partNumber);
    const sectionQuestionCount = PART_RANGES[source.level][section]
        .reduce((sum, [from, to]) => sum + to - from + 1, 0);
    const score = 100 / sectionQuestionCount;
    const questions: ExtractedQuestion[] = [];

    for (let number = start; number <= end; number += 1) {
        const answer = source.answers.get(number);
        const stem = stems.get(number) ?? "";
        if (isTrueFalse) {
            if (typeof answer !== "boolean") throw new Error(`${source.code}: Q${number} is not boolean`);
            questions.push({
                number,
                question_type: "true_false",
                stem: "",
                payload: {
                    display_text: stem || `第 ${number} 题`,
                    true_label: "对",
                    false_label: "错",
                },
                answer: { value: answer },
                score,
            });
        } else {
            if (typeof answer !== "string") throw new Error(`${source.code}: Q${number} is not a choice`);
            const expectedOptionCount = optionCount(source.level, section, partNumber, number);
            const options = extractOptionsForQuestion(material, number, expectedOptionCount)
                ?? buildOptions(expectedOptionCount);
            questions.push({
                number,
                question_type: "single_choice",
                stem,
                payload: { options },
                answer: { value: answer },
                score,
            });
        }
    }
    return questions;
}

function renderPartImages(
    source: SourceRecord,
    section: "listening" | "reading",
    partNumber: number,
    pages: [number, number]
): Array<{
    id: string;
    asset_type: "image";
    storage_key: string;
    url: string;
    mime_type: string;
    usage: "part_image";
    file_size: number;
}> {
    if (!source.questionPdf) return [];
    const outputDir = join(IMAGE_OUTPUT_DIR, source.code);
    mkdirSync(outputDir, { recursive: true });
    const assets: Array<{
        id: string;
        asset_type: "image";
        storage_key: string;
        url: string;
        mime_type: string;
        usage: "part_image";
        file_size: number;
    }> = [];

    for (let page = pages[0]; page <= pages[1]; page += 1) {
        const prefix = join(outputDir, `${section}-part-${partNumber}-page-${page}`);
        const result = spawnSync(PDFTOPPM, [
            "-jpeg",
            "-r",
            "120",
            "-f",
            String(page),
            "-l",
            String(page),
            "-singlefile",
            source.questionPdf,
            prefix,
        ]);
        if (result.error) throw result.error;

        const filePath = `${prefix}.jpg`;
        if (!existsSync(filePath)) continue;
        const storageKey = relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
        const id = `asset-${source.code}-${section}-part-${partNumber}-page-${page}`;
        assets.push({
            id,
            asset_type: "image",
            storage_key: storageKey,
            url: `/api/papers/paper-${source.code}/assets/${id}`,
            mime_type: "image/jpeg",
            usage: "part_image",
            file_size: statSync(filePath).size,
        });
    }

    return assets;
}

function buildPaper(source: SourceRecord): ExtractedPaper {
    const sections = splitSection(source.questionText, source.level);
    const imageAssets: ExtractedPaper["assets"] = [];
    const builtSections: ExtractedSection[] = (["listening", "reading"] as const).map((code) => {
        const rawSection = sections[code];
        const groups: ExtractedGroup[] = [];
        const questions: ExtractedQuestion[] = [];
        PART_RANGES[source.level][code].forEach(([start, end], index) => {
            const partNumber = index + 1;
            const nextStart = PART_RANGES[source.level][code][index + 1]?.[0] ?? null;
            const material = cleanMaterial(splitPart(rawSection, start, nextStart));
            const [imageStartPage, imageEndPage] = source.partPages[index];
            const partImages = renderPartImages(source, code, partNumber, [imageStartPage, imageEndPage]);
            imageAssets.push(...partImages);
            questions.push(...buildQuestions(source, code, partNumber, material));
            groups.push({
                key: `part-${partNumber}`,
                instruction: INSTRUCTIONS[source.level][code][index],
                material,
                questionNumbers: Array.from({ length: end - start + 1 }, (_, i) => start + i),
                payload: {
                    partNumber,
                    image_asset_ids: partImages.map((asset) => asset.id),
                },
            });
        });
        return {
            code,
            title: code === "listening" ? "听力" : "阅读",
            duration_seconds: source.level === 1
                ? code === "listening" ? 900 : 1020
                : code === "listening" ? 1500 : 1320,
            questions,
            groups,
        };
    });

    const audioPath = source.audioPath
        ? relative(PROJECT_ROOT, source.audioPath).replaceAll("\\", "/")
        : null;
    const assets: ExtractedPaper["assets"] = audioPath
        ? [{
            id: `asset-${source.code}-audio`,
            asset_type: "audio",
            storage_key: audioPath,
            url: `/api/papers/paper-${source.code}/assets/asset-${source.code}-audio`,
            mime_type: /\.wma$/i.test(audioPath) ? "audio/x-ms-wma" : "audio/mpeg",
            usage: "full_listening_audio",
        }]
        : [];
    assets.push(...imageAssets);

    return {
        paper_type: "past",
        title: `HSK ${source.level === 1 ? "一" : "二"}级真题 ${source.code.slice(1).toUpperCase()}`,
        year: null,
        session: source.code,
        duration_seconds: source.level === 1 ? 2400 : 3300,
        total_score: 200,
        passing_score: 120,
        sections: builtSections,
        assets,
    };
}

function writeReport(sources: SourceRecord[], pending: SourceRecord[]): void {
    const reportPath = resolve(PROJECT_ROOT, "docs/plans/data-dir-extraction-report.md");
    const rows = sources.map((source) => {
        const paper = JSON.parse(readFileSync(join(OUTPUT_DIR, `${source.code}.json`), "utf8"));
        return `| ${source.level} | ${source.code.toUpperCase()} | ${paper.sections[0].questions.length} | ${paper.sections[1].questions.length} | ${paper.sections.reduce((sum, section) => sum + section.questions.length, 0)} | ${source.audioPath ? "有" : "缺失"} |`;
    });
    const pendingRows = pending.map((source) => {
        const expected = source.level === 1 ? 40 : 60;
        const missing = Array.from({ length: expected }, (_, index) => index + 1)
            .filter((number) => !source.answers.has(number));
        return `| ${source.level} | ${source.code.toUpperCase()} | ${source.folder} | ${missing.length === expected ? "缺失答案键" : `答案缺失：${missing.join(", ")}`} |`;
    });
    const content = `# data/ 真题提取报告

提取时间：${new Date().toISOString()}

## 结果

- 已生成结构化 JSON：${sources.length} 套。
- 待补答案键：${pending.length} 套，未生成正式 JSON。
- HSK1 完整卷：${sources.filter((source) => source.level === 1).length} 套。
- HSK2 完整卷：${sources.filter((source) => source.level === 2).length} 套。
- 扫描卷使用 MinerU2.5-Pro-2604-1.2B 中间文本：${sources.filter((source) => source.ocrPath).length + pending.filter((source) => source.ocrPath).length} 套。
- 已提取分部图片：${sources.reduce((sum, source) => sum + source.partPages.length, 0)} 组，实际输出见 \`data/assets/images/\`。

## 已生成试卷

| 等级 | 卷号 | 听力 | 阅读 | 总题数 | 音频 |
|---:|---|---:|---:|---:|---|
${rows.join("\n")}

## 待补清单

| 等级 | 卷号 | 来源目录 | 缺口 |
|---:|---|---|---|
${pendingRows.join("\n")}

## 说明

- 每个原始分部的文本保留在对应 group 的 material 字段，供人工校对与图片题后续接入。
- 图片选项当前以“图片 A/B/C...”占位，不使用模型臆造图片语义。
- H11440 与 H21440 缺听力音频，JSON 仍保留题目与答案，音频资产为空。
- H21110 目录中的实际试卷代码为 H21220，与 H21220 目录重复，已按实际卷号去重。
`;
    writeFileSync(reportPath, content, "utf8");
}

function main(): void {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    mkdirSync(EXTRACTED_DIR, { recursive: true });
    mkdirSync(ANSWERS_DIR, { recursive: true });
    mkdirSync(OCR_DIR, { recursive: true });
    const { sources, pending } = discoverSources();
    for (const source of [...sources, ...pending]) {
        writeFileSync(join(EXTRACTED_DIR, `${source.code}.txt`), source.questionText, "utf8");
    }
    for (const source of sources) {
        writeFileSync(join(ANSWERS_DIR, `${source.code}.txt`), source.answerText, "utf8");
        const paper = buildPaper(source);
        const outputPath = join(OUTPUT_DIR, `${source.code}.json`);
        writeFileSync(outputPath, JSON.stringify(paper, null, 2) + "\n", "utf8");
        console.log(
            `${source.code}: ${paper.sections.reduce((sum, section) => sum + section.questions.length, 0)} questions`
        );
    }
    writeReport(sources, pending);
    console.log(`Generated ${sources.length} papers; pending ${pending.length} papers.`);
    console.log(`Report: ${relative(PROJECT_ROOT, resolve(PROJECT_ROOT, "docs/plans/data-dir-extraction-report.md"))}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
