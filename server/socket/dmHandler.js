const db = require('../db/database');
const { maybeRespondDM } = require('../fakesteve');
const { allow } = require('../utils/socketRateLimit');

function dmHandler(io, socket) {
  socket.on('dm:join', ({ conversationId }) => {
    const isMember = db.prepare(
      'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, socket.userId);
    if (!isMember) return;
    socket.join(`dm:${conversationId}`);
  });

  socket.on('dm:send', ({ conversationId, content }) => {
    if (!allow(socket.id, 'dm:send', 5, 5000)) return; // 5 messages per 5s
    if (!conversationId || !content?.trim()) return;
    if (typeof content !== 'string' || content.trim().length > 2000) return;

    const isMember = db.prepare(
      'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, socket.userId);
    if (!isMember) return;

    const result = db.prepare(
      'INSERT INTO dm_messages (conversation_id, user_id, content) VALUES (?, ?, ?)'
    ).run(conversationId, socket.userId, content.trim());

    const message = db.prepare(`
      SELECT m.*, u.username, u.avatar_url
      FROM dm_messages m JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    // Emit to the DM room and also to each participant's personal room
    io.to(`dm:${conversationId}`).emit('dm:new', { message, conversationId });

    // Also notify participants who aren't in the DM view
    const participants = db.prepare(
      'SELECT user_id FROM dm_participants WHERE conversation_id = ?'
    ).all(conversationId);

    participants.forEach(({ user_id }) => {
      io.to(`user:${user_id}`).emit('dm:notification', {
        conversationId,
        message,
      });
    });

    maybeRespondDM(conversationId, socket.userId);
  });
}

module.exports = dmHandler;
