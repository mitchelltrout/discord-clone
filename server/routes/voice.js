const express = require('express');
const db = require('../db/database');
const auth = require('../middleware/auth');
const voiceRooms = require('../socket/voiceRooms');

const router = express.Router();

// GET /api/voice/rooms — current voice participants for all active channels
router.get('/rooms', auth, (req, res) => {
  const result = {};
  voiceRooms.forEach((users, channelId) => {
    result[channelId] = Array.from(users).map((userId) =>
      db.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').get(userId)
    ).filter(Boolean);
  });
  res.json(result);
});

module.exports = router;
