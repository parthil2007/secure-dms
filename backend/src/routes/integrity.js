import { Router } from 'express';
import fs from 'node:fs';
import { rows } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sha256File, computeChainHash, GENESIS_HASH } from '../lib/hash.js';
import { toNumber } from '../lib/serialize.js';
import { UPLOAD_ROOT } from '../config.js';
import path from 'node:path';

const router = Router();

function resolveStored(storedName) {
  if (!storedName) return null;
  const full = path.resolve(UPLOAD_ROOT, path.basename(storedName));
  return full.startsWith(UPLOAD_ROOT) ? full : null;
}

/**
 * GET /api/integrity — verify every document: re-hash stored bytes and
 * recompute the tamper-evident chain. Reports any break in the chain.
 */
router.get('/integrity', requireAuth, async (req, res, next) => {
  try {
    const docs = await rows(
      `SELECT id, doc_number, title, doc_type, status, storage_path, hash_sha256,
              prev_hash, chain_hash, size_bytes, created_at
       FROM documents ORDER BY id ASC`
    );

    const issues = [];
    let prevChain = GENESIS_HASH;
    let checked = 0;
    let fileChecked = 0;
    const deep = String(req.query.deep || '') === 'true';

    for (const doc of docs) {
      // Chain linkage: each document must link to its predecessor.
      const expectedChain = computeChainHash(
        doc.prev_hash || GENESIS_HASH,
        doc.hash_sha256,
        doc.doc_number
      );
      const chainValid = expectedChain === doc.chain_hash && doc.prev_hash === prevChain;

      let fileValid = null;
      if (deep) {
        const full = resolveStored(doc.storage_path);
        if (full && fs.existsSync(full)) {
          const recomputed = await sha256File(full);
          fileValid = recomputed === doc.hash_sha256;
          fileChecked += 1;
        }
      }

      if (!chainValid || fileValid === false) {
        issues.push({
          id: doc.id,
          docNumber: doc.doc_number,
          title: doc.title,
          chainValid,
          fileValid,
          expectedChain,
          storedChain: doc.chain_hash,
        });
      }

      prevChain = doc.chain_hash;
      checked += 1;
    }

    res.json({
      checked,
      fileChecked,
      ok: issues.length === 0,
      chainIntact: issues.every((i) => i.chainValid),
      issues,
      verifiedAt: new Date().toISOString(),
      documentsTotal: toNumber(docs.length),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
