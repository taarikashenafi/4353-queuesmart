import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireSelfOrAdminParam } from '../middleware/auth.js';

// Notifications module (owner: Uchenna)
// GET /api/notifications/:userId, POST /api/notifications/:userId/read
//
// Guards added by Armaan for the assignment-3 feedback: a notification names
// the service someone queued for, so it is only readable by that user or an
// administrator. Marking as read is guarded too — otherwise anyone could
// silence another user's alerts.

const router = Router();

const ownerOnly = [requireAuth, requireSelfOrAdminParam('userId')];

function notificationsFor(userId) {
  return db
    .prepare(`
      SELECT id, user_id AS userId, message, created_at AS createdAt, status
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(userId)
    .map((row) => ({ ...row, id: String(row.id), userId: String(row.userId) }));
}

router.get('/:userId', ownerOnly, (req, res) => {
  res.json(notificationsFor(req.params.userId));
});

router.post('/:userId/read', ownerOnly, (req, res) => {
  db.prepare("UPDATE notifications SET status = 'viewed' WHERE user_id = ?").run(req.params.userId);
  res.json(notificationsFor(req.params.userId));
});

export default router;
