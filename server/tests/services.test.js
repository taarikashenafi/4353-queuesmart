import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';

const VALID_SERVICE = {
  name: 'Registrar',
  description: 'Registration and transcript support.',
  expectedDuration: 10,
  priority: 'medium',
};

function createService(overrides = {}) {
  return request(app)
    .post('/api/services')
    .send({ ...VALID_SERVICE, ...overrides });
}

describe('service management API', () => {
  beforeEach(() => resetAppDb());

  it('lists services persisted in SQLite', async () => {
    await createService();

    const res = await request(app).get('/api/services');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: expect.any(String),
        ...VALID_SERVICE,
      },
    ]);
  });

  it('creates a normalized service and its open queue atomically', async () => {
    const res = await createService({
      name: '  Registrar  ',
      description: '  Registration and transcript support.  ',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      ...VALID_SERVICE,
    });

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(res.body.id);
    expect(service).toMatchObject({
      name: VALID_SERVICE.name,
      description: VALID_SERVICE.description,
      expected_duration: VALID_SERVICE.expectedDuration,
      priority: VALID_SERVICE.priority,
    });
    expect(
      db.prepare('SELECT service_id, status FROM queues WHERE service_id = ?').get(res.body.id),
    ).toEqual({ service_id: Number(res.body.id), status: 'open' });
  });

  it.each([
    ['name'],
    ['description'],
    ['expectedDuration'],
    ['priority'],
  ])('rejects a request missing %s', async (field) => {
    const res = await createService({ [field]: undefined });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: `${field} is required` });
  });

  it('rejects a name longer than 100 characters', async () => {
    const res = await createService({ name: 'a'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 100/);
  });

  it('rejects a description longer than 500 characters', async () => {
    const res = await createService({ description: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 500/);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['non-numeric', '10'],
    ['fractional', 2.5],
    ['over 480 minutes', 481],
  ])('rejects a %s expected duration', async (label, expectedDuration) => {
    const res = await createService({ expectedDuration });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive number|whole number/);
  });

  it('rejects an unsupported priority', async () => {
    const res = await createService({ priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/low, medium, high/);
  });

  it('enforces field length and priority constraints in SQLite', () => {
    const insert = db.prepare(`
      INSERT INTO services (name, description, expected_duration, priority)
      VALUES (?, ?, ?, ?)
    `);

    expect(() => insert.run('a'.repeat(101), 'Valid description', 10, 'low'))
      .toThrow(/CHECK constraint failed/);
    expect(() => insert.run('Valid name', 'Valid description', 10, 'urgent'))
      .toThrow(/CHECK constraint failed/);
  });

  it('updates an existing service without replacing its queue', async () => {
    const created = await createService();
    const queueBefore = db.prepare(
      'SELECT id, created_at FROM queues WHERE service_id = ?',
    ).get(created.body.id);
    const updated = {
      name: 'Updated Advising',
      description: 'Updated service description.',
      expectedDuration: 25,
      priority: 'low',
    };

    const res = await request(app)
      .put(`/api/services/${created.body.id}`)
      .send(updated);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: created.body.id, ...updated });
    expect(
      db.prepare('SELECT id, created_at FROM queues WHERE service_id = ?').get(created.body.id),
    ).toEqual(queueBefore);
  });

  it('returns 404 when updating an unknown service', async () => {
    const res = await request(app).put('/api/services/9999').send(VALID_SERVICE);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Service not found' });
  });
});

describe('queue status API', () => {
  beforeEach(() => resetAppDb());

  it('returns the current queue status', async () => {
    const created = await createService();

    const res = await request(app).get(`/api/queues/${created.body.id}/status`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      serviceId: created.body.id,
      status: 'open',
      createdAt: expect.any(String),
    });
  });

  it('closes and reopens a service queue', async () => {
    const created = await createService();

    const closed = await request(app)
      .patch(`/api/queues/${created.body.id}/status`)
      .send({ status: 'closed' });
    const reopened = await request(app)
      .patch(`/api/queues/${created.body.id}/status`)
      .send({ status: 'open' });

    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({ serviceId: created.body.id, status: 'closed' });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toEqual({ serviceId: created.body.id, status: 'open' });
    expect(
      db.prepare('SELECT status FROM queues WHERE service_id = ?').get(created.body.id),
    ).toEqual({ status: 'open' });
  });

  it('rejects an invalid status and an unknown service', async () => {
    const created = await createService();
    const invalid = await request(app)
      .patch(`/api/queues/${created.body.id}/status`)
      .send({ status: 'paused' });
    const missing = await request(app)
      .patch('/api/queues/9999/status')
      .send({ status: 'closed' });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/open, closed/);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Service not found' });
  });

  it('rejects joining a closed queue', async () => {
    const created = await createService();
    const user = db.prepare(`
      INSERT INTO user_credentials (email, password_hash, role)
      VALUES (?, ?, ?)
    `).run('student@uh.edu', 'hash', 'user');
    await request(app)
      .patch(`/api/queues/${created.body.id}/status`)
      .send({ status: 'closed' });

    const res = await request(app)
      .post(`/api/queues/${created.body.id}/join`)
      .send({ userId: String(user.lastInsertRowid), priority: 'low' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Queue is closed' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM queue_entries').get().count).toBe(0);
  });
});
