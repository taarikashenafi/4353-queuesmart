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

export function seedUserWithToken({ email, role = 'user' }) {
  const result = db
    .prepare('INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, 'test-hash', role);

  const userId = Number(result.lastInsertRowid);
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, String(userId));

  return { userId, token, auth: `Bearer ${token}` };
}

export function seedAdminToken(email = 'admin@example.com') {
  return seedUserWithToken({ email, role: 'admin' });
}
