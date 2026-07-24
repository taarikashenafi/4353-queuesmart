import { Router } from 'express';
import { store } from '../store.js';

// Notifications module (owner: Uchenna)
// GET /api/notifications/:userId, POST /api/notifications/:userId/read

const router = Router();

function notificationsFor(userId) {
  return store.notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

router.get('/:userId', (req, res) => {
  res.json(notificationsFor(req.params.userId));
});

router.post('/:userId/read', (req, res) => {
  store.notifications
    .filter((notification) => notification.userId === req.params.userId)
    .forEach((notification) => {
      notification.read = true;
    });

  res.json(notificationsFor(req.params.userId));
});

export default router;
