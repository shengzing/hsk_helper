#!/usr/bin/env node --import tsx
/**
 * Extract individual HSK1 question/option images and map them to answers.
 *
 * Usage:
 *   node --import tsx server/scripts/extract-image-answers.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_ROOT = join(PROJECT_ROOT, "data");
const HSK1_ROOT = join(DATA_ROOT, "HSK1级真题 34套");
const IMPORTED_DIR = join(DATA_ROOT, "imported");
const OUTPUT_DIR = join(DATA_ROOT, "image-answers");
const ASSET_ROOT = join(DATA_ROOT, "assets", "images");

const PDFTOHTML = process.env.PDFTOHTML_BIN
    ?? "/Users/jcb/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftohtml";
const PDFTOPPM = process.env.PDFTOPPM_BIN
    ?? "/Users/jcb/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftoppm";
const MAGICK = process.env.MAGICK_BIN ?? "magick";

interface ImageBox {
    page: number;
    top: number;
    left: number;
    width: number;
    height: number;
    cx: number;
    cy: number;
}

interface TextBox {
    page: number;
    top: number;
    left: number;
    text: string;
}

interface Page {
    page: number;
    images: ImageBox[];
    texts: TextBox[];
}

interface Paper {
    code: string;
    pdf: string;
    answers: Map<number, string | boolean>;
}

interface GroupSpec {
    name: string;
    firstQuestion: number;
    questionCount: number;
    type: "true_false" | "choice3" | "choice6";
}

const GROUPS: GroupSpec[] = [
    { name: "listening-part-1", firstQuestion: 1, questionCount: 5, type: "true_false" },
    { name: "listening-part-2", firstQuestion: 6, questionCount: 5, type: "choice3" },
    { name: "listening-part-3", firstQuestion: 11, questionCount: 5, type: "choice6" },
    { name: "listening-part-4", firstQuestion: 16, questionCount: 5, type: "true_false" },
    { name: "reading-part-1", firstQuestion: 21, questionCount: 5, type: "true_false" },
    { name: "reading-part-2", firstQuestion: 26, questionCount: 5, type: "choice6" },
    { name: "reading-part-3", firstQuestion: 31, questionCount: 5, type: "choice6" },
    { name: "reading-part-4", firstQuestion: 36, questionCount: 5, type: "choice6" },
];

function dirname(url: string): string {
    return url.slice(0, url.lastIndexOf("/"));
}

function run(command: string, args: string[]): void {
    execFileSync(command, args, { stdio: "ignore" });
}

function normalize(value: string): string {
    return value.replace(/\s+/g, "");
}

function parseXml(xml: string): Page[] {
    return [...xml.matchAll(/<page number="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)]
        .map(([, page, body]) => {
            const images = [...body.matchAll(/<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>/g)]
                .map((match) => {
                    const top = Number(match[1]);
                    const left = Number(match[2]);
                    const width = Number(match[3]);
                    const height = Number(match[4]);
                    return { page: Number(page), top, left, width, height, cx: left + width / 2, cy: top + height / 2 };
                });
            const texts = [...body.matchAll(/<text top="(\d+)" left="(\d+)"[^>]*>([^<]*)<\/text>/g)]
                .map((match) => ({
                    page: Number(page),
                    top: Number(match[1]),
                    left: Number(match[2]),
                    text: match[3].trim(),
                }));
            return { page: Number(page), images, texts };
        });
}

function findMainPdf(dir: string): string | null {
    const files = readdirSync(dir).filter((file) => /\.pdf$/i.test(file));
    const candidates = files.filter((file) => !/答案|Loesung|听力|Transkript/i.test(file));
    if (candidates.length === 0) return files[0] ? join(dir, files[0]) : null;
    return join(dir, candidates.sort((a, b) => b.length - a.length)[0] ?? "");
}

function answerMap(jsonPath: string): Map<number, string | boolean> {
    const paper = JSON.parse(readFileSync(jsonPath, "utf8"));
    const answers = new Map<number, string | boolean>();
    for (const section of paper.sections) {
        for (const question of section.questions) {
            answers.set(question.number, question.answer.value);
        }
    }
    return answers;
}

function pageOfQuestion(pages: Page[], question: number): number | null {
    for (const page of pages) {
        if (page.texts.some((text) => text.text === String(question))) return page.page;
    }
    return null;
}

function groupPageRange(pages: Page[], group: GroupSpec): Array<[number, number]> {
    const firstPage = pageOfQuestion(pages, group.firstQuestion);
    if (firstPage === null) return [];
    const next = GROUPS.find((item) => item.firstQuestion === group.firstQuestion + group.questionCount);
    const nextPage = next ? pageOfQuestion(pages, next.firstQuestion) : null;
    const answerPage = pages.find((page) =>
        page.texts.some((text) => /答案|Loesung/i.test(text.text))
    )?.page ?? null;
    const lastPage = nextPage === null
        ? answerPage === null
            ? Math.max(...pages.map((page) => page.page))
            : answerPage - 1
        : nextPage - 1;
    return [[firstPage, Math.max(firstPage, lastPage)]];
}

function cropImage(pdf: string, page: number, image: ImageBox, outputPath: string): string {
    const prefix = `${outputPath.replace(/\.jpg$/i, "")}-source`;
    const source = `${prefix}.jpg`;
    mkdirSync(prefix.slice(0, prefix.lastIndexOf("/")), { recursive: true });
    if (!existsSync(source)) {
        run(PDFTOPPM, ["-jpeg", "-r", "120", "-f", String(page), "-l", String(page), "-singlefile", pdf, prefix]);
    }
    const scale = 120 / 72;
    const x = Math.max(0, Math.round(image.left * scale));
    const y = Math.max(0, Math.round(image.top * scale));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    mkdirSync(outputPath.slice(0, outputPath.lastIndexOf("/")), { recursive: true });
    run(MAGICK, [source, "-crop", `${width}x${height}+${x}+${y}`, "+repage", outputPath]);
    return outputPath;
}

function nearestImage(images: ImageBox[], target: { left: number; top: number }): ImageBox | null {
    return images
        .map((image) => ({
            image,
            distance: Math.hypot(image.cx - target.left, image.cy - target.top),
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.image ?? null;
}

function clusterColumns(images: ImageBox[], count: number): ImageBox[][] {
    const centers = [250, 450, 620];
    return images.reduce<ImageBox[][]>((columns, image) => {
        const nearest = centers
            .map((center, index) => ({ index, distance: Math.abs(image.left - center) }))
            .sort((a, b) => a.distance - b.distance)[0].index;
        columns[nearest].push(image);
        return columns;
    }, Array.from({ length: count }, () => []));
}

function extractGroup(
    pages: Page[],
    pdf: string,
    paper: Paper,
    group: GroupSpec
): Array<Record<string, unknown>> {
    const range = groupPageRange(pages, group);
    if (range.length === 0) return [];
    const [startPage, endPage] = range[0];
    const groupPages = pages.filter((page) => page.page >= startPage && page.page <= endPage);
    const images = groupPages.flatMap((page) => page.images);
    const texts = groupPages.flatMap((page) => page.texts);
    const output: Array<Record<string, unknown>> = [];

    if (group.type === "true_false") {
        const used = new Set<ImageBox>();
        for (let index = 0; index < group.questionCount; index += 1) {
            const question = group.firstQuestion + index;
            const target = texts.find((text) => text.text === String(question));
            if (!target) continue;
            const available = images.filter((image) => !used.has(image));
            const image = nearestImage(available, { left: target.left, top: target.top });
            if (!image) continue;
            used.add(image);
            const relativePath = relative(ASSET_ROOT, cropImage(
                pdf,
                image.page,
                image,
                join(ASSET_ROOT, paper.code, "individual", `${group.name}-q${question}.jpg`)
            ));
            output.push({
                group: group.name,
                question,
                answer: paper.answers.get(question) ?? null,
                image: relativePath,
            });
        }
        return output;
    }

    if (group.type === "choice3") {
        const columns = clusterColumns(images, 3);
        for (let index = 0; index < group.questionCount; index += 1) {
            const question = group.firstQuestion + index;
            const target = texts.find((text) => text.text === String(question));
            if (!target) continue;
            const optionImages = columns.map((column) => nearestImage(
                column.filter((image) => image.cy <= target.top + 30),
                { left: target.left, top: target.top }
            ));
            optionImages.forEach((image, optionIndex) => {
                if (!image) return;
                const option = String.fromCharCode(65 + optionIndex);
                const relativePath = relative(ASSET_ROOT, cropImage(
                    pdf,
                    image.page,
                    image,
                    join(ASSET_ROOT, paper.code, "individual", `${group.name}-q${question}-${option}.jpg`)
                ));
                output.push({
                    group: group.name,
                    question,
                    option,
                    is_correct: paper.answers.get(question) === option,
                    image: relativePath,
                });
            });
        }
        return output;
    }

    const labels = texts
        .filter((text) => /^[A-F]$/.test(text.text))
        .sort((a, b) => a.top - b.top || a.left - b.left);
    const uniqueLabels = labels.slice(0, 6);
    const used = new Set<ImageBox>();
    uniqueLabels.forEach((label) => {
        const available = images.filter((image) => !used.has(image));
        const image = nearestImage(available, { left: label.left, top: label.top });
        if (!image) return;
        used.add(image);
        const relativePath = relative(ASSET_ROOT, cropImage(
            pdf,
            image.page,
            image,
            join(ASSET_ROOT, paper.code, "individual", `${group.name}-${label.text}.jpg`)
        ));
        output.push({
            group: group.name,
            option: label.text,
            correct_for: Array.from({ length: group.questionCount }, (_, index) => group.firstQuestion + index)
                .filter((question) => paper.answers.get(question) === label.text),
            image: relativePath,
        });
    });
    return output;
}

function main(): void {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    mkdirSync(ASSET_ROOT, { recursive: true });
    const imported = readdirSync(IMPORTED_DIR).filter((file) => /^h1.*\.json$/.test(file));
    for (const file of imported) {
        const code = file.replace(/\.json$/, "");
        const jsonPath = join(IMPORTED_DIR, file);
        const folder = readdirSync(HSK1_ROOT).find((name) => `h${normalize(name).toLowerCase()}` === code);
        if (!folder) continue;
        const pdf = findMainPdf(join(HSK1_ROOT, folder));
        if (!pdf) continue;
        const tempXml = `/tmp/${code}-image-answers.xml`;
        run(PDFTOHTML, ["-xml", pdf, tempXml.replace(/\.xml$/, "")]);
        const pages = parseXml(readFileSync(tempXml, "utf8"));
        const paper: Paper = { code, pdf, answers: answerMap(jsonPath) };
        const result = GROUPS.flatMap((group) => extractGroup(pages, pdf, paper, group));
        const outputPath = join(OUTPUT_DIR, `${code}.individual.json`);
        writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
        console.log(`${code}: ${result.length} individual images`);
    }
}

main();
