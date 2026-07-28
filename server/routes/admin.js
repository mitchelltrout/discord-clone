const express = require('express');
const db = require('../db/database');
const adminAuth = require('../middleware/adminAuth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

// All routes require admin
router.use(adminAuth);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const users    = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const servers  = db.prepare('SELECT COUNT(*) as count FROM servers').get().count;
  const messages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const dmMessages = db.prepare('SELECT COUNT(*) as count FROM dm_messages').get().count;
  res.json({ users, servers, messages: messages + dmMessages });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.status, u.is_admin, u.created_at,
           COUNT(DISTINCT sm.server_id) as server_count,
           COALESCE(msg.cnt, 0) as message_count,
           COALESCE(ev.login_count, 0) as login_count,
           ev.last_login_at
    FROM users u
    LEFT JOIN server_members sm ON sm.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as cnt FROM messages GROUP BY user_id
    ) msg ON msg.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as login_count, MAX(created_at) as last_login_at
      FROM user_events WHERE event_type = 'login' GROUP BY user_id
    ) ev ON ev.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/admin — toggle admin
router.patch('/users/:id/admin', (req, res) => {
  const { id } = req.params;
  const { is_admin } = req.body;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, id);
  res.json({ ok: true });
});

// GET /api/admin/servers
router.get('/servers', (req, res) => {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.invite_code, s.created_at,
           u.username as owner_username,
           COUNT(DISTINCT sm.user_id) as member_count,
           COUNT(DISTINCT c.id) as channel_count
    FROM servers s
    JOIN users u ON u.id = s.owner_id
    LEFT JOIN server_members sm ON sm.server_id = s.id
    LEFT JOIN channels c ON c.server_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(servers);
});

// DELETE /api/admin/servers/:id
router.delete('/servers/:id', (req, res) => {
  const { id } = req.params;
  const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/admin/messages
router.get('/messages', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search ? `%${req.query.search}%` : null;

  const where = search ? 'WHERE m.content LIKE ?' : '';
  const params = search ? [search, limit, offset] : [limit, offset];

  const messages = db.prepare(`
    SELECT m.id, m.content, m.created_at, m.edited_at,
           u.username, u.id as user_id,
           ch.name as channel_name, s.name as server_name, s.id as server_id
    FROM messages m
    JOIN users u ON u.id = m.user_id
    JOIN channels ch ON ch.id = m.channel_id
    JOIN servers s ON s.id = ch.server_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  const total = db.prepare(`SELECT COUNT(*) as count FROM messages m ${where}`)
    .get(...(search ? [search] : [])).count;

  res.json({ messages, total });
});

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', (req, res) => {
  const { id } = req.params;
  const msg = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/admin/dms
router.get('/dms', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search ? `%${req.query.search}%` : null;

  const where = search ? 'WHERE m.content LIKE ?' : '';
  const params = search ? [search, limit, offset] : [limit, offset];

  const messages = db.prepare(`
    SELECT m.id, m.content, m.created_at, m.edited_at,
           u.username, u.id as user_id,
           sender.username as to_username,
           m.conversation_id
    FROM dm_messages m
    JOIN users u ON u.id = m.user_id
    JOIN dm_participants dp ON dp.conversation_id = m.conversation_id AND dp.user_id != m.user_id
    JOIN users sender ON sender.id = dp.user_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  const total = db.prepare(`SELECT COUNT(*) as count FROM dm_messages m ${where}`)
    .get(...(search ? [search] : [])).count;

  res.json({ messages, total });
});

// DELETE /api/admin/dms/:id
router.delete('/dms/:id', (req, res) => {
  const { id } = req.params;
  const msg = db.prepare('SELECT id FROM dm_messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  db.prepare('DELETE FROM dm_messages WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/admin/audit?limit=50&offset=0&type=login
router.get('/audit', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type || null;

  const where = type ? 'WHERE e.event_type = ?' : '';
  const params = type ? [type, limit, offset] : [limit, offset];

  const events = db.prepare(`
    SELECT e.id, e.event_type, e.ip, e.user_agent, e.created_at,
           u.username, u.id as user_id
    FROM user_events e
    LEFT JOIN users u ON u.id = e.user_id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  const total = db.prepare(`SELECT COUNT(*) as count FROM user_events e ${where}`)
    .get(...(type ? [type] : [])).count;

  res.json({ events, total });
});

// GET /api/admin/analytics
router.get('/analytics', (_req, res) => {
  const signups = db.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count
    FROM users
    WHERE created_at >= unixepoch() - 30 * 86400
    GROUP BY day ORDER BY day
  `).all();

  const logins = db.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count
    FROM user_events
    WHERE event_type = 'login' AND created_at >= unixepoch() - 30 * 86400
    GROUP BY day ORDER BY day
  `).all();

  const pageViews = db.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count
    FROM page_visits
    WHERE created_at >= unixepoch() - 30 * 86400
    GROUP BY day ORDER BY day
  `).all();

  const topPages = db.prepare(`
    SELECT path, COUNT(*) as count
    FROM page_visits
    GROUP BY path ORDER BY count DESC LIMIT 10
  `).all();

  const uniqueVisitorsToday = db.prepare(`
    SELECT COUNT(DISTINCT ip) as count FROM page_visits
    WHERE created_at >= unixepoch() - 86400 AND ip IS NOT NULL
  `).get().count;

  const totalVisits = db.prepare('SELECT COUNT(*) as count FROM page_visits').get().count;
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM user_events').get().count;

  res.json({ signups, logins, pageViews, topPages, uniqueVisitorsToday, totalVisits, totalEvents });
});

// GET /api/admin/settings
router.get('/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(settings);
});

// PATCH /api/admin/settings
router.patch('/settings', (req, res) => {
  const allowed = ['registration_open', 'system_message'];
  for (const key of allowed) {
    if (key in req.body) {
      const val = String(req.body[key]);
      if (key === 'registration_open' && !['0', '1', 'invite'].includes(val)) continue;
      db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(key, val);
    }
  }
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

// GET /api/admin/steve
router.get('/steve', (_req, res) => {
  const steve = db.prepare('SELECT id, username, avatar_url FROM users WHERE is_bot = 1').get();
  res.json(steve || null);
});

// PATCH /api/admin/steve — update name
router.patch('/steve', (req, res) => {
  const { username } = req.body;
  const steve = db.prepare('SELECT id FROM users WHERE is_bot = 1').get();
  if (!steve) return res.status(404).json({ error: 'Steve 2.0 not found' });
  if (username && typeof username === 'string' && username.trim().length >= 2) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), steve.id);
  }
  const updated = db.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').get(steve.id);
  res.json(updated);
});

// POST /api/admin/steve/avatar — upload and resize Steve's avatar
router.post('/steve/avatar', ...avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const steve = db.prepare('SELECT id FROM users WHERE is_bot = 1').get();
  if (!steve) return res.status(404).json({ error: 'Steve 2.0 not found' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, steve.id);
  const updated = db.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').get(steve.id);
  res.json(updated);
});

module.exports = router;
