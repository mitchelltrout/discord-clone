require('dotenv').config();

// Prepend timestamps to all console output
(['log', 'info', 'warn', 'error']).forEach((method) => {
  const orig = console[method].bind(console);
  console[method] = (...args) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    orig(`[${ts}]`, ...args);
  };
});
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const serversRoutes = require('./routes/servers');
const channelsRoutes = require('./routes/channels');
const messagesRoutes = require('./routes/messages');
const dmRoutes = require('./routes/dm');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./socket');

// Ensure upload directories exist
['uploads/avatars', 'uploads/servers'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',').map((o) => o.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/users', usersRoutes);
app.use('/api/invites', require('./routes/invites'));
app.use('/api/servers', serversRoutes);
app.use('/api', channelsRoutes);
app.use('/api', messagesRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/voice', require('./routes/voice'));
app.use('/api/giphy', require('./routes/giphy'));
app.use('/api/link-preview', require('./routes/linkpreview'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public config endpoint — no auth required
app.get('/api/config', (_req, res) => {
  const db = require('./db/database');
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    registration_open: s.registration_open !== '0',
    registration_mode: s.registration_open ?? '1', // '1', '0', or 'invite'
    system_message: s.system_message || '',
  });
});

app.use(errorHandler);

setupSocket(io);
require('./io').setIo(io);

// Reset all statuses to offline on startup — prevents stale "online" from a previous crash/restart
const db = require('./db/database');
db.prepare("UPDATE users SET status = 'offline'").run();

// Ensure Steve 2.0 bot user exists
db.prepare(
  "INSERT OR IGNORE INTO users (username, email, password, is_bot) VALUES ('Steve 2.0', 'steve2@bot.local', 'NOT_A_REAL_HASH', 1)"
).run();

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
