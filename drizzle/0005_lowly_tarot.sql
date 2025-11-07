CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(50) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiry` timestamp,
	`apiKey` text,
	`webhookUrl` text,
	`webhookSecret` text,
	`settings` text,
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'connected',
	`lastSync` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `integration_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`connectionId` int NOT NULL,
	`jobType` varchar(100) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `integration_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`category` enum('storage','communication','automation','legal','payment') NOT NULL,
	`authType` enum('oauth2','api_key','webhook') NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_providers_providerId_unique` UNIQUE(`providerId`)
);
