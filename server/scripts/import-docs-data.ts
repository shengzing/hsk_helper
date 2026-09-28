#!/usr/bin/env node --import tsx
/**
 * Import extracted HSK 6 papers into SQLite.
 *
 * Usage:
 *   node --import tsx server/scripts/import-docs-data.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { createAppDatabase } from "../src/db/connection.js";

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

interface PaperImportSource {
    code: string;
    jsonPath: string;
    sourceFiles: string[];
    answerFile: string;
}

const SOURCES: PaperImportSource[] = [
    {
        code: "h61332",
        jsonPath: "data/imported/h61332.json",
        sourceFiles: ["docs/61332/Test.md"],
        answerFile: "docs/61332/Answers.pdf",
    },
    {
        code: "h61438",
        jsonPath: "data/imported/h61438.json",
        sourceFiles: [
            "docs/61438/H61438听力 阅读.pdf",
            "docs/61438/H61438书写.pdf",
        ],
        answerFile: "docs/61438/H61438答案.doc",
    },
    {
        code: "h61551",
        jsonPath: "data/imported/h61551.json",
        sourceFiles: ["docs/61551/H61551.pdf"],
        answerFile: "docs/61551/H61551答案.docx",
    },
    {
        code: "h61552",
        jsonPath: "data/imported/h61552.json",
        sourceFiles: ["docs/61552/H61552.pdf"],
        answerFile: "docs/61552/H61552答案.docx",
    },
];

const BANK_ID = "hsk-level-6";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DB_PATH = process.env.DB_PATH ?? resolve(PROJECT_ROOT, "data/app.db");

function insertAsset(
    db: Database.Database,
    params: {
        id: string;
        asset_type: string;
        storage_key: string;
        url: string;
        mime_type: string;
        file_size?: number;
        duration_ms?: number;
    }
): void {
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

function removePaper(db: Database.Database, paperId: string, code: string): void {
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
        .run(BANK_ID, `q-${code}-%`);
    db.prepare("DELETE FROM question_groups WHERE bank_id = ? AND id LIKE ?")
        .run(BANK_ID, `group-${code}-%`);
    db.prepare("DELETE FROM materials WHERE bank_id = ? AND id LIKE ?")
        .run(BANK_ID, `material-${code}-%`);
    db.prepare("DELETE FROM assets WHERE id LIKE ?").run(`asset-${code}-%`);
}

function importPaper(db: Database.Database, source: PaperImportSource): string {
    const paper = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, source.jsonPath), "utf8")
    ) as ExtractedPaper;
    const paperId = `paper-${source.code}`;

    const transaction = db.transaction(() => {
        removePaper(db, paperId, source.code);

        db.prepare(`
            INSERT INTO past_exam_papers (
                id, bank_id, paper_type, year, session, title,
                duration_seconds, total_score, passing_score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
        `).run(
            paperId,
            BANK_ID,
            paper.paper_type,
            paper.year,
            paper.session,
            paper.title,
            paper.duration_seconds,
            paper.total_score,
            paper.passing_score
        );

        // Listening, reading, and writing each get a material-backed group.
        for (const section of paper.sections) {
            const sectionId = `section-${source.code}-${section.code}`;
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
                section.code === "listening" ? 1 : section.code === "reading" ? 2 : 3,
                section.duration_seconds,
                section.code === "listening" ? 300 : 0,
                100
            );

            for (const group of section.groups) {
                const needsMaterial = section.code === "listening" || Boolean(group.material);
                const materialId = needsMaterial
                    ? `material-${source.code}-${section.code}-${group.key}`
                    : null;

                if (materialId) {
                    db.prepare(`
                        INSERT INTO materials (
                            id, bank_id, material_type, title, text_content, transcript,
                            payload_json, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')
                    `).run(
                        materialId,
                        BANK_ID,
                        section.code === "listening" ? "audio" : "text",
                        group.instruction,
                        section.code === "listening" ? null : group.material ?? null,
                        null,
                        JSON.stringify({}),
                    );
                }

                const groupId = `group-${source.code}-${section.code}-${group.key}`;
                db.prepare(`
                    INSERT INTO question_groups (
                        id, bank_id, group_type, status
                    ) VALUES (?, ?, 'material', 'published')
                `).run(groupId, BANK_ID);

                const groupVersionId = `qgv-${source.code}-${section.code}-${group.key}`;
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
                    JSON.stringify(group.payload ?? {})
                );

                const groupQuestions = section.questions.filter((question) =>
                    group.questionNumbers.includes(question.number)
                );

                for (const question of groupQuestions) {
                    const questionId = `q-${source.code}-${question.number}`;
                    const questionVersionId = `qv-${source.code}-${question.number}`;
                    const paperQuestionId = `pq-${source.code}-${question.number}`;

                    db.prepare(`
                        INSERT INTO questions (
                            id, bank_id, question_group_id, status
                        ) VALUES (?, ?, ?, 'published')
                    `).run(questionId, BANK_ID, groupId);

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

                if (
                    section.code === "listening" &&
                    paper.assets[0] &&
                    materialId
                ) {
                    const audio = paper.assets[0];
                    insertAsset(db, {
                        id: audio.id,
                        asset_type: audio.asset_type,
                        storage_key: audio.storage_key,
                        url: audio.url,
                        mime_type: audio.mime_type,
                        duration_ms: audio.duration_ms,
                    });
                    db.prepare(`
                        INSERT INTO paper_assets (
                            paper_id, asset_id, usage, display_order
                        ) VALUES (?, ?, ?, 0)
                    `).run(paperId, audio.id, audio.usage);

                    db.prepare(`
                        INSERT INTO material_assets (
                            material_id, asset_id, usage, display_order,
                            start_ms, end_ms, play_limit
                        ) VALUES (?, ?, 'audio', 0, NULL, NULL, 1)
                    `).run(materialId, audio.id);
                }
            }
        }

        // Preserve the source PDFs and answer keys as paper assets.
        source.sourceFiles.forEach((sourceFile, index) => {
            const assetId = `asset-${source.code}-source-${index + 1}`;
            insertAsset(db, {
                id: assetId,
                asset_type: "pdf",
                storage_key: sourceFile,
                url: `/api/papers/${paperId}/assets/${assetId}`,
                mime_type: "application/pdf",
                file_size: statSync(resolve(PROJECT_ROOT, sourceFile)).size,
            });
            db.prepare(`
                INSERT INTO paper_assets (
                    paper_id, asset_id, usage, display_order
                ) VALUES (?, ?, 'source_pdf', ?)
            `).run(paperId, assetId, index + 1);
        });

        const answerAssetId = `asset-${source.code}-answer`;
        insertAsset(db, {
            id: answerAssetId,
            asset_type: "answer_key",
            storage_key: source.answerFile,
            url: `/api/papers/${paperId}/assets/${answerAssetId}`,
            mime_type: source.answerFile.endsWith(".docx")
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/pdf",
            file_size: statSync(resolve(PROJECT_ROOT, source.answerFile)).size,
        });
        db.prepare(`
            INSERT INTO paper_assets (
                paper_id, asset_id, usage, display_order
            ) VALUES (?, ?, 'answer_key', 10)
        `).run(paperId, answerAssetId);

        // Track the import as a published job for audit and reproducibility.
        db.prepare(`
            INSERT INTO import_jobs (
                id, paper_id, bank_id, status, source_dir,
                parsed_json, operator_id, note
            ) VALUES (?, ?, ?, 'published', ?, ?, 'user-admin', ?)
        `).run(
            `import-${source.code}-${randomUUID()}`,
            paperId,
            BANK_ID,
            `docs/${source.code}`,
            JSON.stringify(paper),
            `Imported from docs/${source.code}`
        );
    });

    transaction();
    return paperId;
}

function main(): void {
    const db = createAppDatabase(DB_PATH);
    try {
        for (const source of SOURCES) {
            const paperId = importPaper(db, source);
            const counts = db.prepare(`
                SELECT
                    COUNT(*) AS question_count,
                    SUM(CASE WHEN section.code = 'listening' THEN 1 ELSE 0 END) AS listening,
                    SUM(CASE WHEN section.code = 'reading' THEN 1 ELSE 0 END) AS reading,
                    SUM(CASE WHEN section.code = 'writing' THEN 1 ELSE 0 END) AS writing
                FROM paper_questions pq
                INNER JOIN paper_sections section ON section.id = pq.section_id
                WHERE pq.paper_id = ?
            `).get(paperId) as Record<string, number>;
            console.log(
                `${source.code}: ${counts.question_count} questions ` +
                `(L:${counts.listening}, R:${counts.reading}, W:${counts.writing})`
            );
        }
    } finally {
        db.close();
    }
}

main();
