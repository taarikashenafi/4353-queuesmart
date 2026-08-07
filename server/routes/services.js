import { Router } from 'express';
import {
  createService,
  listServices,
  updateService,
} from '../services/serviceService.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(listServices());
});

router.post('/', (req, res) => {
  const service = createService(req.body);
  res.status(201).json(service);
});

router.put('/:id', (req, res) => {
  res.json(updateService(req.params.id, req.body));
});

export default router;
