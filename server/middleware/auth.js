const { verifyAccess } = require('../utils/jwt');
const db = require('../db/database');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccess(token);
    // Verify the user still exists (catches deleted accounts within the TTL window)
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
