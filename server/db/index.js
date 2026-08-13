import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DEFAULT_DB_PATH = path.join(__dirname, 'queuesmart.db');

export function createDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));

  const columns = db.prepare('PRAGMA table_info(queue_entries)').all();
  const hasServedAt = columns.some((column) => column.name === 'served_at');
  if (!hasServedAt) {
    db.exec('ALTER TABLE queue_entries ADD COLUMN served_at TEXT');
  }

  return db;
}

function resolveDbPath() {
  if (process.env.NODE_ENV === 'test') return ':memory:';
  return process.env.DB_PATH || DEFAULT_DB_PATH;
}

// Single shared connection for the app. Tests that need isolation
// should use createDatabase(':memory:') via tests/helpers/testDb.js
// instead of importing this.
const db = createDatabase(resolveDbPath());

export default db;
