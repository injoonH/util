import { readdir, readFile } from "node:fs/promises";
import { URL as NodeURL } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_STORED_SHARES } from "../../server/clipboard/repository";
import {
  clipboardService,
  hashCredential,
  UNAVAILABLE_SHARE_MESSAGE,
} from "../../server/clipboard/service";
import type { Env, RateLimiter } from "../../server/env";
import { createApp } from "../../server/index";
import { MAX_JSON_BODY_BYTES } from "../../server/middleware/json-body";
import type { CreatedClipboard } from "../../shared/clipboard";
import { derivePasswordKey } from "../../src/features/clipboard/password";

const BASE_TIME = Date.UTC(2026, 9, 25, 12);
let now = BASE_TIME;
const app = createApp({ now: () => now });
let miniflare: Miniflare;
let db: D1Database;
let createAllowed = true;
let readAllowed = true;
const passwordSalt = "ab".repeat(16);
const password = "Shared only with the recipient 🔐";
let passwordKey: string;

const createLimiter: RateLimiter = { limit: async () => ({ success: createAllowed }) };
const readLimiter: RateLimiter = { limit: async () => ({ success: readAllowed }) };

function bindings(): Env {
  return {
    DB: db,
    CLIPBOARD_CREATE_LIMITER: createLimiter,
    CLIPBOARD_READ_LIMITER: readLimiter,
  };
}

function request(endpoint: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    `https://utility.test/api/clipboard/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers },
      body: JSON.stringify(body),
    },
    bindings(),
  );
}

async function create(content = "A note from one device to another", extras = {}) {
  const response = await request("create", { content, ...extras });
  expect(response.status).toBe(201);
  return (await response.json()) as CreatedClipboard;
}

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('integration tests'); } }",
    compatibilityDate: "2025-03-01",
    d1Databases: { DB: "clipboard-tests" },
    cf: false,
  });
  db = (await miniflare.getD1Database("DB")) as unknown as D1Database;
  const directory = new NodeURL("../../migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    const migration = await readFile(new NodeURL(file, directory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.prepare(statement.trim()).run();
    }
  }
  passwordKey = await derivePasswordKey(password, passwordSalt);
}, 30_000);

beforeEach(async () => {
  now = BASE_TIME;
  createAllowed = true;
  readAllowed = true;
  await db.prepare("DELETE FROM clipboard_shares").run();
});

afterAll(async () => {
  await miniflare?.dispose();
});

afterEach(() => vi.restoreAllMocks());

describe("anonymous clipboard API with real D1 storage", () => {
  it("shares exact Unicode text between independent requests and stores credential hashes", async () => {
    const content = "안녕하세요 👋\n  preserve spacing\tand symbols: <script>alert(1)</script>";
    const share = await create(content);
    expect(share.token).toMatch(/^[a-f0-9]{48}$/);
    expect(share.deleteToken).toMatch(/^[a-f0-9]{48}$/);
    expect(share.deleteToken).not.toBe(share.token);
    expect(share.code).toBeNull();
    expect(share.expiresAt).toBe(new Date(BASE_TIME + 3_600_000).toISOString());

    const received = await request("retrieve", { token: share.token });
    expect(received.status).toBe(200);
    expect(await received.json()).toEqual({ content, expiresAt: share.expiresAt });
    expect(received.headers.get("Cache-Control")).toBe("no-store");
    expect(received.headers.get("Referrer-Policy")).toBe("no-referrer");

    const saved = await db.prepare("SELECT * FROM clipboard_shares").first();
    expect(saved?.content).toBe(content);
    expect(saved?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved?.delete_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(saved)).not.toContain(share.token);
    expect(JSON.stringify(saved)).not.toContain(share.deleteToken);
  });

  it("retrieves a share with a case-insensitive grouped code", async () => {
    const share = await create("Copied using a code", { includeCode: true });
    expect(share.code).toMatch(
      /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/,
    );
    const response = await request("retrieve", { code: ` ${share.code?.toLowerCase()} ` });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ content: "Copied using a code" });

    const ambiguous = await request("retrieve", { token: share.token, code: share.code });
    expect(ambiguous.status).toBe(400);
  });

  it("requires the password for both token and short-code retrieval without disclosing text", async () => {
    const content = "A protected note that must stay out of error responses";
    const share = await create(content, {
      includeCode: true,
      password: { salt: passwordSalt, key: passwordKey },
    });
    expect(share.passwordProtected).toBe(true);
    for (const credential of [{ token: share.token }, { code: share.code }]) {
      const missing = await request("retrieve", credential);
      expect(missing.status).toBe(401);
      expect(await missing.json()).toEqual({
        error: "This share requires a password.",
        code: "PASSWORD_REQUIRED",
        passwordSalt,
      });
      const wrong = await request("retrieve", { ...credential, passwordKey: "0".repeat(64) });
      expect(wrong.status).toBe(403);
      const wrongBody = await wrong.json();
      expect(wrongBody).toMatchObject({ code: "INCORRECT_PASSWORD" });
      expect(JSON.stringify(wrongBody)).not.toContain(content);
      const correct = await request("retrieve", { ...credential, passwordKey });
      expect(correct.status).toBe(200);
      expect(await correct.json()).toEqual({ content, expiresAt: share.expiresAt });
    }
    const saved = await db.prepare("SELECT * FROM clipboard_shares").first();
    expect(saved?.password_salt).toBe(passwordSalt);
    expect(saved?.password_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved?.password_failures).toBe(0);
    expect(JSON.stringify(saved)).not.toContain(password);
    expect(JSON.stringify(saved)).not.toContain(passwordKey);
    expect(JSON.stringify(share)).not.toContain(passwordKey);
    expect(
      (await request("delete", { token: share.token, deleteToken: share.deleteToken })).status,
    ).toBe(204);
    expect((await request("retrieve", { token: share.token, passwordKey })).status).toBe(404);
  });

  it("limits password guesses per share across both credentials and recovers after the window", async () => {
    const share = await create("Guess-limited", {
      includeCode: true,
      password: { salt: passwordSalt, key: passwordKey },
    });
    // Opening the password prompt must not consume an incorrect-password attempt.
    for (let index = 0; index < 6; index++)
      expect((await request("retrieve", { token: share.token })).status).toBe(401);
    for (let index = 0; index < 5; index++) {
      expect(
        (await request("retrieve", { token: share.token, passwordKey: "0".repeat(64) })).status,
      ).toBe(403);
    }
    const limited = await request("retrieve", { code: share.code, passwordKey });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await limited.json()).toMatchObject({ code: "PASSWORD_RATE_LIMITED" });
    now += 59_000;
    expect((await request("retrieve", { token: share.token, passwordKey })).status).toBe(429);
    now += 1000;
    expect((await request("retrieve", { code: share.code, passwordKey })).status).toBe(200);
  });

  it("preserves existing 12-character codes and unprotected records", async () => {
    const token = "e".repeat(48);
    const legacyCode = "ABCDEFGHJKLM";
    await db
      .prepare(
        "INSERT INTO clipboard_shares (token_hash, code_hash, delete_token_hash, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        await hashCredential("access", token),
        await hashCredential("code", legacyCode),
        "legacy-delete",
        "An existing share",
        now,
        now + 600_000,
      )
      .run();
    const response = await request("retrieve", { code: "abcd-efgh-jklm" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ content: "An existing share" });
  });

  it("retries a short-code collision instead of overwriting a share", async () => {
    const original = crypto.getRandomValues.bind(crypto);
    let codeCalls = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      if (array instanceof Uint8Array && array.length === 6) {
        // Generate AAA-AAA twice, then BBB-BBB for the retry.
        array.fill(codeCalls++ < 2 ? 8 : 9);
        return array;
      }
      return original(array);
    });
    const first = await create("First note", { includeCode: true });
    const second = await create("Second note", { includeCode: true });
    expect(first.code).toBe("AAA-AAA");
    expect(second.code).toBe("BBB-BBB");
    expect(await (await request("retrieve", { code: first.code })).json()).toMatchObject({
      content: "First note",
    });
    expect(await (await request("retrieve", { code: second.code })).json()).toMatchObject({
      content: "Second note",
    });
  });

  it("validates password metadata and checks expiry before a password challenge", async () => {
    for (const invalid of [
      "raw password",
      { salt: "short", key: passwordKey },
      { salt: passwordSalt, key: "bad" },
      { salt: passwordSalt },
      { salt: passwordSalt, key: passwordKey, plaintext: password },
    ]) {
      expect(
        (await request("create", { content: "Invalid metadata", password: invalid })).status,
      ).toBe(400);
    }
    const share = await create("Expired protected note", {
      expiresIn: 600,
      password: { salt: passwordSalt, key: passwordKey },
    });
    now += 600_000;
    const response = await request("retrieve", { token: share.token });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: UNAVAILABLE_SHARE_MESSAGE });
  });

  it("expires at the exact deadline even before cleanup, then removes expired rows", async () => {
    const first = await create("Short-lived", { expiresIn: 600 });
    await create("Also short-lived", { expiresIn: 600 });
    const remaining = await create("Still available", { expiresIn: 3600 });
    now += 600_000;

    const expired = await request("retrieve", { token: first.token });
    expect(expired.status).toBe(404);
    expect(await expired.json()).toEqual({ error: UNAVAILABLE_SHARE_MESSAGE });
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM clipboard_shares").first())?.count,
    ).toBe(3);

    expect(await clipboardService(bindings(), () => now).cleanup()).toBe(2);
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM clipboard_shares").first())?.count,
    ).toBe(1);
    expect((await request("retrieve", { token: remaining.token })).status).toBe(200);
  });

  it("requires the sender's separate delete token and invalidates both access methods", async () => {
    const share = await create("Delete me", { includeCode: true });
    const unauthorized = await request("delete", {
      token: share.token,
      deleteToken: "0".repeat(48),
    });
    expect(unauthorized.status).toBe(404);
    expect((await request("retrieve", { token: share.token })).status).toBe(200);

    const deleted = await request("delete", { token: share.token, deleteToken: share.deleteToken });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    for (const credential of [
      { token: share.token },
      { code: share.code },
      { token: "f".repeat(48) },
    ]) {
      const response = await request("retrieve", credential);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: UNAVAILABLE_SHARE_MESSAGE });
    }
  });

  it("enforces UTF-8 byte limits and allowed expirations on the server", async () => {
    await create("😀".repeat(16_384));
    const oversized = await request("create", { content: "😀".repeat(16_385) });
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toMatchObject({ error: expect.stringContaining("64 KiB") });
    expect((await request("create", { content: "" })).status).toBe(400);
    expect((await request("create", { content: "text", expiresIn: 604800 })).status).toBe(400);
    expect((await request("create", { content: "text", arbitrary: true })).status).toBe(400);
  });

  it("rejects malformed, oversized, and cross-origin requests", async () => {
    const invalidJson = await app.request(
      "https://utility.test/api/clipboard/create",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" },
      bindings(),
    );
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.headers.get("Cache-Control")).toBe("no-store");

    const wrongType = await request(
      "create",
      { content: "hello" },
      { "Content-Type": "text/plain" },
    );
    expect(wrongType.status).toBe(415);
    const tooLarge = await request("create", { content: "a".repeat(MAX_JSON_BODY_BYTES) });
    expect(tooLarge.status).toBe(413);
    const crossOrigin = await request(
      "create",
      { content: "hello" },
      { Origin: "https://another.test" },
    );
    expect(crossOrigin.status).toBe(403);
    expect((await request("retrieve", { code: "123" })).status).toBe(400);
  });

  it("rejects rate-limited requests and fails closed when a limiter binding is missing", async () => {
    createAllowed = false;
    const limited = await request("create", { content: "hello" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");

    readAllowed = false;
    expect((await request("retrieve", { token: "a".repeat(48) })).status).toBe(429);

    const incompleteEnv = { ...bindings(), CLIPBOARD_CREATE_LIMITER: undefined };
    const unavailable = await app.request(
      "https://utility.test/api/clipboard/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      },
      incompleteEnv,
    );
    expect(unavailable.status).toBe(503);
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM clipboard_shares").first())?.count,
    ).toBe(0);
  });

  it("atomically reserves the final storage slot under concurrent creation", async () => {
    await db
      .prepare(`
        WITH RECURSIVE numbers(n) AS (
          SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < ?
        )
        INSERT INTO clipboard_shares
          (token_hash, code_hash, delete_token_hash, content, created_at, expires_at)
        SELECT printf('%064d', n), NULL, 'test-delete-hash', 'x', ?, ? FROM numbers
      `)
      .bind(MAX_STORED_SHARES - 1, now, now + 3_600_000)
      .run();

    const responses = await Promise.all([
      request("create", { content: "First contender" }),
      request("create", { content: "Second contender" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 503]);
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM clipboard_shares").first())?.count,
    ).toBe(MAX_STORED_SHARES);
  });
});
