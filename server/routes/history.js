import { Router } from 'express';
import db from '../db/index.js';

// History and stats module (owner: Uchenna)
// GET /api/history/:userId, GET /api/stats

const router = Router();

router.get('/history/:userId', (req, res) => {
  const rows = db
    .prepare(`
      SELECT
        qe.id AS id,
        s.id AS serviceId,
        s.name AS serviceName,
        qe.joined_at AS date,
        qe.status AS outcome,
        CASE WHEN qe.status = 'served' THEN (qe.position - 1) * s.expected_duration ELSE 0 END AS waitTime
      FROM queue_entries qe
      JOIN queues q ON qe.queue_id = q.id
      JOIN services s ON q.service_id = s.id
      WHERE qe.user_id = ? AND qe.status IN ('served', 'canceled')
      ORDER BY qe.joined_at DESC, qe.id DESC
    `)
    .all(req.params.userId);

  res.json(rows.map((row) => ({ ...row, id: String(row.id), serviceId: String(row.serviceId) })));
});

router.get('/stats', (req, res) => {
  const rows = db
    .prepare(`
      SELECT
        s.id AS serviceId,
        s.name AS serviceName,
        COUNT(CASE WHEN qe.status = 'served' THEN 1 END) AS totalServed,
        COALESCE(AVG(CASE WHEN qe.status = 'served' THEN (qe.position - 1) * s.expected_duration END), 0) AS averageWait
      FROM services s
      LEFT JOIN queues q ON q.service_id = s.id
      LEFT JOIN queue_entries qe ON qe.queue_id = q.id
      GROUP BY s.id, s.name
      ORDER BY s.id
    `)
    .all();

  res.json(rows.map((row) => ({ ...row, serviceId: String(row.serviceId) })));
});

export default router;
