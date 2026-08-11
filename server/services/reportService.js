// Report data layer — the three queries behind /api/reports/*.
//
// ⚠️ HANDOFF NOTE (Armaan → Uchenna): this is your Prompt 1 deliverable. I
// wrote it because the report routes, the Reports page, and the demo were all
// stalled behind it on Tuesday. Take it over: review the SQL, change whatever
// you disagree with, and commit your reportService.test.js (Prompt 2) plus any
// edits from your own account so the contribution history shows this as yours.
//
// Every function returns the same payload (Shared Contract #1) so one exporter
// covers all three reports in every format:
//
//   { title, generatedAt, filters, columns, rows, summary }
//
// `columns` drives both the table header and the column order, in the UI and
// in the CSV. `rows` are keyed by `column.key`.
//
// Filters are optional and compose: the date range applies to `joined_at` and
// is inclusive at both ends; `serviceId` narrows to one service. Every value
// is bound as a named parameter — nothing is concatenated into SQL.

import db from '../db/index.js';

// ---------------------------------------------------------------------------
// served_at compatibility
// ---------------------------------------------------------------------------
//
// Actual wait time is `served_at - joined_at`. That column arrives with
// Surafel's migration; until it does, referencing it fails at prepare time and
// would take all three reports down. So the wait expressions collapse to
// NULL/0 while it is absent and start returning real numbers the moment the
// migration lands — no change needed here.
//
// Safe to simplify once served_at is guaranteed present.
function hasServedAt() {
  return db
    .prepare('PRAGMA table_info(queue_entries)')
    .all()
    .some((column) => column.name === 'served_at');
}

// Minutes between joining and being served, for one row. NULL unless the entry
// was actually served — a canceled or still-waiting entry has no wait to
// report, and an empty cell is honest where a 0 would look like instant service.
function waitMinutesExpression() {
  if (!hasServedAt()) {
    return 'NULL';
  }
  return `CASE
            WHEN qe.status = 'served' AND qe.served_at IS NOT NULL
            THEN CAST(ROUND((julianday(qe.served_at) - julianday(qe.joined_at)) * 1440) AS INTEGER)
          END`;
}

// Mean of the above across a group. Deliberately NOT the formula in
// /api/stats: that one is (position - 1) * expected_duration over a position
// column the queue rewrites on every resync, so it is a projection of how long
// a wait was supposed to be, not a measurement of how long it was.
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

// The routes hand over { from, to, serviceId } already validated: dates are
// YYYY-MM-DD strings or null, serviceId is a positive number or null.
function bindings({ from = null, to = null, serviceId = null } = {}) {
  return { from, to, serviceId };
}

// Echoed back in the payload so the UI and the CSV can say what was asked for.
// The service name is resolved here so no caller has to look it up.
function describeFilters(params) {
  const service =
    params.serviceId === null
      ? null
      : db.prepare('SELECT name FROM services WHERE id = ?').get(params.serviceId);

  return { ...params, serviceName: service ? service.name : null };
}

// Date range applied to a LEFT JOIN, so services with no matching entries stay
// in the report as zero rows instead of disappearing from it.
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
// 1. Queue participation history — one row per queue entry
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

  // Derived from the rows rather than re-queried, so the footer can never
  // disagree with the table above it.
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
// 2. Service activity — one row per service
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
        -- Deliberately outside the date filter: "waiting now" is a statement
        -- about the line at this moment, not about the reporting window.
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
// 3. Queue usage statistics — one row per service
// ---------------------------------------------------------------------------

const USAGE_COLUMNS = [
  { key: 'serviceName', label: 'Service' },
  { key: 'totalServed', label: 'Served' },
  { key: 'averageWaitMinutes', label: 'Avg wait (min)' },
  { key: 'busiestHour', label: 'Busiest hour' },
];

// Entries per hour of day, per service. Kept as its own query and reduced in
// JavaScript: picking the maximum per group in SQLite needs either a window
// function or a correlated subquery, and neither is easier to read than this.
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
    // Ties go to the earlier hour, so the answer is stable run to run.
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

  // Averaging the per-service averages would weight a service with two visits
  // the same as one with two hundred, so the overall figure is measured across
  // every served entry instead.
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
    { label: 'Busiest hour', value: formatHour(hours.overall?.hour) },
  ];

  return report('Queue Usage Statistics', describeFilters(params), USAGE_COLUMNS, rows, summary);
}
