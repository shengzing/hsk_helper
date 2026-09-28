import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createPasswordSecret } from "../../src/utils/password.js";
import { login } from "../../src/services/authService.js";
import type { AppDatabase } from "../../src/db/connection.js";

export type TestDb = Database.Database;

/** Adds runtime column migrations that connection.ts applies (schema evolves via ALTER). */
function applyMigrations(db: TestDb): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "last_login_at")) {
    db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
  }
}

/**
 * Creates an in-memory SQLite database with schema + seed applied.
 */
export function createTestDb(): TestDb {
  const db = new Database(":memory:") as AppDatabase;
  db.pragma("foreign_keys = ON");

  const schemaPath = fileURLToPath(new URL("../../src/db/schema.sql", import.meta.url));
  const seedPath = fileURLToPath(new URL("../../src/db/seed.sql", import.meta.url));

  db.exec(readFileSync(schemaPath, "utf8"));
  applyMigrations(db);
  // Disable FK during seed: seed.sql inserts paper_questions before paper_sections (F-005)
  db.pragma("foreign_keys = OFF");
  db.exec(readFileSync(seedPath, "utf8"));
  db.pragma("foreign_keys = ON");

  return db;
}

/**
 * Creates a test DB with default admin and student users having password hashes.
 */
export function createTestDbWithUsers(): TestDb {
  const db = createTestDb();
  const admin = createPasswordSecret("Admin2026");
  db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE username = 'admin'")
    .run(admin.hash, admin.salt);
  const student = createPasswordSecret("Study2026");
  db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE username = 'student'")
    .run(student.hash, student.salt);
  return db;
}

interface MockResponseData {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/** Logs in via the auth service directly and returns a cookie string. */
export function loginDirect(db: TestDb, username: string, password: string): string {
  const result = login(db as AppDatabase, username, password);
  return `hsk_session=${result.token}`;
}

/** Invokes an Express app handler in-process without binding to a port. */
export async function callApp(
  app: Express,
  method: string,
  path: string,
  opts?: { body?: unknown; cookie?: string }
): Promise<MockResponseData> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    let settled = false;
    // Safety timeout: Express 4 async route handlers can throw uncaught rejections
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ status: 504, body: { error: { code: "TEST_TIMEOUT", message: "Request timed out in test" } }, headers: {} });
      }
    }, 5000);
    // Catch unhandled rejections from async route handlers (Express 4 limitation)
    const rejHandler = (reason: unknown) => {
      if (!settled && reason instanceof Error && reason.name === "HttpError") {
        settled = true;
        clearTimeout(timer);
        process.off("unhandledRejection", rejHandler);
        const he = reason as any;
        resolve({ status: he.status ?? 500, body: { error: { code: he.code ?? "INTERNAL", message: he.message ?? "Error" } }, headers: {} });
      }
    };
    process.on("unhandledRejection", rejHandler);
    const done = (data: MockResponseData) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.off("unhandledRejection", rejHandler);
      resolve(data);
    };
    let bodyStr: string | null = null;
    if (opts?.cookie) headers["cookie"] = opts.cookie;
    if (opts?.body !== undefined) {
      bodyStr = JSON.stringify(opts.body);
    }

    const req = new EventEmitter() as unknown as IncomingMessage;
    (req as any).method = method;
    (req as any).url = path;
    (req as any).originalUrl = path;
    (req as any).headers = headers;
    (req as any).httpVersion = "1.1";
    (req as any).httpVersionMajor = 1;
    (req as any).httpVersionMinor = 1;
    (req as any).connection = new Socket();
    (req as any).socket = (req as any).connection;
    (req as any).ip = "127.0.0.1";
    (req as any).path = path.split("?")[0];
    (req as any).query = {};
    (req as any).params = {};
    (req as any).body = bodyStr ? JSON.parse(bodyStr) : {};

    const res = new EventEmitter() as unknown as ServerResponse & {
      statusCode: number;
      _headers: Record<string, string>;
      finished: boolean;
      headersSent: boolean;
    };
    res.statusCode = 200;
    (res as any)._headers = {};
    (res as any).finished = false;
    (res as any).headersSent = false;

    (res as any).setHeader = function (k: string, v: string) { (this as any)._headers[k.toLowerCase()] = v; };
    (res as any).getHeader = function (k: string) { return (this as any)._headers[k.toLowerCase()]; };
    (res as any).removeHeader = function (k: string) { delete (this as any)._headers[k.toLowerCase()]; };
    (res as any).status = function (code: number) { this.statusCode = code; return this; };
    (res as any).cookie = function (n: string, v: string) { (this as any)._headers["set-cookie"] = `${n}=${v}`; return this; };
    (res as any).clearCookie = function (n: string) { (this as any)._headers["set-cookie"] = `${n}=; max-age=0`; return this; };
    (res as any).json = function (data: unknown) {
      (this as any).headersSent = true; (this as any).finished = true; this.emit("end");
      done({ status: this.statusCode, body: data, headers: (this as any)._headers });
      return this;
    };
    (res as any).send = function (data: unknown) {
      (this as any).headersSent = true; (this as any).finished = true; this.emit("end");
      let body: unknown = data;
      try { body = JSON.parse(data as string); } catch { body = data; }
      done({ status: this.statusCode, body, headers: (this as any)._headers });
      return this;
    };
    (res as any).end = function (data?: unknown) {
      (this as any).headersSent = true; (this as any).finished = true; this.emit("end");
      done({ status: this.statusCode, body: data != null ? safeJson(String(data)) : null, headers: (this as any)._headers });
      return this;
    };

    try {
      app(req as any, res as any);
    } catch (err) {
      reject(err);
    }
  });
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export async function getJson(app: Express, path: string, cookie?: string): Promise<MockResponseData> {
  return callApp(app, "GET", path, { cookie });
}

export async function postJson(app: Express, path: string, body?: unknown, cookie?: string): Promise<MockResponseData> {
  return callApp(app, "POST", path, { body, cookie });
}

export async function patchJson(app: Express, path: string, body?: unknown, cookie?: string): Promise<MockResponseData> {
  return callApp(app, "PATCH", path, { body, cookie });
}

export async function deleteJson(app: Express, path: string, cookie?: string): Promise<MockResponseData> {
  return callApp(app, "DELETE", path, { cookie });
}
