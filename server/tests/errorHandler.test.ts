import { createApp } from "../src/app.js";
import { createTestDb, getJson } from "./helpers/db.js";

describe("Error handling", () => {
  const db = createTestDb();
  const app = createApp(db);

  it("returns 401 for authenticated API routes without a session", async () => {
    const { status, body } = await getJson(app, "/api/banks");
    expect(status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for unknown authenticated API routes", async () => {
    const { status, body } = await getJson(app, "/api/nonexistent");
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("public routes (locales) do not require auth", async () => {
    const { status } = await getJson(app, "/api/locales");
    expect(status).toBe(200);
  });

  it("health endpoint does not require auth", async () => {
    const { status, body } = await getJson(app, "/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
