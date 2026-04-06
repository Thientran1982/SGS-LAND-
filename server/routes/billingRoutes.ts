import { Router, Request, Response } from 'express';
import { subscriptionRepository } from '../repositories/subscriptionRepository';

export function createBillingRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/subscription', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      let subscription = await subscriptionRepository.getByTenant(user.tenantId);

      if (!subscription) {
        subscription = await subscriptionRepository.createSubscription(user.tenantId, {
          planId: 'INDIVIDUAL',
          status: 'ACTIVE',
        });
      }

      res.json(subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  router.post('/upgrade', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can upgrade the subscription plan' });
      }
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: 'planId is required' });
      }

      const validPlans = ['INDIVIDUAL', 'TEAM', 'ENTERPRISE'];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }

      const subscription = await subscriptionRepository.updatePlan(user.tenantId, planId);
      res.json(subscription);
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  });

  router.get('/usage', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const usage = await subscriptionRepository.getUsageSummary(user.tenantId);
      res.json(usage);
    } catch (error) {
      console.error('Error fetching usage:', error);
      res.status(500).json({ error: 'Failed to fetch usage metrics' });
    }
  });

  router.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const invoices = await subscriptionRepository.getInvoices(user.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  return router;
}
