import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatDuration,
  formatCountdown,
} from "../src/utils/format";

describe("format utils", () => {
  describe("formatDate", () => {
    it("formats date in zh-CN", () => {
      const result = formatDate("2026-09-23T10:00:00Z", "zh-CN");
      expect(result).toContain("2026");
      expect(result).toContain("9");
      expect(result).toContain("23");
    });

    it("formats date in en-US", () => {
      const result = formatDate("2026-09-23T10:00:00Z", "en-US");
      expect(result).toContain("2026");
    });

    it("accepts Date object", () => {
      const result = formatDate(new Date("2026-01-15"), "en-US");
      expect(result).toContain("2026");
    });
  });

  describe("formatDateTime", () => {
    it("includes time components", () => {
      const result = formatDateTime("2026-09-23T14:30:00", "zh-CN");
      expect(result).toContain("14");
    });
  });

  describe("formatNumber", () => {
    it("formats integers", () => {
      expect(formatNumber(1000, "en-US")).toBe("1,000");
    });

    it("formats in zh-CN", () => {
      expect(formatNumber(1234567, "zh-CN")).toBe("1,234,567");
    });
  });

  describe("formatPercent", () => {
    it("formats 60 as 60%", () => {
      const result = formatPercent(60, "en-US");
      expect(result).toContain("60");
    });

    it("formats 100 as 100%", () => {
      const result = formatPercent(100, "zh-CN");
      expect(result).toContain("100");
    });
  });

  describe("formatDuration", () => {
    it("formats seconds only", () => {
      expect(formatDuration(45, "en-US")).toBe("45s");
    });

    it("formats minutes:seconds", () => {
      expect(formatDuration(90, "en-US")).toBe("1:30");
    });

    it("formats hours", () => {
      const result = formatDuration(3600, "en-US");
      expect(result).toContain("1");
    });
  });

  describe("formatCountdown", () => {
    it("formats MM:SS for sub-hour durations", () => {
      expect(formatCountdown(90)).toBe("1:30");
    });

    it("formats HH:MM:SS for hour+ durations", () => {
      expect(formatCountdown(3661)).toBe("1:01:01");
    });

    it("formats 0 seconds", () => {
      expect(formatCountdown(0)).toBe("0:00");
    });

    it("formats 8400 seconds (HSK6 duration)", () => {
      expect(formatCountdown(8400)).toBe("2:20:00");
    });
  });
});
