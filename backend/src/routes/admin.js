import { Router } from 'express';
import { one, rows } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { camelizeRows, toNumber } from '../lib/serialize.js';

const router = Router();

/** GET /api/admin/stats — administration overview (admin only). */
router.get('/admin/stats', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const [users, storage, roles, recentUsers, dbSize] = await Promise.all([
      one(`
        SELECT
          (SELECT COUNT(*) FROM users)::int AS total,
          (SELECT COUNT(*) FROM users WHERE is_active)::int AS active,
          (SELECT COUNT(*) FROM users WHERE NOT is_active)::int AS inactive,
          (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '7 days')::int AS active_week,
          (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_month
      `),
      one(`
        SELECT COALESCE(SUM(size_bytes),0)::bigint AS total_bytes,
               COUNT(*)::int AS file_count
        FROM documents`),
      rows(`
        SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC`),
      rows(`
        SELECT id, name, email, role, department, is_active, created_at, last_login
        FROM users ORDER BY created_at DESC LIMIT 8`),
      one(`SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty,
                  pg_database_size(current_database())::bigint AS bytes`),
    ]);

    res.json({
      users: {
        total: toNumber(users.total),
        active: toNumber(users.active),
        inactive: toNumber(users.inactive),
        activeWeek: toNumber(users.active_week),
        newThisMonth: toNumber(users.new_month),
      },
      storage: {
        totalBytes: toNumber(storage.total_bytes),
        fileCount: toNumber(storage.file_count),
        databaseBytes: toNumber(dbSize.bytes),
        databasePretty: dbSize.pretty,
      },
      roles: camelizeRows(roles).map((r) => ({
        role: r.role,
        count: toNumber(r.count),
      })),
      recentUsers: camelizeRows(recentUsers),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
