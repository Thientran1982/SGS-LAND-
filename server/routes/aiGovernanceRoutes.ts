import { Router, Request, Response } from 'express';
import { aiGovernanceRepository } from '../repositories/aiGovernanceRepository';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { GoogleGenAI } from '@google/genai';

export function createAiGovernanceRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/safety-logs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 200));
      const result = await aiGovernanceRepository.getSafetyLogs(tenantId, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error('Error fetching AI safety logs:', error);
      res.status(500).json({ error: 'Failed to fetch AI safety logs' });
    }
  });

  router.get('/prompt-templates', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const templates = await aiGovernanceRepository.getPromptTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      res.status(500).json({ error: 'Failed to fetch prompt templates' });
    }
  });

  router.post('/prompt-templates', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can create prompt templates' });
      }
      const template = await aiGovernanceRepository.createPromptTemplate(tenantId, req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating prompt template:', error);
      res.status(500).json({ error: 'Failed to create prompt template' });
    }
  });

  router.put('/prompt-templates/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update prompt templates' });
      }
      const template = await aiGovernanceRepository.updatePromptTemplate(tenantId, req.params.id as string, req.body);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error) {
      console.error('Error updating prompt template:', error);
      res.status(500).json({ error: 'Failed to update prompt template' });
    }
  });

  router.delete('/prompt-templates/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can delete prompt templates' });
      }
      const deleted = await aiGovernanceRepository.deletePromptTemplate(tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Template not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting prompt template:', error);
      res.status(500).json({ error: 'Failed to delete prompt template' });
    }
  });

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const config = await aiGovernanceRepository.getAiConfig(tenantId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching AI config:', error);
      res.status(500).json({ error: 'Failed to fetch AI config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update AI config' });
      }
      const config = await aiGovernanceRepository.upsertAiConfig(tenantId, req.body);
      res.json(config);
    } catch (error) {
      console.error('Error updating AI config:', error);
      res.status(500).json({ error: 'Failed to update AI config' });
    }
  });

  // --- RLHF FEEDBACK ENDPOINTS ---

  const VALID_INTENTS = new Set([
    'SEARCH_INVENTORY', 'CALCULATE_LOAN', 'EXPLAIN_LEGAL', 'DRAFT_BOOKING',
    'EXPLAIN_MARKETING', 'DRAFT_CONTRACT', 'ANALYZE_LEAD', 'ESTIMATE_VALUATION',
    'DIRECT_ANSWER', 'GREETING', 'UNKNOWN',
  ]);

  router.post('/feedback', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const userId = (req as any).user?.id;
      const { interactionId, leadId, rating, correction, agentNode, intent, userMessage, aiResponse, model } = req.body;

      if (rating !== 1 && rating !== -1) {
        return res.status(400).json({ error: 'rating must be 1 (positive) or -1 (negative)' });
      }

      const safeIntent = intent && VALID_INTENTS.has(intent) ? intent : (intent ? 'UNKNOWN' : null);
      const safeCorrection = typeof correction === 'string' ? correction.slice(0, 2000) : undefined;
      const safeUserMessage = typeof userMessage === 'string' ? userMessage.slice(0, 500) : undefined;
      const safeAiResponse = typeof aiResponse === 'string' ? aiResponse.slice(0, 2000) : undefined;
      const safeAgentNode = typeof agentNode === 'string' ? agentNode.slice(0, 50) : undefined;

      const feedback = await feedbackRepository.create(tenantId, {
        interactionId, leadId, userId, rating,
        correction: safeCorrection,
        agentNode: safeAgentNode,
        intent: safeIntent,
        userMessage: safeUserMessage,
        aiResponse: safeAiResponse,
        model: typeof model === 'string' ? model.slice(0, 100) : undefined,
      });

      if (safeIntent) {
        feedbackRepository.computeRewardSignal(tenantId, safeIntent).catch((err) => {
          console.error('[RLHF] Error computing reward signal for', safeIntent, err?.message);
        });
      }

      res.status(201).json(feedback);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'Feedback already submitted for this interaction' });
      }
      console.error('Error creating AI feedback:', error);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });

  router.get('/feedback/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const days = Math.max(1, Math.min(parseInt(req.query.days as string) || 30, 365));
      const stats = await feedbackRepository.getStats(tenantId, days);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
      res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
  });

  router.get('/feedback/rewards', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const signals = await feedbackRepository.getAllRewardSignals(tenantId);
      res.json(signals);
    } catch (error) {
      console.error('Error fetching reward signals:', error);
      res.status(500).json({ error: 'Failed to fetch reward signals' });
    }
  });

  router.get('/feedback/trends', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const days = Math.max(7, Math.min(parseInt(req.query.days as string) || 90, 365));
      const trends = await feedbackRepository.getTrends(tenantId, days);
      res.json(trends);
    } catch (error) {
      console.error('Error fetching feedback trends:', error);
      res.status(500).json({ error: 'Failed to fetch feedback trends' });
    }
  });

  router.get('/feedback/list', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 100));
      const intent = req.query.intent as string | undefined;
      const result = await feedbackRepository.listFeedback(tenantId, page, pageSize, intent);
      res.json(result);
    } catch (error) {
      console.error('Error fetching feedback list:', error);
      res.status(500).json({ error: 'Failed to fetch feedback list' });
    }
  });

  router.post('/feedback/recompute', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can trigger recompute' });
      }
      const intents = ['SEARCH_INVENTORY', 'CALCULATE_LOAN', 'EXPLAIN_LEGAL', 'DRAFT_BOOKING', 'EXPLAIN_MARKETING', 'DRAFT_CONTRACT', 'ANALYZE_LEAD', 'ESTIMATE_VALUATION', 'DIRECT_ANSWER'];
      await Promise.all(intents.map(i => feedbackRepository.computeRewardSignal(tenantId, i).catch(() => {})));
      res.json({ success: true, message: `Recomputed reward signals for ${intents.length} intents` });
    } catch (error) {
      console.error('Error recomputing reward signals:', error);
      res.status(500).json({ error: 'Failed to recompute' });
    }
  });

  router.post('/simulate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { systemPrompt, userInput, model } = req.body;
      if (!userInput?.trim()) return res.status(400).json({ error: 'userInput is required' });
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });
      const ai = new GoogleGenAI({ apiKey });
      const effectiveModel = model || 'gemini-2.5-flash';
      const start = Date.now();
      const response = await ai.models.generateContent({
        model: effectiveModel,
        contents: userInput,
        config: systemPrompt?.trim()
          ? { systemInstruction: systemPrompt }
          : undefined,
      });
      const latencyMs = Date.now() - start;
      res.json({ output: response.text || '', latencyMs, model: effectiveModel });
    } catch (error: any) {
      console.error('Error running prompt simulation:', error);
      res.status(500).json({ error: error?.message || 'Simulation failed' });
    }
  });

  return router;
}
