import { Router } from 'express';
import { rows } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { camelizeRows, toNumber } from '../lib/serialize.js';

const router = Router();

/** GET /api/search?q= — global search across documents, cases and people. */
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || 'all');
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    if (!q) {
      return res.json({ query: q, documents: [], cases: [], users: [], total: 0 });
    }

    const like = `%${q}%`;
    const wants = (t) => type === 'all' || type === t;

    const [documents, cases, users] = await Promise.all([
      wants('documents')
        ? rows(
            `SELECT d.id, d.doc_number, d.title, d.doc_type, d.status, d.confidentiality,
                    d.size_bytes, d.created_at, c.case_number, c.title AS case_title
             FROM documents d LEFT JOIN cases c ON c.id = d.case_id
             WHERE d.title ILIKE $1 OR COALESCE(d.description,'') ILIKE $1
                OR COALESCE(d.original_name,'') ILIKE $1
                OR ARRAY_TO_STRING(d.tags,' ') ILIKE $1
             ORDER BY d.created_at DESC LIMIT $2`,
            [like, limit]
          )
        : Promise.resolve([]),
      wants('cases')
        ? rows(
            `SELECT id, case_number, title, case_type, status, priority, created_at
             FROM cases
             WHERE title ILIKE $1 OR case_number ILIKE $1
                OR COALESCE(description,'') ILIKE $1
             ORDER BY created_at DESC LIMIT $2`,
            [like, limit]
          )
        : Promise.resolve([]),
      wants('users')
        ? rows(
            `SELECT id, name, email, role, department, avatar_color
             FROM users
             WHERE name ILIKE $1 OR email ILIKE $1 OR COALESCE(department,'') ILIKE $1
             ORDER BY name ASC LIMIT $2`,
            [like, limit]
          )
        : Promise.resolve([]),
    ]);

    const docRows = camelizeRows(documents).map((d) => ({ ...d, sizeBytes: toNumber(d.sizeBytes) }));

    res.json({
      query: q,
      documents: docRows,
      cases: camelizeRows(cases),
      users: camelizeRows(users),
      total: docRows.length + cases.length + users.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
