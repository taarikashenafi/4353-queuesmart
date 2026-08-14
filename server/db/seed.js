// Seeds the database with a default admin account.
// Run with: npm run db:seed
import bcrypt from 'bcryptjs';
import db from './index.js';

const ADMIN_EMAIL = 'admin@queuesmart.com';
const ADMIN_PASSWORD = 'admin1234';
const SAMPLE_SERVICES = [
  {
    name: 'Academic Advising',
    description: 'Plan your degree, register for classes, and clear registration holds with an advisor.',
    expectedDuration: 15,
    priority: 'high',
  },
  {
    name: 'Financial Aid',
    description: 'Get help with scholarships, loans, disbursements, and FAFSA questions.',
    expectedDuration: 12,
    priority: 'high',
  },
  {
    name: 'Tech Support Desk',
    description: 'Get help with laptops, Wi-Fi, and campus account access.',
    expectedDuration: 8,
    priority: 'medium',
  },
  {
    name: 'Career Services',
    description: 'Schedule resume reviews, mock interviews, and internship advising.',
    expectedDuration: 20,
    priority: 'low',
  },
];

const existing = db
  .prepare('SELECT id FROM user_credentials WHERE email = ?')
  .get(ADMIN_EMAIL);

if (existing) {
  console.log(`Admin account already exists (${ADMIN_EMAIL}), nothing to do.`);
} else {
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const result = db
    .prepare(
      'INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)'
    )
    .run(ADMIN_EMAIL, passwordHash, 'admin');
  db.prepare(
    'INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)'
  ).run(result.lastInsertRowid, 'QueueSmart Admin');
  console.log(`Seeded admin account: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

const seedServices = db.transaction(() => {
  const findService = db.prepare('SELECT id FROM services WHERE name = ?');
  const insertService = db.prepare(`
    INSERT INTO services (name, description, expected_duration, priority)
    VALUES (?, ?, ?, ?)
  `);
  const insertQueue = db.prepare(`
    INSERT OR IGNORE INTO queues (service_id, status)
    VALUES (?, 'open')
  `);

  let inserted = 0;
  for (const service of SAMPLE_SERVICES) {
    let row = findService.get(service.name);
    if (!row) {
      const result = insertService.run(
        service.name,
        service.description,
        service.expectedDuration,
        service.priority,
      );
      row = { id: Number(result.lastInsertRowid) };
      inserted += 1;
    }
    insertQueue.run(row.id);
  }
  return inserted;
});

const insertedServices = seedServices();
console.log(
  insertedServices
    ? `Seeded ${insertedServices} sample services.`
    : 'Sample services already exist, nothing to do.',
);

// ---------------------------------------------------------------------------
// Historical queue activity
//
// The Smart Wait Engine has nothing to measure without completed entries, and
// the reports have nothing to report. This builds two weeks of finished visits
// so both have real data on a fresh clone.
//
// HOW THE ENGINE READS THIS, because it constrains the shape:
// observedServiceMinutes() diffs *consecutive served_at timestamps* and keeps
// diffs in (0, 120] minutes. It does not read served_at - joined_at. So the
// gaps between people served back to back are what it measures, and generating
// plausible-looking sparse traffic — one walk-in an hour — would teach it that
// a 6-minute appointment takes 60.
//
// Hence sessions: each business day a service serves a short block of people
// back to back, spaced at its true pace. Those within-block gaps are what the
// engine averages. The overnight gap between blocks lands well past 120
// minutes and gets discarded as idle time, which is exactly the filter's job.
// ---------------------------------------------------------------------------

const DEMO_EMAIL_DOMAIN = 'queuesmart.demo';
const DEMO_USERS = [
  'Ava Martinez', 'Noah Patel', 'Mia Chen', 'Liam Okafor',
  'Sofia Reyes', 'Ethan Brooks', 'Zara Ahmed', 'Owen Nguyen',
];

// The configured expected_duration each service was set up with, versus the
// pace its seeded history actually runs at. Advising and Career Services are
// the demo: one desk far faster than its configured number, one far slower.
// The other two roughly match, so the contrast reads as a real finding rather
// than every service disagreeing with its own configuration.
// openingHour is UTC — 14:00 UTC is about 9 AM in Houston. Staggered per desk
// so the reports' busiest-hour column varies instead of reading the same value
// four times, which looks like a broken query rather than a finding.
const SERVICE_HISTORY = {
  'Academic Advising': { pace: 6, openingHour: 14 },  // configured 15 — the over-quoting case
  'Financial Aid': { pace: 11, openingHour: 15 },     // configured 12 — about right
  'Tech Support Desk': { pace: 7, openingHour: 16 },  // configured 8  — about right
  'Career Services': { pace: 34, openingHour: 17 },   // configured 20 — the under-quoting case
};

const BUSINESS_DAYS = 10;   // ~2 weeks of weekdays
const SERVED_PER_SESSION = 4;
// 4 served/day × 10 days = 40 entries and 30 within-session gaps per service,
// comfortably past the sampleSize >= 10 the engine needs to report 'observed'
// rather than 'blended'.

// Deterministic PRNG so reseeding twice gives the same history. A demo that
// quotes different numbers each time it is reset is one nobody can rehearse.
function mulberry32(seed) {
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoAt(dayStart, minutesIn) {
  return new Date(dayStart.getTime() + minutesIn * 60000).toISOString();
}

const seedHistory = db.transaction(() => {
  const upsertUser = db.prepare(
    'INSERT OR IGNORE INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)',
  );
  const findUser = db.prepare('SELECT id FROM user_credentials WHERE email = ?');
  const upsertProfile = db.prepare(
    'INSERT OR IGNORE INTO user_profiles (user_id, full_name) VALUES (?, ?)',
  );

  const demoPasswordHash = bcrypt.hashSync('demo1234', 10);
  const demoUserIds = [];

  for (const fullName of DEMO_USERS) {
    const email = `${fullName.toLowerCase().replace(/ /g, '.')}@${DEMO_EMAIL_DOMAIN}`;
    upsertUser.run(email, demoPasswordHash, 'user');
    const { id } = findUser.get(email);
    upsertProfile.run(id, fullName);
    demoUserIds.push(id);
  }

  // Idempotent by rebuild, not by append. Scoped to the demo accounts so a
  // reseed right before presenting cannot delete entries real people made
  // during rehearsal.
  const placeholders = demoUserIds.map(() => '?').join(', ');
  const removed = db
    .prepare(`DELETE FROM queue_entries WHERE user_id IN (${placeholders})`)
    .run(...demoUserIds).changes;

  const insertEntry = db.prepare(`
    INSERT INTO queue_entries (queue_id, user_id, position, joined_at, served_at, status, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const services = db
    .prepare('SELECT id, name, priority FROM services WHERE name IN (SELECT value FROM json_each(?))')
    .all(JSON.stringify(Object.keys(SERVICE_HISTORY)));

  let served = 0;
  let canceled = 0;

  for (const service of services) {
    const { pace, openingHour } = SERVICE_HISTORY[service.name];
    const queue = db.prepare('SELECT id FROM queues WHERE service_id = ?').get(service.id);
    if (!queue) continue;

    // Seeded per service name so each desk gets its own stable jitter.
    const random = mulberry32(
      [...service.name].reduce((acc, char) => acc + char.charCodeAt(0), 0),
    );
    let userCursor = services.indexOf(service);

    for (let dayBack = BUSINESS_DAYS; dayBack >= 1; dayBack -= 1) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - dayBack);
      day.setUTCHours(0, 0, 0, 0);
      // Weekends have no desk hours, so no session — skip without consuming a
      // slot, which just makes the history reach a little further back.
      const weekday = day.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;

      // Jitter stays under 40 minutes so the session cannot drift into the
      // next hour and blur this desk's busiest-hour figure.
      const sessionStart = openingHour * 60 + Math.floor(random() * 40);
      let servedCursor = sessionStart;

      for (let seat = 0; seat < SERVED_PER_SESSION; seat += 1) {
        const userId = demoUserIds[userCursor % demoUserIds.length];
        userCursor += 1;

        if (seat > 0) {
          // ±1.5 min of jitter around the true pace. Never enough to drive a
          // gap to zero or past the 120-minute idle cutoff, so every one of
          // these survives into the engine's average.
          servedCursor += pace + (random() * 3 - 1.5);
        }
        // People queue up around the session opening and wait their turn, so
        // the measured wait grows down the line rather than being constant.
        const joinedAt = sessionStart - 4 - random() * 3 + seat * pace * 0.5;

        insertEntry.run(
          queue.id,
          userId,
          seat + 1,
          isoAt(day, joinedAt),
          isoAt(day, servedCursor),
          'served',
          service.priority,
        );
        served += 1;
      }

      // A couple of walkaways a week, so the participation report shows an
      // outcome other than 'served' and the service activity counts are not
      // all zero in the canceled column.
      if (random() < 0.25) {
        const userId = demoUserIds[userCursor % demoUserIds.length];
        userCursor += 1;
        insertEntry.run(
          queue.id,
          userId,
          SERVED_PER_SESSION + 1,
          isoAt(day, sessionStart + 10),
          null,
          'canceled',
          service.priority,
        );
        canceled += 1;
      }
    }
  }

  return { removed, served, canceled, users: demoUserIds.length };
});

const history = seedHistory();
console.log(
  `Seeded queue history: ${history.served} served, ${history.canceled} canceled, `
  + `across ${history.users} demo accounts (cleared ${history.removed} previous entries).`,
);
