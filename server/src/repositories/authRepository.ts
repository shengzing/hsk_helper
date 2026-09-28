import type { AppDatabase } from "../db/connection.js";
import type { SessionUserRecord, UserRecord } from "../types.js";

export function findUserByUsername(db: AppDatabase, username: string): UserRecord | undefined {
    return db
        .prepare(
            `SELECT id, username, email, display_name, password_hash, password_salt,
                    is_admin, status, expires_at, ui_locale, last_login_at
             FROM users
             WHERE username = ?`
        )
        .get(username) as UserRecord | undefined;
}

export function findUserById(db: AppDatabase, userId: string): UserRecord | undefined {
    return db
        .prepare(
            `SELECT id, username, email, display_name, password_hash, password_salt,
                    is_admin, status, expires_at, ui_locale, last_login_at
             FROM users
             WHERE id = ?`
        )
        .get(userId) as UserRecord | undefined;
}

export function findUserByEmail(db: AppDatabase, email: string): UserRecord | undefined {
    return db
        .prepare(
            `SELECT id, username, email, display_name, password_hash, password_salt,
                    is_admin, status, expires_at, ui_locale, last_login_at
             FROM users
             WHERE email = ? COLLATE NOCASE`
        )
        .get(email) as UserRecord | undefined;
}

export function findSessionUser(db: AppDatabase, tokenHash: string): SessionUserRecord | undefined {
    return db
        .prepare(
            `SELECT u.id, u.username, u.email, u.display_name, u.password_hash, u.password_salt,
                    u.is_admin, u.status, u.expires_at, u.ui_locale, u.last_login_at,
                    s.id AS session_id,
                    s.expires_at AS session_expires_at,
                    s.revoked_at AS session_revoked_at
             FROM user_sessions s
             INNER JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ?`
        )
        .get(tokenHash) as SessionUserRecord | undefined;
}

export function insertSession(
    db: AppDatabase,
    sessionId: string,
    userId: string,
    tokenHash: string,
    expiresAt: string
): void {
    db.prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, last_used_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(sessionId, userId, tokenHash, expiresAt);
}

export function revokeSession(db: AppDatabase, sessionId: string): void {
    db.prepare(`UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        sessionId
    );
}

export function revokeUserSessions(db: AppDatabase, userId: string): void {
    db.prepare(
        `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND revoked_at IS NULL`
    ).run(userId);
}

export function touchSession(
    db: AppDatabase,
    sessionId: string,
    expiresAt: string
): void {
    db.prepare(
        `UPDATE user_sessions
         SET last_used_at = CURRENT_TIMESTAMP, expires_at = ?
         WHERE id = ?`
    ).run(expiresAt, sessionId);
}

export function updateLastLogin(db: AppDatabase, userId: string): void {
    db.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId);
}

export function emailExists(db: AppDatabase, email: string): boolean {
    const row = db
        .prepare("SELECT 1 AS flag FROM users WHERE email = ? COLLATE NOCASE")
        .get(email);
    return Boolean(row);
}

export function createUser(
    db: AppDatabase,
    input: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        passwordHash: string;
        passwordSalt: string;
        uiLocale: string;
    }
): void {
    db.prepare(
        `INSERT INTO users (id, username, email, display_name, password_hash, password_salt, is_admin, status, expires_at, ui_locale)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'active', '2099-12-31', ?)`
    ).run(
        input.id, input.username, input.email, input.displayName,
        input.passwordHash, input.passwordSalt, input.uiLocale
    );
}
