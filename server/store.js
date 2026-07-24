// In-memory data store for A3. No database — all data lives in these
// collections and resets when the server restarts.

let nextId = 1;

export function generateId() {
  return String(nextId++);
}

const INITIAL_SERVICES = [
  {
    id: 's1',
    name: 'Academic Advising',
    description: 'Plan your degree, register for classes, and clear registration holds with an advisor.',
    expectedDuration: 15,
    priority: 'high',
  },
  {
    id: 's2',
    name: 'Financial Aid',
    description: 'Get help with scholarships, loans, disbursements, and FAFSA questions.',
    expectedDuration: 12,
    priority: 'high',
  },
  {
    id: 's3',
    name: 'Tech Support Desk',
    description: 'Get help with laptops, Wi-Fi, and campus account access.',
    expectedDuration: 8,
    priority: 'medium',
  },
  {
    id: 's4',
    name: 'Career Services',
    description: 'Schedule resume reviews, mock interviews, and internship advising.',
    expectedDuration: 20,
    priority: 'low',
  },
];

function initialServices() {
  return INITIAL_SERVICES.map((service) => ({ ...service }));
}

export const store = {
  users: [],
  sessions: {}, // token -> userId
  services: initialServices(),
  queues: {}, // serviceId -> [{ userId, priority, joinedAt }]
  notifications: [], // { id, userId, message, createdAt, read }
  history: [], // { id, userId, serviceId, serviceName, date, outcome }
};

// Clears every collection; used by unit tests to isolate cases.
export function resetStore() {
  nextId = 1;
  store.users = [];
  store.sessions = {};
  store.services = initialServices();
  store.queues = {};
  store.notifications = [];
  store.history = [];
}
