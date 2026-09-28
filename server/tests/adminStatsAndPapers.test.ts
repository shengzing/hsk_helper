import { createApp } from "../src/app.js";
import { createTestDbWithUsers, getJson, loginDirect, postJson } from "./helpers/db.js";

describe("Admin stats and papers API", () => {
  const db = createTestDbWithUsers();
  const app = createApp(db);
  const cookie = loginDirect(db, "admin", "Admin2026");

  it("returns dashboard counts including open feedback", async () => {
    const { status, body } = await getJson(app, "/api/admin/stats", cookie);
    const data = (body as { data: { stats: Record<string, number> } }).data.stats;

    expect(status).toBe(200);
    expect(data.totalUsers).toBe(2);
    expect(data.totalBanks).toBe(6);
    expect(data.totalPapers).toBe(1);
    expect(data.totalKnowledgeDocs).toBe(25);
    expect(data.activeSubscriptions).toBe(2);
    expect(data.openFeedback).toBe(1);
  });

  it("includes question count in the admin paper list", async () => {
    const { status, body } = await getJson(app, "/api/admin/papers", cookie);
    const papers = (body as { data: Array<{ question_count: number }> }).data;

    expect(status).toBe(200);
    expect(papers).toHaveLength(1);
    expect(papers[0].question_count).toBe(5);
  });

  it("creates a draft paper and records it in the admin list", async () => {
    const create = await postJson(app, "/api/admin/papers", {
      bankId: "hsk-level-1",
      title: "Admin API draft paper",
      paperType: "mock",
      year: 2026,
      session: "test",
      durationSeconds: 3600,
      totalScore: 100,
      passingScore: 60,
    }, cookie);
    const created = (create.body as { data: { paperId: string } }).data;

    expect(create.status).toBe(201);
    expect(created.paperId).toBeTruthy();

    const list = await getJson(app, "/api/admin/papers?status=draft", cookie);
    const papers = (list.body as { data: Array<{ id: string; status: string }> }).data;
    const draft = papers.find((paper) => paper.id === created.paperId);
    expect(draft?.status).toBe("draft");
  });
});
