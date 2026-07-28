const express = require('express');
const db = require('../db/database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/dm — list DM conversations
router.get('/', auth, (req, res) => {
  const convos = db.prepare(`
    SELECT dc.id, dc.created_at,
           u.id as partner_id, u.username as partner_username,
           u.avatar_url as partner_avatar, u.status as partner_status
    FROM dm_conversations dc
    JOIN dm_participants dp1 ON dp1.conversation_id = dc.id AND dp1.user_id = ?
    JOIN dm_participants dp2 ON dp2.conversation_id = dc.id AND dp2.user_id != ?
    JOIN users u ON u.id = dp2.user_id
    ORDER BY dc.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(convos);
});

// POST /api/dm — open or retrieve DM with a user
router.post('/', auth, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (parseInt(userId) === req.user.id) return res.status(400).json({ error: 'Cannot DM yourself' });

  const target = db.prepare('SELECT id, username, avatar_url, status FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Check if conversation already exists
  const existing = db.prepare(`
    SELECT dc.id FROM dm_conversations dc
    JOIN dm_participants dp1 ON dp1.conversation_id = dc.id AND dp1.user_id = ?
    JOIN dm_participants dp2 ON dp2.conversation_id = dc.id AND dp2.user_id = ?
  `).get(req.user.id, userId);

  if (existing) {
    return res.json({ id: existing.id, partner: target });
  }

  const result = db.prepare('INSERT INTO dm_conversations DEFAULT VALUES').run();
  const convId = result.lastInsertRowid;
  db.prepare('INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, req.user.id);
  db.prepare('INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, userId);

  res.status(201).json({ id: convId, partner: target });
});

// GET /api/dm/:conversationId/messages
router.get('/:conversationId/messages', auth, (req, res) => {
  const { conversationId } = req.params;

  const isMember = db.prepare(
    'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
  ).get(conversationId, req.user.id);
  if (!isMember) return res.status(403).json({ error: 'Not part of this conversation' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const before = req.query.before;

  let messages;
  if (before) {
    messages = db.prepare(`
      SELECT m.*, u.username, u.avatar_url
      FROM dm_messages m JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ? AND m.id < ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(conversationId, before, limit);
  } else {
    messages = db.prepare(`
      SELECT m.*, u.username, u.avatar_url
      FROM dm_messages m JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(conversationId, limit);
  }

  res.json(messages.reverse());
});

// GET /api/dm/:conversationId/messages/around/:messageId
router.get('/:conversationId/messages/around/:messageId', auth, (req, res) => {
  const { conversationId, messageId } = req.params;

  const isMemberCheck = db.prepare(
    'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
  ).get(conversationId, req.user.id);
  if (!isMemberCheck) return res.status(403).json({ error: 'Not part of this conversation' });

  const DM_SELECT = `SELECT m.*, u.username, u.avatar_url FROM dm_messages m JOIN users u ON u.id = m.user_id`;
  const before = db.prepare(`${DM_SELECT} WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.created_at DESC LIMIT 25`)
    .all(conversationId, messageId);
  const after = db.prepare(`${DM_SELECT} WHERE m.conversation_id = ? AND m.id >= ? ORDER BY m.created_at ASC LIMIT 26`)
    .all(conversationId, messageId);

  res.json({ messages: [...before.reverse(), ...after], hasMoreBefore: before.length === 25 });
});

// GET /api/dm/:conversationId/search?q=...
router.get('/:conversationId/search', auth, (req, res) => {
  const { conversationId } = req.params;

  const isMemberCheck = db.prepare(
    'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
  ).get(conversationId, req.user.id);
  if (!isMemberCheck) return res.status(403).json({ error: 'Not part of this conversation' });

  const q = req.query.q?.trim();
  if (!q || q.length < 1) return res.json([]);

  const messages = db.prepare(`
    SELECT m.*, u.username, u.avatar_url
    FROM dm_messages m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ? AND m.content LIKE ?
    ORDER BY m.created_at DESC LIMIT 50
  `).all(conversationId, `%${q}%`);

  res.json(messages.reverse());
});

module.exports = router;
