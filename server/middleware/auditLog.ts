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
  | 'REGISTER' | 'EMAIL_VERIFIED' | 'ONBOARD_VENDOR'
  | 'PASSWORD_RESET_REQUEST' | 'PASSWORD_RESET_COMPLETE'
  | 'INTERACTION_SEND'
  | 'SETTINGS_UPDATE';

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
