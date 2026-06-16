import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pull_requests (
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT,
  merged_at TEXT NOT NULL,
  labels TEXT NOT NULL DEFAULT '[]',
  url TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (repo, number)
);

CREATE TABLE IF NOT EXISTS commits (
  repo TEXT NOT NULL,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT,
  authored_at TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (repo, sha)
);

CREATE TABLE IF NOT EXISTS sync_state (
  repo TEXT PRIMARY KEY,
  last_synced_at TEXT NOT NULL,
  last_pr_merged_at TEXT
);
`;

/**
 * Open (creating if needed) the SQLite data store and ensure the schema
 * exists. Pass ":memory:" for an ephemeral store (used in tests).
 */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}
