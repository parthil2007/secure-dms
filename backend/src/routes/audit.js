import { Router } from 'express';
import { one, rows } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { camelizeRows, toNumber } from '../lib/serialize.js';

const router = Router();

/** GET /api/audit-logs — filterable, paginated audit trail. */
router.get('/audit-logs', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const action = String(req.query.action || '');
    const entityType = String(req.query.entityType || '');
    const userId = Number(req.query.userId) || 0;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where = `
      WHERE ($1 = '' OR a.action ILIKE '%' || $1 || '%'
             OR COALESCE(a.entity_name,'') ILIKE '%' || $1 || '%'
             OR COALESCE(a.user_name,'') ILIKE '%' || $1 || '%')
        AND ($2 = '' OR a.action = $2)
        AND ($3 = '' OR a.entity_type = $3)
        AND ($4 = 0 OR a.user_id = $4)`;

    const params = [q, action, entityType, userId];

    const [countRes, listRes, actions] = await Promise.all([
      one(`SELECT COUNT(*)::int AS total FROM audit_logs a ${where}`, params),
      rows(
        `SELECT a.* FROM audit_logs a ${where}
         ORDER BY a.created_at DESC LIMIT $5 OFFSET $6`,
        [...params, limit, offset]
      ),
      rows(
        `SELECT action, COUNT(*)::int AS count FROM audit_logs
         GROUP BY action ORDER BY count DESC LIMIT 30`
      ),
    ]);

    const total = toNumber(countRes.total);
    res.json({
      logs: camelizeRows(listRes),
      actions: camelizeRows(actions),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
