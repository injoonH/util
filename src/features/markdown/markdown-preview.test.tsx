import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./markdown-preview";

describe("Markdown preview", () => {
  it("supports tables, task lists, and highlighted code", () => {
    const output = renderToStaticMarkup(
      <MarkdownPreview
        value={
          "| Key | Value |\n| --- | --- |\n| A | B |\n\n- [x] Done\n\n```js\nconst value = 1;\n```"
        }
      />,
    );
    expect(output).toContain("<table>");
    expect(output).toContain('type="checkbox"');
    expect(output).toContain("hljs-keyword");
  });

  it("does not render raw HTML or unsafe link destinations", () => {
    const output = renderToStaticMarkup(
      <MarkdownPreview
        value={
          '<script>alert(1)</script>\n\n<img src="https://example.com/raw.png" onerror="alert(1)">\n\n[click](javascript:alert%281%29)'
        }
      />,
    );
    expect(output).not.toContain("<script");
    expect(output).not.toContain("<img");
    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("onerror");
  });

  it("does not load images until explicitly enabled", () => {
    const output = renderToStaticMarkup(
      <MarkdownPreview value="![external image](https://example.com/image.png)" />,
    );
    expect(output).not.toContain("<img");
    expect(output).not.toContain("https://example.com/image.png");
    expect(output).toContain("Load images");
  });

  it("renders enabled images without sending a referrer", () => {
    const output = renderToStaticMarkup(
      <MarkdownPreview value="![external image](https://example.com/image.png)" allowImages />,
    );
    expect(output).toContain('<img src="https://example.com/image.png"');
    expect(output).toContain('referrerPolicy="no-referrer"');
  });
});
