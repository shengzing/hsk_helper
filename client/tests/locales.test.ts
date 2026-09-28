import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  isSupportedLocale,
  getLocaleDirection,
  isRTL,
  getLocaleConfig,
} from "../src/i18n/locales";

describe("Locale configuration", () => {
  it("defines exactly 12 supported locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(12);
  });

  it("includes all expected locale IDs in display_order", () => {
    const ids = SUPPORTED_LOCALES.map((l) => l.id);
    expect(ids).toEqual([
      "en-US",
      "zh-CN",
      "ja-JP",
      "ko-KR",
      "ru-RU",
      "hi-IN",
      "es",
      "fr-FR",
      "ar",
      "bn-BD",
      "pt-BR",
      "ur-PK",
    ]);
  });

  it("marks zh-CN as default", () => {
    const zhCN = SUPPORTED_LOCALES.find((l) => l.id === "zh-CN");
    expect(zhCN?.isDefault).toBe(true);
  });

  it("marks en-US as non-default", () => {
    const enUS = SUPPORTED_LOCALES.find((l) => l.id === "en-US");
    expect(enUS?.isDefault).toBe(false);
  });

  it("sets ar and ur-PK as rtl", () => {
    const rtlLocales = SUPPORTED_LOCALES.filter((l) => l.direction === "rtl");
    expect(rtlLocales.map((l) => l.id).sort()).toEqual(["ar", "ur-PK"]);
  });

  it("sets all others as ltr", () => {
    const ltrLocales = SUPPORTED_LOCALES.filter((l) => l.direction === "ltr");
    expect(ltrLocales).toHaveLength(10);
  });

  it("isSupportedLocale recognizes known locales", () => {
    expect(isSupportedLocale("zh-CN")).toBe(true);
    expect(isSupportedLocale("ar")).toBe(true);
    expect(isSupportedLocale("en-US")).toBe(true);
    expect(isSupportedLocale("ur-PK")).toBe(true);
  });

  it("isSupportedLocale rejects unknown locales", () => {
    expect(isSupportedLocale("xx-XX")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });

  it("getLocaleDirection returns correct values", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("ur-PK")).toBe("rtl");
    expect(getLocaleDirection("zh-CN")).toBe("ltr");
    expect(getLocaleDirection("en-US")).toBe("ltr");
  });

  it("isRTL returns correct booleans", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("ur-PK")).toBe(true);
    expect(isRTL("zh-CN")).toBe(false);
    expect(isRTL("en-US")).toBe(false);
  });

  it("falls back to ltr for unknown locale", () => {
    expect(getLocaleDirection("xx-XX")).toBe("ltr");
    expect(isRTL("xx-XX")).toBe(false);
  });

  it("getLocaleConfig returns config for known locale", () => {
    const config = getLocaleConfig("ar");
    expect(config).toBeDefined();
    expect(config!.direction).toBe("rtl");
  });

  it("getLocaleConfig returns undefined for unknown locale", () => {
    expect(getLocaleConfig("xx-XX")).toBeUndefined();
  });

  it("exports correct default and fallback constants", () => {
    expect(DEFAULT_LOCALE).toBe("zh-CN");
    expect(FALLBACK_LOCALE).toBe("en-US");
  });

  it("all locales have non-empty endonym", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(l.endonym.length).toBeGreaterThan(0);
    }
  });

  it("all locales have non-empty flag", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(l.flag.length).toBeGreaterThan(0);
    }
  });

  it("all locales have unique display_order", () => {
    const orders = SUPPORTED_LOCALES.map((l) => l.displayOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
