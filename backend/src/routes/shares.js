import { Router } from 'express';
import { one, rows, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { camelizeRows } from '../lib/serialize.js';

const router = Router();

const PERMISSIONS = ['view', 'download', 'edit'];

/** GET /api/shares — shares I created plus shares sent to me. */
router.get('/shares', requireAuth, async (req, res, next) => {
  try {
    const list = await rows(
      `SELECT s.*, d.title AS document_title, d.doc_number, d.doc_type, d.id AS document_id,
              c.case_number, c.title AS case_title,
              ub.name AS shared_by_name, ub.avatar_color AS shared_by_color,
              uw.name AS shared_with_name, uw.email AS shared_with_email, uw.avatar_color AS shared_with_color
       FROM shares s
       LEFT JOIN documents d ON d.id = s.document_id
       LEFT JOIN cases c     ON c.id = COALESCE(s.case_id, d.case_id)
       LEFT JOIN users ub    ON ub.id = s.shared_by
       LEFT JOIN users uw    ON uw.id = s.shared_with
       WHERE s.shared_by = $1 OR s.shared_with = $1
          OR d.uploaded_by = $1
       ORDER BY s.created_at DESC LIMIT 200`,
      [req.user.id]
    );

    const now = Date.now();
    const serialized = camelizeRows(list).map((s) => ({
      ...s,
      expired: Boolean(s.expiresAt && new Date(s.expiresAt).getTime() < now),
      active: !s.revokedAt && (!s.expiresAt || new Date(s.expiresAt).getTime() > now),
    }));

    res.json({ shares: serialized });
  } catch (err) {
    next(err);
  }
});

/** POST /api/shares — share a document (or whole case) with a user. */
router.post('/shares', requireAuth, async (req, res, next) => {
  try {
    const { documentId, caseId, email, permission, message, expiresAt } = req.body || {};

    if (!documentId && !caseId) {
      return res.status(400).json({ error: 'A document or case is required' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const targetEmail = email.trim().toLowerCase();
    const recipient = await one('SELECT id, name, email FROM users WHERE email = $1', [
      targetEmail,
    ]);

    if (documentId) {
      const doc = await one('SELECT id, title FROM documents WHERE id = $1', [documentId]);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
    }

    const record = await one(
      `INSERT INTO shares (document_id, case_id, shared_by, shared_with, email, permission,
                           message, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        documentId || null,
        caseId || null,
        req.user.id,
        recipient?.id || null,
        targetEmail,
        PERMISSIONS.includes(permission) ? permission : 'view',
        message?.trim() || null,
        expiresAt || null,
      ]
    );

    await logAudit(req, {
      action: 'DOCUMENT_SHARED',
      entityType: 'share',
      entityId: record.id,
      entityName: targetEmail,
      details: { documentId, caseId, permission: record.permission },
    });

    res.status(201).json({ share: camelizeRows([record])[0] });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/shares/:id — revoke access. */
router.delete('/shares/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM shares WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Share not found' });
    if (existing.shared_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner can revoke this share' });
    }

    await query('UPDATE shares SET revoked_at = NOW() WHERE id = $1', [id]);

    await logAudit(req, {
      action: 'SHARE_REVOKED',
      entityType: 'share',
      entityId: id,
      entityName: existing.email,
      details: { documentId: existing.document_id },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
