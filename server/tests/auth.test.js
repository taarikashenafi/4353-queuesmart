import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db/index.js';
import { sessions } from '../services/authService.js';
import { resetAppDb } from './helpers/testDb.js';

const VALID_USER = { email: 'student@uh.edu', password: 'password123', role: 'user' };

function register(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, ...overrides });
}

function userCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM user_credentials').get().n;
}

describe('POST /api/auth/register', () => {
  beforeEach(() => resetAppDb());

  it('registers a new user and returns the public profile', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), email: 'student@uh.edu', role: 'user' });
    expect(userCount()).toBe(1);
  });

  it('stores the password as a bcrypt hash, never plain text', async () => {
    const res = await register();

    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();

    const row = db
      .prepare('SELECT password_hash FROM user_credentials WHERE email = ?')
      .get('student@uh.edu');
    expect(row.password_hash).toBeDefined();
    expect(row.password_hash).not.toBe(VALID_USER.password);
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('registers an admin when role is admin', async () => {
    const res = await register({ email: 'staff@uh.edu', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('admin');
  });

  it('normalizes the email to lowercase', async () => {
    const res = await register({ email: '  Student@UH.edu ' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('student@uh.edu');
  });

  it('creates a profile row when fullName is provided', async () => {
    const res = await register({ fullName: 'Sam Student' });

    expect(res.status).toBe(201);
    const row = db
      .prepare('SELECT full_name FROM user_profiles WHERE user_id = ?')
      .get(res.body.id);
    expect(row.full_name).toBe('Sam Student');
  });

  it('rejects a duplicate email', async () => {
    await register();
    const res = await register();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Email is already registered' });
    expect(userCount()).toBe(1);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await register();
    const res = await register({ email: 'STUDENT@uh.edu' });

    expect(res.status).toBe(400);
  });

  it.each([
    ['not-an-email'],
    ['missing@domain'],
    ['@no-local.com'],
    ['spaces in@email.com'],
  ])('rejects invalid email format %s', async (email) => {
    const res = await register({ email });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid email/);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await register({ password: 'short1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8/);
  });

  it('rejects an invalid role', async () => {
    const res = await register({ role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role must be one of/);
  });

  it('rejects a fullName over 100 characters', async () => {
    const res = await register({ fullName: 'x'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 100/);
  });

  it.each([['email'], ['password'], ['role']])(
    'rejects a request missing %s',
    async (field) => {
      const res = await register({ [field]: undefined });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(`${field} is required`);
    },
  );

  it('rejects an empty request body', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    resetAppDb();
    await register();
  });

  function login(credentials) {
    return request(app).post('/api/auth/login').send(credentials);
  }

  it('logs in with valid credentials and returns user and token', async () => {
    const res = await login({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: expect.any(String), email: 'student@uh.edu', role: 'user' });
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.token.length).toBeGreaterThanOrEqual(32);
  });

  it('stores the session so the token maps to the user', async () => {
    const res = await login({ email: VALID_USER.email, password: VALID_USER.password });

    expect(sessions.get(res.body.token)).toBe(res.body.user.id);
  });

  it('treats the email as case-insensitive', async () => {
    const res = await login({ email: 'STUDENT@UH.EDU', password: VALID_USER.password });

    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login({ email: VALID_USER.email, password: 'wrongpass99' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('rejects an unknown email with the same 401 message', async () => {
    const res = await login({ email: 'nobody@uh.edu', password: VALID_USER.password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it.each([['email'], ['password']])('rejects a login missing %s', async (field) => {
    const credentials = { email: VALID_USER.email, password: VALID_USER.password };
    delete credentials[field];
    const res = await login(credentials);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(`${field} is required`);
  });

  it('does not leak the password in the login response', async () => {
    const res = await login({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON for a route that does not exist', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
