import { Router } from 'express';
import { one, rows } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { camelizeRows, camelizeRow, toNumber } from '../lib/serialize.js';

const router = Router();

/** GET /api/dashboard/stats — headline KPIs for the dashboard. */
router.get('/dashboard/stats', requireAuth, async (req, res, next) => {
  try {
    const totals = await one(`
      SELECT
        (SELECT COUNT(*) FROM documents)::int                                              AS total_documents,
        (SELECT COUNT(*) FROM cases)::int                                                  AS total_cases,
        (SELECT COUNT(*) FROM cases WHERE status NOT IN ('closed','archived'))::int        AS active_cases,
        (SELECT COUNT(*) FROM documents WHERE doc_type = 'evidence')::int                  AS total_evidence,
        (SELECT COUNT(*) FROM documents WHERE status = 'pending_review')::int              AS pending_review,
        (SELECT COUNT(*) FROM documents WHERE status = 'verified')::int                    AS verified,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM documents)::bigint               AS storage_used,
        (SELECT COUNT(*) FROM shares WHERE revoked_at IS NULL)::int                        AS active_shares,
        (SELECT COUNT(*) FROM users)::int                                                  AS total_users,
        (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_documents_week,
        (SELECT COUNT(*) FROM cases WHERE created_at > NOW() - INTERVAL '7 days')::int     AS new_cases_week,
        (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_documents_month
    `);

    const [byType, byStatus, caseStatus, recentActivity, storageByType] = await Promise.all([
      rows(`
        SELECT doc_type AS type, COUNT(*)::int AS count
        FROM documents GROUP BY doc_type ORDER BY count DESC, doc_type`),
      rows(`
        SELECT status, COUNT(*)::int AS count
        FROM documents GROUP BY status ORDER BY count DESC`),
      rows(`
        SELECT status, COUNT(*)::int AS count
        FROM cases GROUP BY status ORDER BY count DESC`),
      rows(`
        SELECT id, action, entity_type, entity_id, entity_name, user_name, details, created_at
        FROM audit_logs ORDER BY created_at DESC LIMIT 10`),
      rows(`
        SELECT doc_type AS type, COALESCE(SUM(size_bytes), 0)::bigint AS size_bytes
        FROM documents GROUP BY doc_type ORDER BY size_bytes DESC`),
    ]);

    res.json({
      totals: {
        documents: toNumber(totals.total_documents),
        cases: toNumber(totals.total_cases),
        activeCases: toNumber(totals.active_cases),
        evidence: toNumber(totals.total_evidence),
        pendingReview: toNumber(totals.pending_review),
        verified: toNumber(totals.verified),
        users: toNumber(totals.total_users),
        shares: toNumber(totals.active_shares),
      },
      storageUsed: toNumber(totals.storage_used),
      newDocumentsWeek: toNumber(totals.new_documents_week),
      newDocumentsMonth: toNumber(totals.new_documents_month),
      newCasesWeek: toNumber(totals.new_cases_week),
      byType: camelizeRows(byType),
      byStatus: camelizeRows(byStatus),
      caseStatus: camelizeRows(caseStatus),
      storageByType: storageByType.map((r) => ({
        type: r.type,
        sizeBytes: toNumber(r.size_bytes),
      })),
      recentActivity: camelizeRows(recentActivity),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/dashboard/charts — time series for the dashboard charts. */
router.get('/dashboard/charts', requireAuth, async (req, res, next) => {
  try {
    const [documentsOverTime, activityByDay, casesByType, storageTrend] = await Promise.all([
      rows(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', NOW() - INTERVAL '11 months'),
            date_trunc('month', NOW()),
            INTERVAL '1 month'
          ) AS month
        )
        SELECT to_char(m.month, 'Mon YY') AS label,
               m.month::date               AS month,
               (SELECT COUNT(*) FROM documents d
                 WHERE date_trunc('month', d.created_at) = m.month)::int AS count
        FROM months m ORDER BY m.month`),
      rows(`
        WITH days AS (
          SELECT generate_series(NOW()::date - 13, NOW()::date, INTERVAL '1 day') AS day
        )
        SELECT to_char(d.day, 'DD Mon') AS label,
               d.day::date               AS day,
               (SELECT COUNT(*) FROM audit_logs a
                 WHERE a.created_at::date = d.day)::int AS count
        FROM days d ORDER BY d.day`),
      rows(`
        SELECT COALESCE(case_type, 'unassigned') AS label, COUNT(*)::int AS count
        FROM cases GROUP BY case_type ORDER BY count DESC`),
      rows(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', NOW() - INTERVAL '11 months'),
            date_trunc('month', NOW()),
            INTERVAL '1 month'
          ) AS month
        )
        SELECT to_char(m.month, 'Mon YY') AS label,
               m.month::date               AS month,
               (SELECT COALESCE(SUM(size_bytes), 0) FROM documents d
                 WHERE d.created_at < m.month + INTERVAL '1 month')::bigint AS size_bytes
        FROM months m ORDER BY m.month`),
    ]);

    res.json({
      documentsOverTime: documentsOverTime.map((r) => ({
        label: r.label,
        month: r.month,
        count: toNumber(r.count),
      })),
      activityByDay: activityByDay.map((r) => ({
        label: r.label,
        day: r.day,
        count: toNumber(r.count),
      })),
      casesByType: camelizeRows(casesByType),
      storageTrend: storageTrend.map((r) => ({
        label: r.label,
        month: r.month,
        sizeBytes: toNumber(r.size_bytes),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
