// QueueSmart — shared mock data + selectors
// Owner: Armaan (setup). This is the single source of truth for A2's front-end.
// Every screen imports from here — please don't hardcode data inside components.
// When the backend lands (A3), these exports get swapped for API calls.

// Service priority, as specified for Service Management.
export const PRIORITY_LEVELS = ['low', 'medium', 'high'];

// A queue entry's lifecycle. Shared by User (Queue Status) and Admin (Queue Management).
export const QUEUE_STATUS = {
  WAITING: 'waiting',
  ALMOST_READY: 'almost_ready',
  SERVED: 'served',
};

// How a past queue ended, shown on the History screen.
export const HISTORY_OUTCOME = {
  SERVED: 'served',
  LEFT: 'left',
  NO_SHOW: 'no_show',
};

// Accounts. Passwords are mock-only (A2 is front-end); never do this for real.
export const users = [
  { id: 'u1', name: 'Alex Rivera', email: 'alex@cougarnet.uh.edu', password: 'Password1', role: 'user' },
  { id: 'u2', name: 'Priya Nair', email: 'priya@cougarnet.uh.edu', password: 'Password1', role: 'user' },
  { id: 'u3', name: 'Sam Carter', email: 'sam@cougarnet.uh.edu', password: 'Password1', role: 'user' },
  { id: 'u4', name: 'Jordan Lee', email: 'jordan@cougarnet.uh.edu', password: 'Password1', role: 'user' },
  { id: 'a1', name: 'Dana Ops', email: 'admin@queuesmart.app', password: 'Admin123', role: 'admin' },
];

// The mock "logged-in" user. The auth screens can point this wherever they need.
export const currentUser = users[0];

// Services an admin manages and a user can join.
// expectedDurationMin drives the wait-time estimate below.
export const services = [
  { id: 's1', name: 'Academic Advising', description: 'Plan your degree, register for classes, and clear registration holds with an advisor.', expectedDurationMin: 15, priority: 'high', isOpen: true },
  { id: 's2', name: 'Financial Aid', description: 'Scholarships, loans, disbursements, and FAFSA questions.', expectedDurationMin: 12, priority: 'high', isOpen: true },
  { id: 's3', name: 'Tech Support Desk', description: 'Laptop, Wi-Fi, and account help from campus IT.', expectedDurationMin: 8, priority: 'medium', isOpen: true },
  { id: 's4', name: 'Career Services', description: 'Resume reviews, mock interviews, and internship advising.', expectedDurationMin: 20, priority: 'medium', isOpen: false },
  { id: 's5', name: 'Library Study Room', description: 'Check out a reservable group study room.', expectedDurationMin: 5, priority: 'low', isOpen: true },
  { id: 's6', name: 'Health Center', description: 'Walk-in appointments with campus health services.', expectedDurationMin: 25, priority: 'high', isOpen: true },
];

// Live queue entries. `position` is 1-based order within a single service.
export const queueEntries = [
  // Academic Advising (s1)
  { id: 'q1', serviceId: 's1', userId: 'u1', name: 'Alex Rivera', position: 1, status: QUEUE_STATUS.ALMOST_READY, joinedAt: '2026-07-10T09:05:00' },
  { id: 'q2', serviceId: 's1', userId: 'u2', name: 'Priya Nair', position: 2, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:12:00' },
  { id: 'q3', serviceId: 's1', userId: 'u4', name: 'Jordan Lee', position: 3, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:20:00' },
  // Financial Aid (s2)
  { id: 'q4', serviceId: 's2', userId: 'u3', name: 'Sam Carter', position: 1, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:00:00' },
  { id: 'q5', serviceId: 's2', userId: 'u4', name: 'Jordan Lee', position: 2, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:18:00' },
  // Tech Support Desk (s3)
  { id: 'q6', serviceId: 's3', userId: 'u2', name: 'Priya Nair', position: 1, status: QUEUE_STATUS.ALMOST_READY, joinedAt: '2026-07-10T08:50:00' },
  // Health Center (s6)
  { id: 'q7', serviceId: 's6', userId: 'u1', name: 'Alex Rivera', position: 1, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:30:00' },
  { id: 'q8', serviceId: 's6', userId: 'u3', name: 'Sam Carter', position: 2, status: QUEUE_STATUS.WAITING, joinedAt: '2026-07-10T09:33:00' },
];

// In-app notifications (A2 keeps these in-app only).
export const notifications = [
  { id: 'n1', userId: 'u1', type: 'status', message: "You're almost up for Academic Advising — please head over.", time: '2026-07-10T09:34:00', read: false },
  { id: 'n2', userId: 'u1', type: 'queue', message: 'You joined the Health Center queue at position 1.', time: '2026-07-10T09:30:00', read: false },
  { id: 'n3', userId: 'u1', type: 'queue', message: 'Financial Aid wait time updated to about 24 minutes.', time: '2026-07-10T09:10:00', read: true },
  { id: 'n4', userId: 'u2', type: 'status', message: "You're almost up for the Tech Support Desk.", time: '2026-07-10T09:31:00', read: false },
];

// Past queues a user has joined.
export const history = [
  { id: 'h1', userId: 'u1', serviceName: 'Financial Aid', date: '2026-07-02', outcome: HISTORY_OUTCOME.SERVED, waitedMin: 18 },
  { id: 'h2', userId: 'u1', serviceName: 'Tech Support Desk', date: '2026-06-28', outcome: HISTORY_OUTCOME.SERVED, waitedMin: 9 },
  { id: 'h3', userId: 'u1', serviceName: 'Career Services', date: '2026-06-20', outcome: HISTORY_OUTCOME.LEFT, waitedMin: 15 },
  { id: 'h4', userId: 'u1', serviceName: 'Academic Advising', date: '2026-06-10', outcome: HISTORY_OUTCOME.NO_SHOW, waitedMin: 0 },
  { id: 'h5', userId: 'u2', serviceName: 'Library Study Room', date: '2026-07-05', outcome: HISTORY_OUTCOME.SERVED, waitedMin: 4 },
];

// ---- Selectors: small pure helpers so screens stay declarative ----

export const getServiceById = (serviceId) =>
  services.find((s) => s.id === serviceId) || null;

export const getQueueForService = (serviceId) =>
  queueEntries
    .filter((e) => e.serviceId === serviceId)
    .sort((a, b) => a.position - b.position);

export const getQueueLength = (serviceId) =>
  queueEntries.filter((e) => e.serviceId === serviceId).length;

// A1's simple wait-time model: (people ahead of you) x average service duration.
export const getEstimatedWaitMin = (serviceId, position) => {
  const service = getServiceById(serviceId);
  if (!service) return 0;
  const ahead = Math.max(0, position - 1);
  return ahead * service.expectedDurationMin;
};

export const getUserQueueEntries = (userId) =>
  queueEntries.filter((e) => e.userId === userId);

export const getNotificationsForUser = (userId) =>
  notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.time < b.time ? 1 : -1));

export const getHistoryForUser = (userId) =>
  history
    .filter((h) => h.userId === userId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
