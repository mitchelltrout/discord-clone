const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './db/app.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(dbPath);
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema);

// Incremental column additions for existing databases
const alterations = [
  "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
  `CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    emoji      TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (message_id, user_id, emoji)
  )`,
  `CREATE TABLE IF NOT EXISTS user_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT    NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_events_user    ON user_events(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_user_events_type    ON user_events(event_type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS page_visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    path       TEXT    NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS site_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `INSERT OR IGNORE INTO site_settings (key, value) VALUES ('registration_open', '1')`,
  `INSERT OR IGNORE INTO site_settings (key, value) VALUES ('system_message', 'Thank you for testing. -Mitch')`,
  "ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE servers ADD COLUMN fakesteve_enabled INTEGER NOT NULL DEFAULT 0",
  "UPDATE users SET username = 'Steve 2.0', email = 'steve2@bot.local' WHERE username = 'FakeSteve' AND is_bot = 1",
  "ALTER TABLE users ADD COLUMN bio TEXT",
  "ALTER TABLE users ADD COLUMN pronouns TEXT",
  "ALTER TABLE users ADD COLUMN location TEXT",
  "ALTER TABLE users ADD COLUMN banner_color TEXT",
  "ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL",
  `CREATE TABLE IF NOT EXISTS invite_codes (
    code       TEXT    PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_at    INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS pinned_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    pinned_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(channel_id, message_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id)`,
  `CREATE TABLE IF NOT EXISTS canvas_strokes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    stroke_data TEXT   NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_canvas_strokes_channel ON canvas_strokes(channel_id, created_at)`,
  // Add a default canvas channel to every server that doesn't already have one
  `INSERT INTO channels (server_id, name, type, position)
   SELECT s.id, 'General', 'canvas',
     (SELECT COALESCE(MAX(position), 0) + 1 FROM channels WHERE server_id = s.id)
   FROM servers s
   WHERE NOT EXISTS (
     SELECT 1 FROM channels WHERE server_id = s.id AND type = 'canvas'
   )`,
  // Rename existing canvas channels named 'Canvas' to 'General'
  `UPDATE channels SET name = 'General' WHERE type = 'canvas' AND name = 'Canvas'`,
  `CREATE TABLE IF NOT EXISTS polls (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    question   TEXT    NOT NULL,
    options    TEXT    NOT NULL,
    multi_vote INTEGER NOT NULL DEFAULT 0,
    closed     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_polls_message ON polls(message_id)`,
  `CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id    INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_idx INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (poll_id, user_id, option_idx)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id)`,
];
for (const sql of alterations) {
  try { db.exec(sql); } catch {} // ignore "duplicate column" errors
}

console.log('Database migrated successfully at', dbPath);
db.close();
