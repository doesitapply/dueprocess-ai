CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`anchorDocumentId` int NOT NULL,
	`sector` varchar(50) NOT NULL,
	`scope` enum('all','file','time') NOT NULL,
	`documentIds` text NOT NULL,
	`agentIds` text NOT NULL,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`totalAgents` int NOT NULL DEFAULT 0,
	`completedAgents` int NOT NULL DEFAULT 0,
	`promptVersion` varchar(64) NOT NULL DEFAULT 'leverage-v1',
	`model` varchar(100),
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`estimatedCostCents` int NOT NULL DEFAULT 0,
	`synthesis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`outputId` int,
	`userId` int NOT NULL,
	`agentId` varchar(100) NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`findingType` enum('record_supported','inference','missing_record','legal_authority','contradiction','adverse_fact') NOT NULL,
	`liabilityVector` varchar(255),
	`remedyPath` varchar(255),
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`confidence` int NOT NULL DEFAULT 0,
	`leverageScore` int NOT NULL DEFAULT 0,
	`summary` text NOT NULL,
	`sourceAnchors` text NOT NULL,
	`missingRecords` text,
	`legalAuthorities` text,
	`nextAction` text,
	`qcStatus` enum('not_required','pending','approved','downgraded','needs_more_proof','blocked') NOT NULL DEFAULT 'not_required',
	`qcReason` text,
	`includedInReports` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_finding_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`runId` int NOT NULL,
	`auditorAgentId` varchar(100) NOT NULL DEFAULT 'qc_auditor',
	`status` enum('approved','downgraded','needs_more_proof','blocked') NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`issues` text,
	`correctedSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_finding_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`runId` int,
	`agentId` varchar(100),
	`operation` varchar(100) NOT NULL,
	`model` varchar(100),
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`estimatedCostCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_usage_events_id` PRIMARY KEY(`id`)
);
