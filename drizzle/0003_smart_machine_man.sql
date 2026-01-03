CREATE TABLE `pdfSyncState` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`documentId` int,
	`currentPage` int NOT NULL DEFAULT 1,
	`totalPages` int NOT NULL DEFAULT 1,
	`zoomLevel` int NOT NULL DEFAULT 100,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pdfSyncState_id` PRIMARY KEY(`id`),
	CONSTRAINT `pdfSyncState_sessionId_unique` UNIQUE(`sessionId`)
);
