import { z } from "zod";

export const MAX_CLIPBOARD_BYTES = 64 * 1024;
export const CLIPBOARD_EXPIRATIONS = [600, 3600, 86400] as const;
export const DEFAULT_CLIPBOARD_EXPIRATION = 3600;
export const CLIPBOARD_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CLIPBOARD_CODE_LENGTH = 6;
export const CLIPBOARD_PASSWORD_ITERATIONS = 600_000;
export const CLIPBOARD_PASSWORD_MIN_LENGTH = 8;
export const CLIPBOARD_PASSWORD_MAX_LENGTH = 256;

const passwordKeySchema = z.string().regex(/^[a-f0-9]{64}$/, "Invalid password key.");
export const passwordSaltSchema = z.string().regex(/^[a-f0-9]{32}$/, "Invalid password salt.");

export function clipboardByteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

export function normalizeClipboardCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/, "Invalid share token.");

export const createClipboardSchema = z
  .object({
    content: z
      .string()
      .min(1, "Enter some text to share.")
      .refine(
        (content) => clipboardByteLength(content) <= MAX_CLIPBOARD_BYTES,
        "Text is limited to 64 KiB of UTF-8 data.",
      ),
    expiresIn: z
      .union([z.literal(600), z.literal(3600), z.literal(86400)])
      .default(DEFAULT_CLIPBOARD_EXPIRATION),
    includeCode: z.boolean().default(false),
    password: z.object({ salt: passwordSaltSchema, key: passwordKeySchema }).strict().optional(),
  })
  .strict();

export const retrieveClipboardSchema = z.union([
  z.object({ token: tokenSchema, passwordKey: passwordKeySchema.optional() }).strict(),
  z
    .object({
      code: z
        .string()
        .max(32, "Invalid share code.")
        .transform(normalizeClipboardCode)
        .pipe(
          z
            .string()
            .regex(
              /^(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}|[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12})$/,
              "Invalid share code.",
            ),
        ),
      passwordKey: passwordKeySchema.optional(),
    })
    .strict(),
]);

export const deleteClipboardSchema = z
  .object({ token: tokenSchema, deleteToken: tokenSchema })
  .strict();

export type CreateClipboardInput = z.input<typeof createClipboardSchema>;
export type CreateClipboardRequest = z.output<typeof createClipboardSchema>;
export type RetrieveClipboardRequest = z.output<typeof retrieveClipboardSchema>;
export type DeleteClipboardRequest = z.output<typeof deleteClipboardSchema>;

export interface CreatedClipboard {
  token: string;
  code: string | null;
  deleteToken: string;
  expiresAt: string;
  passwordProtected?: boolean;
}

export interface RetrievedClipboard {
  content: string;
  expiresAt: string;
}

export interface ClipboardApiError {
  error: string;
  code?: "PASSWORD_REQUIRED" | "INCORRECT_PASSWORD" | "PASSWORD_RATE_LIMITED";
  passwordSalt?: string;
}
