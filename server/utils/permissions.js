const db = require('../db/database');

function getMemberRole(serverId, userId) {
  const member = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(serverId, userId);
  return member ? member.role : null;
}

function isAdmin(serverId, userId) {
  const role = getMemberRole(serverId, userId);
  return role === 'owner' || role === 'admin';
}

function isMember(serverId, userId) {
  return getMemberRole(serverId, userId) !== null;
}

module.exports = { getMemberRole, isAdmin, isMember };
