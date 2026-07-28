const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function imageFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
}

// Both uploaders use memory storage so sharp can process before writing to disk
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Resize + convert to webp, then save to the given subdir
function makeResizeMiddleware(subdir, size) {
  const dir = path.join(UPLOADS_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  return async function resizeAndSave(req, res, next) {
    if (!req.file) return next();
    try {
      const filename = `${crypto.randomUUID()}.webp`;
      const dest = path.join(dir, filename);

      await sharp(req.file.buffer)
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .webp({ quality: 85 })
        .toFile(dest);

      // Mimic multer diskStorage's req.file shape
      req.file.filename = filename;
      req.file.path = dest;
      next();
    } catch (err) {
      next(err);
    }
  };
}

exports.avatarUpload = {
  single: (field) => [
    memoryUpload.single(field),
    makeResizeMiddleware('avatars', 128),
  ],
};

exports.serverIconUpload = {
  single: (field) => [
    memoryUpload.single(field),
    makeResizeMiddleware('servers', 128),
  ],
};
