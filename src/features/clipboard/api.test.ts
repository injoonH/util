import { describe, expect, it } from "vitest";
import { parseCredential } from "./api";

describe("clipboard credential input", () => {
  const origin = "https://utility.example.com";
  const token = "a".repeat(48);
  it("accepts a same-site fragment link and normalized human code", () => {
    expect(parseCredential(`${origin}/tools/clipboard#${token}`, origin)).toEqual({ token });
    expect(parseCredential("abcd-efgh-jkmn", origin)).toEqual({ code: "ABCDEFGHJKMN" });
    expect(parseCredential(" abc-234 ", origin)).toEqual({ code: "ABC234" });
    expect(parseCredential("abc234", origin)).toEqual({ code: "ABC234" });
  });
  it("rejects another host, wrong page, or incomplete credential", () => {
    expect(() =>
      parseCredential(`https://other.example.com/tools/clipboard#${token}`, origin),
    ).toThrow();
    expect(() => parseCredential(`${origin}/#${token}`, origin)).toThrow();
    expect(() => parseCredential("1234", origin)).toThrow();
    expect(() => parseCredential("ABC-23", origin)).toThrow();
    expect(() => parseCredential("ABCD-234", origin)).toThrow();
    expect(() => parseCredential("javascript:alert(1)", origin)).toThrow();
  });
});
