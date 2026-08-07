import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';

function createUser(email = 'student@uh.edu') {
  const result = db
    .prepare('INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, 'hash', 'user');
  return Number(result.lastInsertRowid);
}

function createService(overrides = {}) {
  const service = {
    name: 'Academic Advising',
    description: 'Plan your degree.',
    expectedDuration: 15,
    priority: 'high',
    ...overrides,
  };
  const result = db
    .prepare(`
      INSERT INTO services (name, description, expected_duration, priority)
      VALUES (?, ?, ?, ?)
    `)
    .run(service.name, service.description, service.expectedDuration, service.priority);
  const serviceId = Number(result.lastInsertRowid);
  const queue = db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(serviceId);

  return { serviceId, queueId: Number(queue.lastInsertRowid), name: service.name };
}

function addEntry(queueId, userId, { status = 'served', position = 1, priority = 'low', joinedAt } = {}) {
  if (joinedAt) {
    db.prepare(`
      INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(queueId, userId, position, joinedAt, status, priority);
  } else {
    db.prepare(`
      INSERT INTO queue_entries (queue_id, user_id, position, status, priority)
      VALUES (?, ?, ?, ?, ?)
    `).run(queueId, userId, position, status, priority);
  }
}

describe('history API', () => {
  let userId;
  let service;

  beforeEach(() => {
    resetAppDb();
    userId = createUser();
    service = createService();
  });

  it('returns an empty array for a user with no history', async () => {
    const res = await request(app).get(`/api/history/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a user's history newest-first, excluding entries still waiting", async () => {
    addEntry(service.queueId, userId, { status: 'served', position: 1, joinedAt: '2026-08-01 09:00:00' });
    addEntry(service.queueId, userId, { status: 'canceled', position: 1, joinedAt: '2026-08-02 09:00:00' });
    addEntry(service.queueId, userId, { status: 'waiting', position: 1, joinedAt: '2026-08-03 09:00:00' });

    const res = await request(app).get(`/api/history/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.map((h) => h.outcome)).toEqual(['canceled', 'served']);
    expect(res.body[0]).toMatchObject({
      serviceId: String(service.serviceId),
      serviceName: service.name,
    });
  });

  it('reports zero served and zero average wait for a service with no history', async () => {
    const res = await request(app).get('/api/stats');

    expect(res.status).toBe(200);
    expect(res.body.find((s) => s.serviceId === String(service.serviceId))).toEqual({
      serviceId: String(service.serviceId),
      serviceName: service.name,
      totalServed: 0,
      averageWait: 0,
    });
  });

  it('aggregates total served and average wait per service, ignoring canceled entries', async () => {
    addEntry(service.queueId, userId, { status: 'served', position: 1 });
    const secondUserId = createUser('second@uh.edu');
    addEntry(service.queueId, secondUserId, { status: 'served', position: 3 });
    addEntry(service.queueId, userId, { status: 'canceled', position: 2 });

    const res = await request(app).get('/api/stats');
    const stat = res.body.find((s) => s.serviceId === String(service.serviceId));

    expect(stat.totalServed).toBe(2);
    expect(stat.averageWait).toBe(15);
  });
});
