import { beforeEach, describe, expect, it } from 'vitest';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import { observedServiceMinutes, predictWait } from '../services/smartWait.js';

let serviceId;

beforeEach(() => {
  resetAppDb();
  const result = db
    .prepare(
      'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
    )
    .run('Admissions', 'Enrollment help', 15, 'high');

  serviceId = Number(result.lastInsertRowid);
  const queueId = Number(
    db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(serviceId).lastInsertRowid,
  );
  db.prepare(
    'INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)' 
  ).run('student1@uh.edu', 'hash', 'user');
  db.prepare(
    'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
  ).run(queueId, 1, 1, '2026-08-01T09:00:00.000Z', 'served', 'high', '2026-08-01T09:15:00.000Z');
});
describe('smart wait engine', () => {
  it('falls back to the configured duration when there is no served history', () => {
    resetAppDb();
    const result = db
      .prepare(
        'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
      )
      .run('Library Help', 'Library desk', 18, 'medium');

    const id = Number(result.lastInsertRowid);
    const observed = observedServiceMinutes(id);

    expect(observed).toMatchObject({
      minutesPerPerson: 18,
      sampleSize: 0,
      source: 'default',
    });
  });
  it('ignores idle gaps longer than two hours', () => {
    const result = db
      .prepare(
        'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
      )
      .run('Long Gap Service', 'Long wait on night close', 10, 'medium');

    const serviceIdWithGap = Number(result.lastInsertRowid);
    const queueId = Number(
      db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(serviceIdWithGap).lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(queueId, 1, 1, '2026-08-02T09:00:00.000Z', 'served', 'medium', '2026-08-02T09:05:00.000Z');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(queueId, 2, 2, '2026-08-02T09:00:00.000Z', 'served', 'medium', '2026-08-02T11:35:00.000Z');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(queueId, 3, 3, '2026-08-02T09:00:00.000Z', 'served', 'medium', '2026-08-02T11:40:00.000Z');

    const observed = observedServiceMinutes(serviceIdWithGap);
    expect(observed.sampleSize).toBe(1);
    expect(observed.minutesPerPerson).toBeCloseTo(9.5, 1);
  });
  it('blends with the configured duration as the sample grows', () => {
    const result = db
      .prepare(
        'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
      )
      .run('Blend Service', 'Average over time', 20, 'low');
    const blendServiceId = Number(result.lastInsertRowid);
    const queueId = Number(
      db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(blendServiceId).lastInsertRowid,
    );
    const values = [
      ['2026-08-05T09:00:00.000Z', '2026-08-05T09:10:00.000Z'],
      ['2026-08-05T09:30:00.000Z', '2026-08-05T09:40:00.000Z'],
      ['2026-08-05T10:00:00.000Z', '2026-08-05T10:10:00.000Z'],
      ['2026-08-05T10:30:00.000Z', '2026-08-05T10:40:00.000Z'],
      ['2026-08-05T11:00:00.000Z', '2026-08-05T11:10:00.000Z'],
    ];
    values.forEach(([joinedAt, servedAt], index) => {
      db.prepare(
        'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
      ).run(queueId, index + 1, index + 1, joinedAt, 'served', 'low', servedAt);
    });
    const observed = observedServiceMinutes(blendServiceId);
    expect(observed.source).toBe('blended');
    expect(observed.minutesPerPerson).toBeCloseTo(15, 1);
    expect(observed.sampleSize).toBe(5);
    expect(predictWait(blendServiceId, 3)).toBe(45);
  });
  it('predicts a shorter wait when a service is faster than its configured duration', () => {
    const result = db
      .prepare(
        'INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)'
      )
      .run('Fast Service', 'Faster than expected', 25, 'low');
    const fastServiceId = Number(result.lastInsertRowid);
    const queueId = Number(
      db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(fastServiceId).lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(queueId, 1, 1, '2026-08-06T09:00:00.000Z', 'served', 'low', '2026-08-06T09:05:00.000Z');
    db.prepare(
      'INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(queueId, 2, 1, '2026-08-06T09:15:00.000Z', 'served', 'low', '2026-08-06T09:20:00.000Z');
    const observed = observedServiceMinutes(fastServiceId);
    expect(observed.minutesPerPerson).toBeLessThan(25);
    expect(observed.source).toBe('blended');
    expect(predictWait(fastServiceId, 3)).toBeLessThan(3 * 25);
  });
});
