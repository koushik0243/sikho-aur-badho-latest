import jwt from 'jsonwebtoken';
import express from 'express';
import path from 'path';

// Course content under /uploads is not public: lesson videos, lesson images,
// assignment files and course intro videos are only served with a valid,
// short-lived media token. <video>/<img> tags can't send an Authorization
// header, so the token travels as ?mt=… on the file URL. A copied link stops
// working when its token expires, and nothing is served to logged-out users.
// Course thumbnails, category images and organization logos stay public.

export const MEDIA_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const MEDIA_TOKEN_PURPOSE = 'media';

export const PROTECTED_UPLOAD_PREFIXES = [
  '/lesson-videos/',
  '/lesson-images/',
  '/assignments/',
  '/courses/videos/',
];

// Lower-cased: on Windows (and other case-insensitive disks) /Lesson-Videos/ is the same folder.
const isProtectedPath = (p) => PROTECTED_UPLOAD_PREFIXES.some(prefix => p.toLowerCase().startsWith(prefix));

/** Signs a media token for a logged-in user (req.user from `protect`). */
export function signMediaToken(user) {
  return jwt.sign(
    { _id: user?._id, purpose: MEDIA_TOKEN_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: MEDIA_TOKEN_TTL_SECONDS }
  );
}

function hasValidMediaAccess(req) {
  const fromQuery = typeof req.query?.mt === 'string' ? req.query.mt : null;
  const auth = req.headers.authorization;
  const fromHeader = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  for (const token of [fromQuery, fromHeader]) {
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // A media token, or a normal login token sent as a header (e.g. fetch()).
      if (decoded && (decoded.purpose === MEDIA_TOKEN_PURPOSE || token === fromHeader)) return true;
    } catch { /* invalid or expired — try the next one */ }
  }
  return false;
}

/**
 * Like `protect`, for media endpoints a <video> tag plays directly: accepts the login
 * token as a Bearer header, or a media token as ?mt=… . Sets req.user = { _id }.
 */
export function mediaProtect(req, res, next) {
  const fromQuery = typeof req.query?.mt === 'string' ? req.query.mt : null;
  const auth = req.headers.authorization;
  const fromHeader = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  for (const token of [fromHeader, fromQuery]) {
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // A query token must be a media token (never a full login token in a URL).
      if (token === fromQuery && decoded?.purpose !== MEDIA_TOKEN_PURPOSE) continue;
      if (!decoded?._id) continue;
      req.user = { _id: decoded._id };
      return next();
    } catch { /* invalid or expired — try the next one */ }
  }
  return res.status(401).json({ status: 401, message: 'Not authorized to access this file.' });
}

/** Blocks protected /uploads paths unless the request carries a valid token. */
export function guardUploads(req, res, next) {
  // req.path is relative to the /uploads mount. Decode and normalise it the way
  // the static server will (%2F, "..", "//", "\\") so nothing slips past the prefix check.
  let p;
  try { p = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')); } catch { return res.status(400).end(); }
  if (!isProtectedPath(p)) return next();
  if (!hasValidMediaAccess(req)) {
    return res.status(401).json({ status: 401, message: 'Not authorized to access this file.' });
  }
  // Content may be shown inline but never cached by shared caches or offered as a download.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return next();
}

// GET /media/token (behind `protect`) → a fresh media token for this user.
export const mediaTokenRouter = express.Router();
mediaTokenRouter.get('/token', (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'Success.',
    data: { token: signMediaToken(req.user), expiresIn: MEDIA_TOKEN_TTL_SECONDS },
  });
});
