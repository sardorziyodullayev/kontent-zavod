CREATE TABLE `files` (
	`path` text NOT NULL,
	`idx` integer NOT NULL,
	`data` blob NOT NULL,
	`mtime` integer NOT NULL,
	PRIMARY KEY(`path`, `idx`)
);
