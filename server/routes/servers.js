const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { isAdmin, isMember } = require('../utils/permissions');
const { serverIconUpload } = require('../middleware/upload');
const { getIo } = require('../io');

const router = express.Router();

// GET /api/servers — list servers for current user
router.get('/', auth, (req, res) => {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.icon_url, s.owner_id, s.invite_code, s.created_at
    FROM servers s
    JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
    ORDER BY sm.joined_at ASC
  `).all(req.user.id);
  res.json(servers);
});

// POST /api/servers — create a server
router.post('/', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Server name must be 1–100 characters' });
  }

  const inviteCode = uuidv4().slice(0, 8);
  const result = db.prepare(
    'INSERT INTO servers (name, owner_id, invite_code) VALUES (?, ?, ?)'
  ).run(name, req.user.id, inviteCode);

  const serverId = result.lastInsertRowid;

  // Add owner as member
  db.prepare(
    "INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, 'owner')"
  ).run(serverId, req.user.id);

  // Create default channels
  db.prepare("INSERT INTO channels (server_id, name, type, position) VALUES (?, 'general', 'text', 0)").run(serverId);
  db.prepare("INSERT INTO channels (server_id, name, type, position) VALUES (?, 'General', 'canvas', 1)").run(serverId);
  db.prepare("INSERT INTO channels (server_id, name, type, position) VALUES (?, 'General', 'voice', 2)").run(serverId);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  res.status(201).json(server);
});

// GET /api/servers/:id — server detail with channels and members
router.get('/:id', auth, (req, res) => {
  const serverId = req.params.id;
  if (!isMember(serverId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this server' });
  }

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const channels = db.prepare(
    'SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC'
  ).all(serverId);

  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar_url, u.status, u.status_message, sm.role
    FROM users u
    JOIN server_members sm ON sm.user_id = u.id
    WHERE sm.server_id = ?
    ORDER BY sm.role DESC, u.username ASC
  `).all(serverId);

  // Inject Steve 2.0 as a virtual member when enabled
  if (server.fakesteve_enabled) {
    const steve = db.prepare("SELECT id, username, avatar_url FROM users WHERE username = 'Steve 2.0' AND is_bot = 1").get();
    if (steve) members.push({ ...steve, status: 'online', role: 'member', is_bot: 1 });
  }

  res.json({ ...server, channels, members });
});

// PATCH /api/servers/:id
router.patch('/:id', auth, (req, res) => {
  const serverId = req.params.id;
  if (!isAdmin(serverId, req.user.id)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { name, icon_url } = req.body;
  const current = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!current) return res.status(404).json({ error: 'Server not found' });

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Server name must be 1–100 characters' });
    }
  }
  if (icon_url !== undefined && icon_url !== null) {
    if (typeof icon_url !== 'string' || !icon_url.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Invalid icon_url' });
    }
  }

  db.prepare('UPDATE servers SET name = ?, icon_url = ? WHERE id = ?').run(
    name || current.name,
    icon_url !== undefined ? icon_url : current.icon_url,
    serverId
  );
  res.json(db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId));
});

// POST /api/servers/:id/icon — upload server icon (owner only)
router.post('/:id/icon', auth, serverIconUpload.single('icon'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id) return res.status(403).json({ error: 'Owner only' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const iconUrl = `/uploads/servers/${req.file.filename}`;
  db.prepare('UPDATE servers SET icon_url = ? WHERE id = ?').run(iconUrl, server.id);
  res.json(db.prepare('SELECT * FROM servers WHERE id = ?').get(server.id));
});

// DELETE /api/servers/:id
router.delete('/:id', auth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id) return res.status(403).json({ error: 'Owner only' });
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/servers/join — join via invite code
router.post('/join', auth, (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const server = db.prepare('SELECT * FROM servers WHERE invite_code = ?').get(invite_code);
  if (!server) return res.status(404).json({ error: 'Invalid invite code' });

  const already = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(server.id, req.user.id);
  if (already) return res.status(409).json({ error: 'Already a member' });

  db.prepare("INSERT INTO server_members (server_id, user_id) VALUES (?, ?)").run(server.id, req.user.id);

  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC').all(server.id);
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar_url, u.status, sm.role
    FROM users u JOIN server_members sm ON sm.user_id = u.id
    WHERE sm.server_id = ?
  `).all(server.id);

  // Notify existing members that a new member joined
  const newMember = members.find((m) => m.id === req.user.id);
  if (newMember) {
    getIo()?.emit('member:joined', { serverId: server.id, member: newMember });
  }

  res.json({ ...server, channels, members });
});

// GET /api/servers/:id/invite — get invite link
router.get('/:id/invite', auth, (req, res) => {
  const serverId = req.params.id;
  if (!isMember(serverId, req.user.id)) return res.status(403).json({ error: 'Not a member' });
  const server = db.prepare('SELECT invite_code FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json({ invite_code: server.invite_code });
});

// DELETE /api/servers/:id/leave — leave server (non-owner only)
router.delete('/:id/leave', auth, (req, res) => {
  const serverId = req.params.id;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id === req.user.id) return res.status(400).json({ error: 'Owner cannot leave — delete the server instead' });
  if (!isMember(serverId, req.user.id)) return res.status(400).json({ error: 'Not a member' });
  db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, req.user.id);
  getIo()?.emit('member:left', { serverId: parseInt(serverId), userId: req.user.id });
  res.json({ ok: true });
});

// DELETE /api/servers/:id/members/:userId — kick member
router.delete('/:id/members/:userId', auth, (req, res) => {
  const serverId = req.params.id;
  const targetId = parseInt(req.params.userId);

  if (!isAdmin(serverId, req.user.id)) return res.status(403).json({ error: 'Admin only' });

  const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(serverId);
  if (targetId === server.owner_id) return res.status(400).json({ error: 'Cannot kick the owner' });

  db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, targetId);

  const io = getIo();
  io?.emit('member:left', { serverId: parseInt(serverId), userId: targetId });
  io?.to(`user:${targetId}`).emit('server:kicked', { serverId: parseInt(serverId) });

  res.json({ ok: true });
});

// POST /api/servers/:id/reset-invite — generate a new invite code (owner only)
router.post('/:id/reset-invite', auth, (req, res) => {
  const serverId = req.params.id;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id) return res.status(403).json({ error: 'Owner only' });

  const newCode = uuidv4().slice(0, 8);
  db.prepare('UPDATE servers SET invite_code = ? WHERE id = ?').run(newCode, serverId);
  res.json({ invite_code: newCode });
});

// PATCH /api/servers/:id/fakesteve — toggle FakeSteve bot (owner only)
router.patch('/:id/fakesteve', auth, (req, res) => {
  const serverId = req.params.id;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id) return res.status(403).json({ error: 'Owner only' });

  const enabled = req.body.enabled ? 1 : 0;
  db.prepare('UPDATE servers SET fakesteve_enabled = ? WHERE id = ?').run(enabled, serverId);

  const io = getIo();
  const steve = db.prepare("SELECT id, username, avatar_url FROM users WHERE username = 'Steve 2.0' AND is_bot = 1").get();
  if (steve && io) {
    if (enabled) {
      io.emit('member:joined', { serverId: parseInt(serverId), member: { ...steve, status: 'online', role: 'member', is_bot: 1 } });
    } else {
      io.emit('member:left', { serverId: parseInt(serverId), userId: steve.id });
    }
  }

  res.json({ fakesteve_enabled: enabled === 1 });
});

module.exports = router;
