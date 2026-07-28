const { verifyAccess } = require('../utils/jwt');
const db = require('../db/database');

function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = payload;
  next();
}

module.exports = adminAuth;
