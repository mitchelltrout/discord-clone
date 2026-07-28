const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const router = express.Router();

const inviteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/invites/:code — public preview (no auth required)
router.get('/:code', inviteLimiter, (req, res) => {
  const server = db.prepare(
    'SELECT id, name, icon_url FROM servers WHERE invite_code = ?'
  ).get(req.params.code);
  if (!server) return res.status(404).json({ error: 'Invalid invite code' });

  const memberCount = db.prepare(
    'SELECT COUNT(*) as count FROM server_members WHERE server_id = ?'
  ).get(server.id).count;

  res.json({ ...server, memberCount });
});

module.exports = router;
