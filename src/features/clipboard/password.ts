import {
  CLIPBOARD_PASSWORD_ITERATIONS,
  CLIPBOARD_PASSWORD_MAX_LENGTH,
  CLIPBOARD_PASSWORD_MIN_LENGTH,
  passwordSaltSchema,
} from "@shared/clipboard";

export function validateNewPassword(password: string): string | null {
  if (password.length < CLIPBOARD_PASSWORD_MIN_LENGTH || !password.trim())
    return `Use at least ${CLIPBOARD_PASSWORD_MIN_LENGTH} characters for the password.`;
  if (password.length > CLIPBOARD_PASSWORD_MAX_LENGTH)
    return `Use ${CLIPBOARD_PASSWORD_MAX_LENGTH} characters or fewer for the password.`;
  return null;
}

export function createPasswordSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// Stretch in the browser to keep a full-strength KDF within Workers Free's CPU
// budget. The API hashes this derived key again; it never stores the key itself.
export async function derivePasswordKey(password: string, salt: string): Promise<string> {
  passwordSaltSchema.parse(salt);
  if (!password || password.length > CLIPBOARD_PASSWORD_MAX_LENGTH)
    throw new Error("Enter the share password.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: CLIPBOARD_PASSWORD_ITERATIONS,
      salt: Uint8Array.from(salt.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
    },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
