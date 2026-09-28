import './env.js';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';

import { UPLOAD_ROOT, PORT, FRONTEND_DIST } from './config.js';
import { pool } from './db.js';
import { initSchema } from './db/init.js';
import { seed } from './db/seed.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import caseRoutes from './routes/cases.js';
import documentRoutes from './routes/documents.js';
import searchRoutes from './routes/search.js';
import shareRoutes from './routes/shares.js';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import integrityRoutes from './routes/integrity.js';

const app = express();

// Render/Heroku-style platforms terminate TLS for us.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(compression()); // the React bundle is ~824 kB raw / ~226 kB gzipped
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT, { dotfiles: 'deny', index: false }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'secure-dms-api', time: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', caseRoutes);
app.use('/api', documentRoutes);
app.use('/api', searchRoutes);
app.use('/api', shareRoutes);
app.use('/api', auditRoutes);
app.use('/api', reportRoutes);
app.use('/api', userRoutes);
app.use('/api', adminRoutes);
app.use('/api', integrityRoutes);

/* ---------------------------------------------------------------------------
 * Production: serve the built React app from the same origin.
 *
 * frontend/dist exists after `npm run build`, so one deployment hosts both the
 * UI and /api — no CORS, no second URL. In dev (no dist yet) this is skipped
 * and Vite serves the UI on :5173 as usual.
 * ------------------------------------------------------------------------- */
const indexHtml = path.join(FRONTEND_DIST, 'index.html');
const hasFrontend = fs.existsSync(indexHtml);

if (hasFrontend) {
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      setHeaders(res, filePath) {
        const name = path.basename(filePath);
        if (name === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.[0-9a-z]{8,}\./i.test(name)) {
          // Vite fingerprints assets (index-CbKBbpbQ.js) — safe to cache forever
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    })
  );
}

// SPA fallback: every non-API GET renders index.html so client-side routes
// (/documents/12, /cases/3 …) survive a hard refresh or a direct link.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/uploads')) return next();
  if (!hasFrontend) return next();
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexHtml);
});

// JSON 404 for anything the API did not handle.
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler (multer errors, validation, unexpected failures).
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  const message = err.message || 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

/* ---------------------------------------------------------------------------
 * Database bootstrap — makes first deploy a zero-step process.
 *   initSchema()  is idempotent (IF NOT EXISTS), safe on every boot
 *   seed()        only runs when the users table is empty
 * Set AUTO_INIT_DB=false / AUTO_SEED=false to opt out.
 * ------------------------------------------------------------------------- */
async function bootstrapDatabase() {
  const attempts = 5;
  for (let i = 1; i <= attempts; i++) {
    try {
      if (process.env.AUTO_INIT_DB !== 'false') {
        await initSchema();
        console.log('Database schema ready.');
      }
      if (process.env.AUTO_SEED !== 'false') {
        const res = await pool.query('SELECT COUNT(*)::int AS n FROM users');
        if (res.rows[0].n === 0) {
          console.log('Empty database — loading demo data…');
          await seed();
        }
      }
      return;
    } catch (err) {
      console.error(`Database bootstrap attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error(
    'Giving up on database bootstrap — the API will return 500s until the database is reachable.'
  );
}

await bootstrapDatabase();

app.listen(PORT, () => {
  console.log(`SecureDMS API listening on http://localhost:${PORT}`);
  console.log(hasFrontend ? `Serving dashboard from ${FRONTEND_DIST}` : 'No frontend build found (dev mode)');
});
