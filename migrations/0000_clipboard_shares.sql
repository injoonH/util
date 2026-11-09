CREATE TABLE `clipboard_shares` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`code_hash` text,
	`delete_token_hash` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "clipboard_content_size" CHECK(length(CAST("clipboard_shares"."content" AS BLOB)) BETWEEN 1 AND 65536),
	CONSTRAINT "clipboard_expiry_order" CHECK("clipboard_shares"."expires_at" > "clipboard_shares"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clipboard_shares_code_hash_unique` ON `clipboard_shares` (`code_hash`);--> statement-breakpoint
CREATE INDEX `clipboard_shares_expires_at_idx` ON `clipboard_shares` (`expires_at`);