// In-memory data store for A3. No database — all data lives in these
// collections and resets when the server restarts.

let nextId = 1;

export function generateId() {
  return String(nextId++);
}

export const store = {
  users: [],
  sessions: {}, // token -> userId
  services: [],
  queues: {}, // serviceId -> [{ userId, priority, joinedAt }]
  notifications: [], // { id, userId, message, createdAt, read }
  history: [], // { id, userId, serviceId, serviceName, date, outcome }
};

// Clears every collection; used by unit tests to isolate cases.
export function resetStore() {
  nextId = 1;
  store.users = [];
  store.sessions = {};
  store.services = [];
  store.queues = {};
  store.notifications = [];
  store.history = [];
}
