import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import { estimateWait } from '../waitTime.js';

function createUser(email = 'student@uh.edu') {
  const result = db
    .prepare('INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, 'hash', 'user');
  return Number(result.lastInsertRowid);
}

function seedNotification(userId, { message = 'You are next in line', status = 'sent', createdAt } = {}) {
  if (createdAt) {
    db.prepare(
      'INSERT INTO notifications (user_id, message, status, created_at) VALUES (?, ?, ?, ?)',
    ).run(userId, message, status, createdAt);
  } else {
    db.prepare('INSERT INTO notifications (user_id, message, status) VALUES (?, ?, ?)').run(
      userId,
      message,
      status,
    );
  }
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
  let userId;

  beforeEach(() => {
    resetAppDb();
    userId = createUser();
  });

  it('returns an empty array for a user with no notifications', async () => {
    const res = await request(app).get(`/api/notifications/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a user's notifications newest-first", async () => {
    seedNotification(userId, { message: 'first', createdAt: '2026-08-01 10:00:00' });
    seedNotification(userId, { message: 'second', createdAt: '2026-08-01 11:00:00' });
    const otherUserId = createUser('other@uh.edu');
    seedNotification(otherUserId, { message: 'not mine' });

    const res = await request(app).get(`/api/notifications/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.message)).toEqual(['second', 'first']);
  });

  it('marks a user\'s notifications as viewed without affecting other users', async () => {
    seedNotification(userId);
    const otherUserId = createUser('other@uh.edu');
    seedNotification(otherUserId);

    const res = await request(app).post(`/api/notifications/${userId}/read`);

    expect(res.status).toBe(200);
    expect(res.body.every((n) => n.status === 'viewed')).toBe(true);
    expect(
      db.prepare('SELECT status FROM notifications WHERE user_id = ?').get(otherUserId).status,
    ).toBe('sent');
  });

  it('rejects inserting a notification for a nonexistent user via the FK constraint', () => {
    expect(() =>
      db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)').run(999999, 'test'),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});
