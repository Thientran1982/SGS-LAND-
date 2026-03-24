import { Router, Request, Response } from 'express';
import { pool } from '../db';

const DEFAULT_CONFIG = {
  primaryColor: '#4F46E5',
  features: { enableZalo: true, maxUsers: 100 },
};

export function createTenantRoutes(authenticateToken: any): Router {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'No tenant context' });
      }

      const result = await pool.query(
        `SELECT id, name, domain, config FROM tenants WHERE id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const row = result.rows[0];
      const config = row.config && Object.keys(row.config).length > 0
        ? row.config
        : DEFAULT_CONFIG;

      res.json({
        id: row.id,
        name: row.name,
        domain: row.domain,
        config,
      });
    } catch (error) {
      console.error('Error fetching tenant:', error);
      res.status(500).json({ error: 'Failed to fetch tenant' });
    }
  });

  return router;
}
