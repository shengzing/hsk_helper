import { describe, it, expect, beforeEach } from "vitest";
import {
  startAttempt,
  saveAnswers,
  submitAttemptNow,
  getAttemptDetail,
  getAttemptReport,
  updateSectionTiming,
} from "../src/services/attemptService.js";
import { HttpError } from "../src/utils/httpError.js";
import { createTestDbWithUsers, type TestDb } from "./helpers/db.js";

describe("Attempt service — state machine, grading, answer hiding (paths B & C)", () => {
  let db: TestDb;
  const studentId = "user-student";
  const testPaperId = "paper-test-attempt";
  const testSectionId = "section-test-listening";

  beforeEach(() => {
    db = createTestDbWithUsers();
    setupTestPaper(db);
  });

  describe("startAttempt — state machine", () => {
    it("creates an in-progress attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      expect(id).toMatch(/^attempt-/);
      const attempt = db.prepare("SELECT status FROM attempts WHERE id = ?").get(id) as { status: string };
      expect(attempt.status).toBe("in_progress");
    });

    it("creates section states", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      const states = db.prepare("SELECT COUNT(*) as c FROM attempt_section_states WHERE attempt_id = ?").get(id) as { c: number };
      expect(states.c).toBeGreaterThanOrEqual(1);
    });

    it("throws 409 for duplicate in-progress attempt", () => {
      startAttempt(db, testPaperId, studentId, "exam");
      expect(() => startAttempt(db, testPaperId, studentId, "exam")).toThrow(HttpError);
    });

    it("throws 403 for user without subscription", () => {
      expect(() => startAttempt(db, testPaperId, "user-admin", "exam")).toThrow(HttpError);
    });

    it("throws 404 for non-existent paper", () => {
      expect(() => startAttempt(db, "paper-nonexistent", studentId, "exam")).toThrow(HttpError);
    });

    it("throws 403 for draft paper", () => {
      db.prepare("UPDATE past_exam_papers SET status = 'draft' WHERE id = ?").run(testPaperId);
      expect(() => startAttempt(db, testPaperId, studentId, "exam")).toThrow(HttpError);
    });
  });

  describe("saveAnswers", () => {
    it("saves answers for in-progress attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, { "pq-sc1": { type: "choice", value: "B" } });
      const count = db.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE attempt_id = ?").get(id) as { c: number };
      expect(count.c).toBe(1);
    });

    it("throws 403 for non-owner", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      expect(() => saveAnswers(db, id, "user-admin", {})).toThrow(HttpError);
    });

    it("throws 400 for submitted attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      submitAttemptNow(db, id, studentId, 100);
      expect(() => saveAnswers(db, id, studentId, {})).toThrow(HttpError);
    });

    it("upserts existing answers", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, { "pq-sc1": { type: "choice", value: "B" } });
      saveAnswers(db, id, studentId, { "pq-sc1": { type: "choice", value: "A" } });
      const count = db.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE attempt_id = ? AND paper_question_id = ?").get(id, "pq-sc1") as { c: number };
      expect(count.c).toBe(1);
    });
  });

  describe("submitAttemptNow — grading and wrong questions (path C)", () => {
    it("grades all questions and calculates scores", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, {
        "pq-sc1": { type: "choice", value: "B" },   // correct (answer=B)
        "pq-tf1": { type: "boolean", value: false }, // wrong (correct=true)
        "pq-essay1": { type: "essay", value: "作文" },
      });
      submitAttemptNow(db, id, studentId, 600);
      const attempt = db.prepare("SELECT status, objective_score, subjective_score FROM attempts WHERE id = ?").get(id) as any;
      expect(attempt.objective_score).toBe(3); // only sc1 correct (score=3)
      expect(attempt.subjective_score).toBe(0); // essay pending
    });

    it("creates question results for all questions", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, {
        "pq-sc1": { type: "choice", value: "B" },
        "pq-tf1": { type: "boolean", value: true },
        "pq-essay1": { type: "essay", value: "作文" },
      });
      submitAttemptNow(db, id, studentId, 100);
      const results = db.prepare("SELECT COUNT(*) as c FROM attempt_question_results WHERE attempt_id = ?").get(id) as { c: number };
      expect(results.c).toBe(3);
    });

    it("creates wrong questions for incorrect objective answers", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, {
        "pq-sc1": { type: "choice", value: "A" }, // wrong
        "pq-tf1": { type: "boolean", value: true }, // correct
      });
      submitAttemptNow(db, id, studentId, 100);
      const wrong = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id = ?").get(studentId) as { c: number };
      expect(wrong.c).toBe(1); // only sc1 wrong
    });

    it("creates wrong questions for unanswered questions", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      submitAttemptNow(db, id, studentId, 100);
      const wrong = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id = ?").get(studentId) as { c: number };
      expect(wrong.c).toBe(2); // sc1 + tf1 unanswered (essay excluded)
    });

    it("does NOT create wrong questions for essay", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, { "pq-essay1": { type: "essay", value: "作文" } });
      submitAttemptNow(db, id, studentId, 100);
      const wrong = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id = ?").get(studentId) as { c: number };
      expect(wrong.c).toBe(2); // sc1 + tf1 unanswered
    });

    it("throws 400 for already-submitted attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      submitAttemptNow(db, id, studentId, 100);
      expect(() => submitAttemptNow(db, id, studentId, 200)).toThrow(HttpError);
    });

    it("throws 403 for non-owner", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      expect(() => submitAttemptNow(db, id, "user-admin", 100)).toThrow(HttpError);
    });
  });

  describe("getAttemptDetail — answer hiding (path B)", () => {
    it("returns answers but NOT results for in-progress attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, { "pq-sc1": { type: "choice", value: "B" } });
      const detail = getAttemptDetail(db, id, studentId);
      expect(detail.answers).toHaveLength(1);
      expect(detail.answers[0].answer).toEqual({ type: "choice", value: "B" });
      expect((detail as any).results).toBeUndefined();
    });

    it("throws 403 for non-owner", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      expect(() => getAttemptDetail(db, id, "user-admin")).toThrow(HttpError);
    });
  });

  describe("getAttemptReport — answer visibility (path B)", () => {
    it("throws 400 for in-progress attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      expect(() => getAttemptReport(db, id, studentId)).toThrow(HttpError);
    });

    it("returns results after submission", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      saveAnswers(db, id, studentId, { "pq-sc1": { type: "choice", value: "A" } });
      submitAttemptNow(db, id, studentId, 100);
      const report = getAttemptReport(db, id, studentId);
      expect(report.results.length).toBeGreaterThan(0);
      const sc1 = report.results.find((r: any) => r.paper_question_id === "pq-sc1");
      expect(sc1).toBeDefined();
      expect(sc1!.is_correct).toBe(false);
    });

    it("throws 403 for non-owner", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      submitAttemptNow(db, id, studentId, 100);
      expect(() => getAttemptReport(db, id, "user-admin")).toThrow(HttpError);
    });
  });

  describe("updateSectionTiming", () => {
    it("updates section status and remaining seconds", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      updateSectionTiming(db, id, studentId, testSectionId, "active", 1800);
      const state = db.prepare("SELECT status, remaining_seconds FROM attempt_section_states WHERE attempt_id = ? AND section_id = ?").get(id, testSectionId) as any;
      expect(state.status).toBe("active");
      expect(state.remaining_seconds).toBe(1800);
    });

    it("throws 400 for submitted attempt", () => {
      const id = startAttempt(db, testPaperId, studentId, "exam");
      submitAttemptNow(db, id, studentId, 100);
      expect(() => updateSectionTiming(db, id, studentId, testSectionId, "active")).toThrow(HttpError);
    });
  });
});

// Create a separate test paper in HSK5 to avoid conflicts with seed data
function setupTestPaper(db: TestDb): void {
  // HSK5 bank already exists from seed; add subscription for student
  db.prepare(
    "INSERT OR IGNORE INTO bank_subscriptions (id, user_id, bank_id, status, starts_at, expires_at) VALUES (?, ?, ?, 'active', ?, ?)"
  ).run("sub-test-hsk5", "user-student", "hsk-level-5", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z");

  // Create a published test paper in HSK5
  db.prepare(
    `INSERT INTO past_exam_papers (id, bank_id, paper_type, duration_seconds, total_score, passing_score, title, status)
     VALUES (?, 'hsk-level-5', 'past', 3600, 100, 60, 'Test Paper', 'published')`
  ).run("paper-test-attempt");

  // Create a section
  db.prepare(
    `INSERT INTO paper_sections (id, paper_id, code, title, display_order, duration_seconds)
     VALUES (?, ?, 'listening', 'Test Listening', 1, 1800)`
  ).run("section-test-listening", "paper-test-attempt");

  // Questions: single_choice, true_false, essay
  db.prepare("INSERT INTO questions (id, bank_id, status) VALUES ('q-test-sc1', 'hsk-level-5', 'published')").run();
  db.prepare("INSERT INTO questions (id, bank_id, status) VALUES ('q-test-tf1', 'hsk-level-5', 'published')").run();
  db.prepare("INSERT INTO questions (id, bank_id, status) VALUES ('q-test-essay1', 'hsk-level-5', 'published')").run();

  db.prepare(
    `INSERT INTO question_versions (id, question_id, version_number, question_type, stem, payload_json, answer_json, explanation, status, is_current, is_enabled)
     VALUES ('qv-test-sc1', 'q-test-sc1', 1, 'single_choice', '选择',
       '{"options":[{"key":"A","text":"A"},{"key":"B","text":"B"}]}',
       '{"value":"B"}', 'B is correct', 'published', 1, 1)`
  ).run();

  db.prepare(
    `INSERT INTO question_versions (id, question_id, version_number, question_type, stem, payload_json, answer_json, explanation, status, is_current, is_enabled)
     VALUES ('qv-test-tf1', 'q-test-tf1', 1, 'true_false', '判断',
       '{"display_text":"Test","true_label":"对","false_label":"错"}',
       '{"value":true}', 'True', 'published', 1, 1)`
  ).run();

  db.prepare(
    `INSERT INTO question_versions (id, question_id, version_number, question_type, stem, payload_json, answer_json, explanation, status, is_current, is_enabled)
     VALUES ('qv-test-essay1', 'q-test-essay1', 1, 'essay', '写作',
       '{"task_type":"summary"}',
       '{"reference_essay":"..."}', 'Score by rubric', 'published', 1, 1)`
  ).run();

  // Link to paper
  db.prepare(
    `INSERT INTO paper_questions (id, paper_id, section_id, question_id, question_version_id, display_order, score)
     VALUES ('pq-sc1', ?, ?, 'q-test-sc1', 'qv-test-sc1', 1, 3.0)`
  ).run("paper-test-attempt", "section-test-listening");

  db.prepare(
    `INSERT INTO paper_questions (id, paper_id, section_id, question_id, question_version_id, display_order, score)
     VALUES ('pq-tf1', ?, ?, 'q-test-tf1', 'qv-test-tf1', 2, 2.0)`
  ).run("paper-test-attempt", "section-test-listening");

  db.prepare(
    `INSERT INTO paper_questions (id, paper_id, section_id, question_id, question_version_id, display_order, score)
     VALUES ('pq-essay1', ?, ?, 'q-test-essay1', 'qv-test-essay1', 3, 20.0)`
  ).run("paper-test-attempt", "section-test-listening");
}
