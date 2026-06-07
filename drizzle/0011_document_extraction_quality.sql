ALTER TABLE `documents` ADD COLUMN `documentHash` varchar(64);
ALTER TABLE `documents` ADD COLUMN `extractionMethod` varchar(64);
ALTER TABLE `documents` ADD COLUMN `extractionNote` text;
ALTER TABLE `documents` ADD COLUMN `extractionTextLength` int NOT NULL DEFAULT 0;
ALTER TABLE `documents` ADD COLUMN `extractionQualityScore` int NOT NULL DEFAULT 0;
ALTER TABLE `documents` ADD COLUMN `extractionWarnings` text;
ALTER TABLE `documents` MODIFY COLUMN `extractedText` longtext;
ALTER TABLE `documents` MODIFY COLUMN `summary` longtext;
CREATE INDEX `documents_user_hash_idx` ON `documents` (`userId`, `documentHash`);
