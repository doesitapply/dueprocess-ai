CREATE TABLE `workspace_cases` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `caseNumber` varchar(120),
  `jurisdiction` varchar(255),
  `posture` varchar(255),
  `strategy` text,
  `status` enum('active','watchlist','archived') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `workspace_cases_id` PRIMARY KEY(`id`)
);

CREATE TABLE `case_documents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `caseId` int NOT NULL,
  `documentId` int NOT NULL,
  `role` enum('primary','comparison','shared') NOT NULL DEFAULT 'primary',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `case_documents_id` PRIMARY KEY(`id`)
);

CREATE INDEX `workspace_cases_user_idx` ON `workspace_cases` (`userId`);
CREATE INDEX `workspace_cases_status_idx` ON `workspace_cases` (`userId`, `status`);
CREATE INDEX `case_documents_user_case_idx` ON `case_documents` (`userId`, `caseId`);
CREATE INDEX `case_documents_user_document_idx` ON `case_documents` (`userId`, `documentId`);
