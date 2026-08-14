// This is the data layer behind /api/reports/*, the three queries that
// actually pull the numbers for the admin reports page.
//
// I went through this and checked it against server/tests/reportService.test.js:
// date range boundaries, the serviceId filter (even threw a fake SQL
// injection string at it, it just matches nothing instead of blowing up),
// wait averages I hand-calculated myself, and made sure a service with no
// history still shows up as a zero row instead of just disappearing.
//
// Every function here returns the exact same shape (Shared Contract #1 from
// the work plan), which is the whole point: one exporter can handle all
// three reports in every format instead of writing this three times:
//
//   { title, generatedAt, filters, columns, rows, summary }
//
// `columns` drives both the table header and the column order, for the UI
// table and the CSV. `rows` are keyed off `column.key`.
//
// Filters are all optional and stack on top of each other: date range
// applies to `joined_at` and is inclusive on both ends, serviceId just
// narrows to one service. Everything is bound as a named param, never
// string-concatenated, so there's no SQL injection surface here.

import db from '../db/index.js';

// ---------------------------------------------------------------------------
// served_at compatibility
// ---------------------------------------------------------------------------
//
// Actual wait time = served_at - joined_at. That column is supposed to show
// up with Surafel's migration, but as of writing this it still isn't in
// schema.sql. If these expressions referenced served_at directly, the query
// would fail to even prepare and take all three reports down with it. So
// instead they fall back to NULL/0 while the column's missing, and they'll
// start returning real numbers automatically the second the migration
// lands, nothing else in this file needs to change for that.
//
// I memoized this because it was calling PRAGMA table_info on every single
// report request (twice, for usage stats). The migration only runs once at
// server startup, before any request could reach this file, so the schema
// can't actually change while the server's running. Caching it is safe.
//
// Once served_at is guaranteed to be there, this whole check (and the memo)
// can just go away.
let servedAtPresent = null;
function hasServedAt() {
  if (servedAtPresent === null) {
    servedAtPresent = db
      .prepare('PRAGMA table_info(queue_entries)')
      .all()
      .some((column) => column.name === 'served_at');
  }
  return servedAtPresent;
}

// Minutes between joining and getting served, per row. NULL unless the entry
// was actually served. A canceled or still-waiting entry doesn't have a real
// wait to report, and I'd rather leave the cell blank than show 0, which
// would read like they got served instantly.
function waitMinutesExpression() {
  if (!hasServedAt()) {
    return 'NULL';
  }
  return `CASE
            WHEN qe.status = 'served' AND qe.served_at IS NOT NULL
            THEN CAST(ROUND((julianday(qe.served_at) - julianday(qe.joined_at)) * 1440) AS INTEGER)
          END`;
}

// Average of the above, per group. On purpose I did NOT reuse the formula
// from /api/stats: that one is (position - 1) * expected_duration, using a
// position column that gets rewritten every time the queue resyncs. That's a
// guess at how long a wait was supposed to be, not a measurement of how long
// it actually took. This report needs the real number.
function averageWaitExpression() {
  if (!hasServedAt()) {
    return '0';
  }
  return `COALESCE(ROUND(AVG(
            CASE
              WHEN qe.status = 'served' AND qe.served_at IS NOT NULL
              THEN (julianday(qe.served_at) - julianday(qe.joined_at)) * 1440
            END
          )), 0)`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// The routes already validate this before it gets here: from/to come in as
// YYYY-MM-DD strings or null, serviceId as a positive number or null.
function bindings({ from = null, to = null, serviceId = null } = {}) {
  return { from, to, serviceId };
}

// Echoed back in the response so the UI and the CSV can show what filters
// were actually applied. I resolve the service name here too, so nothing
// downstream has to go look it up separately.
function describeFilters(params) {
  const service =
    params.serviceId === null
      ? null
      : db.prepare('SELECT name FROM services WHERE id = ?').get(params.serviceId);

  return { ...params, serviceName: service ? service.name : null };
}

// This gets applied inside a LEFT JOIN condition, not a WHERE clause, so a
// service with zero matching entries still shows up as a row of zeros
// instead of just vanishing from the report.
const JOINED_AT_RANGE = `
  (@from IS NULL OR date(qe.joined_at) >= @from)
  AND (@to IS NULL OR date(qe.joined_at) <= @to)
`;

function report(title, filters, columns, rows, summary) {
  return { title, generatedAt: new Date().toISOString(), filters, columns, rows, summary };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// 1. Queue participation history: one row per queue entry
// ---------------------------------------------------------------------------

const PARTICIPATION_COLUMNS = [
  { key: 'userEmail', label: 'User' },
  { key: 'fullName', label: 'Name' },
  { key: 'serviceName', label: 'Service' },
  { key: 'joinedAt', label: 'Joined' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'waitMinutes', label: 'Wait (min)' },
];

export function participationReport(filters = {}) {
  const params = bindings(filters);

  const rows = db
    .prepare(`
      SELECT
        uc.email                   AS userEmail,
        COALESCE(up.full_name, '') AS fullName,
        s.name                     AS serviceName,
        qe.joined_at               AS joinedAt,
        qe.status                  AS outcome,
        ${waitMinutesExpression()} AS waitMinutes
      FROM queue_entries qe
      JOIN queues q              ON qe.queue_id = q.id
      JOIN services s            ON q.service_id = s.id
      JOIN user_credentials uc   ON qe.user_id = uc.id
      LEFT JOIN user_profiles up ON up.user_id = uc.id
      WHERE ${JOINED_AT_RANGE}
        AND (@serviceId IS NULL OR s.id = @serviceId)
      ORDER BY qe.joined_at DESC, qe.id DESC
    `)
    .all(params);

  // I calculate these off the rows I already have instead of running another
  // query, so the summary footer can never end up disagreeing with the
  // table above it.
  const waits = rows.map((row) => row.waitMinutes).filter((value) => value !== null);
  const countOf = (outcome) => rows.filter((row) => row.outcome === outcome).length;

  const summary = [
    { label: 'Total entries', value: rows.length },
    { label: 'Served', value: countOf('served') },
    { label: 'Canceled', value: countOf('canceled') },
    { label: 'Still waiting', value: countOf('waiting') },
    {
      label: 'Average wait (min)',
      value: waits.length === 0 ? 0 : round(waits.reduce((a, b) => a + b, 0) / waits.length),
    },
  ];

  return report(
    'Queue Participation History',
    describeFilters(params),
    PARTICIPATION_COLUMNS,
    rows,
    summary,
  );
}

// ---------------------------------------------------------------------------
// 2. Service activity: one row per service
// ---------------------------------------------------------------------------

const SERVICE_COLUMNS = [
  { key: 'serviceName', label: 'Service' },
  { key: 'description', label: 'Description' },
  { key: 'expectedDuration', label: 'Expected (min)' },
  { key: 'priority', label: 'Priority' },
  { key: 'queueStatus', label: 'Queue' },
  { key: 'waitingNow', label: 'Waiting now' },
  { key: 'totalJoined', label: 'Total joined' },
  { key: 'totalServed', label: 'Served' },
  { key: 'totalCanceled', label: 'Canceled' },
];

export function serviceActivityReport(filters = {}) {
  const params = bindings(filters);

  const rows = db
    .prepare(`
      SELECT
        s.name              AS serviceName,
        s.description       AS description,
        s.expected_duration AS expectedDuration,
        s.priority          AS priority,
        COALESCE(q.status, 'closed') AS queueStatus,
        -- On purpose this skips the date filter. "Waiting now" is about the
        -- line right now, not about whatever date range someone picked.
        (SELECT COUNT(*)
           FROM queue_entries w
           JOIN queues wq ON w.queue_id = wq.id
          WHERE wq.service_id = s.id AND w.status = 'waiting') AS waitingNow,
        COUNT(qe.id)                                     AS totalJoined,
        COUNT(CASE WHEN qe.status = 'served'   THEN 1 END) AS totalServed,
        COUNT(CASE WHEN qe.status = 'canceled' THEN 1 END) AS totalCanceled
      FROM services s
      LEFT JOIN queues q ON q.service_id = s.id
      LEFT JOIN queue_entries qe ON qe.queue_id = q.id AND ${JOINED_AT_RANGE}
      WHERE (@serviceId IS NULL OR s.id = @serviceId)
      GROUP BY s.id
      ORDER BY s.name
    `)
    .all(params);

  const total = (key) => rows.reduce((sum, row) => sum + row[key], 0);

  const summary = [
    { label: 'Services', value: rows.length },
    { label: 'Total joined', value: total('totalJoined') },
    { label: 'Total served', value: total('totalServed') },
    { label: 'Waiting now', value: total('waitingNow') },
  ];

  return report('Service Activity', describeFilters(params), SERVICE_COLUMNS, rows, summary);
}

// ---------------------------------------------------------------------------
// 3. Queue usage statistics: one row per service
// ---------------------------------------------------------------------------

const USAGE_COLUMNS = [
  { key: 'serviceName', label: 'Service' },
  { key: 'totalServed', label: 'Served' },
  { key: 'averageWaitMinutes', label: 'Avg wait (min)' },
  // Labelled UTC because that is what strftime reads off the ISO timestamps in
  // busiestHours(). Without the marker a Houston admin reads 14:00 for a desk
  // that actually peaks at 9 AM.
  { key: 'busiestHour', label: 'Busiest hour (UTC)' },
];

// Counts entries per hour of day, per service. I kept this as its own query
// and just reduced it in JS. Getting the max per group in SQLite means a
// window function or a correlated subquery, and honestly this loop reads
// easier than either of those would.
function busiestHours(params) {
  const counts = db
    .prepare(`
      SELECT
        s.id AS serviceId,
        CAST(strftime('%H', qe.joined_at) AS INTEGER) AS hour,
        COUNT(*) AS entries
      FROM services s
      JOIN queues q ON q.service_id = s.id
      JOIN queue_entries qe ON qe.queue_id = q.id
      WHERE ${JOINED_AT_RANGE}
        AND (@serviceId IS NULL OR s.id = @serviceId)
      GROUP BY s.id, hour
    `)
    .all(params);

  const busiest = new Map();
  let overall = null;
  const overallByHour = new Map();

  for (const { serviceId, hour, entries } of counts) {
    const current = busiest.get(serviceId);
    // If it's a tie, the earlier hour wins, just so this doesn't give a
    // different answer every time it runs.
    if (!current || entries > current.entries || (entries === current.entries && hour < current.hour)) {
      busiest.set(serviceId, { hour, entries });
    }
    overallByHour.set(hour, (overallByHour.get(hour) || 0) + entries);
  }

  for (const [hour, entries] of overallByHour) {
    if (!overall || entries > overall.entries || (entries === overall.entries && hour < overall.hour)) {
      overall = { hour, entries };
    }
  }

  return { byService: busiest, overall };
}

function formatHour(hour) {
  return hour === null || hour === undefined ? '' : `${String(hour).padStart(2, '0')}:00`;
}

export function usageStatisticsReport(filters = {}) {
  const params = bindings(filters);
  const hours = busiestHours(params);

  const rows = db
    .prepare(`
      SELECT
        s.id   AS serviceId,
        s.name AS serviceName,
        COUNT(CASE WHEN qe.status = 'served' THEN 1 END) AS totalServed,
        ${averageWaitExpression()} AS averageWaitMinutes
      FROM services s
      LEFT JOIN queues q ON q.service_id = s.id
      LEFT JOIN queue_entries qe ON qe.queue_id = q.id AND ${JOINED_AT_RANGE}
      WHERE (@serviceId IS NULL OR s.id = @serviceId)
      GROUP BY s.id
      ORDER BY s.name
    `)
    .all(params)
    .map(({ serviceId, ...row }) => ({
      ...row,
      busiestHour: formatHour(hours.byService.get(serviceId)?.hour),
    }));

  // Didn't just average the per-service averages together. That would
  // weight a service with 2 visits the same as one with 200. So this figure
  // is measured across every served entry instead, not service by service.
  const overallWait = db
    .prepare(`
      SELECT ${averageWaitExpression()} AS averageWaitMinutes
      FROM queue_entries qe
      JOIN queues q   ON qe.queue_id = q.id
      JOIN services s ON q.service_id = s.id
      WHERE ${JOINED_AT_RANGE}
        AND (@serviceId IS NULL OR s.id = @serviceId)
    `)
    .get(params);

  const summary = [
    { label: 'Total served', value: rows.reduce((sum, row) => sum + row.totalServed, 0) },
    { label: 'Average wait (min)', value: overallWait.averageWaitMinutes },
    { label: 'Busiest hour (UTC)', value: formatHour(hours.overall?.hour) },
  ];

  return report('Queue Usage Statistics', describeFilters(params), USAGE_COLUMNS, rows, summary);
}
