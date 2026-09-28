import './env.js';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

/**
 * Hosted Postgres (Render, Neon, Supabase…) requires TLS. We turn it on
 * whenever the connection string is not pointing at a local machine, or when
 * `sslmode=require` / PGSSLMODE says so. `rejectUnauthorized: false` is the
 * documented setting for these providers (their CA is not in Node's bundle).
 */
function buildSslConfig(url) {
  if (!url) return undefined;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(hostname);
  const requested =
    /[?&]sslmode=require/.test(url) ||
    process.env.PGSSLMODE === 'require' ||
    process.env.PGSSL === 'true';
  if (local && !requested) return undefined;
  if (!local || requested) return { rejectUnauthorized: false };
  return undefined;
}

export const pool = new Pool({
  connectionString,
  ssl: buildSslConfig(connectionString),
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/** Run a parameterised query and return the pg result. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Run a query expected to return at most one row (or null). */
export async function one(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] ?? null;
}

/** Run a query and return its rows array. */
export async function rows(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

/** Run work inside a transaction; rolls back on throw. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
