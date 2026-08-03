-- QueueSmart database schema (SQLite).
-- Each table is owned by one teammate — add tables ONLY in your own
-- section so schema.sql never causes merge conflicts.

-- ============================================================
-- Auth & profiles (Armaan)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES user_credentials(id),
  full_name   TEXT,
  phone       TEXT,
  preferences TEXT
);

-- ============================================================
-- Services & queues (Taarik) — add `services` and `queues` here
-- ============================================================

-- ============================================================
-- Queue entries (Surafel) — add `queue_entries` here
-- ============================================================

-- ============================================================
-- Notifications (Uchenna) — add `notifications` here
-- ============================================================
