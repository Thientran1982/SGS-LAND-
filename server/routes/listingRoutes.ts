import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { listingRepository } from '../repositories/listingRepository';
import { auditRepository } from '../repositories/auditRepository';
import { priceCalibrationService } from '../services/priceCalibrationService';
import { notificationRepository } from '../repositories/notificationRepository';
import { storeFile } from '../services/storageService';

// Lazy-load sharp so a missing/broken native build never crashes the route module
let _sharpBulk: typeof import('sharp') | null = null;
(async () => {
  try { _sharpBulk = (await import('sharp')).default as unknown as typeof import('sharp'); }
  catch { console.warn('[listingRoutes] sharp not available — bulk images will be stored as-is'); }
})();

const BULK_IMG_MAX_FILES = 50;
const BULK_IMG_MAX_BYTES = 10 * 1024 * 1024; // 10MB per image
const BULK_IMG_ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_TO_EXT_BULK: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};
const MAX_IMAGES_PER_LISTING = 10;

const bulkImgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_IMG_MAX_BYTES, files: BULK_IMG_MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (BULK_IMG_ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Định dạng ảnh không hỗ trợ: ${file.mimetype}`));
  },
});

function bulkImgErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')  return res.status(413).json({ error: 'Một hoặc nhiều ảnh vượt giới hạn 10MB' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: `Tối đa ${BULK_IMG_MAX_FILES} ảnh mỗi lần tải` });
    return res.status(400).json({ error: 'Lỗi tải ảnh, vui lòng thử lại' });
  }
  if (err?.message?.includes('Định dạng ảnh không hỗ trợ')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
}

async function compressBulkImage(buf: Buffer, mime: string): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  if (!_sharpBulk || mime === 'image/gif') {
    return { buffer: buf, contentType: mime, ext: MIME_TO_EXT_BULK[mime] || '.jpg' };
  }
  try {
    const s = (_sharpBulk as any)(buf);
    const meta = await s.metadata();
    let pipeline = s;
    if ((meta.width || 0) > 1920 || (meta.height || 0) > 1920) {
      pipeline = pipeline.resize(1920, 1920, { fit: 'inside', withoutEnlargement: true });
    }
    const compressed: Buffer = await pipeline.webp({ quality: 82 }).toBuffer();
    return { buffer: compressed, contentType: 'image/webp', ext: '.webp' };
  } catch (e) {
    console.warn('[bulk-images] sharp compression failed, storing original:', e);
    return { buffer: buf, contentType: mime, ext: MIME_TO_EXT_BULK[mime] || '.jpg' };
  }
}

/** Normalize a code/filename token for case-insensitive, accent-insensitive matching */
function normalizeCodeKey(s: string): string {
  return s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Derive candidate listing codes from a filename.
 * Strategy: try the basename first, then strip trailing `-N` / `_N` numeric suffix
 * (so `A-12.01-2.jpg` matches code `A-12.01` for the 2nd photo of the same unit).
 */
function deriveCodeCandidates(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, '');
  const out = [base];
  const m = base.match(/^(.+)[-_](\d+)$/);
  if (m) out.push(m[1]);
  return out.map(normalizeCodeKey);
}

// ── Server-side geocoding (Nominatim / OpenStreetMap) ────────────────────────
// Runs in the background after create/update so the API response is not delayed.
// Province-aware: HCMC addresses use bounded viewbox; non-HCMC skip it entirely.
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';

// Non-HCMC province keywords (plain Latin + with diacritics).
// When any of these appear in an address we skip the HCMC suffix and bounding box.
const NON_HCMC_PROVINCES_SRV: string[] = [
  'dong nai', 'dong nai', 'binh duong', 'long an',
  'ba ria', 'vung tau', 'tay ninh',
  'ha noi', 'hanoi', 'da nang', 'danang', 'hai phong',
  'can tho', 'hue', 'khanh hoa', 'nha trang',
  'binh thuan', 'phan thiet', 'lam dong', 'da lat',
  'dak lak', 'buon ma thuot', 'gia lai', 'pleiku', 'kon tum',
  'quang nam', 'hoi an', 'quang ngai', 'binh dinh', 'quy nhon',
  'phu yen', 'ninh thuan', 'phan rang',
  'tien giang', 'my tho', 'ben tre', 'vinh long', 'tra vinh',
  'dong thap', 'cao lanh', 'an giang', 'long xuyen',
  'kien giang', 'rach gia', 'phu quoc', 'ca mau', 'hau giang',
  'soc trang', 'bac lieu',
  'quang binh', 'quang tri', 'thua thien',
  'nghe an', 'ha tinh', 'thanh hoa', 'ninh binh', 'nam dinh', 'thai binh',
  'hai duong', 'hung yen', 'bac ninh', 'vinh phuc', 'ha nam',
  'bac giang', 'thai nguyen', 'phu tho', 'viet tri',
  'yen bai', 'lao cai', 'sa pa', 'tuyen quang', 'ha giang',
  'cao bang', 'lang son', 'quang ninh', 'ha long', 'bac kan',
  'dien bien', 'lai chau', 'son la', 'hoa binh',
];

function isNonHCMCSrv(location: string): boolean {
  const lower = location.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const kw of NON_HCMC_PROVINCES_SRV) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<![\\w])${esc}(?![\\w])`, 'i').test(lower)) return true;
  }
  return false;
}

// Vietnamese district name normalisation (no-diacritics → with diacritics)
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
  const nonHCMC = isNonHCMCSrv(orig);
  const suffixes = nonHCMC
    ? [', Việt Nam', ', Vietnam']
    : [', Thành phố Hồ Chí Minh, Việt Nam', ', Ho Chi Minh City, Vietnam', ', TP. HCM, Việt Nam', ', Vietnam'];
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

async function geocodeVN(location: string): Promise<{ lat: number; lng: number } | null> {
  const queries = buildGeoQueriesSrv(location);
  const nonHCMC = isNonHCMCSrv(location);

  if (!nonHCMC) {
    // Pass 1: HCMC addresses — try bounded viewbox first (more precise)
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1200));
      const result = await fetchNominatim(queries[i], true);
      if (result) return result;
    }
  }

  // Pass 2 (or only pass for non-HCMC): search Vietnam-wide without bounding box
  for (let i = 0; i < Math.min(queries.length, 2); i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1200));
    const result = await fetchNominatim(queries[i], false);
    if (result) return result;
  }
  return null;
}

/**
 * True only when coordinates represent a real Vietnamese location.
 * Rejects null, zero, and near-zero values (0.000001, 0.000001) that end up
 * at the Gulf of Guinea / Africa — a common geocoding failure placeholder.
 * Valid VN coordinates: lat 8–24, lng 102–110.
 */
function hasValidCoords(c: any): boolean {
  if (c?.lat == null || c?.lng == null) return false;
  if (Math.abs(c.lat) < 1 && Math.abs(c.lng) < 1) return false;
  return true;
}

/** Fire-and-forget: geocode and patch coordinates in DB without blocking the response */
export function scheduleGeocode(tenantId: string, listingId: string, location: string) {
  (async () => {
    try {
      const coords = await geocodeVN(location);
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

const STATUS_LABEL: Record<string, string> = {
  BOOKING: 'Nhận Booking', OPENING: 'Đang mở bán', AVAILABLE: 'Đang GD',
  HOLD: 'Giữ chỗ', SOLD: 'Đã bán', RENTED: 'Đã cho thuê',
  INACTIVE: 'Ngừng GD', BEST_MARKET: 'Tốt nhất TT',
};

/** Fire-and-forget: create LISTING_STATUS_CHANGED notifications for all admins */
async function notifyStatusChange(
  tenantId: string,
  listingId: string,
  code: string,
  title: string,
  oldStatus: string,
  newStatus: string,
  actorName: string,
): Promise<void> {
  try {
    const { pool } = await import('../db');
    const admins = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD') AND status = 'ACTIVE'`,
      [tenantId]
    );
    const fromLabel = STATUS_LABEL[oldStatus] ?? oldStatus;
    const toLabel   = STATUS_LABEL[newStatus] ?? newStatus;
    await Promise.all(admins.rows.map(a =>
      notificationRepository.create({
        tenantId,
        userId:   a.id,
        type:     'LISTING_STATUS_CHANGED',
        title:    `Đổi trạng thái: ${code}`,
        body:     `${title || code}: ${fromLabel} → ${toLabel}. Bởi: ${actorName}`,
        metadata: { listingId, oldStatus, newStatus, changedBy: actorName },
      })
    ));
  } catch (e) {
    console.error('[listing status notif]', e);
  }
}

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
  // Supports two pagination modes:
  //   Cursor-based (default for Inventory): pass ?cursor=<token> — O(1) at any depth
  //   Offset-based (Kanban/Board/legacy callers): pass ?page=N — unchanged behaviour
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user     = (req as any).user;
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      if (req.query.type && req.query.type !== 'ALL') filters.type = req.query.type;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.status && req.query.status !== 'ALL') filters.status = req.query.status;
      if (req.query.transaction && req.query.transaction !== 'ALL') filters.transaction = req.query.transaction;
      const priceMin = parseFloat(req.query.priceMin as string);
      const priceMax = parseFloat(req.query.priceMax as string);
      const areaMin  = parseFloat(req.query.areaMin as string);
      const areaMax  = parseFloat(req.query.areaMax as string);
      if (req.query.priceMin && !isNaN(priceMin)) filters.price_gte = priceMin;
      if (req.query.priceMax && !isNaN(priceMax)) filters.price_lte = priceMax;
      if (req.query.areaMin  && !isNaN(areaMin))  filters.area_gte  = areaMin;
      if (req.query.areaMax  && !isNaN(areaMax))  filters.area_lte  = areaMax;
      if (req.query.search)      filters.search      = req.query.search;
      if (req.query.projectCode) filters.projectCode = req.query.projectCode;
      if (req.query.noProjectCode === 'true') filters.noProjectCode = true;
      if (req.query.isVerified)  filters.isVerified  = req.query.isVerified === 'true';

      const isPartner = user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_AGENT';

      // ── Cursor-based mode ──────────────────────────────────────────────────
      if (req.query.cursor !== undefined || req.query.cursorMode === 'true') {
        const cursor = (req.query.cursor as string) || undefined;
        const result = await listingRepository.findListingsCursor(user.tenantId, {
          pageSize,
          cursor,
          filters,
          userId:   user.id,
          userRole: user.role,
        });
        if (isPartner) {
          return res.json({ ...result, data: result.data.map(redactSensitiveFields) });
        }
        return res.json(result);
      }

      // ── Offset-based mode (Kanban/Board/legacy) ────────────────────────────
      const page   = Math.max(1, parseInt(req.query.page as string) || 1);
      const result = await listingRepository.findListings(
        user.tenantId, { page, pageSize }, filters, user.id, user.role
      );
      if (isPartner) {
        return res.json({ ...result, data: result.data.map(redactSensitiveFields) });
      }
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
        const pcMissing = !hasValidCoords(pl.coordinates);
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
      const missingCoords = !hasValidCoords(anyListing.coordinates);
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
      if (!hasValidCoords(req.body.coordinates) && location) {
        scheduleGeocode(user.tenantId, listing.id, location);
      }

      res.status(201).json(listing);
    } catch (error) {
      console.error('Error creating listing:', error);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  });

  // ── POST /api/listings/bulk ─────────────────────────────────────────────────
  // Import nhiều listing từ Excel (tối đa 500 dòng)
  router.post('/bulk', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (['PARTNER_OWNER', 'PARTNER_AGENT', 'PARTNER_VIEWER', 'VIEWER'].includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền tạo listing' });
      }

      const { listings } = req.body as { listings: Record<string, unknown>[] };
      if (!Array.isArray(listings) || listings.length === 0) {
        return res.status(400).json({ error: 'Danh sách listing rỗng' });
      }
      if (listings.length > 500) {
        return res.status(400).json({ error: 'Tối đa 500 dòng mỗi lần nhập' });
      }

      const created: unknown[] = [];
      const errors: { row: number; error: string }[] = [];

      for (let i = 0; i < listings.length; i++) {
        const item = listings[i];
        const rowNum = (item._row as number) ?? (i + 2);
        try {
          const { _row, ...data } = item;
          const listing = await listingRepository.create(user.tenantId, {
            ...data,
            createdBy: user.id,
          });
          created.push(listing);
        } catch (err: any) {
          const msg = err?.message?.includes('duplicate') || err?.message?.includes('unique')
            ? `Mã sản phẩm "${item.code}" đã tồn tại`
            : (err?.message ?? 'Lỗi không xác định');
          errors.push({ row: rowNum, error: msg });
        }
      }

      res.json({ created: created.length, errors });
    } catch (error) {
      console.error('Error bulk-creating listings:', error);
      res.status(500).json({ error: 'Lỗi nhập danh sách' });
    }
  });

  // ── POST /api/listings/by-project/:projectCode/bulk-images ──────────────────
  // Tải nhiều ảnh sản phẩm cùng lúc, tự động khớp filename → listing.code
  // trong phạm vi dự án (tối đa 50 ảnh/lần, 10MB/ảnh, ≤10 ảnh/listing).
  router.post(
    '/by-project/:projectCode/bulk-images',
    authenticateToken,
    bulkImgUpload.array('files', BULK_IMG_MAX_FILES),
    bulkImgErrorHandler,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;

        // Quyền: PARTNER read-only; VIEWER không upload
        if (PARTNER_ROLES.includes(user.role)) {
          return res.status(403).json({ error: 'Sàn đối tác không được tải ảnh sản phẩm' });
        }
        if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING'].includes(user.role)) {
          return res.status(403).json({ error: 'Không có quyền tải ảnh sản phẩm' });
        }

        const projectCode = String(req.params.projectCode || '').trim();
        if (!projectCode) return res.status(400).json({ error: 'Thiếu mã dự án' });

        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) return res.status(400).json({ error: 'Chưa có ảnh nào được chọn' });

        // Optional manual mapping from client: { "[filename]": "[listingCode]" }
        let manualMap: Record<string, string> = {};
        try {
          if (typeof req.body?.mapping === 'string' && req.body.mapping.trim()) {
            const parsed = JSON.parse(req.body.mapping);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manualMap = parsed;
          }
        } catch { /* malformed mapping → ignore, fall back to filename match */ }

        // Lấy toàn bộ listing trong dự án (RLS-bound by tenant)
        const projectListings = await listingRepository.findAllByProjectCode(user.tenantId, projectCode);
        if (projectListings.length === 0) {
          return res.status(404).json({ error: `Dự án "${projectCode}" chưa có sản phẩm nào để gán ảnh` });
        }

        const codeMap = new Map<string, any>();
        for (const l of projectListings) {
          if (l.code) codeMap.set(normalizeCodeKey(String(l.code)), l);
        }

        const restricted = WRITABLE_RESTRICTED_ROLES.includes(user.role);

        type ResultStatus =
          | 'uploaded' | 'skipped_no_match' | 'skipped_max_images'
          | 'skipped_invalid' | 'skipped_no_permission' | 'error';
        type ResultRow = {
          filename: string; status: ResultStatus;
          matchedCode?: string; listingId?: string; url?: string; error?: string;
        };
        const results: ResultRow[] = [];
        // listingId → mutable working copy of images array
        const updatedImages = new Map<string, string[]>();

        for (const f of files) {
          try {
            // 1) Verify real MIME from magic bytes (defence in depth)
            const detected = await fileTypeFromBuffer(f.buffer);
            if (!detected || !BULK_IMG_ALLOWED_MIMES.has(detected.mime)) {
              results.push({ filename: f.originalname, status: 'skipped_invalid', error: 'Định dạng không hợp lệ' });
              continue;
            }
            if (f.buffer.length > BULK_IMG_MAX_BYTES) {
              results.push({ filename: f.originalname, status: 'skipped_invalid', error: 'Vượt giới hạn 10MB' });
              continue;
            }

            // 2) Resolve listing — manual override wins, else filename heuristic
            let listing: any = null;
            const overrideCode = manualMap[f.originalname];
            if (overrideCode) {
              listing = codeMap.get(normalizeCodeKey(String(overrideCode))) ?? null;
            }
            if (!listing) {
              for (const cand of deriveCodeCandidates(f.originalname)) {
                listing = codeMap.get(cand);
                if (listing) break;
              }
            }
            if (!listing) {
              results.push({ filename: f.originalname, status: 'skipped_no_match' });
              continue;
            }

            // 3) Restricted roles: only own/assigned listings
            if (restricted) {
              if (listing.createdBy !== user.id && listing.assignedTo !== user.id) {
                results.push({
                  filename: f.originalname, status: 'skipped_no_permission',
                  matchedCode: String(listing.code),
                });
                continue;
              }
            }

            // 4) Per-listing 10-image cap (use working copy so we count this batch too)
            const working = updatedImages.get(listing.id)
              ?? [...(Array.isArray(listing.images) ? listing.images : [])];
            if (working.length >= MAX_IMAGES_PER_LISTING) {
              results.push({
                filename: f.originalname, status: 'skipped_max_images',
                matchedCode: String(listing.code),
              });
              continue;
            }

            // 5) Compress + persist to PostgreSQL bytea via storeFile()
            const { buffer, contentType, ext } = await compressBulkImage(f.buffer, detected.mime);
            const storedName = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
            const url = await storeFile(user.tenantId, storedName, buffer, contentType);

            working.push(url);
            updatedImages.set(listing.id, working);
            results.push({
              filename: f.originalname, status: 'uploaded',
              matchedCode: String(listing.code), listingId: listing.id, url,
            });

            // Per-file audit log — one BULK_UPLOAD_IMAGE entry per successfully
            // stored file, capturing filename, matched listing code/id, stored
            // URL, and current/cap image count for full traceability.
            await auditRepository.log(user.tenantId, {
              actorId: user.id,
              action: 'BULK_UPLOAD_IMAGE',
              entityType: 'LISTING',
              entityId: listing.id,
              details: `Bulk upload "${f.originalname}" → ${listing.code} (${working.length}/${MAX_IMAGES_PER_LISTING}) :: ${url}`,
              ipAddress: req.ip,
            });
          } catch (err: any) {
            console.error('[bulk-images] file error', f.originalname, err);
            results.push({
              filename: f.originalname, status: 'error',
              error: err?.message || 'Lỗi không xác định',
            });
          }
        }

        // 6) Persist updated image arrays + aggregate audit log per listing
        // (the per-file logs above provide file-level traceability; this
        // aggregate entry summarizes the batch impact on each listing).
        for (const [listingId, images] of updatedImages) {
          await listingRepository.update(user.tenantId, listingId, { images });
          const original = projectListings.find(l => l.id === listingId);
          const before = Array.isArray(original?.images) ? original!.images.length : 0;
          await auditRepository.log(user.tenantId, {
            actorId: user.id,
            action: 'BULK_UPLOAD_IMAGES',
            entityType: 'LISTING',
            entityId: listingId,
            details: `Bulk upload: +${images.length - before} ảnh (tổng ${images.length}/${MAX_IMAGES_PER_LISTING})`,
            ipAddress: req.ip,
          });
        }

        const summary = {
          total:                  files.length,
          uploaded:               results.filter(r => r.status === 'uploaded').length,
          skippedNoMatch:         results.filter(r => r.status === 'skipped_no_match').length,
          skippedMaxImages:       results.filter(r => r.status === 'skipped_max_images').length,
          skippedInvalid:         results.filter(r => r.status === 'skipped_invalid').length,
          skippedNoPermission:    results.filter(r => r.status === 'skipped_no_permission').length,
          errors:                 results.filter(r => r.status === 'error').length,
          listingsUpdated:        updatedImages.size,
        };
        res.json({ summary, results });
      } catch (error) {
        console.error('Error in bulk image upload:', error);
        res.status(500).json({ error: 'Tải ảnh hàng loạt thất bại' });
      }
    }
  );

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

      let prefetchedListing: any = null;

      if (WRITABLE_RESTRICTED_ROLES.includes(user.role)) {
        prefetchedListing = await listingRepository.findById(user.tenantId, String(req.params.id));
        if (!prefetchedListing) return res.status(404).json({ error: 'Listing not found' });
        const isOwnerOrAssignee =
          prefetchedListing.createdBy === user.id ||
          prefetchedListing.assignedTo === user.id;
        if (!isOwnerOrAssignee) {
          return res.status(403).json({ error: 'You can only edit listings you created or are assigned to' });
        }
      } else if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        // VIEWER and unknown internal roles: read-only
        return res.status(403).json({ error: 'Insufficient permissions to edit listings' });
      }

      // Strip assignedTo — assignment is exclusively managed via PATCH /:id/assign (ADMIN/TEAM_LEAD only)
      const { assignedTo: _stripped, ...safeBody } = req.body;

      // Capture old status before update (for change notification)
      let oldStatus: string | undefined;
      if (safeBody.status) {
        const prev = prefetchedListing ?? await listingRepository.findById(user.tenantId, String(req.params.id));
        oldStatus = (prev as any)?.status;
      }

      const listing = await listingRepository.update(user.tenantId, String(req.params.id), safeBody);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      // ── Self-learning: record ground-truth price when listing is sold ─────
      // A sold transaction is the most accurate price signal — weight 50% in calibration.
      if (listing.status === 'SOLD' && listing.price && listing.area) {
        const pricePerM2 = Math.round((listing.price as number) / (listing.area as number));
        if (pricePerM2 > 1_000_000 && listing.location) {
          const { getRegionalBasePrice } = await import('../valuationEngine');
          const regional = getRegionalBasePrice(listing.location as string, listing.propertyType as string);
          const normalizedKey = (listing.location as string)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
          setImmediate(() =>
            priceCalibrationService.recordTransaction({
              locationKey:     normalizedKey,
              locationDisplay: listing.location as string,
              pricePerM2,
              propertyType:    (listing.propertyType as string) || 'townhouse_center',
              confidence:      regional.confidence,
              listingId:       parseInt(req.params.id as string, 10),
              tenantId:        user.tenantId,
            }).catch(() => {})
          );
        }
      }

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LISTING',
        entityId: String(req.params.id),
        details: `Updated listing fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      // If coordinates are missing or invalid after update, geocode the address in the background
      if (!hasValidCoords(listing.coordinates) && listing.location) {
        scheduleGeocode(user.tenantId, String(req.params.id), listing.location);
      }

      // ── Notify admins on status change ──────────────────────────────────────
      if (safeBody.status && oldStatus && oldStatus !== (listing.status as string)) {
        const code = (listing.code as string) || String(req.params.id).slice(0, 8);
        setImmediate(() => notifyStatusChange(
          user.tenantId, String(req.params.id), code,
          (listing.title as string) || code,
          oldStatus as string, listing.status as string,
          user.name || user.email,
        ));
      }

      res.json(listing);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  });

  // ── PATCH /api/listings/:id/status ──────────────────────────────────────────
  // Any active internal user (SALES / MARKETING / TEAM_LEAD / ADMIN / SUPER_ADMIN) may change
  // the transaction status of any listing in their tenant. External partners and VIEWERs are blocked.
  router.patch('/:id/status', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const BLOCKED = [...PARTNER_ROLES, 'VIEWER'];
      if (BLOCKED.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions to change listing status' });
      }

      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: 'status is required' });
      }

      const VALID_STATUSES = ['BOOKING', 'OPENING', 'AVAILABLE', 'HOLD', 'SOLD', 'RENTED', 'INACTIVE', 'BEST_MARKET'];
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      // Fetch current listing to get old status
      const existing = await listingRepository.findById(user.tenantId, String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Listing not found' });
      const oldStatus = existing.status as string;

      if (oldStatus === status) {
        return res.json(existing); // No-op: status unchanged
      }

      const listing = await listingRepository.update(user.tenantId, String(req.params.id), { status });
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId:    user.id,
        action:     'UPDATE_STATUS',
        entityType: 'LISTING',
        entityId:   String(req.params.id),
        details:    `Status changed: ${oldStatus} → ${status}`,
        ipAddress:  req.ip,
      });

      const code = (listing.code as string) || String(req.params.id).slice(0, 8);
      setImmediate(() => notifyStatusChange(
        user.tenantId, String(req.params.id), code,
        (listing.title as string) || code,
        oldStatus, status,
        user.name || user.email,
      ));

      res.json(listing);
    } catch (error) {
      console.error('Error changing listing status:', error);
      res.status(500).json({ error: 'Failed to change listing status' });
    }
  });

  // ── PATCH /api/listings/:id/assign ──────────────────────────────────────────
  // ADMIN and TEAM_LEAD only: assign a listing to an internal user (or unassign with userId = null)
  router.patch('/:id/assign', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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
      } else if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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
