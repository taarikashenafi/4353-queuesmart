import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateId, resetStore, store } from '../store.js';
import { estimateWait } from '../waitTime.js';

function seedNotification(overrides = {}) {
  const notification = {
    id: generateId(),
    userId: 'u1',
    message: 'You are next in line',
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
  store.notifications.push(notification);
  return notification;
}

describe('estimateWait', () => {
  it('returns 0 wait for position 0', () => {
    expect(estimateWait(0, 15)).toBe(0);
  });

  it('multiplies position by expected duration', () => {
    expect(estimateWait(3, 10)).toBe(30);
  });

  it('throws for a negative position', () => {
    expect(() => estimateWait(-1, 10)).toThrow('position must be a non-negative number');
  });

  it('throws for a non-number position', () => {
    expect(() => estimateWait('2', 10)).toThrow('position must be a non-negative number');
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
  ])('throws for a %s expected duration', (label, expectedDuration) => {
    expect(() => estimateWait(2, expectedDuration)).toThrow('expectedDuration must be a positive number');
  });
});

describe('notifications API', () => {
  beforeEach(() => resetStore());

  it('returns an empty array for a user with no notifications', async () => {
    const res = await request(app).get('/api/notifications/u1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a user's notifications newest-first", async () => {
    seedNotification({ id: '1', message: 'first', createdAt: '2026-07-23T10:00:00.000Z' });
    seedNotification({ id: '2', message: 'second', createdAt: '2026-07-23T11:00:00.000Z' });
    seedNotification({ id: '3', userId: 'other', message: 'not mine', createdAt: '2026-07-23T12:00:00.000Z' });

    const res = await request(app).get('/api/notifications/u1');

    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.message)).toEqual(['second', 'first']);
  });

  it("marks a user's notifications as read without affecting other users", async () => {
    seedNotification({ id: '1' });
    seedNotification({ id: '2', userId: 'other' });

    const res = await request(app).post('/api/notifications/u1/read');

    expect(res.status).toBe(200);
    expect(res.body.every((n) => n.read)).toBe(true);
    expect(store.notifications.find((n) => n.id === '2').read).toBe(false);
  });
});
