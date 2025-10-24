CREATE TABLE `agent_outputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`jesterMemeCaption` text,
	`jesterTiktokScript` text,
	`jesterQuote` text,
	`clerkViolations` text,
	`clerkCaseLaw` text,
	`clerkMotionDraft` text,
	`hobotProductName` varchar(255),
	`hobotDescription` text,
	`hobotLink` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_outputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
