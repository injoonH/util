import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../db";
import { clipboardShares } from "../db/schema";

// 4,096 maximum-size shares use 256 MiB of content, leaving space for indexes
// and database overhead within a single D1 Free database's 500 MB limit.
export const MAX_STORED_SHARES = 4096;
export const CLEANUP_BATCH_SIZE = 500;

type NewShare = typeof clipboardShares.$inferInsert;

export function clipboardRepository(db: Database) {
  return {
    async create(share: NewShare): Promise<boolean> {
      // The count and insert are one SQL statement. Concurrent Workers cannot
      // both pass a separate count check and exceed the storage bound.
      const result = await db.run(sql`
        INSERT INTO clipboard_shares
          (token_hash, code_hash, delete_token_hash, content, created_at, expires_at, password_salt, password_hash)
        SELECT
          ${share.tokenHash}, ${share.codeHash ?? null}, ${share.deleteTokenHash},
          ${share.content}, ${share.createdAt}, ${share.expiresAt}, ${share.passwordSalt ?? null}, ${share.passwordHash ?? null}
        WHERE (SELECT COUNT(*) FROM clipboard_shares) < ${MAX_STORED_SHARES}
      `);
      return result.meta.changes === 1;
    },

    async retrieve(credential: { tokenHash: string } | { codeHash: string }, now: number) {
      const matchingCredential =
        "tokenHash" in credential
          ? eq(clipboardShares.tokenHash, credential.tokenHash)
          : eq(clipboardShares.codeHash, credential.codeHash);

      const rows = await db
        .select({
          tokenHash: clipboardShares.tokenHash,
          content: clipboardShares.content,
          expiresAt: clipboardShares.expiresAt,
          passwordSalt: clipboardShares.passwordSalt,
          passwordHash: clipboardShares.passwordHash,
          passwordFailures: clipboardShares.passwordFailures,
          passwordWindowStart: clipboardShares.passwordWindowStart,
        })
        .from(clipboardShares)
        .where(and(matchingCredential, gt(clipboardShares.expiresAt, now)))
        .limit(1);
      return rows[0] ?? null;
    },

    async recordPasswordFailure(tokenHash: string, now: number) {
      await db.run(sql`
        UPDATE clipboard_shares SET
          password_failures = CASE WHEN password_window_start <= ${now - 60_000} THEN 1 ELSE password_failures + 1 END,
          password_window_start = CASE WHEN password_window_start <= ${now - 60_000} THEN ${now} ELSE password_window_start END
        WHERE token_hash = ${tokenHash}
      `);
    },

    async resetPasswordFailures(tokenHash: string) {
      await db
        .update(clipboardShares)
        .set({ passwordFailures: 0, passwordWindowStart: 0 })
        .where(eq(clipboardShares.tokenHash, tokenHash));
    },

    async delete(tokenHash: string, deleteTokenHash: string): Promise<boolean> {
      const result = await db
        .delete(clipboardShares)
        .where(
          and(
            eq(clipboardShares.tokenHash, tokenHash),
            eq(clipboardShares.deleteTokenHash, deleteTokenHash),
          ),
        );
      return result.meta.changes === 1;
    },

    async cleanup(now: number): Promise<number> {
      const result = await db.run(sql`
        DELETE FROM clipboard_shares WHERE token_hash IN (
          SELECT token_hash FROM clipboard_shares
          WHERE expires_at <= ${now}
          ORDER BY expires_at
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
      `);
      return result.meta.changes;
    },
  };
}
