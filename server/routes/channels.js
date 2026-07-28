const express = require('express');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { isAdmin, isMember } = require('../utils/permissions');
const { getIo } = require('../io');

const router = express.Router();

// POST /api/servers/:serverId/channels
router.post('/servers/:serverId/channels', auth, (req, res) => {
  const { serverId } = req.params;
  if (!isAdmin(serverId, req.user.id)) return res.status(403).json({ error: 'Admin only' });

  const { name, type } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Channel name must be 1–100 characters' });
  }
  const validTypes = ['text', 'voice', 'canvas'];
  const channelType = validTypes.includes(type) ? type : 'text';

  const maxPos = db.prepare('SELECT MAX(position) as m FROM channels WHERE server_id = ?').get(serverId);
  const position = (maxPos.m || 0) + 1;

  const result = db.prepare(
    'INSERT INTO channels (server_id, name, type, position) VALUES (?, ?, ?, ?)'
  ).run(serverId, name, channelType, position);

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(channel);
});

// GET /api/channels/:id/strokes — load canvas history
router.get('/channels/:id/strokes', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.type !== 'canvas') return res.status(400).json({ error: 'Not a canvas channel' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

  const strokes = db.prepare(
    'SELECT id, user_id, stroke_data FROM canvas_strokes WHERE channel_id = ? ORDER BY id ASC'
  ).all(req.params.id).map((row) => ({
    strokeId: row.id,
    userId: row.user_id,
    stroke: JSON.parse(row.stroke_data),
  }));

  res.json(strokes);
});

// PATCH /api/channels/:id
router.patch('/channels/:id', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isAdmin(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Admin only' });

  const { name, position } = req.body;
  db.prepare('UPDATE channels SET name = ?, position = ? WHERE id = ?').run(
    name || channel.name,
    position !== undefined ? position : channel.position,
    channel.id
  );
  res.json(db.prepare('SELECT * FROM channels WHERE id = ?').get(channel.id));
});

// DELETE /api/channels/:id
router.delete('/channels/:id', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isAdmin(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Admin only' });

  db.prepare('DELETE FROM channels WHERE id = ?').run(channel.id);

  // Notify all server members so they remove the channel from their sidebar
  const io = getIo();
  if (io) {
    const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(channel.server_id);
    members.forEach(({ user_id }) => {
      io.to(`user:${user_id}`).emit('channel:removed', { serverId: channel.server_id, channelId: channel.id });
    });
  }

  res.json({ ok: true });
});

module.exports = router;
