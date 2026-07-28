PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  email      TEXT    NOT NULL UNIQUE,
  password   TEXT    NOT NULL,
  avatar_url TEXT,
  status         TEXT    NOT NULL DEFAULT 'offline',
  status_message TEXT    NOT NULL DEFAULT '',
  is_admin       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT    NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS servers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  icon_url    TEXT,
  owner_id    INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT    NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS server_members (
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role      TEXT    NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL,
  type      TEXT    NOT NULL DEFAULT 'text',
  position  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  content    TEXT    NOT NULL,
  edited_at  INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channels_server  ON channels(server_id);

CREATE TABLE IF NOT EXISTS dm_conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  content         TEXT    NOT NULL,
  edited_at       INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conv ON dm_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  emoji      TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS user_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT    NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_user_events_user    ON user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_type    ON user_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at DESC);

CREATE TABLE IF NOT EXISTS page_visits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  path       TEXT    NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits(created_at DESC);

CREATE TABLE IF NOT EXISTS canvas_strokes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  stroke_data TEXT   NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_canvas_strokes_channel ON canvas_strokes(channel_id, created_at);
