const db = require('../db/database');
const { isMember, isAdmin } = require('../utils/permissions');
const { maybeRespond } = require('../fakesteve');
const { allow } = require('../utils/socketRateLimit');

const MSG_SELECT = `
  SELECT m.*, u.username, u.avatar_url,
         rm.content  AS reply_content,
         rm.user_id  AS reply_user_id,
         ru.username AS reply_username
  FROM messages m
  JOIN users u  ON u.id  = m.user_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id
  LEFT JOIN users    ru ON ru.id = rm.user_id
`;

function getPollDataForBroadcast(messageId) {
  const poll = db.prepare('SELECT * FROM polls WHERE message_id = ?').get(messageId);
  if (!poll) return null;
  const voteRows = db.prepare('SELECT option_idx, user_id FROM poll_votes WHERE poll_id = ?').all(poll.id);
  const votes = {};
  for (const v of voteRows) {
    votes[v.option_idx] = (votes[v.option_idx] || 0) + 1;
  }
  return {
    id: poll.id,
    question: poll.question,
    options: JSON.parse(poll.options),
    multi_vote: Boolean(poll.multi_vote),
    closed: Boolean(poll.closed),
    votes,
    my_votes: [], // computed per-user client-side via poll:updated events
  };
}

function getMessageById(id) {
  const msg = db.prepare(`${MSG_SELECT} WHERE m.id = ?`).get(id);
  if (msg) msg.poll = getPollDataForBroadcast(id);
  return msg;
}

function getReactions(messageId) {
  const rows = db.prepare(`
    SELECT emoji, COUNT(*) as count, json_group_array(user_id) as user_ids
    FROM message_reactions WHERE message_id = ? GROUP BY emoji
  `).all(messageId);
  return rows.map((r) => ({ emoji: r.emoji, count: r.count, userIds: JSON.parse(r.user_ids) }));
}

function messageHandler(io, socket) {
  socket.on('message:send', ({ channelId, content, replyToId }) => {
    if (!allow(socket.id, 'message:send', 5, 5000)) return; // 5 messages per 5s
    if (!channelId || !content?.trim()) return;
    if (typeof content !== 'string' || content.trim().length > 2000) return;

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || !isMember(channel.server_id, socket.userId)) return;

    // Ensure the reply target belongs to the same channel (prevent cross-channel leaks)
    let resolvedReplyToId = null;
    if (replyToId) {
      const replyMsg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(replyToId);
      if (replyMsg && replyMsg.channel_id === Number(channelId)) resolvedReplyToId = replyToId;
    }

    const result = db.prepare(
      'INSERT INTO messages (channel_id, user_id, content, reply_to_id) VALUES (?, ?, ?, ?)'
    ).run(channelId, socket.userId, content.trim(), resolvedReplyToId);

    const message = getMessageById(result.lastInsertRowid);

    io.to(`channel:${channelId}`).emit('message:new', message);

    maybeRespond(channel.server_id, channelId, result.lastInsertRowid, content.trim());

    const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(channel.server_id);
    members.forEach(({ user_id }) => {
      io.to(`user:${user_id}`).emit('channel:notification', {
        channelId: Number(channelId),
        serverId: channel.server_id,
        channelName: channel.name,
        username: message.username,
        content: message.content,
      });
    });
  });

  socket.on('message:edit', ({ messageId, content }) => {
    if (!messageId || !content?.trim()) return;
    if (typeof content !== 'string' || content.trim().length > 2000) return;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message || message.user_id !== socket.userId) return;

    db.prepare('UPDATE messages SET content = ?, edited_at = unixepoch() WHERE id = ?').run(content.trim(), messageId);
    const updated = getMessageById(messageId);
    io.to(`channel:${message.channel_id}`).emit('message:updated', updated);
  });

  socket.on('message:delete', ({ messageId }) => {
    if (!messageId) return;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) return;

    const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(message.channel_id);
    const canDelete = message.user_id === socket.userId || isAdmin(channel.server_id, socket.userId);
    if (!canDelete) return;

    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    io.to(`channel:${message.channel_id}`).emit('message:deleted', {
      messageId,
      channelId: message.channel_id,
    });
  });

  socket.on('message:pin', ({ channelId, messageId }) => {
    if (!channelId || !messageId) return;
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || !isAdmin(channel.server_id, socket.userId)) return;

    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND channel_id = ?').get(messageId, channelId);
    if (!message) return;

    try {
      db.prepare('INSERT INTO pinned_messages (channel_id, message_id, pinned_by) VALUES (?, ?, ?)')
        .run(channelId, messageId, socket.userId);
    } catch { return; }

    const pinned = getMessageById(messageId);
    io.to(`channel:${channelId}`).emit('pin:new', { channelId: Number(channelId), message: pinned });
  });

  socket.on('message:unpin', ({ channelId, messageId }) => {
    if (!channelId || !messageId) return;
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || !isAdmin(channel.server_id, socket.userId)) return;

    db.prepare('DELETE FROM pinned_messages WHERE channel_id = ? AND message_id = ?').run(channelId, messageId);
    io.to(`channel:${channelId}`).emit('pin:removed', { channelId: Number(channelId), messageId: Number(messageId) });
  });

  socket.on('typing:start', ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId: socket.userId,
      username: socket.username,
      typing: true,
    });
  });

  socket.on('typing:stop', ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId: socket.userId,
      username: socket.username,
      typing: false,
    });
  });

  // ── Polls ───────────────────────────────────────────────────────────────

  socket.on('poll:send', ({ channelId, question, options, multi_vote }) => {
    if (!allow(socket.id, 'poll:send', 3, 5000)) return; // 3 polls per 5s
    if (!channelId) return;
    if (!question || typeof question !== 'string' || question.trim().length < 1 || question.trim().length > 300) return;
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) return;
    for (const opt of options) {
      if (typeof opt !== 'string' || opt.trim().length < 1 || opt.trim().length > 100) return;
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || !isMember(channel.server_id, socket.userId)) return;

    const q = question.trim();
    const opts = options.map((o) => o.trim());

    const msgResult = db.prepare(
      'INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)'
    ).run(channelId, socket.userId, q);
    const msgId = msgResult.lastInsertRowid;

    const pollResult = db.prepare(
      'INSERT INTO polls (message_id, question, options, multi_vote) VALUES (?, ?, ?, ?)'
    ).run(msgId, q, JSON.stringify(opts), multi_vote ? 1 : 0);

    const message = getMessageById(msgId);
    // Override poll with fresh constructed object (no extra DB round-trip needed)
    message.poll = {
      id: pollResult.lastInsertRowid,
      question: q,
      options: opts,
      multi_vote: Boolean(multi_vote),
      closed: false,
      votes: {},
      my_votes: [],
    };

    io.to(`channel:${channelId}`).emit('message:new', message);

    const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(channel.server_id);
    members.forEach(({ user_id }) => {
      io.to(`user:${user_id}`).emit('channel:notification', {
        channelId: Number(channelId),
        serverId: channel.server_id,
        channelName: channel.name,
        username: message.username,
        content: `📊 Poll: ${q}`,
      });
    });
  });

  socket.on('poll:vote', ({ pollId, optionIdx }) => {
    if (!allow(socket.id, 'poll:vote', 20, 5000)) return; // 20 votes per 5s
    if (pollId == null || typeof optionIdx !== 'number' || !Number.isInteger(optionIdx) || optionIdx < 0) return;

    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    if (!poll || poll.closed) return;

    const options = JSON.parse(poll.options);
    if (optionIdx >= options.length) return;

    const msg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(poll.message_id);
    if (!msg) return;
    const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(msg.channel_id);
    if (!isMember(channel.server_id, socket.userId)) return;

    const existing = db.prepare(
      'SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_idx = ?'
    ).get(pollId, socket.userId, optionIdx);

    if (existing) {
      db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_idx = ?')
        .run(pollId, socket.userId, optionIdx);
    } else {
      if (!poll.multi_vote) {
        db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?')
          .run(pollId, socket.userId);
      }
      db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id, user_id, option_idx) VALUES (?, ?, ?)')
        .run(pollId, socket.userId, optionIdx);
    }

    // Broadcast vote counts with voter IDs so each client can compute my_votes
    const voteRows = db.prepare('SELECT option_idx, user_id FROM poll_votes WHERE poll_id = ?').all(pollId);
    const votes = {};
    for (const v of voteRows) {
      if (!votes[v.option_idx]) votes[v.option_idx] = { count: 0, userIds: [] };
      votes[v.option_idx].count++;
      votes[v.option_idx].userIds.push(v.user_id);
    }

    io.to(`channel:${msg.channel_id}`).emit('poll:updated', {
      messageId: poll.message_id,
      channelId: msg.channel_id,
      pollId: Number(pollId),
      votes,
    });
  });

  socket.on('poll:close', ({ pollId }) => {
    if (pollId == null) return;

    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    if (!poll || poll.closed) return;

    const msg = db.prepare('SELECT channel_id, user_id FROM messages WHERE id = ?').get(poll.message_id);
    if (!msg) return;
    const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(msg.channel_id);

    if (msg.user_id !== socket.userId && !isAdmin(channel.server_id, socket.userId)) return;

    db.prepare('UPDATE polls SET closed = 1 WHERE id = ?').run(pollId);

    io.to(`channel:${msg.channel_id}`).emit('poll:closed', {
      messageId: poll.message_id,
      channelId: msg.channel_id,
      pollId: Number(pollId),
    });
  });

  socket.on('reaction:toggle', ({ messageId, emoji }) => {
    if (!allow(socket.id, 'reaction:toggle', 10, 5000)) return; // 10 reactions per 5s
    if (!messageId || !emoji || typeof emoji !== 'string' || emoji.length > 64) return;
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) return;

    const existing = db.prepare(
      'SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
    ).get(messageId, socket.userId, emoji);

    if (existing) {
      db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
        .run(messageId, socket.userId, emoji);
    } else {
      db.prepare('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
        .run(messageId, socket.userId, emoji);
    }

    const reactions = getReactions(messageId);
    io.to(`channel:${message.channel_id}`).emit('reaction:updated', {
      messageId,
      channelId: message.channel_id,
      reactions,
    });
  });
}

module.exports = messageHandler;
