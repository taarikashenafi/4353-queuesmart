// Report route tests, in the order a request meets them: the admin guard, then
// filter validation, then the full path through the queries and the exporter
// out to the HTTP response.

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { resetAppDb } from './helpers/testDb.js';
import { seedAdminToken, seedUserWithToken } from './helpers/auth.js';
import { downloadName } from '../routes/reports.js';

const ROUTES = [
  '/api/reports/participation',
  '/api/reports/services',
  '/api/reports/summary',
];

let admin;
let member;

beforeEach(() => {
  resetAppDb();
  admin = seedAdminToken();
  member = seedUserWithToken({ email: 'student@uh.edu' });
});

describe('report route protection', () => {
  it.each(ROUTES)('rejects %s without a token', async (route) => {
    const res = await request(app).get(route);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it.each(ROUTES)('rejects %s with an unrecognized token', async (route) => {
    const res = await request(app).get(route).set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired session token' });
  });

  it.each(ROUTES)('rejects %s for a signed-in non-admin', async (route) => {
    const res = await request(app).get(route).set('Authorization', member.auth);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Administrator access required' });
  });
});

describe('download filename', () => {
  // The frontend's apiDownload() parses this name back out of the
  // Content-Disposition header, so the format is a contract, not cosmetic.
  it.each(['participation', 'services', 'summary'])('names the %s export', (slug) => {
    expect(downloadName(slug, 'csv')).toMatch(
      new RegExp(`^queuesmart-${slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
    );
  });

  it('carries the extension it is given', () => {
    expect(downloadName('summary', 'pdf')).toMatch(/\.pdf$/);
  });

  it('contains no characters that would need quoting in a header', () => {
    expect(downloadName('participation', 'csv')).not.toMatch(/[";\s]/);
  });
});

describe('report filter validation', () => {
  function get(query) {
    return request(app).get(`/api/reports/participation${query}`).set('Authorization', admin.auth);
  }

  it('rejects a from date that is not YYYY-MM-DD', async () => {
    const res = await get('?from=08/01/2026');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be a date in YYYY-MM-DD format' });
  });

  it('rejects a to date that is not YYYY-MM-DD', async () => {
    const res = await get('?to=yesterday');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'to must be a date in YYYY-MM-DD format' });
  });

  it('rejects a well-formed date that is not a real calendar day', async () => {
    // JavaScript rolls this forward to March 2 rather than failing, which
    // would silently shift the range the admin asked for.
    const res = await get('?from=2026-02-30');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be a real calendar date' });
  });

  it('rejects a range that runs backwards', async () => {
    const res = await get('?from=2026-08-14&to=2026-08-01');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be on or before to' });
  });

  it('accepts a range whose endpoints are the same day', async () => {
    const res = await get('?from=2026-08-01&to=2026-08-01');

    expect(res.status).not.toBe(400);
  });

  it('rejects an unsupported export format', async () => {
    const res = await get('?format=xlsx');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/format must be one of/);
  });

  it('rejects a serviceId that is not a positive integer', async () => {
    // Stopped at the HTTP boundary as well as by the parameterized SQL.
    const res = await get('?serviceId=1 OR 1=1');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'serviceId must be a positive integer' });
  });

  it('rejects a negative serviceId', async () => {
    const res = await get('?serviceId=-3');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'serviceId must be a positive integer' });
  });

  it('treats empty filter values as absent rather than invalid', async () => {
    // The Reports page omits empty controls, but an empty string in the query
    // string must not read as a malformed date.
    const res = await get('?from=&to=&serviceId=&format=');

    expect(res.status).not.toBe(400);
  });
});

// Everything below needs the report queries, so it exercises the full path:
// guard -> filter validation -> reportService -> exporter -> HTTP response.
describe('report responses', () => {
  let serviceId;

  beforeEach(() => {
    // A comma in the service name on purpose: it has to survive the round trip
    // into CSV as a single column.
    serviceId = Number(
      db
        .prepare('INSERT INTO services (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)')
        .run('Advising, North', 'Degree planning', 15, 'medium').lastInsertRowid,
    );
    const queueId = Number(
      db.prepare("INSERT INTO queues (service_id, status) VALUES (?, 'open')").run(serviceId).lastInsertRowid,
    );
    db.prepare(`
      INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority)
      VALUES (?, ?, 1, '2026-08-01 09:00:00', 'served', 'low')
    `).run(queueId, member.userId);
    db.prepare(`
      INSERT INTO queue_entries (queue_id, user_id, position, joined_at, status, priority)
      VALUES (?, ?, 2, '2026-08-02 10:00:00', 'waiting', 'low')
    `).run(queueId, member.userId);
  });

  function asAdmin(path) {
    return request(app).get(path).set('Authorization', admin.auth);
  }

  it.each(ROUTES)('returns the shared payload shape from %s', async (route) => {
    const res = await asAdmin(route);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['columns', 'filters', 'generatedAt', 'rows', 'summary', 'title'].sort(),
    );
    expect(res.body.columns.length).toBeGreaterThan(0);
    expect(res.body.columns.every((column) => column.key && column.label)).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('echoes the active filters, including the resolved service name', async () => {
    const res = await asAdmin(
      `/api/reports/participation?from=2026-08-01&to=2026-08-31&serviceId=${serviceId}`,
    );

    expect(res.body.filters).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      serviceId,
      serviceName: 'Advising, North',
    });
  });

  it('narrows to one service and excludes entries outside the date range', async () => {
    const all = await asAdmin('/api/reports/participation');
    const narrowed = await asAdmin('/api/reports/participation?from=2026-08-01&to=2026-08-01');

    expect(all.body.rows).toHaveLength(2);
    expect(narrowed.body.rows).toHaveLength(1);
    expect(narrowed.body.rows[0].outcome).toBe('served');
  });

  it('sends CSV with the right content type and an attachment filename', async () => {
    const res = await asAdmin('/api/reports/participation?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="${downloadName('participation', 'csv')}"`,
    );
  });

  it.each(ROUTES)('matches the CSV header row to the column labels of %s', async (route) => {
    const json = await asAdmin(route);
    const csv = await asAdmin(`${route}?format=csv`);

    // Derived from the response rather than hardcoded, so relabelling a column
    // in the data layer cannot leave the header silently out of step.
    const expected = json.body.columns.map((column) => column.label).join(',');
    expect(csv.text.split('\n')[0]).toBe(expected);
  });

  it('writes one CSV line per row and keeps a comma inside one column', async () => {
    const json = await asAdmin('/api/reports/participation');
    const csv = await asAdmin('/api/reports/participation?format=csv');

    const body = csv.text.split('\n').slice(1, 1 + json.body.rows.length);
    expect(body).toHaveLength(json.body.rows.length);
    expect(body.every((line) => line.includes('"Advising, North"'))).toBe(true);
  });

  it('reports zero rows as a header-only CSV rather than an empty file', async () => {
    const res = await asAdmin('/api/reports/participation?from=2020-01-01&to=2020-01-02&format=csv');

    expect(res.status).toBe(200);
    expect(res.text.split('\n')[0]).toMatch(/^User,/);
  });
});
