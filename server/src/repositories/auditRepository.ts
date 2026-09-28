import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";

export interface AuditLogEntry {
    id: string;
    operatorId: string;
    action: string;
    objectType: string;
    objectId: string;
    beforeStateJson: string | null;
    afterStateJson: string | null;
    ip: string | null;
    createdAt: string;
}

export function insertAuditLog(
    db: AppDatabase,
    params: {
        operatorId: string;
        action: string;
        objectType: string;
        objectId: string;
        beforeStateJson?: string | null;
        afterStateJson?: string | null;
        ip?: string | null;
    }
): void {
    db.prepare(
        `INSERT INTO admin_operation_logs
            (id, operator_id, action, object_type, object_id, before_state_json, after_state_json, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        `log-${randomUUID()}`,
        params.operatorId,
        params.action,
        params.objectType,
        params.objectId,
        params.beforeStateJson ?? null,
        params.afterStateJson ?? null,
        params.ip ?? null
    );
}

export function listAuditLogs(
    db: AppDatabase,
    filters: { objectType?: string; objectId?: string; limit?: number }
): AuditLogEntry[] {
    const conditions: string[] = [];
    const args: unknown[] = [];
    if (filters.objectType) {
        conditions.push("object_type = ?");
        args.push(filters.objectType);
    }
    if (filters.objectId) {
        conditions.push("object_id = ?");
        args.push(filters.objectId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 100;
    return db
        .prepare(
            `SELECT id, operator_id AS operatorId, action, object_type AS objectType,
                    object_id AS objectId, before_state_json AS beforeStateJson,
                    after_state_json AS afterStateJson, ip, created_at AS createdAt
             FROM admin_operation_logs ${where}
             ORDER BY created_at DESC
             LIMIT ?`
        )
        .all(...args, limit) as AuditLogEntry[];
}

