// Seeds the database with a default admin account.
// Run with: npm run db:seed
import bcrypt from 'bcryptjs';
import db from './index.js';

const ADMIN_EMAIL = 'admin@queuesmart.com';
const ADMIN_PASSWORD = 'admin1234';

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
