import { query } from '../db.js';

/** Extract the caller's IP address (handles reverse-proxy headers). */
export function clientIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  return String(raw).split(',')[0].trim().replace('::ffff:', '') || null;
}

/**
 * Append an entry to the immutable audit trail.
 * Never throws: audit failures must not break the business request.
 */
export async function logAudit(req, { action, entityType, entityId, entityName, details }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user?.id ?? null,
        req.user?.name ?? 'system',
        action,
        entityType ?? null,
        entityId != null ? String(entityId) : null,
        entityName ?? null,
        details ? JSON.stringify(details) : null,
        clientIp(req),
      ]
    );
  } catch (err) {
    console.error('audit log write failed:', err.message);
  }
}
