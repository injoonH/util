import { timingSafeEqual } from "node:crypto";
import {
  CLIPBOARD_CODE_ALPHABET,
  CLIPBOARD_CODE_LENGTH,
  type CreateClipboardRequest,
  type CreatedClipboard,
  type DeleteClipboardRequest,
  type RetrieveClipboardRequest,
  type RetrievedClipboard,
} from "../../shared/clipboard";
import { database } from "../db";
import type { Env } from "../env";
import { clipboardRepository } from "./repository";

export class ClipboardServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 404 | 429 | 503,
    public readonly code?: "PASSWORD_REQUIRED" | "INCORRECT_PASSWORD" | "PASSWORD_RATE_LIMITED",
    public readonly passwordSalt?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ClipboardServiceError";
  }
}

export const UNAVAILABLE_SHARE_MESSAGE = "Share unavailable or expired.";

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function randomCode(): string {
  // The alphabet has 32 symbols, so masking a uniform byte introduces no bias.
  return Array.from(
    crypto.getRandomValues(new Uint8Array(CLIPBOARD_CODE_LENGTH)),
    (byte) => CLIPBOARD_CODE_ALPHABET[byte & 31],
  ).join("");
}

export async function hashCredential(
  kind: "access" | "code" | "delete" | "password",
  value: string,
) {
  const bytes = new TextEncoder().encode(`${kind}:${value}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed/i.test(error.message) || isUniqueConstraintError(error.cause);
}

export function clipboardService(env: Pick<Env, "DB">, now: () => number = Date.now) {
  const repository = clipboardRepository(database(env.DB));

  return {
    async create(input: CreateClipboardRequest): Promise<CreatedClipboard> {
      const createdAt = now();
      const expiresAt = createdAt + input.expiresIn * 1000;
      const passwordHash = input.password
        ? await hashCredential("password", `${input.password.salt}:${input.password.key}`)
        : null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const token = randomToken();
        const deleteToken = randomToken();
        const code = input.includeCode ? randomCode() : null;
        const [tokenHash, deleteTokenHash, codeHash] = await Promise.all([
          hashCredential("access", token),
          hashCredential("delete", deleteToken),
          code ? hashCredential("code", code) : Promise.resolve(null),
        ]);

        try {
          const inserted = await repository.create({
            tokenHash,
            codeHash,
            deleteTokenHash,
            content: input.content,
            createdAt,
            expiresAt,
            passwordSalt: input.password?.salt,
            passwordHash,
          });

          if (!inserted) {
            throw new ClipboardServiceError(
              "Clipboard storage is full. Please try again later.",
              503,
            );
          }

          return {
            token,
            code: code ? `${code.slice(0, 3)}-${code.slice(3)}` : null,
            deleteToken,
            expiresAt: new Date(expiresAt).toISOString(),
            passwordProtected: Boolean(input.password),
          };
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }

      throw new ClipboardServiceError("Sharing is temporarily unavailable. Please try again.", 503);
    },

    async retrieve(input: RetrieveClipboardRequest): Promise<RetrievedClipboard> {
      const credential =
        "token" in input
          ? { tokenHash: await hashCredential("access", input.token) }
          : { codeHash: await hashCredential("code", input.code) };
      const currentTime = now();
      const share = await repository.retrieve(credential, currentTime);
      if (!share) throw new ClipboardServiceError(UNAVAILABLE_SHARE_MESSAGE, 404);
      if (share.passwordHash !== null || share.passwordSalt !== null) {
        if (!share.passwordHash || !share.passwordSalt)
          throw new ClipboardServiceError(
            "Sharing is temporarily unavailable. Please try again later.",
            503,
          );
        if (share.passwordFailures >= 5 && share.passwordWindowStart + 60_000 > currentTime) {
          throw new ClipboardServiceError(
            "Too many password attempts for this share. Please wait a minute and try again.",
            429,
            "PASSWORD_RATE_LIMITED",
            undefined,
            Math.max(1, Math.ceil((share.passwordWindowStart + 60_000 - currentTime) / 1000)),
          );
        }
        if (!input.passwordKey)
          throw new ClipboardServiceError(
            "This share requires a password.",
            401,
            "PASSWORD_REQUIRED",
            share.passwordSalt,
          );
        const candidateHash = await hashCredential(
          "password",
          `${share.passwordSalt}:${input.passwordKey}`,
        );
        if (
          !timingSafeEqual(
            new TextEncoder().encode(candidateHash),
            new TextEncoder().encode(share.passwordHash),
          )
        ) {
          await repository.recordPasswordFailure(share.tokenHash, currentTime);
          throw new ClipboardServiceError(
            "Incorrect password. Please try again.",
            403,
            "INCORRECT_PASSWORD",
            share.passwordSalt,
          );
        }
        if (share.passwordFailures > 0) await repository.resetPasswordFailures(share.tokenHash);
      }
      return { content: share.content, expiresAt: new Date(share.expiresAt).toISOString() };
    },

    async delete(input: DeleteClipboardRequest): Promise<void> {
      const [tokenHash, deleteTokenHash] = await Promise.all([
        hashCredential("access", input.token),
        hashCredential("delete", input.deleteToken),
      ]);
      if (!(await repository.delete(tokenHash, deleteTokenHash))) {
        throw new ClipboardServiceError(UNAVAILABLE_SHARE_MESSAGE, 404);
      }
    },

    cleanup() {
      return repository.cleanup(now());
    },
  };
}
