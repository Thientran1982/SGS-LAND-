import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { listingRepository } from '../repositories/listingRepository';
import { auditRepository } from '../repositories/auditRepository';

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER'];

export function createListingRoutes(authenticateToken: any) {
  const router = Router();

  // ── GET /api/listings ────────────────────────────────────────────────────────
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      if (req.query.type) filters.type = req.query.type;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.status) filters.status = req.query.status;
      if (req.query.transaction) filters.transaction = req.query.transaction;
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
      if (req.query.isVerified) filters.isVerified = req.query.isVerified === 'true';

      // PARTNER roles: only see listings from projects they have been granted access to
      if (PARTNER_ROLES.includes(user.role)) {
        const result = await listingRepository.findListingsForPartner(user.tenantId, { page, pageSize }, filters);
        return res.json(result);
      }

      const result = await listingRepository.findListings(user.tenantId, { page, pageSize }, filters, user.id, user.role);
      res.json(result);
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
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

      // PARTNER: use cross-tenant project-scoped lookup
      if (PARTNER_ROLES.includes(user.role)) {
        const listing = await listingRepository.findByIdForPartner(user.tenantId, String(req.params.id));
        if (!listing) return res.status(404).json({ error: 'Listing not found or access denied' });
        res.json(listing);
        listingRepository.incrementViewCount((listing as any).tenantId, String(req.params.id)).catch(() => {});
        return;
      }

      const listing = await listingRepository.findById(user.tenantId, String(req.params.id));
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      if (RESTRICTED_ROLES.includes(user.role) && (listing as any).createdBy !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Respond immediately, increment view count in background
      res.json(listing);
      listingRepository.incrementViewCount(user.tenantId, String(req.params.id)).catch(() => {});
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

      if (RESTRICTED_ROLES.includes(user.role)) {
        const existing = await listingRepository.findById(user.tenantId, String(req.params.id));
        if (!existing) return res.status(404).json({ error: 'Listing not found' });
        if ((existing as any).createdBy !== user.id) {
          return res.status(403).json({ error: 'You can only edit listings you created' });
        }
      }

      const listing = await listingRepository.update(user.tenantId, String(req.params.id), req.body);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LISTING',
        entityId: String(req.params.id),
        details: `Updated listing fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(listing);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  });

  // ── DELETE /api/listings/:id ─────────────────────────────────────────────────
  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // Only developer ADMIN / TEAM_LEAD can delete listings
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Insufficient permissions' });
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
