import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

export function insertAudioEvent(
    db: AppDatabase,
    params: {
        attemptId: string;
        assetId: string;
        materialId: string | null;
        eventType: string;
        playedAt: string;
        positionMs: number;
    }
): string {
    const id = `audio-evt-${randomUUID()}`;
    db.prepare(
        `INSERT INTO attempt_audio_events
            (id, attempt_id, asset_id, material_id, event_type, played_at, position_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.attemptId,
        params.assetId,
        params.materialId,
        params.eventType,
        params.playedAt,
        params.positionMs
    );
    return id;
}

export function countPlayEvents(
    db: AppDatabase,
    attemptId: string,
    assetId: string
): number {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS count
             FROM attempt_audio_events
             WHERE attempt_id = ? AND asset_id = ? AND event_type = 'play'`
        )
        .get(attemptId, assetId) as { count: number };
    return row.count;
}

export function listAudioEvents(
    db: AppDatabase,
    attemptId: string
): Array<Record<string, unknown>> {
    return db
        .prepare(
            `SELECT * FROM attempt_audio_events WHERE attempt_id = ? ORDER BY played_at`
        )
        .all(attemptId) as Array<Record<string, unknown>>;
}

