import { describe, expect, it } from "vitest";
import { inspectUrl, transformUrlComponent } from "./url";

describe("URL component conversion", () => {
  it("round trips Unicode and encodes reserved delimiters", () => {
    const text = "한글 & café/東京? 👋";
    const encoded = transformUrlComponent(text, "encode");
    expect(encoded).toContain("%26");
    expect(encoded).toContain("%2F");
    expect(transformUrlComponent(encoded, "decode")).toBe(text);
  });

  it("keeps plus signs literal in component mode", () => {
    expect(transformUrlComponent("a+b", "decode")).toBe("a+b");
    expect(transformUrlComponent("a+b", "encode")).toBe("a%2Bb");
  });

  it("rejects malformed encodings and incomplete Unicode", () => {
    expect(() => transformUrlComponent("%E0%A4", "decode")).toThrow("invalid");
    expect(() => transformUrlComponent("%GG", "decode")).toThrow("invalid");
    expect(() => transformUrlComponent("\ud800", "encode")).toThrow("Unicode");
  });
});

describe("URL inspection", () => {
  it("retains duplicate and empty query parameters in their original order", () => {
    const result = inspectUrl(
      "https://example.com:8443/search?tag=one&tag=two&empty=&q=hello+world#top",
    );
    expect(result.parameters.map(({ key, value }) => [key, value])).toEqual([
      ["tag", "one"],
      ["tag", "two"],
      ["empty", ""],
      ["q", "hello world"],
    ]);
    expect(new Set(result.parameters.map(({ id }) => id)).size).toBe(4);
    expect(result.fields).toContainEqual({ label: "Port", value: "8443" });
    expect(result.fields).toContainEqual({ label: "Fragment", value: "top" });
  });

  it("requires an absolute URL", () => {
    expect(() => inspectUrl("/relative/path")).toThrow("absolute URL");
    expect(() => inspectUrl("")).toThrow("absolute URL");
  });

  it("inspects non-HTTP schemes as data", () => {
    expect(inspectUrl("mailto:hello@example.com").fields[0]).toEqual({
      label: "Scheme",
      value: "mailto:",
    });
  });
});
