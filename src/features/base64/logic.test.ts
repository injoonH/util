import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "./logic";

describe("Base64 text conversion", () => {
  it("encodes known values and preserves Unicode", () => {
    expect(encodeBase64("hello")).toBe("aGVsbG8=");
    for (const input of ["", "안녕하세요 👋", "café\n東京", "\u0000text", "\uFEFFtext"]) {
      expect(decodeBase64(encodeBase64(input))).toBe(input);
    }
  });

  it("handles large inputs without spreading all bytes at once", () => {
    const input = "한글🙂".repeat(20_000);
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it("uses the URL-safe alphabet without padding", () => {
    expect(encodeBase64("👋", "base64url")).toBe("8J-Riw");
    expect(decodeBase64("8J-Riw", "base64url")).toBe("👋");
    expect(() => decodeBase64("8J+Riw==", "base64url")).toThrow();
    expect(() => decodeBase64("8J-Riw", "base64")).toThrow();
  });

  it("accepts omitted padding and wrapped input", () => {
    expect(decodeBase64("aGVs\nbG8")).toBe("hello");
    expect(decodeBase64(" Zg==\r\n")).toBe("f");
  });

  it.each(["A", "Zg=", "Zg===", "Z=g=", "====", "Zg==!", "Zh==", "Zm9="])(
    "rejects malformed input %s",
    (value) => expect(() => decodeBase64(value)).toThrow(),
  );

  it("rejects valid binary Base64 that is not UTF-8", () => {
    expect(() => decodeBase64("/w==")).toThrow("not valid UTF-8");
  });
});
