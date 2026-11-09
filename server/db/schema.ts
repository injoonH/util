import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const clipboardShares = sqliteTable(
  "clipboard_shares",
  {
    tokenHash: text("token_hash").primaryKey(),
    codeHash: text("code_hash").unique(),
    deleteTokenHash: text("delete_token_hash").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    passwordSalt: text("password_salt"),
    passwordHash: text("password_hash"),
    passwordFailures: integer("password_failures").notNull().default(0),
    passwordWindowStart: integer("password_window_start").notNull().default(0),
  },
  (table) => [
    index("clipboard_shares_expires_at_idx").on(table.expiresAt),
    check(
      "clipboard_content_size",
      sql`length(CAST(${table.content} AS BLOB)) BETWEEN 1 AND 65536`,
    ),
    check("clipboard_expiry_order", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);
