// Proves that administrator-only routes actually verify the caller's session
// token and role, and that queue entry routes only let you act on yourself.
//
// Each guarded route is checked three ways:
//   no token          -> 401
//   unrecognized token-> 401
//   valid non-admin   -> 403
// followed by a positive case showing the admin token still works.

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import { seedAdminToken, seedUserWithToken } from './helpers/auth.js';

const VALID_SERVICE = {
  name: 'Registrar',
  description: 'Registration and transcript support.',
  expectedDuration: 10,
  priority: 'medium',
};

let admin;
let member;
let serviceId;

function seedService() {
  const result = db.prepare(
    'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
  ).run('General Support', 'General assistance', 15, 'medium');
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(id);
  return id;
}

// Every administrator-only endpoint, described so the same three negative
// cases can be run against all of them.
function adminRoutes() {
  return [
    {
      name: 'POST /api/services',
      send: (token) => {
        const req = request(app).post('/api/services');
        if (token) req.set('Authorization', token);
        return req.send(VALID_SERVICE);
      },
    },
    {
      name: 'PUT /api/services/:id',
      send: (token) => {
        const req = request(app).put(`/api/services/${serviceId}`);
        if (token) req.set('Authorization', token);
        return req.send(VALID_SERVICE);
      },
    },
    {
      name: 'POST /api/queues/:id/serve',
      send: (token) => {
        const req = request(app).post(`/api/queues/${serviceId}/serve`);
        if (token) req.set('Authorization', token);
        return req.send();
      },
    },
    {
      name: 'PATCH /api/queues/:id/status',
      send: (token) => {
        const req = request(app).patch(`/api/queues/${serviceId}/status`);
        if (token) req.set('Authorization', token);
        return req.send({ status: 'closed' });
      },
    },
  ];
}

describe('administrator route protection', () => {
  beforeEach(() => {
    resetAppDb();
    serviceId = seedService();
    admin = seedAdminToken();
    member = seedUserWithToken({ email: 'student@uh.edu' });
  });

  it.each(adminRoutes())('rejects $name without a token', async ({ send }) => {
    const res = await send(null);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it.each(adminRoutes())('rejects $name with an unrecognized token', async ({ send }) => {
    const res = await send('Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired session token' });
  });

  it.each(adminRoutes())('rejects $name for a signed-in non-admin', async ({ send }) => {
    const res = await send(member.auth);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Administrator access required' });
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app)
      .patch(`/api/queues/${serviceId}/status`)
      .set('Authorization', admin.token) // missing the "Bearer " scheme
      .send({ status: 'closed' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('allows an administrator through every guarded route', async () => {
    const created = await request(app)
      .post('/api/services')
      .set('Authorization', admin.auth)
      .send(VALID_SERVICE);
    const updated = await request(app)
      .put(`/api/services/${created.body.id}`)
      .set('Authorization', admin.auth)
      .send({ ...VALID_SERVICE, name: 'Registrar Desk' });
    const closed = await request(app)
      .patch(`/api/queues/${created.body.id}/status`)
      .set('Authorization', admin.auth)
      .send({ status: 'closed' });

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Registrar Desk');
    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({ serviceId: created.body.id, status: 'closed' });
  });

  it('reads the role from the database, not from the request body', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', member.auth)
      .send({ ...VALID_SERVICE, role: 'admin' });

    expect(res.status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) AS count FROM services').get().count).toBe(1);
  });

  it('honours a token issued by the real login endpoint', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dean@uh.edu', password: 'super-secret-1', role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dean@uh.edu', password: 'super-secret-1' });

    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send(VALID_SERVICE);

    expect(login.status).toBe(200);
    expect(res.status).toBe(201);
  });
});

describe('queue entry ownership', () => {
  beforeEach(() => {
    resetAppDb();
    serviceId = seedService();
    admin = seedAdminToken();
    member = seedUserWithToken({ email: 'student@uh.edu' });
  });

  it('rejects reading the queue roster without a token', async () => {
    const res = await request(app).get(`/api/queues/${serviceId}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('rejects joining without a token', async () => {
    const res = await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .send({ userId: String(member.userId), priority: 'low' });

    expect(res.status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS count FROM queue_entries').get().count).toBe(0);
  });

  it('rejects joining a queue on behalf of someone else', async () => {
    const other = seedUserWithToken({ email: 'other@uh.edu' });

    const res = await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', member.auth)
      .send({ userId: String(other.userId), priority: 'low' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'You can only manage your own queue entry' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM queue_entries').get().count).toBe(0);
  });

  it('rejects removing another user from the queue as a non-admin', async () => {
    const other = seedUserWithToken({ email: 'other@uh.edu' });
    await request(app)
      .post(`/api/queues/${serviceId}/join`)
      .set('Authorization', other.auth)
      .send({ userId: String(other.userId), priority: 'low' });

    const res = await request(app)
      .delete(`/api/queues/${serviceId}/leave`)
      .set('Authorization', member.auth)
      .send({ userId: String(other.userId) });

    expect(res.status).toBe(403);
    expect(db.prepare('SELECT status FROM queue_entries WHERE user_id = ?').get(other.userId).status)
      .toBe('waiting');
  });
});
