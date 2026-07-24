import crypto from 'node:crypto';
import { store, generateId } from '../store.js';
import {
  ApiError,
  requireFields,
  requireEmail,
  requireMinLength,
  requireOneOf,
} from '../validators.js';

// Business logic for authentication. Routes stay thin HTTP adapters;
// everything about *how* users register and log in lives here.

const ROLES = ['user', 'admin'];
const MIN_PASSWORD_LENGTH = 8;

// Passwords are never stored in plain text, even in the in-memory store.
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

export function registerUser(input) {
  requireFields(input, ['email', 'password', 'role']);
  const { email, password, role } = input;

  const normalizedEmail = String(email).trim().toLowerCase();
  requireEmail(normalizedEmail);
  requireMinLength(password, 'password', MIN_PASSWORD_LENGTH);
  requireOneOf(role, 'role', ROLES);

  if (store.users.some((u) => u.email === normalizedEmail)) {
    throw new ApiError(400, 'Email is already registered');
  }

  const user = {
    id: generateId(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);

  return publicUser(user);
}

export function loginUser(input) {
  requireFields(input, ['email', 'password']);
  const { email, password } = input;

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = store.users.find((u) => u.email === normalizedEmail);
  if (!user || user.passwordHash !== hashPassword(String(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = crypto.randomBytes(24).toString('hex');
  store.sessions[token] = user.id;

  return { user: publicUser(user), token };
}
