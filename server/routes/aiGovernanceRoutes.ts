import { Router, Request, Response } from 'express';
import { aiGovernanceRepository } from '../repositories/aiGovernanceRepository';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { GoogleGenAI } from '@google/genai';

export function createAiGovernanceRoutes(authenticateToken: any, optionalAuth?: any) {
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

  // Feedback route: open to guests (optional auth) so anyone can rate a valuation result
  const feedbackMiddleware = optionalAuth || authenticateToken;
  router.post('/feedback', feedbackMiddleware, async (req: Request, res: Response) => {
    try {
      const tenantId: string | undefined = (req as any).user?.tenantId;
      const userId: string | undefined = (req as any).user?.id;
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

      // RLHF reward signal — only meaningful for tenant-scoped (authenticated) feedback
      if (safeIntent && tenantId) {
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

  // Return read-only default skill content so admin can see what's running and decide what to override
  router.get('/prompt-defaults', authenticateToken, async (_req: Request, res: Response) => {
    res.json({
      ROUTER_SYSTEM: { name: 'Router', summary: 'Phân tích ý định người dùng và định tuyến sang agent phù hợp (Inventory / Finance / Legal / Valuation / Sales / Marketing / Contract / Lead).', notes: 'Quy tắc: tự tin → chọn 1 agent. Không chắc → DIRECT_ANSWER. Câu chào/cảm ơn → DIRECT_ANSWER.' },
      WRITER_PERSONA: { name: 'Writer', summary: 'Tính cách và phong cách của tư vấn viên BĐS trả lời khách.', notes: 'Điều chỉnh: Formal / Casual / Data-driven theo hành vi khách.' },
      INVENTORY_SYSTEM: { name: 'Inventory', summary: 'Phân tích bộ lọc tìm BĐS: khu vực, loại nhà, mức giá, diện tích, tiện ích lân cận.', notes: 'Kết hợp full-text search + vector similarity từ DB listing.' },
      FINANCE_SYSTEM: { name: 'Finance', summary: 'Tư vấn vay mua nhà: lãi suất ngân hàng, khả năng trả nợ, so sánh gói vay, cơ cấu vốn.', notes: 'Dữ liệu lãi suất từ Google Search grounding (realtime).' },
      LEGAL_SYSTEM: { name: 'Legal', summary: 'Giải đáp pháp lý BĐS Việt Nam: sổ hồng/sổ đỏ, sang tên, thuế, quy hoạch, tranh chấp.', notes: 'Không thay thế tư vấn pháp lý chuyên nghiệp — luôn khuyến nghị kiểm tra với luật sư.' },
      SALES_SYSTEM: { name: 'Sales', summary: 'Chuẩn bị brief xem nhà, xử lý objections, chiến thuật chốt deal theo giai đoạn khách hàng.', notes: 'Phân loại: Awareness / Consideration / Decision → điều chỉnh pitch phù hợp.' },
      MARKETING_SYSTEM: { name: 'Marketing', summary: 'Soạn nội dung marketing, phân tích ưu đãi, gợi ý chiến dịch kênh digital/offline.', notes: 'Nhắm đúng target: nhà đầu tư / ở thực / tặng / cho thuê.' },
      CONTRACT_SYSTEM: { name: 'Contract', summary: 'Phân tích điều khoản hợp đồng mua bán/thuê BĐS: rủi ro, thiếu sót, kiến nghị sửa đổi.', notes: 'Highlight red flags: phạt vi phạm, điều kiện hoàn tiền, thời gian bàn giao.' },
      LEAD_ANALYST_SYSTEM: { name: 'Lead Analyst', summary: 'Phân tích tâm lý & hành vi khách hàng từ lịch sử tương tác để đưa ra chiến lược tiếp cận.', notes: 'Output: Buying Stage, Pain Points, Next Best Action, Urgency Score.' },
      VALUATION_SYSTEM: { name: 'Valuation Extract', summary: 'STEP 2 — Trích xuất JSON có cấu trúc từ dữ liệu tìm kiếm thô để đưa vào mô hình AVM.', notes: 'Chain-of-Thought bắt buộc: phân tích nguồn dữ liệu, kiểm tra đơn vị, chọn priceMedian có lý do. Ưu tiên: giá giao dịch thực tế > rao bán. Nếu địa chỉ có tên dự án → dùng giá dự án không dùng giá khu vực.' },
      VALUATION_SEARCH_SYSTEM: { name: 'Valuation Sale', summary: 'STEP 1a — Tìm kiếm giá bán/giao dịch thực tế từ thị trường BĐS với Google Search grounding.', notes: 'Ưu tiên nguồn: Báo cáo CBRE/Savills/JLL → giao dịch thứ cấp thực tế → giá rao bán. Phát hiện tên dự án cụ thể → tìm giá chính dự án đó. 18 tháng gần nhất.' },
      VALUATION_RENTAL_SYSTEM: { name: 'Valuation Rental', summary: 'STEP 1b — Tìm kiếm giá thuê và tỷ suất Gross Yield thực tế theo loại BĐS.', notes: 'Thuê nguyên căn (không tính từng phòng trọ). Kho/VP: USD/m²/tháng → quy đổi VNĐ. Gross Yield = thuê năm / giá bán × 100%.' },
    });
  });

  router.post('/simulate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { systemPrompt, userInput, model } = req.body;
      if (!userInput?.trim()) return res.status(400).json({ error: 'userInput is required' });
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
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
