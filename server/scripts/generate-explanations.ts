#!/usr/bin/env npx tsx
/**
 * Generate reference explanations for all imported HSK papers.
 *
 * Usage:
 *   npx tsx server/scripts/generate-explanations.ts
 *
 * Reads data/imported/*.json, adds `explanation` to every question,
 * writes back, and prints per-paper statistics.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ExtractedOption { key: string; text: string; }

interface ExtractedQuestion {
    number: number;
    question_type: "single_choice" | "essay";
    stem: string;
    payload: Record<string, unknown>;
    answer: Record<string, unknown>;
    explanation?: string;
    score: number;
}

interface ExtractedGroup {
    key: string;
    instruction: string;
    material?: string;
    questionNumbers: number[];
    payload?: Record<string, unknown>;
}

interface ExtractedSection {
    code: "listening" | "reading" | "writing";
    title: string;
    duration_seconds: number;
    questions: ExtractedQuestion[];
    groups: ExtractedGroup[];
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
    assets: Array<Record<string, unknown>>;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PAPERS = ["h61332", "h61438", "h61551", "h61552"];

function getAnswerValue(q: ExtractedQuestion): string {
    const v = (q.answer as { value?: string }).value;
    return typeof v === "string" ? v : "?";
}

function getAnswerText(q: ExtractedQuestion): string {
    const key = getAnswerValue(q);
    const opts = (q.payload as { options?: ExtractedOption[] }).options;
    const found = opts?.find(o => o.key === key);
    return found?.text ?? "";
}

function findMaterial(
    sections: ExtractedSection[],
    sectionCode: string,
    questionNumber: number
): string | undefined {
    const sec = sections.find(s => s.code === sectionCode);
    if (!sec) return undefined;
    const group = sec.groups.find(g => g.questionNumbers.includes(questionNumber));
    return group?.material;
}

/**
 * Try to find the sentence in the material that best supports the answer.
 * Uses keyword overlap between the question stem / answer text and material sentences.
 */
function findSupportingSentence(material: string, stem: string, answerText: string): string | undefined {
    if (!material) return undefined;
    const sentences = material
        .split(/[。！？；\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

    if (sentences.length === 0) return undefined;

    const stemKeywords = extractKeywords(stem);
    const answerKeywords = extractKeywords(answerText);
    const allKeywords = new Set([...stemKeywords, ...answerKeywords]);

    let bestSentence = "";
    let bestScore = 0;
    for (const sentence of sentences) {
        const sentenceKeywords = extractKeywords(sentence);
        let score = 0;
        for (const kw of allKeywords) {
            if (sentenceKeywords.has(kw)) score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            bestSentence = sentence;
        }
    }
    return bestScore >= 2 ? bestSentence : undefined;
}

function extractKeywords(text: string): Set<string> {
    // Extract meaningful Chinese words (2+ chars) and keywords
    const words = new Set<string>();
    // Match Chinese words of 2-4 characters
    const cnMatches = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    cnMatches.forEach(w => words.add(w));
    // Match numbers and English words
    const enMatches = text.match(/[A-Za-z]{3,}|\d+/g) || [];
    enMatches.forEach(w => words.add(w.toLowerCase()));
    return words;
}

function generateListeningExplanation(q: ExtractedQuestion): string {
    const ans = getAnswerValue(q);
    const ansText = getAnswerText(q);
    const part = q.number <= 15 ? "第一部分" : q.number <= 30 ? "第二部分" : "第三部分";
    const partHint = q.number <= 15
        ? "第一部分要求选出与所听内容一致的一项，请仔细比对各选项与录音内容的细微差别。"
        : "请根据对话或独白内容选出正确答案，注意抓住关键信息。";

    return `正确答案是 ${ans}。本题属于听力${part}。${partHint}选项 ${ans}「${ansText}」与录音内容一致。`;
}

function generateGrammarExplanation(q: ExtractedQuestion): string {
    const ans = getAnswerValue(q);
    const ansText = getAnswerText(q);
    return `正确答案是 ${ans}。本题考查语病辨析，要求选出有语病的一项。选项 ${ans}「${ansText}」存在搭配不当、成分残缺或语序问题，其余选项表达规范。`;
}

function generateClozeExplanation(q: ExtractedQuestion): string {
    const ans = getAnswerValue(q);
    const ansText = getAnswerText(q);
    const stemSnippet = q.stem.length > 50 ? q.stem.substring(0, 50) + "…" : q.stem;
    return `正确答案是 ${ans}。本题考查选词填空。根据句意「${stemSnippet}」，空格处应填入「${ansText}」，使句子搭配得当、语义通顺。`;
}

function generateBlankFillExplanation(q: ExtractedQuestion, material?: string): string {
    const ans = getAnswerValue(q);
    const ansText = getAnswerText(q);
    const supporting = findSupportingSentence(material || "", q.stem, ansText);
    const evidence = supporting ? `原文相关内容：「${supporting}」。` : "";
    return `正确答案是 ${ans}。本题考查选句填空，需要根据上下文逻辑选填。将「${ansText}」填入空格后，前后文语义连贯、逻辑通顺。${evidence}`;
}

function generateComprehensionExplanation(q: ExtractedQuestion, material?: string): string {
    const ans = getAnswerValue(q);
    const ansText = getAnswerText(q);
    const supporting = findSupportingSentence(material || "", q.stem, ansText);
    const evidence = supporting
        ? `原文依据：「${supporting}」。由此可以判断选项 ${ans}「${ansText}」正确。`
        : `根据文章内容，选项 ${ans}「${ansText}」与原文描述一致。`;
    return `正确答案是 ${ans}。本题考查阅读理解。${evidence}`;
}

function generateEssayExplanation(q: ExtractedQuestion): string {
    const payload = q.payload as {
        task_type?: string;
        reading_minutes?: number;
        writing_minutes?: number;
        target_length?: number;
    };
    const target = payload.target_length ?? 400;
    const readMin = payload.reading_minutes ?? 10;
    const writeMin = payload.writing_minutes ?? 35;
    return `本题要求在 ${readMin} 分钟内阅读一篇约 1100 字的文章，然后在 ${writeMin} 分钟内缩写成 ${target} 字左右的短文。标题自拟，只需复述文章内容，不需加入自己的观点。评分标准：内容覆盖 40%、语言准确 30%、结构连贯 30%。`;
}

function generateExplanation(
    q: ExtractedQuestion,
    sections: ExtractedSection[]
): string {
    const material = findMaterial(sections, "reading", q.number);

    if (q.question_type === "essay") {
        return generateEssayExplanation(q);
    }

    // Listening Q1-50
    if (q.number <= 50) {
        return generateListeningExplanation(q);
    }

    // Reading Q51-60: grammar (选出有语病的一项)
    if (q.number >= 51 && q.number <= 60) {
        return generateGrammarExplanation(q);
    }

    // Reading Q61-70: cloze (选词填空)
    if (q.number >= 61 && q.number <= 70) {
        return generateClozeExplanation(q);
    }

    // Reading Q71-80: blank-fill (选句填空)
    if (q.number >= 71 && q.number <= 80) {
        return generateBlankFillExplanation(q, material);
    }

    // Reading Q81-100: comprehension (阅读理解)
    if (q.number >= 81 && q.number <= 100) {
        return generateComprehensionExplanation(q, material);
    }

    return `正确答案是 ${getAnswerValue(q)}。`;
}

function main(): void {
    for (const session of PAPERS) {
        const jsonPath = resolve(PROJECT_ROOT, `data/imported/${session}.json`);
        const paper = JSON.parse(readFileSync(jsonPath, "utf8")) as ExtractedPaper;

        let generated = 0;
        for (const section of paper.sections) {
            for (const question of section.questions) {
                question.explanation = generateExplanation(question, paper.sections);
                if (question.explanation) generated += 1;
            }
        }

        writeFileSync(jsonPath, JSON.stringify(paper, null, 2));
        const total = paper.sections.reduce((sum, s) => sum + s.questions.length, 0);
        console.log(`${session}: generated ${generated}/${total} explanations`);
    }
}

main();
