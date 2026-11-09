import { describe, expect, it } from "vitest";
import {
  detectSourceFormat,
  formatBytes,
  MAX_FILE_BYTES,
  MAX_INPUT_BYTES,
  outputName,
  parsePageRange,
  uniqueName,
  validateDimensions,
  validateFiles,
} from "./logic";

describe("PDF page selection", () => {
  it("supports all pages, ranges, explicit order and deduplication", () => {
    expect(parsePageRange("", 3)).toEqual([1, 2, 3]);
    expect(parsePageRange("ALL", 2)).toEqual([1, 2]);
    expect(parsePageRange("3, 1-2, 2", 4)).toEqual([3, 1, 2]);
  });
  it.each(["0", "5", "3-1", "1,", "one", "1.5", "1-5", "-1", "1-2-3"])(
    "rejects an invalid range: %s",
    (value) => {
      expect(() => parsePageRange(value, 4)).toThrow();
    },
  );
  it("bounds expansion before allocating large page arrays", () => {
    expect(() => parsePageRange("", 1_000_000)).toThrow("at most 100");
    expect(() => parsePageRange("1-999999", 1_000_000)).toThrow("at most 100");
    expect(parsePageRange("999999", 1_000_000)).toEqual([999999]);
    expect(() => parsePageRange("1,2,3", 4, 2)).toThrow();
    expect(() => parsePageRange("1", 0)).toThrow();
  });
});

describe("file content detection", () => {
  const bytes = (value: string) => new TextEncoder().encode(value);
  it("recognizes raster formats by their signatures", () => {
    expect(
      detectSourceFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
    expect(detectSourceFormat(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("jpeg");
    expect(detectSourceFormat(bytes("GIF89a"))).toBe("gif");
    expect(detectSourceFormat(bytes("BMxyz"))).toBe("bmp");
    expect(detectSourceFormat(bytes("RIFF1234WEBP"))).toBe("webp");
    expect(detectSourceFormat(bytes("1234ftypavif"))).toBe("avif");
  });
  it("recognizes PDF content and rejects other files or incomplete signatures", () => {
    expect(detectSourceFormat(bytes("%PDF-1.7\n"))).toBe("pdf");
    expect(detectSourceFormat(new Uint8Array())).toBeNull();
    expect(detectSourceFormat(bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectSourceFormat(bytes("A document called photograph.jpg"))).toBeNull();
    expect(detectSourceFormat(bytes("RIFF1234WAVE"))).toBeNull();
  });
});

describe("conversion bounds", () => {
  it("checks input counts, byte sizes and totals", () => {
    expect(() => validateFiles([{ name: "photo.jpg", size: MAX_FILE_BYTES }])).not.toThrow();
    expect(() => validateFiles([{ name: "empty.png", size: 0 }])).toThrow("empty");
    expect(() => validateFiles([{ name: "huge.pdf", size: MAX_FILE_BYTES + 1 }])).toThrow("25 MiB");
    expect(() =>
      validateFiles(Array.from({ length: 11 }, () => ({ name: "x.png", size: 1 }))),
    ).toThrow("10");
    expect(() =>
      validateFiles(
        Array.from({ length: 3 }, () => ({ name: "x.pdf", size: MAX_INPUT_BYTES / 3 + 1 })),
      ),
    ).toThrow("50 MiB");
  });
  it("bounds canvas dimensions and pixel counts", () => {
    expect(() => validateDimensions(4000, 4000)).not.toThrow();
    for (const [width, height] of [
      [0, 1],
      [1.5, 2],
      [8193, 1],
      [4001, 4000],
      [Number.NaN, 10],
      [Infinity, 10],
    ])
      expect(() => validateDimensions(width, height)).toThrow();
  });
});

describe("download names", () => {
  it("uses the actual output extension and page number, preserving Unicode names", () => {
    expect(outputName("사진.JPG", "png")).toBe("사진.png");
    expect(outputName("report.pdf", "jpeg", 3)).toBe("report-page-003.jpg");
    expect(outputName("picture", "webp")).toBe("picture.webp");
    expect(outputName("CON.jpg", "pdf")).toBe("file-CON.pdf");
  });
  it("removes paths and control characters from archive filenames", () => {
    const name = outputName("../../folder\\note\n.png", "jpeg");
    expect(name).not.toMatch(/[/\\\n]/);
    expect(name).not.toMatch(/^\./);
    expect(name).toMatch(/\.jpg$/);
  });
  it("prevents case-insensitive duplicate downloads and ZIP entries", () => {
    const used = new Set<string>();
    expect(uniqueName("photo.png", used)).toBe("photo.png");
    expect(uniqueName("PHOTO.png", used)).toBe("PHOTO (2).png");
    expect(uniqueName("photo.png", used)).toBe("photo (3).png");
    expect(formatBytes(1024)).toBe("1.0 KiB");
  });
});
