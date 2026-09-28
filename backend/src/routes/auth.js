import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { one, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { camelizeRow } from '../lib/serialize.js';

const router = Router();

const PUBLIC_USER = `id, name, email, role, department, badge_id, phone,
  avatar_color, is_active, last_login, created_at`;

const AVATAR_COLORS = ['#2f49d6', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#0369a1'];
const ALLOWED_ROLES = ['admin', 'investigator', 'analyst', 'prosecutor', 'viewer'];

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function validEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** POST /api/register */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, department, badgeId } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const normalized = email.trim().toLowerCase();
    if (!validEmail(normalized)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const existing = await one('SELECT id FROM users WHERE email = $1', [normalized]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await one(
      `INSERT INTO users (name, email, password_hash, role, department, badge_id, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${PUBLIC_USER}`,
      [
        name.trim(),
        normalized,
        passwordHash,
        ALLOWED_ROLES.includes(role) ? role : 'investigator',
        department?.trim() || null,
        badgeId?.trim() || null,
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      ]
    );

    req.user = user;
    await logAudit(req, {
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
      details: { role: user.role },
    });

    res.status(201).json({ token: signToken(user), user: camelizeRow(user) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/login */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const record = await one('SELECT * FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);

    const ok = record && (await bcrypt.compare(password, record.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    if (!record.is_active) {
      return res.status(403).json({ error: 'This account has been disabled' });
    }

    const user = camelizeRow(
      await one(
        `UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING ${PUBLIC_USER}`,
        [record.id]
      )
    );

    req.user = user;
    await logAudit(req, {
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
    });

    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

/** GET /api/profile */
router.get('/profile', requireAuth, (req, res) => {
  res.json({ user: camelizeRow(req.user) });
});

/** PUT /api/profile — update profile, optionally change password. */
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, department, phone, badgeId, avatarColor, currentPassword, newPassword } =
      req.body || {};

    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      const record = await one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const ok = currentPassword && (await bcrypt.compare(currentPassword, record.password_hash));
      if (!ok) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        await bcrypt.hash(newPassword, 10),
        req.user.id,
      ]);
    }

    const user = camelizeRow(
      await one(
        `UPDATE users SET
           name = COALESCE($1, name),
           department = COALESCE($2, department),
           phone = COALESCE($3, phone),
           badge_id = COALESCE($4, badge_id),
           avatar_color = COALESCE($5, avatar_color),
           updated_at = NOW()
         WHERE id = $6
         RETURNING ${PUBLIC_USER}`,
        [
          name?.trim() || null,
          department ?? null,
          phone ?? null,
          badgeId ?? null,
          avatarColor ?? null,
          req.user.id,
        ]
      )
    );

    await logAudit(req, {
      action: 'PROFILE_UPDATED',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
