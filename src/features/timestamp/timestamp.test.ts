import { describe, expect, it } from "vitest";
import { formatInTimeZone, parseEpoch, parseUtcDate, secondsFromMilliseconds } from "./timestamp";

describe("epoch parsing", () => {
  it("preserves epoch zero and negative fractional seconds", () => {
    expect(parseEpoch("0", "seconds")).toBe(0);
    expect(parseEpoch("-0.001", "seconds")).toBe(-1);
    expect(parseEpoch("1700000000.123", "seconds")).toBe(1_700_000_000_123);
    expect(secondsFromMilliseconds(-1)).toBe("-0.001");
    expect(secondsFromMilliseconds(1_700_000_000_123)).toBe("1700000000.123");
  });

  it("uses the selected unit explicitly", () => {
    expect(parseEpoch("1000", "seconds")).toBe(1_000_000);
    expect(parseEpoch("1000", "milliseconds")).toBe(1_000);
    expect(parseEpoch("0000000000000000000000000000000", "milliseconds")).toBe(0);
  });

  it("rejects ambiguous, fractional millisecond and out-of-range inputs", () => {
    for (const input of ["", "Infinity", "1e10", "123abc", "1.1234"]) {
      expect(() => parseEpoch(input, "seconds")).toThrow();
    }
    expect(() => parseEpoch("1.5", "milliseconds")).toThrow("whole number");
    expect(() => parseEpoch("8640000000000001", "milliseconds")).toThrow("range");
    expect(parseEpoch("8640000000000000", "milliseconds")).toBe(8_640_000_000_000_000);
  });
});

describe("UTC dates and timezone display", () => {
  it("parses date input in UTC regardless of the machine timezone", () => {
    expect(parseUtcDate("1970-01-01T00:00")).toBe(0);
    expect(parseUtcDate("2000-02-29T12:34:56.123")).toBe(Date.UTC(2000, 1, 29, 12, 34, 56, 123));
    expect(new Date(parseUtcDate("0099-01-01T00:00")).getUTCFullYear()).toBe(99);
  });

  it("rejects normalized invalid calendar dates", () => {
    expect(() => parseUtcDate("2025-02-29T00:00")).toThrow("does not exist");
    expect(() => parseUtcDate("2026-04-31T00:00")).toThrow("does not exist");
    expect(() => parseUtcDate("2026-10-25T25:00")).toThrow("not a valid");
  });

  it("applies zone offsets including daylight saving time", () => {
    expect(formatInTimeZone(0, "Asia/Seoul")).toContain("09:00:00.000");
    expect(formatInTimeZone(Date.UTC(2026, 6, 1, 12), "America/New_York")).toContain(
      "08:00:00.000",
    );
    expect(formatInTimeZone(Date.UTC(2026, 0, 1, 12), "America/New_York")).toContain(
      "07:00:00.000",
    );
  });

  it("labels dates before the common era", () => {
    const date = new Date(0);
    date.setUTCFullYear(-400, 0, 1);
    expect(formatInTimeZone(date.getTime(), "UTC")).toContain("BC");
  });
});
