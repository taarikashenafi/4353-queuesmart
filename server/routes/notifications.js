import { Router } from 'express';
import db from '../db/index.js';

// Notifications module (owner: Uchenna)
// GET /api/notifications/:userId, POST /api/notifications/:userId/read

const router = Router();

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

router.get('/:userId', (req, res) => {
  res.json(notificationsFor(req.params.userId));
});

router.post('/:userId/read', (req, res) => {
  db.prepare("UPDATE notifications SET status = 'viewed' WHERE user_id = ?").run(req.params.userId);
  res.json(notificationsFor(req.params.userId));
});

export default router;
