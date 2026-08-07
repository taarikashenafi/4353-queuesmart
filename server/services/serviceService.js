import db from '../db/index.js';
import {
  ApiError,
  requireFields,
  requireOneOf,
  requirePositiveNumber,
  requireString,
} from '../validators.js';

const PRIORITIES = ['low', 'medium', 'high'];
const QUEUE_STATUSES = ['open', 'closed'];
const DESCRIPTION_MAX_LENGTH = 500;
const MAX_DURATION_MINUTES = 480;

const selectServices = db.prepare(`
  SELECT
    s.id,
    s.name,
    s.description,
    s.expected_duration AS expectedDuration,
    s.priority
  FROM services s
  ORDER BY s.id
`);

const selectService = db.prepare(`
  SELECT
    s.id,
    s.name,
    s.description,
    s.expected_duration AS expectedDuration,
    s.priority
  FROM services s
  WHERE s.id = ?
`);

function normalizeServiceId(serviceId) {
  const id = Number(serviceId);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(404, 'Service not found');
  }
  return id;
}

function validateService(input) {
  requireFields(input, ['name', 'description', 'expectedDuration', 'priority']);
  requireString(input.name, 'name', { maxLength: 100 });
  requireString(input.description, 'description', {
    maxLength: DESCRIPTION_MAX_LENGTH,
  });
  requirePositiveNumber(input.expectedDuration, 'expectedDuration');
  if (!Number.isInteger(input.expectedDuration) || input.expectedDuration > MAX_DURATION_MINUTES) {
    throw new ApiError(
      400,
      `expectedDuration must be a whole number from 1 to ${MAX_DURATION_MINUTES}`,
    );
  }
  requireOneOf(input.priority, 'priority', PRIORITIES);

  return {
    name: input.name.trim(),
    description: input.description.trim(),
    expectedDuration: input.expectedDuration,
    priority: input.priority,
  };
}

function getExistingService(serviceId) {
  const service = selectService.get(normalizeServiceId(serviceId));
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  return service;
}

function toApiService(service) {
  return { ...service, id: String(service.id) };
}

export function listServices() {
  return selectServices.all().map(toApiService);
}

export const createService = db.transaction((input) => {
  const service = validateService(input);
  const result = db.prepare(`
    INSERT INTO services (name, description, expected_duration, priority)
    VALUES (?, ?, ?, ?)
  `).run(
    service.name,
    service.description,
    service.expectedDuration,
    service.priority,
  );
  const serviceId = Number(result.lastInsertRowid);
  db.prepare(
    "INSERT INTO queues (service_id, status) VALUES (?, 'open')",
  ).run(serviceId);
  return toApiService(selectService.get(serviceId));
});

export function updateService(serviceId, input) {
  const id = normalizeServiceId(serviceId);
  getExistingService(id);
  const service = validateService(input);

  db.prepare(`
    UPDATE services
    SET name = ?, description = ?, expected_duration = ?, priority = ?
    WHERE id = ?
  `).run(
    service.name,
    service.description,
    service.expectedDuration,
    service.priority,
    id,
  );

  return toApiService(selectService.get(id));
}

export function updateQueueStatus(serviceId, input) {
  requireFields(input, ['status']);
  requireOneOf(input.status, 'status', QUEUE_STATUSES);
  const service = getExistingService(serviceId);

  db.prepare('UPDATE queues SET status = ? WHERE service_id = ?')
    .run(input.status, service.id);

  return { serviceId: String(service.id), status: input.status };
}

export function getQueueStatus(serviceId) {
  const service = getExistingService(serviceId);
  const queue = db.prepare(
    'SELECT status, created_at AS createdAt FROM queues WHERE service_id = ?',
  ).get(service.id);

  return { serviceId: String(service.id), ...queue };
}
