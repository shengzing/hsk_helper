import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/connection.js";
import {
    findSessionUser,
    findUserByUsername,
    findUserById,
    findUserByEmail,
    emailExists,
    createUser as createUserRecord,
    insertSession,
    revokeSession,
    revokeUserSessions,
    touchSession,
    updateLastLogin,
} from "../repositories/authRepository.js";
import type { ClientUser, SessionUserRecord, UserRecord } from "../types.js";
import { createPasswordSecret, verifyPasswordSecret } from "../utils/password.js";

export const SESSION_COOKIE_NAME = "hsk_session";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const VALID_UI_LOCALES = ["en-US", "zh-CN", "hi-IN", "es", "fr-FR", "ar", "bn-BD", "ru-RU", "pt-BR", "ur-PK"];

export interface LoginResult {
    user: ClientUser;
    token: string;
    maxAge: number;
}

export interface SessionAuthContext {
    user: ClientUser;
}

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function isUserExpired(user: Pick<UserRecord, "expires_at">): boolean {
    const expiresAt = new Date(`${user.expires_at}T23:59:59.999`);
    return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();
}

function toClientUser(user: UserRecord): ClientUser {
    return {
        id: user.id,
        username: user.username,
        email: user.email ?? null,
        displayName: user.display_name,
        isAdmin: user.is_admin === 1,
        expiresAt: user.expires_at,
        uiLocale: user.ui_locale,
    };
}

function isSessionValid(session: SessionUserRecord | undefined): session is SessionUserRecord {
    if (!session || session.session_revoked_at) return false;
    if (session.status !== "active" || isUserExpired(session)) return false;
    return new Date(session.session_expires_at).getTime() > Date.now();
}

export function login(db: AppDatabase, username: string, password: string): LoginResult {
    // Allow login by username or email
    const user = findUserByUsername(db, username) ?? findUserByEmail(db, username);
    if (!user || !verifyPasswordSecret(password, user.password_hash, user.password_salt)) {
        throw new Error("Invalid username or password");
    }
    if (user.status !== "active" || isUserExpired(user)) {
        throw new Error("User is disabled or expired");
    }

    revokeUserSessions(db, user.id);
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    insertSession(db, `session-${randomUUID()}`, user.id, hashToken(token), expiresAt);
    updateLastLogin(db, user.id);

    return { user: toClientUser(user), token, maxAge: SESSION_TTL_MS };
}

export interface RegisterInput {
    email: string;
    password: string;
    displayName?: string;
    uiLocale?: string;
}

export function register(db: AppDatabase, input: RegisterInput): LoginResult {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const displayName = input.displayName?.trim() || email.split("@")[0];
    const uiLocale = input.uiLocale && VALID_UI_LOCALES.includes(input.uiLocale) ? input.uiLocale : "zh-CN";

    if (!EMAIL_RE.test(email)) {
        throw new RegistrationError("INVALID_EMAIL", "Invalid email address");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new RegistrationError("WEAK_PASSWORD", `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (emailExists(db, email)) {
        throw new RegistrationError("EMAIL_EXISTS", "Email already registered");
    }

    // Derive a unique username from email; fall back to UUID suffix on collision
    const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
    let username = baseUsername || `user_${randomUUID().slice(0, 8)}`;
    if (findUserByUsername(db, username)) {
        username = `${username}_${randomUUID().slice(0, 8)}`;
    }

    const { hash, salt } = createPasswordSecret(password);
    const userId = `user-${randomUUID()}`;
    createUserRecord(db, {
        id: userId,
        username,
        email,
        displayName,
        passwordHash: hash,
        passwordSalt: salt,
        uiLocale,
    });

    // Auto-login after registration
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    insertSession(db, `session-${randomUUID()}`, userId, hashToken(token), expiresAt);
    updateLastLogin(db, userId);

    const createdUser = findUserById(db, userId)!;
    return { user: toClientUser(createdUser), token, maxAge: SESSION_TTL_MS };
}

export class RegistrationError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = "RegistrationError";
    }
}

export function logout(db: AppDatabase, token: string | undefined): void {
    if (!token) return;
    const session = findSessionUser(db, hashToken(token));
    if (session) {
        revokeSession(db, session.session_id);
    }
}

export function getSessionAuthContext(
    db: AppDatabase,
    token: string | undefined
): SessionAuthContext | null {
    if (!token) return null;
    const session = findSessionUser(db, hashToken(token));
    if (!isSessionValid(session)) return null;
    touchSession(
        db,
        session.session_id,
        new Date(Date.now() + SESSION_TTL_MS).toISOString()
    );
    return { user: toClientUser(session) };
}

export function getSessionUser(db: AppDatabase, token: string | undefined): ClientUser | null {
    return getSessionAuthContext(db, token)?.user ?? null;
}

export { SESSION_TTL_MS };
