import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { one, rows, query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { camelizeRow, camelizeRows, toNumber } from '../lib/serialize.js';
import { upload, removeStoredFile } from '../middleware/upload.js';
import { sha256File, computeChainHash, GENESIS_HASH } from '../lib/hash.js';
import { nextLabel, docPrefix } from '../lib/number.js';
import { UPLOAD_ROOT } from '../config.js';

const router = Router();

const DOC_TYPES = [
  'evidence', 'court_order', 'legal_filing', 'statement', 'report',
  'photo', 'video', 'audio', 'correspondence', 'other',
];
const STATUSES = ['stored', 'pending_review', 'verified', 'rejected', 'archived'];
const CONFIDENTIALITY = ['public', 'internal', 'confidential', 'restricted'];

const DOC_FROM = `
  FROM documents d
  LEFT JOIN cases c ON c.id = d.case_id
  LEFT JOIN users u ON u.id = d.uploaded_by`;

const DOC_COLUMNS = `
  d.*, c.case_number, c.title AS case_title,
  u.name AS uploaded_by_name, u.avatar_color AS uploaded_by_color`;

const LIST_SELECT = `SELECT ${DOC_COLUMNS} ${DOC_FROM}`;

function serializeDoc(row) {
  const doc = camelizeRow(row);
  doc.sizeBytes = toNumber(doc.sizeBytes);
  doc.tags = Array.isArray(doc.tags) ? doc.tags : [];
  return doc;
}

/**
 * Tags arrive as a real array from JSON bodies but as a JSON string (or a
 * comma list) from multipart forms — normalise all three.
 */
function parseTags(value) {
  if (Array.isArray(value)) return value.filter((t) => typeof t === 'string');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        /* fall through to comma splitting */
      }
    }
    return trimmed
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/** Absolute path of a stored file, guarded against traversal. */
function resolveStored(storedName) {
  if (!storedName) return null;
  const full = path.resolve(UPLOAD_ROOT, path.basename(storedName));
  return full.startsWith(UPLOAD_ROOT) ? full : null;
}

/** GET /api/documents — filterable, paginated document library. */
router.get('/documents', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const caseId = Number(req.query.caseId) || 0;
    const type = String(req.query.type || '');
    const status = String(req.query.status || '');
    const confidentiality = String(req.query.confidentiality || '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;

    const orderMap = {
      recent: 'd.created_at DESC',
      oldest: 'd.created_at ASC',
      title: 'd.title ASC',
      size: 'd.size_bytes DESC',
    };
    const orderBy = orderMap[String(req.query.sort || 'recent')] || orderMap.recent;

    const where = `
      WHERE ($1 = '' OR d.title ILIKE '%' || $1 || '%'
             OR COALESCE(d.description,'') ILIKE '%' || $1 || '%'
             OR COALESCE(d.doc_number,'') ILIKE '%' || $1 || '%'
             OR COALESCE(d.original_name,'') ILIKE '%' || $1 || '%'
             OR ARRAY_TO_STRING(d.tags, ' ') ILIKE '%' || $1 || '%')
        AND ($2 = 0 OR d.case_id = $2)
        AND ($3 = '' OR d.doc_type = $3)
        AND ($4 = '' OR d.status = $4)
        AND ($5 = '' OR d.confidentiality = $5)`;

    const params = [q, caseId, type, status, confidentiality];

    const [countRes, listRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM documents d ${where}`, params),
      query(
        `${LIST_SELECT} ${where} ORDER BY ${orderBy} LIMIT $6 OFFSET $7`,
        [...params, limit, offset]
      ),
    ]);

    const total = toNumber(countRes.rows[0].total);
    res.json({
      documents: listRes.rows.map(serializeDoc),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/documents — register metadata without a file. */
router.post('/documents', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.title?.trim()) return res.status(400).json({ error: 'Document title is required' });

    const docType = DOC_TYPES.includes(b.docType) ? b.docType : 'other';
    const docNumber = await nextLabel(docPrefix(docType), 'seq_document_number');

    const record = await one(
      `INSERT INTO documents (doc_number, title, description, doc_type, category, case_id,
                              status, confidentiality, tags, source, collected_at, location,
                              uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        docNumber,
        b.title.trim(),
        b.description?.trim() || null,
        docType,
        b.category?.trim() || null,
        b.caseId || null,
        STATUSES.includes(b.status) ? b.status : 'pending_review',
        CONFIDENTIALITY.includes(b.confidentiality) ? b.confidentiality : 'internal',
        parseTags(b.tags),
        b.source?.trim() || null,
        b.collectedAt || null,
        b.location?.trim() || null,
        req.user.id,
      ]
    );

    await logAudit(req, {
      action: 'DOCUMENT_REGISTERED',
      entityType: 'document',
      entityId: record.id,
      entityName: record.title,
      details: { docNumber: record.doc_number, docType: record.doc_type },
    });

    res.status(201).json({ document: serializeDoc(record) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/documents/upload — store a file with a tamper-evident hash chain. */
router.post('/documents/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  let storedName = req.file?.filename;
  try {
    if (!req.file) return res.status(400).json({ error: 'A file is required' });

    const b = req.body || {};
    if (!b.title?.trim()) return res.status(400).json({ error: 'Document title is required' });

    const contentHash = await sha256File(req.file.path);
    const docType = DOC_TYPES.includes(b.docType) ? b.docType : 'evidence';

    const record = await withTransaction(async (client) => {
      // Serialise chain updates so each document links to the true predecessor.
      await client.query('SELECT pg_advisory_xact_lock(4242)');

      const docNumber = await nextLabel(docPrefix(docType), 'seq_document_number');
      const prevRes = await client.query(
        'SELECT chain_hash FROM documents ORDER BY id DESC LIMIT 1'
      );
      const prevHash = prevRes.rows[0]?.chain_hash || GENESIS_HASH;
      const chainHash = computeChainHash(prevHash, contentHash, docNumber);

      const inserted = await client.query(
        `INSERT INTO documents (doc_number, title, description, doc_type, category, case_id,
                                file_name, original_name, mime_type, size_bytes, storage_path,
                                hash_sha256, prev_hash, chain_hash, status, confidentiality,
                                tags, source, collected_at, location, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
          docNumber,
          b.title.trim(),
          b.description?.trim() || null,
          docType,
          b.category?.trim() || null,
          b.caseId || null,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.file.filename,
          contentHash,
          prevHash,
          chainHash,
          STATUSES.includes(b.status) ? b.status : 'stored',
          CONFIDENTIALITY.includes(b.confidentiality) ? b.confidentiality : 'internal',
          parseTags(b.tags),
          b.source?.trim() || null,
          b.collectedAt || null,
          b.location?.trim() || null,
          req.user.id,
        ]
      );
      const doc = inserted.rows[0];

      await client.query(
        `INSERT INTO document_versions (document_id, version_number, file_name, original_name,
                                        mime_type, size_bytes, storage_path, hash_sha256, note,
                                        created_by)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          doc.id,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.file.filename,
          contentHash,
          'Initial upload',
          req.user.id,
        ]
      );

      await client.query(
        `INSERT INTO chain_of_custody (document_id, action, from_user, location, notes, hash_proof)
         VALUES ($1, 'collected', $2, $3, $4, $5)`,
        [
          doc.id,
          req.user.id,
          b.location?.trim() || null,
          'Evidence registered into the secure repository',
          chainHash,
        ]
      );

      return doc;
    });

    await logAudit(req, {
      action: 'DOCUMENT_UPLOADED',
      entityType: 'document',
      entityId: record.id,
      entityName: record.title,
      details: {
        docNumber: record.doc_number,
        sizeBytes: Number(record.size_bytes),
        hash: contentHash,
      },
    });

    res.status(201).json({ document: serializeDoc(record) });
  } catch (err) {
    if (storedName) removeStoredFile(storedName);
    next(err);
  }
});

/** GET /api/documents/:id — full detail with versions, custody trail and shares. */
router.get('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const record = await one(
      `SELECT ${DOC_COLUMNS},
              (SELECT COUNT(*) FROM document_versions v WHERE v.document_id = d.id)::int AS version_count
       ${DOC_FROM}
       WHERE d.id = $1`,
      [id]
    );
    if (!record) return res.status(404).json({ error: 'Document not found' });

    const [versions, custody, shares, activity] = await Promise.all([
      rows(
        `SELECT v.*, u.name AS created_by_name
         FROM document_versions v LEFT JOIN users u ON u.id = v.created_by
         WHERE v.document_id = $1 ORDER BY v.version_number DESC`,
        [id]
      ),
      rows(
        `SELECT cc.*, fu.name AS from_user_name, tu.name AS to_user_name
         FROM chain_of_custody cc
         LEFT JOIN users fu ON fu.id = cc.from_user
         LEFT JOIN users tu ON tu.id = cc.to_user
         WHERE cc.document_id = $1 ORDER BY cc.created_at DESC`,
        [id]
      ),
      rows(
        `SELECT s.*, u.name AS shared_with_name, ub.name AS shared_by_name
         FROM shares s
         LEFT JOIN users u ON u.id = s.shared_with
         LEFT JOIN users ub ON ub.id = s.shared_by
         WHERE s.document_id = $1 ORDER BY s.created_at DESC`,
        [id]
      ),
      rows(
        `SELECT id, action, user_name, details, created_at
         FROM audit_logs WHERE entity_type = 'document' AND entity_id = $1::text
         ORDER BY created_at DESC LIMIT 25`,
        [id]
      ),
    ]);

    res.json({
      document: serializeDoc(record),
      versions: camelizeRows(versions),
      custody: camelizeRows(custody),
      shares: camelizeRows(shares),
      activity: camelizeRows(activity),
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/documents/:id — update metadata. */
router.put('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM documents WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const b = req.body || {};
    const record = await one(
      `UPDATE documents SET
         title           = COALESCE($1, title),
         description     = COALESCE($2, description),
         doc_type        = COALESCE($3, doc_type),
         category        = COALESCE($4, category),
         case_id         = COALESCE($5, case_id),
         status          = COALESCE($6, status),
         confidentiality = COALESCE($7, confidentiality),
         tags            = COALESCE($8, tags),
         source          = COALESCE($9, source),
         location        = COALESCE($10, location),
         updated_at      = NOW()
       WHERE id = $11 RETURNING *`,
      [
        b.title?.trim() || null,
        b.description !== undefined && b.description !== null ? b.description : null,
        DOC_TYPES.includes(b.docType) ? b.docType : null,
        b.category ?? null,
        b.caseId ?? null,
        STATUSES.includes(b.status) ? b.status : null,
        CONFIDENTIALITY.includes(b.confidentiality) ? b.confidentiality : null,
        Array.isArray(b.tags) || (typeof b.tags === 'string' && b.tags.trim())
          ? parseTags(b.tags)
          : null,
        b.source ?? null,
        b.location ?? null,
        id,
      ]
    );

    await logAudit(req, {
      action: 'DOCUMENT_UPDATED',
      entityType: 'document',
      entityId: id,
      entityName: record.title,
      details: { status: record.status },
    });

    res.json({ document: serializeDoc(record) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/documents/:id — uploader or admin only. */
router.delete('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM documents WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    if (existing.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the uploader or an admin can delete this document' });
    }

    const files = await rows('SELECT storage_path FROM document_versions WHERE document_id = $1', [id]);
    await query('DELETE FROM documents WHERE id = $1', [id]);
    files.forEach((f) => removeStoredFile(f.storage_path));

    await logAudit(req, {
      action: 'DOCUMENT_DELETED',
      entityType: 'document',
      entityId: id,
      entityName: existing.title,
      details: { docNumber: existing.doc_number },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** GET /api/documents/:id/versions */
router.get('/documents/:id/versions', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const exists = await one('SELECT id FROM documents WHERE id = $1', [id]);
    if (!exists) return res.status(404).json({ error: 'Document not found' });

    const list = await rows(
      `SELECT v.*, u.name AS created_by_name
       FROM document_versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.document_id = $1 ORDER BY v.version_number DESC`,
      [id]
    );

    res.json({ versions: camelizeRows(list) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/documents/:id/versions — upload a new revision of an existing document. */
router.post(
  '/documents/:id/versions',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    const storedName = req.file?.filename;
    try {
      const id = Number(req.params.id);
      const existing = await one('SELECT * FROM documents WHERE id = $1', [id]);
      if (!existing) return res.status(404).json({ error: 'Document not found' });
      if (!req.file) return res.status(400).json({ error: 'A file is required' });

      const contentHash = await sha256File(req.file.path);
      const nextVersion = Number(existing.version) + 1;
      const chainHash = computeChainHash(
        existing.prev_hash || GENESIS_HASH,
        contentHash,
        existing.doc_number
      );

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO document_versions (document_id, version_number, file_name, original_name,
                                          mime_type, size_bytes, storage_path, hash_sha256, note,
                                          created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            id,
            nextVersion,
            req.file.filename,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            req.file.filename,
            contentHash,
            req.body.note || null,
            req.user.id,
          ]
        );

        await client.query(
          `UPDATE documents SET
             file_name = $1, original_name = $2, mime_type = $3, size_bytes = $4,
             storage_path = $5, hash_sha256 = $6, chain_hash = $7, version = $8,
             status = 'pending_review', updated_at = NOW()
           WHERE id = $9`,
          [
            req.file.filename,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            req.file.filename,
            contentHash,
            chainHash,
            nextVersion,
            id,
          ]
        );

        await client.query(
          `INSERT INTO chain_of_custody (document_id, action, from_user, notes, hash_proof)
           VALUES ($1, 'revised', $2, $3, $4)`,
          [id, req.user.id, `New revision v${nextVersion} uploaded`, chainHash]
        );
      });

      const updated = await one('SELECT * FROM documents WHERE id = $1', [id]);
      const oldFile = existing.storage_path;

      await logAudit(req, {
        action: 'DOCUMENT_VERSION_ADDED',
        entityType: 'document',
        entityId: id,
        entityName: updated.title,
        details: { version: nextVersion, hash: contentHash },
      });

      if (oldFile && oldFile !== req.file.filename) removeStoredFile(oldFile);

      res.status(201).json({ document: serializeDoc(updated) });
    } catch (err) {
      if (storedName) removeStoredFile(storedName);
      next(err);
    }
  }
);

/** GET /api/documents/:id/file — authenticated download. */
router.get('/documents/:id/file', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const record = await one('SELECT * FROM documents WHERE id = $1', [id]);
    if (!record) return res.status(404).json({ error: 'Document not found' });

    const versionId = Number(req.query.version) || 0;
    let target = {
      storage_path: record.storage_path,
      original_name: record.original_name,
      mime_type: record.mime_type,
    };

    if (versionId) {
      const v = await one(
        'SELECT * FROM document_versions WHERE document_id = $1 AND version_number = $2',
        [id, versionId]
      );
      if (v) {
        target = {
          storage_path: v.storage_path,
          original_name: v.original_name,
          mime_type: v.mime_type,
        };
      }
    }

    const full = resolveStored(target.storage_path);
    if (!full || !fs.existsSync(full)) {
      return res.status(404).json({ error: 'File is no longer available on disk' });
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(target.original_name || 'download')}`
    );
    res.setHeader('Content-Type', target.mime_type || 'application/octet-stream');

    await logAudit(req, {
      action: 'DOCUMENT_DOWNLOADED',
      entityType: 'document',
      entityId: id,
      entityName: record.title,
      details: { version: versionId || record.version },
    });

    fs.createReadStream(full).pipe(res);
  } catch (err) {
    next(err);
  }
});

/** POST /api/documents/:id/verify — re-hash the file and validate the chain. */
router.post('/documents/:id/verify', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const record = await one('SELECT * FROM documents WHERE id = $1', [id]);
    if (!record) return res.status(404).json({ error: 'Document not found' });

    const full = resolveStored(record.storage_path);
    let fileValid = null;
    let recomputedHash = null;

    if (full && fs.existsSync(full)) {
      recomputedHash = await sha256File(full);
      fileValid = recomputedHash === record.hash_sha256;
    }

    const expectedChain = computeChainHash(
      record.prev_hash || GENESIS_HASH,
      record.hash_sha256,
      record.doc_number
    );
    const chainValid = expectedChain === record.chain_hash;

    const intact = fileValid !== false && chainValid;
    const newStatus = intact ? 'verified' : 'rejected';

    await query('UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2', [
      newStatus,
      id,
    ]);

    await query(
      `INSERT INTO chain_of_custody (document_id, action, from_user, notes, hash_proof)
       VALUES ($1, 'verified', $2, $3, $4)`,
      [
        id,
        req.user.id,
        intact
          ? 'Integrity check passed — file and chain match'
          : `Integrity check FAILED (file: ${fileValid}, chain: ${chainValid})`,
        record.chain_hash,
      ]
    );

    await logAudit(req, {
      action: intact ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_TAMPER_FLAGGED',
      entityType: 'document',
      entityId: id,
      entityName: record.title,
      details: { fileValid, chainValid, recomputedHash },
    });

    res.json({
      intact,
      fileValid,
      chainValid,
      storedHash: record.hash_sha256,
      recomputedHash,
      status: newStatus,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
