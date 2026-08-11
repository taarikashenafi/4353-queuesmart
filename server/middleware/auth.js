// Authentication / authorization middleware.
//
// Login issues an opaque bearer token (see services/authService.js) and the
// client sends it back as `Authorization: Bearer <token>`. These guards turn
// that token into `req.user` and enforce who is allowed to call a route.
//
// The role is always read from the database, never from the request, so a
// caller cannot promote themselves by tampering with a token or payload.

import db from '../db/index.js';
import { sessions } from '../services/authService.js';
import { ApiError } from '../validators.js';

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  const token = rest.join(' ').trim();
  return token === '' ? null : token;
}

// Rejects the request unless it carries a valid session token.
// On success attaches { id, email, role } to req.user.
export function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const userId = sessions.get(token);
  if (!userId) {
    return next(new ApiError(401, 'Invalid or expired session token'));
  }

  const user = db
    .prepare('SELECT id, email, role FROM user_credentials WHERE id = ?')
    .get(userId);
  if (!user) {
    return next(new ApiError(401, 'Invalid or expired session token'));
  }

  req.user = { id: String(user.id), email: user.email, role: user.role };
  return next();
}

// Must run after requireAuth. Rejects authenticated non-admins with 403 so
// the client can tell "log in" (401) apart from "not allowed" (403).
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (req.user.role !== 'admin') {
    return next(new ApiError(403, 'Administrator access required'));
  }
  return next();
}

// Convenience chain for administrator-only routes.
export const adminOnly = [requireAuth, requireAdmin];

// For routes that act on a specific user's queue entry: a regular user may
// only act on themselves, while an admin may act on anyone (the admin queue
// screen removes other people from the line).
export function requireSelfOrAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (req.user.role === 'admin') {
    return next();
  }

  const targetUserId = req.body?.userId;
  if (targetUserId === undefined || String(targetUserId) !== req.user.id) {
    return next(new ApiError(403, 'You can only manage your own queue entry'));
  }
  return next();
}

// Same rule as requireSelfOrAdmin, but for routes that name the user in the
// path (`/api/profile/:userId`) instead of the body. Without this, changing a
// digit in the URL reads or edits someone else's record.
//
// Returns a middleware so each route can name its own parameter.
export function requireSelfOrAdminParam(paramName) {
  return function selfOrAdminParam(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (req.user.role === 'admin') {
      return next();
    }

    if (String(req.params[paramName]) !== req.user.id) {
      return next(new ApiError(403, 'You can only access your own data'));
    }
    return next();
  };
}
