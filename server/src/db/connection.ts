import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createPasswordSecret } from "../utils/password.js";

export type AppDatabase = Database.Database;

function readSqlFile(fileName: string): string {
    return readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
}

function hasColumn(db: AppDatabase, tableName: string, columnName: string): boolean {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === columnName);
}

function migrationApplied(db: AppDatabase, migrationId: string): boolean {
    const row = db
        .prepare(`SELECT id FROM schema_migrations WHERE id = ?`)
        .get(migrationId) as { id: string } | undefined;
    return Boolean(row);
}

function recordMigration(db: AppDatabase, migrationId: string): void {
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)`).run(migrationId);
}

/**
 * Ensures a user exists with the given username.
 * If the user exists but has no password hash, sets it.
 * If the user does not exist, creates it.
 */
function ensureInitialUser(
    db: AppDatabase,
    username: string,
    displayName: string,
    password: string,
    isAdmin: boolean
): void {
    const existing = db
        .prepare(`SELECT id, password_hash FROM users WHERE username = ?`)
        .get(username) as { id: string; password_hash: string | null } | undefined;

    if (!existing) {
        const { hash, salt } = createPasswordSecret(password);
        db.prepare(
            `INSERT INTO users (id, username, display_name, password_hash, password_salt, is_admin, status, expires_at, ui_locale)
             VALUES (?, ?, ?, ?, ?, ?, 'active', '2099-12-31', 'zh-CN')`
        ).run(`user-${randomUUID()}`, username, displayName, hash, salt, isAdmin ? 1 : 0);
        return;
    }

    // Ensure admin flag is set if needed
    if (isAdmin) {
        db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(existing.id);
    }

    // Set password hash if missing
    if (!existing.password_hash) {
        const { hash, salt } = createPasswordSecret(password);
        db.prepare(
            `UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`
        ).run(hash, salt, existing.id);
    }
}

/**
 * Creates and initializes the SQLite database.
 * - Creates the parent directory if it does not exist.
 * - Enables WAL mode and foreign keys.
 * - Runs schema.sql to create all tables.
 * - Seeds initial data and applies one-time data migrations.
 * - Ensures the default admin and student accounts have passwords.
 */
export function createAppDatabase(dbPath: string): AppDatabase {
    const directory = dirname(dbPath);
    if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    // Create all tables
    db.exec(readSqlFile("schema.sql"));

    // Column migrations for evolving schema
    if (!hasColumn(db, "users", "last_login_at")) {
        db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
    }
    if (!hasColumn(db, "users", "email")) {
        db.exec("ALTER TABLE users ADD COLUMN email TEXT");
    }
    // Ensure the email UNIQUE index exists (separate from column addition)
    const emailMigration = "20260924_add_email_unique_index";
    if (!migrationApplied(db, emailMigration)) {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");
        recordMigration(db, emailMigration);
    }

    // Seed.sql is fully INSERT OR IGNORE. Existing databases created before
    // knowledge/feedback shipped are backfilled exactly once through this marker.
    const seedBackfillMigration = "20260923_backfill_seed_content";
    if (!migrationApplied(db, seedBackfillMigration)) {
        db.pragma("foreign_keys = OFF");
        db.exec(readSqlFile("seed.sql"));
        db.pragma("foreign_keys = ON");
        recordMigration(db, seedBackfillMigration);
    }

    // Early seed rows stored literal \n sequences because SQLite does not
    // interpret backslash escapes in string literals.
    const normalizeSeedMarkdownMigration = "20260924_normalize_seed_markdown";
    if (!migrationApplied(db, normalizeSeedMarkdownMigration)) {
        db.prepare(
            `UPDATE knowledge_documents
             SET content = replace(content, '\\n', char(10))
             WHERE id IN ('kd-hsk-intro', 'kd-hsk6-listening-tips', 'kd-hsk6-reading-tips', 'kd-hsk6-writing-tips')`
        ).run();
        recordMigration(db, normalizeSeedMarkdownMigration);
    }

    // Replace the early MVP knowledge seed with the official HSK 3.0 outline.
    const officialHsk30KnowledgeMigration = "20260925_official_hsk30_knowledge";
    if (!migrationApplied(db, officialHsk30KnowledgeMigration)) {
        db.pragma("foreign_keys = OFF");
        db.prepare(
            `DELETE FROM knowledge_documents
             WHERE category_id IN ('kc-hsk-overview', 'kc-hsk6-vocab', 'kc-hsk6-grammar', 'kc-hsk6-tips')`
        ).run();
        db.prepare(
            `DELETE FROM knowledge_categories
             WHERE id IN ('kc-hsk-overview', 'kc-hsk6-vocab', 'kc-hsk6-grammar', 'kc-hsk6-tips')`
        ).run();
        db.exec(readSqlFile("seed.sql"));
        db.pragma("foreign_keys = ON");
        recordMigration(db, officialHsk30KnowledgeMigration);
    }

    // Add the official HSK vocabulary and grammar documents.
    const hskVocabularyGrammarMigration = "20260925_hsk_vocab_grammar";
    if (!migrationApplied(db, hskVocabularyGrammarMigration)) {
        db.exec(readSqlFile("seed.sql"));
        recordMigration(db, hskVocabularyGrammarMigration);
    }

    // Ensure default users have passwords
    ensureInitialUser(
        db,
        process.env.INITIAL_ADMIN_USERNAME ?? "admin",
        "系统管理员",
        process.env.INITIAL_ADMIN_PASSWORD ?? "Admin2026",
        true
    );
    ensureInitialUser(db, "student", "张小程", "Study2026", false);

    return db;
}
