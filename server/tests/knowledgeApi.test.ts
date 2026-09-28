import { createApp } from "../src/app.js";
import { createTestDbWithUsers, getJson, loginDirect } from "./helpers/db.js";

describe("Knowledge API", () => {
  const db = createTestDbWithUsers();
  const app = createApp(db);
  const cookie = loginDirect(db, "student", "Study2026");

  it("returns published categories with document counts", async () => {
    const { status, body } = await getJson(app, "/api/knowledge", cookie);
    const categories = (body as { data: Array<{ id: string; document_count: number }> }).data;

    expect(status).toBe(200);
    expect(categories).toHaveLength(7);
    expect(categories.find((category) => category.id === "kc-hsk3-overview")?.document_count).toBe(1);
    expect(categories.find((category) => category.id === "kc-hsk1-outline")?.document_count).toBe(4);
    expect(categories.find((category) => category.id === "kc-hsk6-outline")?.document_count).toBe(4);
  });

  it("returns documents for a category", async () => {
    const { status, body } = await getJson(app, "/api/knowledge/kc-hsk1-outline/documents", cookie);
    const documents = (body as { data: Array<{ title: string; status: string }> }).data;

    expect(status).toBe(200);
    expect(documents.map((document) => document.title)).toEqual([
      "HSK 一级考试结构",
      "HSK 一级大纲要点",
      "HSK 一级核心词汇",
      "HSK 一级语法要点",
    ]);
    expect(documents.every((document) => document.status === "published")).toBe(true);
  });
});
