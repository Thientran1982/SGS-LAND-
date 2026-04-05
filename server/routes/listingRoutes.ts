import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { listingRepository } from '../repositories/listingRepository';
import { auditRepository } from '../repositories/auditRepository';

// ── Server-side geocoding (Nominatim / OpenStreetMap) ────────────────────────
// Runs in the background after create/update so the API response is not delayed.
// Uses HCMC bounding box with bounded=1 so results are always within HCMC.
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';

// Vietnamese district name normalisation (no-diacritics → with diacritics)
// Mirrors utils/vnAddress.ts so the server can geocode no-dấu addresses correctly.
const HCMC_DISTRICT_MAP: Record<string, string> = {
  'binh thanh': 'Bình Thạnh', 'binh tan': 'Bình Tân', 'binh chanh': 'Bình Chánh',
  'thu duc': 'Thủ Đức', 'tan binh': 'Tân Bình', 'tan phu': 'Tân Phú',
  'go vap': 'Gò Vấp', 'phu nhuan': 'Phú Nhuận', 'hoc mon': 'Hóc Môn',
  'cu chi': 'Củ Chi', 'nha be': 'Nhà Bè', 'can gio': 'Cần Giờ',
  'quan 1': 'Quận 1', 'quan 2': 'Quận 2', 'quan 3': 'Quận 3',
  'quan 4': 'Quận 4', 'quan 5': 'Quận 5', 'quan 6': 'Quận 6',
  'quan 7': 'Quận 7', 'quan 8': 'Quận 8', 'quan 9': 'Quận 9',
  'quan 10': 'Quận 10', 'quan 11': 'Quận 11', 'quan 12': 'Quận 12',
};
const ADMIN_MAP: Record<string, string> = {
  '\\bduong\\b': 'Đường', '\\bphuong\\b': 'Phường', '\\bquan\\b': 'Quận',
  '\\bhuyen\\b': 'Huyện', '\\bxa\\b': 'Xã', '\\bhem\\b': 'Hẻm',
};

function normalizeVNSrv(addr: string): string {
  let r = addr;
  for (const [plain, diacritic] of Object.entries(HCMC_DISTRICT_MAP)) {
    const esc = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    r = r.replace(new RegExp(`(?<![\\w\u00C0-\u024F])${esc}(?![\\w\u00C0-\u024F])`, 'gi'), diacritic);
  }
  for (const [pat, diacritic] of Object.entries(ADMIN_MAP)) {
    r = r.replace(new RegExp(pat, 'gi'), diacritic);
  }
  return r;
}

function buildGeoQueriesSrv(location: string): string[] {
  const orig = location.trim();
  const norm = normalizeVNSrv(orig);
  const variants = norm.toLowerCase() !== orig.toLowerCase() ? [orig, norm] : [orig];
  const suffixes = [
    ', Thành phố Hồ Chí Minh, Việt Nam',
    ', Ho Chi Minh City, Vietnam',
    ', TP. HCM, Việt Nam',
    ', Vietnam',
  ];
  return variants.flatMap(v => suffixes.map(s => `${v}${s}`));
}

const NOMINATIM_UA = 'SGSLand/1.0 (contact@sgsland.vn)';

async function fetchNominatim(query: string, bounded: boolean): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(query);
  const boundedParam = bounded ? `&viewbox=${HCMC_VIEWBOX}&bounded=1` : '';
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn${boundedParam}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'vi,en', 'User-Agent': NOMINATIM_UA },
      signal: controller.signal,
    });
    const data = (await res.json()) as any[];
    if (data.length > 0) {
      return {
        lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
        lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeHCMC(location: string): Promise<{ lat: number; lng: number } | null> {
  const queries = buildGeoQueriesSrv(location);
  // Pass 1: try with HCMC bounding box (faster, more precise for local addresses)
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1200));
    const result = await fetchNominatim(queries[i], true);
    if (result) return result;
  }
  // Pass 2: retry without bounding box for non-HCMC addresses (other provinces/cities)
  for (let i = 0; i < Math.min(queries.length, 2); i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1200));
    const result = await fetchNominatim(queries[i], false);
    if (result) return result;
  }
  return null;
}

/** Fire-and-forget: geocode and patch coordinates in DB without blocking the response */
export function scheduleGeocode(tenantId: string, listingId: string, location: string) {
  (async () => {
    try {
      const coords = await geocodeHCMC(location);
      if (coords) {
        await listingRepository.update(tenantId, listingId, { coordinates: coords });
      }
    } catch (e) {
      console.warn('[geocode] background geocoding failed for listing', listingId, e);
    }
  })();
}

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER'];
/** SALES and MARKETING may edit/delete their own or assigned listings; VIEWER is read-only */
const WRITABLE_RESTRICTED_ROLES = ['SALES', 'MARKETING'];

const SENSITIVE_FIELDS = ['ownerName', 'ownerPhone', 'commission', 'commissionUnit', 'consignorName', 'consignorPhone'];

function redactSensitiveFields(item: any) {
  if (!item) return item;
  const copy = { ...item };
  for (const f of SENSITIVE_FIELDS) delete copy[f];
  return copy;
}

export function createListingRoutes(authenticateToken: any) {
  const router = Router();

  // ── GET /api/listings ────────────────────────────────────────────────────────
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      // 'ALL' means "no filter" — ignore it so it doesn't become a literal SQL condition
      if (req.query.type && req.query.type !== 'ALL') filters.type = req.query.type;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.status && req.query.status !== 'ALL') filters.status = req.query.status;
      if (req.query.transaction && req.query.transaction !== 'ALL') filters.transaction = req.query.transaction;
      const priceMin = parseFloat(req.query.priceMin as string);
      const priceMax = parseFloat(req.query.priceMax as string);
      const areaMin = parseFloat(req.query.areaMin as string);
      const areaMax = parseFloat(req.query.areaMax as string);
      if (req.query.priceMin && !isNaN(priceMin)) filters.price_gte = priceMin;
      if (req.query.priceMax && !isNaN(priceMax)) filters.price_lte = priceMax;
      if (req.query.areaMin && !isNaN(areaMin)) filters.area_gte = areaMin;
      if (req.query.areaMax && !isNaN(areaMax)) filters.area_lte = areaMax;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.projectCode) filters.projectCode = req.query.projectCode;
      if (req.query.noProjectCode === 'true') filters.noProjectCode = true;
      if (req.query.isVerified) filters.isVerified = req.query.isVerified === 'true';

      // PARTNER roles: read-only access to non-project listings (sensitive fields redacted)
      if (user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_AGENT') {
        const result = await listingRepository.findListings(user.tenantId, { page, pageSize }, filters, user.id, user.role);
        return res.json({ ...result, data: result.data.map(redactSensitiveFields) });
      }

      const result = await listingRepository.findListings(user.tenantId, { page, pageSize }, filters, user.id, user.role);
      res.json(result);
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  // ── GET /api/listings/stats ───────────────────────────────────────────────────
  // Returns global inventory counts (not affected by active user filters).
  // Used by the Inventory metrics bar so it always shows tenant-wide totals.
  router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.json({ availableCount: 0, holdCount: 0, soldCount: 0, rentedCount: 0, bookingCount: 0, openingCount: 0, inactiveCount: 0, totalCount: 0 });
      }
      const stats = await listingRepository.getGlobalStats(user.tenantId, user.id, user.role);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching listing stats:', error);
      res.status(500).json({ error: 'Failed to fetch listing stats' });
    }
  });

  // ── GET /api/listings/favorites ──────────────────────────────────────────────
  router.get('/favorites', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      // Partners cannot use the favourites feature (they have no tenant context for listings)
      if (PARTNER_ROLES.includes(user.role)) {
        return res.json([]);
      }
      const favorites = await listingRepository.getFavorites(user.tenantId, user.id);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  // ── GET /api/listings/:id ────────────────────────────────────────────────────
  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // PARTNER roles: read-only access (sensitive fields redacted)
      if (user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_AGENT') {
        const listing = await listingRepository.findById(user.tenantId, String(req.params.id));
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        res.json(redactSensitiveFields(listing));
        listingRepository.incrementViewCount(user.tenantId, String(req.params.id)).catch(() => {});
        const pl = listing as any;
        const pcMissing = !pl.coordinates?.lat || !pl.coordinates?.lng || (pl.coordinates.lat === 0 && pl.coordinates.lng === 0);
        if (pcMissing && pl.location) scheduleGeocode(user.tenantId, String(req.params.id), pl.location);
        return;
      }

      const listing = await listingRepository.findById(user.tenantId, String(req.params.id));
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      // RESTRICTED_ROLES can view any project-scoped listing (project inventory).
      // For non-project listings, they may only view listings they created or are assigned to.
      if (RESTRICTED_ROLES.includes(user.role)) {
        const isProjectListing = !!(listing as any).projectCode;
        const isOwnerOrAssignee =
          (listing as any).createdBy === user.id ||
          (listing as any).assignedTo === user.id;
        if (!isProjectListing && !isOwnerOrAssignee) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Respond immediately, increment view count + geocode (if needed) in background
      res.json(listing);
      listingRepository.incrementViewCount(user.tenantId, String(req.params.id)).catch(() => {});
      // Auto-geocode: nếu listing thiếu coordinates (ví dụ PROJECT vừa tạo), tự bổ sung để
      // lần load tiếp theo có tọa độ thật trên bản đồ.
      const anyListing = listing as any;
      const missingCoords =
        !anyListing.coordinates?.lat ||
        !anyListing.coordinates?.lng ||
        (anyListing.coordinates.lat === 0 && anyListing.coordinates.lng === 0);
      if (missingCoords && anyListing.location) {
        scheduleGeocode(user.tenantId, String(req.params.id), anyListing.location);
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  });

  // ── POST /api/listings ───────────────────────────────────────────────────────
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // PARTNER roles cannot create listings (read-only access to developer listings)
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Partners cannot create listings directly' });
      }

      const { code, title, location, price, area, type } = req.body;
      if (!code || !title || !location || !price || !area || !type) {
        return res.status(400).json({ error: 'Missing required fields: code, title, location, price, area, type' });
      }

      const images = req.body.images;
      if (Array.isArray(images) && images.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images allowed per listing' });
      }

      const listing = await listingRepository.create(user.tenantId, {
        ...req.body,
        createdBy: user.id,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'LISTING',
        entityId: listing.id,
        details: `Created listing: ${title}`,
        ipAddress: req.ip,
      });

      // If no coordinates were provided, geocode the address in the background
      const coords = req.body.coordinates;
      const hasCoords = coords?.lat != null && coords?.lng != null && (coords.lat !== 0 || coords.lng !== 0);
      if (!hasCoords && location) {
        scheduleGeocode(user.tenantId, listing.id, location);
      }

      res.status(201).json(listing);
    } catch (error) {
      console.error('Error creating listing:', error);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  });

  // ── PUT /api/listings/:id ────────────────────────────────────────────────────
  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // PARTNER roles: read-only
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Partners cannot modify listings' });
      }

      const images = req.body.images;
      if (Array.isArray(images) && images.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images allowed per listing' });
      }

      if (WRITABLE_RESTRICTED_ROLES.includes(user.role)) {
        const existing = await listingRepository.findById(user.tenantId, String(req.params.id));
        if (!existing) return res.status(404).json({ error: 'Listing not found' });
        const isOwnerOrAssignee =
          existing.createdBy === user.id ||
          existing.assignedTo === user.id;
        if (!isOwnerOrAssignee) {
          return res.status(403).json({ error: 'You can only edit listings you created or are assigned to' });
        }
      } else if (!['ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        // VIEWER and unknown internal roles: read-only
        return res.status(403).json({ error: 'Insufficient permissions to edit listings' });
      }

      // Strip assignedTo — assignment is exclusively managed via PATCH /:id/assign (ADMIN/TEAM_LEAD only)
      const { assignedTo: _stripped, ...safeBody } = req.body;
      const listing = await listingRepository.update(user.tenantId, String(req.params.id), safeBody);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LISTING',
        entityId: String(req.params.id),
        details: `Updated listing fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      // If coordinates are missing or zeroed after update, geocode the address in the background
      const updatedCoords = listing.coordinates as any;
      const hasUpdatedCoords = updatedCoords?.lat != null && updatedCoords?.lng != null &&
        (updatedCoords.lat !== 0 || updatedCoords.lng !== 0);
      if (!hasUpdatedCoords && listing.location) {
        scheduleGeocode(user.tenantId, String(req.params.id), listing.location);
      }

      res.json(listing);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  });

  // ── PATCH /api/listings/:id/assign ──────────────────────────────────────────
  // ADMIN and TEAM_LEAD only: assign a listing to an internal user (or unassign with userId = null)
  router.patch('/:id/assign', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only ADMIN or TEAM_LEAD can assign listings' });
      }

      const { userId } = req.body;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Require explicit userId key (null = unassign, UUID string = assign)
      if (!req.body || !('userId' in req.body)) {
        return res.status(400).json({ error: 'userId field is required (use null to unassign)' });
      }

      // userId may be null (to unassign), or a valid UUID string
      if (userId !== null && userId !== undefined) {
        if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
          return res.status(400).json({ error: 'userId must be a valid UUID or null' });
        }
        // Verify the assignee belongs to the same tenant and is an internal staff member
        const { pool } = await import('../db');
        const assigneeResult = await pool.query(
          `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2`,
          [userId, user.tenantId]
        );
        if (assigneeResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found in tenant' });
        }
        const assigneeRole: string = assigneeResult.rows[0].role;
        const NON_ASSIGNABLE_ROLES = ['VIEWER'];
        if (NON_ASSIGNABLE_ROLES.includes(assigneeRole)) {
          return res.status(400).json({ error: 'Cannot assign listing to a viewer user' });
        }
      }

      const listing = await listingRepository.assign(user.tenantId, String(req.params.id), userId ?? null);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LISTING',
        entityId: String(req.params.id),
        details: userId ? `Assigned listing to user ${userId}` : 'Unassigned listing',
        ipAddress: req.ip,
      });

      res.json(listing);
    } catch (error) {
      console.error('Error assigning listing:', error);
      res.status(500).json({ error: 'Failed to assign listing' });
    }
  });

  // ── DELETE /api/listings/:id ─────────────────────────────────────────────────
  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // PARTNER roles: read-only
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Partners cannot delete listings' });
      }

      // SALES/MARKETING can delete only listings they created or are assigned to; VIEWER is read-only
      if (WRITABLE_RESTRICTED_ROLES.includes(user.role)) {
        const existing = await listingRepository.findById(user.tenantId, String(req.params.id));
        if (!existing) return res.status(404).json({ error: 'Listing not found' });
        const isOwnerOrAssignee =
          existing.createdBy === user.id ||
          existing.assignedTo === user.id;
        if (!isOwnerOrAssignee) {
          return res.status(403).json({ error: 'You can only delete listings you created or are assigned to' });
        }
      } else if (!['ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        // VIEWER and unknown internal roles: read-only
        return res.status(403).json({ error: 'Insufficient permissions to delete listings' });
      }

      const deleted = await listingRepository.deleteById(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'LISTING',
        entityId: String(req.params.id),
        ipAddress: req.ip,
      });

      res.json({ message: 'Listing deleted' });
    } catch (error) {
      console.error('Error deleting listing:', error);
      res.status(500).json({ error: 'Failed to delete listing' });
    }
  });

  router.post('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isFavorite = await listingRepository.toggleFavorite(user.tenantId, user.id, String(req.params.id));
      res.json({ isFavorite });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  });

  router.delete('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      await listingRepository.removeFavorite(user.tenantId, user.id, String(req.params.id));
      res.json({ isFavorite: false });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  return router;
}
