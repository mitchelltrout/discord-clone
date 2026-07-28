function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  // Only surface the message for intentional client errors (4xx).
  // Server errors (5xx) get a generic response to avoid leaking internals.
  const message = status < 500 ? (err.message || 'Bad request') : 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
