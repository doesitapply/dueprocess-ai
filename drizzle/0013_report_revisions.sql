CREATE TABLE `report_revisions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `reportId` int NOT NULL,
  `userId` int NOT NULL,
  `revisionNumber` int NOT NULL DEFAULT 1,
  `title` varchar(255) NOT NULL,
  `markdown` longtext NOT NULL,
  `sections` longtext NOT NULL,
  `editReason` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `report_revisions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `report_revisions_report_idx` ON `report_revisions` (`reportId`);
CREATE INDEX `report_revisions_user_report_idx` ON `report_revisions` (`userId`, `reportId`);
CREATE INDEX `report_revisions_number_idx` ON `report_revisions` (`reportId`, `revisionNumber`);
