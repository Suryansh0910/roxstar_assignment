const { Database } = require('node-sqlite3-wasm');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/roxstar.db';
const dataDir = path.dirname(path.resolve(DB_PATH));

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.resolve(DB_PATH));

db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(
  path.join(__dirname, '../migrations/schema.sql'),
  'utf8'
);
db.exec(schema);

// node-sqlite3-wasm has no db.transaction() — use this helper instead
function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, withTransaction };
