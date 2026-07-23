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

export function requireMinLength(value, field, min) {
  requireString(value, field);
  if (value.length < min) {
    throw new ApiError(400, `${field} must be at least ${min} characters`);
  }
}
