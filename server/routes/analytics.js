const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const router = express.Router();

// Max 60 page-view pings per minute per IP
const visitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// POST /api/analytics/visit — public, no auth required
router.post('/visit', visitLimiter, (req, res) => {
  const { path, userId } = req.body;
  if (!path || typeof path !== 'string') return res.status(400).json({ error: 'path required' });
  if (path.length > 500) return res.status(400).json({ error: 'path too long' });
  // Only accept numeric userId if provided
  const uid = userId && Number.isInteger(Number(userId)) ? Number(userId) : null;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;
  const ua = req.headers['user-agent']?.slice(0, 500) || null;
  try {
    db.prepare(
      'INSERT INTO page_visits (user_id, path, ip, user_agent) VALUES (?, ?, ?, ?)'
    ).run(uid, path, ip, ua);
  } catch {}
  res.json({ ok: true });
});

module.exports = router;
