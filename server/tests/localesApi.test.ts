import { createApp } from "../src/app.js";
import { createTestDb, getJson } from "./helpers/db.js";

describe("GET /api/locales", () => {
  const db = createTestDb();
  const app = createApp(db);
  let locales: Array<{
    id: string;
    language_name: string;
    endonym: string;
    direction: string;
    is_default: boolean;
  }>;

  beforeAll(async () => {
    const { body } = await getJson(app, "/api/locales");
    locales = body.locales;
  });

  it("returns 200", async () => {
    const { status } = await getJson(app, "/api/locales");
    expect(status).toBe(200);
  });

  it("returns exactly 10 published locales", () => {
    expect(locales).toHaveLength(10);
  });

  it("returns locales ordered by display_order", () => {
    const ids = locales.map((l) => l.id);
    expect(ids[0]).toBe("en-US");
    expect(ids[1]).toBe("zh-CN");
    expect(ids[5]).toBe("ar");
    expect(ids[9]).toBe("ur-PK");
  });

  it("marks zh-CN as the default", () => {
    const zhCN = locales.find((l) => l.id === "zh-CN");
    expect(zhCN).toBeDefined();
    expect(zhCN!.is_default).toBe(true);
  });

  it("marks en-US as non-default", () => {
    const enUS = locales.find((l) => l.id === "en-US");
    expect(enUS!.is_default).toBe(false);
  });

  it("sets ar and ur-PK direction to rtl", () => {
    const ar = locales.find((l) => l.id === "ar");
    const ur = locales.find((l) => l.id === "ur-PK");
    expect(ar!.direction).toBe("rtl");
    expect(ur!.direction).toBe("rtl");
  });

  it("sets all other locales direction to ltr", () => {
    const ltr = locales.filter((l) => l.direction === "ltr");
    expect(ltr).toHaveLength(8);
  });

  it("includes endonym for each locale", () => {
    for (const l of locales) {
      expect(l.endonym).toBeTruthy();
      expect(typeof l.endonym).toBe("string");
    }
  });

  it("does not expose fallback_locale_id or display_order in response", () => {
    for (const l of locales) {
      expect(l).not.toHaveProperty("fallback_locale_id");
      expect(l).not.toHaveProperty("display_order");
      expect(l).not.toHaveProperty("status");
    }
  });
});
