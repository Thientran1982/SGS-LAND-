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
import { detectGuideDataGroup, renderGuideDataSummary } from '../ai/guideDataSources';
import { supportRequestRepository, SUPPORT_STATUSES } from '../repositories/supportRequestRepository';

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
    'get_guide_data_summary',
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

            const body = (req.body as Record<string, any>) || {};
            if (toolName === 'get_guide_data_summary') {
                const validGroups = new Set(['dashboard', 'leads', 'inventory', 'inbox', 'contracts']);
                if (!validGroups.has(body.group) || !['vn', 'en'].includes(body.language)) {
                    return res.status(400).json({
                        error: 'group hoặc language không hợp lệ.',
                        code: 'GUIDE_DATA_CONTRACT_INVALID',
                    });
                }
            }
            const args = toolName === 'get_guide_data_summary'
                ? { group: body.group, timeRange: body.timeRange, language: body.language, tenantId: user.tenantId, userId: user.id, role: user.role }
                : { ...body, tenantId: user.tenantId };
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
        const language = context?.language === 'en' ? 'en' : context?.language === 'vn' ? 'vn' : null;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'message không được trống.' });
        }

        try {
            // Do not send guide questions through handle_live_chat: that
            // dispatcher can select CRM tools from user-controlled keywords.
            if (context?.mode === 'platform_guide') {
                if (!language) {
                    return res.status(400).json({ error: 'language phải là vn hoặc en.', code: 'GUIDE_LANGUAGE_INVALID' });
                }
                const group = detectGuideDataGroup(message);
                if (group) {
                    const data = await liveChatEngine.callTool('get_guide_data_summary', {
                        tenantId: user.tenantId,
                        userId: user.id,
                        role: user.role,
                        group,
                        timeRange: context?.timeRange || '30d',
                        language,
                    });
                    return res.json({
                        sessionId,
                        intent: `GUIDE_${group.toUpperCase()}`,
                        response: renderGuideDataSummary(data),
                        sources: [{ tool: 'get_guide_data_summary', source: 'Scoped CRM summary' }],
                        dataScope: data.scope,
                        freshness: data.freshness,
                        status: data.status,
                        group,
                        executedTools: ['get_guide_data_summary'],
                    });
                }
                const knowledge = await liveChatEngine.callTool('get_platform_knowledge', {
                    tenantId: user.tenantId,
                    domain: 'platform',
                    query: message.slice(0, 600),
                    sessionId,
                    language,
                });
                return res.json({
                    sessionId,
                    intent: knowledge?.intent || 'PLATFORM_GUIDE',
                    response: typeof knowledge?.knowledge === 'string'
                        ? knowledge.knowledge
                        : 'Tôi chưa có thông tin hướng dẫn đã xác minh cho câu hỏi này.',
                    sources: knowledge?.source ? [{ tool: 'get_platform_knowledge', source: knowledge.source }] : [],
                    groundingStatus: knowledge?.groundingStatus || (knowledge?.knowledge ? 'GROUNDED' : 'INSUFFICIENT_DATA'),
                    language,
                    status: knowledge?.status,
                    escalationReason: knowledge?.escalationReason,
                    executedTools: ['get_platform_knowledge'],
                });
            }

            return res.status(403).json({
                error: 'Trợ lý hướng dẫn chỉ hỗ trợ truy vấn kiến thức đã xác minh.',
                code: 'GUIDE_MODE_REQUIRED',
            });
        } catch (e: any) {
            logger.error('[liveChatAgentRoutes] /chat error:', e);
            // A guide request must remain usable during a transient provider
            // timeout. Return a safe, honest fallback instead of turning a
            // temporary AI problem into a misleading "cannot connect" error.
            if (context?.mode === 'platform_guide' && language) {
                return res.status(200).json({
                    sessionId,
                    intent: 'PLATFORM_GUIDE',
                    response: language === 'en'
                        ? 'I cannot verify that guide detail right now. Please open the User Guide from the main menu, or tell me which screen you are currently viewing so I can guide you from there.'
                        : 'Mình chưa thể xác minh chi tiết hướng dẫn này lúc này. Bạn hãy mở mục Hướng dẫn sử dụng ở menu chính, hoặc cho mình biết bạn đang ở màn hình nào để mình hướng dẫn tiếp.',
                    sources: [{ tool: 'platform_guide_fallback', source: 'Verified platform guide' }],
                    groundingStatus: 'INSUFFICIENT_DATA',
                    status: 'empty',
                    degraded: true,
                });
            }
            return sendAiError(res, e, 'liveChatAgentRoutes');
        }
    });

    // Support requests are deliberately separate from the AI tool dispatcher.
    // The authenticated user and tenant are always taken from the token.
    router.get('/support-requests', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        try {
            const staff = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role);
            const data = staff
                ? await supportRequestRepository.listForStaff(user.tenantId, typeof req.query.status === 'string' ? req.query.status : undefined)
                : await supportRequestRepository.findForUser(user.tenantId, user.id);
            return res.json({ data });
        } catch (e) {
            logger.error('[liveChatAgentRoutes] support request list error:', e);
            return res.status(500).json({ error: 'Không thể tải yêu cầu hỗ trợ.' });
        }
    });

    router.post('/support-requests', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const body = req.body || {};
        if (body.consent !== true) return res.status(400).json({ error: 'Bạn cần xác nhận đồng ý để gửi yêu cầu.', code: 'SUPPORT_CONSENT_REQUIRED' });
        const text = `${body.title || ''} ${body.description || ''}`;
        if (/(password|mật khẩu|mat khau|otp|token|api key|api_key|secret|thẻ ngân hàng|the ngan hang|private key)/i.test(text)) {
            return res.status(400).json({ error: 'Không gửi mật khẩu, OTP, token, khóa bí mật hoặc thông tin thẻ trong yêu cầu.', code: 'SUPPORT_SENSITIVE_DATA' });
        }
        try {
            const request = await supportRequestRepository.create(user.tenantId, user.id, body);
            return res.status(201).json(request);
        } catch (e: any) {
            if (e?.message === 'TITLE_AND_DESCRIPTION_REQUIRED') return res.status(400).json({ error: 'Tiêu đề và mô tả là bắt buộc.' });
            logger.error('[liveChatAgentRoutes] support request create error:', e);
            return res.status(500).json({ error: 'Không thể tạo yêu cầu hỗ trợ.' });
        }
    });

    router.get('/support-requests/:id', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const requestId = String(req.params.id);
        try {
            const staff = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role);
            const request = staff
                ? (await supportRequestRepository.listForStaff(user.tenantId)).find((row: any) => row.id === requestId)
                : await supportRequestRepository.findForUser(user.tenantId, user.id, requestId);
            if (!request) return res.status(404).json({ error: 'Yêu cầu hỗ trợ không tồn tại.' });
            return res.json(request);
        } catch (e) {
            logger.error('[liveChatAgentRoutes] support request detail error:', e);
            return res.status(500).json({ error: 'Không thể tải yêu cầu hỗ trợ.' });
        }
    });

    router.patch('/support-requests/:id', authenticateToken, apiRateLimit, async (req: Request, res: Response) => {
        const user = (req as any).user;
        const requestId = String(req.params.id);
        if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role)) {
            return res.status(403).json({ error: 'Chỉ nhân viên phụ trách mới có thể cập nhật yêu cầu.' });
        }
        const status = String(req.body?.status || '');
        if (!(SUPPORT_STATUSES as readonly string[]).includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
        if (req.body?.reply && /(password|mật khẩu|otp|token|api key|secret|thẻ ngân hàng)/i.test(String(req.body.reply))) {
            return res.status(400).json({ error: 'Phản hồi không được chứa dữ liệu nhạy cảm.' });
        }
        try {
            const updated = await supportRequestRepository.updateByStaff(user.tenantId, requestId, user.id, status as any, req.body?.reply);
            if (!updated) return res.status(404).json({ error: 'Yêu cầu hỗ trợ không tồn tại.' });
            return res.json(updated);
        } catch (e) {
            logger.error('[liveChatAgentRoutes] support request update error:', e);
            return res.status(500).json({ error: 'Không thể cập nhật yêu cầu hỗ trợ.' });
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
        const { domain, query, language: requestedLanguage } = (req.body as any) || {};
        if (requestedLanguage !== undefined && requestedLanguage !== 'vn' && requestedLanguage !== 'en') {
            return res.status(400).json({ error: 'language phải là vn hoặc en.', code: 'GUIDE_LANGUAGE_INVALID' });
        }
        const language = requestedLanguage === 'en' ? 'en' : 'vn';

        if (!domain || !query) {
            return res.status(400).json({ error: 'domain và query là bắt buộc.', validDomains: ['area', 'project', 'bank', 'legal', 'platform', 'longthanh', 'valuation'] });
        }

        try {
            const result = await liveChatEngine.callTool('get_platform_knowledge', {
                tenantId: user.tenantId,
                domain,
                query,
                language,
            });
            return res.json(result);
        } catch (e: any) {
            logger.error('[liveChatAgentRoutes] /knowledge error:', e);
            return sendAiError(res, e, 'liveChatAgentRoutes');
        }
    });

    return router;
}
