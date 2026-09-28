import { query } from '../db.js';

/**
 * Generate a sequential, human-readable reference such as
 * `EVD-2026-00001`. Uses a Postgres sequence so numbers are unique
 * even under concurrent uploads.
 */
export async function nextLabel(prefix, sequenceName) {
  const res = await query(
    `SELECT $1 || '-' || to_char(NOW(), 'YYYY') || '-' ||
            LPAD(nextval($2::regclass)::text, 5, '0') AS label`,
    [prefix, sequenceName]
  );
  return res.rows[0].label;
}

/** Prefix used for each document type when minting a doc number. */
const PREFIXES = {
  evidence: 'EVD',
  court_order: 'CTR',
  legal_filing: 'LGL',
  statement: 'STM',
  report: 'RPT',
  photo: 'PHO',
  video: 'VID',
  audio: 'AUD',
  correspondence: 'COR',
  other: 'DOC',
};

export function docPrefix(docType) {
  return PREFIXES[docType] || 'DOC';
}
