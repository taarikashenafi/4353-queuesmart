import { Router } from 'express';
import {
  joinQueue,
  leaveQueue,
  getQueue,
  serveNext,
} from '../services/queueService.js';
import {
  getQueueStatus,
  updateQueueStatus,
} from '../services/serviceService.js';
import { adminOnly, requireAuth, requireSelfOrAdmin } from '../middleware/auth.js';

// queue stuff for join, leave, view, and serve
//the main queue endpoints for the app
//
// Joining and leaving require a session and only act on your own entry
// (admins may act on anyone). Serving the next person and opening/closing a
// queue are administrator-only.

const router = Router();

router.post('/:serviceId/join', requireAuth, requireSelfOrAdmin, (req, res) => {
  const result = joinQueue(req.params.serviceId, req.body);
  res.status(201).json(result);
});

router.delete('/:serviceId/leave', requireAuth, requireSelfOrAdmin, (req, res) => {
  const result = leaveQueue(req.params.serviceId, req.body);
  res.json(result);
});

// The roster lists every waiting user's id, so it needs a session. It is not
// admin-only: the user-facing screens read it to show queue length and their
// own position.
router.get('/:serviceId', requireAuth, (req, res) => {
  const result = getQueue(req.params.serviceId, req.query.userId);
  res.json(result);
});

router.post('/:serviceId/serve', adminOnly, (req, res) => {
  const result = serveNext(req.params.serviceId);
  res.json(result);
});

router.get('/:serviceId/status', (req, res) => {
  res.json(getQueueStatus(req.params.serviceId));
});

router.patch('/:serviceId/status', adminOnly, (req, res) => {
  res.json(updateQueueStatus(req.params.serviceId, req.body));
});

export default router;
