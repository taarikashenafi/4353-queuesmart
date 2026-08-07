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
