import { describe, expect, it } from "vitest";
import { countText, transformText } from "./text";

describe("text transformations", () => {
  it("handles existing camel case and acronym boundaries", () => {
    expect(transformText("HTTPResponse userID", "snake")).toBe("http_response_user_id");
    expect(transformText("hello_world AGAIN", "camel")).toBe("helloWorldAgain");
    expect(transformText("Hello, café!", "kebab")).toBe("hello-café");
    expect(transformText("cafe\u0301World", "snake")).toBe("cafe\u0301_world");
  });

  it("preserves Unicode letters in case conversions", () => {
    expect(transformText("café world", "uppercase")).toBe("CAFÉ WORLD");
    expect(transformText("안녕하세요 world", "snake")).toBe("안녕하세요_world");
    expect(transformText("hELLO, wORLD!", "title")).toBe("Hello, World!");
  });

  it("treats duplicate lines as exact matches and preserves order", () => {
    expect(transformText("pear\r\napple\r\npear\r\nApple", "unique")).toBe("pear\napple\nApple");
  });

  it("normalizes line endings while trimming or removing empty lines", () => {
    expect(transformText("  first \r\n  \r\n second  ", "trim")).toBe("first\n\nsecond");
    expect(transformText(" first \n \nsecond", "blank")).toBe(" first \nsecond");
    expect(transformText("pear\napple\nbanana", "sort")).toBe("apple\nbanana\npear");
  });
});

describe("text counts", () => {
  it("counts visible graphemes rather than UTF-16 units", () => {
    const result = countText("👨‍👩‍👧‍👦e\u0301");
    expect(result.characters).toBe(2);
    expect(result.bytes).toBe(new TextEncoder().encode("👨‍👩‍👧‍👦e\u0301").length);
  });

  it("counts words, lines and empty input", () => {
    expect(countText("hello world\r\nagain")).toMatchObject({ words: 3, lines: 2 });
    expect(countText("")).toEqual({ characters: 0, words: 0, lines: 0, bytes: 0 });
  });
});
