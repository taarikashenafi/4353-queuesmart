import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateId, resetStore, store } from '../store.js';

function seedHistory(overrides = {}) {
  const entry = {
    id: generateId(),
    userId: 'u1',
    serviceId: 's1',
    serviceName: 'Academic Advising',
    date: new Date().toISOString(),
    outcome: 'served',
    waitTime: 10,
    ...overrides,
  };
  store.history.push(entry);
  return entry;
}

describe('history API', () => {
  beforeEach(() => resetStore());

  it('returns an empty array for a user with no history', async () => {
    const res = await request(app).get('/api/history/u1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a user's history newest-first", async () => {
    seedHistory({ id: '1', date: '2026-07-20T10:00:00.000Z', outcome: 'served' });
    seedHistory({ id: '2', date: '2026-07-22T10:00:00.000Z', outcome: 'left' });
    seedHistory({ id: '3', userId: 'other', date: '2026-07-23T10:00:00.000Z' });

    const res = await request(app).get('/api/history/u1');

    expect(res.status).toBe(200);
    expect(res.body.map((h) => h.id)).toEqual(['2', '1']);
  });

  it('reports zero served and zero average wait for a service with no history', async () => {
    const res = await request(app).get('/api/stats');

    expect(res.status).toBe(200);
    expect(res.body.find((s) => s.serviceId === 's1')).toEqual({
      serviceId: 's1',
      serviceName: 'Academic Advising',
      totalServed: 0,
      averageWait: 0,
    });
  });

  it('aggregates total served and average wait per service, ignoring left entries', async () => {
    seedHistory({ id: '1', serviceId: 's1', serviceName: 'Academic Advising', outcome: 'served', waitTime: 10 });
    seedHistory({ id: '2', serviceId: 's1', serviceName: 'Academic Advising', outcome: 'served', waitTime: 20 });
    seedHistory({ id: '3', serviceId: 's1', serviceName: 'Academic Advising', outcome: 'left' });

    const res = await request(app).get('/api/stats');

    expect(res.body.find((s) => s.serviceId === 's1')).toEqual({
      serviceId: 's1',
      serviceName: 'Academic Advising',
      totalServed: 2,
      averageWait: 15,
    });
  });
});
