import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load configuration from backend/.env no matter where the process was started.
 *
 * `import 'dotenv/config'` resolves .env against `process.cwd()`, which breaks
 * as soon as the API is launched from the repo root (`npm start` at the top
 * level) — the file lives in backend/, so DATABASE_URL/JWT_SECRET silently go
 * missing. Resolving against this module's own location removes that trap.
 *
 * Precedence (highest first):
 *   1. real process environment  (Render/K8s/`$env:X = ...`)
 *   2. backend/.env
 *   3. <repo root>/.env          (optional, only fills keys the others lack)
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
dotenv.config({ path: path.join(BACKEND_ROOT, '..', '.env') });

export { BACKEND_ROOT };
