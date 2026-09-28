import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";
import { createPasswordSecret } from "../utils/password.js";

export interface AdminUserRow {
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    isAdmin: boolean;
    status: string;
    expiresAt: string;
    uiLocale: string;
    lastLoginAt: string | null;
    subscriptionCount: number;
}

interface RawUserRow {
    id: string;
    username: string;
    email: string | null;
    display_name: string;
    is_admin: number;
    status: string;
    expires_at: string;
    ui_locale: string;
    last_login_at: string | null;
    sub_count: number;
}

export function listUsers(db: AppDatabase): AdminUserRow[] {
    const rows = db
        .prepare(
            `SELECT u.id, u.username, u.email, u.display_name, u.is_admin, u.status,
                    u.expires_at, u.ui_locale, u.last_login_at,
                    (SELECT COUNT(*) FROM bank_subscriptions s WHERE s.user_id = u.id) AS sub_count
             FROM users u
             ORDER BY u.is_admin DESC, u.username ASC`
        )
        .all() as RawUserRow[];

    return rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        isAdmin: row.is_admin === 1,
        status: row.status,
        expiresAt: row.expires_at,
        uiLocale: row.ui_locale,
        lastLoginAt: row.last_login_at,
        subscriptionCount: row.sub_count,
    }));
}

export function usernameExists(
    db: AppDatabase,
    username: string,
    excludeUserId?: string
): boolean {
    const row = excludeUserId
        ? db
              .prepare("SELECT 1 AS flag FROM users WHERE username = ? AND id != ?")
              .get(username, excludeUserId)
        : db.prepare("SELECT 1 AS flag FROM users WHERE username = ?").get(username);
    return Boolean(row);
}

export function userExists(db: AppDatabase, userId: string): boolean {
    return Boolean(db.prepare("SELECT 1 AS flag FROM users WHERE id = ?").get(userId));
}

export function isAdminDeletable(db: AppDatabase, userId: string): boolean {
    const row = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND id != ?")
        .get(userId) as { count: number };
    return row.count > 0;
}

export function createUser(
    db: AppDatabase,
    input: {
        username: string;
        email?: string;
        password: string;
        displayName: string;
        expiresAt: string;
        isAdmin: boolean;
        uiLocale: string;
    }
): string {
    const id = `user-${randomUUID()}`;
    const { hash, salt } = createPasswordSecret(input.password);
    db.prepare(
        `INSERT INTO users (id, username, email, display_name, password_hash, password_salt, is_admin, status, expires_at, ui_locale)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, input.username, input.email ?? null, input.displayName, hash, salt, input.isAdmin ? 1 : 0, input.expiresAt, input.uiLocale);
    return id;
}

export function updateUser(
    db: AppDatabase,
    userId: string,
    input: {
        username: string;
        email?: string | null;
        password?: string;
        displayName: string;
        expiresAt: string;
        isAdmin: boolean;
        status: string;
        uiLocale: string;
    }
): void {
    if (input.password) {
        const { hash, salt } = createPasswordSecret(input.password);
        db.prepare(
            `UPDATE users
             SET username = ?, email = ?, display_name = ?, expires_at = ?, is_admin = ?, status = ?, ui_locale = ?,
                 password_hash = ?, password_salt = ?
             WHERE id = ?`
        ).run(
            input.username, input.email ?? null, input.displayName, input.expiresAt,
            input.isAdmin ? 1 : 0, input.status, input.uiLocale,
            hash, salt, userId
        );
    } else {
        db.prepare(
            `UPDATE users
             SET username = ?, email = ?, display_name = ?, expires_at = ?, is_admin = ?, status = ?, ui_locale = ?
             WHERE id = ?`
        ).run(
            input.username, input.email ?? null, input.displayName, input.expiresAt,
            input.isAdmin ? 1 : 0, input.status, input.uiLocale,
            userId
        );
    }
}

export function deleteUser(db: AppDatabase, userId: string): void {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
