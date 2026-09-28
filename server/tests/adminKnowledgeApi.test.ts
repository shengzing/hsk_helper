import { createApp } from "../src/app.js";
import { createTestDbWithUsers, getJson, loginDirect, patchJson, postJson } from "./helpers/db.js";

describe("Admin knowledge API", () => {
  const db = createTestDbWithUsers();
  const app = createApp(db);
  const adminCookie = loginDirect(db, "admin", "Admin2026");
  const studentCookie = loginDirect(db, "student", "Study2026");

  it("rejects non-admin access", async () => {
    const { status } = await getJson(app, "/api/admin/knowledge/categories", studentCookie);
    expect(status).toBe(403);
  });

  it("creates and updates a knowledge category", async () => {
    const create = await postJson(app, "/api/admin/knowledge/categories", {
      name: "HSK 词汇专题",
      bankId: "hsk-level-4",
      description: "四级核心词汇",
      displayOrder: 9,
      status: "draft",
    }, adminCookie);
    const created = (create.body as { data: { id: string } }).data;

    expect(create.status).toBe(201);
    expect(created.id).toBeTruthy();

    const update = await patchJson(app, `/api/admin/knowledge/categories/${created.id}`, {
      status: "published",
    }, adminCookie);
    expect(update.status).toBe(200);

    const list = await getJson(app, "/api/admin/knowledge/categories", adminCookie);
    const category = (list.body as { data: Array<{ id: string; status: string }> }).data
      .find((item) => item.id === created.id);
    expect(category?.status).toBe("published");
  });

  it("creates and publishes a knowledge document", async () => {
    const create = await postJson(app, "/api/admin/knowledge/documents", {
      categoryId: "kc-hsk3-overview",
      title: "HSK 备考计划",
      content: "# HSK 备考计划\n\n每天完成一个专项练习。",
      tags: "HSK,计划",
      displayOrder: 9,
      status: "draft",
    }, adminCookie);
    const created = (create.body as { data: { id: string } }).data;

    expect(create.status).toBe(201);

    const update = await patchJson(app, `/api/admin/knowledge/documents/${created.id}`, {
      status: "published",
    }, adminCookie);
    expect(update.status).toBe(200);

    const list = await getJson(app, "/api/admin/knowledge/documents", adminCookie);
    const document = (list.body as { data: Array<{ id: string; status: string; category_name: string; tags: string }> }).data
      .find((item) => item.id === created.id);
    expect(document?.status).toBe("published");
    expect(document?.category_name).toBe("HSK 3.0 总览");
    expect(document?.tags).toBe("HSK,计划");
  });
});
