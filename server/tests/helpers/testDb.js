// Gives each test file its own fresh in-memory database so tests are
// fast and fully isolated from each other and from the real DB file.
//
// Usage:
//   import { freshDb } from './helpers/testDb.js';
//   let db;
//   beforeEach(() => { db = freshDb(); });
//   afterEach(() => db.close());
import { createDatabase } from '../../db/index.js';

export function freshDb() {
  return createDatabase(':memory:');
}
