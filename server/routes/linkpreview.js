const express = require('express');
const auth = require('../middleware/auth');
const ogs = require('open-graph-scraper');
const dns = require('dns').promises;
const net = require('net');

const router = express.Router();

// Simple in-memory cache: url -> { data, ts }
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Returns true if the IP is a private/reserved address
function isPrivateIp(ip) {
  // Handle IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1)
  const addr = ip.replace(/^::ffff:/, '');
  if (net.isIPv4(addr)) {
    const parts = addr.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) // link-local / AWS metadata
    );
  }
  // IPv6 loopback and link-local
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

// GET /api/link-preview?url=...
router.get('/', auth, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'invalid url' }); }

  // Only allow http/https — block file://, ftp://, etc.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'invalid url' });
  }

  // Block requests to private/internal networks (SSRF prevention)
  // Resolve the hostname first so we can check the actual IP
  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return res.status(400).json({ error: 'invalid url' });
      }
    }
  } catch {
    return res.status(422).json({ error: 'could not fetch preview' });
  }

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const { result } = await ogs({
      url,
      fetchOptions: { headers: { 'user-agent': 'Mozilla/5.0 (compatible; bot)' } },
      timeout: 5000,
    });

    const data = {
      title: result.ogTitle || result.twitterTitle || null,
      description: result.ogDescription || result.twitterDescription || null,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || null,
      siteName: result.ogSiteName || null,
      url,
    };

    cache.set(url, { data, ts: Date.now() });
    res.json(data);
  } catch {
    res.status(422).json({ error: 'could not fetch preview' });
  }
});

module.exports = router;
