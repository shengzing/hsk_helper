import type { AppDatabase } from "../db/connection.js";

export interface AssetRow {
    id: string;
    asset_type: string;
    storage_key: string;
    url: string;
    mime_type: string | null;
    file_size: number | null;
    duration_ms: number | null;
    width: number | null;
    height: number | null;
    checksum: string | null;
    created_at: string;
}

export function getAssetById(
    db: AppDatabase,
    assetId: string
): AssetRow | undefined {
    return db
        .prepare(`SELECT * FROM assets WHERE id = ?`)
        .get(assetId) as AssetRow | undefined;
}

export function createAsset(
    db: AppDatabase,
    params: {
        id: string;
        assetType: string;
        storageKey: string;
        url: string;
        mimeType?: string | null;
        fileSize?: number | null;
        durationMs?: number | null;
        checksum?: string | null;
    }
): void {
    db.prepare(
        `INSERT INTO assets (id, asset_type, storage_key, url, mime_type, file_size, duration_ms, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        params.id,
        params.assetType,
        params.storageKey,
        params.url,
        params.mimeType ?? null,
        params.fileSize ?? null,
        params.durationMs ?? null,
        params.checksum ?? null
    );
}

export function linkPaperAsset(
    db: AppDatabase,
    paperId: string,
    assetId: string,
    usage: string,
    displayOrder: number = 0
): void {
    db.prepare(
        `INSERT OR IGNORE INTO paper_assets (paper_id, asset_id, usage, display_order)
         VALUES (?, ?, ?, ?)`
    ).run(paperId, assetId, usage, displayOrder);
}

export function linkMaterialAsset(
    db: AppDatabase,
    materialId: string,
    assetId: string,
    usage: string,
    displayOrder: number = 0,
    startMs?: number | null,
    endMs?: number | null,
    playLimit?: number | null
): void {
    db.prepare(
        `INSERT OR IGNORE INTO material_assets
            (material_id, asset_id, usage, display_order, start_ms, end_ms, play_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        materialId,
        assetId,
        usage,
        displayOrder,
        startMs ?? null,
        endMs ?? null,
        playLimit ?? null
    );
}

export function listPaperAssets(
    db: AppDatabase,
    paperId: string
): Array<AssetRow & { usage: string; display_order: number }> {
    return db
        .prepare(
            `SELECT a.*, pa.usage, pa.display_order
             FROM paper_assets pa
             INNER JOIN assets a ON a.id = pa.asset_id
             WHERE pa.paper_id = ?
             ORDER BY pa.display_order`
        )
        .all(paperId) as Array<AssetRow & { usage: string; display_order: number }>;
}

export function listMaterialAssets(
    db: AppDatabase,
    materialId: string
): Array<
    AssetRow & {
        usage: string;
        display_order: number;
        start_ms: number | null;
        end_ms: number | null;
        play_limit: number | null;
    }
> {
    return db
        .prepare(
            `SELECT a.*, ma.usage, ma.display_order, ma.start_ms, ma.end_ms, ma.play_limit
             FROM material_assets ma
             INNER JOIN assets a ON a.id = ma.asset_id
             WHERE ma.material_id = ?
             ORDER BY ma.display_order`
        )
        .all(materialId) as Array<
        AssetRow & {
            usage: string;
            display_order: number;
            start_ms: number | null;
            end_ms: number | null;
            play_limit: number | null;
        }
    >;
}
