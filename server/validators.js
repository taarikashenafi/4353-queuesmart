// Shared validation helpers for all backend modules.
// Invalid input is reported by throwing ApiError, which the global
// error middleware turns into a JSON { error } response.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireFields(body, fields) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Request body is required');
  }
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      throw new ApiError(400, `${field} is required`);
    }
  }
}

export function requireString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `${field} must be a non-empty string`);
  }
  if (maxLength && value.length > maxLength) {
    throw new ApiError(400, `${field} must be at most ${maxLength} characters`);
  }
}

export function requirePositiveNumber(value, field) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw new ApiError(400, `${field} must be a positive number`);
  }
}

export function requireOneOf(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new ApiError(400, `${field} must be one of: ${allowed.join(', ')}`);
  }
}

export function requireEmail(value, field = 'email') {
  requireString(value, field);
  if (!EMAIL_REGEX.test(value)) {
    throw new ApiError(400, `${field} must be a valid email address`);
  }
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Report filters arrive as query strings, so each one is optional and every
// value is text. These return null when the caller left the filter off, so the
// result can be handed straight to a query builder.
//
// Rejects a date that parses but is not a real calendar day: JavaScript rolls
// 2026-02-30 forward to March 2 rather than failing, which would silently
// widen a report's date range instead of telling the admin they mistyped.
export function optionalIsoDate(value, field) {
  if (value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) {
    throw new ApiError(400, `${field} must be a date in YYYY-MM-DD format`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${field} must be a real calendar date`);
  }
  return value;
}

// Optional row id from a query string. Rejecting anything that is not digits
// also stops `1 OR 1=1` at the HTTP boundary — defence in depth behind the
// parameterized SQL, not a replacement for it.
export function optionalPositiveId(value, field) {
  if (value === undefined || value === '') {
    return null;
  }
  if (!/^\d+$/.test(String(value)) || Number(value) <= 0) {
    throw new ApiError(400, `${field} must be a positive integer`);
  }
  return Number(value);
}

export function requireMinLength(value, field, min) {
  requireString(value, field);
  if (value.length < min) {
    throw new ApiError(400, `${field} must be at least ${min} characters`);
  }
}
