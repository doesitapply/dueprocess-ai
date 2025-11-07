CREATE TABLE `agent_divisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`category` enum('research','analysis','tactical','evidence','offensive') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_divisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_reasoning` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outputId` int NOT NULL,
	`step` int NOT NULL,
	`reasoning` text NOT NULL,
	`immunityPiercing` text,
	`abstentionBypass` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_reasoning_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`divisionId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`systemPrompt` text NOT NULL,
	`capabilities` text,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_citations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outputId` int NOT NULL,
	`citationType` enum('case_law','statute','rule','regulation','constitution') NOT NULL,
	`citation` text NOT NULL,
	`source` varchar(100),
	`url` text,
	`relevance` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_citations_id` PRIMARY KEY(`id`)
);
