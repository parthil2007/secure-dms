import { Router } from 'express';
import { one, rows, query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { camelizeRow, camelizeRows, toNumber } from '../lib/serialize.js';
import { nextLabel } from '../lib/number.js';

const router = Router();

const STATUSES = ['open', 'active', 'under_review', 'closed', 'archived'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CASE_TYPES = ['criminal', 'civil', 'cyber', 'financial', 'corruption', 'narcotics', 'other'];

/** Mint a sequential case number such as CASE-2026-00001. */
function buildCaseNumber() {
  return nextLabel('CASE', 'seq_case_number');
}

/** GET /api/cases — list with filtering, sorting and pagination. */
router.get('/cases', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '');
    const priority = String(req.query.priority || '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;
    const sort = String(req.query.sort || 'recent');

    const orderMap = {
      recent: 'c.created_at DESC',
      updated: 'c.updated_at DESC',
      title: 'c.title ASC',
      priority: `CASE c.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC`,
    };
    const orderBy = orderMap[sort] || orderMap.recent;

    const where = `
      WHERE ($1 = '' OR c.title ILIKE '%' || $1 || '%' OR c.case_number ILIKE '%' || $1 || '%'
             OR COALESCE(c.description,'') ILIKE '%' || $1 || '%')
        AND ($2 = '' OR c.status = $2)
        AND ($3 = '' OR c.priority = $3)`;

    const [countRes, listRes] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total FROM cases c ${where}`,
        [q, status, priority]
      ),
      query(
        `SELECT c.*, u.name AS lead_officer_name, u.avatar_color AS lead_officer_color,
                (SELECT COUNT(*) FROM documents d WHERE d.case_id = c.id)::int AS document_count
         FROM cases c
         LEFT JOIN users u ON u.id = c.lead_officer_id
         ${where}
         ORDER BY ${orderBy}
         LIMIT $4 OFFSET $5`,
        [q, status, priority, limit, offset]
      ),
    ]);

    res.json({
      cases: camelizeRows(listRes.rows).map((c) => ({
        ...c,
        documentCount: toNumber(c.documentCount),
      })),
      total: toNumber(countRes.rows[0].total),
      page,
      pages: Math.ceil(toNumber(countRes.rows[0].total) / limit),
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/cases — create a case. */
router.post('/cases', requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      description,
      caseType,
      status,
      priority,
      leadOfficerId,
      agency,
      court,
      filingDate,
      dueDate,
      caseNumber,
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Case title is required' });
    }

    const record = await one(
      `INSERT INTO cases (case_number, title, description, case_type, status, priority,
                          lead_officer_id, agency, court, filing_date, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        caseNumber?.trim() || (await buildCaseNumber()),
        title.trim(),
        description?.trim() || null,
        CASE_TYPES.includes(caseType) ? caseType : 'criminal',
        STATUSES.includes(status) ? status : 'open',
        PRIORITIES.includes(priority) ? priority : 'medium',
        leadOfficerId || null,
        agency?.trim() || null,
        court?.trim() || null,
        filingDate || null,
        dueDate || null,
        req.user.id,
      ]
    );

    await logAudit(req, {
      action: 'CASE_CREATED',
      entityType: 'case',
      entityId: record.id,
      entityName: record.title,
      details: { caseNumber: record.case_number, priority: record.priority },
    });

    res.status(201).json({ case: camelizeRow(record) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That case number is already in use' });
    }
    next(err);
  }
});

/** GET /api/cases/:id — case detail with its documents. */
router.get('/cases/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const record = await one(
      `SELECT c.*, u.name AS lead_officer_name, u.avatar_color AS lead_officer_color,
              u.role AS lead_officer_role,
              (SELECT COUNT(*) FROM documents d WHERE d.case_id = c.id)::int AS document_count,
              (SELECT COALESCE(SUM(d.size_bytes),0) FROM documents d WHERE d.case_id = c.id)::bigint AS size_bytes,
              cu.name AS created_by_name
       FROM cases c
       LEFT JOIN users u  ON u.id  = c.lead_officer_id
       LEFT JOIN users cu ON cu.id = c.created_by
       WHERE c.id = $1`,
      [id]
    );

    if (!record) return res.status(404).json({ error: 'Case not found' });

    const documents = await rows(
      `SELECT d.*, u.name AS uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.case_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );

    const activity = await rows(
      `SELECT id, action, entity_type, entity_name, user_name, created_at
       FROM audit_logs
       WHERE (entity_type = 'case' AND entity_id = $1::int::text)
          OR (entity_type = 'document' AND entity_id = ANY(
               SELECT id::text FROM documents WHERE case_id = $1::int))
       ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    const docRows = camelizeRows(documents).map((d) => ({
      ...d,
      sizeBytes: toNumber(d.sizeBytes),
    }));

    res.json({
      case: {
        ...camelizeRow(record),
        documentCount: toNumber(record.document_count),
        sizeBytes: toNumber(record.size_bytes),
      },
      documents: docRows,
      activity: camelizeRows(activity),
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/cases/:id — update a case. */
router.put('/cases/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM cases WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const b = req.body || {};
    const record = await one(
      `UPDATE cases SET
         title        = COALESCE($1, title),
         description  = COALESCE($2, description),
         case_type    = COALESCE($3, case_type),
         status       = COALESCE($4, status),
         priority     = COALESCE($5, priority),
         lead_officer_id = COALESCE($6, lead_officer_id),
         agency       = COALESCE($7, agency),
         court        = COALESCE($8, court),
         filing_date  = COALESCE($9, filing_date),
         due_date     = COALESCE($10, due_date),
         updated_at   = NOW()
       WHERE id = $11 RETURNING *`,
      [
        b.title?.trim() || null,
        b.description !== undefined ? b.description : null,
        CASE_TYPES.includes(b.caseType) ? b.caseType : null,
        STATUSES.includes(b.status) ? b.status : null,
        PRIORITIES.includes(b.priority) ? b.priority : null,
        b.leadOfficerId || null,
        b.agency ?? null,
        b.court ?? null,
        b.filingDate || null,
        b.dueDate || null,
        id,
      ]
    );

    await logAudit(req, {
      action: 'CASE_UPDATED',
      entityType: 'case',
      entityId: id,
      entityName: record.title,
      details: { status: record.status },
    });

    res.json({ case: camelizeRow(record) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/cases/:id — admin only. */
router.delete('/cases/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM cases WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    await query('DELETE FROM cases WHERE id = $1', [id]);

    await logAudit(req, {
      action: 'CASE_DELETED',
      entityType: 'case',
      entityId: id,
      entityName: existing.title,
      details: { caseNumber: existing.case_number },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
