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
-- Services & queues (Taarik)
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL
                    CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description       TEXT    NOT NULL
                    CHECK (length(trim(description)) BETWEEN 1 AND 500),
  expected_duration INTEGER NOT NULL
                    CHECK (typeof(expected_duration) = 'integer'
                      AND expected_duration BETWEEN 1 AND 480),
  priority          TEXT    NOT NULL
                    CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS queues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL UNIQUE REFERENCES services(id),
  status     TEXT    NOT NULL DEFAULT 'open'
             CHECK (status IN ('open', 'closed')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Queue entries (Surafel) — add `queue_entries` here
-- ============================================================

CREATE TABLE IF NOT EXISTS queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id INTEGER NOT NULL REFERENCES queues(id),
  user_id INTEGER NOT NULL REFERENCES user_credentials(id),
  position INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled')) DEFAULT 'waiting',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'low'
);

-- ============================================================
-- Notifications (Uchenna) — add `notifications` here
-- ============================================================
