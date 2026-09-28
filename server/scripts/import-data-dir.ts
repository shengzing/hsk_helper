#!/usr/bin/env node --import tsx
/**
 * Import extracted HSK 1/2 papers into SQLite.
 *
 * Usage:
 *   node --import tsx server/scripts/import-data-dir.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { createAppDatabase } from "../src/db/connection.js";
import { validateQuestionVersion } from "../src/schemas/question.js";

interface ExtractedQuestion {
    number: number;
    question_type: string;
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
    code: "listening" | "reading";
    title: string;
    duration_seconds: number;
    questions: ExtractedQuestion[];
    groups: ExtractedGroup[];
}

interface ExtractedAsset {
    id: string;
    asset_type: string;
    storage_key: string;
    url: string;
    mime_type: string;
    usage: string;
    duration_ms?: number;
    file_size?: number;
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
    assets: ExtractedAsset[];
}

interface IndividualImageRow {
    group: string;
    question?: number;
    option?: string;
    answer?: boolean | string;
    is_correct?: boolean;
    correct_for?: number[];
    image: string;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_ROOT = join(PROJECT_ROOT, "data");
const IMPORTED_DIR = join(DATA_ROOT, "imported");
const IMAGE_ANSWER_DIR = join(DATA_ROOT, "image-answers");
const DB_PATH = process.env.DB_PATH ?? join(DATA_ROOT, "app.db");

function listPapers(): string[] {
    return readdirSync(IMPORTED_DIR)
        .filter((file) => /^h[12].*\.json$/.test(file))
        .sort();
}

function bankFor(session: string): string {
    return session.startsWith("h1") ? "hsk-level-1" : "hsk-level-2";
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function individualRows(code: string): IndividualImageRow[] {
    const path = join(IMAGE_ANSWER_DIR, `${code}.individual.json`);
    return existsSync(path) ? readJson<IndividualImageRow[]>(path) : [];
}

function individualAssetId(code: string, row: IndividualImageRow): string {
    const suffix = row.question !== undefined
        ? `q${row.question}${row.option ? `-${row.option}` : ""}`
        : row.option ?? "image";
    return `asset-${code}-individual-${row.group}-${suffix}`;
}

function insertAsset(db: Database.Database, params: ExtractedAsset): void {
    db.prepare(`
        INSERT INTO assets (
            id, asset_type, storage_key, url, mime_type, file_size, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        params.id,
        params.asset_type,
        params.storage_key,
        params.url,
        params.mime_type,
        params.file_size ?? null,
        params.duration_ms ?? null
    );
}

function removePaper(
    db: Database.Database,
    paperId: string,
    code: string,
    bankId: string
): void {
    db.prepare("DELETE FROM attempts WHERE paper_id = ?").run(paperId);
    db.prepare("DELETE FROM import_jobs WHERE paper_id = ?").run(paperId);
    db.prepare(`
        DELETE FROM feedback
        WHERE paper_question_id IN (
            SELECT id FROM paper_questions WHERE paper_id = ?
        )
    `).run(paperId);
    db.prepare("DELETE FROM past_exam_papers WHERE id = ?").run(paperId);
    db.prepare("DELETE FROM questions WHERE bank_id = ? AND id LIKE ?")
        .run(bankId, `q-${code}-%`);
    db.prepare("DELETE FROM question_groups WHERE bank_id = ? AND id LIKE ?")
        .run(bankId, `group-${code}-%`);
    db.prepare("DELETE FROM materials WHERE bank_id = ? AND id LIKE ?")
        .run(bankId, `material-${code}-%`);
    db.prepare("DELETE FROM assets WHERE id LIKE ?").run(`asset-${code}-%`);
}

function buildIndividualAssets(
    code: string,
    rows: IndividualImageRow[]
): Array<{ asset: ExtractedAsset; row: IndividualImageRow }> {
    return rows.map((row) => {
        const id = individualAssetId(code, row);
        const storageKey = join("data/assets/images", row.image);
        const absolutePath = join(PROJECT_ROOT, storageKey);
        const usage = row.option ? "option_image" : "question_image";
        return {
            row,
            asset: {
                id,
                asset_type: "image",
                storage_key: storageKey,
                url: `/api/papers/paper-${code}/assets/${id}`,
                mime_type: "image/jpeg",
                usage,
                file_size: existsSync(absolutePath) ? statSync(absolutePath).size : undefined,
            },
        };
    });
}

function augmentGroupPayload(
    group: ExtractedGroup,
    rows: Array<{ asset: ExtractedAsset; row: IndividualImageRow }>
): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...(group.payload ?? {}) };
    const questionImages = new Map<string, string[]>();
    const questionOptionImages = new Map<string, Record<string, string>>();
    const optionImages = new Map<string, string>();

    for (const { asset, row } of rows) {
        if (row.question !== undefined) {
            const key = String(row.question);
            questionImages.set(key, [...(questionImages.get(key) ?? []), asset.id]);
            if (row.option) {
                questionOptionImages.set(key, {
                    ...(questionOptionImages.get(key) ?? {}),
                    [row.option]: asset.id,
                });
            }
        } else if (row.option) {
            optionImages.set(row.option, asset.id);
        }
    }

    if (questionImages.size > 0) {
        payload.question_image_asset_ids = Object.fromEntries(questionImages);
    }
    if (questionOptionImages.size > 0) {
        payload.question_option_image_asset_ids = Object.fromEntries(questionOptionImages);
    }
    if (optionImages.size > 0) {
        payload.option_image_asset_ids = Object.fromEntries(optionImages);
    }
    return payload;
}

function importPaper(db: Database.Database, jsonFile: string): string {
    const code = jsonFile.replace(/\.json$/, "");
    const paper = readJson<ExtractedPaper>(join(IMPORTED_DIR, jsonFile));
    const bankId = bankFor(paper.session);
    const paperId = `paper-${code}`;
    const rows = individualRows(code);
    const individual = buildIndividualAssets(code, rows);
    const rowsByGroup = new Map<string, Array<{ asset: ExtractedAsset; row: IndividualImageRow }>>();
    for (const item of individual) {
        rowsByGroup.set(item.row.group, [...(rowsByGroup.get(item.row.group) ?? []), item]);
    }

    const transaction = db.transaction(() => {
        removePaper(db, paperId, code, bankId);

        db.prepare(`
            INSERT INTO past_exam_papers (
                id, bank_id, paper_type, year, session, title,
                duration_seconds, total_score, passing_score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
        `).run(
            paperId,
            bankId,
            paper.paper_type,
            paper.year,
            paper.session,
            paper.title,
            paper.duration_seconds,
            paper.total_score,
            paper.passing_score
        );

        const allAssets = [...paper.assets, ...individual.map((item) => item.asset)];
        for (const asset of allAssets) {
            insertAsset(db, asset);
            db.prepare(`
                INSERT INTO paper_assets (
                    paper_id, asset_id, usage, display_order
                ) VALUES (?, ?, ?, 0)
            `).run(paperId, asset.id, asset.usage);
        }

        const audioAsset = paper.assets.find((asset) => asset.asset_type === "audio");

        for (const [sectionIndex, section] of paper.sections.entries()) {
            const sectionId = `section-${code}-${section.code}`;
            db.prepare(`
                INSERT INTO paper_sections (
                    id, paper_id, code, title, display_order,
                    duration_seconds, answer_transfer_seconds, scaled_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sectionId,
                paperId,
                section.code,
                section.title,
                sectionIndex + 1,
                section.duration_seconds,
                section.code === "listening" ? 180 : 0,
                100
            );

            for (const group of section.groups) {
                const groupRows = rowsByGroup.get(`${section.code}-${group.key}`) ?? [];
                const payload = augmentGroupPayload(group, groupRows);
                const materialId = `material-${code}-${section.code}-${group.key}`;
                const imageAssetIds = (payload.image_asset_ids as string[] | undefined) ?? [];
                const individualAssetIds = groupRows.map((item) => item.asset.id);
                const materialType = imageAssetIds.length > 0 || individualAssetIds.length > 0
                    ? "mixed"
                    : section.code === "listening" ? "audio" : "text";

                db.prepare(`
                    INSERT INTO materials (
                        id, bank_id, material_type, title, text_content, transcript,
                        payload_json, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')
                `).run(
                    materialId,
                    bankId,
                    materialType,
                    group.instruction,
                    group.material ?? null,
                    null,
                    JSON.stringify(payload)
                );

                const groupId = `group-${code}-${section.code}-${group.key}`;
                db.prepare(`
                    INSERT INTO question_groups (
                        id, bank_id, group_type, status
                    ) VALUES (?, ?, 'material', 'published')
                `).run(groupId, bankId);

                const groupVersionId = `qgv-${code}-${section.code}-${group.key}`;
                db.prepare(`
                    INSERT INTO question_group_versions (
                        id, question_group_id, version_number, group_type,
                        instruction, material_id, payload_json, status, is_current
                    ) VALUES (?, ?, 1, 'material', ?, ?, ?, 'published', 1)
                `).run(
                    groupVersionId,
                    groupId,
                    group.instruction,
                    materialId,
                    JSON.stringify(payload)
                );

                const groupQuestions = section.questions.filter((question) =>
                    group.questionNumbers.includes(question.number)
                );

                for (const question of groupQuestions) {
                    validateQuestionVersion(
                        question.question_type,
                        JSON.stringify(question.payload),
                        JSON.stringify(question.answer)
                    );

                    const questionId = `q-${code}-${question.number}`;
                    const questionVersionId = `qv-${code}-${question.number}`;
                    const paperQuestionId = `pq-${code}-${question.number}`;

                    db.prepare(`
                        INSERT INTO questions (
                            id, bank_id, question_group_id, status
                        ) VALUES (?, ?, ?, 'published')
                    `).run(questionId, bankId, groupId);

                    db.prepare(`
                        INSERT INTO question_versions (
                            id, question_id, version_number, question_type, stem,
                            difficulty, payload_json, answer_json, explanation, scoring_policy,
                            status, is_current, is_enabled
                        ) VALUES (?, ?, 1, ?, ?, 3, ?, ?, ?, 'exact', 'published', 1, 1)
                    `).run(
                        questionVersionId,
                        questionId,
                        question.question_type,
                        question.stem,
                        JSON.stringify(question.payload),
                        JSON.stringify(question.answer),
                        question.explanation ?? null
                    );

                    db.prepare(`
                        INSERT INTO paper_questions (
                            id, paper_id, section_id, question_id,
                            question_version_id, question_group_version_id,
                            display_order, score
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        paperQuestionId,
                        paperId,
                        sectionId,
                        questionId,
                        questionVersionId,
                        groupVersionId,
                        question.number,
                        question.score
                    );
                }

                const materialAssetRows: Array<{ assetId: string; usage: string }> = [];
                for (const assetId of imageAssetIds) {
                    materialAssetRows.push({ assetId, usage: "part_image" });
                }
                for (const item of groupRows) {
                    materialAssetRows.push({
                        assetId: item.asset.id,
                        usage: item.row.option ? "option_image" : "question_image",
                    });
                }
                for (const [index, row] of materialAssetRows.entries()) {
                    db.prepare(`
                        INSERT INTO material_assets (
                            material_id, asset_id, usage, display_order,
                            start_ms, end_ms, play_limit
                        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL)
                    `).run(materialId, row.assetId, row.usage, index);
                }

                if (section.code === "listening" && audioAsset) {
                    db.prepare(`
                        INSERT INTO material_assets (
                            material_id, asset_id, usage, display_order,
                            start_ms, end_ms, play_limit
                        ) VALUES (?, ?, 'audio', 0, NULL, NULL, 1)
                    `).run(materialId, audioAsset.id);
                }
            }
        }

        db.prepare(`
            INSERT INTO import_jobs (
                id, paper_id, bank_id, status, source_dir,
                parsed_json, operator_id, note
            ) VALUES (?, ?, ?, 'published', ?, ?, 'user-admin', ?)
        `).run(
            `import-${code}-${randomUUID()}`,
            paperId,
            bankId,
            `data/imported/${jsonFile}`,
            JSON.stringify(paper),
            `Imported from data/imported/${jsonFile}`
        );
    });

    transaction();
    return paperId;
}

function main(): void {
    const db = createAppDatabase(DB_PATH);
    try {
        const files = listPapers();
        for (const file of files) {
            const paperId = importPaper(db, file);
            const counts = db.prepare(`
                SELECT
                    COUNT(*) AS question_count,
                    SUM(CASE WHEN section.code = 'listening' THEN 1 ELSE 0 END) AS listening,
                    SUM(CASE WHEN section.code = 'reading' THEN 1 ELSE 0 END) AS reading
                FROM paper_questions pq
                INNER JOIN paper_sections section ON section.id = pq.section_id
                WHERE pq.paper_id = ?
            `).get(paperId) as Record<string, number>;
            console.log(
                `${file.replace(/\.json$/, "")}: ${counts.question_count} questions ` +
                `(L:${counts.listening}, R:${counts.reading})`
            );
        }
    } finally {
        db.close();
    }
}

main();
