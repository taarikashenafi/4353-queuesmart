import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import { seedAdminToken, seedUserWithToken } from './helpers/auth.js';

let serviceId;
let user;
let userId;
let admin;

function seedService() {
  const result = db.prepare(
    'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
  ).run('General Support', 'General assistance', 15, 'medium');
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(id);
  return id;
}

function seedUser(email = 'surafel@example.com') {
  return seedUserWithToken({ email }).userId;
}

describe('Queue API', () => {
  beforeEach(() => {
    resetAppDb();
    serviceId = seedService();
    user = seedUserWithToken({ email: 'surafel@example.com' });
    userId = user.userId;
    admin = seedAdminToken();
  });

  it('joins a queue for an existing service and persists the row', async () => {
    const res = await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Joined queue successfully',
      queueLength: 1,
      position: 1,
    });

    const row = db.prepare('SELECT * FROM queue_entries WHERE user_id = ?').get(userId);
    expect(row).toMatchObject({
      user_id: userId,
      status: 'waiting',
      position: 1,
    });
  });

  it('rejects duplicate join for the same user in the same queue', async () => {
    await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    const res = await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'User is already in this queue' });
  });

  it('returns 404 when joining a nonexistent service', async () => {
    const res = await request(app)
      .post('/api/queues/does-not-exist/join')
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Service not found' });
  });

  it('lets a user leave the queue and marks the row as canceled', async () => {
    await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    const res = await request(app)
      .delete(`/api/queues/${serviceId}/leave`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Left queue successfully' });

    const row = db.prepare('SELECT * FROM queue_entries WHERE user_id = ?').get(userId);
    expect(row.status).toBe('canceled');
  });

  it('returns queue entries by priority then arrival with position and wait time', async () => {
    const queueId = Number(db.prepare('SELECT id FROM queues WHERE service_id = ?').get(serviceId).id);
    const highPriorityUserId = seedUser('high@example.com');
    const mediumPriorityUserId = seedUser('medium@example.com');

    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(queueId, userId, 1, '2026-07-24T10:00:00.000Z', 'waiting', 'low');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(queueId, highPriorityUserId, 2, '2026-07-24T10:05:00.000Z', 'waiting', 'high');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(queueId, mediumPriorityUserId, 3, '2026-07-24T10:02:00.000Z', 'waiting', 'medium');

    const res = await request(app)
      .get(`/api/queues/${serviceId}?userId=${mediumPriorityUserId}`)
      .set('Authorization', user.auth);

    expect(res.status).toBe(200);
    expect(res.body.queue.map((entry) => entry.userId)).toEqual([
      String(highPriorityUserId),
      String(mediumPriorityUserId),
      String(userId),
    ]);
    expect(res.body.position).toBe(2);
    expect(res.body.estimatedWait).toBe(15);
  });

  it('serves the next user and marks the row as served', async () => {
    const queueId = Number(db.prepare('SELECT id FROM queues WHERE service_id = ?').get(serviceId).id);
    const highPriorityUserId = seedUser('high@example.com');

    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(queueId, userId, 1, '2026-07-24T10:00:00.000Z', 'waiting', 'low');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(queueId, highPriorityUserId, 2, '2026-07-24T10:01:00.000Z', 'waiting', 'high');

    const res = await request(app)
      .post(`/api/queues/${serviceId}/serve`)
      .set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Served next user', userId: String(highPriorityUserId) });

    const row = db.prepare('SELECT * FROM queue_entries WHERE user_id = ?').get(highPriorityUserId);
    expect(row.status).toBe('served');
  });

  it('lets an administrator remove another user from the queue', async () => {
    await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', user.auth)
      .send({ userId: String(userId), priority: 'low' });

    const res = await request(app)
      .delete(`/api/queues/${serviceId}/leave`)
      .set('Authorization', admin.auth)
      .send({ userId: String(userId) });

    expect(res.status).toBe(200);
    expect(db.prepare('SELECT status FROM queue_entries WHERE user_id = ?').get(userId).status)
      .toBe('canceled');
  });
});
