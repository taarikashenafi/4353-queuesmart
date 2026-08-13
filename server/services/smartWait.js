import db from '../db/index.js';
function getService(serviceId) {
  const service = db
    .prepare('SELECT id, expected_duration AS expectedDuration, name FROM services WHERE id = ?')
    .get(serviceId);
  if (!service) {
    throw new Error('Service not found');
  }
  return service;
}

export function observedServiceMinutes(serviceId) {
  const service = getService(serviceId);
  const servedRows = db
    .prepare(`
      SELECT qe.joined_at AS joinedAt, qe.served_at AS servedAt
      FROM queue_entries qe
      JOIN queues q ON qe.queue_id = q.id
      WHERE q.service_id = ? AND qe.status = 'served' AND qe.served_at IS NOT NULL
      ORDER BY qe.served_at ASC
    `)
    .all(service.id);
  const diffs = [];
  for (let index = 1; index < servedRows.length; index += 1) {
    const previous = new Date(servedRows[index - 1].servedAt).getTime();
    const current = new Date(servedRows[index].servedAt).getTime();
    const diffMinutes = (current - previous) / 60000;
    if (diffMinutes > 0 && diffMinutes <= 120) {
      diffs.push(diffMinutes);
    }
  }
  const n = diffs.length;
  if (n === 0) {
    return {
      minutesPerPerson: Number(service.expectedDuration),
      sampleSize: 0,
      source: 'default',
    };
  }
  const observed = diffs.reduce((sum, value) => sum + value, 0) / n;
  const weight = Math.min(n, 10) / 10;
  const minutesPerPerson = weight * observed + (1 - weight) * Number(service.expectedDuration);
  return {
    minutesPerPerson: Number(minutesPerPerson.toFixed(2)),
    sampleSize: n,
    source: n >= 10 ? 'observed' : 'blended',
  };
}

export function predictWait(serviceId, peopleAhead) {
  const { minutesPerPerson } = observedServiceMinutes(serviceId);
  const people = Number(peopleAhead) || 0;
  return Math.round(people * minutesPerPerson);
}
