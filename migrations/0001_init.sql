PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_sessions (
  user_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  topic TEXT,
  last_question_id TEXT,
  menu_chat_id INTEGER,
  menu_message_id INTEGER,
  active_ticket_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT UNIQUE,
  user_id INTEGER NOT NULL,
  username TEXT,
  display_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_ticket_per_user
  ON tickets(user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS tickets_status_updated
  ON tickets(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin', 'system')),
  telegram_message_id INTEGER,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

