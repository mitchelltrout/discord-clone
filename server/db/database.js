const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './db/app.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

// Migrations for columns added after initial schema
try { db.exec("ALTER TABLE users ADD COLUMN status_message TEXT NOT NULL DEFAULT ''"); } catch {}

module.exports = db;
