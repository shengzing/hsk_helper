import { describe, it, expect, beforeEach } from "vitest";
import { getPaperDetail, listPapersForBank } from "../src/services/paperService.js";
import { HttpError } from "../src/utils/httpError.js";
import { createTestDbWithUsers, type TestDb } from "./helpers/db.js";

describe("Paper service", () => {
  let db: TestDb;
  const studentId = "user-student";

  beforeEach(() => {
    db = createTestDbWithUsers();
    // Seed already has: student→HSK4+HSK6, H61438 paper (published) with questions
    // Insert a test question with answer_json to test answer hiding
    db.prepare(
      `INSERT INTO question_groups (id, bank_id, group_type, status) VALUES ('qg-test', 'hsk-level-6', 'material', 'published')`
    ).run();
    db.prepare(
      `INSERT INTO question_group_versions (id, question_group_id, version_number, group_type, payload_json, status, is_current)
       VALUES ('qgv-test', 'qg-test', 1, 'material', '{}', 'published', 1)`
    ).run();
    db.prepare(
      `INSERT INTO questions (id, bank_id, question_group_id, status) VALUES ('q-test', 'hsk-level-6', 'qg-test', 'published')`
    ).run();
    db.prepare(
      `INSERT INTO question_versions (id, question_id, version_number, question_type, stem, payload_json, answer_json, explanation, status, is_current, is_enabled)
       VALUES ('qv-test', 'q-test', 1, 'single_choice', 'Test stem',
         '{"options":[{"key":"A","text":"option A"},{"key":"B","text":"option B"}]}',
         '{"value":"B"}',
         'The answer is B.',
         'published', 1, 1)`
    ).run();
    // Use display_order that doesn't conflict with seed (seed has 1,2,51,52,101)
    db.prepare(
      `INSERT INTO paper_questions (id, paper_id, section_id, question_id, question_version_id, question_group_version_id, display_order, score)
       VALUES ('pq-test', 'paper-h61438', 'section-h61438-listening', 'q-test', 'qv-test', 'qgv-test', 201, 3.0)`
    ).run();
  });

  describe("getPaperDetail — answer hiding (path B)", () => {
    it("returns paper detail for subscribed user", () => {
      const paper = getPaperDetail(db, "paper-h61438", studentId);
      expect(paper.id).toBe("paper-h61438");
      expect(paper.sections.length).toBeGreaterThanOrEqual(3);
    });

    it("does NOT return answer_json in question data", () => {
      const paper = getPaperDetail(db, "paper-h61438", studentId);
      const listening = paper.sections.find((s) => s.code === "listening");
      expect(listening).toBeDefined();
      // Find our test question (display_order 201)
      const allQuestions = listening!.groups.flatMap((g) => (g as any).questions || []);
      const testQ = allQuestions.find((q: any) => q.id === "pq-test");
      expect(testQ).toBeDefined();
      expect(testQ).not.toHaveProperty("answer_json");
      expect(testQ).not.toHaveProperty("explanation");
      expect(testQ.payload).toBeDefined();
      expect((testQ.payload as any).options).toHaveLength(2);
    });

    it("does NOT return explanation in question data", () => {
      const paper = getPaperDetail(db, "paper-h61438", studentId);
      const listening = paper.sections.find((s) => s.code === "listening");
      const allQuestions = listening!.groups.flatMap((g) => (g as any).questions || []);
      const testQ = allQuestions.find((q: any) => q.id === "pq-test");
      expect(testQ).not.toHaveProperty("explanation");
    });
  });

  describe("getPaperDetail — student materials", () => {
    it("returns audio metadata linked to a material group", () => {
      db.prepare(
        `INSERT INTO materials (id, bank_id, material_type, title, text_content, payload_json, status)
         VALUES ('material-test', 'hsk-level-6', 'audio', '听力材料', '共享阅读材料', '{}', 'published')`
      ).run();
      db.prepare(
        `UPDATE question_group_versions SET material_id = 'material-test' WHERE id = 'qgv-test'`
      ).run();
      db.prepare(
        `INSERT INTO assets (id, asset_type, storage_key, url, mime_type)
         VALUES ('asset-test-audio', 'audio', 'docs/test.mp3', '/api/test', 'audio/mpeg')`
      ).run();
      db.prepare(
        `INSERT INTO material_assets (material_id, asset_id, usage, display_order, play_limit)
         VALUES ('material-test', 'asset-test-audio', 'audio', 0, 2)`
      ).run();

      const paper = getPaperDetail(db, "paper-h61438", studentId);
      const listening = paper.sections.find((s) => s.code === "listening");
      const group = listening?.groups.find((g: any) => g.id === "qgv-test") as any;

      expect(group.material.text_content).toBe("共享阅读材料");
      expect(group.material.audio).toEqual({
        assetId: "asset-test-audio",
        playLimit: 2,
        startMs: undefined,
        endMs: undefined,
      });
      expect(group.material.transcript).toBeUndefined();
    });
  });

  describe("getPaperDetail — subscription check (path A)", () => {
    it("throws 403 for user without subscription", () => {
      expect(() => getPaperDetail(db, "paper-h61438", "user-admin")).toThrow(HttpError);
    });

    it("throws 404 for non-existent paper", () => {
      expect(() => getPaperDetail(db, "paper-nonexistent", studentId)).toThrow(HttpError);
    });

    it("throws 403 for draft paper", () => {
      db.prepare("UPDATE past_exam_papers SET status = 'draft' WHERE id = 'paper-h61438'").run();
      expect(() => getPaperDetail(db, "paper-h61438", studentId)).toThrow(HttpError);
    });
  });

  describe("listPapersForBank", () => {
    it("returns published papers for subscribed bank (HSK6)", () => {
      const papers = listPapersForBank(db, "hsk-level-6", studentId);
      expect(papers.length).toBeGreaterThanOrEqual(1);
      expect(papers.find((p) => p.id === "paper-h61438")).toBeDefined();
    });

    it("throws 403 for unsubscribed bank (HSK1)", () => {
      expect(() => listPapersForBank(db, "hsk-level-1", studentId)).toThrow(HttpError);
    });

    it("only returns published papers", () => {
      db.prepare(
        `INSERT INTO past_exam_papers (id, bank_id, paper_type, duration_seconds, total_score, passing_score, title, status)
         VALUES ('paper-draft-test', 'hsk-level-6', 'past', 100, 100, 60, 'Draft', 'draft')`
      ).run();
      const papers = listPapersForBank(db, "hsk-level-6", studentId);
      expect(papers.every((p) => p.status === "published")).toBe(true);
      expect(papers.find((p) => p.id === "paper-draft-test")).toBeUndefined();
    });
  });
});
