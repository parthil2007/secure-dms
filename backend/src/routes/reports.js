import { Router } from 'express';
import { one, rows } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { camelizeRows, toNumber } from '../lib/serialize.js';

const router = Router();

/** GET /api/reports — aggregated figures for the reports page / exports. */
router.get('/reports', requireAuth, async (req, res, next) => {
  try {
    const [
      overview,
      documentsByMonth,
      casesByType,
      topCases,
      officers,
      integrity,
      confidentiality,
      recentDocuments,
    ] = await Promise.all([
      one(`
        SELECT
          (SELECT COUNT(*) FROM documents)::int AS documents,
          (SELECT COUNT(*) FROM cases)::int AS cases,
          (SELECT COUNT(*) FROM users)::int AS users,
          (SELECT COUNT(*) FROM shares WHERE revoked_at IS NULL)::int AS shares,
          (SELECT COALESCE(SUM(size_bytes),0) FROM documents)::bigint AS storage_bytes,
          (SELECT COUNT(*) FROM documents WHERE status = 'verified')::int AS verified,
          (SELECT COUNT(*) FROM documents WHERE status = 'rejected')::int AS rejected,
          (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '30 days')::int AS last_30_days
      `),
      rows(`
        WITH months AS (
          SELECT generate_series(date_trunc('month', NOW() - INTERVAL '11 months'),
                                 date_trunc('month', NOW()), INTERVAL '1 month') AS month)
        SELECT to_char(m.month,'Mon YY') AS label,
               (SELECT COUNT(*) FROM documents d
                 WHERE date_trunc('month', d.created_at) = m.month)::int AS count
        FROM months m ORDER BY m.month`),
      rows(`
        SELECT COALESCE(case_type,'other') AS label, COUNT(*)::int AS count
        FROM cases GROUP BY case_type ORDER BY count DESC`),
      rows(`
        SELECT c.id, c.case_number, c.title, c.status, c.priority,
               COUNT(d.id)::int AS document_count,
               COALESCE(SUM(d.size_bytes),0)::bigint AS size_bytes
        FROM cases c LEFT JOIN documents d ON d.case_id = c.id
        GROUP BY c.id ORDER BY document_count DESC, c.created_at DESC LIMIT 8`),
      rows(`
        SELECT u.id, u.name, u.role, u.department, u.avatar_color,
               COUNT(d.id)::int AS document_count
        FROM users u LEFT JOIN documents d ON d.uploaded_by = u.id
        GROUP BY u.id ORDER BY document_count DESC, u.name ASC LIMIT 10`),
      rows(`
        SELECT status, COUNT(*)::int AS count FROM documents
        GROUP BY status ORDER BY count DESC`),
      rows(`
        SELECT confidentiality AS label, COUNT(*)::int AS count,
               COALESCE(SUM(size_bytes),0)::bigint AS size_bytes
        FROM documents GROUP BY confidentiality ORDER BY count DESC`),
      rows(`
        SELECT COUNT(*)::int AS count FROM documents
        WHERE created_at > NOW() - INTERVAL '7 days'`),
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      overview: {
        documents: toNumber(overview.documents),
        cases: toNumber(overview.cases),
        users: toNumber(overview.users),
        shares: toNumber(overview.shares),
        storageBytes: toNumber(overview.storage_bytes),
        verified: toNumber(overview.verified),
        rejected: toNumber(overview.rejected),
        last30Days: toNumber(overview.last_30_days),
        last7Days: toNumber(recentDocuments[0].count),
      },
      documentsByMonth: camelizeRows(documentsByMonth).map((r) => ({
        label: r.label,
        count: toNumber(r.count),
      })),
      casesByType: camelizeRows(casesByType).map((r) => ({
        label: r.label,
        count: toNumber(r.count),
      })),
      topCases: topCases.map((r) => ({
        id: r.id,
        caseNumber: r.case_number,
        title: r.title,
        status: r.status,
        priority: r.priority,
        documentCount: toNumber(r.document_count),
        sizeBytes: toNumber(r.size_bytes),
      })),
      officers: officers.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        department: r.department,
        avatarColor: r.avatar_color,
        documentCount: toNumber(r.document_count),
      })),
      integrity: camelizeRows(integrity).map((r) => ({
        status: r.status,
        count: toNumber(r.count),
      })),
      confidentiality: confidentiality.map((r) => ({
        label: r.label,
        count: toNumber(r.count),
        sizeBytes: toNumber(r.size_bytes),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
