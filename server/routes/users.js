const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

// GET /api/users/me
router.get('/me', auth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, avatar_url, status, status_message, bio, pronouns, location, banner_color FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PATCH /api/users/me — update username / avatar_url / status
router.patch('/me', auth, (req, res) => {
  const { username, avatar_url, status } = req.body;
  const validStatuses = ['online', 'idle', 'dnd', 'offline'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  if (username !== undefined) {
    if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
      return res.status(400).json({ error: 'Username must be 2–32 characters' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username may only contain letters, numbers, _, ., and -' });
    }
  }
  // Only allow server-managed upload paths; reject arbitrary external URLs
  if (avatar_url !== undefined && avatar_url !== null) {
    if (typeof avatar_url !== 'string' || !avatar_url.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Invalid avatar_url' });
    }
  }

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const newUsername = username || current.username;
  const newAvatar = avatar_url !== undefined ? avatar_url : current.avatar_url;
  const newStatus = status || current.status;

  if (username && username !== current.username) {
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (taken) return res.status(409).json({ error: 'Username already taken' });
  }

  db.prepare(
    'UPDATE users SET username = ?, avatar_url = ?, status = ? WHERE id = ?'
  ).run(newUsername, newAvatar, newStatus, req.user.id);

  const updated = db.prepare(
    'SELECT id, username, email, avatar_url, status, status_message FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json(updated);
});

// POST /api/users/me/avatar — upload avatar image
router.post('/me/avatar', auth, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);

  const updated = db.prepare(
    'SELECT id, username, email, avatar_url, status, status_message FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json(updated);
});

// PATCH /api/users/me/password — change password
router.patch('/me/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// PATCH /api/users/me/email — change email
router.patch('/me/email', auth, (req, res) => {
  const { email, currentPassword } = req.body;
  if (!email || !currentPassword)
    return res.status(400).json({ error: 'email and currentPassword are required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password is incorrect' });

  const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
  if (taken) return res.status(409).json({ error: 'Email already in use' });

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.user.id);
  const updated = db.prepare(
    'SELECT id, username, email, avatar_url, status, status_message FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json(updated);
});

// GET /api/users/:id/profile — public profile
router.get('/:id/profile', auth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, avatar_url, status, status_message, bio, pronouns, location, banner_color, created_at FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PATCH /api/users/me/profile — update profile fields
router.patch('/me/profile', auth, (req, res) => {
  const { bio, pronouns, location, banner_color } = req.body;

  if (bio !== undefined && typeof bio === 'string' && bio.length > 500)
    return res.status(400).json({ error: 'Bio must be 500 characters or fewer' });
  if (pronouns !== undefined && typeof pronouns === 'string' && pronouns.length > 40)
    return res.status(400).json({ error: 'Pronouns must be 40 characters or fewer' });
  if (location !== undefined && typeof location === 'string' && location.length > 100)
    return res.status(400).json({ error: 'Location must be 100 characters or fewer' });
  if (banner_color !== undefined && banner_color !== null && !/^#[0-9a-fA-F]{6}$/.test(banner_color))
    return res.status(400).json({ error: 'Invalid banner color' });

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  db.prepare(
    'UPDATE users SET bio = ?, pronouns = ?, location = ?, banner_color = ? WHERE id = ?'
  ).run(
    bio !== undefined ? (bio || null) : current.bio,
    pronouns !== undefined ? (pronouns || null) : current.pronouns,
    location !== undefined ? (location || null) : current.location,
    banner_color !== undefined ? (banner_color || null) : current.banner_color,
    req.user.id
  );

  const updated = db.prepare(
    'SELECT id, username, email, avatar_url, status, status_message, bio, pronouns, location, banner_color FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json(updated);
});

// GET /api/users/search?q=name (for finding users to DM)
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare(
    'SELECT id, username, avatar_url, status FROM users WHERE username LIKE ? AND id != ? LIMIT 10'
  ).all(`%${q}%`, req.user.id);
  res.json(users);
});

module.exports = router;
