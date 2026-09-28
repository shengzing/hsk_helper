import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import {
  createTestDbWithUsers,
  loginDirect,
  getJson,
  postJson,
  patchJson,
  type TestDb,
} from "./helpers/db.js";

/**
 * Full attempt flow integration test via API.
 * Covers login → start → save → submit → report → wrong questions.
 */
describe("Attempt API flow (integration)", () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let studentCookie: string;
  let adminCookie: string;
  let attemptId: string;

  beforeEach(() => {
    db = createTestDbWithUsers();
    app = createApp(db);
    adminCookie = loginDirect(db, "admin", "Admin2026");
    studentCookie = loginDirect(db, "student", "Study2026");
  });

  it("full flow: start → save → submit → report", async () => {
    // 1. Start attempt
    const { status: startStatus, body: startBody } = await postJson(
      app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie
    );
    expect(startStatus).toBe(201);
    attemptId = (startBody as any).data.attemptId;

    // 2. Save answers
    const { status: saveStatus } = await patchJson(
      app,
      `/api/attempts/${attemptId}/answers`,
      {
        answers: {
          "pq-h61438-l1": { type: "choice", value: "B" }, // correct
          "pq-h61438-l2": { type: "choice", value: "A" }, // wrong (correct=C)
        },
      },
      studentCookie
    );
    expect(saveStatus).toBe(200);

    // 3. Get attempt detail — answers visible, no results
    const { body: detailBody } = await getJson(app, `/api/attempts/${attemptId}`, studentCookie);
    const detail = (detailBody as any).data;
    expect(detail.status).toBe("in_progress");
    expect(detail.answers).toHaveLength(2);
    expect(detail).not.toHaveProperty("results");

    // 4. Submit
    const { status: submitStatus } = await postJson(
      app,
      `/api/attempts/${attemptId}/submit`,
      { durationUsedSeconds: 3600 },
      studentCookie
    );
    expect(submitStatus).toBe(200);

    // 5. Cannot save after submit
    const { status: lockedStatus } = await patchJson(
      app,
      `/api/attempts/${attemptId}/answers`,
      { answers: { "pq-h61438-l1": { type: "choice", value: "A" } } },
      studentCookie
    );
    expect(lockedStatus).toBe(400);

    // 6. Get report
    const { status: reportStatus, body: reportBody } = await getJson(
      app, `/api/attempts/${attemptId}/report`, studentCookie
    );
    expect(reportStatus).toBe(200);
    const report = (reportBody as any).data;
    expect(report.results).toBeDefined();
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.sections).toHaveLength(3);
    expect(report.passing_score).toBe(180);
    expect(report.sections[0].results[0].answer).toEqual({ type: "choice", value: "B" });

    // Verify grading: l1 correct, l2 wrong
    const l1 = report.results.find((r: any) => r.paper_question_id === "pq-h61438-l1");
    const l2 = report.results.find((r: any) => r.paper_question_id === "pq-h61438-l2");
    expect(l1.is_correct).toBe(true);
    expect(l2.is_correct).toBe(false);
  });

  it("section timing update works", async () => {
    const { body } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    attemptId = (body as any).data.attemptId;

    const { status } = await patchJson(
      app,
      `/api/attempts/${attemptId}/sections/section-h61438-listening`,
      { status: "active", remainingSeconds: 1800 },
      studentCookie
    );
    expect(status).toBe(200);
  });

  it("audio event recording works", async () => {
    const { body } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    attemptId = (body as any).data.attemptId;

    const { status } = await postJson(
      app,
      `/api/attempts/${attemptId}/audio-events`,
      { assetId: "asset-h61438-audio", eventType: "play", positionMs: 0 },
      studentCookie
    );
    expect(status).toBe(201);
  });

  it("serves relative assets from the project root", async () => {
    const { body } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    attemptId = (body as any).data.attemptId;
    db.prepare(
      "UPDATE assets SET storage_key = 'package.json', mime_type = 'application/json' WHERE id = 'asset-h61438-audio'"
    ).run();

    const { status } = await getJson(
      app,
      `/api/attempts/${attemptId}/assets/asset-h61438-audio`,
      studentCookie
    );
    expect(status).toBe(200);
  });

  it("wrong questions appear after submission", async () => {
    const { body: startBody } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    attemptId = (startBody as any).data.attemptId;

    // Only answer l1 correctly, leave others unanswered
    await patchJson(
      app,
      `/api/attempts/${attemptId}/answers`,
      { answers: { "pq-h61438-l1": { type: "choice", value: "B" } } },
      studentCookie
    );

    await postJson(app, `/api/attempts/${attemptId}/submit`, { durationUsedSeconds: 100 }, studentCookie);

    const { status, body } = await getJson(app, "/api/wrong-questions", studentCookie);
    expect(status).toBe(200);
    const wrongQs = (body as any).data;
    expect(wrongQs.length).toBeGreaterThan(0);
    // l2, r1, r2 should be wrong (unanswered); essay excluded
    const types = wrongQs.map((wq: any) => wq.question_type);
    expect(types.every((t: string) => t !== "essay")).toBe(true);
    const l2 = wrongQs.find((wq: any) => wq.paper_question_id === "pq-h61438-l2");
    expect(l2).toBeDefined();
    expect(l2.your_answer).toBeNull();
    expect(l2.correct_answer).toEqual({ value: "C" });
  });

  it("duplicate attempt creation resumes the existing attempt", async () => {
    const first = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    const firstAttemptId = (first.body as any).data.attemptId;
    const second = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    expect(second.status).toBe(200);
    expect((second.body as any).data.attemptId).toBe(firstAttemptId);
  });

  it("essay review flow (admin)", async () => {
    // Start and submit with essay answer
    const { body: startBody } = await postJson(app, "/api/papers/paper-h61438/attempts", { mode: "exam" }, studentCookie);
    attemptId = (startBody as any).data.attemptId;

    await patchJson(
      app,
      `/api/attempts/${attemptId}/answers`,
      { answers: { "pq-h61438-w1": { type: "essay", value: "测试作文内容..." } } },
      studentCookie
    );
    await postJson(app, `/api/attempts/${attemptId}/submit`, { durationUsedSeconds: 100 }, studentCookie);

    // Admin lists pending essays
    const { status: listStatus, body: listBody } = await getJson(app, "/api/admin/reviews/essays", adminCookie);
    expect(listStatus).toBe(200);
    const pending = (listBody as any).data;
    expect(pending.length).toBeGreaterThan(0);

    // Admin reviews the essay
    const essayResult = pending[0];
    expect(essayResult).toBeDefined(); // first pending essay
    const resultId = essayResult.result_id;

    const { status: reviewStatus } = await patchJson(
      app,
      `/api/admin/reviews/essays/${resultId}`,
      { score: 80, reviewComment: "Good essay", completed: true },
      adminCookie
    );
    expect(reviewStatus).toBe(200);

    // Student gets updated report with essay score
    const { body: reportBody } = await getJson(app, `/api/attempts/${attemptId}/report`, studentCookie);
    const report = (reportBody as any).data;
    expect(report.subjective_score).toBeGreaterThan(0);
  });

  it("non-admin cannot list pending essays", async () => {
    const { status } = await getJson(app, "/api/admin/reviews/essays", studentCookie);
    expect(status).toBe(403);
  });
});
