import type { AppDatabase } from "../db/connection.js";
import {
    getBankLevelByPaper,
    getMaterialById,
    getPaper,
    getPaperQuestions,
    getQuestionGroupVersionsByPaper,
    getSectionsByPaper,
    hasPaperAccess,
    listPublishedPapersByBank,
} from "../repositories/paperRepository.js";
import { listMaterialAssets } from "../repositories/assetRepository.js";
import { hasValidSubscription } from "../repositories/subscriptionRepository.js";
import { HttpError } from "../utils/httpError.js";

export function listPapersForBank(
    db: AppDatabase,
    bankId: string,
    userId: string
) {
    if (!hasValidSubscription(db, userId, bankId)) {
        throw new HttpError(403, "NO_SUBSCRIPTION", "You do not have an active subscription for this bank");
    }
    const papers = listPublishedPapersByBank(db, bankId);
    return papers.map((p) => ({
        id: p.id,
        paper_type: p.paper_type,
        year: p.year,
        session: p.session,
        title: p.title,
        duration_seconds: p.duration_seconds,
        total_score: p.total_score,
        passing_score: p.passing_score,
        status: p.status,
    }));
}

export function getPaperDetail(
    db: AppDatabase,
    paperId: string,
    userId: string
) {
    const paper = getPaper(db, paperId);
    if (!paper) {
        throw new HttpError(404, "PAPER_NOT_FOUND", "Paper not found");
    }
    if (paper.status !== "published") {
        throw new HttpError(403, "PAPER_NOT_PUBLISHED", "Paper is not published");
    }
    if (!hasPaperAccess(db, paperId, userId)) {
        throw new HttpError(403, "NO_SUBSCRIPTION", "You do not have an active subscription for this bank");
    }

    const bankInfo = getBankLevelByPaper(db, paperId);
    const sections = getSectionsByPaper(db, paperId);
    const questions = getPaperQuestions(db, paperId);
    const groupVersions = getQuestionGroupVersionsByPaper(db, paperId);

    // Build a map of group version ID -> group version payload (with material)
    const groupMap = new Map<string, unknown>();
    for (const gv of groupVersions) {
        let material: unknown = null;
        if (gv.material_id) {
            const mat = getMaterialById(db, gv.material_id);
            if (mat) {
                const audioAsset = listMaterialAssets(db, mat.id)
                    .find((asset) => asset.asset_type === "audio");
                material = {
                    id: mat.id,
                    type: mat.material_type,
                    title: mat.title,
                    text_content: mat.text_content,
                    audio: audioAsset
                        ? {
                            assetId: audioAsset.id,
                            playLimit: audioAsset.play_limit ?? 1,
                            startMs: audioAsset.start_ms ?? undefined,
                            endMs: audioAsset.end_ms ?? undefined,
                        }
                        : undefined,
                    // transcript is NOT returned to the student before submission
                };
            }
        }
        groupMap.set(gv.id, {
            id: gv.id,
            type: gv.group_type,
            instruction: gv.instruction,
            material,
            payload: safeParseJson(gv.payload_json),
        });
    }

    // Group questions by section, then by group version
    const sectionsWithContent = sections.map((section) => {
        const sectionQuestions = questions.filter((q) => q.section_id === section.id);

        // Group questions by question_group_version_id
        const groupsMap = new Map<string | null, typeof sectionQuestions>();
        for (const q of sectionQuestions) {
            const gvid = q.question_group_version_id;
            if (!groupsMap.has(gvid)) groupsMap.set(gvid, []);
            groupsMap.get(gvid)!.push(q);
        }

        const groups: unknown[] = [];
        for (const [gvId, qs] of groupsMap) {
            const groupInfo = gvId ? groupMap.get(gvId) : null;
            groups.push({
                ...(groupInfo ?? {}),
                questions: qs.map((q) => ({
                    id: q.id,
                    display_order: q.display_order,
                    score: q.score,
                    question_type: q.question_type,
                    stem: q.stem,
                    difficulty: q.difficulty,
                    payload: normalizeQuestionPayload(safeParseJson(q.payload_json)),
                    // answer_json and explanation are NOT returned before submission
                    is_enabled: q.is_enabled === 1,
                })),
            });
        }

        return {
            id: section.id,
            code: section.code,
            title: section.title,
            display_order: section.display_order,
            duration_seconds: section.duration_seconds,
            groups,
        };
    });

    return {
        id: paper.id,
        bank_id: paper.bank_id,
        level: bankInfo?.level ?? null,
        paper_type: paper.paper_type,
        year: paper.year,
        session: paper.session,
        title: paper.title,
        duration_seconds: paper.duration_seconds,
        total_score: paper.total_score,
        passing_score: paper.passing_score,
        sections: sectionsWithContent,
    };
}

function safeParseJson(json: string): unknown {
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function normalizeQuestionPayload(payload: unknown): unknown {
    if (Array.isArray(payload)) {
        return payload.map(normalizeQuestionPayload);
    }
    if (payload === null || typeof payload !== "object") {
        return payload;
    }
    return Object.fromEntries(
        Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
            key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
            normalizeQuestionPayload(value),
        ])
    );
}
