const db = require('../db/database');
const { isMember, isAdmin } = require('../utils/permissions');
const { allow } = require('../utils/socketRateLimit');

// Valid CSS color formats: #rgb, #rrggbb, #rgba, #rrggbbaa, rgb(...), rgba(...), hsl(...), hsla(...)
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d+%?,\s*\d+%?,\s*\d+%?(,\s*[\d.]+)?\s*\)|hsla?\(\s*[\d.]+,\s*\d+%,\s*\d+%(,\s*[\d.]+)?\s*\))$/i;
const MAX_POINTS = 500;
const MAX_STROKES_PER_CHANNEL = 5000;

function isValidPoint(pt) {
  return (
    Array.isArray(pt) &&
    pt.length === 2 &&
    typeof pt[0] === 'number' && isFinite(pt[0]) && pt[0] >= 0 && pt[0] <= 2000 &&
    typeof pt[1] === 'number' && isFinite(pt[1]) && pt[1] >= 0 && pt[1] <= 1125
  );
}

function canvasHandler(io, socket) {
  socket.on('canvas:join', ({ channelId }) => {
    const channel = db.prepare('SELECT server_id, type FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'canvas') return;
    if (!isMember(channel.server_id, socket.userId)) return;
    socket.join(`canvas:${channelId}`);
  });

  socket.on('canvas:stroke', ({ channelId, stroke }) => {
    if (!allow(socket.id, 'canvas:stroke', 30, 5000)) return; // 30 strokes per 5s

    if (!channelId || !stroke) return;

    // Validate stroke shape
    if (
      !Array.isArray(stroke.points) ||
      stroke.points.length < 2 ||
      stroke.points.length > MAX_POINTS ||
      typeof stroke.color !== 'string' ||
      !COLOR_RE.test(stroke.color) ||
      typeof stroke.width !== 'number' ||
      stroke.width < 1 ||
      stroke.width > 80 ||
      !['pen', 'eraser'].includes(stroke.tool)
    ) return;

    // Validate every individual point is a finite coordinate within canvas bounds
    if (!stroke.points.every(isValidPoint)) return;

    const channel = db.prepare('SELECT server_id, type FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'canvas') return;
    if (!isMember(channel.server_id, socket.userId)) return;

    const strokeData = JSON.stringify({
      points: stroke.points,
      color: stroke.color,
      width: stroke.width,
      tool: stroke.tool,
    });

    // Enforce per-channel stroke cap to prevent unbounded DB growth
    const count = db.prepare('SELECT COUNT(*) AS n FROM canvas_strokes WHERE channel_id = ?').get(channelId).n;
    if (count >= MAX_STROKES_PER_CHANNEL) return;

    const result = db.prepare(
      'INSERT INTO canvas_strokes (channel_id, user_id, stroke_data) VALUES (?, ?, ?)'
    ).run(channelId, socket.userId, strokeData);

    // Broadcast to others only — sender already added it optimistically
    socket.to(`canvas:${channelId}`).emit('canvas:stroke', {
      channelId,
      strokeId: result.lastInsertRowid,
      userId: socket.userId,
      username: socket.username,
      stroke,
    });
  });

  socket.on('canvas:clear', ({ channelId }) => {
    const channel = db.prepare('SELECT server_id, type FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'canvas') return;
    if (!isAdmin(channel.server_id, socket.userId)) return;

    db.prepare('DELETE FROM canvas_strokes WHERE channel_id = ?').run(channelId);

    // Broadcast to others — sender clears locally immediately on click
    socket.to(`canvas:${channelId}`).emit('canvas:cleared', { channelId });
  });
}

module.exports = canvasHandler;
