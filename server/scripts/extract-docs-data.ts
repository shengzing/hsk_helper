#!/usr/bin/env npx tsx
/**
 * Extract HSK 6 papers from docs into the design's JSON structure.
 *
 * Usage:
 *   npx tsx server/scripts/extract-docs-data.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ExtractedOption {
    key: string;
    text: string;
}

interface ExtractedQuestion {
    number: number;
    question_type: "single_choice" | "essay";
    stem: string;
    payload: Record<string, unknown>;
    answer: Record<string, unknown>;
    explanation?: string;
    score: number;
}

interface ExtractedSection {
    code: "listening" | "reading" | "writing";
    title: string;
    duration_seconds: number;
    questions: ExtractedQuestion[];
    groups: ExtractedGroup[];
}

interface ExtractedGroup {
    key: string;
    instruction: string;
    material?: string;
    questionNumbers: number[];
    payload?: {
        partNumber?: number;
        parts?: Array<{
            partNumber: number;
            instruction: string;
            questionNumbers: number[];
        }>;
    };
}

interface ExtractedPaper {
    paper_type: "past";
    title: string;
    year: number | null;
    session: string;
    duration_seconds: number;
    total_score: number;
    passing_score: number;
    sections: ExtractedSection[];
    assets: Array<{
        id: string;
        asset_type: string;
        storage_key: string;
        url: string;
        mime_type: string;
        usage: string;
        duration_ms?: number;
    }>;
}

interface PaperSource {
    code: string;
    title: string;
    year: number;
    textPath: string;
    answerPath: string;
    audioPath?: string;
    audioMime?: string;
    durationMs?: number;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_DIR = resolve(PROJECT_ROOT, "data/imported");
const SOURCES: PaperSource[] = [
    {
        code: "h61332",
        title: "HSK 六级真题 H61332",
        year: 2017,
        textPath: "docs/61332/Test.md",
        answerPath: "data/answers/h61332.txt",
        audioPath: "docs/61332/Listening.mp3",
        audioMime: "audio/mpeg",
        durationMs: 2119497,
    },
    {
        code: "h61438",
        title: "HSK 六级真题 H61438",
        year: 2013,
        textPath: "data/extracted/h61438.txt",
        answerPath: "data/answers/h61438.txt",
        audioPath: "docs/61438/H61438.mp3",
        audioMime: "audio/mpeg",
        durationMs: 2128640,
    },
    {
        code: "h61551",
        title: "HSK 六级真题 H61551",
        year: 2017,
        textPath: "data/extracted/h61551.txt",
        answerPath: "data/answers/h61551.txt",
        audioPath: "data/media/h61551.mp3",
        audioMime: "audio/mpeg",
        durationMs: 2110415,
    },
    {
        code: "h61552",
        title: "HSK 六级真题 H61552",
        year: 2017,
        textPath: "data/extracted/h61552.txt",
        answerPath: "data/answers/h61552.txt",
        audioPath: "data/media/h61552.mp3",
        audioMime: "audio/mpeg",
        durationMs: 2195772,
    },
];

const LISTENING_PARTS = [
    {
        partNumber: 1,
        instruction: "第 1-15 题：请选出与所听内容一致的一项。",
        questionNumbers: Array.from({ length: 15 }, (_, index) => index + 1),
    },
    {
        partNumber: 2,
        instruction: "第 16-30 题：请选出正确答案。",
        questionNumbers: Array.from({ length: 15 }, (_, index) => index + 16),
    },
    {
        partNumber: 3,
        instruction: "第 31-50 题：请选出正确答案。",
        questionNumbers: Array.from({ length: 20 }, (_, index) => index + 31),
    },
];

function buildListeningGroupPayload(questions: ExtractedQuestion[]) {
    return {
        parts: LISTENING_PARTS.map((part) => ({
            ...part,
            questionNumbers: part.questionNumbers.filter((number) =>
                questions.some((question) => question.number === number)
            ),
        })).filter((part) => part.questionNumbers.length > 0),
    };
}

function normalizeText(value: string): string {
    return value
        .replace(/\r\n/g, "\n")
        // OCR/Tesseract sometimes emits ASCII punctuation; normalize so sentence splitter recognizes them.
        .replace(/!/g, "！")
        .replace(/\?/g, "？")
        .replace(/;/g, "；")
        .replace(/[　\s]+/g, " ")
        .trim();
}

// When OCR drops sentence terminators (semicolons become commas, periods vanish),
// a single "sentence" can still span multiple blanks like (74)..(75). Split each
// candidate sentence at every `(N)` / `（N）` marker so the downstream
// `sentences.find(...)` lookup resolves to a unique stem per question number.
function splitSentenceByBlankMarkers(
    sentence: string,
    startNumber: number,
    endNumber: number
): string[] {
    const markerRegex = /[(\uFF08]\s*(\d{1,3})\s*[)\uFF09]/g;
    type Range = { num: number; start: number; end: number };
    const ranges: Range[] = [];
    let match: RegExpExecArray | null;
    while ((match = markerRegex.exec(sentence)) !== null) {
        const num = Number(match[1]);
        if (num < startNumber || num > endNumber) continue;
        ranges.push({ num, start: match.index, end: match.index + match[0].length });
    }
    if (ranges.length <= 1) return [sentence];
    ranges.sort((a, b) => a.start - b.start);

    const chunks: string[] = [];
    for (let i = 0; i < ranges.length; i += 1) {
        const prevStart = i === 0 ? 0 : ranges[i - 1].end;
        const curEnd = ranges[i].end;
        const chunk = sentence.slice(prevStart, curEnd).trim();
        if (chunk) chunks.push(chunk);
    }
    return chunks;
}

function splitColumns(line: string): string[] {
    return line
        .split(/\s{2,}/)
        .map(column => column.trim())
        .filter(Boolean);
}

function parseAnswers(answerText: string): Map<number, string> {
    const answers = new Map<number, string>();
    const pattern = /(\d{1,3})[.．、,，]?\s*([A-E])/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(answerText)) !== null) {
        const number = Number(match[1]);
        if (number >= 1 && number <= 100) {
            answers.set(number, match[2]);
        }
    }
    return answers;
}

function isQuestionNumber(value: string): boolean {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 100;
}

function optionLabel(value: string): string | null {
    const match = value.match(/^([A-E])\s*[.．、]?\s*(.*)$/);
    return match ? match[1] : null;
}

function extractOptionsFromCell(cell: string): ExtractedOption[] {
    const labelPattern = /(?<![A-Za-z])([A-E])(?![A-Za-z])/g;
    const matches = [...cell.matchAll(labelPattern)];
    if (matches.length === 0) return [];

    return matches
        .map((match, index) => {
            const nextMatch = matches[index + 1];
            const start = (match.index ?? 0) + match[0].length;
            const end = nextMatch?.index ?? cell.length;
            return {
                key: match[1],
                text: normalizeText(cell.slice(start, end)),
            };
        })
        .filter(option => option.text.length > 0);
}

function parseChoiceQuestions(
    lines: string[],
    answers: Map<number, string>
): ExtractedQuestion[] {
    const questions = new Map<number, ExtractedQuestion>();
    let activeQuestions: ExtractedQuestion[] = [];

    for (const line of lines) {
        const columns = splitColumns(line);
        if (columns.length === 0) continue;

        const questionStarts: ExtractedQuestion[] = [];
        for (const column of columns) {
            if (!column) continue;
            const questionMatch = column.match(/^(\d{1,3})[.．、,，]?\s*(.*)$/);
            const questionRest = normalizeText(questionMatch?.[2] ?? "");
            const rawAfterNumber = column.replace(/^\d{1,3}/, "");
            const hasQuestionMarker = /[.．、,，]/.test(rawAfterNumber) || questionRest.length > 0;
            if (questionMatch && isQuestionNumber(questionMatch[1]) && hasQuestionMarker) {
                const number = Number(questionMatch[1]);
                const rest = questionRest;
                const question: ExtractedQuestion = {
                    number,
                    question_type: "single_choice",
                    stem: "",
                    payload: { options: [] as ExtractedOption[] },
                    answer: { value: answers.get(number) ?? "" },
                    score: 2,
                };
                questions.set(number, question);
                questionStarts.push(question);

                const options = extractOptionsFromCell(rest);
                if (options.length > 0) {
                    (question.payload.options as ExtractedOption[]).push(...options);
                } else if (rest) {
                    question.stem = rest;
                }
            }
        }

        if (questionStarts.length > 0) {
            activeQuestions = questionStarts;
            continue;
        }

        const optionCells = columns
            .map(column => extractOptionsFromCell(column))
            .flat();

        if (optionCells.length > 0) {
            if (activeQuestions.length === 1) {
                (activeQuestions[0].payload.options as ExtractedOption[]).push(...optionCells);
            } else if (optionCells.length === activeQuestions.length) {
                activeQuestions.forEach((question, index) => {
                    (question.payload.options as ExtractedOption[]).push(optionCells[index]);
                });
            } else if (activeQuestions.length > 0) {
                (activeQuestions[0].payload.options as ExtractedOption[]).push(...optionCells);
            }
            continue;
        }

        if (activeQuestions.length > 0) {
            activeQuestions[0].stem = normalizeText(
                `${activeQuestions[0].stem} ${columns.join(" ")}`
            );
        }
    }

    return [...questions.values()].sort((a, b) => a.number - b.number);
}

function parseBlankQuestions(
    lines: string[],
    answers: Map<number, string>
): ExtractedQuestion[] {
    const questions: ExtractedQuestion[] = [];
    const markerRegex = /(71-75|76-80)[.．、]?\s*/;
    const markers: Array<{ start: number; end: number; index: number }> = [];

    lines.forEach((line, index) => {
        const match = line.match(markerRegex);
        if (!match) return;
        const isFirstBlock = match[1] === "71-75";
        markers.push({
            start: isFirstBlock ? 71 : 76,
            end: isFirstBlock ? 75 : 80,
            index,
        });
    });

    markers.forEach((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const blockLines = lines.slice(
            marker.index + 1,
            nextMarker?.index ?? lines.length
        );
        questions.push(
            ...buildBlankQuestions(blockLines, answers, marker.start, marker.end)
        );
    });

    return questions;
}

function buildBlankQuestions(
    lines: string[],
    answers: Map<number, string>,
    startNumber: number,
    endNumber: number
): ExtractedQuestion[] {
    const cleanedLines = lines
        .map(line => normalizeText(line))
        .filter(line => line && !/[H了]?\d{5}\s*-\s*\d+/.test(line));
    const optionLines = cleanedLines.slice(-5);
    const passageLines = cleanedLines.slice(0, -5);
    const options = optionLines.map((line, index) => ({
        key: String.fromCharCode(65 + index),
        text: line.replace(/^[A-Za-z\u4e00-\u9fff]\s*/, "").trim(),
    }));

    const text = passageLines.join("\n");
    const sentences = text
        .replace(/\n/g, " ")
        .split(/(?<=[。！？；])/)
        .map(sentence => normalizeText(sentence))
        .filter(Boolean)
        .flatMap(sentence => splitSentenceByBlankMarkers(sentence, startNumber, endNumber));

    const questions: ExtractedQuestion[] = [];
    for (let number = startNumber; number <= endNumber; number++) {
        const sentence = sentences.find(
            value => value.includes(`(${number})`) || value.includes(`（${number}）`)
        );
        questions.push({
            number,
            question_type: "single_choice",
            stem: sentence ?? "选句填空",
            payload: { options },
            answer: { value: answers.get(number) ?? "" },
            score: 2,
        });
    }
    return questions;
}

function parseEssay(lines: string[]): ExtractedQuestion {
    const text = lines.join("\n").trim();
    return {
        number: 101,
        question_type: "essay",
        stem: "缩写",
        payload: {
            task_type: "summary",
            reading_minutes: 10,
            writing_minutes: 35,
            target_length: 400,
            rules: [
                "仔细阅读文章，阅读时不能抄写、记录。",
                "阅读后请缩写成一篇短文。",
                "标题自拟，只需复述文章内容，不需加入自己的观点。",
                "字数为 400 左右。",
            ],
            material: text,
        },
        answer: {
            reference_essay: "",
            rubrics: [
                { criterion: "内容覆盖", weight: 0.4 },
                { criterion: "语言准确", weight: 0.3 },
                { criterion: "结构连贯", weight: 0.3 },
            ],
        },
        score: 100,
    };
}

function splitSections(text: string): { listening: string[]; reading: string[]; writing: string[] } {
    const lines = text.split("\n").map(line => line.trimEnd());
    const listeningStart = lines.findIndex(line => /一、\s*听\s*力/.test(line));
    const readingStart = lines.findIndex(line => /二、\s*阅\s*读/.test(line));
    const writingStart = lines.findIndex(line => /三、\s*书\s*写|第\s*101\s*题/.test(line));

    const safeListeningStart = listeningStart >= 0 ? listeningStart : 0;
    const safeReadingStart = readingStart > safeListeningStart ? readingStart : lines.length;
    const safeWritingStart = writingStart > safeReadingStart ? writingStart : lines.length;

    return {
        listening: lines.slice(safeListeningStart, safeReadingStart),
        reading: lines.slice(safeReadingStart, safeWritingStart),
        writing: lines.slice(safeWritingStart),
    };
}

function normalizeMarkdownText(lines: string[]): string {
    return lines
        .join("\n")
        .replace(/\r/g, "\n")
        .replace(/generic\//g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/([^\n])\n(?!\n)/g, "$1 ")
        .trim();
}

interface MarkdownOptionMarker {
    key: string;
    markerStart: number;
    contentStart: number;
}

function findMarkdownOptionMarkers(text: string): MarkdownOptionMarker[] {
    const pattern = /(?:^|\n|\s)[-–]\s*([A-E])(?=\s)/g;
    const markers: MarkdownOptionMarker[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        markers.push({
            key: match[1],
            markerStart: match.index,
            contentStart: match.index + match[0].length,
        });
    }
    return markers;
}

function extractMarkdownOptions(lines: string[]): ExtractedOption[] {
    const text = lines.join("\n");
    const markers = findMarkdownOptionMarkers(text);
    return markers.map((marker, index) => {
        const nextMarker = markers[index + 1];
        const raw = text.slice(
            marker.contentStart,
            nextMarker?.markerStart ?? text.length
        );
        return {
            key: marker.key,
            text: normalizeMarkdownText([raw]),
        };
    }).filter(option => option.text.length > 0);
}

function parseMarkdownQuestions(
    lines: string[],
    answers: Map<number, string>,
    minNumber: number,
    maxNumber: number
): ExtractedQuestion[] {
    const questionPattern = /^\s*(\d{1,3})\s*[.．、]\s*/;
    const markers: Array<{ number: number; index: number }> = [];

    lines.forEach((line, index) => {
        const match = line.match(questionPattern);
        if (!match) return;
        const number = Number(match[1]);
        if (number >= minNumber && number <= maxNumber) {
            markers.push({ number, index });
        }
    });

    return markers.map((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const block = lines.slice(
            marker.index,
            nextMarker?.index ?? lines.length
        );
        const text = block.join("\n");
        const optionMarkers = findMarkdownOptionMarkers(text);
        const firstOption = optionMarkers[0];
        const stemRaw = text.slice(
            0,
            firstOption?.markerStart ?? text.length
        ).replace(questionPattern, "");

        return {
            number: marker.number,
            question_type: "single_choice" as const,
            stem: normalizeMarkdownText([stemRaw]),
            payload: {
                options: extractMarkdownOptions(block),
            },
            answer: {
                value: answers.get(marker.number) ?? "",
            },
            score: 2,
        };
    });
}

function parseMarkdownBlankBlock(
    lines: string[],
    answers: Map<number, string>,
    startNumber: number,
    endNumber: number
): { questions: ExtractedQuestion[]; material: string } {
    const optionStart = lines.findIndex((line) =>
        /^\s*[-*]\s*[A-E]\s/.test(line)
    );
    if (optionStart < 0) {
        throw new Error(`Unable to find options for ${startNumber}-${endNumber}`);
    }

    const materialLines = lines.slice(0, optionStart);
    const optionLines = lines.slice(optionStart);
    const material = normalizeMarkdownText(materialLines);
    const options = extractMarkdownOptions(optionLines);
    const sentences = material
        .split(/(?<=[。！？；])/)
        .map((sentence) => normalizeMarkdownText([sentence]))
        .filter(Boolean)
        .flatMap((sentence) => splitSentenceByBlankMarkers(sentence, startNumber, endNumber));

    const questions: ExtractedQuestion[] = [];
    for (let number = startNumber; number <= endNumber; number += 1) {
        const sentence = sentences.find(
            (value) => value.includes(`(${number})`) || value.includes(`（${number}）`)
        );
        questions.push({
            number,
            question_type: "single_choice",
            stem: sentence ?? "选句填空",
            payload: { options },
            answer: { value: answers.get(number) ?? "" },
            score: 2,
        });
    }

    return { questions, material };
}

function parseMarkdownBlankGroups(
    lines: string[],
    answers: Map<number, string>
): Array<ExtractedGroup & { questions: ExtractedQuestion[] }> {
    const ranges = [
        { start: 71, end: 75 },
        { start: 76, end: 80 },
    ];
    const markers = ranges
        .map((range) => ({
            range,
            index: lines.findIndex((line) =>
                new RegExp(`^\\s*${range.start}-${range.end}\\s*[.．、]?\\s*$`).test(line)
            ),
        }))
        .filter((marker) => marker.index >= 0);

    return markers.map((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const blockLines = lines.slice(
            marker.index + 1,
            nextMarker?.index ?? lines.length
        );
        const parsed = parseMarkdownBlankBlock(
            blockLines,
            answers,
            marker.range.start,
            marker.range.end
        );

        return {
            key: `blank-${marker.range.start}-${marker.range.end}`,
            instruction: `第 ${marker.range.start}-${marker.range.end} 题：选句填空。`,
            material: parsed.material,
            questionNumbers: parsed.questions.map((question) => question.number),
            questions: parsed.questions,
        };
    });
}

function parseMarkdownComprehensionGroups(
    lines: string[],
    answers: Map<number, string>
): Array<ExtractedGroup & { questions: ExtractedQuestion[] }> {
    const rangePattern = /^\s*(\d{2})-(\d{2,3})\s*[.．、]?\s*$/;
    const markers: Array<{ start: number; end: number; index: number }> = [];

    lines.forEach((line, index) => {
        const match = line.match(rangePattern);
        if (!match) return;
        const start = Number(match[1]);
        const end = Number(match[2]);
        if (start >= 81 && end <= 100 && end > start) {
            markers.push({ start, end, index });
        }
    });

    return markers.map((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const blockLines = lines.slice(
            marker.index + 1,
            nextMarker?.index ?? lines.length
        );
        const firstQuestionIndex = blockLines.findIndex((line) =>
            new RegExp(`^\\s*${marker.start}\\s*[.．、]`).test(line)
        );
        if (firstQuestionIndex < 0) {
            throw new Error(`Unable to find question ${marker.start}`);
        }

        const material = normalizeMarkdownText(
            blockLines.slice(0, firstQuestionIndex)
        );
        const questions = parseMarkdownQuestions(
            blockLines.slice(firstQuestionIndex),
            answers,
            marker.start,
            marker.end
        );

        return {
            key: `comprehension-${marker.start}-${marker.end}`,
            instruction: `第 ${marker.start}-${marker.end} 题：请选出正确答案。`,
            material,
            questionNumbers: questions.map((question) => question.number),
            questions,
        };
    });
}

function parseMarkdownReadingGroups(
    lines: string[],
    answers: Map<number, string>
): { questions: ExtractedQuestion[]; groups: ExtractedGroup[] } {
    const clozeStart = lines.findIndex((line) => /第\s*61-70\s*题/.test(line));
    const blankStart = lines.findIndex((line) => /第\s*71-80\s*题/.test(line));
    const comprehensionStart = lines.findIndex((line) => /第\s*81-100\s*题/.test(line));
    if (clozeStart < 0 || blankStart < 0 || comprehensionStart < 0) {
        throw new Error("Unable to locate Markdown reading part boundaries");
    }

    const grammarQuestions = parseMarkdownQuestions(
        lines.slice(0, clozeStart),
        answers,
        51,
        60
    );
    const clozeQuestions = parseMarkdownQuestions(
        lines.slice(clozeStart, blankStart),
        answers,
        61,
        70
    );
    const blankGroups = parseMarkdownBlankGroups(
        lines.slice(blankStart, comprehensionStart),
        answers
    );
    const comprehensionGroups = parseMarkdownComprehensionGroups(
        lines.slice(comprehensionStart),
        answers
    );

    const groups: ExtractedGroup[] = [
        {
            key: "grammar",
            instruction: "第 51-60 题：请选出有语病的一项。",
            questionNumbers: grammarQuestions.map((question) => question.number),
            payload: { partNumber: 1 },
        },
        {
            key: "cloze",
            instruction: "第 61-70 题：选词填空。",
            questionNumbers: clozeQuestions.map((question) => question.number),
            payload: { partNumber: 2 },
        },
        ...blankGroups.map(({ questions, ...group }) => ({
            ...group,
            payload: { partNumber: 3 },
        })),
        ...comprehensionGroups.map(({ questions, ...group }) => ({
            ...group,
            payload: { partNumber: 4 },
        })),
    ];

    const questions = [
        ...grammarQuestions,
        ...clozeQuestions,
        ...blankGroups.flatMap((group) => group.questions),
        ...comprehensionGroups.flatMap((group) => group.questions),
    ].sort((a, b) => a.number - b.number);

    return { questions, groups };
}

function parseH61332Markdown(
    source: PaperSource,
    text: string,
    answers: Map<number, string>
): ExtractedPaper {
    const lines = text.split(/\r?\n/);
    const listeningStart = lines.findIndex((line) => /一、\s*听\s*力/.test(line));
    const readingStart = lines.findIndex((line) => /二、\s*阅\s*读/.test(line));
    const writingStart = lines.findIndex((line) => /三、\s*书\s*写/.test(line));
    if (listeningStart < 0 || readingStart < 0 || writingStart < 0) {
        throw new Error("Unable to locate Markdown sections");
    }

    const listeningQuestions = parseMarkdownQuestions(
        lines.slice(listeningStart, readingStart),
        answers,
        1,
        50
    );
    const reading = parseMarkdownReadingGroups(
        lines.slice(readingStart, writingStart),
        answers
    );
    const essay = parseEssay(lines.slice(writingStart));
    const writingMaterial = String(
        (essay.payload as Record<string, unknown>).material ?? ""
    );

    return {
        paper_type: "past",
        title: source.title,
        year: source.year,
        session: source.code,
        duration_seconds: 8400,
        total_score: 300,
        passing_score: 180,
        sections: [
            {
                code: "listening",
                title: "听力",
                duration_seconds: 2100,
                questions: listeningQuestions,
                groups: [
                    {
                        key: "main",
                        instruction: "听力",
                        questionNumbers: listeningQuestions.map(
                            (question) => question.number
                        ),
                        payload: buildListeningGroupPayload(listeningQuestions),
                    },
                ],
            },
            {
                code: "reading",
                title: "阅读",
                duration_seconds: 3000,
                questions: reading.questions,
                groups: reading.groups,
            },
            {
                code: "writing",
                title: "书写",
                duration_seconds: 2700,
                questions: [essay],
                groups: [
                    {
                        key: "summary",
                        instruction: "第 101 题：缩写。",
                        material: writingMaterial,
                        questionNumbers: [101],
                    },
                ],
            },
        ],
        assets: source.audioPath
            ? [
                  {
                      id: `asset-${source.code}-audio`,
                      asset_type: "audio",
                      storage_key: source.audioPath,
                      url: `/api/papers/paper-${source.code}/assets/asset-${source.code}-audio`,
                      mime_type: source.audioMime ?? "audio/mpeg",
                      usage: "full_listening_audio",
                      duration_ms: source.durationMs,
                  },
              ]
            : [],
    };
}

function findLineIndex(lines: string[], pattern: RegExp): number {
    return lines.findIndex((line) => pattern.test(line));
}

function cleanMaterial(lines: string[]): string {
    return lines
        .map((line) => normalizeText(line))
        .filter((line) => line && !/[H了]?\d{5}\s*-\s*\d+/.test(line))
        .join("\n");
}

function parseBlankBlock(
    lines: string[],
    answers: Map<number, string>,
    startNumber: number,
    endNumber: number
): { questions: ExtractedQuestion[]; material: string } {
    const cleanedLines = lines
        .map((line) => normalizeText(line))
        .filter((line) => line && !/[H了]?\d{5}\s*-\s*\d+/.test(line));
    const optionLines = cleanedLines.slice(-5);
    const passageLines = cleanedLines.slice(0, -5);
    const options = optionLines.map((line, index) => ({
        key: String.fromCharCode(65 + index),
        text: line.replace(/^[A-Za-z\u4e00-\u9fff]\s*/, "").trim(),
    }));

    const text = passageLines.join("\n");
    const sentences = text
        .replace(/\n/g, " ")
        .split(/(?<=[。！？；])/)
        .map((sentence) => normalizeText(sentence))
        .filter(Boolean)
        .flatMap(sentence => splitSentenceByBlankMarkers(sentence, startNumber, endNumber));

    const questions: ExtractedQuestion[] = [];
    for (let number = startNumber; number <= endNumber; number += 1) {
        const sentence = sentences.find(
            (value) => value.includes(`(${number})`) || value.includes(`（${number}）`)
        );
        questions.push({
            number,
            question_type: "single_choice",
            stem: sentence ?? "选句填空",
            payload: { options },
            answer: { value: answers.get(number) ?? "" },
            score: 2,
        });
    }

    return { questions, material: cleanMaterial(passageLines) };
}

function parseBlankGroups(
    lines: string[],
    answers: Map<number, string>
): Array<ExtractedGroup & { questions: ExtractedQuestion[] }> {
    const ranges = [
        { start: 71, end: 75 },
        { start: 76, end: 80 },
    ];
    const markers = ranges
        .map((range) => ({
            range,
            index: findLineIndex(
                lines,
                new RegExp(`^\\s*${range.start}-${range.end}\\s*[.．、]?\\s*$`)
            ),
        }))
        .filter((marker) => marker.index >= 0);

    return markers.map((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const blockLines = lines.slice(
            marker.index + 1,
            nextMarker?.index ?? lines.length
        );
        const parsed = parseBlankBlock(
            blockLines,
            answers,
            marker.range.start,
            marker.range.end
        );

        return {
            key: `blank-${marker.range.start}-${marker.range.end}`,
            instruction: `第 ${marker.range.start}-${marker.range.end} 题：选句填空。`,
            material: parsed.material,
            questionNumbers: parsed.questions.map((question) => question.number),
            questions: parsed.questions,
        };
    });
}

function parseComprehensionGroups(
    lines: string[],
    answers: Map<number, string>
): Array<ExtractedGroup & { questions: ExtractedQuestion[] }> {
    const rangePattern = /^\s*(\d{2})-(\d{2,3})\s*[.．、]?\s*$/;
    const markers: Array<{ start: number; end: number; index: number }> = [];

    lines.forEach((line, index) => {
        const match = line.match(rangePattern);
        if (!match) return;
        const start = Number(match[1]);
        const end = Number(match[2]);
        if (start >= 81 && end <= 100 && end > start) {
            markers.push({ start, end, index });
        }
    });

    return markers.map((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const blockLines = lines.slice(
            marker.index + 1,
            nextMarker?.index ?? lines.length
        );
        const firstQuestionIndex = blockLines.findIndex((line) =>
            new RegExp(`^\\s*${marker.start}\\s*[.．、,，]`).test(line)
        );
        const safeQuestionIndex = firstQuestionIndex >= 0 ? firstQuestionIndex : 0;
        const material = cleanMaterial(blockLines.slice(0, safeQuestionIndex));
        const questions = parseChoiceQuestions(
            blockLines.slice(safeQuestionIndex),
            answers
        ).filter(
            (question) =>
                question.number >= marker.start && question.number <= marker.end
        );

        return {
            key: `comprehension-${marker.start}-${marker.end}`,
            instruction: `第 ${marker.start}-${marker.end} 题：请选出正确答案。`,
            material,
            questionNumbers: questions.map((question) => question.number),
            questions,
        };
    });
}

function parseReadingGroups(
    lines: string[],
    answers: Map<number, string>
): { questions: ExtractedQuestion[]; groups: ExtractedGroup[] } {
    const clozeStart = findLineIndex(lines, /第\s*.{0,12}61-70\s*题/);
    const blankStart = findLineIndex(lines, /第\s*.{0,12}71-80\s*题/);
    const comprehensionStart = findLineIndex(lines, /第\s*.{0,12}81-100\s*题/);

    if (clozeStart < 0 || blankStart < 0 || comprehensionStart < 0) {
        throw new Error("Unable to locate HSK reading part boundaries");
    }

    const grammarQuestions = parseChoiceQuestions(
        lines.slice(0, clozeStart),
        answers
    ).filter((question) => question.number >= 51 && question.number <= 60);
    const clozeQuestions = parseChoiceQuestions(
        lines.slice(clozeStart, blankStart),
        answers
    ).filter((question) => question.number >= 61 && question.number <= 70);
    const blankGroups = parseBlankGroups(
        lines.slice(blankStart, comprehensionStart),
        answers
    );
    const comprehensionGroups = parseComprehensionGroups(
        lines.slice(comprehensionStart),
        answers
    );

    const groups: ExtractedGroup[] = [
        {
            key: "grammar",
            instruction: "第 51-60 题：请选出有语病的一项。",
            questionNumbers: grammarQuestions.map((question) => question.number),
            payload: { partNumber: 1 },
        },
        {
            key: "cloze",
            instruction: "第 61-70 题：选词填空。",
            questionNumbers: clozeQuestions.map((question) => question.number),
            payload: { partNumber: 2 },
        },
        ...blankGroups.map(({ questions, ...group }) => ({
            ...group,
            payload: { partNumber: 3 },
        })),
        ...comprehensionGroups.map(({ questions, ...group }) => ({
            ...group,
            payload: { partNumber: 4 },
        })),
    ];

    const questions = [
        ...grammarQuestions,
        ...clozeQuestions,
        ...blankGroups.flatMap((group) => group.questions),
        ...comprehensionGroups.flatMap((group) => group.questions),
    ].sort((a, b) => a.number - b.number);

    return { questions, groups };
}

function extractPaper(source: PaperSource): ExtractedPaper {
    const text = readFileSync(resolve(PROJECT_ROOT, source.textPath), "utf8");
    const answerText = readFileSync(resolve(PROJECT_ROOT, source.answerPath), "utf8");
    const answers = parseAnswers(answerText);
    if (source.textPath.endsWith(".md")) {
        return parseH61332Markdown(source, text, answers);
    }

    const sections = splitSections(text);

    const listeningQuestions = parseChoiceQuestions(sections.listening, answers)
        .filter(question => question.number <= 50);

    const reading = parseReadingGroups(sections.reading, answers);

    const essay = parseEssay(sections.writing);
    const writingMaterial = String(
        (essay.payload as Record<string, unknown>).material ?? ""
    );

    return {
        paper_type: "past",
        title: source.title,
        year: source.year,
        session: source.code,
        duration_seconds: 8400,
        total_score: 300,
        passing_score: 180,
        sections: [
            {
                code: "listening",
                title: "听力",
                duration_seconds: 2100,
                questions: listeningQuestions,
                groups: [
                    {
                        key: "main",
                        instruction: "听力",
                        questionNumbers: listeningQuestions.map(
                            (question) => question.number
                        ),
                        payload: buildListeningGroupPayload(listeningQuestions),
                    },
                ],
            },
            {
                code: "reading",
                title: "阅读",
                duration_seconds: 3000,
                questions: reading.questions,
                groups: reading.groups,
            },
            {
                code: "writing",
                title: "书写",
                duration_seconds: 2700,
                questions: [essay],
                groups: [
                    {
                        key: "summary",
                        instruction: "第 101 题：缩写。",
                        material: writingMaterial,
                        questionNumbers: [101],
                    },
                ],
            },
        ],
        assets: source.audioPath
            ? [
                  {
                      id: `asset-${source.code}-audio`,
                      asset_type: "audio",
                      storage_key: source.audioPath,
                      url: `/api/papers/paper-${source.code}/assets/asset-${source.code}-audio`,
                      mime_type: source.audioMime ?? "audio/mpeg",
                      usage: "full_listening_audio",
                      duration_ms: source.durationMs,
                  },
              ]
            : [],
    };
}

function main(): void {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const source of SOURCES) {
        const paper = extractPaper(source);
        const outputPath = resolve(OUTPUT_DIR, `${source.code}.json`);
        writeFileSync(outputPath, JSON.stringify(paper, null, 2));
        const counts = paper.sections.map(section => `${section.code}:${section.questions.length}`);
        console.log(`${source.code}: ${counts.join(", ")}`);
    }
}

main();
