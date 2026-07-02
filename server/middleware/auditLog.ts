import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { logger } from './logger';

export type AuditAction =
  | 'LEAD_CREATE' | 'LEAD_UPDATE' | 'LEAD_DELETE'
  | 'LISTING_CREATE' | 'LISTING_UPDATE' | 'LISTING_DELETE'
  | 'PROPOSAL_CREATE' | 'PROPOSAL_APPROVE' | 'PROPOSAL_REJECT' | 'PROPOSAL_DELETE'
  | 'CONTRACT_CREATE' | 'CONTRACT_UPDATE'
  | 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_PASSWORD_CHANGE'
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  | 'USER_2FA_ENABLED' | 'USER_2FA_DISABLED' | 'LOGIN_2FA_REQUIRED' | 'LOGIN_2FA_FAILED'
  | 'REGISTER' | 'EMAIL_VERIFIED' | 'ONBOARD_VENDOR'
  | 'PASSWORD_RESET_REQUEST' | 'PASSWORD_RESET_COMPLETE'
  | 'INTERACTION_SEND'
  | 'SETTINGS_UPDATE'
  | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'VENDOR_SUSPENDED' | 'VENDOR_REACTIVATED'
  | 'TENANT_BRANDING_UPDATE'
  | 'TENANT_SUBDOMAIN_SET' | 'TENANT_SUBDOMAIN_REMOVE'
  | 'TENANT_CUSTOM_DOMAIN_SET' | 'TENANT_CUSTOM_DOMAIN_VERIFIED' | 'TENANT_CUSTOM_DOMAIN_REMOVE';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUUID(v?: string): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

export async function writeAuditLog(
  tenantId: string,
  userId: string,
  action: AuditAction,
  resourceType: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string,
) {
  try {
    const actorId  = toUUID(userId);
    const entityId = toUUID(resourceId);
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, actorId, action, resourceType, entityId, details ? JSON.stringify(details) : null, ipAddress || null]
    );
    logger.audit(action, userId, { resourceType, resourceId });
  } catch (error) {
    logger.error('Failed to write audit log', error);
  }
}

export function auditMiddleware(action: AuditAction, resourceType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = (req as any).user;
        const tenantId = (req as any).tenantId;
        const resourceId = req.params.id || body?.id;
        if (user?.id && tenantId) {
          writeAuditLog(tenantId, user.id, action, resourceType, resourceId, undefined, req.ip);
        }
      }
      return originalJson(body);
    };
    next();
  };
}

// ---------------------------------------------------------------------------
// Global fallback audit logging for sensitive mutations.
// Closes the "DELETE sensitive operations not tracked" gap: instead of wiring
// auditMiddleware into all 45 DELETE routes by hand, this single middleware
// automatically records every SUCCESSFUL DELETE (and can be extended to other
// methods) with a best-effort action/entity derived from method + URL.
// Mount AFTER auth (so req.user is populated) and BEFORE the route handlers.
// ---------------------------------------------------------------------------

// Methods considered state-changing enough to always audit as a fallback.
const AUDITED_METHODS = new Set(['DELETE']);

// Map a URL segment (resource) to a canonical entity/action prefix.
function deriveEntityType(path: string): string {
  // e.g. /api/users/:id -> "users", /api/listings/123 -> "listings"
  const parts = path.split('/').filter(Boolean); // ["api","users","123"]
  const idx = parts[0] === 'api' ? 1 : 0;
  return parts[idx] || 'unknown';
}

function deriveAction(method: string, entityType: string): AuditAction {
  const singular = entityType.replace(/s$/, '').toUpperCase();
  const candidate = `${singular}_${method === 'DELETE' ? 'DELETE' : 'UPDATE'}`;
  // Fall back to a generic marker if it is not part of the known union; the
  // DB column is VARCHAR so any string is accepted at runtime.
  return candidate as AuditAction;
}

/**
 * Records every successful (2xx) request whose method is in AUDITED_METHODS.
 * Non-blocking: audit failures never break the response.
 */
export function globalMutationAudit(req: Request, res: Response, next: NextFunction) {
  if (!AUDITED_METHODS.has(req.method)) return next();

  const finish = () => {
    res.removeListener('finish', finish);
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId;
    const userId = user?.id;
    if (!userId || !tenantId) return; // unauthenticated / no tenant context

    const entityType = deriveEntityType(req.path);
    const action = deriveAction(req.method, entityType);
    const rawResourceId = req.params?.id;
    const resourceId = Array.isArray(rawResourceId) ? String(rawResourceId[0]) : rawResourceId ? String(rawResourceId) : undefined;
    // Fire-and-forget; writeAuditLog swallows its own errors.
    void writeAuditLog(
      tenantId,
      userId,
      action,
      entityType,
      resourceId,
      { method: req.method, path: req.originalUrl },
      (Array.isArray(req.ip) ? String(req.ip[0]) : req.ip ? String(req.ip) : undefined),
    );
  };
  res.on('finish', finish);
  next();
}
