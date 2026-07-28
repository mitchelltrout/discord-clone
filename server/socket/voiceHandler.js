const db = require('../db/database');
const { isMember } = require('../utils/permissions');
const voiceRooms = require('./voiceRooms');
const afkChannels = require('./afkChannels');

function getRoomUsers(channelId) {
  const userIds = Array.from(voiceRooms.get(channelId) || []);
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(',');
  return db.prepare(
    `SELECT id, username, avatar_url FROM users WHERE id IN (${placeholders})`
  ).all(...userIds);
}

function isServerChannel(channelId) {
  return !String(channelId).startsWith('dm-');
}

// Call after a user leaves a channel — deletes AFK channel from DB if it's now empty
function cleanupAfkIfEmpty(io, channelId) {
  if (!isServerChannel(channelId)) return;
  const room = voiceRooms.get(channelId);
  if (room && room.size > 0) return;

  for (const [serverId, afkId] of afkChannels) {
    if (afkId == channelId) {
      afkChannels.delete(serverId);
      db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
      const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(serverId);
      members.forEach(({ user_id }) => {
        io.to(`user:${user_id}`).emit('channel:removed', { serverId, channelId });
      });
      break;
    }
  }
}

function voiceHandler(io, socket) {
  socket.on('voice:join', ({ channelId }) => {
    if (!channelId) return;

    // For server voice channels, verify the user is a member of that server
    if (isServerChannel(channelId)) {
      const channelRow = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(channelId);
      if (!channelRow || !isMember(channelRow.server_id, socket.userId)) return;
    }

    // Leave any previous voice channel
    voiceRooms.forEach((users, cId) => {
      if (users.has(socket.userId) && cId !== channelId) {
        users.delete(socket.userId);
        socket.leave(`voice:${cId}`);
        io.to(`voice:${cId}`).emit('voice:user-left', { channelId: cId, userId: socket.userId });
        io.emit('voice:room-updated', { channelId: cId, users: getRoomUsers(cId) });
        cleanupAfkIfEmpty(io, cId);
      }
    });

    // Join the new voice channel
    if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Set());
    voiceRooms.get(channelId).add(socket.userId);
    socket.join(`voice:${channelId}`);

    // Tell the new joiner who's already in the room
    const participants = Array.from(voiceRooms.get(channelId)).filter((id) => id !== socket.userId);
    const channelRow = isServerChannel(channelId)
      ? db.prepare('SELECT server_id FROM channels WHERE id = ?').get(channelId)
      : null;
    const isAfk = channelRow ? afkChannels.get(channelRow.server_id) == channelId : false;
    socket.emit('voice:participants', { channelId, userIds: participants, isAfk });

    // Tell everyone else that this user joined
    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      channelId,
      userId: socket.userId,
    });

    // Broadcast updated room state to all clients (for sidebar)
    io.emit('voice:room-updated', { channelId, users: getRoomUsers(channelId) });
  });

  socket.on('voice:leave', ({ channelId }) => {
    if (!channelId) return;
    const room = voiceRooms.get(channelId);
    if (room) {
      room.delete(socket.userId);
      if (room.size === 0) voiceRooms.delete(channelId);
    }
    socket.leave(`voice:${channelId}`);
    io.to(`voice:${channelId}`).emit('voice:user-left', { channelId, userId: socket.userId });
    io.emit('voice:room-updated', { channelId, users: getRoomUsers(channelId) });
    cleanupAfkIfEmpty(io, channelId);
  });

  // Relay mute/cam/screen state to others in the same voice channel
  socket.on('voice:state-update', ({ channelId, isMuted, isCamOn, isScreenSharing, isDeafened }) => {
    if (!channelId) return;
    socket.to(`voice:${channelId}`).emit('voice:state-update', {
      channelId,
      userId: socket.userId,
      isMuted,
      isCamOn,
      isScreenSharing,
      isDeafened,
    });
  });

  // Forward WebRTC signals between peers
  socket.on('voice:signal', ({ channelId, targetUserId, signal }) => {
    // Verify both sender and target are in the same voice channel
    const room = voiceRooms.get(channelId);
    if (!room || !room.has(socket.userId) || !room.has(targetUserId)) return;

    const targetSockets = [];
    io.sockets.sockets.forEach((s) => {
      if (s.userId === targetUserId) targetSockets.push(s);
    });
    targetSockets.forEach((s) => {
      s.emit('voice:signal', { fromUserId: socket.userId, signal });
    });
  });

  // Client reports the user has been idle for 30 minutes in a server voice channel
  socket.on('voice:afk', () => {
    // Find which server voice channel this user is currently in
    let currentChannelId = null;
    for (const [channelId, users] of voiceRooms) {
      if (isServerChannel(channelId) && users.has(socket.userId)) {
        currentChannelId = channelId;
        break;
      }
    }
    if (!currentChannelId) return;

    const channelRow = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(currentChannelId);
    if (!channelRow) return;
    const serverId = channelRow.server_id;

    // Already in the AFK channel — nothing to do
    if (afkChannels.get(serverId) == currentChannelId) return;

    // Get or create the AFK channel
    let afkChannelId = afkChannels.get(serverId);
    if (!afkChannelId) {
      const result = db.prepare(
        'INSERT INTO channels (server_id, name, type, position) VALUES (?, ?, ?, ?)'
      ).run(serverId, 'AFK', 'voice', 9999);
      afkChannelId = result.lastInsertRowid;
      afkChannels.set(serverId, afkChannelId);

      // Tell all server members to add the channel to their sidebar
      const newChannel = db.prepare('SELECT * FROM channels WHERE id = ?').get(afkChannelId);
      const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(serverId);
      members.forEach(({ user_id }) => {
        io.to(`user:${user_id}`).emit('channel:added', { serverId, channel: newChannel });
      });
    }

    // Tell the client to move to AFK
    socket.emit('voice:move-to-afk', { channelId: afkChannelId, serverId });
  });
}

module.exports = voiceHandler;
module.exports.cleanupAfkIfEmpty = cleanupAfkIfEmpty;
module.exports.getRoomUsers = getRoomUsers;
