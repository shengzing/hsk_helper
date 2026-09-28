import { describe, expect, it } from "vitest";
import { RESOURCES } from "../src/i18n/config";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n key parity across all supported locales", () => {
  const localeIds = SUPPORTED_LOCALES.map((locale) => locale.id);
  const bundles = localeIds.map((id) => RESOURCES[id]?.common as Record<string, unknown>);
  const zhBundle = bundles[localeIds.indexOf("zh-CN")];
  const zhKeys = flattenKeys(zhBundle);
  const zhKeySet = new Set(zhKeys);

  it("all twelve locales have a common bundle", () => {
    expect(localeIds).toHaveLength(12);
    bundles.forEach((bundle) => expect(bundle).toBeTruthy());
  });

  it("all locales have the same number of keys as zh-CN", () => {
    bundles.forEach((bundle) => {
      expect(flattenKeys(bundle)).toHaveLength(zhKeys.length);
    });
  });

  it("all locales cover every zh-CN key", () => {
    bundles.forEach((bundle) => {
      const missing = flattenKeys(bundle).filter((key) => !zhKeySet.has(key));
      expect(missing).toEqual([]);
    });
  });

  it("all locales cover the expected top-level modules", () => {
    const expectedTop = [
      "admin",
      "app",
      "auth",
      "bank",
      "common",
      "error",
      "exam",
      "feedback",
      "knowledge",
      "language",
      "nav",
      "paper",
    "report",
    "subscription",
  ].sort();
    bundles.forEach((bundle) => {
      expect(Object.keys(bundle).sort()).toEqual(expectedTop);
    });
  });
});
