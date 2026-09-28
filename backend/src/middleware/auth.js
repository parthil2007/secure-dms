import jwt from 'jsonwebtoken';
import { one } from '../db.js';

const PUBLIC_USER_FIELDS = `id, name, email, role, department, badge_id, phone,
  avatar_color, is_active, last_login, created_at`;

/** Verifies the Bearer token and loads the user on every request. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await one(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or disabled' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Restricts a route to the listed roles (e.g. requireRole('admin')). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
