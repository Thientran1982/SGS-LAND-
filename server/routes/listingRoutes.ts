import { Router, Request, Response } from 'express';
import { listingRepository } from '../repositories/listingRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createListingRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const filters: any = {};
      if (req.query.type) filters.type = req.query.type;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.status) filters.status = req.query.status;
      if (req.query.transaction) filters.transaction = req.query.transaction;
      if (req.query.priceMin) filters.price_gte = parseFloat(req.query.priceMin as string);
      if (req.query.priceMax) filters.price_lte = parseFloat(req.query.priceMax as string);
      if (req.query.areaMin) filters.area_gte = parseFloat(req.query.areaMin as string);
      if (req.query.areaMax) filters.area_lte = parseFloat(req.query.areaMax as string);
      if (req.query.search) filters.search = req.query.search;
      if (req.query.projectCode) filters.projectCode = req.query.projectCode;
      if (req.query.isVerified) filters.isVerified = req.query.isVerified === 'true';

      const result = await listingRepository.findListings(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  router.get('/favorites', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const favorites = await listingRepository.getFavorites(user.tenantId, user.id);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const listing = await listingRepository.findById(user.tenantId, req.params.id);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await listingRepository.incrementViewCount(user.tenantId, req.params.id);
      res.json(listing);
    } catch (error) {
      console.error('Error fetching listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
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

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const images = req.body.images;
      if (Array.isArray(images) && images.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images allowed per listing' });
      }

      const listing = await listingRepository.update(user.tenantId, req.params.id, req.body);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LISTING',
        entityId: req.params.id,
        details: `Updated listing fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(listing);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const deleted = await listingRepository.deleteById(user.tenantId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Listing not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'LISTING',
        entityId: req.params.id,
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
      const isFavorite = await listingRepository.toggleFavorite(user.tenantId, user.id, req.params.id);
      res.json({ isFavorite });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  });

  return router;
}
