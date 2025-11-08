CREATE TABLE `swarm_agent_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`swarmSessionId` int NOT NULL,
	`agentId` varchar(100) NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`output` text,
	`error` text,
	`processingTime` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `swarm_agent_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swarm_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`sector` varchar(50) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`totalAgents` int NOT NULL,
	`completedAgents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `swarm_sessions_id` PRIMARY KEY(`id`)
);
