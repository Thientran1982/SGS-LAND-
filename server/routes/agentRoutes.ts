/**
 * Agent Routes
 * CRUD endpoints for named AI agents and their memories.
 * ADMIN / TEAM_LEAD only for write operations.
 */

import { Router, Request, Response } from 'express';
import { agentRepository } from '../repositories/agentRepository';

const ADMIN_ROLES = ['ADMIN', 'TEAM_LEAD'];
const PARTNER_ROLES = ['PARTNER', 'PARTNER_AGENT'];

export function createAgentRoutes(authenticateToken: any): Router {
  const router = Router();

  // GET /api/agents — list all agents for this tenant
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });

      const agents = await agentRepository.listAgents(user.tenantId);
      res.json(agents);
    } catch (e) {
      console.error('agentRoutes GET /agents error:', e);
      res.status(500).json({ error: 'Failed to list agents' });
    }
  });

  // GET /api/agents/:name — get one agent by name (e.g. 'ARIA')
  router.get('/:name', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });

      const agent = await agentRepository.getAgentByName(user.tenantId, (req.params.name as string).toUpperCase());
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json(agent);
    } catch (e) {
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  // PUT /api/agents/:id — update agent skills / system instruction / model
  // ADMIN or TEAM_LEAD only
  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin hoặc Team Lead mới có thể cập nhật agent' });
      }

      const { systemInstruction, skills, model, displayName, description, active } = req.body;
      const updated = await agentRepository.updateAgent(user.tenantId, req.params.id as string, {
        systemInstruction,
        skills,
        model,
        displayName,
        description,
        active,
      });
      res.json(updated);
    } catch (e: any) {
      console.error('agentRoutes PUT error:', e);
      res.status(500).json({ error: e?.message || 'Failed to update agent' });
    }
  });

  // GET /api/agents/:agentId/memories/:leadId — get memories for a lead
  router.get('/:agentId/memories/:leadId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const memories = await agentRepository.getLeadMemories(
        user.tenantId, req.params.agentId as string, req.params.leadId as string, limit
      );
      res.json(memories);
    } catch (e) {
      res.status(500).json({ error: 'Failed to get memories' });
    }
  });

  // GET /api/agents/memories/lead/:leadId — all memories for a lead (all agents)
  router.get('/memories/lead/:leadId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });

      const memories = await agentRepository.getAllLeadMemories(user.tenantId, req.params.leadId as string);
      res.json(memories);
    } catch (e) {
      res.status(500).json({ error: 'Failed to get lead memories' });
    }
  });

  return router;
}
