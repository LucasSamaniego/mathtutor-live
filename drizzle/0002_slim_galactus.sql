CREATE TABLE `exerciseResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exerciseId` int NOT NULL,
	`participantId` int NOT NULL,
	`answer` varchar(255) NOT NULL,
	`isCorrect` boolean NOT NULL,
	`pointsEarned` int NOT NULL DEFAULT 0,
	`responseTime` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exerciseResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`createdBy` int NOT NULL,
	`question` text NOT NULL,
	`questionLatex` text,
	`correctAnswer` varchar(255) NOT NULL,
	`points` int NOT NULL DEFAULT 10,
	`timeLimit` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactiveGraphs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`createdBy` int NOT NULL,
	`title` varchar(255),
	`graphType` enum('linear','quadratic','cubic','trigonometric','exponential','custom') NOT NULL DEFAULT 'linear',
	`equation` varchar(512) NOT NULL,
	`config` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interactiveGraphs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liveChat` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`participantId` int NOT NULL,
	`senderName` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveChat_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participantScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`participantId` int NOT NULL,
	`totalPoints` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`totalAnswers` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participantScores_id` PRIMARY KEY(`id`)
);
