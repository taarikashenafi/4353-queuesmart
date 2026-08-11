import { Router } from 'express';
import {
  createService,
  listServices,
  updateService,
} from '../services/serviceService.js';
import { adminOnly } from '../middleware/auth.js';

// Browsing the service catalog is public (the landing page uses it).
// Creating and editing services is administrator-only.

const router = Router();

router.get('/', (req, res) => {
  res.json(listServices());
});

router.post('/', adminOnly, (req, res) => {
  const service = createService(req.body);
  res.status(201).json(service);
});

router.put('/:id', adminOnly, (req, res) => {
  res.json(updateService(req.params.id, req.body));
});

export default router;
