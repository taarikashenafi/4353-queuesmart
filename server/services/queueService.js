import db from '../db/index.js';
import { ApiError, requireFields, requireOneOf } from '../validators.js';

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      expected_duration INTEGER NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high'))
    );

    CREATE TABLE IF NOT EXISTS queues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL REFERENCES services(id),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER NOT NULL REFERENCES queues(id),
      user_id INTEGER NOT NULL REFERENCES user_credentials(id),
      position INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled')) DEFAULT 'waiting',
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'low'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES user_credentials(id),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL CHECK (status IN ('sent', 'viewed')) DEFAULT 'sent'
    );
  `);
}

ensureSchema();

function normalizeServiceId(serviceId) {
  if (typeof serviceId !== 'string' || serviceId.trim() === '') {
    throw new ApiError(400, 'Service id must be a non-empty string');
  }
  return serviceId.trim();
}

function normalizeUserId(userId) {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId)) {
    throw new ApiError(400, 'User id must be a number');
  }
  return numericId;
}

function getService(serviceId) {
  const normalizedId = normalizeServiceId(serviceId);
  const service = db
    .prepare('SELECT id, name, expected_duration AS expectedDuration, priority FROM services WHERE id = ?')
    .get(normalizedId);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  return service;
}

function ensureQueue(serviceId) {
  const normalizedId = normalizeServiceId(serviceId);
  const existing = db
    .prepare('SELECT id, status FROM queues WHERE service_id = ? ORDER BY id DESC LIMIT 1')
    .get(normalizedId);

  if (existing) {
    return existing;
  }

  const result = db
    .prepare('INSERT INTO queues (service_id, status) VALUES (?, ?)')
    .run(normalizedId, 'open');
  return { id: Number(result.lastInsertRowid), status: 'open' };
}

function syncPositions(queueId) {
  const ordered = db
    .prepare(`
      SELECT id
      FROM queue_entries
      WHERE queue_id = ? AND status = 'waiting'
      ORDER BY joined_at ASC, id ASC
    `)
    .all(queueId);

  for (let index = 0; index < ordered.length; index += 1) {
    db.prepare('UPDATE queue_entries SET position = ? WHERE id = ?').run(index + 1, ordered[index].id);
  }
}

function getQueueEntries(serviceId) {
  const normalizedServiceId = normalizeServiceId(serviceId);
  const rows = db
    .prepare(`
      SELECT qe.user_id AS userId, qe.joined_at AS joinedAt, qe.position, qe.status, qe.priority
      FROM queue_entries qe
      JOIN queues q ON qe.queue_id = q.id
      WHERE q.service_id = ? AND qe.status = 'waiting'
      ORDER BY qe.joined_at ASC, qe.id ASC
    `)
    .all(normalizedServiceId);

  return rows.map((row) => ({
    userId: String(row.userId),
    joinedAt: row.joinedAt,
    position: row.position,
    status: row.status,
    priority: row.priority,
  }));
}

export function joinQueue(serviceId, input) {
  requireFields(input, ['userId', 'priority']);
  const { userId, priority } = input;
  requireOneOf(priority, 'priority', ['high', 'medium', 'low']);

  const service = getService(serviceId);
  const normalizedUserId = normalizeUserId(userId);
  const queue = ensureQueue(serviceId);

  return db.transaction(() => {
    const existing = db
      .prepare('SELECT id FROM queue_entries WHERE queue_id = ? AND user_id = ? AND status = ?')
      .get(queue.id, normalizedUserId, 'waiting');

    if (existing) {
      throw new ApiError(400, 'User is already in this queue');
    }

    const joinedAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)' 
    ).run(queue.id, normalizedUserId, 0, joinedAt, 'waiting', priority);

    syncPositions(queue.id);

    const orderedQueue = getQueueEntries(serviceId);
    const position = orderedQueue.findIndex((entry) => entry.userId === String(normalizedUserId)) + 1;

    return {
      message: 'Joined queue successfully',
      queueLength: orderedQueue.length,
      position,
    };
  })();
}

export function leaveQueue(serviceId, input) {
  requireFields(input, ['userId']);
  getService(serviceId);
  const normalizedUserId = normalizeUserId(input.userId);
  const queue = ensureQueue(serviceId);

  return db.transaction(() => {
    const entry = db
      .prepare('SELECT id FROM queue_entries WHERE queue_id = ? AND user_id = ? AND status = ?')
      .get(queue.id, normalizedUserId, 'waiting');

    if (!entry) {
      throw new ApiError(404, 'User is not in this queue');
    }

    db.prepare("UPDATE queue_entries SET status = 'canceled' WHERE id = ?").run(entry.id);
    syncPositions(queue.id);

    return { message: 'Left queue successfully' };
  })();
}

export function getQueue(serviceId, userId) {
  const service = getService(serviceId);
  const orderedQueue = getQueueEntries(serviceId);
  const result = { serviceId: service.id, serviceName: service.name, queue: orderedQueue };

  if (userId !== undefined && userId !== null && userId !== '') {
    const normalizedUserId = normalizeUserId(userId);
    const position = orderedQueue.findIndex((entry) => entry.userId === String(normalizedUserId)) + 1;
    if (position <= 0) {
      throw new ApiError(404, 'User is not in this queue');
    }

    result.position = position;
    result.estimatedWait = (position - 1) * service.expectedDuration;
  }

  return result;
}

export function serveNext(serviceId) {
  const service = getService(serviceId);
  const queue = ensureQueue(serviceId);

  return db.transaction(() => {
    const first = db
      .prepare(`
        SELECT qe.id, qe.user_id AS userId
        FROM queue_entries qe
        JOIN queues q ON qe.queue_id = q.id
        WHERE q.service_id = ? AND qe.status = 'waiting'
        ORDER BY qe.joined_at ASC, qe.id ASC
        LIMIT 1
      `)
      .get(service.id);

    if (!first) {
      throw new ApiError(404, 'No users in queue');
    }

    db.prepare("UPDATE queue_entries SET status = 'served' WHERE id = ?").run(first.id);
    syncPositions(queue.id);

    return { message: 'Served next user', userId: String(first.userId) };
  })();
}
