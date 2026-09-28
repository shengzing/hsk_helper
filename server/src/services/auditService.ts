import type { AppDatabase } from "../db/connection.js";
import { insertAuditLog } from "../repositories/auditRepository.js";

export function logOperation(
    db: AppDatabase,
    params: {
        operatorId: string;
        action: string;
        objectType: string;
        objectId: string;
        beforeState?: Record<string, unknown> | null;
        afterState?: Record<string, unknown> | null;
        ip?: string | null;
    }
): void {
    insertAuditLog(db, {
        operatorId: params.operatorId,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId,
        beforeStateJson: params.beforeState ? JSON.stringify(params.beforeState) : null,
        afterStateJson: params.afterState ? JSON.stringify(params.afterState) : null,
        ip: params.ip ?? null,
    });
}

