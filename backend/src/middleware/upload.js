import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { UPLOAD_ROOT, MAX_FILE_SIZE } from '../config.js';

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_ROOT);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).slice(0, 12);
    const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const ALLOWED_MIME = new Set([
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'text/plain',
  'text/csv',
  'text/rtf',
  'application/rtf',
  'application/json',
  'application/xml',
  'text/xml',
  // images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/heic',
  // audio / video (digital evidence)
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/mpeg',
  // archives & forensic images
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/gzip',
  'application/x-tar',
  'application/octet-stream',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.scr', '.msi', '.ps1', '.vbs', '.js', '.jar',
]);

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Executable file type "${ext}" is not permitted`));
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`File type "${file.mimetype}" is not permitted`));
    }
    cb(null, true);
  },
});

/** Remove a stored file, ignoring missing files. */
export function removeStoredFile(relativeName) {
  if (!relativeName) return;
  const full = path.resolve(UPLOAD_ROOT, path.basename(relativeName));
  if (!full.startsWith(UPLOAD_ROOT)) return;
  fs.promises.unlink(full).catch(() => {});
}
