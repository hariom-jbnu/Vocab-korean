CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`card_id` text NOT NULL,
	`skill` text NOT NULL,
	`outcome` text NOT NULL,
	`grade` integer NOT NULL,
	`ms` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_user_deck_idx` ON `attempts` (`user_id`,`deck_id`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`position` integer NOT NULL,
	`term` text NOT NULL,
	`reading` text,
	`meaning` text NOT NULL,
	`meaning_alt` text,
	`pos` text,
	`topic` text,
	`examples` text DEFAULT '[]' NOT NULL,
	`audio_media_id` text,
	`image_media_id` text,
	`writing_prompt` text,
	`moderation_status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cards_deck_idx` ON `cards` (`deck_id`,`position`);--> statement-breakpoint
CREATE TABLE `creators` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`branding` text DEFAULT '{}' NOT NULL,
	`owner_user_id` text NOT NULL,
	`moderation_status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creators_slug_uq` ON `creators` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `creators_owner_uq` ON `creators` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_lang` text NOT NULL,
	`source_lang` text NOT NULL,
	`alt_lang` text,
	`script_meta` text NOT NULL,
	`ruleset` text DEFAULT '{}' NOT NULL,
	`branding` text DEFAULT '{}' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`moderation_status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decks_code_uq` ON `decks` (`code`);--> statement-breakpoint
CREATE INDEX `decks_creator_idx` ON `decks` (`creator_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`path` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`skill` text NOT NULL,
	`state` text NOT NULL,
	`due` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`, `skill`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_deck_idx` ON `progress` (`user_id`,`deck_id`,`skill`);--> statement-breakpoint
CREATE TABLE `rate_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_events_key_idx` ON `rate_events` (`key`,`at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`reporter_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_target_idx` ON `reports` (`target_type`,`target_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`role` text DEFAULT 'learner' NOT NULL,
	`username` text,
	`display_name` text NOT NULL,
	`email` text,
	`password_hash` text,
	`google_sub` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uq` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_uq` ON `users` (`google_sub`);