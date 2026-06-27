/**
 * Public Developer (Chu dau tu) Routes - GEO/AEO
 *
 *   GET /api/public/developers           -> danh sach chu dau tu cong khai
 *   GET /api/public/developers/:slug     -> chi tiet 1 chu dau tu + danh sach du an
 *
 * Hardening:
 *  - Khong co middleware xac thuc (whitelisted public endpoint).
 *  - Chi tra cac truong da duoc whitelist; khong leak du lieu noi bo.
 *  - Truy van qua withRlsBypass (doc cross-tenant cho trang cong khai).
 *  - Cache headers giong publicProjectRoutes.
 */
import { Router, Request, Response } from 'express';
import { withRlsBypass } from '../db';
import { logger } from '../middleware/logger';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$/;

interface DeveloperRow {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  brand: string | null;
  stock_code: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  logo_url: string | null;
  charter_capital: string | null;
  projects_delivered: number | null;
  land_bank_ha: string | null;
  awards: unknown;
  summary: string | null;
  description: string | null;
  faq: unknown;
  metadata: unknown;
}

function toPublicSummary(d: DeveloperRow) {
  return {
    slug: d.slug,
    name: d.name,
    brand: d.brand,
    headquarters: d.headquarters,
    logoUrl: d.logo_url,
    projectsDelivered: d.projects_delivered,
    summary: d.summary,
  };
}

export function createPublicDeveloperRoutes(): Router {
  const router = Router();

  // GET /api/public/developers -> danh sach chu dau tu cong khai
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const rows = await withRlsBypass(async (client) => {
        const r = await client.query<DeveloperRow>(
          `SELECT id, slug, name, legal_name, brand, stock_code, founded_year,
                  headquarters, website, logo_url, charter_capital,
                  projects_delivered, land_bank_ha, awards, summary,
                  description, faq, metadata
             FROM developers
            WHERE COALESCE(metadata->>'public', 'true') <> 'false'
            ORDER BY COALESCE(projects_delivered, 0) DESC, name ASC
            LIMIT 200`
        );
        return r.rows;
      });

      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.json({ ok: true, developers: rows.map(toPublicSummary), count: rows.length });
    } catch (err: any) {
      logger.error(`[PublicDeveloper] GET / failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Loi may chu. Vui long thu lai.' });
    }
  });

  // GET /api/public/developers/:slug -> chi tiet + danh sach du an
  router.get('/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ ok: false, error: 'Slug chu dau tu khong hop le' });
    }
    try {
      const data = await withRlsBypass(async (client) => {
        const dev = await client.query<DeveloperRow>(
          `SELECT id, slug, name, legal_name, brand, stock_code, founded_year,
                  headquarters, website, logo_url, charter_capital,
                  projects_delivered, land_bank_ha, awards, summary,
                  description, faq, metadata
             FROM developers
            WHERE slug = $1
              AND COALESCE(metadata->>'public', 'true') <> 'false'
            LIMIT 1`,
          [slug]
        );
        if (dev.rows.length === 0) return null;
        const developer = dev.rows[0];
        const projects = await client.query(
          `SELECT id, name, code, location, status, total_units, metadata
             FROM projects
            WHERE developer_id = $1
              AND COALESCE(metadata->>'public_microsite', 'false') = 'true'
            ORDER BY created_at DESC NULLS LAST
            LIMIT 100`,
          [developer.id]
        );
        return { developer, projects: projects.rows };
      });

      if (!data) {
        return res.status(404).json({ ok: false, error: 'Chu dau tu chua cong khai hoac khong ton tai' });
      }

      const d = data.developer;
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.json({
        ok: true,
        developer: {
          slug: d.slug, name: d.name, legalName: d.legal_name, brand: d.brand,
          stockCode: d.stock_code, foundedYear: d.founded_year, headquarters: d.headquarters,
          website: d.website, logoUrl: d.logo_url, charterCapital: d.charter_capital,
          projectsDelivered: d.projects_delivered, landBankHa: d.land_bank_ha,
          awards: d.awards, summary: d.summary, description: d.description, faq: d.faq,
        },
        projects: data.projects.map((p: any) => ({
          name: p.name, code: p.code, location: p.location, status: p.status,
          totalUnits: p.total_units,
        })),
        projectCount: data.projects.length,
        cachedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(`[PublicDeveloper] GET /${slug} failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Loi may chu. Vui long thu lai.' });
    }
  });

  return router;
}
