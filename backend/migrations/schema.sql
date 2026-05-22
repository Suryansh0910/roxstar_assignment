-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 1000,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spin wheel config (database-driven, adjustable)
CREATE TABLE IF NOT EXISTS wheel_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spin wheels
CREATE TABLE IF NOT EXISTS spin_wheels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_fee INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'spinning', 'completed', 'aborted')),
  winner_pool_pct REAL NOT NULL,
  admin_pool_pct REAL NOT NULL,
  app_pool_pct REAL NOT NULL,
  winner_pool_amt INTEGER NOT NULL DEFAULT 0,
  admin_pool_amt INTEGER NOT NULL DEFAULT 0,
  app_pool_amt INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  winner_id INTEGER REFERENCES users(id),
  scheduled_start_at DATETIME,
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wheel participants
CREATE TABLE IF NOT EXISTS wheel_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wheel_id INTEGER NOT NULL REFERENCES spin_wheels(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  eliminated_at DATETIME,
  elimination_order INTEGER,
  is_winner INTEGER NOT NULL DEFAULT 0,
  UNIQUE(wheel_id, user_id)
);

-- Transactions ledger
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('entry_fee', 'winner_payout', 'admin_payout', 'refund', 'initial_grant')),
  amount INTEGER NOT NULL,
  wheel_id INTEGER REFERENCES spin_wheels(id),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default config
INSERT OR IGNORE INTO wheel_config (key, value) VALUES
  ('winner_pool_pct', '70'),
  ('admin_pool_pct', '20'),
  ('app_pool_pct', '10'),
  ('default_entry_fee', '100'),
  ('auto_start_minutes', '3'),
  ('elimination_interval_seconds', '7'),
  ('min_participants', '3');
