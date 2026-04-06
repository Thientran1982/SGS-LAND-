/**
 * SCIM 2.0 Provisioning Routes (RFC 7644)
 *
 * Endpoint: /scim/v2
 * Authentication: Bearer token (see scimAuth middleware)
 *
 * Supported resources:
 *   Users  — full CRUD + deprovisioning (status=INACTIVE)
 *   Groups — list/get only (teams map to internal groups)
 *
 * SCIM User ↔ Internal User mapping:
 *   userName     → email
 *   name.formatted / name.givenName+familyName → name
 *   active       → status: ACTIVE / INACTIVE
 *   title        → role (mapped to internal roles)
 *   phoneNumbers[0].value → phone
 *   externalId   → metadata.scimExternalId
 */

import { Router, Request, Response } from 'express';
import { scimAuthMiddleware } from '../middleware/scimAuth';
import { userRepository } from '../repositories/userRepository';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { logger } from '../middleware/logger';

const SCIM_SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_SCHEMA_GROUP = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const SCIM_SCHEMA_LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCIM_SCHEMA_ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';

// Map SCIM title/role to internal role
function scimTitleToRole(title?: string): string {
  if (!title) return 'VIEWER';
  const t = title.toUpperCase();
  if (t.includes('ADMIN')) return 'ADMIN';
  if (t.includes('TEAM_LEAD') || t.includes('LEAD') || t.includes('MANAGER')) return 'TEAM_LEAD';
  if (t.includes('SALES')) return 'SALES';
  if (t.includes('MARKETING')) return 'MARKETING';
  return 'VIEWER';
}

function internalUserToScim(user: any, baseUrl: string): any {
  const names = (user.name || '').split(' ');
  const givenName = names.slice(0, -1).join(' ') || user.name || '';
  const familyName = names[names.length - 1] || '';

  return {
    schemas: [SCIM_SCHEMA_USER],
    id: user.id,
    externalId: user.metadata?.scimExternalId || undefined,
    userName: user.email,
    name: {
      formatted: user.name,
      givenName,
      familyName,
    },
    displayName: user.name,
    active: user.status === 'ACTIVE',
    title: user.role,
    emails: [{ value: user.email, primary: true, type: 'work' }],
    phoneNumbers: user.phone ? [{ value: user.phone, type: 'work' }] : [],
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      lastModified: user.updatedAt || user.createdAt,
      location: `${baseUrl}/Users/${user.id}`,
    },
  };
}

function scimError(res: Response, status: number, detail: string): void {
  res.status(status).json({
    schemas: [SCIM_SCHEMA_ERROR],
    status: String(status),
    detail,
  });
}

function baseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}/scim/v2`;
}

export function createScimRoutes(): Router {
  const router = Router();

  // Apply SCIM Bearer auth to all routes
  router.use(scimAuthMiddleware);

  // -------------------------------------------------------------------------
  // ServiceProviderConfig — tells the IdP what features we support
  // -------------------------------------------------------------------------
  router.get('/ServiceProviderConfig', (_req, res) => {
    res.json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://sgsland.vn/docs/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Token standard',
          specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
          primary: true,
        },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // ResourceTypes
  // -------------------------------------------------------------------------
  router.get('/ResourceTypes', (_req, res) => {
    res.json({
      schemas: [SCIM_SCHEMA_LIST],
      totalResults: 2,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/Users',
          schema: SCIM_SCHEMA_USER,
        },
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'Group',
          name: 'Group',
          endpoint: '/Groups',
          schema: SCIM_SCHEMA_GROUP,
        },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // Schemas
  // -------------------------------------------------------------------------
  router.get('/Schemas', (_req, res) => {
    res.json({
      schemas: [SCIM_SCHEMA_LIST],
      totalResults: 1,
      Resources: [
        {
          id: SCIM_SCHEMA_USER,
          name: 'User',
          description: 'User Account',
          attributes: [
            { name: 'userName', type: 'string', required: true, uniqueness: 'server' },
            { name: 'name', type: 'complex', subAttributes: [{ name: 'formatted' }, { name: 'givenName' }, { name: 'familyName' }] },
            { name: 'displayName', type: 'string' },
            { name: 'active', type: 'boolean' },
            { name: 'emails', type: 'complex', multiValued: true },
            { name: 'phoneNumbers', type: 'complex', multiValued: true },
            { name: 'title', type: 'string' },
          ],
        },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // GET /Users — list with optional filter support
  // -------------------------------------------------------------------------
  router.get('/Users', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const startIndex = Math.max(1, parseInt(req.query.startIndex as string) || 1);
      const count = Math.min(200, Math.max(1, parseInt(req.query.count as string) || 100));

      const filters: any = {};
      // Support simple filter: userName eq "user@example.com"
      const filterStr = req.query.filter as string | undefined;
      if (filterStr) {
        const match = filterStr.match(/userName\s+eq\s+"?([^"]+)"?/i);
        if (match) filters.search = match[1];
      }

      const result = await userRepository.listUsers(tenantId, { page: Math.ceil(startIndex / count), pageSize: count }, filters);
      const base = baseUrl(req);

      res.json({
        schemas: [SCIM_SCHEMA_LIST],
        totalResults: result.total,
        startIndex,
        itemsPerPage: count,
        Resources: result.data.map((u: any) => internalUserToScim(u, base)),
      });
    } catch (err) {
      logger.error('[SCIM] GET /Users error:', err);
      scimError(res, 500, 'Failed to list users');
    }
  });

  // -------------------------------------------------------------------------
  // GET /Users/:id
  // -------------------------------------------------------------------------
  router.get('/Users/:id', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const user = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);
      if (!user) return scimError(res, 404, 'User not found');
      res.json(internalUserToScim(user, baseUrl(req)));
    } catch (err) {
      logger.error('[SCIM] GET /Users/:id error:', err);
      scimError(res, 500, 'Failed to fetch user');
    }
  });

  // -------------------------------------------------------------------------
  // POST /Users — create (provision) a new user
  // -------------------------------------------------------------------------
  router.post('/Users', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const { userName, name, active, title, phoneNumbers, externalId, emails } = req.body;

      const email = userName || emails?.[0]?.value;
      if (!email) return scimError(res, 400, 'userName (email) is required');

      const displayName = name?.formatted
        || [name?.givenName, name?.familyName].filter(Boolean).join(' ')
        || email.split('@')[0];

      // Check existing
      const existing = await userRepository.findByEmail(tenantId, email);
      if (existing) {
        // If existing and active=true requested, re-activate
        if (active === true && existing.status !== 'ACTIVE') {
          await userRepository.update(tenantId, existing.id, { status: 'ACTIVE' });
        }
        const updated = await userRepository.findByIdDirect(existing.id, tenantId);
        res.status(200).json(internalUserToScim(updated!, baseUrl(req)));
        return;
      }

      const role = scimTitleToRole(title);
      const phone = phoneNumbers?.[0]?.value || undefined;

      const user = await userRepository.create(tenantId, {
        name: displayName,
        email,
        role,
        phone,
        source: 'SCIM',
        metadata: { scimExternalId: externalId || null, scimProvisioned: true },
      });

      logger.info(`[SCIM] Provisioned user ${user.id} (${email}) for tenant ${tenantId}`);
      res.status(201).json(internalUserToScim(user, baseUrl(req)));
    } catch (err) {
      logger.error('[SCIM] POST /Users error:', err);
      scimError(res, 500, 'Failed to create user');
    }
  });

  // -------------------------------------------------------------------------
  // PUT /Users/:id — full replace
  // -------------------------------------------------------------------------
  router.put('/Users/:id', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const { name, active, title, phoneNumbers, externalId } = req.body;

      const existing = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);
      if (!existing) return scimError(res, 404, 'User not found');

      const displayName = name?.formatted
        || [name?.givenName, name?.familyName].filter(Boolean).join(' ')
        || existing.name;
      const role = scimTitleToRole(title) || existing.role;
      const status = active === false ? 'INACTIVE' : 'ACTIVE';
      const phone = phoneNumbers?.[0]?.value || existing.phone;

      const updates: any = { name: displayName, role, status, phone };
      if (externalId) {
        updates.metadata = { ...(existing.metadata || {}), scimExternalId: externalId };
      }

      await userRepository.update(tenantId, req.params.id as string as string, updates);
      const updated = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);

      if (active === false) {
        logger.info(`[SCIM] Deprovisioned (deactivated) user ${req.params.id as string} for tenant ${tenantId}`);
      }

      res.json(internalUserToScim(updated!, baseUrl(req)));
    } catch (err) {
      logger.error('[SCIM] PUT /Users/:id error:', err);
      scimError(res, 500, 'Failed to update user');
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /Users/:id — partial update (RFC 7644 §3.5.2)
  // Supports op: "Replace" and op: "Add" on the Operations array
  // -------------------------------------------------------------------------
  router.patch('/Users/:id', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const { Operations } = req.body;
      if (!Array.isArray(Operations)) return scimError(res, 400, 'Operations array is required');

      const existing = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);
      if (!existing) return scimError(res, 404, 'User not found');

      const updates: any = {};

      for (const op of Operations) {
        const { op: opType, path, value } = op;
        const operation = (opType || '').toLowerCase();

        if ((operation === 'replace' || operation === 'add') && path === 'active') {
          updates.status = value === false || value === 'false' ? 'INACTIVE' : 'ACTIVE';
        } else if ((operation === 'replace' || operation === 'add') && path === 'name.formatted') {
          updates.name = value;
        } else if ((operation === 'replace' || operation === 'add') && path === 'title') {
          updates.role = scimTitleToRole(value);
        } else if (!path && value && typeof value === 'object') {
          // No path: value contains the fields to update
          if (value.active !== undefined) updates.status = value.active === false ? 'INACTIVE' : 'ACTIVE';
          if (value['name.formatted']) updates.name = value['name.formatted'];
          if (value.title) updates.role = scimTitleToRole(value.title);
        }
      }

      if (Object.keys(updates).length > 0) {
        await userRepository.update(tenantId, req.params.id as string as string, updates);
      }

      const updated = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);
      res.json(internalUserToScim(updated!, baseUrl(req)));
    } catch (err) {
      logger.error('[SCIM] PATCH /Users/:id error:', err);
      scimError(res, 500, 'Failed to patch user');
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /Users/:id — deprovision (deactivate, not hard delete)
  // -------------------------------------------------------------------------
  router.delete('/Users/:id', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const existing = await userRepository.findByIdDirect(req.params.id as string as string, tenantId);
      if (!existing) return scimError(res, 404, 'User not found');

      await userRepository.update(tenantId, req.params.id as string as string, { status: 'INACTIVE' });
      logger.info(`[SCIM] Deprovisioned user ${req.params.id as string} (set INACTIVE) for tenant ${tenantId}`);

      res.status(204).send();
    } catch (err) {
      logger.error('[SCIM] DELETE /Users/:id error:', err);
      scimError(res, 500, 'Failed to deprovision user');
    }
  });

  // -------------------------------------------------------------------------
  // GET /Groups — list tenant teams as SCIM groups (read-only)
  // -------------------------------------------------------------------------
  router.get('/Groups', async (req: Request, res: Response) => {
    const tenantId = (req as any).scimTenantId;
    try {
      const teams = await userRepository.getTeams(tenantId);
      const base = baseUrl(req);

      const resources = teams.map((team: any) => ({
        schemas: [SCIM_SCHEMA_GROUP],
        id: team.id || team.name,
        displayName: team.name,
        members: [],
        meta: {
          resourceType: 'Group',
          location: `${base}/Groups/${team.id || encodeURIComponent(team.name)}`,
        },
      }));

      res.json({
        schemas: [SCIM_SCHEMA_LIST],
        totalResults: resources.length,
        startIndex: 1,
        itemsPerPage: resources.length,
        Resources: resources,
      });
    } catch (err) {
      logger.error('[SCIM] GET /Groups error:', err);
      scimError(res, 500, 'Failed to list groups');
    }
  });

  // GET /Groups/:id — not directly supported; return 404 gracefully
  router.get('/Groups/:id', (_req, res) => {
    scimError(res, 404, 'Group not found');
  });

  return router;
}
