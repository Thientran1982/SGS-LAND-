/**
 * Tenant routes — config + white-label branding & host binding.
 *
 *   GET  /api/tenant                              — current tenant info (mọi user)
 *   GET  /api/tenant/branding                     — branding payload + bindings
 *   PUT  /api/tenant/branding                     — update branding (ADMIN only)
 *   POST /api/tenant/subdomain                    — đăng ký <slug>.sgsland.vn (ADMIN)
 *   DELETE /api/tenant/subdomain                  — gỡ subdomain
 *   POST /api/tenant/custom-domain                — đăng ký custom domain → trả TXT token
 *   POST /api/tenant/custom-domain/verify         — force-verify ngay
 *   DELETE /api/tenant/custom-domain              — gỡ custom domain
 *
 * RBAC: ADMIN/SUPER_ADMIN của tenant đó. Body validate strict (slug regex,
 * hostname RFC 1123, hex color, max length). Mỗi mutation invalidate cache.
 */

import { Router, Request, Response } from 'express';
import { pool, withRlsBypass } from '../db';
import { logger } from '../middleware/logger';
import {
  brandingFromConfig,
  evictHostCacheByTenant,
  EMPTY_BRANDING,
  generateTxtToken,
  getApexDomain,
  getTenantBinding,
  normalizeBrandingInput,
  validateHostname,
  validateSlug,
  verifyCustomDomainTxt,
  type TenantBranding,
} from '../services/tenantBrandingService';
import { evictPublicProjectCacheByTenant } from '../services/publicProjectCache';
import { writeAuditLog } from '../middleware/auditLog';

const DEFAULT_CONFIG = {
  primaryColor: '#4F46E5',
  features: { enableZalo: true, maxUsers: 100 },
};

interface AuthedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

function getUser(req: Request): AuthedUser | null {
  const u = (req as any).user;
  if (!u || !u.tenantId) return null;
  return u as AuthedUser;
}

function requireAdmin(req: Request, res: Response): AuthedUser | null {
  const u = getUser(req);
  if (!u) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(u.role)) {
    res.status(403).json({ error: 'Chỉ ADMIN tenant mới được sửa cấu hình thương hiệu.' });
    return null;
  }
  return u;
}

interface BindingPayload {
  apexDomain: string;
  subdomainSlug: string | null;
  subdomainUrl: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  customDomainTxtRecord: { name: string; value: string } | null;
}

interface BrandingResponse {
  tenantId: string;
  tenantName: string;
  branding: TenantBranding;
  binding: BindingPayload;
}

async function loadBrandingResponse(tenantId: string): Promise<BrandingResponse | null> {
  const row = await withRlsBypass(async (client) => {
    const r = await client.query<{
      id: string;
      name: string;
      config: any;
      subdomain_slug: string | null;
      custom_domain: string | null;
      custom_domain_verified_at: string | null;
      custom_domain_txt_token: string | null;
    }>(
      `SELECT id, name, config, subdomain_slug, custom_domain,
              custom_domain_verified_at, custom_domain_txt_token
         FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    return r.rows[0] || null;
  });
  if (!row) return null;
  const apex = getApexDomain();
  const binding: BindingPayload = {
    apexDomain: apex,
    subdomainSlug: row.subdomain_slug,
    subdomainUrl: row.subdomain_slug ? `https://${row.subdomain_slug}.${apex}` : null,
    customDomain: row.custom_domain,
    customDomainVerifiedAt: row.custom_domain_verified_at,
    customDomainTxtRecord: row.custom_domain && row.custom_domain_txt_token
      ? { name: `_sgsland.${row.custom_domain}`, value: row.custom_domain_txt_token }
      : null,
  };
  return {
    tenantId: row.id,
    tenantName: row.name,
    branding: brandingFromConfig(row.config),
    binding,
  };
}

function invalidate(tenantId: string): void {
  evictHostCacheByTenant(tenantId);
  evictPublicProjectCacheByTenant(tenantId);
}

export function createTenantRoutes(authenticateToken: any): Router {
  const router = Router();

  // ── GET /api/tenant — current tenant summary (legacy) ─────────────────────
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const u = getUser(req);
      if (!u) return res.status(400).json({ error: 'No tenant context' });

      const result = await pool.query(
        `SELECT id, name, domain, config FROM tenants WHERE id = $1`,
        [u.tenantId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
      const row = result.rows[0];
      const config = row.config && Object.keys(row.config).length > 0 ? row.config : DEFAULT_CONFIG;
      res.json({ id: row.id, name: row.name, domain: row.domain, config });
    } catch (error) {
      logger.error('Error fetching tenant:', error);
      res.status(500).json({ error: 'Failed to fetch tenant' });
    }
  });

  // ── GET /api/tenant/branding ─────────────────────────────────────────────
  router.get('/branding', authenticateToken, async (req: Request, res: Response) => {
    const u = getUser(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const data = await loadBrandingResponse(u.tenantId);
      if (!data) return res.status(404).json({ error: 'Tenant not found' });
      res.json(data);
    } catch (err: any) {
      logger.error(`[Tenant] GET /branding failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to load branding' });
    }
  });

  // ── PUT /api/tenant/branding ─────────────────────────────────────────────
  router.put('/branding', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    try {
      const branding = normalizeBrandingInput(req.body?.branding ?? req.body);
      // Merge into config jsonb — chỉ override key `branding`, giữ nguyên các key
      // khác (theme, email, sso, ...). jsonb_set tạo cột nếu chưa có.
      await withRlsBypass(async (client) => {
        await client.query(
          `UPDATE tenants
              SET config = jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{branding}',
                $2::jsonb,
                true
              )
              WHERE id = $1`,
          [u.tenantId, JSON.stringify(branding)]
        );
      });
      invalidate(u.tenantId);
      writeAuditLog(u.tenantId, u.id, 'TENANT_BRANDING_UPDATE', 'tenant', u.tenantId, { branding }, req.ip);
      const data = await loadBrandingResponse(u.tenantId);
      res.json(data ?? { tenantId: u.tenantId, branding, binding: null });
    } catch (err: any) {
      logger.error(`[Tenant] PUT /branding failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to update branding' });
    }
  });

  // ── POST /api/tenant/subdomain ───────────────────────────────────────────
  router.post('/subdomain', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    const v = validateSlug(String(req.body?.slug || ''));
    if (!v.ok) return res.status(400).json({ error: (v as { error: string }).error });
    try {
      // Check uniqueness across tenants (cho phép giữ nguyên slug của chính tenant)
      const existing = await withRlsBypass(async (client) => {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM tenants WHERE LOWER(subdomain_slug) = $1 AND id <> $2 LIMIT 1`,
          [v.slug, u.tenantId]
        );
        return r.rows[0];
      });
      if (existing) {
        return res.status(409).json({ error: `Slug "${v.slug}" đã được dùng bởi tenant khác.` });
      }
      await withRlsBypass(async (client) => {
        await client.query(
          `UPDATE tenants SET subdomain_slug = $2 WHERE id = $1`,
          [u.tenantId, v.slug]
        );
      });
      invalidate(u.tenantId);
      writeAuditLog(u.tenantId, u.id, 'TENANT_SUBDOMAIN_SET', 'tenant', u.tenantId, { slug: v.slug }, req.ip);
      const data = await loadBrandingResponse(u.tenantId);
      res.json(data);
    } catch (err: any) {
      logger.error(`[Tenant] POST /subdomain failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to set subdomain' });
    }
  });

  // ── DELETE /api/tenant/subdomain ─────────────────────────────────────────
  router.delete('/subdomain', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    try {
      await withRlsBypass(async (client) => {
        await client.query(`UPDATE tenants SET subdomain_slug = NULL WHERE id = $1`, [u.tenantId]);
      });
      invalidate(u.tenantId);
      writeAuditLog(u.tenantId, u.id, 'TENANT_SUBDOMAIN_REMOVE', 'tenant', u.tenantId, undefined, req.ip);
      const data = await loadBrandingResponse(u.tenantId);
      res.json(data);
    } catch (err: any) {
      logger.error(`[Tenant] DELETE /subdomain failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to remove subdomain' });
    }
  });

  // ── POST /api/tenant/custom-domain ───────────────────────────────────────
  router.post('/custom-domain', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    const v = validateHostname(String(req.body?.hostname || ''));
    if (!v.ok) return res.status(400).json({ error: (v as { error: string }).error });
    try {
      const existing = await withRlsBypass(async (client) => {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM tenants WHERE LOWER(custom_domain) = $1 AND id <> $2 LIMIT 1`,
          [v.hostname, u.tenantId]
        );
        return r.rows[0];
      });
      if (existing) {
        return res.status(409).json({ error: `Tên miền "${v.hostname}" đã được tenant khác đăng ký.` });
      }
      const txtToken = generateTxtToken();
      await withRlsBypass(async (client) => {
        await client.query(
          `UPDATE tenants
              SET custom_domain = $2,
                  custom_domain_txt_token = $3,
                  custom_domain_verified_at = NULL
              WHERE id = $1`,
          [u.tenantId, v.hostname, txtToken]
        );
      });
      invalidate(u.tenantId);
      writeAuditLog(u.tenantId, u.id, 'TENANT_CUSTOM_DOMAIN_SET', 'tenant', u.tenantId, { hostname: v.hostname }, req.ip);
      const data = await loadBrandingResponse(u.tenantId);
      res.json(data);
    } catch (err: any) {
      logger.error(`[Tenant] POST /custom-domain failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to set custom domain' });
    }
  });

  // ── POST /api/tenant/custom-domain/verify — force re-check now ───────────
  router.post('/custom-domain/verify', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    try {
      const row = await withRlsBypass(async (client) => {
        const r = await client.query<{ custom_domain: string | null; custom_domain_txt_token: string | null }>(
          `SELECT custom_domain, custom_domain_txt_token FROM tenants WHERE id = $1 LIMIT 1`,
          [u.tenantId]
        );
        return r.rows[0];
      });
      if (!row?.custom_domain || !row.custom_domain_txt_token) {
        return res.status(400).json({ error: 'Chưa cấu hình custom domain.' });
      }
      const ok = await verifyCustomDomainTxt(row.custom_domain, row.custom_domain_txt_token);
      if (ok) {
        await withRlsBypass(async (client) => {
          await client.query(
            `UPDATE tenants SET custom_domain_verified_at = NOW()
                WHERE id = $1 AND custom_domain_verified_at IS NULL`,
            [u.tenantId]
          );
        });
        invalidate(u.tenantId);
        writeAuditLog(u.tenantId, u.id, 'TENANT_CUSTOM_DOMAIN_VERIFIED', 'tenant', u.tenantId, { hostname: row.custom_domain }, req.ip);
      }
      const data = await loadBrandingResponse(u.tenantId);
      res.json({ verified: ok, ...data });
    } catch (err: any) {
      logger.error(`[Tenant] POST /custom-domain/verify failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to verify custom domain' });
    }
  });

  // ── DELETE /api/tenant/custom-domain ─────────────────────────────────────
  router.delete('/custom-domain', authenticateToken, async (req: Request, res: Response) => {
    const u = requireAdmin(req, res);
    if (!u) return;
    try {
      await withRlsBypass(async (client) => {
        await client.query(
          `UPDATE tenants
              SET custom_domain = NULL,
                  custom_domain_txt_token = NULL,
                  custom_domain_verified_at = NULL
              WHERE id = $1`,
          [u.tenantId]
        );
      });
      invalidate(u.tenantId);
      writeAuditLog(u.tenantId, u.id, 'TENANT_CUSTOM_DOMAIN_REMOVE', 'tenant', u.tenantId, undefined, req.ip);
      const data = await loadBrandingResponse(u.tenantId);
      res.json(data);
    } catch (err: any) {
      logger.error(`[Tenant] DELETE /custom-domain failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Failed to remove custom domain' });
    }
  });

  return router;
}

// Re-export để các route khác có thể đọc binding qua tenantId
export { getTenantBinding, EMPTY_BRANDING };
