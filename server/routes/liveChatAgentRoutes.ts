/**
 * Live Chat Agent Engine — HTTP API Routes
 *
 * GET  /api/live-chat/tools           — list all 22 tools + manifest
 * GET  /api/live-chat/verify          — integrity check (22/22 registered)
 * POST /api/live-chat/tools/:toolName — call any tool by name
 * POST /api/live-chat/chat            — shortcut for handle_live_chat
 * POST /api/live-chat/analyze         — shortcut for analyze_chat_session
 * POST /api/live-chat/knowledge       — shortcut for get_platform_knowledge
 *
 * Auth: all endpoints require authenticateToken (tenant-scoped).
 * Rate limit: applied by caller (aiRateLimit for AI tools, apiRateLimit for data tools).
 */

import { Router, Request, Response } from 'express';
import { liveChatEngine } from '../ai/liveChatEngine';
import { logger } from '../middleware/logger';
import { sendAiError } from '../utils/aiErrorHandler';

const AI_TOOLS = new Set([
    'handle_live_chat',
    'analyze_chat_session',
    'get_platform_knowledge',
    'legal_qa',
]);

// The in-product guide is knowledge-only. It must not become a generic
// database proxy for leads, contacts, contracts, or user performance.
const GUIDE_SAFE_TOOLS = new Set([
    'get_platform_knowledge',
    'get_valuation_methodology',
    'get_price_index',
    'get_longthanh_market',
]);

export function createLiveChatAgentRoutes(
    authenticateToken: any,
    aiRateLimit: any,
    apiRateLimit: any,
): Router {
    const router = Router();

    // ── GET /tools — manifest of all 22 tools ─────────────────────────────
    router.get('/tools', authenticateToken, (_req: Request, res: Response) => {
        const tools = liveChatEngine.listTools().filter(tool => GUIDE_SAFE_TOOLS.has(tool.name));
        res.json({
            count: tools.length,
            tools,
        });
    });

    // ── GET /verify — integrity check ────────────────────────────────────
    router.get('/verify', authenticateToken, (_req: Request, res: Response) => {
        const result = liveChatEngine.verify();
        res.status(result.ok ? 200 : 500).json(result);
    });

    // ── POST /tools/:toolName — generic tool caller ───────────────────────
    router.post(
        '/tools/:toolName',
        authenticateToken,
        (req: Request, res: Response, next: any) => {
            // Apply AI rate limit only for AI-backed tools
            const tn = Array.isArray(req.params.toolName) ? req.params.toolName[0] : req.params.toolName;
            if (AI_TOOLS.has(tn)) return aiRateLimit(req, res, next);
            return apiRateLimit(req, res, next);
        },
        async (req: Request, res: Response) => {
            const toolName = Array.isArray(req.params.toolName) ? req.params.toolName[0] : req.params.toolName;
            const user = (req as any).user;

            if (!GUIDE_SAFE_TOOLS.has(toolName)) {
                return res.status(403).json({
                    error: 'Tool này không được phép gọi từ trợ lý hướng dẫn.',
                    code: 'GUIDE_TOOL_FORBIDDEN',
                });
            }

            if (!liveChatEngine.hasTool(toolName)) {
                return res.status(404).json({
                    error: `Tool "${toolName}" không tồn tại.`,
                    available: liveChatEngine.listTools().map(t => t.name),
                });
            }

            const args = { ...((req.body as Record<string, any>) || {}), tenantId: user.tenantId };
            const t0 = Date.now();

            try {
                const result = await liveChatEngine.callTool(toolName, args);
                return res.json({
                    tool: toolName,
                    latencyMs: Date.now() - t0,
                    result,
                });
            } catch (e: any) {
                logger.error(`[liveChatAgentRoutes] ${toolName} error:`, e);
                return sendAiError(res, e, `liveChatAgentRoutes/${toolName}`);
            }
        },
    );

    // ── POST /chat — shortcut: handle_live_chat ───────────────────────────
    router.post('/chat', authenticateToken, aiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { message, sessionId, context } = (req.body as any) || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'message không được trống.' });
        }

        try {
            // Do not send guide questions through handle_live_chat: that
            // dispatcher can select CRM tools from user-controlled keywords.
            if (context?.mode === 'platform_guide') {
                const knowledge = await liveChatEngine.callTool('get_platform_knowledge', {
                    tenantId: user.tenantId,
                    domain: 'platform',
                    query: message.slice(0, 600),
                    sessionId,
                });
                return res.json({
                    sessionId,
                    intent: 'PLATFORM_GUIDE',
                    response: typeof knowledge?.knowledge === 'string'
                        ? knowledge.knowledge
                        : 'Tôi chưa có thông tin hướng dẫn đã xác minh cho câu hỏi này.',
                    sources: knowledge?.source ? [{ tool: 'get_platform_knowledge', source: knowledge.source }] : [],
                    groundingStatus: knowledge?.knowledge ? 'GROUNDED' : 'INSUFFICIENT_DATA',
                    executedTools: ['get_platform_knowledge'],
                });
            }

            return res.status(403).json({
                error: 'Trợ lý hướng dẫn chỉ hỗ trợ truy vấn kiến thức đã xác minh.',
                code: 'GUIDE_MODE_REQUIRED',
            });
        } catch (e: any) {
            logger.error('[liveChatAgentRoutes] /chat error:', e);
            return sendAiError(res, e, 'liveChatAgentRoutes');
        }
    });

    // ── POST /analyze — shortcut: analyze_chat_session ───────────────────
    router.post('/analyze', authenticateToken, aiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { messages, sessionId, leadId } = (req.body as any) || {};

        if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role)) {
            return res.status(403).json({
                error: 'Bạn không có quyền phân tích phiên chat CRM.',
                code: 'CHAT_ANALYSIS_FORBIDDEN',
            });
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages[] không được trống.' });
        }

        try {
            const result = await liveChatEngine.callTool('analyze_chat_session', {
                tenantId: user.tenantId,
                messages,
                sessionId,
                leadId,
            });
            return res.json(result);
        } catch (e: any) {
            logger.error('[liveChatAgentRoutes] /analyze error:', e);
            return sendAiError(res, e, 'liveChatAgentRoutes');
        }
    });

    // ── POST /knowledge — shortcut: get_platform_knowledge ───────────────
    router.post('/knowledge', authenticateToken, aiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { domain, query } = (req.body as any) || {};

        if (!domain || !query) {
            return res.status(400).json({ error: 'domain và query là bắt buộc.', validDomains: ['area', 'project', 'bank', 'legal', 'platform', 'longthanh', 'valuation'] });
        }

        try {
            const result = await liveChatEngine.callTool('get_platform_knowledge', {
                tenantId: user.tenantId,
                domain,
                query,
            });
            return res.json(result);
        } catch (e: any) {
            logger.error('[liveChatAgentRoutes] /knowledge error:', e);
            return sendAiError(res, e, 'liveChatAgentRoutes');
        }
    });

    return router;
}
