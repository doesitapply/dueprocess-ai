CREATE TABLE `generated_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`template` varchar(64) NOT NULL,
	`scope` varchar(32) NOT NULL,
	`format` varchar(16) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`documentIds` longtext NOT NULL,
	`selectedFindingIds` longtext,
	`minConfidence` int NOT NULL DEFAULT 0,
	`includeBlockedFindings` int NOT NULL DEFAULT 0,
	`content` longtext NOT NULL,
	`metadata` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `generated_reports_user_idx` ON `generated_reports` (`userId`);
--> statement-breakpoint
CREATE INDEX `generated_reports_created_idx` ON `generated_reports` (`createdAt`);
