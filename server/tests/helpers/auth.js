// Helpers for tests that need to call authenticated or administrator-only
// routes.
//
// Users are inserted directly and a session token is minted the same way
// loginUser() does. This skips bcrypt (which is deliberately slow) while
// still exercising the real middleware path: the token is looked up in the
// live sessions map and the role is read back out of the database.
//
// Call these AFTER resetAppDb(), which clears both the tables and the
// sessions map.

import crypto from 'node:crypto';
import db from '../../db/index.js';
import { sessions } from '../../services/authService.js';

// Mints a session token for a user that already exists — one created by the
// real /api/auth/register endpoint, or inserted by a test's own fixture.
export function issueToken(userId) {
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, String(userId));

  return { userId, token, auth: `Bearer ${token}` };
}

export function seedUserWithToken({ email, role = 'user' }) {
  const result = db
    .prepare('INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, 'test-hash', role);

  return issueToken(Number(result.lastInsertRowid));
}

export function seedAdminToken(email = 'admin@example.com') {
  return seedUserWithToken({ email, role: 'admin' });
}
