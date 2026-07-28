// Usage: node db/make-admin.js <username>
// Grants admin access to the specified user.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const username = process.argv[2];
if (!username) {
  console.error('Usage: node db/make-admin.js <username>');
  process.exit(1);
}

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './db/app.db');
const db = new DatabaseSync(dbPath);

const user = db.prepare('SELECT id, username, is_admin FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`User "${username}" not found.`);
  process.exit(1);
}

if (user.is_admin) {
  console.log(`"${username}" is already an admin.`);
} else {
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  console.log(`"${username}" (id=${user.id}) has been granted admin access.`);
}

db.close();
