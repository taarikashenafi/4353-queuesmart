import { Router } from 'express';
import { store } from '../store.js';

// History and stats module (owner: Uchenna)
// GET /api/history/:userId, GET /api/stats

const router = Router();

router.get('/history/:userId', (req, res) => {
  const history = store.history
    .filter((entry) => entry.userId === req.params.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(history);
});

router.get('/stats', (req, res) => {
  const stats = store.services.map((service) => {
    const served = store.history.filter(
      (entry) => entry.serviceId === service.id && entry.outcome === 'served'
    );
    const totalWait = served.reduce((sum, entry) => sum + (entry.waitTime ?? 0), 0);

    return {
      serviceId: service.id,
      serviceName: service.name,
      totalServed: served.length,
      averageWait: served.length > 0 ? totalWait / served.length : 0,
    };
  });

  res.json(stats);
});

export default router;
