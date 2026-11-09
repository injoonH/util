import { MAX_CLIPBOARD_BYTES } from "../../shared/clipboard";

// A JSON string can use six bytes (e.g. \\u0000) for a one-byte text character.
export const MAX_JSON_BODY_BYTES = MAX_CLIPBOARD_BYTES * 6 + 2048;

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestBodyError("Send a JSON request body.", 415);
  }

  const declaredSize = request.headers.get("Content-Length");
  if (declaredSize && Number(declaredSize) > MAX_JSON_BODY_BYTES) {
    throw new RequestBodyError("Request body is too large.", 413);
  }

  if (!request.body) throw new RequestBodyError("Send a JSON request body.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new RequestBodyError("Invalid JSON request body.", 400);
  }
}
