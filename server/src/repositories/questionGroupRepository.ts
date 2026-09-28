import type { AppDatabase } from "../db/connection.js";

export interface QuestionGroupRow {
    id: string;
    bank_id: string;
    group_type: string;
    status: string;
}

export interface QuestionGroupVersionRow {
    id: string;
    question_group_id: string;
    version_number: number;
    group_type: string;
    instruction: string | null;
    material_id: string | null;
    payload_json: string;
    status: string;
    is_current: number;
}

export function listGroupsByBank(db: AppDatabase, bankId: string): QuestionGroupRow[] {
    return db
        .prepare(
            `SELECT id, bank_id, group_type, status
             FROM question_groups
             WHERE bank_id = ?
             ORDER BY id`
        )
        .all(bankId) as QuestionGroupRow[];
}

export function getGroup(db: AppDatabase, groupId: string): QuestionGroupRow | undefined {
    return db
        .prepare(
            `SELECT id, bank_id, group_type, status
             FROM question_groups WHERE id = ?`
        )
        .get(groupId) as QuestionGroupRow | undefined;
}

export function getCurrentGroupVersion(
    db: AppDatabase,
    groupId: string
): QuestionGroupVersionRow | undefined {
    return db
        .prepare(
            `SELECT * FROM question_group_versions
             WHERE question_group_id = ? AND is_current = 1`
        )
        .get(groupId) as QuestionGroupVersionRow | undefined;
}

export function getGroupVersion(
    db: AppDatabase,
    versionId: string
): QuestionGroupVersionRow | undefined {
    return db
        .prepare(
            `SELECT * FROM question_group_versions WHERE id = ?`
        )
        .get(versionId) as QuestionGroupVersionRow | undefined;
}

export function listGroupVersions(
    db: AppDatabase,
    groupId: string
): QuestionGroupVersionRow[] {
    return db
        .prepare(
            `SELECT * FROM question_group_versions
             WHERE question_group_id = ?
             ORDER BY version_number`
        )
        .all(groupId) as QuestionGroupVersionRow[];
}

export function createGroup(
    db: AppDatabase,
    params: { id: string; bankId: string; groupType: string }
): void {
    db.prepare(
        `INSERT INTO question_groups (id, bank_id, group_type, status)
         VALUES (?, ?, ?, 'draft')`
    ).run(params.id, params.bankId, params.groupType);
}

export function createGroupVersion(
    db: AppDatabase,
    params: {
        id: string;
        questionGroupId: string;
        versionNumber: number;
        groupType: string;
        instruction?: string | null;
        materialId?: string | null;
        payloadJson: string;
    }
): void {
    db.prepare(
        `INSERT INTO question_group_versions
            (id, question_group_id, version_number, group_type, instruction,
             material_id, payload_json, status, is_current)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 1)`
    ).run(
        params.id,
        params.questionGroupId,
        params.versionNumber,
        params.groupType,
        params.instruction ?? null,
        params.materialId ?? null,
        params.payloadJson
    );
}

/**
 * Returns all questions that belong to groups within a bank.
 * Used by admin to inspect group membership.
 */
export function getQuestionsInGroup(
    db: AppDatabase,
    groupId: string
): Array<{ id: string; bank_id: string; status: string }> {
    return db
        .prepare(
            `SELECT id, bank_id, status FROM questions
             WHERE question_group_id = ?
             ORDER BY id`
        )
        .all(groupId) as Array<{ id: string; bank_id: string; status: string }>;
}

