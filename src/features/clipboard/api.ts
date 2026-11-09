import {
  type CreateClipboardInput,
  type CreatedClipboard,
  passwordSaltSchema,
  type RetrieveClipboardRequest,
  type RetrievedClipboard,
  retrieveClipboardSchema,
} from "@shared/clipboard";
import { createPasswordSalt, derivePasswordKey, validateNewPassword } from "./password";

export class ClipboardPasswordError extends Error {
  constructor(
    message: string,
    public readonly salt: string,
    public readonly incorrect: boolean,
  ) {
    super(message);
    this.name = "ClipboardPasswordError";
  }
}

async function request<T>(action: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/clipboard/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: signal ?? AbortSignal.timeout(15000),
  });
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Sharing is temporarily unavailable. Please try again later.");
  }
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Sharing is temporarily unavailable. Please try again later.";
    if (
      data &&
      typeof data === "object" &&
      "code" in data &&
      (data.code === "PASSWORD_REQUIRED" || data.code === "INCORRECT_PASSWORD") &&
      "passwordSalt" in data &&
      typeof data.passwordSalt === "string" &&
      passwordSaltSchema.safeParse(data.passwordSalt).success
    ) {
      throw new ClipboardPasswordError(
        error,
        data.passwordSalt,
        data.code === "INCORRECT_PASSWORD",
      );
    }
    throw new Error(error);
  }
  return data as T;
}

export async function createShare(input: CreateClipboardInput, password?: string) {
  if (password === undefined) return request<CreatedClipboard>("create", input);
  const error = validateNewPassword(password);
  if (error) throw new Error(error);
  const salt = createPasswordSalt();
  const key = await derivePasswordKey(password, salt);
  return request<CreatedClipboard>("create", { ...input, password: { salt, key } });
}
export async function retrieveShare(
  input: RetrieveClipboardRequest,
  signal?: AbortSignal,
  password?: string,
): Promise<RetrievedClipboard> {
  try {
    return await request<RetrievedClipboard>("retrieve", input, signal);
  } catch (error) {
    if (!(error instanceof ClipboardPasswordError) || !password) throw error;
    const passwordKey = await derivePasswordKey(password, error.salt);
    signal?.throwIfAborted();
    return request<RetrievedClipboard>("retrieve", { ...input, passwordKey }, signal);
  }
}
export const deleteShare = (receipt: CreatedClipboard) =>
  request<void>("delete", { token: receipt.token, deleteToken: receipt.deleteToken });

export function parseCredential(value: string, origin: string): RetrieveClipboardRequest {
  const text = value.trim();
  let credential: unknown;
  if (/^https?:\/\//i.test(text)) {
    const url = new URL(text);
    if (url.origin !== origin || url.pathname !== "/tools/clipboard")
      throw new Error("Use a share link from this Utility site.");
    credential = { token: url.hash.slice(1) };
  } else if (/^[a-f0-9]{48}$/.test(text)) credential = { token: text };
  else credential = { code: text };
  const parsed = retrieveClipboardSchema.safeParse(credential);
  if (!parsed.success) throw new Error("Enter a complete share link or a 6-character share code.");
  return parsed.data;
}
