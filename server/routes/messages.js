const express = require('express');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { isMember, isAdmin } = require('../utils/permissions');

const router = express.Router();

// Shared SELECT fragment — includes reply-to data
const MSG_SELECT = `
  SELECT m.*, u.username, u.avatar_url,
         rm.content   AS reply_content,
         rm.user_id   AS reply_user_id,
         ru.username  AS reply_username
  FROM messages m
  JOIN users u  ON u.id  = m.user_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id
  LEFT JOIN users    ru ON ru.id = rm.user_id
`;

function getMessageById(id) {
  return db.prepare(`${MSG_SELECT} WHERE m.id = ?`).get(id);
}

function getPollData(messageId, userId) {
  const poll = db.prepare('SELECT * FROM polls WHERE message_id = ?').get(messageId);
  if (!poll) return null;
  const voteRows = db.prepare('SELECT option_idx, user_id FROM poll_votes WHERE poll_id = ?').all(poll.id);
  const votes = {};
  const myVotes = [];
  for (const v of voteRows) {
    votes[v.option_idx] = (votes[v.option_idx] || 0) + 1;
    if (userId && v.user_id === userId) myVotes.push(v.option_idx);
  }
  return {
    id: poll.id,
    question: poll.question,
    options: JSON.parse(poll.options),
    multi_vote: Boolean(poll.multi_vote),
    closed: Boolean(poll.closed),
    votes,
    my_votes: myVotes,
  };
}

function attachPolls(messages, userId) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const ph = ids.map(() => '?').join(',');
  const polls = db.prepare(`SELECT * FROM polls WHERE message_id IN (${ph})`).all(...ids);
  if (!polls.length) return messages.map((m) => ({ ...m, poll: null }));

  const pollIds = polls.map((p) => p.id);
  const vph = pollIds.map(() => '?').join(',');
  const voteRows = db.prepare(`SELECT poll_id, option_idx, user_id FROM poll_votes WHERE poll_id IN (${vph})`).all(...pollIds);

  const votesByPoll = {};
  for (const v of voteRows) {
    if (!votesByPoll[v.poll_id]) votesByPoll[v.poll_id] = [];
    votesByPoll[v.poll_id].push(v);
  }

  const byMessage = {};
  for (const p of polls) {
    const pvotes = votesByPoll[p.id] || [];
    const votes = {};
    const myVotes = [];
    for (const v of pvotes) {
      votes[v.option_idx] = (votes[v.option_idx] || 0) + 1;
      if (userId && v.user_id === userId) myVotes.push(v.option_idx);
    }
    byMessage[p.message_id] = {
      id: p.id,
      question: p.question,
      options: JSON.parse(p.options),
      multi_vote: Boolean(p.multi_vote),
      closed: Boolean(p.closed),
      votes,
      my_votes: myVotes,
    };
  }
  return messages.map((m) => ({ ...m, poll: byMessage[m.id] || null }));
}

function attachReactions(messages) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const rows = db.prepare(
    `SELECT emoji, COUNT(*) as count, json_group_array(user_id) as user_ids, message_id
     FROM message_reactions WHERE message_id IN (${ids.map(() => '?').join(',')})
     GROUP BY message_id, emoji`
  ).all(...ids);

  const byMessage = {};
  for (const r of rows) {
    if (!byMessage[r.message_id]) byMessage[r.message_id] = [];
    byMessage[r.message_id].push({ emoji: r.emoji, count: r.count, userIds: JSON.parse(r.user_ids) });
  }
  return messages.map((m) => ({ ...m, reactions: byMessage[m.id] || [] }));
}

// GET /api/channels/:channelId/messages?before=id&limit=50
router.get('/channels/:channelId/messages', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Not a member' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const before = req.query.before;

  let messages;
  if (before) {
    messages = db.prepare(`${MSG_SELECT} WHERE m.channel_id = ? AND m.id < ? ORDER BY m.created_at DESC LIMIT ?`)
      .all(req.params.channelId, before, limit);
  } else {
    messages = db.prepare(`${MSG_SELECT} WHERE m.channel_id = ? ORDER BY m.created_at DESC LIMIT ?`)
      .all(req.params.channelId, limit);
  }

  res.json(attachPolls(attachReactions(messages.reverse()), req.user.id));
});

// POST /api/channels/:channelId/messages (REST fallback)
router.post('/channels/:channelId/messages', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Not a member' });

  const { content, replyToId, poll } = req.body;

  if (poll) {
    const { question, options, multi_vote } = poll;
    if (!question || typeof question !== 'string' || question.trim().length < 1 || question.trim().length > 300) {
      return res.status(400).json({ error: 'Poll question must be 1–300 characters' });
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
      return res.status(400).json({ error: 'Poll must have 2–10 options' });
    }
    for (const opt of options) {
      if (typeof opt !== 'string' || opt.trim().length < 1 || opt.trim().length > 100) {
        return res.status(400).json({ error: 'Each option must be 1–100 characters' });
      }
    }
    const q = question.trim();
    const opts = options.map((o) => o.trim());
    const msgResult = db.prepare(
      'INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)'
    ).run(req.params.channelId, req.user.id, q);
    const msgId = msgResult.lastInsertRowid;
    const pollResult = db.prepare(
      'INSERT INTO polls (message_id, question, options, multi_vote) VALUES (?, ?, ?, ?)'
    ).run(msgId, q, JSON.stringify(opts), multi_vote ? 1 : 0);
    const msg = getMessageById(msgId);
    msg.poll = { id: pollResult.lastInsertRowid, question: q, options: opts, multi_vote: Boolean(multi_vote), closed: false, votes: {}, my_votes: [] };
    return res.status(201).json(msg);
  }

  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });
  if (typeof content !== 'string' || content.trim().length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 characters)' });

  const result = db.prepare(
    'INSERT INTO messages (channel_id, user_id, content, reply_to_id) VALUES (?, ?, ?, ?)'
  ).run(req.params.channelId, req.user.id, content.trim(), replyToId || null);

  const msg = getMessageById(result.lastInsertRowid);
  msg.poll = null;
  res.status(201).json(msg);
});

// PATCH /api/messages/:id
router.patch('/:id', auth, (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.user_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });
  if (typeof content !== 'string' || content.trim().length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 characters)' });

  db.prepare('UPDATE messages SET content = ?, edited_at = unixepoch() WHERE id = ?').run(content.trim(), message.id);
  res.json(getMessageById(message.id));
});

// DELETE /api/messages/:id
router.delete('/:id', auth, (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(message.channel_id);
  const canDelete = message.user_id === req.user.id || isAdmin(channel.server_id, req.user.id);
  if (!canDelete) return res.status(403).json({ error: 'Cannot delete this message' });

  db.prepare('DELETE FROM messages WHERE id = ?').run(message.id);
  res.json({ ok: true });
});

// GET /api/channels/:channelId/messages/around/:messageId
router.get('/channels/:channelId/messages/around/:messageId', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Not a member' });

  const msgId = req.params.messageId;
  const before = db.prepare(`${MSG_SELECT} WHERE m.channel_id = ? AND m.id < ? ORDER BY m.created_at DESC LIMIT 25`)
    .all(req.params.channelId, msgId);
  const after = db.prepare(`${MSG_SELECT} WHERE m.channel_id = ? AND m.id >= ? ORDER BY m.created_at ASC LIMIT 26`)
    .all(req.params.channelId, msgId);

  const messages = attachPolls(attachReactions([...before.reverse(), ...after]), req.user.id);
  res.json({ messages, hasMoreBefore: before.length === 25 });
});

// GET /api/channels/:channelId/search?q=...
router.get('/channels/:channelId/search', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Not a member' });

  const q = req.query.q?.trim();
  if (!q || q.length < 1) return res.json([]);

  const messages = db.prepare(`${MSG_SELECT} WHERE m.channel_id = ? AND m.content LIKE ? ORDER BY m.created_at DESC LIMIT 50`)
    .all(req.params.channelId, `%${q}%`);

  res.json(attachPolls(attachReactions(messages.reverse()), req.user.id));
});

// GET /api/channels/:channelId/pins
router.get('/channels/:channelId/pins', auth, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!isMember(channel.server_id, req.user.id)) return res.status(403).json({ error: 'Not a member' });

  const pinned = db.prepare(`
    SELECT m.*, u.username, u.avatar_url,
           rm.content AS reply_content, rm.user_id AS reply_user_id, ru.username AS reply_username,
           pm.pinned_at, pu.username AS pinned_by_username
    FROM pinned_messages pm
    JOIN messages m ON m.id = pm.message_id
    JOIN users u    ON u.id = m.user_id
    LEFT JOIN messages rm ON rm.id = m.reply_to_id
    LEFT JOIN users    ru ON ru.id = rm.user_id
    LEFT JOIN users    pu ON pu.id = pm.pinned_by
    WHERE pm.channel_id = ?
    ORDER BY pm.pinned_at DESC
  `).all(req.params.channelId);

  res.json(attachPolls(attachReactions(pinned), req.user.id));
});

module.exports = router;
