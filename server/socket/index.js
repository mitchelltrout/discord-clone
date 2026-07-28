const { verifyAccess } = require('../utils/jwt');
const db = require('../db/database');
const messageHandler = require('./messageHandler');
const dmHandler = require('./dmHandler');
const voiceHandler = require('./voiceHandler');
const { cleanupAfkIfEmpty, getRoomUsers } = voiceHandler;
const dmVoiceHandler = require('./dmVoiceHandler');
const canvasHandler = require('./canvasHandler');
const voiceRooms = require('./voiceRooms');
const { cleanup: rlCleanup } = require('../utils/socketRateLimit');

function setupSocket(io) {
  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccess(token);
      socket.userId = payload.id;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Only log the first socket for this user
    const existingCount = [...io.sockets.sockets.values()].filter(
      (s) => s.userId === socket.userId && s.id !== socket.id
    ).length;
    if (existingCount === 0) {
      console.log(`User ${socket.username} (${socket.userId}) connected`);
    }

    // Join personal room for targeted events
    socket.join(`user:${socket.userId}`);

    // Update status to online
    db.prepare("UPDATE users SET status = 'online' WHERE id = ?").run(socket.userId);
    socket.broadcast.emit('status:update', { userId: socket.userId, status: 'online' });

    // ── Channel rooms ──────────────────────────────────────
    socket.on('channel:join', ({ channelId }) => {
      // Verify user is a member of the server that owns this channel
      const channel = db.prepare(
        'SELECT server_id FROM channels WHERE id = ?'
      ).get(channelId);
      if (!channel) return;
      const member = db.prepare(
        'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(channel.server_id, socket.userId);
      if (!member) return;
      socket.join(`channel:${channelId}`);
    });

    socket.on('channel:leave', ({ channelId }) => {
      socket.leave(`channel:${channelId}`);
    });

    // ── Text messaging ─────────────────────────────────────
    messageHandler(io, socket);

    // ── Direct messages ────────────────────────────────────
    dmHandler(io, socket);

    // ── Voice/Video ────────────────────────────────────────
    voiceHandler(io, socket);
    dmVoiceHandler(io, socket);

    // ── Canvas ─────────────────────────────────────────────
    canvasHandler(io, socket);

    // ── Server / channel rename broadcasts ─────────
    socket.on('server:renamed', ({ serverId, name }) => {
      // Only broadcast if the user is actually an admin of this server
      const membership = db.prepare(
        "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?"
      ).get(serverId, socket.userId);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) return;
      socket.broadcast.emit('server:renamed', { serverId, name });
    });

    socket.on('channel:renamed', ({ serverId, channelId, name }) => {
      // Only broadcast if the user is actually an admin of this server
      const membership = db.prepare(
        "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?"
      ).get(serverId, socket.userId);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) return;
      socket.broadcast.emit('channel:renamed', { serverId, channelId, name });
    });

    // ── Status ─────────────────────────────────────────────
    socket.on('status:set', ({ status, statusMessage }) => {
      const valid = ['online', 'idle', 'dnd', 'offline'];
      if (!valid.includes(status)) return;
      const msg = typeof statusMessage === 'string' ? statusMessage.slice(0, 128).trim() : '';
      db.prepare('UPDATE users SET status = ?, status_message = ? WHERE id = ?').run(status, msg, socket.userId);
      io.emit('status:update', { userId: socket.userId, status, statusMessage: msg });
    });

    // ── Disconnect ─────────────────────────────────────────
    socket.on('disconnect', () => {
      rlCleanup(socket.id);

      // Leave all voice rooms
      voiceRooms.forEach((users, channelId) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          if (users.size === 0) voiceRooms.delete(channelId);
          io.to(`voice:${channelId}`).emit('voice:user-left', {
            channelId,
            userId: socket.userId,
          });
          io.emit('voice:room-updated', { channelId, users: getRoomUsers(channelId) });
          cleanupAfkIfEmpty(io, channelId);
        }
      });

      // Set status offline only if user has no other active sockets
      const hasOther = [...io.sockets.sockets.values()].some(
        (s) => s.userId === socket.userId && s.id !== socket.id
      );
      if (!hasOther) {
        console.log(`User ${socket.username} (${socket.userId}) disconnected`);
        db.prepare("UPDATE users SET status = 'offline' WHERE id = ?").run(socket.userId);
        io.emit('status:update', { userId: socket.userId, status: 'offline' });
      }
    });
  });
}

module.exports = setupSocket;
