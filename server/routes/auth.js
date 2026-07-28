const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const auth = require('../middleware/auth');
const { logEvent } = require('../utils/audit');

const router = express.Router();

// 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// 5 registrations per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this IP. Please try again later.' },
});

// POST /api/auth/register
router.post('/register', registerLimiter, (req, res) => {
  const regOpen = db.prepare("SELECT value FROM site_settings WHERE key = 'registration_open'").get();
  const regMode = regOpen?.value ?? '1';

  if (regMode === '0') {
    return res.status(403).json({ error: 'Registration is currently closed.' });
  }

  const { username, email, password, invite_code } = req.body;

  if (regMode === 'invite') {
    if (!invite_code || typeof invite_code !== 'string') {
      return res.status(403).json({ error: 'An invite code is required to register.' });
    }
    const server = db.prepare('SELECT id FROM servers WHERE invite_code = ?').get(invite_code.trim());
    if (!server) {
      return res.status(403).json({ error: 'Invalid invite code.' });
    }
  }
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be 2–32 characters' });
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _, ., and -' });
  }
  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  // Cap password length to prevent bcrypt DoS (bcrypt silently truncates at 72 bytes anyway,
  // but a huge string still wastes CPU before that)
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password must be 128 characters or fewer' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
  ).run(username, email, hash);

  const userId = result.lastInsertRowid;

  const accessToken = signAccess({ id: userId, username });
  const refreshToken = signRefresh({ id: userId });
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, refreshToken, expiresAt);
  logEvent(userId, 'register', req);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: {
      id: userId,
      username,
      email,
      avatar_url: null,
      status: 'online',
      is_admin: 0,
      status_message: '',
      bio: null,
      pronouns: null,
      location: null,
      banner_color: null,
    },
  });
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (typeof password !== 'string' || password.length > 128) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Update status to online
  db.prepare("UPDATE users SET status = 'online' WHERE id = ?").run(user.id);

  const accessToken = signAccess({ id: user.id, username: user.username });
  const refreshToken = signRefresh({ id: user.id });
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, refreshToken, expiresAt);
  logEvent(user.id, 'login', req);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      status: 'online',
      is_admin: user.is_admin,
      status_message: user.status_message || '',
      bio: user.bio || null,
      pronouns: user.pronouns || null,
      location: user.location || null,
      banner_color: user.banner_color || null,
    },
  });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
  if (!stored || stored.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const newAccessToken = signAccess({ id: user.id, username: user.username });
  res.json({ accessToken: newAccessToken });
});

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }
  db.prepare("UPDATE users SET status = 'offline' WHERE id = ?").run(req.user.id);
  logEvent(req.user.id, 'logout', req);
  res.json({ ok: true });
});

module.exports = router;
