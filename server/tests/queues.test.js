import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { resetStore, store } from '../store.js';

const SERVICE_ID = 'svc-1';

// seed so the test queuee works right
function seedService() {
  store.services.push({
    id: SERVICE_ID,
    name: 'General Support',
    description: 'General assistance',
    expectedDuration: 15,
    priority: 'medium',
  });
}

//mixed queue so testing priority stuff kinda works
function seedQueue() {
  store.queues[SERVICE_ID] = [
    { userId: 'user-1', priority: 'low', joinedAt: '2026-07-24T10:00:00.000Z' },
    { userId: 'user-2', priority: 'high', joinedAt: '2026-07-24T10:05:00.000Z' },
    { userId: 'user-3', priority: 'medium', joinedAt: '2026-07-24T10:02:00.000Z' },
    { userId: 'user-4', priority: 'high', joinedAt: '2026-07-24T10:01:00.000Z' },
  ];
}
describe('Queue API', () => {
  // reset the in-memory store before each test so they stay kinda independent.
  beforeEach(() => {
    resetStore();
    seedService();
  });
  it('joins a queue for an existing service', async () => {
    const res = await request(app)
      .post(`/api/queues/${SERVICE_ID}/join`)
      .send({ userId: 'user-1', priority: 'low' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Joined queue successfully',
      queueLength: 1,
      position: 1,
    });


  });

  it('rejects duplicate join for the same user in the same queue', async () => {
    store.queues[SERVICE_ID] = [{ userId: 'user-1', priority: 'low', joinedAt: new Date().toISOString() }];

    const res = await request(app)
      .post(`/api/queues/${SERVICE_ID}/join`)
      .send({ userId: 'user-1', priority: 'low' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'User is already in this queue' });
  });
  it('returns 404 when joining a nonexistent service', async () => {
    const res = await request(app)
      .post('/api/queues/missing-service/join')
      .send({ userId: 'user-1', priority: 'low' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Service not found' });
  });

  it('lets a user leave the queue', async () => {
    store.queues[SERVICE_ID] = [{ userId: 'user-1', priority: 'low', joinedAt: new Date().toISOString() }];

    const res = await request(app).delete(`/api/queues/${SERVICE_ID}/leave`).send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Left queue successfully' });
    expect(store.queues[SERVICE_ID]).toEqual([]);
  });
  // make sure higher priority users go first
  it('orders queue entries by priority then arrival time', async () => {
    seedQueue();

    const res = await request(app).get(`/api/queues/${SERVICE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.queue.map((entry) => entry.userId)).toEqual(['user-4', 'user-2', 'user-3', 'user-1']);
  });

  //check that the api gives the right position and wait time.
  it('returns a user position and estimated wait time', async () => {
    seedQueue();

    const res = await request(app).get(`/api/queues/${SERVICE_ID}?userId=user-3`);
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(3);
    expect(res.body.estimatedWait).toBe(30);
  });

  // serving the next user should remove them and save it wihtin history.
  it('serves the next user and records history', async () => {
    store.queues[SERVICE_ID] = [
      { userId: 'user-1', priority: 'low', joinedAt: '2026-07-24T10:00:00.000Z' },
      { userId: 'user-2', priority: 'high', joinedAt: '2026-07-24T10:01:00.000Z' },
    ];

    const res = await request(app).post(`/api/queues/${SERVICE_ID}/serve`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Served next user', userId: 'user-2' });
    expect(store.queues[SERVICE_ID]).toHaveLength(1);
    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      userId: 'user-2',
      serviceId: SERVICE_ID,
      serviceName: 'General Support',
      outcome: 'served',
    });
  });
  it('creates notifications when a user joins a queue', async () => {
    const res = await request(app)
      .post(`/api/queues/${SERVICE_ID}/join`)
      .send({ userId: 'user-1', priority: 'low' });

    expect(res.status).toBe(201);
    expect(store.notifications).toHaveLength(2);
    expect(store.notifications[0]).toMatchObject({
      userId: 'user-1',
      read: false,
    });
    expect(store.notifications[1].message).toMatch(/near the front/);
  });
});
