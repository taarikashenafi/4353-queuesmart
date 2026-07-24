import { Router } from 'express';
import { generateId, store } from '../store.js';
import {
  ApiError,
  requireFields,
  requireOneOf,
  requirePositiveNumber,
  requireString,
} from '../validators.js';

const PRIORITIES = ['low', 'medium', 'high'];
const DESCRIPTION_MAX_LENGTH = 500;

const router = Router();

function validateService(body) {
  requireFields(body, ['name', 'description', 'expectedDuration', 'priority']);
  requireString(body.name, 'name', { maxLength: 100 });
  requireString(body.description, 'description', { maxLength: DESCRIPTION_MAX_LENGTH });
  requirePositiveNumber(body.expectedDuration, 'expectedDuration');
  requireOneOf(body.priority, 'priority', PRIORITIES);
}

function serviceFrom(body, id) {
  return {
    id,
    name: body.name.trim(),
    description: body.description.trim(),
    expectedDuration: body.expectedDuration,
    priority: body.priority,
  };
}

router.get('/', (req, res) => {
  res.json(store.services);
});

router.post('/', (req, res) => {
  validateService(req.body);

  const service = serviceFrom(req.body, generateId());
  store.services.push(service);
  res.status(201).json(service);
});

router.put('/:id', (req, res) => {
  validateService(req.body);

  const serviceIndex = store.services.findIndex((service) => service.id === req.params.id);
  if (serviceIndex === -1) {
    throw new ApiError(404, 'Service not found');
  }

  const service = serviceFrom(req.body, req.params.id);
  store.services[serviceIndex] = service;
  res.json(service);
});

export default router;
