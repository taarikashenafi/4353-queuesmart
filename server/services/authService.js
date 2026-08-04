import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import {
  ApiError,
  requireFields,
  requireEmail,
  requireMinLength,
  requireOneOf,
  requireString,
} from '../validators.js';

// Business logic for authentication. Routes stay thin HTTP adapters;
// everything about *how* users register and log in lives here.
// Credentials are persisted in the user_credentials table; passwords
// are hashed with bcrypt and never stored in plain text.

const ROLES = ['user', 'admin'];
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

// Session tokens are short-lived and per-server, so they live in
// memory rather than in the database.
export const sessions = new Map(); // token -> userId

function publicUser(row) {
  return { id: String(row.id), email: row.email, role: row.role };
}

export function registerUser(input) {
  requireFields(input, ['email', 'password', 'role']);
  const { email, password, role, fullName } = input;

  const normalizedEmail = String(email).trim().toLowerCase();
  requireEmail(normalizedEmail);
  requireMinLength(password, 'password', MIN_PASSWORD_LENGTH);
  requireOneOf(role, 'role', ROLES);
  if (fullName !== undefined && fullName !== null && fullName !== '') {
    requireString(fullName, 'fullName', { maxLength: 100 });
  }

  const passwordHash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);

  let result;
  try {
    result = db
      .prepare(
        'INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)'
      )
      .run(normalizedEmail, passwordHash, role);
  } catch (err) {
    // The UNIQUE constraint on email is the database-level guard
    // against duplicate accounts.
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      throw new ApiError(400, 'Email is already registered');
    }
    throw err;
  }

  const userId = result.lastInsertRowid;
  if (fullName) {
    db.prepare(
      'INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)'
    ).run(userId, fullName.trim());
  }

  return publicUser({ id: userId, email: normalizedEmail, role });
}

export function loginUser(input) {
  requireFields(input, ['email', 'password']);
  const { email, password } = input;

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db
    .prepare('SELECT * FROM user_credentials WHERE email = ?')
    .get(normalizedEmail);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, String(user.id));

  return { user: publicUser(user), token };
}
