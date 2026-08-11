// Report route tests.
//
// Everything here runs before the report queries are reached — the guards and
// the filter validation — so these hold whether or not reportService.js has
// merged. The payload and CSV-body assertions land alongside it.

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
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
