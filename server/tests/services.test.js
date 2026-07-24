import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { resetStore, store } from '../store.js';

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
  beforeEach(() => resetStore());

  it('lists the seeded services', async () => {
    const res = await request(app).get('/api/services');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toEqual({
      id: 's1',
      name: 'Academic Advising',
      description: expect.any(String),
      expectedDuration: 15,
      priority: 'high',
    });
  });

  it('creates a service and stores normalized text', async () => {
    const res = await createService({
      name: '  Registrar  ',
      description: '  Registration and transcript support.  ',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      ...VALID_SERVICE,
    });
    expect(store.services).toContainEqual(res.body);
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
  ])('rejects a %s expected duration', async (label, expectedDuration) => {
    const res = await createService({ expectedDuration });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive number/);
  });

  it('rejects an unsupported priority', async () => {
    const res = await createService({ priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/low, medium, high/);
  });

  it('updates an existing service', async () => {
    const updated = {
      name: 'Updated Advising',
      description: 'Updated service description.',
      expectedDuration: 25,
      priority: 'low',
    };
    const res = await request(app).put('/api/services/s1').send(updated);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 's1', ...updated });
    expect(store.services.find((service) => service.id === 's1')).toEqual(res.body);
  });

  it('returns 404 when updating an unknown service', async () => {
    const res = await request(app).put('/api/services/missing').send(VALID_SERVICE);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Service not found' });
  });
});
