ALTER TABLE `clipboard_shares` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `clipboard_shares` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `clipboard_shares` ADD `password_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clipboard_shares` ADD `password_window_start` integer DEFAULT 0 NOT NULL;