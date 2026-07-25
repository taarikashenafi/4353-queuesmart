import { store, generateId } from '../store.js';
import { ApiError, requireFields, requireOneOf } from '../validators.js';

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

// basic helper to grab the service quick
function getService(serviceId) {
  const service = store.services.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  return service;
}
// sort the queue by priority first,then by the point people joined
function getQueueEntries(serviceId) {
  return [...(store.queues[serviceId] || [])].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}
function createNotification(userId, message) {
  store.notifications.push({
    id: generateId(),
    userId,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });
}
export function joinQueue(serviceId, input) {
  // simple join logic for now
  requireFields(input, ['userId', 'priority']);
  const { userId, priority } = input;
  requireOneOf(priority, 'priority', ['high', 'medium', 'low']);

  const service = getService(serviceId);
  const queue = store.queues[serviceId] ?? [];

  if (queue.some((entry) => entry.userId === userId)) {
    throw new ApiError(400, 'User is already in this queue');
  }

  queue.push({
    userId,
    priority,
    joinedAt: new Date().toISOString(),
  });
  store.queues[serviceId] = queue;
  const orderedQueue = getQueueEntries(serviceId);
  const position = orderedQueue.findIndex((entry) => entry.userId === userId) + 1;
  createNotification(userId, `You joined the ${service.name} queue.`);
  if (position <= 2) {
    createNotification(userId, `You are near the front of the ${service.name} queue.`);
  }

  return {
    message: 'Joined queue successfully',
    queueLength: orderedQueue.length,
    position,
  };
}

export function leaveQueue(serviceId, input) {
  requireFields(input, ['userId']);
  const service = getService(serviceId);
  const queue = store.queues[serviceId] ?? [];
  const index = queue.findIndex((entry) => entry.userId === input.userId);

  if (index === -1) {
    throw new ApiError(404, 'User is not in this queue');
  }

  queue.splice(index, 1);
  store.queues[serviceId] = queue;

  store.history.push({
    id: generateId(),
    userId: input.userId,
    serviceId,
    serviceName: service.name,
    date: new Date().toISOString(),
    outcome: 'left',
  });

  return { message: 'Left queue successfully' };
}

export function getQueue(serviceId, userId) {
  const service = getService(serviceId);
  const orderedQueue = getQueueEntries(serviceId);
  const result = { serviceId, serviceName: service.name, queue: orderedQueue };

  if (userId) {
    const position = orderedQueue.findIndex((entry) => entry.userId === userId) + 1;
    if (position <= 0) {
      throw new ApiError(404, 'User is not in this queue');
    }

    result.position = position;
    result.estimatedWait = (position - 1) * service.expectedDuration;
  }

  return result;
}

export function serveNext(serviceId) {
  const service = getService(serviceId);
  const orderedQueue = getQueueEntries(serviceId);
  if (orderedQueue.length === 0) {
    throw new ApiError(404, 'No users in queue');
  }

  const [served] = orderedQueue.splice(0, 1);
  store.queues[serviceId] = orderedQueue;

  store.history.push({
    id: generateId(),
    userId: served.userId,
    serviceId,
    serviceName: service.name,
    date: new Date().toISOString(),
    outcome: 'served',
  });

  createNotification(served.userId, `You were served from the ${service.name} queue.`);

  return { message: 'Served next user', userId: served.userId };
}
