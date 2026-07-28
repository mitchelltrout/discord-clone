/**
 * Simple per-socket rate limiter for Socket.io event handlers.
 * Tracks hit counts per (socketId, key) and resets on a rolling window.
 */

// Map<socketId, Map<key, { count, windowStart }>>
const state = new Map();

/**
 * Returns true if the socket is within its rate limit for the given key.
 * @param {string} socketId
 * @param {string} key      - event name or arbitrary bucket
 * @param {number} limit    - max hits per window
 * @param {number} windowMs - window duration in milliseconds
 */
function allow(socketId, key, limit, windowMs) {
  const now = Date.now();
  if (!state.has(socketId)) state.set(socketId, new Map());
  const socketState = state.get(socketId);

  const entry = socketState.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    socketState.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Clean up state for a socket on disconnect to prevent memory leaks.
 */
function cleanup(socketId) {
  state.delete(socketId);
}

module.exports = { allow, cleanup };
