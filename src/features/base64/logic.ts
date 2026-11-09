export type Base64Variant = "base64" | "base64url";

/** Convert text through UTF-8 bytes, so non-ASCII characters round-trip. */
export function encodeBase64(input: string, variant: Base64Variant = "base64"): string {
  const bytes = new TextEncoder().encode(input);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  const encoded = btoa(chunks.join(""));
  return variant === "base64url"
    ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : encoded;
}

export function decodeBase64(input: string, variant: Base64Variant = "base64"): string {
  const compact = input.replace(/[\t\n\f\r ]/g, "");
  if (!compact) return "";

  const alphabet = variant === "base64url" ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/;
  if (!alphabet.test(compact)) {
    throw new Error(
      `Use the ${variant === "base64url" ? "Base64URL alphabet (letters, digits, - and _)" : "Base64 alphabet (letters, digits, + and /)"}, with optional padding at the end.`,
    );
  }

  const unpadded = compact.replace(/=+$/, "");
  const suppliedPadding = compact.length - unpadded.length;
  const requiredPadding = (4 - (unpadded.length % 4)) % 4;
  if (unpadded.length % 4 === 1 || (suppliedPadding > 0 && suppliedPadding !== requiredPadding)) {
    throw new Error("Invalid Base64 length or padding. Check the complete value.");
  }

  const normalized = unpadded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat(requiredPadding));
  // Reject non-zero unused bits instead of silently accepting corrupt encodings.
  if (btoa(binary).replace(/=+$/, "") !== normalized) {
    throw new Error("Invalid Base64 padding bits. Check the last characters.");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error(
      "This value contains binary data, not valid UTF-8 text. This tool decodes text only.",
    );
  }
}
