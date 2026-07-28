const db = require('../db/database');

function logEvent(userId, eventType, req) {
  const ip = (req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req?.ip || null;
  const userAgent = req?.headers?.['user-agent'] || null;
  try {
    db.prepare(
      'INSERT INTO user_events (user_id, event_type, ip, user_agent) VALUES (?, ?, ?, ?)'
    ).run(userId ?? null, eventType, ip, userAgent);
  } catch {}
}

module.exports = { logEvent };
