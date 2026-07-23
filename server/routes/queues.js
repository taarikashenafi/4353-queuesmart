import { Router } from 'express';

// Queue management module (owner: Surafel)
// POST /api/queues/:serviceId/join, DELETE /api/queues/:serviceId/leave,
// GET /api/queues/:serviceId, POST /api/queues/:serviceId/serve

const router = Router();

export default router;
