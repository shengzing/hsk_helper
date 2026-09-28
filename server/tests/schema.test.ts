import { createTestDb, type TestDb } from "./helpers/db.js";

describe("Database schema", () => {
  let db: TestDb;

  beforeAll(() => {
    db = createTestDb();
  });

  const expectedTables = [
    "question_banks",
    "supported_locales",
    "users",
    "bank_subscriptions",
    "admin_operation_logs",
    "past_exam_papers",
    "paper_sections",
    "materials",
    "question_groups",
    "question_group_versions",
    "questions",
    "question_versions",
    "paper_questions",
    "assets",
    "paper_assets",
    "material_assets",
    "attempts",
    "attempt_answers",
    "attempt_section_states",
    "attempt_question_results",
    "essay_reviews",
    "attempt_audio_events",
    "wrong_questions",
  ];

  it("creates all expected tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it("rejects level outside 1-6 on question_banks", () => {
    expect(() =>
      db
        .prepare("INSERT INTO question_banks (id, code, level, name) VALUES (?, ?, ?, ?)")
        .run("bank-bad", "bad-code", 7, "Bad")
    ).toThrow();
  });

  it("rejects invalid direction on supported_locales", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO supported_locales (id, language_name, endonym, direction, display_order) VALUES (?, ?, ?, ?, ?)"
        )
        .run("xx-XX", "Test", "Test", "up", 99)
    ).toThrow();
  });

  it("rejects duplicate active subscription for same user+bank", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO bank_subscriptions (id, user_id, bank_id, status, starts_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run("sub-dup", "user-student", "hsk-level-4", "active", "2026-09-01T00:00:00+08:00")
    ).toThrow();
  });

  it("rejects zero duration on past_exam_papers", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO past_exam_papers (id, bank_id, paper_type, duration_seconds, total_score, passing_score, title) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run("paper-bad", "hsk-level-1", "past", 0, 200, 120, "Bad Paper")
    ).toThrow();
  });

  it("creates unique index for bank_subscriptions", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_bank_subscriptions_current");
  });

  it("creates index for admin_operation_logs", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_admin_%'")
      .all() as { name: string }[];
    expect(indexes.length).toBeGreaterThan(0);
  });
});
