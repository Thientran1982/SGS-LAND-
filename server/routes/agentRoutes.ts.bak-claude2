/**
 * Agent Routes
 * CRUD endpoints for named AI agents and their memories.
 * ADMIN / TEAM_LEAD only for write operations.
 */

import { Router, Request, Response } from 'express';
import { agentRepository } from '../repositories/agentRepository';
import { streamAgentResponse } from '../ai';

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

  
  // ============================================================
  // C1: Prompt Versioning endpoints
  // ============================================================

  // GET /api/agents/:agentId/prompts — list all prompt versions for agent
  router.get('/:agentId/prompts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const versions = await agentRepository.listPromptVersions(user.tenantId, agentId as string);
      // Strip systemInstruction from list for bandwidth (return it only on GET single)
      const summary = versions.map(v => ({
        id: v.id, agentId: v.agentId, version: v.version,
        isActive: v.isActive, changeNote: v.changeNote,
        createdBy: v.createdBy, createdAt: v.createdAt,
      }));
      res.json(summary);
    } catch (e) {
      console.error('agentRoutes GET prompts error:', e);
      res.status(500).json({ error: 'Failed to list prompt versions' });
    }
  });

  // GET /api/agents/:agentId/prompts/active — get active prompt for agent
  router.get('/:agentId/prompts/active', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const active = await agentRepository.getActivePrompt(user.tenantId, agentId as string);
      if (!active) return res.json({ agentId, source: 'default', systemInstruction: null });
      res.json(active);
    } catch (e) {
      console.error('agentRoutes GET active prompt error:', e);
      res.status(500).json({ error: 'Failed to get active prompt' });
    }
  });

  // POST /api/agents/:agentId/prompts — save a new prompt version
  router.post('/:agentId/prompts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const { version, systemInstruction, changeNote, activate } = req.body;
      if (!version || !systemInstruction) {
        return res.status(400).json({ error: 'version and systemInstruction are required' });
      }
      const saved = await agentRepository.savePromptVersion(
        user.tenantId, agentId as string, version as string, systemInstruction as string, changeNote, user.email
      );
      // Optionally activate immediately
      if (activate === true) {
        const activated = await agentRepository.activatePromptVersion(user.tenantId, agentId as string, version as string);
        return res.status(201).json({ ...activated, activated: true });
      }
      res.status(201).json(saved);
    } catch (e: any) {
      console.error('agentRoutes POST prompt error:', e);
      res.status(500).json({ error: e?.message || 'Failed to save prompt version' });
    }
  });

  // PUT /api/agents/:agentId/prompts/:version/activate — activate a specific version
  router.put('/:agentId/prompts/:version/activate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { agentId, version } = req.params;
      const activated = await agentRepository.activatePromptVersion(user.tenantId, agentId as string, version as string);
      res.json(activated);
    } catch (e: any) {
      console.error('agentRoutes PUT activate prompt error:', e);
      res.status(500).json({ error: e?.message || 'Failed to activate prompt version' });
    }
  });

  // GET /api/agents/journey/:leadId — get full journey for a lead (LEAD_ANALYST)
  router.get('/journey/:leadId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const journey = await agentRepository.getLeadJourney(user.tenantId, req.params.leadId as string, limit);
      res.json(journey);
    } catch (e) {
      console.error('agentRoutes GET journey error:', e);
      res.status(500).json({ error: 'Failed to get lead journey' });
    }
  });

  // N2: GET /api/agents/performance — prompt performance metrics dashboard
  router.get('/performance', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });
      const agentId = req.query.agentId as string | undefined;
      const metrics = await agentRepository.getPromptPerformanceMetrics(user.tenantId, agentId);
      res.json(metrics);
    } catch (e) {
      console.error('agentRoutes GET /performance error:', e);
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  });

// N3: POST /api/agents/stream — SSE streaming for long-form agents (Contract, Legal)
  router.post('/stream', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { systemPrompt, userMessage, model } = req.body as {
        systemPrompt?: string;
        userMessage: string;
        model?: string;
      };
      if (!userMessage) return res.status(400).json({ error: 'userMessage is required' });
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const sysPrompt = systemPrompt || 'You are a helpful Vietnamese real estate assistant.';
      const streamModel = model || 'gemini-2.5-flash';
      for await (const chunk of streamAgentResponse(sysPrompt, userMessage, streamModel)) {
        res.write('data: ' + JSON.stringify({ text: chunk }) + '\n\n');
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) {
      console.error('agentRoutes POST /stream error:', e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Streaming failed' });
      } else {
        res.write('data: ' + JSON.stringify({ error: 'Stream interrupted' }) + '\n\n');
        res.end();
      }
    }
  });

  return router;
}
