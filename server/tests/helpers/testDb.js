// Gives each test file its own fresh in-memory database so tests are
// fast and fully isolated from each other and from the real DB file.
//
// Usage:
//   import { freshDb } from './helpers/testDb.js';
//   let db;
//   beforeEach(() => { db = freshDb(); });
//   afterEach(() => db.close());
import db, { createDatabase } from '../../db/index.js';

export function freshDb() {
  return createDatabase(':memory:');
}

// Wipes every table in the shared app connection (which is ':memory:'
// under NODE_ENV=test). Use in beforeEach for tests that drive the
// Express app with Supertest, since those hit the shared connection.
export function resetAppDb() {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    .all();
  db.pragma('foreign_keys = OFF');
  for (const { name } of tables) {
    db.prepare(`DELETE FROM "${name}"`).run();
  }
  db.pragma('foreign_keys = ON');
}
