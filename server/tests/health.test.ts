import { createApp } from "../src/app.js";
import { createTestDb, getJson } from "./helpers/db.js";

describe("GET /health", () => {
  const db = createTestDb();
  const app = createApp(db);

  it("returns 200 with { status: 'ok' }", async () => {
    const { status, body } = await getJson(app, "/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
