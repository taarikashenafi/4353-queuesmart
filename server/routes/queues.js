import { Router } from 'express';
import {
  joinQueue,
  leaveQueue,
  getQueue,
  serveNext,
} from '../services/queueService.js';

// queue stuff for join, leave, view, and serve
//the main queue endpoints for the app

const router = Router();

router.post('/:serviceId/join', (req, res) => {
  const result = joinQueue(req.params.serviceId, req.body);
  res.status(201).json(result);
});

router.delete('/:serviceId/leave', (req, res) => {
  const result = leaveQueue(req.params.serviceId, req.body);
  res.json(result);
});

router.get('/:serviceId', (req, res) => {
  const result = getQueue(req.params.serviceId, req.query.userId);
  res.json(result);
});

router.post('/:serviceId/serve', (req, res) => {
  const result = serveNext(req.params.serviceId);
  res.json(result);
});

export default router;
