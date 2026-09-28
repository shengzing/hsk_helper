import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppDatabase } from "../src/db/connection.js";

describe("Database data migrations", () => {
  it("backfills knowledge and feedback content for legacy databases exactly once", () => {
    const directory = mkdtempSync(join(tmpdir(), "hsk-migration-"));
    const dbPath = join(directory, "app.db");
    const migrationId = "20260923_backfill_seed_content";

    try {
      const initial = createAppDatabase(dbPath);
      expect(initial.prepare("SELECT COUNT(*) AS count FROM knowledge_documents").get())
        .toEqual({ count: 25 });
      expect(initial.prepare("SELECT COUNT(*) AS count FROM feedback").get())
        .toEqual({ count: 1 });
      initial.close();

      const legacy = new Database(dbPath);
      legacy.prepare("DELETE FROM feedback").run();
      legacy.prepare("DELETE FROM knowledge_documents").run();
      legacy.prepare("DELETE FROM knowledge_categories").run();
      legacy.prepare("DELETE FROM schema_migrations WHERE id = ?").run(migrationId);
      legacy.close();

      const reopened = createAppDatabase(dbPath);
      expect(reopened.prepare("SELECT COUNT(*) AS count FROM knowledge_documents").get())
        .toEqual({ count: 25 });
      expect(reopened.prepare("SELECT COUNT(*) AS count FROM feedback").get())
        .toEqual({ count: 1 });
      const content = reopened
        .prepare("SELECT content FROM knowledge_documents WHERE id = 'kd-hsk1-structure'")
        .get() as { content: string };
      expect(content.content.includes("\\n")).toBe(false);
      expect(content.content.includes("\n")).toBe(true);
      expect(reopened.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE id = ?").get(migrationId))
        .toEqual({ count: 1 });
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
