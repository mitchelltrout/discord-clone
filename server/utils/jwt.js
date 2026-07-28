const jwt = require('jsonwebtoken');
require('dotenv').config();

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
  });
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
  });
}

function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
