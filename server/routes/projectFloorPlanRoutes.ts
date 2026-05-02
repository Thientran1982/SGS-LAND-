/**
 * projectFloorPlanRoutes.ts
 *
 * Endpoints for the Sa bàn (interactive floor plan) feature.
 * Mounted by createProjectRoutes inside server/routes/projectRoutes.ts —
 * shares the `/api/projects/:id` prefix.
 *
 * Surfaces:
 *   GET  /:projectId/floor-plans                       — list plans for a project
 *   POST /:projectId/floor-plans                       — upload SVG (multipart)
 *   GET  /:projectId/floor-plans/:planId               — get plan + listing mapping + statuses
 *   GET  /:projectId/floor-plans/:planId/svg           — sanitized SVG markup (text/xml)
 *   GET  /:projectId/floor-plans/:planId/statuses      — minimal status map (poll target)
 *   DELETE /:projectId/floor-plans/:planId             — remove plan
 *
 * Permissions:
 *   - View (GET): any authenticated tenant member with project access.
 *     PARTNER_AGENT requires project_access (checked via projectRepository.checkPartnerAccess).
 *     For partners, the listing mapping is filtered to listings they have access to.
 *   - Mutate (POST/DELETE): SUPER_ADMIN, ADMIN, TEAM_LEAD only.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { projectFloorPlanRepository } from '../repositories/projectFloorPlanRepository';
import { projectRepository } from '../repositories/projectRepository';
import { listingRepository } from '../repositories/listingRepository';
import { sanitizeAndParseSvg } from '../services/svgSanitizer';
import { storeFile, getFileBuffer, deleteFile } from '../services/storageService';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const MUTATE_ROLES = [...ADMIN_ROLES, 'TEAM_LEAD'];
const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];

const MAX_SVG_BYTES = 2 * 1024 * 1024; // 2 MB

const svgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SVG_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    // Multer mimetype is supplied by the browser; we still re-validate the
    // bytes during sanitizeAndParseSvg() (root must contain <svg>, no DOCTYPE).
    if (file.mimetype !== 'image/svg+xml' && file.mimetype !== 'text/xml' && file.mimetype !== 'application/xml') {
      return cb(new Error('SVG_INVALID_MIME'));
    }
    cb(null, true);
  },
});

function safeFilename(name: string): string {
  // SAFE_FILENAME_REGEX in uploadRoutes.ts is /^[a-zA-Z0-9._-]+$/
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200);
}

async function ensureProjectAccess(
  user: { tenantId: string; role: string },
  projectId: string,
): Promise<{ ok: true; isPartner: boolean } | { ok: false; status: number; error: string }> {
  if (PARTNER_ROLES.includes(user.role)) {
    const has = await projectRepository.checkPartnerAccess(user.tenantId, projectId);
    if (!has) return { ok: false, status: 403, error: 'Không có quyền truy cập dự án này' };
    return { ok: true, isPartner: true };
  }
  // Owner-tenant member: project must exist within their tenant.
  const project = await projectRepository.findById(user.tenantId, projectId);
  if (!project) return { ok: false, status: 404, error: 'Không tìm thấy dự án' };
  return { ok: true, isPartner: false };
}

interface ListingLite {
  id: string;
  code: string;
  status: string;
  tower?: string | null;
  floor?: string | null;
}

/**
 * Fetch all listings of a project that this user can see.
 * Owner-tenant: every listing of the project.
 * Partner: only listings they have access to (project_access + optional listing_access).
 */
async function fetchProjectListings(
  user: { tenantId: string; userId: string; role: string },
  projectId: string,
  isPartner: boolean,
): Promise<ListingLite[]> {
  if (isPartner) {
    const result = await listingRepository.findListingsForPartner(user.tenantId, {
      projectId,
      page: 1,
      pageSize: 5000,
    });
    return (result.data || []).map((l: any) => ({
      id: l.id,
      code: String(l.code || '').toUpperCase(),
      status: l.status,
      tower: l.attributes?.tower ?? null,
      floor: l.attributes?.floor != null ? String(l.attributes.floor) : null,
    }));
  }
  const result = await listingRepository.findListings(
    user.tenantId,
    { page: 1, pageSize: 5000 },
    { projectId },
    { userId: user.userId, userRole: user.role },
  );
  return (result.data || []).map((l: any) => ({
    id: l.id,
    code: String(l.code || '').toUpperCase(),
    status: l.status,
    tower: l.attributes?.tower ?? null,
    floor: l.attributes?.floor != null ? String(l.attributes.floor) : null,
  }));
}

/**
 * Build the data-code → listingId map for a plan.
 * `parsedCodes` are already uppercased + trimmed by the sanitizer.
 */
function buildMapping(
  parsedCodes: string[],
  listings: ListingLite[],
): {
  mapping: Record<string, string>;
  statuses: Record<string, string>;
  unmatchedCodes: string[];
  matchedListingIds: string[];
} {
  const byCode = new Map<string, ListingLite>();
  for (const l of listings) {
    if (l.code) byCode.set(l.code, l);
  }
  const mapping: Record<string, string> = {};
  const statuses: Record<string, string> = {};
  const matchedIds: string[] = [];
  const unmatched: string[] = [];
  for (const code of parsedCodes) {
    const l = byCode.get(code);
    if (l) {
      mapping[code] = l.id;
      statuses[l.id] = l.status;
      matchedIds.push(l.id);
    } else {
      unmatched.push(code);
    }
  }
  return { mapping, statuses, unmatchedCodes: unmatched, matchedListingIds: matchedIds };
}

/**
 * Mounts /:id/floor-plans/* routes onto an existing express router.
 * The caller is responsible for installing `authenticateToken` (we accept it
 * as parameter for symmetry with the other route factories).
 */
export function registerFloorPlanRoutes(router: Router, authenticateToken: any) {
  // ─── List plans ──────────────────────────────────────────────────────────
  router.get('/:id/floor-plans', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projectId = String(req.params.id);
      const access = await ensureProjectAccess(user, projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const plans = await projectFloorPlanRepository.findByProject(user.tenantId, projectId);
      // Lightweight payload — no SVG body, no mapping.
      res.json(
        plans.map((p) => ({
          id: p.id,
          tower: p.tower,
          floor: p.floor,
          svgUrl: p.svg_url,
          svgFilename: p.svg_filename,
          codeCount: Array.isArray(p.parsed_codes) ? p.parsed_codes.length : 0,
          notes: p.notes,
          updatedAt: p.updated_at,
        })),
      );
    } catch (err) {
      console.error('Floor plan list error:', err);
      res.status(500).json({ error: 'Không thể tải danh sách sa bàn' });
    }
  });

  // ─── Upload / replace plan ───────────────────────────────────────────────
  router.post(
    '/:id/floor-plans',
    authenticateToken,
    (req: Request, res: Response, next: NextFunction) => {
      svgUpload.single('svg')(req, res, (err: any) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE')
            return res.status(413).json({ error: 'File SVG quá lớn (tối đa 2MB)' });
          return res.status(400).json({ error: `Lỗi upload: ${err.message}` });
        }
        if (err?.message === 'SVG_INVALID_MIME')
          return res.status(400).json({ error: 'Chỉ chấp nhận file SVG (image/svg+xml)' });
        return res.status(400).json({ error: err?.message || 'Lỗi upload' });
      });
    },
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        if (!MUTATE_ROLES.includes(user.role))
          return res.status(403).json({ error: 'Không có quyền thực hiện' });

        const projectId = String(req.params.id);
        const project = await projectRepository.findById(user.tenantId, projectId);
        if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: 'Thiếu file SVG' });

        const tower = projectFloorPlanRepository.normTower(req.body?.tower);
        const floor = projectFloorPlanRepository.normFloor(req.body?.floor);
        const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 500) : null;

        const rawSvg = file.buffer.toString('utf8');
        let sanitized;
        try {
          sanitized = sanitizeAndParseSvg(rawSvg);
        } catch (e: any) {
          const code = String(e?.message || 'SVG_INVALID');
          const msg =
            code === 'SVG_TOO_LARGE'
              ? 'File SVG quá lớn'
              : code === 'SVG_INVALID_ROOT'
                ? 'File không phải SVG hợp lệ (thiếu thẻ <svg>)'
                : code === 'SVG_DOCTYPE_NOT_ALLOWED'
                  ? 'SVG chứa DOCTYPE/ENTITY không an toàn'
                  : 'SVG không hợp lệ';
          return res.status(400).json({ error: msg, code });
        }

        // Persist sanitized SVG (not raw) so anything served later is already safe.
        const ts = Date.now();
        const baseName = safeFilename(path.basename(file.originalname || 'plan.svg', path.extname(file.originalname || '.svg')));
        const filename = `floorplan-${ts}-${baseName}.svg`;
        const svgUrl = await storeFile(
          user.tenantId,
          filename,
          Buffer.from(sanitized.svg, 'utf8'),
          'image/svg+xml',
        );

        const previous = await projectFloorPlanRepository.findByTowerFloor(
          user.tenantId,
          projectId,
          tower,
          floor,
        );

        const row = await projectFloorPlanRepository.upsert(user.tenantId, projectId, {
          tower,
          floor,
          svgUrl,
          svgFilename: filename,
          parsedCodes: sanitized.codes,
          notes,
          uploadedBy: user.userId,
        });

        // Best-effort: drop the previous SVG file from storage on replace.
        if (previous && previous.svg_filename && previous.svg_filename !== filename) {
          try {
            await deleteFile(user.tenantId, previous.svg_filename);
          } catch (e) {
            // Non-fatal — the row is updated regardless.
            console.warn('Floor plan: failed to delete previous SVG', previous.svg_filename, e);
          }
        }

        // Diff against current project listings so the admin sees gaps immediately.
        const listings = await fetchProjectListings(user, projectId, false);
        const { mapping, unmatchedCodes, matchedListingIds } = buildMapping(
          sanitized.codes,
          listings,
        );
        const matchedSet = new Set(matchedListingIds);
        const extraListings = listings
          .filter((l) => !matchedSet.has(l.id))
          .map((l) => ({ id: l.id, code: l.code, tower: l.tower, floor: l.floor }));

        res.status(201).json({
          plan: {
            id: row.id,
            tower: row.tower,
            floor: row.floor,
            svgUrl: row.svg_url,
            svgFilename: row.svg_filename,
            codeCount: sanitized.codes.length,
            notes: row.notes,
            updatedAt: row.updated_at,
          },
          codes: sanitized.codes,
          mapping,
          unmatchedCodes,
          extraListings,
          sanitizerStats: sanitized.removed,
        });
      } catch (err) {
        console.error('Floor plan upload error:', err);
        res.status(500).json({ error: 'Không thể lưu sa bàn' });
      }
    },
  );

  // ─── Get single plan + mapping + statuses ────────────────────────────────
  router.get(
    '/:id/floor-plans/:planId',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const projectId = String(req.params.id);
        const planId = String(req.params.planId);

        const access = await ensureProjectAccess(user, projectId);
        if (!access.ok) return res.status(access.status).json({ error: access.error });

        const row = await projectFloorPlanRepository.findById(user.tenantId, planId);
        if (!row || row.project_id !== projectId)
          return res.status(404).json({ error: 'Không tìm thấy sa bàn' });

        const codes = Array.isArray(row.parsed_codes) ? (row.parsed_codes as string[]) : [];
        const listings = await fetchProjectListings(user, projectId, access.isPartner);
        const { mapping, statuses, unmatchedCodes } = buildMapping(codes, listings);

        res.json({
          plan: {
            id: row.id,
            tower: row.tower,
            floor: row.floor,
            svgUrl: row.svg_url,
            svgFilename: row.svg_filename,
            codeCount: codes.length,
            notes: row.notes,
            updatedAt: row.updated_at,
          },
          codes,
          mapping,
          statuses,
          unmatchedCodes: access.isPartner ? [] : unmatchedCodes,
        });
      } catch (err) {
        console.error('Floor plan fetch error:', err);
        res.status(500).json({ error: 'Không thể tải sa bàn' });
      }
    },
  );

  // ─── Lightweight status poll (30s setInterval target) ────────────────────
  router.get(
    '/:id/floor-plans/:planId/statuses',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const projectId = String(req.params.id);
        const planId = String(req.params.planId);

        const access = await ensureProjectAccess(user, projectId);
        if (!access.ok) return res.status(access.status).json({ error: access.error });

        const row = await projectFloorPlanRepository.findById(user.tenantId, planId);
        if (!row || row.project_id !== projectId)
          return res.status(404).json({ error: 'Không tìm thấy sa bàn' });

        const codes = Array.isArray(row.parsed_codes) ? (row.parsed_codes as string[]) : [];
        const listings = await fetchProjectListings(user, projectId, access.isPartner);
        const { statuses } = buildMapping(codes, listings);

        // No long cache — viewer polls every 30s.
        res.setHeader('Cache-Control', 'private, max-age=10');
        res.json({ statuses, refreshedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Floor plan status poll error:', err);
        res.status(500).json({ error: 'Không thể tải trạng thái sa bàn' });
      }
    },
  );

  // ─── Inline sanitized SVG content (for fetch + dangerouslySetInnerHTML) ─
  router.get(
    '/:id/floor-plans/:planId/svg',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const projectId = String(req.params.id);
        const planId = String(req.params.planId);

        const access = await ensureProjectAccess(user, projectId);
        if (!access.ok) return res.status(access.status).json({ error: access.error });

        const row = await projectFloorPlanRepository.findById(user.tenantId, planId);
        if (!row || row.project_id !== projectId)
          return res.status(404).json({ error: 'Không tìm thấy sa bàn' });

        const fileRow = await getFileBuffer(user.tenantId, row.svg_filename);
        if (!fileRow) return res.status(404).json({ error: 'File SVG không tồn tại' });

        // Re-sanitize on serve — defense-in-depth in case stored bytes were
        // tampered with via direct DB access.
        let safeXml: string;
        try {
          const parsed = sanitizeAndParseSvg(fileRow.buffer.toString('utf8'));
          safeXml = parsed.svg;
        } catch {
          return res.status(500).json({ error: 'SVG bị hỏng' });
        }

        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=300');
        // Strict CSP just for this response — script execution must not happen
        // from this surface even if a future regression weakens the sanitizer.
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'",
        );
        res.send(safeXml);
      } catch (err) {
        console.error('Floor plan svg serve error:', err);
        res.status(500).json({ error: 'Không thể tải SVG' });
      }
    },
  );

  // ─── Delete plan ─────────────────────────────────────────────────────────
  router.delete(
    '/:id/floor-plans/:planId',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        if (!MUTATE_ROLES.includes(user.role))
          return res.status(403).json({ error: 'Không có quyền thực hiện' });

        const projectId = String(req.params.id);
        const planId = String(req.params.planId);
        const row = await projectFloorPlanRepository.findById(user.tenantId, planId);
        if (!row || row.project_id !== projectId)
          return res.status(404).json({ error: 'Không tìm thấy sa bàn' });

        const ok = await projectFloorPlanRepository.deleteById(user.tenantId, planId);
        if (!ok) return res.status(404).json({ error: 'Không tìm thấy sa bàn' });

        // Best-effort SVG file cleanup
        try {
          await deleteFile(user.tenantId, row.svg_filename);
        } catch (e) {
          console.warn('Floor plan delete: failed to remove SVG file', row.svg_filename, e);
        }

        res.json({ success: true });
      } catch (err) {
        console.error('Floor plan delete error:', err);
        res.status(500).json({ error: 'Không thể xoá sa bàn' });
      }
    },
  );
}
