import db from '../db/index.js';
import { ApiError, requireFields, requireString } from '../validators.js';

// User profile details (user_profiles table). One row per user,
// created lazily the first time the profile is saved.

const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 20;

function findUser(userId) {
  const user = db
    .prepare('SELECT id, email FROM user_credentials WHERE id = ?')
    .get(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
}

function parsePreferences(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getProfile(userId) {
  const user = findUser(userId);
  const row = db
    .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
    .get(user.id);

  return {
    userId: String(user.id),
    email: user.email,
    fullName: row?.full_name ?? '',
    phone: row?.phone ?? '',
    preferences: parsePreferences(row?.preferences),
  };
}

export function updateProfile(userId, input) {
  const user = findUser(userId);
  requireFields(input, ['fullName']);
  const { fullName, phone, preferences } = input;

  requireString(fullName, 'fullName', { maxLength: MAX_NAME_LENGTH });
  if (phone !== undefined && phone !== null && phone !== '') {
    requireString(phone, 'phone', { maxLength: MAX_PHONE_LENGTH });
  }
  if (
    preferences !== undefined &&
    preferences !== null &&
    (typeof preferences !== 'object' || Array.isArray(preferences))
  ) {
    throw new ApiError(400, 'preferences must be an object');
  }

  db.prepare(
    `INSERT INTO user_profiles (user_id, full_name, phone, preferences)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       full_name = excluded.full_name,
       phone = excluded.phone,
       preferences = excluded.preferences`
  ).run(
    user.id,
    fullName.trim(),
    phone ? String(phone).trim() : null,
    preferences ? JSON.stringify(preferences) : null
  );

  return getProfile(userId);
}
