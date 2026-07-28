const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 24;
const RATING = 'g';

function mapGif(g) {
  return {
    id: g.id,
    title: g.title,
    preview: g.images.fixed_height_small?.url || g.images.fixed_height?.url,
    url: g.images.fixed_height?.url || g.images.original?.url,
  };
}

// GET /api/giphy/trending
router.get('/trending', auth, async (_req, res) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return res.status(503).json({ error: 'GIF search not configured' });
  try {
    const r = await fetch(`${GIPHY_BASE}/trending?api_key=${key}&limit=${LIMIT}&rating=${RATING}`);
    const json = await r.json();
    res.json((json.data || []).map(mapGif));
  } catch {
    res.status(502).json({ error: 'Failed to fetch GIFs' });
  }
});

// GET /api/giphy/search?q=cats
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const key = process.env.GIPHY_API_KEY;
  if (!key) return res.status(503).json({ error: 'GIF search not configured' });
  try {
    const r = await fetch(`${GIPHY_BASE}/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${LIMIT}&rating=${RATING}`);
    const json = await r.json();
    res.json((json.data || []).map(mapGif));
  } catch {
    res.status(502).json({ error: 'Failed to fetch GIFs' });
  }
});

module.exports = router;
