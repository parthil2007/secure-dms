import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the backend/ directory (works regardless of cwd). */
export const BACKEND_ROOT = path.resolve(HERE, '..');

/** Absolute path where uploaded evidence files are stored. */
export const UPLOAD_ROOT = path.resolve(BACKEND_ROOT, process.env.UPLOAD_DIR || 'uploads');

export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 100);
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

export const PORT = Number(process.env.PORT || 5000);

/**
 * Built React app (frontend/dist). When present the API serves it, so
 * production is a single origin: one URL for the UI *and* /api.
 */
export const FRONTEND_DIST = path.resolve(BACKEND_ROOT, '..', 'frontend', 'dist');
