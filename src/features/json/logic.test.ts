import { describe, expect, it } from "vitest";
import { JsonInputError, transformJson } from "./logic";

describe("JSON formatting", () => {
  it("formats with the selected indentation", () => {
    expect(transformJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(transformJson('{"a":1}', "format", "4")).toBe('{\n    "a": 1\n}');
    expect(transformJson('{"a":1}', "format", "tab")).toBe('{\n\t"a": 1\n}');
  });

  it("preserves large integers, exact decimals, and exponent notation", () => {
    const source =
      '{"id":9007199254740993123456789,"decimal":0.1234567890123456789,"exp":1e+999,"negative":-0}';
    expect(transformJson(transformJson(source), "minify")).toBe(source);
  });

  it("minifies whitespace outside strings only", () => {
    expect(transformJson(' { "a" : "spaces stay here", "b": "\\u0041\\n" } ', "minify")).toBe(
      '{"a":"spaces stay here","b":"\\u0041\\n"}',
    );
  });

  it.each([
    '{"a":1,}',
    "[1,]",
    '{/* comment */"a":1}',
    '{"a":undefined}',
    '{"a":01}',
    "true false",
    "",
    '"bad\nstring"',
  ])("rejects non-JSON input %s", (input) =>
    expect(() => transformJson(input)).toThrow(JsonInputError),
  );

  it("reports a useful source location", () => {
    try {
      transformJson('{\n  "a":\n}');
      expect.unreachable("Expected a validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(JsonInputError);
      expect((error as JsonInputError).line).toBe(3);
      expect((error as JsonInputError).column).toBe(1);
    }
  });

  it("accepts primitive values and preserves escaped strings", () => {
    for (const value of ["null", "true", "123", '"hello\\nworld"']) {
      expect(transformJson(value, "minify")).toBe(value);
    }
  });
});
