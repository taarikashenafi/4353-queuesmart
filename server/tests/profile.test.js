import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { resetAppDb } from './helpers/testDb.js';

const VALID_USER = { email: 'student@uh.edu', password: 'password123', role: 'user' };
const VALID_PROFILE = {
  fullName: 'Sam Student',
  phone: '713-555-0100',
  preferences: { notifications: 'email' },
};

let userId;

beforeEach(async () => {
  resetAppDb();
  const res = await request(app).post('/api/auth/register').send(VALID_USER);
  userId = res.body.id;
});

function getProfile(id = userId) {
  return request(app).get(`/api/profile/${id}`);
}

function putProfile(body, id = userId) {
  return request(app).put(`/api/profile/${id}`).send(body);
}

describe('GET /api/profile/:userId', () => {
  it('returns an empty profile for a user who has not saved one', async () => {
    const res = await getProfile();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId,
      email: 'student@uh.edu',
      fullName: '',
      phone: '',
      preferences: null,
    });
  });

  it('returns 404 for an unknown user', async () => {
    const res = await getProfile('9999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });
});

describe('PUT /api/profile/:userId', () => {
  it('creates the profile and returns it', async () => {
    const res = await putProfile(VALID_PROFILE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId,
      email: 'student@uh.edu',
      fullName: 'Sam Student',
      phone: '713-555-0100',
      preferences: { notifications: 'email' },
    });
  });

  it('persists the profile so a later GET returns it', async () => {
    await putProfile(VALID_PROFILE);
    const res = await getProfile();

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Sam Student');
    expect(res.body.preferences).toEqual({ notifications: 'email' });
  });

  it('updates an existing profile instead of duplicating it', async () => {
    await putProfile(VALID_PROFILE);
    const res = await putProfile({ fullName: 'Sam Q. Student' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Sam Q. Student');
    expect(res.body.phone).toBe('');
  });

  it('trims whitespace from the full name', async () => {
    const res = await putProfile({ fullName: '  Sam Student  ' });

    expect(res.body.fullName).toBe('Sam Student');
  });

  it('returns 404 for an unknown user', async () => {
    const res = await putProfile(VALID_PROFILE, '9999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  it('rejects a missing fullName', async () => {
    const res = await putProfile({ phone: '713-555-0100' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('fullName is required');
  });

  it('rejects a fullName over 100 characters', async () => {
    const res = await putProfile({ fullName: 'x'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 100/);
  });

  it('rejects a phone number over 20 characters', async () => {
    const res = await putProfile({ fullName: 'Sam', phone: '1'.repeat(21) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 20/);
  });

  it('rejects preferences that are not an object', async () => {
    const res = await putProfile({ fullName: 'Sam', preferences: 'email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('preferences must be an object');
  });

  it('allows clearing optional fields', async () => {
    await putProfile(VALID_PROFILE);
    const res = await putProfile({ fullName: 'Sam Student', phone: '', preferences: null });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('');
    expect(res.body.preferences).toBeNull();
  });
});
