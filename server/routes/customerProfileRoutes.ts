import { Router, RequestHandler } from 'express';
import { customerProfileService } from '../services/customerProfileService';

export function createCustomerProfileRoutes(authenticateToken: RequestHandler): Router {
  const router = Router();
  router.use(authenticateToken);

  router.get('/', async (req: any, res) => {
    try {
      const customerId = String(req.user.id);
      res.json((await customerProfileService.getProfile(req.user.tenantId, customerId)) || {
        customerId, rememberConsent: 'PENDING', facts: [], interaction_outcomes: [],
      });
    } catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể đọc hồ sơ cá nhân' }); }
  });

  router.put('/consent', async (req: any, res) => {
    try {
      const profile = await customerProfileService.setConsent(req.user.tenantId, String(req.user.id), String(req.body?.consent || ''), String(req.user.id), String(req.body?.version || 'customer-profile-v1'));
      res.json(profile);
    } catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể cập nhật consent' }); }
  });

  router.delete('/', async (req: any, res) => {
    try {
      const deleted = await customerProfileService.erase(req.user.tenantId, String(req.user.id), String(req.user.id));
      res.json({ deleted });
    } catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể xóa hồ sơ cá nhân' }); }
  });

  return router;
}