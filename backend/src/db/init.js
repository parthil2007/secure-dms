import '../env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from '../db.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Create every table/index defined in schema.sql (idempotent). */
export async function initSchema() {
  const sql = fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  try {
    await initSchema();
    console.log('Schema created successfully.');
  } catch (err) {
    console.error('Schema creation failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
