// Unit tests for reportService.js, one layer below reports.test.js, which
// only checks response shape through the HTTP boundary. These assert
// against hand-calculated numbers on known seeded rows, and call the query
// functions directly so a broken query fails here even if a route-level
// mock would have hidden it.
//
// served_at (Surafel's migration, Shared Contract #4) still hasn't landed
// in schema.sql as of writing this. reportService.js already degrades
// gracefully without it, see hasServedAt(), but that means the "real"
// wait-time SQL path never actually gets exercised by anything else in the
// suite. Rather than sit around waiting on the migration,
// addServedAtColumnIfMissing() patches the column onto this file's own
// in-memory database so I can run the observed-wait tests today. Delete it
// once schema.sql actually has the column, it'll just be a no-op by then.

import { beforeEach, describe, expect, it } from 'vitest';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import {
  participationReport,
  serviceActivityReport,
  usageStatisticsReport,
} from '../services/reportService.js';

function addServedAtColumnIfMissing() {
  const hasColumn = db
    .prepare('PRAGMA table_info(queue_entries)')
    .all()
    .some((column) => column.name === 'served_at');
  if (!hasColumn) {
    db.exec('ALTER TABLE queue_entries ADD COLUMN served_at TEXT');
  }
}

addServedAtColumnIfMissing();

const REPORTS = {
  participation: participationReport,
  services: serviceActivityReport,
  summary: usageStatisticsReport,
};

let userId;
let otherUserId;
let serviceId; // has history, three served entries with known wait times
let quietServiceId; // configured but never used, must still show up as a zero row

beforeEach(() => {
  resetAppDb();

  userId = Number(
    db
      .prepare("INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, 'user')")
      .run('student@uh.edu', 'hash').lastInsertRowid,
  );
  otherUserId = Number(
    db
      .prepare("INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, 'user')")
      .run('other@uh.edu', 'hash').lastInsertRowid,
  );
  db.prepare('INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)').run(userId, 'Student One');

  serviceId = Number(
    db
      .prepare('INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)')
      .run('Advising', 'Degree planning', 15, 'medium').lastInsertRowid,
  );
  quietServiceId = Number(
    db
      .prepare('INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)')
      .run('Financial Aid', 'Aid questions', 20, 'low').lastInsertRowid,
  );

  const queueId = Number(
    db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(serviceId).lastInsertRowid,
  );
  db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'closed')").run(quietServiceId);

  function addEntry({ user = userId, joinedAt, servedAt = null, status = 'served' }) {
    db.prepare(`
      INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority, served_at)
      VALUES (?, ?, 1, ?, ?, 'low', ?)
    `).run(queueId, user, joinedAt, status, servedAt);
  }

  // Known, hand-calculable waits: 10, 20, 30 minutes. Mean = 20.
  addEntry({ joinedAt: '2026-08-01 09:00:00', servedAt: '2026-08-01 09:10:00' });
  addEntry({ user: otherUserId, joinedAt: '2026-08-02 09:00:00', servedAt: '2026-08-02 09:20:00' });
  addEntry({ joinedAt: '2026-08-03 09:00:00', servedAt: '2026-08-03 09:30:00' });
  // Outside the Aug 1-3 window the boundary tests below use.
  addEntry({ joinedAt: '2026-08-10 09:00:00', servedAt: '2026-08-10 09:05:00' });
  // No wait to report here, an empty cell, not a zero.
  addEntry({ joinedAt: '2026-08-01 12:00:00', servedAt: null, status: 'canceled' });
  addEntry({ joinedAt: '2026-08-01 13:00:00', servedAt: null, status: 'waiting' });
});

describe('shared payload shape', () => {
  it.each(Object.entries(REPORTS))('%s returns the shared payload with non-empty columns', (_, fn) => {
    const result = fn();

    expect(Object.keys(result).sort()).toEqual(
      ['columns', 'filters', 'generatedAt', 'rows', 'summary', 'title'].sort(),
    );
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.columns.every((c) => c.key && c.label)).toBe(true);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(Array.isArray(result.summary)).toBe(true);
  });
});

describe('date filter boundaries', () => {
  it('is inclusive at both ends of the range', () => {
    const exact = participationReport({ from: '2026-08-01', to: '2026-08-01' });
    // Three entries were joined on 2026-08-01: one served, one canceled, one waiting.
    expect(exact.rows).toHaveLength(3);

    const window = participationReport({ from: '2026-08-01', to: '2026-08-03' });
    // Adds the 08-02 and 08-03 served entries, still excludes the 08-10 one.
    expect(window.rows).toHaveLength(5);
  });

  it('excludes entries outside the range at both boundaries', () => {
    const beforeWindow = participationReport({ from: '2026-08-02', to: '2026-08-03' });
    expect(beforeWindow.rows.some((r) => r.joinedAt.startsWith('2026-08-01'))).toBe(false);

    const afterWindow = participationReport({ from: '2026-08-01', to: '2026-08-03' });
    expect(afterWindow.rows.some((r) => r.joinedAt.startsWith('2026-08-10'))).toBe(false);
  });
});

describe('serviceId filter', () => {
  it('narrows to one service', () => {
    const narrowed = usageStatisticsReport({ serviceId });
    expect(narrowed.rows).toHaveLength(1);
    expect(narrowed.rows[0].serviceName).toBe('Advising');
  });

  it('rejects a non-numeric serviceId by matching nothing, without throwing', () => {
    // It's bound as a named SQL parameter, never concatenated, so a value
    // like this can only fail an equality comparison. It can't widen one.
    expect(() => usageStatisticsReport({ serviceId: '1 OR 1=1' })).not.toThrow();
    expect(usageStatisticsReport({ serviceId: '1 OR 1=1' }).rows).toHaveLength(0);
  });
});

describe('average actual wait', () => {
  it('matches a hand-calculated value from served_at - joined_at', () => {
    const result = usageStatisticsReport({ from: '2026-08-01', to: '2026-08-03', serviceId });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].totalServed).toBe(3);
    expect(result.rows[0].averageWaitMinutes).toBe(20); // mean of 10, 20, 30

    const summaryWait = result.summary.find((s) => s.label === 'Average wait (min)');
    expect(summaryWait.value).toBe(20);
  });

  it('reports the same figure in the participation summary', () => {
    const result = participationReport({ from: '2026-08-01', to: '2026-08-03', serviceId });
    const summaryWait = result.summary.find((s) => s.label === 'Average wait (min)');
    expect(summaryWait.value).toBe(20);
  });
});

describe('a service with no history', () => {
  it('still appears as a zero row rather than being dropped', () => {
    const activity = serviceActivityReport({ serviceId: quietServiceId });
    expect(activity.rows).toHaveLength(1);
    expect(activity.rows[0]).toMatchObject({
      serviceName: 'Financial Aid',
      totalJoined: 0,
      totalServed: 0,
      totalCanceled: 0,
      waitingNow: 0,
    });

    const usage = usageStatisticsReport({ serviceId: quietServiceId });
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({
      serviceName: 'Financial Aid',
      totalServed: 0,
      averageWaitMinutes: 0,
      busiestHour: '',
    });
  });
});

describe('empty result sets', () => {
  it('still returns valid columns and an empty rows array', () => {
    const result = participationReport({ from: '2099-01-01', to: '2099-01-02' });
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.rows).toEqual([]);
  });
});
