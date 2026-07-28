const db = require('../db/database');

function dmVoiceHandler(io, socket) {
  function isParticipant(conversationId) {
    return db.prepare(
      'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, socket.userId);
  }

  function getPartnerId(conversationId) {
    const row = db.prepare(
      'SELECT user_id FROM dm_participants WHERE conversation_id = ? AND user_id != ?'
    ).get(conversationId, socket.userId);
    return row?.user_id;
  }

  socket.on('dm:call', ({ conversationId }) => {
    if (!conversationId || !isParticipant(conversationId)) return;
    const partnerId = getPartnerId(conversationId);
    if (!partnerId) return;
    io.to(`user:${partnerId}`).emit('dm:incoming-call', {
      conversationId,
      callerId: socket.userId,
      callerUsername: socket.username,
    });
  });

  socket.on('dm:call-accept', ({ conversationId }) => {
    if (!conversationId || !isParticipant(conversationId)) return;
    const partnerId = getPartnerId(conversationId);
    if (!partnerId) return;
    io.to(`user:${partnerId}`).emit('dm:call-accepted', { conversationId });
  });

  socket.on('dm:call-decline', ({ conversationId }) => {
    if (!conversationId || !isParticipant(conversationId)) return;
    const partnerId = getPartnerId(conversationId);
    if (!partnerId) return;
    io.to(`user:${partnerId}`).emit('dm:call-declined', { conversationId });
  });

  socket.on('dm:call-cancel', ({ conversationId }) => {
    if (!conversationId || !isParticipant(conversationId)) return;
    const partnerId = getPartnerId(conversationId);
    if (!partnerId) return;
    io.to(`user:${partnerId}`).emit('dm:call-cancelled', { conversationId });
  });

  socket.on('dm:call-end', ({ conversationId }) => {
    if (!conversationId || !isParticipant(conversationId)) return;
    const partnerId = getPartnerId(conversationId);
    if (!partnerId) return;
    io.to(`user:${partnerId}`).emit('dm:call-ended', { conversationId });
  });
}

module.exports = dmVoiceHandler;
