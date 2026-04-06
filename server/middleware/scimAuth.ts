/**
 * SCIM 2.0 Bearer Token Authentication Middleware
 *
 * Validates the Authorization: Bearer <token> header against the SCIM token
 * stored in the tenant's enterprise config.
 * The token is matched using timing-safe comparison to prevent timing attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';

/**
 * Extract the tenant ID from the request path.
 * SCIM routes are mounted at /scim/v2 with tenant ID in a query param or header.
 * We support:
 *   1. ?tenantId=<id>   (easiest for IdP configuration)
 *   2. X-Tenant-Id: <id> header
 *   3. Subdomain-based (future)
 */
function extractTenantId(req: Request): string | null {
  if (req.query.tenantId) return req.query.tenantId as string;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  return null;
}

export async function scimAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Authorization header missing or not Bearer type',
    });
    return;
  }

  const incomingToken = authHeader.slice(7).trim();
  if (!incomingToken) {
    res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Bearer token is empty',
    });
    return;
  }

  const tenantId = extractTenantId(req);
  if (!tenantId) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: 'Tenant ID is required (pass ?tenantId= or X-Tenant-Id header)',
    });
    return;
  }

  try {
    const config = await enterpriseConfigRepository.getConfig(tenantId);
    if (!config?.scim?.enabled || !config?.scim?.token) {
      res.status(403).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '403',
        detail: 'SCIM provisioning is not enabled for this tenant',
      });
      return;
    }

    const storedToken = config.scim.token;

    // Timing-safe comparison (buffers must be same length — hash both to normalize)
    const a = createHash('sha256').update(incomingToken).digest();
    const b = createHash('sha256').update(storedToken).digest();
    const valid = timingSafeEqual(a, b);

    if (!valid) {
      res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid SCIM Bearer token',
      });
      return;
    }

    // Attach tenant info for downstream handlers
    (req as any).scimTenantId = tenantId;
    next();
  } catch (err: any) {
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal error during SCIM authentication',
    });
  }
}
