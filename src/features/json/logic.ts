import {
  applyEdits,
  createScanner,
  format,
  type ParseError,
  ParseErrorCode,
  parseTree,
  SyntaxKind,
} from "jsonc-parser";

export type JsonMode = "format" | "minify";
export type JsonIndent = "2" | "4" | "tab";

const errorMessages: Record<ParseErrorCode, string> = {
  [ParseErrorCode.InvalidSymbol]: "Unexpected character.",
  [ParseErrorCode.InvalidNumberFormat]: "Invalid JSON number.",
  [ParseErrorCode.PropertyNameExpected]: "Expected a property name in double quotes.",
  [ParseErrorCode.ValueExpected]: "Expected a JSON value.",
  [ParseErrorCode.ColonExpected]: "Expected a colon after the property name.",
  [ParseErrorCode.CommaExpected]: "Expected a comma between values.",
  [ParseErrorCode.CloseBraceExpected]: "Expected a closing brace }.",
  [ParseErrorCode.CloseBracketExpected]: "Expected a closing bracket ].",
  [ParseErrorCode.EndOfFileExpected]: "Unexpected content after the JSON value.",
  [ParseErrorCode.InvalidCommentToken]: "Comments are not allowed in JSON.",
  [ParseErrorCode.UnexpectedEndOfComment]: "Unfinished comment. JSON does not allow comments.",
  [ParseErrorCode.UnexpectedEndOfString]: "Missing the closing double quote.",
  [ParseErrorCode.UnexpectedEndOfNumber]: "Incomplete JSON number.",
  [ParseErrorCode.InvalidUnicode]: "Invalid Unicode escape sequence.",
  [ParseErrorCode.InvalidEscapeCharacter]: "Invalid escape sequence.",
  [ParseErrorCode.InvalidCharacter]: "Invalid character in a string.",
};

export class JsonInputError extends Error {
  readonly line: number;
  readonly column: number;
  readonly offset: number;

  constructor(input: string, error: ParseError) {
    const preceding = input.slice(0, error.offset);
    const lines = preceding.split(/\r\n|\r|\n/);
    const line = lines.length;
    const column = Array.from(lines[lines.length - 1] ?? "").length + 1;
    super(`${errorMessages[error.error]} Line ${line}, column ${column}.`);
    this.name = "JsonInputError";
    this.line = line;
    this.column = column;
    this.offset = error.offset;
  }
}

/** Edit the source text rather than serializing JS numbers and losing precision. */
export function transformJson(
  input: string,
  mode: JsonMode = "format",
  indentation: JsonIndent = "2",
): string {
  const errors: ParseError[] = [];
  parseTree(input, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });
  if (errors[0]) throw new JsonInputError(input, errors[0]);

  if (mode === "format") {
    return applyEdits(
      input,
      format(input, undefined, {
        insertSpaces: indentation !== "tab",
        tabSize: indentation === "4" ? 4 : 2,
        eol: "\n",
      }),
    ).trim();
  }

  const scanner = createScanner(input, false);
  const chunks: string[] = [];
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token === SyntaxKind.Trivia || token === SyntaxKind.LineBreakTrivia) continue;
    chunks.push(
      input.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength()),
    );
  }
  return chunks.join("");
}
