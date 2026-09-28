import { Router } from 'express';
import { one, rows, query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { camelizeRows, camelizeRow, toNumber } from '../lib/serialize.js';

const router = Router();

const ROLES = ['admin', 'investigator', 'analyst', 'prosecutor', 'viewer'];

const USER_FIELDS = `u.id, u.name, u.email, u.role, u.department, u.badge_id, u.avatar_color,
  u.is_active, u.last_login, u.created_at,
  (SELECT COUNT(*) FROM documents d WHERE d.uploaded_by = u.id)::int AS document_count`;

/** GET /api/users — directory (used for assignment and sharing). */
router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const list = await rows(
      `SELECT ${USER_FIELDS}
       FROM users u
       WHERE ($1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
              OR COALESCE(u.department,'') ILIKE '%' || $1 || '%')
       ORDER BY u.name ASC LIMIT 200`,
      [q]
    );

    res.json({
      users: camelizeRows(list).map((u) => ({ ...u, documentCount: toNumber(u.document_count) })),
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/users/:id — admin updates role/status/department. */
router.put('/users/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const b = req.body || {};
    const user = camelizeRow(
      await one(
        `UPDATE users SET
           role       = COALESCE($1, role),
           is_active  = COALESCE($2, is_active),
           department = COALESCE($3, department),
           updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, email, role, department, badge_id, avatar_color, is_active,
                   last_login, created_at`,
        [
          ROLES.includes(b.role) ? b.role : null,
          typeof b.isActive === 'boolean' ? b.isActive : null,
          b.department ?? null,
          id,
        ]
      )
    );

    await logAudit(req, {
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      entityName: user.name,
      details: { role: user.role, isActive: user.isActive },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/users/:id — admin only, cannot delete yourself. */
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const existing = await one('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await query('DELETE FROM users WHERE id = $1', [id]);

    await logAudit(req, {
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: id,
      entityName: existing.name,
      details: { email: existing.email },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
