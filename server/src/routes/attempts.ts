import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    getAttemptDetail,
    getAttemptReport,
    saveAnswers,
    startAttempt,
    submitAttemptNow,
    updateSectionTiming,
} from "../services/attemptService.js";
import { insertAudioEvent } from "../repositories/audioEventRepository.js";
import { getAssetById } from "../repositories/assetRepository.js";
import { getAttemptOwnership } from "../repositories/attemptRepository.js";
import { hasValidSubscription } from "../repositories/subscriptionRepository.js";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const MIME_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function createAttemptRouter(db: AppDatabase): Router {
    const router = Router();

    // POST /api/papers/:paperId/attempts — start attempt
    router.post("/papers/:paperId/attempts", (req, res) => {
        const userId = res.locals.userId as string;
        const paperId = req.params.paperId;
        const mode = typeof req.body?.mode === "string" ? req.body.mode : "exam";
        try {
            const attemptId = startAttempt(db, paperId, userId, mode);
            res.status(201).json({ data: { attemptId } });
        } catch (error) {
            if (
                error instanceof HttpError &&
                error.code === "ATTEMPT_IN_PROGRESS" &&
                typeof error.details?.attemptId === "string"
            ) {
                res.status(200).json({ data: { attemptId: error.details.attemptId } });
                return;
            }
            throw error;
        }
    });

    // GET /api/attempts/:attemptId — get attempt state
    router.get("/attempts/:attemptId", (req, res) => {
        const userId = res.locals.userId as string;
        const detail = getAttemptDetail(db, req.params.attemptId, userId);
        res.json({ data: detail });
    });

    // PATCH /api/attempts/:attemptId/answers — auto-save answers
    router.patch("/attempts/:attemptId/answers", (req, res) => {
        const userId = res.locals.userId as string;
        const answers = (req.body?.answers ?? {}) as Record<string, unknown>;
        saveAnswers(db, req.params.attemptId, userId, answers);
        res.json({ data: { saved: Object.keys(answers).length } });
    });

    // POST /api/attempts/:attemptId/submit — submit and grade
    router.post("/attempts/:attemptId/submit", (req, res) => {
        const userId = res.locals.userId as string;
        const durationUsed = typeof req.body?.durationUsedSeconds === "number"
            ? req.body.durationUsedSeconds
            : 0;
        submitAttemptNow(db, req.params.attemptId, userId, durationUsed);
        res.json({ data: { submitted: true } });
    });

    // GET /api/attempts/:attemptId/report — get graded report
    router.get("/attempts/:attemptId/report", (req, res) => {
        const userId = res.locals.userId as string;
        const report = getAttemptReport(db, req.params.attemptId, userId);
        res.json({ data: report });
    });

    // PATCH /api/attempts/:attemptId/sections/:sectionId — update section timing
    router.patch("/attempts/:attemptId/sections/:sectionId", (req, res) => {
        const userId = res.locals.userId as string;
        const { attemptId, sectionId } = req.params;
        const status = typeof req.body?.status === "string" ? req.body.status : "active";
        const remaining = typeof req.body?.remainingSeconds === "number" ? req.body.remainingSeconds : undefined;
        updateSectionTiming(db, attemptId, userId, sectionId, status, remaining);
        res.json({ data: { updated: true } });
    });

    // POST /api/attempts/:attemptId/audio-events — record audio play/pause/ended
    router.post("/attempts/:attemptId/audio-events", (req, res) => {
        const userId = res.locals.userId as string;
        const { attemptId } = req.params;
        const ownership = getAttemptOwnership(db, attemptId);
        if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
        if (ownership.user_id !== userId) {
            throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
        }
        if (ownership.status !== "in_progress") {
            throw new HttpError(400, "ATTEMPT_LOCKED", "Cannot record audio events for a submitted attempt");
        }
        const body = req.body as Record<string, unknown>;
        const assetId = typeof body.assetId === "string" ? body.assetId : "";
        const materialId = typeof body.materialId === "string" ? body.materialId : null;
        const eventType = typeof body.eventType === "string" ? body.eventType : "";
        const positionMs = typeof body.positionMs === "number" ? body.positionMs : 0;
        if (!assetId || !eventType) {
            throw new HttpError(400, "INVALID_INPUT", "assetId and eventType are required");
        }
        insertAudioEvent(db, {
            attemptId,
            assetId,
            materialId,
            eventType,
            playedAt: new Date().toISOString(),
            positionMs,
        });
        res.status(201).json({ data: { recorded: true } });
    });

    // GET /api/attempts/:attemptId/assets/:assetId — serve audio with Range support
    router.get("/attempts/:attemptId/assets/:assetId", asyncHandler(async (req, res) => {
        const userId = res.locals.userId as string;
        const { attemptId, assetId } = req.params;

        const ownership = getAttemptOwnership(db, attemptId);
        if (!ownership) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
        if (ownership.user_id !== userId) {
            throw new HttpError(403, "FORBIDDEN", "You do not own this attempt");
        }
        if (!hasValidSubscription(db, userId, ownership.bank_id)) {
            throw new HttpError(403, "NO_SUBSCRIPTION", "Subscription expired");
        }

        const asset = getAssetById(db, assetId);
        if (!asset) throw new HttpError(404, "ASSET_NOT_FOUND", "Asset not found");

        const filePath = resolve(PROJECT_ROOT, asset.storage_key);
        let fileStat;
        try {
            fileStat = await stat(filePath);
        } catch {
            throw new HttpError(404, "ASSET_FILE_MISSING", "Asset file not found on disk");
        }

        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_MAP[ext] ?? asset.mime_type ?? "application/octet-stream";
        const range = req.headers.range;

        if (range) {
            const match = /bytes=(\d+)-(\d*)/.exec(range);
            if (match) {
                const start = parseInt(match[1], 10);
                const end = match[2] ? parseInt(match[2], 10) : fileStat.size - 1;
                res.status(206);
                res.setHeader("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Length", end - start + 1);
                res.setHeader("Content-Type", contentType);
                createReadStream(filePath, { start, end }).pipe(res);
                return;
            }
        }

        res.setHeader("Content-Length", fileStat.size);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        createReadStream(filePath).pipe(res);
    }));

    return router;
}
