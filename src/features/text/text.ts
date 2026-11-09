export const textOperations = [
  { value: "lowercase", label: "lowercase", group: "Case" },
  { value: "uppercase", label: "UPPERCASE", group: "Case" },
  { value: "title", label: "Title Case", group: "Case" },
  { value: "camel", label: "camelCase", group: "Case" },
  { value: "snake", label: "snake_case", group: "Case" },
  { value: "kebab", label: "kebab-case", group: "Case" },
  { value: "trim", label: "Trim lines", group: "Lines" },
  { value: "blank", label: "Remove blank lines", group: "Lines" },
  { value: "unique", label: "Remove duplicates", group: "Lines" },
  { value: "sort", label: "Sort A → Z", group: "Lines" },
  { value: "reverse-sort", label: "Sort Z → A", group: "Lines" },
] as const;

export type TextOperation = (typeof textOperations)[number]["value"];

function words(value: string): string[] {
  return value
    .replace(/([\p{Ll}\p{N}]\p{M}*)(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean);
}

function capitalize(value: string): string {
  const [first, ...rest] = Array.from(value);
  return first ? first.toUpperCase() + rest.join("").toLowerCase() : "";
}

export function transformText(value: string, operation: TextOperation): string {
  const lines = value.split(/\r\n|\n|\r/);
  switch (operation) {
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "title":
      return value
        .toLowerCase()
        .replace(
          /(^|[^\p{L}\p{N}\p{M}])(\p{L})/gu,
          (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
        );
    case "camel":
      return words(value)
        .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
        .join("");
    case "snake":
      return words(value)
        .map((word) => word.toLowerCase())
        .join("_");
    case "kebab":
      return words(value)
        .map((word) => word.toLowerCase())
        .join("-");
    case "trim":
      return lines.map((line) => line.trim()).join("\n");
    case "blank":
      return lines.filter((line) => line.trim().length > 0).join("\n");
    case "unique":
      return Array.from(new Set(lines)).join("\n");
    case "sort":
      return lines.sort((a, b) => a.localeCompare(b, "en")).join("\n");
    case "reverse-sort":
      return lines.sort((a, b) => b.localeCompare(a, "en")).join("\n");
  }
}

const characterSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function countText(value: string): {
  characters: number;
  words: number;
  lines: number;
  bytes: number;
} {
  return {
    characters: Array.from(characterSegmenter.segment(value)).length,
    words: Array.from(wordSegmenter.segment(value)).filter((part) => part.isWordLike).length,
    lines: value.length === 0 ? 0 : value.split(/\r\n|\n|\r/).length,
    bytes: new TextEncoder().encode(value).byteLength,
  };
}
