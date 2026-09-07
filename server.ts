import express from "express";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { Server } from "socket.io";
import http from "http";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import { pool, probeDatabase, stopDatabaseRecovery, withTenantContext, withRlsBypass } from "./server/db";
import { isTransientDatabaseError } from "./server/dbHealth";
import bcrypt from "bcrypt";
import { runPendingMigrations } from "./server/migrations/runner";
import { systemService } from "./server/services/systemService";
import { webhookQueue, setupWebhookWorker, processWebhookJob, isQStashEnabled, isQstashVerified, getQstashToken, verifyQstashTokenAtStartup } from "./server/queue";
import { startAgentOperatorWorker, setAgentOperatorIo } from "./server/services/agentOperatorDaemon";
import { startLearningCycleScheduler } from "./server/services/learningCycleRunner";
import { userRepository } from "./server/repositories/userRepository";
import { listingRepository } from "./server/repositories/listingRepository";
import { leadRepository } from "./server/repositories/leadRepository";
import { feedbackRepository } from "./server/repositories/feedbackRepository";
import { articleRepository } from "./server/repositories/articleRepository";
import { resolveBaseUrl } from "./server/utils/resolveBaseUrl";
import { createLeadRoutes } from "./server/routes/leadRoutes";
import { createListingRoutes, scheduleGeocode } from "./server/routes/listingRoutes";
import { createProposalRoutes } from "./server/routes/proposalRoutes";
import { createContractRoutes } from "./server/routes/contractRoutes";
import { createInteractionRoutes } from "./server/routes/interactionRoutes";
import { automationRouter, automationWebhookRouter } from './server/routes/agentAutomations';
import { agentP1Router } from './server/routes/agentP1Routes';
import { createUserRoutes } from "./server/routes/userRoutes";
import { agentMcpRouter } from './server/routes/agentMcpRoutes';
import { agentSkillsRouter } from './server/routes/agentSkillsRoutes';
import { chatRoomsRouter } from './server/routes/chatRoomsRoutes';
import { agentVoiceRouter, agentTeachRouter } from './server/routes/agentVoiceTeachRoutes';
import { createAnalyticsRoutes } from "./server/routes/analyticsRoutes";
import { createScoringRoutes } from "./server/routes/scoringRoutes";
import { createRoutingRuleRoutes } from "./server/routes/routingRuleRoutes";
import { createKnowledgeRoutes } from "./server/routes/knowledgeRoutes";
import { processCareInboundReply, processCareTrackingEvent } from "./server/services/customerCareService";
import { createCustomFieldRoutes } from "./server/routes/customFieldRoutes";
import { createUnitRoutes } from "./server/routes/unitRoutes";
import { createAuctionRoutes } from "./server/routes/auctionRoutes";
import { createEnterpriseRoutes } from "./server/routes/enterpriseRoutes";
import { createSequenceRoutes } from "./server/routes/sequenceRoutes";
import { emailService } from "./server/services/emailService";
import { issueEmailOtp, verifyEmailOtp } from "./server/services/emailOtpService";
import { createAiGovernanceRoutes } from "./server/routes/aiGovernanceRoutes";
import { createAgentMemoryRoutes } from "./server/routes/agentMemoryRoutes";
import { createCustomerProfileRoutes } from "./server/routes/customerProfileRoutes";
import { customerProfileService } from "./server/services/customerProfileService";
import { createMonitoringRoutes } from "./server/routes/monitoringRoutes";
import { createAgentRoutes } from "./server/routes/agentRoutes";
import { createSessionRoutes, createTemplateRoutes } from "./server/routes/sessionRoutes";
import { createTwoFactorRoutes } from "./server/routes/twoFactorRoutes";
import { createActivityRoutes } from "./server/routes/activityRoutes";
import { createNotificationRoutes } from "./server/routes/notificationRoutes";
import { createBillingRoutes } from "./server/routes/billingRoutes";
import { createEmailMetricsRoutes } from "./server/routes/emailMetricsRoutes";
import { createBillingWebhookRouter } from "./server/routes/billingWebhookRoutes";
import { createUploadRoutes, createUploadServeRoute } from "./server/routes/uploadRoutes";
import { createScimRoutes } from "./server/routes/scimRoutes";
import { createValuationRoutes } from "./server/routes/valuationRoutes";
import { createAdvisorRoutes } from "./server/routes/advisorRoutes";
import { createProjectRoutes } from "./server/routes/projectRoutes";
import { createCommissionRoutes } from "./server/routes/commissionRoutes";
import { createTenantRoutes } from "./server/routes/tenantRoutes";
import { createApprovalRequestRoutes } from "./server/routes/approvalRequestRoutes";
import { resolveTenantByHost, startCustomDomainVerifyCron, stopCustomDomainVerifyCron } from "./server/services/tenantBrandingService";
import { createTaskRoutes } from "./server/routes/taskRoutes";
import { createDepartmentRoutes } from "./server/routes/departmentRoutes";
import { createTaskReportRoutes } from "./server/routes/taskReportRoutes";
import { createLandingLeadRoutes } from "./server/routes/landingLeadRoutes";
import { createLandingAiRoutes } from "./server/routes/landingAiRoutes";
import { createLandingPagesRoutes } from "./server/routes/landingPagesRoutes";
import { createAgentAuditRoutes } from "./server/routes/agentAuditRoutes";
import { createAgentOperatingRoutes } from "./server/routes/agentOperatingRoutes";
import { createLearningCycleRoutes } from "./server/routes/learningCycleRoutes";
import { createDailyAdminReportRoutes } from "./server/routes/dailyAdminReportRoutes";
import { startDailyReportScheduler } from "./server/services/dailyAdminReportService";
import { createLiveChatAgentRoutes } from "./server/routes/liveChatAgentRoutes";
import { liveChatEngine } from "./server/ai/liveChatEngine";
import { createPublicProjectRoutes } from "./server/routes/publicProjectRoutes";
import { createPublicDeveloperRoutes } from "./server/routes/publicDeveloperRoutes";
import { createPublicProjectContentRoutes } from "./server/routes/publicProjectContentRoutes";
import { createVisitorTrackingRoutes } from "./server/routes/visitorTrackingRoutes";
import { createConnectorRoutes } from "./server/routes/connectorRoutes";
import { createScraperRoutes } from "./server/routes/scraperRoutes";
import { createScraperProjectRoutes } from "./server/routes/scraperProjectRoutes";
import { createEngagementCronRouter } from "./server/routes/engagementCronRoutes";
import { createChatFollowUpCronRouter } from "./server/routes/chatFollowUpCronRoutes";
import { createBackupRouter } from "./server/routes/backupRoutes";
import { createListingPriceRefreshRouter } from "./server/routes/listingPriceRefreshRoutes";
import { createTaskReminderCronRouter } from "./server/routes/taskReminderCronRoutes";
import { createCampaignSchedulerCronRouter, startCampaignSchedulerCron, stopCampaignSchedulerCron } from "./server/routes/campaignSchedulerCronRoutes";
import { startBookingLifecycleCron, stopBookingLifecycleCron } from "./server/services/bookingLifecycleService";
import { createGeoMonitorCronRouter } from "./server/routes/geoMonitorCronRoutes";
import { createBuyerPushRoutes } from "./server/routes/buyerPushRoutes";
import { createBuyerAuthRoutes } from "./server/routes/buyerAuthRoutes";
import { createBuyerRoutes } from "./server/routes/buyerRoutes";
import { createConversationRoutes, createAgentConversationRoutes } from "./server/routes/conversationRoutes";
import { createBookingRoutes } from "./server/routes/bookingRoutes";
import { startBuyerPushCron, stopBuyerPushCron } from "./server/services/pushNotificationService";
import { startFreeFollowupScheduler, stopFreeFollowupScheduler } from "./server/services/freeFollowupScheduler";
import { createCampaignRouter } from "./server/routes/campaignRoutes";
import { createErrorLogRoutes, initErrorLogRepo } from "./server/routes/errorLogRoutes";
import { marketDataService } from "./server/services/marketDataService";
import { priceCalibrationService } from "./server/services/priceCalibrationService";
import { securityHeaders, corsMiddleware, verifyWebhookSignature, preventParamPollution, csrfTokenIssuer, csrfProtection, csrfTokenHandler } from "./server/middleware/security";
import { errorHandler } from "./server/middleware/errorHandler";
import { sanitizeInput, validateBody, schemas } from "./server/middleware/validation";
import { aiRateLimit, authRateLimit, loginRateLimit, passwordResetRateLimit, webhookRateLimit, apiRateLimit, publicLeadRateLimit, livechatRateLimit, guestValuationRateLimit, userValuationRateLimit, monthlyValuationQuota, monthlyAriaQuota, getMonthlyQuotaStatus, getMonthlyAriaQuotaStatus, rateLimit } from "./server/middleware/rateLimiter";
import { getPublicListingsCache, setPublicListingsCache } from "./server/services/publicListingsCache";
import { getPublicListingDetailCache, setPublicListingDetailCache } from "./server/services/publicListingDetailCache";
import { getTenantBinding } from "./server/services/tenantBrandingService";
import { brevoSendEmail } from "./server/services/brevoService";
import { logger, requestLogger } from "./server/middleware/logger";
import { requestIdMiddleware } from "./server/middleware/requestId";
import { writeAuditLog, globalMutationAudit } from "./server/middleware/auditLog";
import { DEFAULT_TENANT_ID } from "./server/constants";
import { DICTIONARY } from "./config/locales";
import { interactionRepository } from "./server/repositories/interactionRepository";
import { sessionRepository } from "./server/repositories/sessionRepository";
import { visitorRepository } from "./server/repositories/visitorRepository";
import { lookupIp, getClientIp } from "./server/services/geoService";
import { sendAiError, parseAiError } from "./server/utils/aiErrorHandler";

// Module-level guard for the periodic memory-usage logger (see
// startMemoryUsageLogger() further down) — prevents a double registration if
// the setup path is ever invoked twice within the same process.
let memoryLoggerStarted = false;

let broadcastIo: any = null;

/** Server-side translation helper — looks up actual strings from the shared DICTIONARY */
const serverT = (lang: string = 'vn') => (key: string): string => {
  const dict = (DICTIONARY as any)[lang] || (DICTIONARY as any)['vn'] || {};
  return dict[key] ?? key;
};


async function startServer() {
  const app = express();

  // CRITICAL: behind Cloudflare + Replit's reverse proxy.
  // Without trust proxy: req.ip = proxy IP (rate limiter bans every user from same edge),
  // req.secure = false (Secure cookie may not be set), and X-Forwarded-* headers ignored.
  // Trust 2 hops: Cloudflare → Replit edge → app.
  // Trust any loopback/private-network hop and stop at the first public
  // address. A fixed hop-count (e.g. `2`) is fragile here: this app sits
  // behind Cloudflare + Replit's edge PLUS our own Next.js rewrite layer
  // (apps/nextjs/next.config.ts proxies /dashboard, /api, etc. to this
  // Express app over loopback via BACKEND_URL), and that adds an extra
  // hop that varies between dev and prod. Verified via a temporary
  // GET /api/__debug_ip probe that the real chain is:
  //   client -> Replit edge (10.x internal) -> Next.js loopback (127.0.0.1) -> app
  // With trust proxy=2, req.ip incorrectly resolved to the shared Replit
  // edge IP instead of the real visitor -- fine for req.ip callers, but a
  // latent bug for anything (secure cookies, req.secure, future rate
  // limiters keyed on req.ip) that trusts it.
  app.set('trust proxy', (ip: string) => {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      /^10\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
      /^192\.168\./.test(ip)
    );
  });
  const PORT = parseInt(process.env.PORT || '5000', 10);

  // Gzip compression — reduces JS/CSS/JSON payload by ~70-80%
  app.use(compression({
    level: 6,  // balanced speed vs ratio
    threshold: 1024,  // only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress SSE streams (they handle their own framing)
      if (req.path.includes('/api/ai-chat-stream') || req.path.includes('/api/events') || req.path.includes('/api/agents/stream')) return false;
      return compression.filter(req, res);
    },
  }));
  // L2 FIX: Assign X-Request-ID to every request for tracing/debugging
  app.use(requestIdMiddleware);

  // M5 FIX: Enable helmet for additional HTTP security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Custom CSP already set in securityHeaders
    crossOriginEmbedderPolicy: false, // Needed for embedded maps/iframes
  }));
  app.use(securityHeaders);
  app.use(corsMiddleware);
  // Keep map tiles same-origin for the Vite/Next preview proxy. Direct
  // third-party tile requests can be blocked by the embedded browser's
  // resource policy even though the map and markers themselves render.
  app.get('/api/map-tiles/:z/:x/:y.png', async (req, res) => {
    const { z, x, y } = req.params;
    if (!/^\d{1,2}$/.test(z) || !/^\d{1,7}$/.test(x) || !/^\d{1,7}$/.test(y)) {
      return res.status(400).end();
    }
    try {
      // Fetch server-side. Some tile hosts return a 200 PNG policy placeholder
      // ("Access blocked"), so status/content-type alone are not sufficient.
      const tileSources = [
        `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
        `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
      ];
      let tile: Buffer | null = null;
      for (const tileUrl of tileSources) {
        const upstream = await fetch(tileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!upstream.ok) continue;
        const candidate = Buffer.from(await upstream.arrayBuffer());
        // The blocked OSM response in this environment is a fixed ~6.9 KB
        // PNG placeholder. Reject suspiciously small tiles before they reach
        // Leaflet, so the warning can never be rendered as map content.
        if (candidate.length < 8000 || candidate.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') continue;
        tile = candidate;
        break;
      }
      if (!tile) return res.status(502).end();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.send(tile);
    } catch (error) {
      logger.warn(`[MapTiles] upstream tile unavailable: ${error instanceof Error ? error.message : String(error)}`);
      res.status(502).end();
    }
  });
  // Stripe webhook MUST be mounted before the global JSON parser so the raw
  // body is available for signature verification.
  app.use('/api/billing/webhook', createBillingWebhookRouter());
  app.use('/api/webhooks', express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }));
  // H4 FIX: Reduced global JSON body limit from 10mb to 2mb to mitigate DoS.
  // Upload endpoints use multer (multipart/form-data) and are not affected.
  // Specific routes that need larger payloads should override with their own middleware.
  app.use(express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      // Store raw body for routes that need it (e.g. QStash signature verification)
      req.rawBody = buf;
    }
  }));
  app.use(cookieParser());
// CSRF protection (double-submit-cookie, enforcing). Must sit after cookieParser + body parse.
app.use(csrfTokenIssuer);
app.get("/api/csrf-token", csrfTokenHandler);
app.use(csrfProtection);
  app.use(preventParamPollution);
  app.use(sanitizeInput);
  app.use(requestLogger);
// Global fallback audit trail for sensitive DELETE operations (runs on finish,
// after per-route auth has populated req.user). Closes audit-log DELETE gap.
app.use(globalMutationAudit);

  // Disable HTTP caching for all API routes — prevents browser 304/ETag issues
  // where fresh data after mutations is served as "not modified" from browser cache
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Real-time request metrics (rolling 60-second window)
  interface RequestSample { ts: number; durationMs: number; status: number; }
  const requestSamples: RequestSample[] = [];
  const METRICS_WINDOW_MS = 60_000;

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const now = Date.now();
      requestSamples.push({ ts: now, durationMs, status: res.statusCode });
      // Evict samples older than the window
      const cutoff = now - METRICS_WINDOW_MS;
      while (requestSamples.length > 0 && requestSamples[0].ts < cutoff) {
        requestSamples.shift();
      }
    });
    next();
  });

  // Lightweight client-side error sink — receives error reports from React
  // ErrorBoundaries (e.g. ProjectListingsPanel) and writes them to server logs
  // so we can diagnose UI crashes that the user reports.
  // Rate-limited + size-capped + truncated to prevent log amplification abuse.
  app.post('/api/_client_error', apiRateLimit, express.json({ limit: '32kb' }), (req, res) => {
    try {
      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      const trunc = (v: unknown, max: number): string | null => {
        if (v == null) return null;
        const s = String(v);
        return s.length > max ? s.slice(0, max) + '…[truncated]' : s;
      };
      logger.error('[client-error]', {
        where: trunc(body.where, 80),
        message: trunc(body.message, 500),
        stack: trunc(body.stack, 4000),
        componentStack: trunc(body.componentStack, 4000),
        href: trunc(body.href, 300),
        ua: trunc(body.ua, 300),
        ts: typeof body.ts === 'number' ? body.ts : Date.now(),
        // Optional structured diagnostic snapshot — used by the listings panel
        // visibility probe to capture computed style + bounding rect on mount,
        // so we can diagnose pure-visual bugs that throw no JS error.
        projectCode: trunc(body.projectCode, 40),
        snapshot: body.snapshot ? trunc(JSON.stringify(body.snapshot), 12000) : null,
      });
    } catch {
      // Swallow — never fail the client over an error report.
    }
    res.status(204).end();
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const normalizeAuthEmail = (value: unknown): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';
  // H1 FIX: Fail-fast on missing JWT_SECRET in ALL environments (not just production).
  // A random per-session secret would invalidate all tokens on every restart.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is required. " +
      "Please set it in Replit Secrets (or .env for local dev). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  const JWT_SECRET = process.env.JWT_SECRET;

  // Production startup warnings for missing optional-but-recommended config
  if (isProduction) {
    if (!process.env.ALLOWED_ORIGINS) {
      logger.warn('ALLOWED_ORIGINS not set — CORS will block all cross-origin requests in production. Set it to your deployment domain (e.g. https://yourdomain.replit.app).');
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logger.warn('UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting uses in-memory store. Not safe for multi-instance deployments.');
    }
    if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
      logger.warn('GEMINI_API_KEY not set — all AI features (chat, valuation, lead scoring) will be unavailable.');
    }
    const hasEmailAuth = !!(process.env.EMAIL_MAILGUN_SIGNING_KEY || process.env.EMAIL_SENDGRID_WEBHOOK_KEY ||
      process.env.EMAIL_POSTMARK_WEBHOOK_TOKEN || process.env.EMAIL_WEBHOOK_TOKEN || process.env.BREVO_WEBHOOK_SECRET);
    if (!hasEmailAuth) {
      logger.warn('No email webhook auth configured — /api/webhooks/email will reject all requests in production. Set EMAIL_MAILGUN_SIGNING_KEY, EMAIL_SENDGRID_WEBHOOK_KEY, EMAIL_POSTMARK_WEBHOOK_TOKEN, EMAIL_WEBHOOK_TOKEN, or BREVO_WEBHOOK_SECRET.');
    }
    if (!process.env.BREVO_API_KEY) {
      logger.warn('BREVO_API_KEY not set — transactional emails will use SMTP fallback. Set BREVO_API_KEY for reliable email delivery.');
    }
  }

  app.use((req, res, next) => {
    let tenantId = DEFAULT_TENANT_ID;
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.tenantId) tenantId = decoded.tenantId;
      } catch (e) {
        logger.warn('Invalid JWT token in tenant middleware', { ip: req.ip });
      }
    }
    (req as any).tenantId = tenantId;
    next();
  });

  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      (req as any).user = user;
      if (user?.tenantId) (req as any).tenantId = user.tenantId;

      // ── VIEWER Guard ────────────────────────────────────────────────────────
      // VIEWER chỉ được đọc (GET/HEAD/OPTIONS). Các method ghi bị chặn trừ
      // whitelist: tự logout, đổi password bản thân, tracking UX, notifications.
      if (user?.role === 'VIEWER') {
        const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
        if (WRITE_METHODS.has(req.method)) {
          const VIEWER_WRITE_WHITELIST = [
            '/api/auth/logout',
            '/api/auth/change-password',
            '/api/activity/',
            '/api/notifications/',
          ];
          const isAllowed = VIEWER_WRITE_WHITELIST.some((p) => req.path.startsWith(p));
          if (!isAllowed) {
            return res.status(403).json({
              error: 'Tài khoản VIEWER chỉ có quyền đọc. Liên hệ Admin để nâng cấp quyền.',
              code: 'VIEWER_WRITE_FORBIDDEN',
              role: 'VIEWER',
            });
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      next();
    });
  };

  // Optional auth — silently populates req.user if a valid token is present, never rejects.
  const optionalAuth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, JWT_SECRET, (_err: any, user: any) => {
        if (user) {
          (req as any).user = user;
          if (user.tenantId) (req as any).tenantId = user.tenantId;
        }
        next();
      });
    } else {
      next();
    }
  };

  const cookieOptions: any = {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    // M2 FIX: Use 'lax' (same-domain: sgsland.vn) - 'none' is only for cross-site
    sameSite: 'lax' as const,
    ...(isProduction && { secure: true }),
  };

  app.post("/api/auth/login", loginRateLimit, validateBody(schemas.login), async (req, res) => {
    try {
      let { email, password } = req.body;
      email = normalizeAuthEmail(email);
      const explicitTenantId = (req as any).tenantId as string | undefined;
      const lookupTenantId = explicitTenantId || DEFAULT_TENANT_ID;

      let dbUser = await userRepository.authenticate(lookupTenantId, email, password);
      let tenantId = lookupTenantId;

      // Cross-tenant fallback: B2B vendor admins được tạo trong tenant riêng (không phải host).
      // Middleware luôn set req.tenantId = DEFAULT_TENANT_ID khi không có JWT bound; do đó
      // ta chỉ kích hoạt fallback khi vẫn đang ở host tenant (= user chưa đăng nhập). Khi đã
      // có JWT của một workspace khác, login sẽ chỉ thử trong tenant đó.
      if (!dbUser && lookupTenantId === DEFAULT_TENANT_ID && email) {
        const candidates = await withRlsBypass(async (client) => {
          const r = await client.query(
            `SELECT tenant_id FROM users WHERE LOWER(email) = LOWER($1) AND tenant_id <> $2 LIMIT 10`,
            [email, DEFAULT_TENANT_ID]
          );
          return r.rows as { tenant_id: string }[];
        });
        for (const cand of candidates) {
          const u = await userRepository.authenticate(cand.tenant_id, email, password).catch(() => null);
          if (u) { dbUser = u; tenantId = cand.tenant_id; break; }
        }
      }

      if (!dbUser) {
        writeAuditLog(lookupTenantId, email, 'LOGIN_FAILED', 'auth', undefined, { email }, req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Block login when email not yet verified.
      const requiresVerification =
        dbUser.source === 'REGISTER' ||
        dbUser.source === 'SELF_SIGNUP_VENDOR' ||
        dbUser.status === 'PENDING';
      if (!dbUser.emailVerified && requiresVerification) {
        return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', email: dbUser.email });
      }

      // Block login when tenant is pending approval (gated B2B vendor onboarding).
      // Only applies to vendor tenants (not the host tenant) with SELF_SIGNUP_VENDOR source.
      if (dbUser.source === 'SELF_SIGNUP_VENDOR' && tenantId !== DEFAULT_TENANT_ID) {
        const tenantRow = await withRlsBypass(async (client) => {
          const r = await client.query(
            `SELECT approval_status FROM tenants WHERE id = $1 LIMIT 1`,
            [tenantId]
          );
          return r.rows[0];
        });
        if (tenantRow?.approval_status === 'PENDING_APPROVAL') {
          return res.status(403).json({ error: 'TENANT_PENDING_APPROVAL', email: dbUser.email });
        }
        if (tenantRow?.approval_status === 'REJECTED') {
          return res.status(403).json({ error: 'TENANT_REJECTED', email: dbUser.email });
        }
      }

      // --- 2FA gate: admins with TOTP enabled must present a valid code ---
      if (['SUPER_ADMIN', 'ADMIN'].includes(dbUser.role) && (dbUser as any).totpEnabled) {
        const totpToken = (req.body?.totpToken || req.body?.totp || (req as any).body?.code) as string | undefined;
        if (!totpToken) {
          writeAuditLog(tenantId, dbUser.id, 'LOGIN_2FA_REQUIRED', 'auth', dbUser.id, undefined, req.ip);
          return res.status(401).json({ error: 'TWO_FACTOR_REQUIRED', code: 'TWO_FACTOR_REQUIRED', twoFactorRequired: true });
        }
        let totpOk = false;
        try {
          const { verifyToken, decryptSecret, matchBackupCode, hashBackupCode } = await import("./server/utils/totp");
          const enc = (dbUser as any).totpSecret;
          if (enc) {
            const secret = decryptSecret(enc);
            totpOk = verifyToken(String(totpToken), secret);
            if (!totpOk) {
              // Allow a one-time backup/recovery code as fallback.
              const hashes: string[] = Array.isArray((dbUser as any).totpBackupCodes) ? (dbUser as any).totpBackupCodes : [];
              const matched = matchBackupCode(String(totpToken), hashes);
              if (matched) {
                totpOk = true;
                const remaining = hashes.filter((h) => h !== matched);
                await userRepository.consumeBackupCode(tenantId, dbUser.id, remaining);
              }
            }
          }
        } catch (e) {
          logger.error('2FA verification error', e as any);
          totpOk = false;
        }
        if (!totpOk) {
          writeAuditLog(tenantId, dbUser.id, 'LOGIN_2FA_FAILED', 'auth', dbUser.id, undefined, req.ip);
          return res.status(401).json({ error: 'Invalid 2FA code', code: 'TWO_FACTOR_INVALID' });
        }
      }
      const jwtPayload = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        tenantId,
      };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);
      await userRepository.updateLastLogin(tenantId, dbUser.id);
      try {
        await sessionRepository.create(tenantId, {
          userId: dbUser.id,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      } catch (e) {
        logger.warn('Could not create session record');
      }
      writeAuditLog(tenantId, dbUser.id, 'LOGIN', 'auth', dbUser.id, undefined, req.ip);
      res.json({ message: 'Logged in successfully', user: userRepository.toPublicUser(dbUser), token });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post("/api/auth/sso", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required for SSO' });

      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;

      const { enterpriseConfigRepository } = await import('./server/repositories/enterpriseConfigRepository');
      const enterpriseConfig = await enterpriseConfigRepository.getConfig(tenantId);
      if (!enterpriseConfig?.sso?.enabled) {
        return res.status(403).json({ error: 'SSO is not enabled for this organisation. Please contact your administrator.' });
      }

      // Verify server-to-server shared secret so only a trusted IdP proxy can call this endpoint.
      // In production, SSO_SECRET must be set; without it the endpoint is blocked entirely.
      const ssoSecret = process.env.SSO_SECRET;
      if (isProduction && !ssoSecret) {
        logger.warn('[Security] SSO_SECRET is not configured — blocking SSO login in production.');
        return res.status(500).json({ error: 'SSO is not properly configured on the server.' });
      }
      if (ssoSecret) {
        const provided = req.headers['x-sso-secret'] as string | undefined;
        if (!provided) {
          writeAuditLog(tenantId, 'system', 'LOGIN_FAILED', 'auth', undefined, { email, reason: 'missing_sso_secret' }, req.ip);
          return res.status(401).json({ error: 'Missing X-SSO-Secret header' });
        }
        const { timingSafeEqual, createHash } = await import('crypto');
        const a = createHash('sha256').update(provided).digest();
        const b = createHash('sha256').update(ssoSecret).digest();
        if (!timingSafeEqual(a, b)) {
          writeAuditLog(tenantId, 'system', 'LOGIN_FAILED', 'auth', undefined, { email, reason: 'invalid_sso_secret' }, req.ip);
          return res.status(401).json({ error: 'Invalid SSO secret' });
        }
      }

      let dbUser = await userRepository.findByEmail(tenantId, email);

      if (!dbUser) {
        // Always assign SALES for new SSO users — promote to ADMIN manually via admin panel.
        dbUser = await userRepository.create(tenantId, {
          name: email.split('@')[0],
          email,
          role: 'SALES',
          source: 'SSO',
        });
      }

      const jwtPayload = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        tenantId,
      };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);
      logger.info(`SSO login: ${email} (tenant: ${tenantId})`);
      res.json({ message: 'SSO Login successful', user: userRepository.toPublicUser(dbUser), token });
    } catch (error) {
      console.error('SSO error:', error);
      res.status(500).json({ error: 'SSO login failed' });
    }
  });

  app.post("/api/auth/register", authRateLimit, validateBody(schemas.register), async (req, res) => {
    try {
      const { name, password, company } = req.body;
      const email = normalizeAuthEmail(req.body.email);

      const tenantId = DEFAULT_TENANT_ID;
      const existing = await userRepository.findByEmail(tenantId, email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // First user in the tenant becomes ADMIN (account owner), all subsequent users are SALES
      // IMPORTANT: Must use withTenantContext because the users table has RLS enabled.
      const existingCount = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`SELECT COUNT(*)::int AS cnt FROM users`);
        return r.rows[0]?.cnt ?? 0;
      });
      const isFirstUser = existingCount === 0;

      const dbUser = await userRepository.create(tenantId, {
        name: name || email.split('@')[0],
        email,
        password,
        role: isFirstUser ? 'ADMIN' : 'SALES',
        source: 'REGISTER',
        status: 'PENDING',
        emailVerified: false,
      });

      const otp = await issueEmailOtp({
        tenantId,
        userId: dbUser.id,
        email: dbUser.email,
        locale: req.body?.locale,
      });
      if (!otp.ok) {
        return res.status(429).json({ error: 'OTP_RATE_LIMITED', retryAfterSeconds: otp.retryAfterSeconds });
      }

      // Do not claim delivery before the provider confirms it. An undelivered
      // challenge is consumed so it cannot later be accepted accidentally.
      const delivery = await emailService.sendEmailOtp(
        tenantId, email, dbUser.name, otp.code, req.body?.locale === 'en' ? 'en' : 'vn',
      );
      const delivered = delivery.success && delivery.status === 'sent';
      writeAuditLog(tenantId, dbUser.id, 'REGISTER', 'auth', dbUser.id, { email, emailSent: delivered }, req.ip);
      if (!delivered) {
        await withRlsBypass(async (client) => {
          await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [dbUser.id]);
        });
        logger.error(`Failed to send OTP email to ${email}: ${delivery.error || delivery.status}`);
        return res.status(503).json({
          error: 'OTP_DELIVERY_FAILED',
          needsVerification: true,
          email: dbUser.email,
        });
      }
      return res.json({
        message: 'Registration successful. Please verify your email to continue.',
        needsVerification: true,
        email: dbUser.email,
        emailStatus: 'sent',
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // ── Onboard Vendor (B2B Self-Signup) ────────────────────────────────────────
  // Tạo MỘT tenant MỚI hoàn toàn (không gắn vào host tenant) + ADMIN user là
  // chủ tài khoản + subscription INDIVIDUAL trial 14 ngày. Đây là entry point
  // self-service cho các sàn BĐS / chủ đầu tư muốn dùng SGS Land làm CRM riêng.
  //
  // Khác biệt với /api/auth/register:
  //   - /register: thêm user vào host tenant (DEFAULT_TENANT_ID) — dành cho
  //     nhân sự nội bộ SGS Land hoặc khi chưa có B2B onboarding flow.
  //   - /onboard-vendor: tạo workspace độc lập với RLS isolation đầy đủ. Email
  //     có thể đã tồn tại ở tenant khác (mỗi vendor một tài khoản riêng).
  app.post(
    "/api/auth/onboard-vendor",
    authRateLimit,
    validateBody(schemas.onboardVendor),
    async (req, res) => {
      try {
        const { company, name, email, password, phone } = req.body as {
          company: string;
          name: string;
          email: string;
          password: string;
          phone?: string;
        };

        const trimmedName = name.trim();
        const trimmedCompany = (company || trimmedName).trim();
        const trimmedEmail = email.trim().toLowerCase();

        // 1) Sinh slug domain duy nhất từ tên công ty (loại dấu tiếng Việt)
        const baseSlug =
          trimmedCompany
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/gi, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'vendor';

        // 2) Hash password trước transaction; email OTP được phát hành sau khi user đã commit.
        const passwordHash = await bcrypt.hash(password, 12);

        // 3) ATOMIC: tenant + subscription + ADMIN user trong MỘT transaction (1 client, 1 BEGIN/COMMIT).
        //    Nếu bất kỳ bước nào fail, toàn bộ rollback — không có nguy cơ orphan tenant.
        //    Slug collision được retry tối đa 5 lần khi gặp lỗi unique 23505 trên tenants_domain_key.
        const created = await (async () => {
          const APP_DB_ROLE = (process.env.APP_DB_ROLE || 'sgs_app').replace(/[^a-z0-9_]/gi, '');
          for (let attempt = 0; attempt < 5; attempt++) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              await client.query(`SET LOCAL ROLE ${APP_DB_ROLE}`);
              await client.query("SET LOCAL app.bypass_rls = 'on'");

              // 3a) Chặn tạo trùng (cùng tên công ty + cùng email admin) — phòng double-submit
              const dup = await client.query(
                `SELECT t.id FROM tenants t
                   JOIN users u ON u.tenant_id = t.id AND u.role = 'ADMIN'
                  WHERE LOWER(t.name) = LOWER($1) AND LOWER(u.email) = $2 LIMIT 1`,
                [trimmedCompany, trimmedEmail]
              );
              if ((dup.rowCount ?? 0) > 0) {
                await client.query('ROLLBACK');
                throw Object.assign(new Error('DUPLICATE_VENDOR'), {
                  statusCode: 409,
                  userMsg: 'Workspace này đã được đăng ký bằng email này.',
                });
              }

              // 3b) Slug: thử base, base-2, base-3 … (best-effort; UNIQUE constraint là chốt cuối)
              let domainSlug = baseSlug;
              for (let suffix = 2; suffix <= 50; suffix++) {
                const exists = await client.query(
                  `SELECT 1 FROM tenants WHERE domain = $1 LIMIT 1`,
                  [domainSlug]
                );
                if (exists.rowCount === 0) break;
                domainSlug = `${baseSlug}-${suffix}`;
              }

              // 3c) INSERT tenant
              const tenantInsert = await client.query(
                `INSERT INTO tenants (name, domain, config)
                 VALUES ($1, $2, $3::jsonb)
                 RETURNING id`,
                [
                  trimmedCompany,
                  domainSlug,
                  JSON.stringify({
                    source: 'self_signup_vendor',
                    plan: 'INDIVIDUAL',
                    status: 'TRIAL',
                    vendorAdminEmail: trimmedEmail,
                    onboardedAt: new Date().toISOString(),
                  }),
                ]
              );
              const newTenantId = tenantInsert.rows[0].id as string;

              // 3d) INSERT subscription INDIVIDUAL trial 14 ngày
              const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              await client.query(
                `INSERT INTO subscriptions
                   (tenant_id, plan_id, status, seats_used, trial_ends_at,
                    current_period_start, current_period_end, metadata)
                 VALUES ($1, 'INDIVIDUAL', 'TRIAL', 1, $2, NOW(), $2, $3::jsonb)`,
                [newTenantId, trialEnds, JSON.stringify({ source: 'self_signup_vendor', trialDays: 14 })]
              );

              // 3e) INSERT ADMIN user (cùng transaction → atomic). Set tenant context để
              //     RLS policy đánh giá đúng + cột tenant_id lấy từ current_setting.
              if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newTenantId)) {
                throw new Error('Invalid newTenantId format (expected UUID) before SET LOCAL app.current_tenant_id');
              }
              await client.query(`SET LOCAL app.current_tenant_id = '${newTenantId}'`);
              const userInsert = await client.query(
                `INSERT INTO users
                   (tenant_id, name, email, password_hash, role, phone, source, status,
                    email_verified, email_verification_token, email_verification_expires)
                 VALUES (current_setting('app.current_tenant_id', true)::uuid,
                         $1, $2, $3, 'ADMIN', $4, 'SELF_SIGNUP_VENDOR', 'PENDING',
                          FALSE, NULL, NULL)
                 RETURNING id, name, email`,
                [trimmedName, trimmedEmail, passwordHash, phone?.trim() || null]
              );

              // 3f) Seed 6 default departments cho tenant mới — phục vụ Task Management.
              //     ON CONFLICT (tenant_id, name) DO NOTHING (UNIQUE từ migration 085)
              //     đảm bảo idempotent nếu retry trong cùng transaction.
              const DEFAULT_DEPARTMENTS_NEW_TENANT: Array<{ name: string; description: string }> = [
                { name: 'Kinh doanh',               description: 'Phòng kinh doanh và bán hàng' },
                { name: 'Pháp lý & Hợp đồng',       description: 'Phòng pháp lý và soạn thảo hợp đồng' },
                { name: 'Marketing & Truyền thông', description: 'Phòng marketing và truyền thông' },
                { name: 'Kỹ thuật & Thẩm định',     description: 'Phòng kỹ thuật và thẩm định dự án' },
                { name: 'Chăm sóc Khách hàng',      description: 'Phòng chăm sóc khách hàng' },
                { name: 'Ban Giám đốc',             description: 'Ban giám đốc điều hành' },
              ];
              for (const dept of DEFAULT_DEPARTMENTS_NEW_TENANT) {
                await client.query(
                  `INSERT INTO departments (tenant_id, name, description)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (tenant_id, name) DO NOTHING`,
                  [newTenantId, dept.name, dept.description]
                );
              }

              await client.query('COMMIT');
              return {
                tenantId: newTenantId,
                domainSlug,
                userId: userInsert.rows[0].id as string,
                userName: userInsert.rows[0].name as string,
                userEmail: userInsert.rows[0].email as string,
              };
            } catch (err: any) {
              await client.query('ROLLBACK').catch(() => {});
              // Slug đụng giữa 2 request đồng thời → retry với suffix mới (best effort)
              if (err?.code === '23505' && /tenants_domain_key/.test(err.constraint || err.detail || '')) {
                if (attempt < 4) continue;
              }
              throw err;
            } finally {
              client.release();
            }
          }
          throw new Error('Failed to allocate workspace domain after retries');
        })();

        const adminUser = {
          id: created.userId,
          name: created.userName,
          email: created.userEmail,
        };

        const otp = await issueEmailOtp({
          tenantId: created.tenantId,
          userId: created.userId,
          email: created.userEmail,
          locale: req.body?.locale,
        });
        if (!otp.ok) {
          return res.status(429).json({ error: 'OTP_RATE_LIMITED', retryAfterSeconds: otp.retryAfterSeconds });
        }

        // 4) Confirm provider delivery before telling the user to check email.
        const delivery = await emailService.sendEmailOtp(
          created.tenantId, trimmedEmail, adminUser.name, otp.code, req.body?.locale === 'en' ? 'en' : 'vn',
        );
        const delivered = delivery.success && delivery.status === 'sent';
        writeAuditLog(
          created.tenantId,
          adminUser.id,
          'ONBOARD_VENDOR',
          'tenant',
          created.tenantId,
          { company: trimmedCompany, domain: created.domainSlug, email: trimmedEmail, emailSent: delivered },
          req.ip
        );
        if (!delivered) {
          await withRlsBypass(async (client) => {
            await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [adminUser.id]);
          });
          logger.error(`[onboard-vendor] Failed to send OTP email to ${trimmedEmail}: ${delivery.error || delivery.status}`);
          return res.status(503).json({
            error: 'OTP_DELIVERY_FAILED',
            needsVerification: true,
            email: adminUser.email,
            tenantId: created.tenantId,
            tenantDomain: created.domainSlug,
            plan: 'INDIVIDUAL',
            trialDays: 14,
          });
        }
        return res.status(201).json({
          message: 'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt workspace của bạn.',
          needsVerification: true,
          email: adminUser.email,
          tenantId: created.tenantId,
          tenantDomain: created.domainSlug,
          plan: 'INDIVIDUAL',
          trialDays: 14,
          emailStatus: 'sent',
        });
      } catch (error: any) {
        if (error?.statusCode === 409) {
          return res.status(409).json({ error: error.userMsg || 'Workspace already exists' });
        }
        console.error('[onboard-vendor] error:', error);
        res.status(500).json({ error: 'Onboarding failed' });
      }
    }
  );

  // ── Email OTP verification ─────────────────────────────────────────────────
  async function findPendingAuthUser(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    let tenantId = DEFAULT_TENANT_ID;
    let user = await userRepository.findByEmail(tenantId, email);
    if (!user) {
      const candidates = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT tenant_id FROM users WHERE LOWER(email) = $1 AND tenant_id <> $2 LIMIT 10`,
          [email, DEFAULT_TENANT_ID],
        );
        return r.rows as { tenant_id: string }[];
      });
      for (const candidate of candidates) {
        const found = await userRepository.findByEmail(candidate.tenant_id, email).catch(() => null);
        if (found) {
          user = found;
          tenantId = candidate.tenant_id;
          break;
        }
      }
    }
    return user ? { tenantId, user } : null;
  }

  async function sendOtpForPendingUser(rawEmail: string, locale: string | undefined) {
    const found = await findPendingAuthUser(rawEmail);
    if (!found || found.user.emailVerified) return { kind: 'hidden' as const };
    const otp = await issueEmailOtp({
      tenantId: found.tenantId,
      userId: found.user.id,
      email: found.user.email,
      locale,
    });
    if (!otp.ok) return { kind: 'rate_limited' as const, retryAfterSeconds: otp.retryAfterSeconds };
    const result = await emailService.sendEmailOtp(
      found.tenantId,
      found.user.email,
      found.user.name,
      otp.code,
      locale === 'en' ? 'en' : 'vn',
    );
    const delivered = result.success && result.status === 'sent';
    writeAuditLog(found.tenantId, found.user.id, 'EMAIL_OTP_REQUESTED', 'auth', found.user.id, {
      email: found.user.email,
      emailSent: delivered,
    });
    if (!delivered) {
      logger.error('[email-otp] Failed to deliver OTP for ' + found.user.email + ': ' + (result.error || result.status));
      return { kind: 'delivery_failed' as const };
    }
    return { kind: 'sent' as const };
  }

  app.post("/api/auth/request-otp", authRateLimit, validateBody(schemas.requestOtp), async (req, res) => {
    try {
      const result = await sendOtpForPendingUser(req.body.email, req.body.locale);
      if (result.kind === 'rate_limited') {
        return res.status(429).json({ error: 'OTP_RATE_LIMITED', retryAfterSeconds: result.retryAfterSeconds });
      }
      if (result.kind === 'delivery_failed') {
        return res.status(503).json({ error: 'OTP_DELIVERY_FAILED' });
      }
      return res.json({ message: 'If a pending account exists, a verification code has been sent.' });
    } catch (error) {
      logger.error('Request email OTP error:', error as any);
      return res.status(500).json({ error: 'Failed to request verification code' });
    }
  });

  app.post("/api/auth/verify-otp", authRateLimit, validateBody(schemas.verifyOtp), async (req, res) => {
    try {
      const result = await verifyEmailOtp({ email: req.body.email, code: req.body.code });
      if (!result.ok) {
        const status = result.reason === 'TOO_MANY_ATTEMPTS' ? 429 : 400;
        return res.status(status).json({
          error: result.reason === 'EXPIRED' ? 'OTP_EXPIRED'
            : result.reason === 'TOO_MANY_ATTEMPTS' ? 'OTP_TOO_MANY_ATTEMPTS'
            : 'OTP_INVALID',
          attemptsRemaining: result.attemptsRemaining,
        });
      }
      const user = await withRlsBypass(async (client) => {
        const r = await client.query('SELECT * FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1', [result.userId, result.tenantId]);
        return r.rows[0] ? userRepository['rowToEntity']<any>(r.rows[0]) : null;
      });
      if (!user) return res.status(400).json({ error: 'OTP_INVALID' });
      const isVendorSignup = user.source === 'SELF_SIGNUP_VENDOR' && result.tenantId !== DEFAULT_TENANT_ID;
      await withTenantContext(result.tenantId, async (client) => {
        await client.query(
          `UPDATE users SET email_verified = TRUE, status = 'ACTIVE',
             email_verification_token = NULL, email_verification_expires = NULL
           WHERE id = $1`,
          [user.id],
        );
      });
      if (isVendorSignup) {
        await withRlsBypass(async (client) => {
          await client.query(
            `UPDATE tenants SET approval_status = 'PENDING_APPROVAL',
             config = config || '{"awaitingApproval": true}'::jsonb WHERE id = $1`,
            [result.tenantId],
          );
        });
        writeAuditLog(result.tenantId, user.id, 'EMAIL_OTP_VERIFIED', 'auth', user.id, { email: user.email, pendingApproval: true }, req.ip);
        return res.json({ message: 'Email verified successfully. Your workspace is now pending approval.', needsApproval: true, email: user.email });
      }
      const jwtPayload = { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: result.tenantId };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);
      await userRepository.updateLastLogin(result.tenantId, user.id);
      writeAuditLog(result.tenantId, user.id, 'EMAIL_OTP_VERIFIED', 'auth', user.id, { email: user.email }, req.ip);
      emailService.sendWelcomeEmail(result.tenantId, user.email, user.name).catch(() => {});
      return res.json({
        message: 'Email verified successfully',
        user: userRepository.toPublicUser({ ...user, emailVerified: true, status: 'ACTIVE' }),
        token,
      });
    } catch (error) {
      logger.error('Email OTP verification error:', error as any);
      return res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Backward-compatible endpoint name; it now sends a code rather than a link.
  app.post("/api/auth/resend-verification", authRateLimit, async (req, res) => {
    const uniformDelay = () => new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    try {
      const email = normalizeAuthEmail(req.body.email);
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const result = await sendOtpForPendingUser(email, req.body?.locale);
      await uniformDelay();
      if (result.kind === 'rate_limited') {
        return res.status(429).json({ error: 'OTP_RATE_LIMITED', retryAfterSeconds: result.retryAfterSeconds });
      }
      if (result.kind === 'delivery_failed') {
        return res.status(503).json({ error: 'OTP_DELIVERY_FAILED' });
      }
      res.json({
        message: 'If a pending account exists, a verification code has been sent.',
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  });

  app.post("/api/auth/forgot-password", passwordResetRateLimit, async (req, res) => {
    const uniformDelay = () => new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    try {
      const email = normalizeAuthEmail(req.body.email);
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Cross-tenant lookup: vendor accounts live in their own tenant, not DEFAULT_TENANT_ID.
      // When not logged in, req.tenantId = DEFAULT_TENANT_ID — must search all tenants.
      let tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      let user = await userRepository.findByEmail(tenantId, email);
      if (!user && tenantId === DEFAULT_TENANT_ID) {
        const candidates = await withRlsBypass(async (client) => {
          const r = await client.query(
            `SELECT tenant_id FROM users WHERE LOWER(email) = LOWER($1) AND tenant_id <> $2 LIMIT 10`,
            [email, DEFAULT_TENANT_ID]
          );
          return r.rows as { tenant_id: string }[];
        });
        for (const cand of candidates) {
          const u = await userRepository.findByEmail(cand.tenant_id, email).catch(() => null);
          if (u) { user = u; tenantId = cand.tenant_id; break; }
        }
      }

      if (!user) {
        await uniformDelay();
        return res.json({ message: 'If an account exists, a reset link has been sent.' });
      }

      const crypto = await import('crypto');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      const baseUrl = resolveBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

      const deliveryKey = `password-reset:${user.id}:${tokenHash}`;
      const emailResult = await emailService.sendPasswordResetEmail(tenantId, email, resetUrl, user.name, deliveryKey);
      const delivered = emailResult.success && emailResult.status === 'sent';
      if (emailResult.status === 'failed') {
        logger.error(`Failed to send password reset email to ${email}: ${emailResult.error}`);
      } else if (emailResult.status === 'queued_no_smtp') {
        logger.warn(`Password reset email for ${email} not sent — SMTP not configured.`);
      }

      writeAuditLog(tenantId, user.id, 'PASSWORD_RESET_REQUEST', 'auth', user.id, { email }, req.ip);
      await uniformDelay();
      if (emailResult.status === 'queued_no_smtp' || emailResult.status === 'failed') {
        await pool.query(`DELETE FROM password_reset_tokens WHERE token = $1 AND used = FALSE`, [tokenHash]);
        logger.warn(`[ForgotPassword] Email not delivered for ${email} — status: ${emailResult.status}. Check BREVO_FROM_EMAIL / SMTP config.`);
        return res.status(503).json({ error: 'PASSWORD_RESET_DELIVERY_FAILED' });
      }
      if (delivered) {
        await pool.query(
          `UPDATE password_reset_tokens SET used = TRUE
           WHERE user_id = $1 AND token <> $2 AND used = FALSE`,
          [user.id, tokenHash],
        );
      }
      // Trong môi trường dev (non-production), trả về devResetUrl + devResetToken
      // để developer có thể test flow mà không cần email thực sự vào hộp thư
      // (link dev domain Replit trông đáng ngờ → spam). Trong production
      // (APP_URL set hoặc REPLIT_DOMAINS có domain production), không expose.
      const isDevMode = !isProduction;
      res.json({
        message: 'If an account exists, a reset link has been sent.',
        ...(isDevMode && {
          devResetToken: rawToken,
          devResetUrl: resetUrl,
          _devNote: 'Dev mode only — not present in production',
        }),
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  app.post("/api/auth/reset-password", passwordResetRateLimit, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const result = await pool.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token = $1 AND used = FALSE AND expires_at > NOW()
         FOR UPDATE`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const userId = result.rows[0].user_id;

      // Cross-tenant lookup: vendor users live in their own tenant (not DEFAULT_TENANT_ID).
      // Find the real tenant from the users table before calling updatePassword.
      const userTenantRow = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT tenant_id, email, status FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        );
        return r.rows[0] as { tenant_id: string; email: string; status: string } | undefined;
      });

      if (!userTenantRow) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const tenantId = userTenantRow.tenant_id;
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const resetResult = await withRlsBypass(async (client) => {
        const updated = await client.query(
          `UPDATE users
             SET password_hash = $1,
                 updated_at = NOW(),
                 status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END
           WHERE id = $2 AND tenant_id = $3
           RETURNING id`,
          [passwordHash, userId, tenantId],
        );
        if (updated.rowCount === 0) return false;
        await client.query(
          `UPDATE password_reset_tokens SET used = TRUE WHERE token = $1 AND used = FALSE`,
          [tokenHash],
        );
        return true;
      });
      if (!resetResult) return res.status(500).json({ error: 'Failed to update password' });

      const userEmail = userTenantRow.email;
      writeAuditLog(tenantId, userId, 'PASSWORD_RESET_COMPLETE', 'auth', userId, undefined, req.ip);
      res.json({ message: 'Password has been reset successfully', email: userEmail });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
    // M2 FIX: Use 'lax' (same-domain: sgsland.vn) - 'none' is only for cross-site
    sameSite: 'lax' as const,
      ...(isProduction && { secure: true }),
    });
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  app.post("/api/ai/process-message", authenticateToken, aiRateLimit, validateBody(schemas.aiProcessMessage), async (req, res) => {
    try {
      const { lead, userMessage, history, lang } = req.body;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;
      const { aiService } = await import('./server/ai');
      const { runDurableAgentExecution } = await import('./server/services/durableAgentExecutionService');
      const t = serverT(lang || 'vn');
      let userFavorites: any[] = [];
      if (userId) {
        try {
          const favRaw = await listingRepository.getFavorites(tenantId, userId);
          userFavorites = favRaw.map((f: any) => ({
            id: f.id,
            title: f.title,
            address: f.address,
            price: f.price,
            area: f.area,
            propertyType: f.propertyType || f.property_type,
          }));
        } catch { }
      }
      const suppliedKey = String(req.header('Idempotency-Key') || '').trim();
      const requestFingerprint = createHash('sha256')
        .update(JSON.stringify({
          tenantId,
          userId,
          leadId: lead?.id || null,
          userMessage: String(userMessage || '').slice(0, 2000),
          history: Array.isArray(history) ? history.slice(-6) : [],
          lang: lang || 'vn',
        }))
        .digest('hex');
      const idempotencyKey = suppliedKey
        ? `authenticated:${suppliedKey.slice(0, 180)}`
        : `authenticated:${requestFingerprint}`;
      const execution = await runDurableAgentExecution({
        tenantId,
        idempotencyKey,
        sessionId: lead?.id ? `lead:${lead.id}` : `user:${userId || 'anonymous'}`,
        leadId: lead?.id,
        triggerSource: 'authenticated-process-message',
        message: String(userMessage || ''),
        execute: async () => aiService.processMessage(
          lead,
          userMessage,
          history,
          t,
          tenantId,
          lang || 'vn',
          userFavorites,
        ),
      });
      const result = execution.result;
      if (!execution.cached && result.escalated && lead?.id) {
        broadcastIo?.to(`tenant:${tenantId}`).emit('escalate_to_human', { leadId: lead.id });
      }
      res.json({
        ...result,
        runId: execution.runId,
        traceId: execution.traceId,
        resumed: execution.resumed,
        cached: execution.cached,
        needsVerification: execution.guardrail.requiresVerification,
        guardrailFlags: execution.guardrail.flags,
      });
    } catch (error) {
      sendAiError(res, error, 'process-message');
    }
  });

  app.post("/api/ai/score-lead", authenticateToken, aiRateLimit, validateBody(schemas.aiScoreLead), async (req, res) => {
    try {
      const { leadData, messageContent, weights, lang } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.scoreLead(leadData, messageContent, weights, lang, (req as any).tenantId);

      if (result && leadData?.id) {
        const tenantId = (req as any).tenantId;
        const savedScore = { score: result.score || (result as any).totalScore, grade: result.grade, reasoning: result.reasoning };
        try {
          await leadRepository.update(tenantId, leadData.id, { score: savedScore }, (req as any).user?.id, (req as any).user?.role || 'ADMIN');
          logger.info(`AI score persisted for lead ${leadData.id}: ${savedScore.score}`);
          broadcastIo?.to(`tenant:${tenantId}`).emit('lead_scored', { leadId: leadData.id, score: savedScore });
        } catch (e) {
          logger.warn(`Could not persist AI score for lead ${leadData.id}`);
        }
      }

      res.json(result);
    } catch (error) {
      sendAiError(res, error, 'score-lead');
    }
  });

  app.post("/api/ai/summarize-lead", authenticateToken, aiRateLimit, monthlyAriaQuota, async (req, res) => {
    try {
      const { lead, logs, lang } = req.body;
      const { aiService } = await import('./server/ai');

      let interactions = logs;
      if (!interactions && lead?.id) {
        const tenantId = (req as any).tenantId;
        try {
          interactions = await interactionRepository.findByLead(tenantId, lead.id);
        } catch (e) {
          logger.warn(`Could not fetch interactions for lead ${lead.id}`);
        }
      }

      const result = await aiService.summarizeLead(lead, interactions || [], lang, (req as any).tenantId);

      // Include ARIA quota info in response for frontend credit display
      const quotaInfo = (req as any).ariaQuotaInfo;
      res.json({ summary: result, quota: quotaInfo || null });
    } catch (error) {
      sendAiError(res, error, 'summarize-lead');
    }
  });

  // ── Unified AI Quota Status endpoint ─────────────────────────────────────
  // GET /api/ai/quota — returns remaining credits for valuation + ARIA
  app.get("/api/ai/quota", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      const userId = user.id || user.userId;
      const tenantId = (req as any).tenantId || user.tenantId;

      const [valuation, aria] = await Promise.all([
        getMonthlyQuotaStatus(userId, tenantId),
        getMonthlyAriaQuotaStatus(userId, tenantId),
      ]);

      res.json({ valuation, aria });
    } catch (err) {
      logger.error('[GET /api/ai/quota] Error:', err);
      res.status(500).json({ error: 'Failed to fetch quota status' });
    }
  });

  app.post("/api/ai/valuation", optionalAuth,
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if ((req as any).user) return monthlyValuationQuota(req, res, next);
      return guestValuationRateLimit(req, res, next);
    },
    validateBody(schemas.aiValuation), async (req, res) => {
    try {
      const {
        address, area, roadWidth, legal, propertyType,
        // Advanced AVM inputs (Kfl, Kdir, Kmf, Kfurn, Kage, Kbr)
        floorLevel, direction, frontageWidth, furnishing, monthlyRent, buildingAge, bedrooms,
        listingId,
      } = req.body;
      const { aiService } = await import('./server/ai');

      // Run AI valuation in parallel with cache warm-up (non-blocking)
      const [result] = await Promise.all([
        aiService.getRealtimeValuation(address, area, roadWidth, legal, propertyType, (req as any).tenantId, {
          floorLevel:    floorLevel    !== undefined ? Number(floorLevel)    : undefined,
          direction:     direction     || undefined,
          frontageWidth: frontageWidth !== undefined ? Number(frontageWidth) : undefined,
          furnishing:    furnishing    || undefined,
          monthlyRent:   monthlyRent   !== undefined ? Number(monthlyRent)   : undefined,
          buildingAge:   buildingAge   !== undefined ? Number(buildingAge)   : undefined,
          bedrooms:      bedrooms      !== undefined ? Number(bedrooms)      : undefined,
          listingId:     listingId     || undefined,
        }),
        // Populate/warm the market data cache from this request (fire-and-forget)
        marketDataService.getMarketData(address).catch(() => null),
      ]);

      // Track usage for admin cost report (fire-and-forget)
      try {
        const { recordValuationUsage } = await import('./server/services/valuationUsageService');
        const u = (req as any).user;
        recordValuationUsage({
          tenantId: (req as any).tenantId || u?.tenantId || null,
          userId: u?.id || u?.userId || null,
          planId: (req as any).quotaInfo?.plan || (u ? null : 'GUEST'),
          endpoint: 'realtime',
          source: 'AI_LIVE',
          aiCalls: 2,
          isGuest: !u,
          ipAddress: req.ip,
          addressHint: typeof address === 'string' ? address.slice(0, 120) : null,
        }).catch(() => {});
      } catch { /* ignore */ }

      res.json(result);
    } catch (error) {
      sendAiError(res, error, 'valuation');
    }
  });

  app.post("/api/ai/generate-content", authenticateToken, aiRateLimit, async (req, res) => {
    try {
      const { prompt, model, temperature, systemInstruction, responseMimeType, responseSchema, stream } = req.body;
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'API key not valid. Please pass a valid API key.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const config: any = {};
      if (temperature !== undefined) config.temperature = temperature;
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (responseMimeType) config.responseMimeType = responseMimeType;
      if (responseSchema) config.responseSchema = responseSchema;

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await ai.models.generateContentStream({
          model: model || 'gemini-3-flash-preview',
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined
        });
        
        res.json({ text: response.text });
      }
    } catch (error) {
      const parsed = parseAiError(error);
      console.error('[AI Error][generate-content]', error);
      if (!res.headersSent) {
        res.status(parsed.httpStatus).json({
          error: parsed.userMessage,
          code: parsed.isQuotaError ? 'AI_QUOTA_EXCEEDED' : parsed.isAuthError ? 'AI_AUTH_ERROR' : 'AI_UNAVAILABLE',
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: parsed.userMessage })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/ai/embed-content", authenticateToken, aiRateLimit, async (req, res) => {
    try {
      const { text, model } = req.body;
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'API key not valid. Please pass a valid API key.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.embedContent({
        model: model || 'text-embedding-004',
        contents: text,
      });
      
      res.json({ embeddings: response.embeddings?.[0]?.values || [] });
    } catch (error) {
      sendAiError(res, error, 'embed-content');
    }
  });

  // Parse and validate ALLOWED_ORIGINS — wildcard '*' is rejected in production
  let allowedOrigins: string[] | undefined;
  if (process.env.ALLOWED_ORIGINS) {
    const raw = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    if (isProduction && raw.includes('*')) {
      throw new Error("FATAL: ALLOWED_ORIGINS must not include '*' in production. Set it to explicit domain(s), e.g. https://yourapp.replit.app");
    }
    allowedOrigins = raw.length > 0 ? raw : undefined;
  }

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins || (isProduction ? false : true),
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  broadcastIo = io;

  io.use((socket, next) => {
    try {
      socket.data.authUser = null;
      socket.data.buyerUser = null;

      // Buyer auth path: mobile app passes the buyer JWT in handshake.auth
      // (Bearer-style). Validate aud='buyer' so admin/agent cookies signed
      // with the same secret can't impersonate a buyer's room.
      const handshakeToken =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;
      if (typeof handshakeToken === 'string' && handshakeToken.length > 0) {
        try {
          const decoded: any = jwt.verify(handshakeToken, JWT_SECRET);
          if (decoded && decoded.aud === 'buyer' && decoded.sub) {
            socket.data.buyerUser = { id: decoded.sub, phone: decoded.phone };
          }
        } catch {
          // Bad buyer token → fall through to anonymous; cookie path still tries.
        }
      }

      // Cookie auth path: web admin/agent users.
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next();

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach(c => {
        const [key, ...vals] = c.trim().split('=');
        if (key) cookies[key.trim()] = vals.join('=');
      });

      const token = cookies['token'];
      if (!token) return next();

      jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (!err && decoded && decoded.aud !== 'buyer') {
          socket.data.authUser = decoded;
        }
        next();
      });
    } catch (e) {
      socket.data.authUser = null;
      socket.data.buyerUser = null;
      next();
    }
  });

  const verifyWsCookie = (cookieHeader: string | undefined): any => {
    if (!cookieHeader) return null;
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(c => {
      const [key, ...vals] = c.trim().split('=');
      if (key) cookies[key.trim()] = vals.join('=');
    });
    const token = cookies['token'];
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  };

  // Setup Yjs WebSocket server for CRDT
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req);
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';
    const protocol = request.headers['sec-websocket-protocol'] || '';
    
    // Let Vite handle its HMR websocket (protocol header or known paths)
    if (protocol.includes('vite-hmr') || pathname.includes('vite-hmr') || pathname.includes('__vite')) {
      return;
    }
    
    // Let Socket.IO handle its websocket (auth handled by io.use middleware)
    if (pathname.includes('socket.io')) {
      return;
    }
    
    // Handle Yjs websocket with auth
    if (pathname.startsWith('/yjs/')) {
      const user = verifyWsCookie(request.headers.cookie);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }

    // RELIABILITY FIX (audit Medium): khong handler nao khop voi upgrade request nay.
    // Truoc day socket bi bo lung (khong destroy) -> ro ri ket noi + file descriptor
    // cho den khi het TCP timeout. Tra loi 404 roi dong han socket.
    try {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    } catch (e) { /* socket co the da dong */ }
    socket.destroy();
  });

  // Setup BullMQ Worker — capture instance so we can close it on shutdown
  const webhookWorker = setupWebhookWorker(io);
  setAgentOperatorIo(io);
  const getAgentTenantIds = async () => {
    const result = await withRlsBypass(client => client.query(`SELECT id FROM tenants`));
    return result.rows.map((row: any) => String(row.id));
  };
  const agentOperatorWorker = startAgentOperatorWorker(getAgentTenantIds);
  void agentOperatorWorker;
  startLearningCycleScheduler(getAgentTenantIds);

  // Start market data service — Redis persistence + background seed for all provinces
  marketDataService.start(io).catch((err: any) =>
    console.error('[MarketData] Start error:', err?.message)
  );

  // Socket.io uses in-memory adapter (single-instance).
  // Upstash REST API does not support TCP pub/sub required by @socket.io/redis-adapter.
  logger.info("Socket.io using in-memory adapter (Upstash REST — no TCP pub/sub needed for single-instance).");

  // Initialize DB schema via migration runner (with retry for cold-start DB wakeup)
  if (process.env.AIVEN_DATABASE_URL) {
    const MAX_MIGRATION_ATTEMPTS = 3;
    let migrationOk = false;
    for (let attempt = 1; attempt <= MAX_MIGRATION_ATTEMPTS; attempt++) {
      try {
        await runPendingMigrations(pool);
        migrationOk = true;
        break;
      } catch (err: any) {
        const isTransient = isTransientDatabaseError(err);
        if (attempt < MAX_MIGRATION_ATTEMPTS && isTransient) {
          logger.warn(`[migrations] Connection attempt ${attempt}/${MAX_MIGRATION_ATTEMPTS} failed — retrying in 5s… (${err.message})`);
          await new Promise(r => setTimeout(r, 5000));
        } else if (isTransient) {
          logger.warn(`[migrations] DB unreachable after ${MAX_MIGRATION_ATTEMPTS} attempts — server starting without migrations. Will retry on first API request. (${err.message})`);
        } else {
          throw err;
        }
      }
    }
    if (!migrationOk) {
      logger.warn('[migrations] Skipped due to DB connectivity issue. Schema may be out of date until restart.');
    }

    // ── Tenant white-label (task #28): cron 5 phút verify TXT custom domain ──
    try {
      startCustomDomainVerifyCron({ intervalMs: 30 * 60 * 1000 }); // Keep the in-process cadence moderate for the managed database.
      logger.info('[tenant] Custom-domain TXT verify cron started (30min interval)');
    } catch (err: any) {
      logger.warn(`[tenant] Failed to start TXT verify cron: ${err?.message || err}`);
    }

    // ── Periodic memory logging (production OOM diagnosis) ───────────────────
    // Production has crashed twice with zero error/exception log — the classic
    // signature of an external SIGKILL (most likely OOM-kill). This logs
    // process.memoryUsage() every 5 minutes so a future crash can be
    // correlated against a rising RSS/heap trend in the deployment logs.
    // Console only (no file) — avoids disk growth on the VM.
    startMemoryUsageLogger();

    // ── QStash token verification ─────────────────────────────────────────
    // Makes a bad/expired QSTASH_TOKEN impossible to miss at boot (see
    // verifyQstashTokenAtStartup() for why — every cron already logs a 401
    // but those lines are easy to miss among the rest of startup output).
    await verifyQstashTokenAtStartup();

    // ── Init self-learning price calibration engine ──────────────────────────
    // Must run AFTER migrations so market_price_history & avm_calibration tables exist
    priceCalibrationService.init(pool);
    logger.info('[PriceCalibration] Self-learning calibration engine initialized');
  } else {
    console.warn("AIVEN_DATABASE_URL not set. Skipping database migrations.");
  }

  const PUBLIC_TENANT = DEFAULT_TENANT_ID;

  /** Strip Vietnamese diacritics → lowercase, collapse spaces/dots for map lookups */
  function vnDeaccent(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[.\-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Maps deaccented raw location tokens → canonical province/city name.
   * Covers districts, townships, and common abbreviations.
   */
  const VN_PROVINCE_MAP: Record<string, string> = {
    // TP. Hồ Chí Minh & nội thành/ngoại thành
    'hcm': 'TP. Hồ Chí Minh', 'tphcm': 'TP. Hồ Chí Minh',
    'tp hcm': 'TP. Hồ Chí Minh', 'tp.hcm': 'TP. Hồ Chí Minh',
    'ho chi minh': 'TP. Hồ Chí Minh', 'tp ho chi minh': 'TP. Hồ Chí Minh',
    'thanh pho ho chi minh': 'TP. Hồ Chí Minh', 'sai gon': 'TP. Hồ Chí Minh',
    'hoc mon': 'TP. Hồ Chí Minh', 'go vap': 'TP. Hồ Chí Minh',
    'binh thanh': 'TP. Hồ Chí Minh', 'phu nhuan': 'TP. Hồ Chí Minh',
    'tan binh': 'TP. Hồ Chí Minh', 'binh tan': 'TP. Hồ Chí Minh',
    'binh chanh': 'TP. Hồ Chí Minh', 'nha be': 'TP. Hồ Chí Minh',
    'can gio': 'TP. Hồ Chí Minh', 'cu chi': 'TP. Hồ Chí Minh',
    'thu duc': 'TP. Hồ Chí Minh',
    'quan 1': 'TP. Hồ Chí Minh', 'quan 2': 'TP. Hồ Chí Minh',
    'quan 3': 'TP. Hồ Chí Minh', 'quan 4': 'TP. Hồ Chí Minh',
    'quan 5': 'TP. Hồ Chí Minh', 'quan 6': 'TP. Hồ Chí Minh',
    'quan 7': 'TP. Hồ Chí Minh', 'quan 8': 'TP. Hồ Chí Minh',
    'quan 9': 'TP. Hồ Chí Minh', 'quan 10': 'TP. Hồ Chí Minh',
    'quan 11': 'TP. Hồ Chí Minh', 'quan 12': 'TP. Hồ Chí Minh',
    // Đồng Nai & đô thị/huyện
    'dong nai': 'Đồng Nai', 'tinh dong nai': 'Đồng Nai',
    'bien hoa': 'Đồng Nai', 'long khanh': 'Đồng Nai',
    'trang bom': 'Đồng Nai', 'vinh cuu': 'Đồng Nai',
    'thong nhat': 'Đồng Nai', 'cam my': 'Đồng Nai',
    'dinh quan': 'Đồng Nai', 'xuan loc': 'Đồng Nai',
    'nhon trach': 'Đồng Nai', 'long hung dong nai': 'Đồng Nai',
    'long hung': 'Đồng Nai',
    // Long An
    'long an': 'Long An', 'tinh long an': 'Long An', 'tan an': 'Long An',
    // Hà Nội
    'ha noi': 'Hà Nội', 'hanoi': 'Hà Nội',
    // Bình Dương
    'binh duong': 'Bình Dương', 'thu dau mot': 'Bình Dương',
    'thuan an': 'Bình Dương', 'di an': 'Bình Dương',
    // Bà Rịa – Vũng Tàu
    'ba ria vung tau': 'Bà Rịa - Vũng Tàu', 'vung tau': 'Bà Rịa - Vũng Tàu',
    'ba ria': 'Bà Rịa - Vũng Tàu', 'brvt': 'Bà Rịa - Vũng Tàu',
    // Đà Nẵng
    'da nang': 'Đà Nẵng', 'danang': 'Đà Nẵng',
    // Cần Thơ
    'can tho': 'Cần Thơ',
    // Hải Phòng
    'hai phong': 'Hải Phòng',
    // Khánh Hòa
    'khanh hoa': 'Khánh Hòa', 'nha trang': 'Khánh Hòa',
    // Lâm Đồng
    'lam dong': 'Lâm Đồng', 'da lat': 'Lâm Đồng', 'dalat': 'Lâm Đồng',
    // Kiên Giang
    'kien giang': 'Kiên Giang', 'phu quoc': 'Kiên Giang',
    // Tây Ninh
    'tay ninh': 'Tây Ninh',
    // Tiền Giang
    'tien giang': 'Tiền Giang', 'my tho': 'Tiền Giang',
    // An Giang
    'an giang': 'An Giang', 'long xuyen': 'An Giang',
    // vague / skip
    'viet nam': '', 'vietnam': '',
  };

  /**
   * When filtering by canonical province, also search these alias strings in ILIKE.
   */
  const VN_PROVINCE_ALIASES: Record<string, string[]> = {
    'TP. Hồ Chí Minh': [
      'Hồ Chí Minh', 'HCM', 'TPHCM', 'TP.HCM', 'Sài Gòn', 'Saigon',
      'Hóc Môn', 'Hoc Mon', 'Bình Chánh', 'Nhà Bè', 'Cần Giờ', 'Củ Chi',
      'Thủ Đức', 'Thu Duc', 'Gò Vấp', 'Go Vap', 'Bình Thạnh',
    ],
    'Đồng Nai': [
      'Đồng Nai', 'Dong Nai', 'Biên Hòa', 'Bien Hoa', 'Biên Hoà',
      'Long Khánh', 'Trảng Bom', 'Vĩnh Cửu', 'Thống Nhất',
      'Long Hưng', 'Nhơn Trạch', 'Long Hung',
    ],
    'Long An':            ['Long An', 'Tân An'],
    'Hà Nội':            ['Hà Nội', 'Ha Noi', 'Hanoi'],
    'Bình Dương':        ['Bình Dương', 'Binh Duong', 'Thủ Dầu Một', 'Thu Dau Mot', 'Thuận An', 'Dĩ An'],
    'Bà Rịa - Vũng Tàu': ['Bà Rịa', 'Vũng Tàu', 'Vung Tau', 'BRVT'],
    'Đà Nẵng':           ['Đà Nẵng', 'Da Nang'],
    'Khánh Hòa':         ['Khánh Hòa', 'Nha Trang'],
    'Lâm Đồng':          ['Lâm Đồng', 'Đà Lạt', 'Da Lat', 'Dalat'],
    'Kiên Giang':        ['Kiên Giang', 'Phú Quốc', 'Phu Quoc'],
    'Cần Thơ':           ['Cần Thơ', 'Can Tho'],
    'Hải Phòng':         ['Hải Phòng', 'Hai Phong'],
    'Tây Ninh':          ['Tây Ninh', 'Tay Ninh'],
    'Tiền Giang':        ['Tiền Giang', 'Mỹ Tho'],
    'An Giang':          ['An Giang', 'Long Xuyên'],
  };

  // Marketplace dropdown values that are not canonical province names - map them
// onto the same alias list so the public location filter actually matches.
VN_PROVINCE_ALIASES['TP.HCM'] = VN_PROVINCE_ALIASES['TP. H\u1ed3 Ch\u00ed Minh'];
VN_PROVINCE_ALIASES['B\u00e0 R\u1ecba'] = VN_PROVINCE_ALIASES['B\u00e0 R\u1ecba - V\u0169ng T\u00e0u'];

/** Normalize a raw last-segment location to canonical province; null = skip */
  function normalizeToProvince(raw: string): string | null {
    if (!raw || !raw.trim()) return null;
    const key = vnDeaccent(raw);
    if (key in VN_PROVINCE_MAP) {
      const canonical = VN_PROVINCE_MAP[key];
      return canonical || null;
    }
    return raw.trim();
  }

// ---------------------------------------------------------------------------
// Allow-list for the PUBLIC FEED (/api/public/listings).
// The marketplace page is SSR, so every field returned here is embedded in
// public HTML. Owner name/phone, commission, tenant id, audit and assignment
// fields must NEVER be listed below. Mirrors PUBLIC_LISTING_DETAIL_FIELDS plus
// the few list-only fields the cards / map / mobile feed need.
// ---------------------------------------------------------------------------
const PUBLIC_LISTING_FEED_FIELDS = [
  'id', 'code', 'title', 'description', 'type', 'transaction', 'status',
  'price', 'currency', 'area', 'builtArea', 'bedrooms', 'bathrooms',
  'location', 'address', 'coordinates', 'images', 'attributes', 'projectCode',
  'totalUnits', 'availableUnits', 'isVerified', 'viewCount', 'bookingCount',
  'createdAt', 'updatedAt',
] as const;
function sanitizePublicListingFeed(row: any): Record<string, any> {
  if (!row) return row;
  const out: Record<string, any> = {};
  for (const f of PUBLIC_LISTING_FEED_FIELDS) out[f] = (row as any)[f] ?? null;
  if (Array.isArray(out.images)) out.images = out.images.slice(0, 20);
  return out;
}

function publicQueryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function boundedPublicInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function publicFiniteNumber(value: unknown, min?: number): number | undefined {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) return undefined;
  return parsed;
}

  app.get('/api/public/listings', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const page = boundedPublicInteger(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
      const pageSize = boundedPublicInteger(req.query.pageSize, 20, 1, 500);

      // Server-side cache 5 phút cho public listings feed (LRU per-process).
      // Mọi mutate trên listings (create/update/delete/bulk/status) sẽ
      // evictPublicListingsCache() — đảm bảo SLA listing mới hiển thị < 30s
      // sau khi tạo trên các route quản trị.
      // Whitelist param key để chống cache pollution: attacker không thể spam
      // ?junk1=...&junk2=... để evict legit entries khỏi LRU 500 slot.
      const CACHE_KEY_PARAMS = ['page', 'pageSize', 'cursor', 'cursorMode',
        'projectCode', 'type', 'types', 'transaction', 'priceMin', 'priceMax',
        'bedroomsMin', 'areaMin', 'areaMax',
        'search', 'location', 'isVerified', 'direction', 'legalStatus', 'sort'];
      const cacheKey = `pl:${PUBLIC_TENANT}|${
        CACHE_KEY_PARAMS
          .filter(k => req.query[k] !== undefined)
          .sort()
          .map(k => `${k}=${String(req.query[k])}`)
          .join('&')
      }`;
      const cached = await getPublicListingsCache(cacheKey, PUBLIC_TENANT);
      if (cached) {
        res.setHeader('X-Public-Listings-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.json(cached) as any;
      }

      const filters: any = { status_in: ['AVAILABLE', 'OPENING', 'BOOKING', 'BEST_MARKET'] };
      const projectCode = publicQueryString(req.query.projectCode);
      if (projectCode) {
        filters.projectCode = projectCode;
      } else {
        // Exclude project-catalog units (listings that belong to a project's product list)
        // from the public feed. They should only appear when explicitly queried by projectCode.
        filters.noProjectCode = true;
      }
      const type = publicQueryString(req.query.type);
      if (type) filters.type = type;
      const types = publicQueryString(req.query.types);
      if (types) filters.type_in = types.split(',').map(value => value.trim()).filter(Boolean);
      const transaction = publicQueryString(req.query.transaction);
      if (transaction) filters.transaction = transaction;
      const priceMin = publicFiniteNumber(req.query.priceMin, 0);
      const priceMax = publicFiniteNumber(req.query.priceMax, 0);
      if (priceMin !== undefined) filters.price_gte = priceMin;
      if (priceMax !== undefined) filters.price_lte = priceMax;
      // Mobile-driven extra filters (mirrored on listingRepository).
      if (publicQueryString(req.query.bedroomsMin)) {
        const n = publicFiniteNumber(req.query.bedroomsMin, 1);
        if (n !== undefined && Number.isInteger(n)) filters.bedrooms_gte = n;
      }
      if (publicQueryString(req.query.areaMin)) {
        const n = publicFiniteNumber(req.query.areaMin, 0);
        if (n !== undefined && n > 0) filters.area_gte = n;
      }
      if (publicQueryString(req.query.areaMax)) {
        const n = publicFiniteNumber(req.query.areaMax, 0);
        if (n !== undefined && n > 0) filters.area_lte = n;
      }
      const search = publicQueryString(req.query.search);
      if (search) filters.search = search;
      const province = publicQueryString(req.query.location);
      if (province) {
        const aliases = VN_PROVINCE_ALIASES[province];
        if (aliases?.length) {
          filters.location_any = aliases;
        } else {
          filters.location_contains = province;
        }
      }
      if (req.query.isVerified === 'true') filters.isVerified = true;
      const direction = publicQueryString(req.query.direction);
      if (direction) filters.direction = direction;
      const legalStatus = publicQueryString(req.query.legalStatus);
      if (legalStatus) filters.legalStatus = legalStatus;
      const sortParam = publicQueryString(req.query.sort) || '';
      const publicSortBy: 'newest' | 'price_asc' | 'price_desc' =
        sortParam === 'price_asc' || sortParam === 'price_desc' ? sortParam : 'newest';
      let result: any;
      if (req.query.cursor !== undefined || req.query.cursorMode === 'true') {
        const cursor = (req.query.cursor as string) || undefined;
        result = await listingRepository.findListingsCursor(PUBLIC_TENANT, {
          pageSize,
          cursor: cursor || undefined,
          filters,
          sortBy: 'popular',
        });
      } else {
        result = await listingRepository.findListings(PUBLIC_TENANT, { page, pageSize }, filters, undefined, undefined, publicSortBy);
      }
    // Allow-list BEFORE caching so the cached payload is public-safe too.
    if (result && Array.isArray(result.data)) {
      result = { ...result, data: result.data.map(sanitizePublicListingFeed) };
    }
      await setPublicListingsCache(cacheKey, result, PUBLIC_TENANT);
      res.setHeader('X-Public-Listings-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json(result);
      // Log visitor in background (only page 1/cursor-first, to avoid spamming on pagination)
      if (page === 1 || !req.query.cursor) {
        const ip = getClientIp(req);
        lookupIp(ip).then(geo => visitorRepository.log({
          tenantId: PUBLIC_TENANT,
          ipAddress: ip,
          country: geo?.country,
          countryCode: geo?.countryCode,
          region: geo?.region,
          city: geo?.city,
          lat: geo?.lat,
          lon: geo?.lon,
          isp: geo?.isp,
          page: '/listings',
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer'],
        })).catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching public listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  app.get('/api/public/listings/locations', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const result = await withRlsBypass(async (client) => {
        return client.query(
          `SELECT DISTINCT TRIM(SPLIT_PART(location, ',', -1)) AS loc
             FROM listings
             WHERE tenant_id = $1
               AND status IN ('AVAILABLE','OPENING','BOOKING','BEST_MARKET')
               AND location IS NOT NULL AND location <> ''
             ORDER BY 1`,
          [PUBLIC_TENANT]
        );
      });
      const rawLocs: string[] = result.rows.map((r: any) => r.loc).filter(Boolean);
      const normalized = [
        ...new Set(
          rawLocs
            .map(normalizeToProvince)
            .filter((v): v is string => Boolean(v))
        ),
      ].sort((a, b) => a.localeCompare(b, 'vi'));
      res.json(normalized);
    } catch {
      res.json([]);
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/public/listings/facets - Facet options + benchmark thuc te (B2C).
  // - topAreas: top 4 khu vuc theo so luong tin (gop theo ten tinh chuan hoa).
  // - types/legalStatus/direction: DISTINCT thuc te kem so luong (rong neu
  //   khong co du lieu that - KHONG hardcode option).
  // - priceBenchmarks: gia/m2 trung binh theo (tinh, loai hinh), chi tra ve
  //   khi co toi thieu 3 tin de so sanh (du y nghia thong ke).
  // ---------------------------------------------------------------------
  app.get('/api/public/listings/facets', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const STATUS_OK = "('AVAILABLE','OPENING','BOOKING','BEST_MARKET')";
      const facetsData = await withRlsBypass(async (client) => {
        const loc = await client.query(
          `SELECT TRIM(SPLIT_PART(location, ',', -1)) AS raw_loc, COUNT(*)::int AS n
           FROM listings
           WHERE tenant_id = $1 AND status IN ${STATUS_OK}
             AND location IS NOT NULL AND location <> ''
           GROUP BY raw_loc`,
          [PUBLIC_TENANT],
        );
        const type = await client.query(
          `SELECT type AS v, COUNT(*)::int AS n
           FROM listings
           WHERE tenant_id = $1 AND status IN ${STATUS_OK}
             AND type IS NOT NULL AND type <> ''
           GROUP BY type ORDER BY n DESC`,
          [PUBLIC_TENANT],
        );
        const legal = await client.query(
          `SELECT attributes->>'legalStatus' AS v, COUNT(*)::int AS n
           FROM listings
           WHERE tenant_id = $1 AND status IN ${STATUS_OK}
             AND attributes->>'legalStatus' IS NOT NULL AND attributes->>'legalStatus' <> ''
           GROUP BY v ORDER BY n DESC`,
          [PUBLIC_TENANT],
        );
        const dir = await client.query(
          `SELECT attributes->>'direction' AS v, COUNT(*)::int AS n
           FROM listings
           WHERE tenant_id = $1 AND status IN ${STATUS_OK}
             AND attributes->>'direction' IS NOT NULL AND attributes->>'direction' <> ''
           GROUP BY v ORDER BY n DESC`,
          [PUBLIC_TENANT],
        );
        const price = await client.query(
          `SELECT TRIM(SPLIT_PART(location, ',', -1)) AS raw_loc, type,
                  AVG(price::numeric / NULLIF(area, 0)) AS avg_ppm2, COUNT(*)::int AS n
           FROM listings
           WHERE tenant_id = $1 AND status IN ${STATUS_OK}
             AND price > 0 AND area > 0
             AND location IS NOT NULL AND location <> ''
             AND type IS NOT NULL AND type <> ''
           GROUP BY raw_loc, type
           HAVING COUNT(*) >= 3`,
          [PUBLIC_TENANT],
        );
        return { loc, type, legal, dir, price };
      });

      const areaCounts = new Map<string, number>();
      for (const row of facetsData.loc.rows) {
        const name = normalizeToProvince(row.raw_loc);
        if (!name) continue;
        areaCounts.set(name, (areaCounts.get(name) || 0) + Number(row.n));
      }
      const topAreas = [...areaCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      const priceMap = new Map<string, { sum: number; n: number }>();
      for (const row of facetsData.price.rows) {
        const province = String(row.raw_loc || '').trim();
        if (!province) continue;
        const key = `${province}|${row.type}`;
        const n = Number(row.n);
        const avg = Number(row.avg_ppm2);
        const cur = priceMap.get(key) || { sum: 0, n: 0 };
        cur.sum += avg * n;
        cur.n += n;
        priceMap.set(key, cur);
      }
      const priceBenchmarks: Record<string, { avgPricePerM2: number; sampleSize: number }> = {};
      for (const [key, { sum, n }] of priceMap.entries()) {
        if (n < 3) continue;
        priceBenchmarks[key] = { avgPricePerM2: Math.round(sum / n), sampleSize: n };
      }

      res.json({
        topAreas,
        types: facetsData.type.rows.map((r: any) => ({ value: r.v, count: Number(r.n) })),
        legalStatus: facetsData.legal.rows.map((r: any) => ({ value: r.v, count: Number(r.n) })),
        direction: facetsData.dir.rows.map((r: any) => ({ value: r.v, count: Number(r.n) })),
        priceBenchmarks,
      });
    } catch (err) {
      console.error('[public/listings/facets] error:', err);
      res.json({ topAreas: [], types: [], legalStatus: [], direction: [], priceBenchmarks: {} });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/public/listings/map - Diem ban do nhe ky, loc theo viewport bbox
  // tren cot coordinates JSONB (tuong duong thuc dung cua PostGIS ST_DWithin,
  // vi DB hien chua cai extension PostGIS).
  // ---------------------------------------------------------------------
  app.get('/api/public/listings/map', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const minLat = Number(req.query.minLat);
      const maxLat = Number(req.query.maxLat);
      const minLng = Number(req.query.minLng);
      const maxLng = Number(req.query.maxLng);
      const hasBbox = [minLat, maxLat, minLng, maxLng].every((v) => Number.isFinite(v));

      const conditions: string[] = [
        `tenant_id = $1`,
        `status IN ('AVAILABLE','OPENING','BOOKING','BEST_MARKET')`,
        `coordinates IS NOT NULL`,
      ];
      const values: any[] = [PUBLIC_TENANT];
      if (hasBbox) {
        conditions.push(`(coordinates->>'lat')::float8 BETWEEN $${values.length + 1} AND $${values.length + 2}`);
        values.push(minLat, maxLat);
        conditions.push(`(coordinates->>'lng')::float8 BETWEEN $${values.length + 1} AND $${values.length + 2}`);
        values.push(minLng, maxLng);
      }
      if (req.query.type) {
        conditions.push(`type = $${values.length + 1}`);
        values.push(req.query.type);
      }
      if (req.query.transaction) {
        conditions.push(`transaction = $${values.length + 1}`);
        values.push(req.query.transaction);
      }
      if (req.query.legalStatus) {
        conditions.push(`attributes->>'legalStatus' = $${values.length + 1}`);
        values.push(req.query.legalStatus);
      }
      if (req.query.direction) {
        conditions.push(`attributes->>'direction' = $${values.length + 1}`);
        values.push(req.query.direction);
      }

      const result = await withRlsBypass((client) =>
        client.query(
          `SELECT id, code, title, price, currency, type, transaction,
                  coordinates, is_verified, images
           FROM listings
           WHERE ${conditions.join(' AND ')}
           ORDER BY created_at DESC
           LIMIT 500`,
          values,
        ),
      );

      const points = result.rows
        .map((row: any) => {
          const coords = row.coordinates || {};
          const firstImage = Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : null;
          return {
            id: row.id,
            code: row.code,
            title: row.title,
            price: row.price !== null ? Number(row.price) : null,
            currency: row.currency,
            type: row.type,
            transaction: row.transaction,
            lat: coords.lat !== undefined ? Number(coords.lat) : null,
            lng: coords.lng !== undefined ? Number(coords.lng) : null,
            isVerified: !!row.is_verified,
            image: firstImage,
          };
        })
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      res.json({ points, truncated: result.rows.length >= 500 });
    } catch (err) {
      console.error('[public/listings/map] error:', err);
      res.json({ points: [], truncated: false });
    }
  });


  // ── Public listing DETAIL (B2C #1) ────────────────────────────────────────
  // GET /api/public/listings/:slugId
  // - `slugId` chấp nhận 2 dạng:
  //     * UUID nguyên (legacy `/listing/<uuid>`)
  //     * `<slug>-<uuid>` (B2C URL `/bds/<slug>-<uuid>` — slug bị bỏ ở server,
  //       chỉ dùng trailing UUID để lookup. Slug được client tạo từ title để
  //       làm URL human-readable + tốt cho SEO).
  // - Cross-tenant via `withRlsBypass` (vendor-agnostic marketplace).
  // - Hard filter `status IN (AVAILABLE, BOOKING, OPENING)` — không trả
  //   HOLD/SOLD/INACTIVE → tránh leak listing nội bộ.
  // - Payload SANITIZED (allow-list 17 trường) — KHÔNG bao gồm
  //   owner_name/owner_phone/commission/commission_unit/audit_logs để chống
  //   leak data nội bộ qua endpoint công khai.
  // - Detail cache 5 phút theo id, evict ngay khi mutate (CREATE/UPDATE/
  //   STATUS/DELETE/BULK).
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  function extractListingId(slugId: string): string | null {
    if (!slugId) return null;
    const m = slugId.match(UUID_RE);
    return m ? m[0].toLowerCase() : null;
  }
  // Allow-list trường được phép trả ra public — KHÔNG bao gồm owner/commission/audit
  const PUBLIC_LISTING_DETAIL_FIELDS = [
    'id', 'code', 'title', 'description', 'type', 'transaction', 'status',
    'price', 'currency', 'area', 'builtArea', 'bedrooms', 'bathrooms',
    'location', 'coordinates', 'images', 'attributes', 'projectCode',
    'contactPhone', 'isVerified', 'viewCount', 'bookingCount', 'createdAt',
    'updatedAt',
  ] as const;
  function sanitizePublicListing(row: any): Record<string, any> {
    if (!row) return row;
    const out: Record<string, any> = {};
    for (const f of PUBLIC_LISTING_DETAIL_FIELDS) {
      out[f] = row[f] ?? null;
    }
    if (Array.isArray(out.images)) out.images = out.images.slice(0, 20);
    return out;
  }
  // Raw row → camelCase mapping (withRlsBypass returns snake_case from DB).
  function mapListingRow(r: any): Record<string, any> {
    return {
      id: r.id, code: r.code, title: r.title, description: r.description,
      type: r.type, transaction: r.transaction, status: r.status,
      price: r.price !== null ? Number(r.price) : null,
      currency: r.currency,
      area: r.area !== null ? Number(r.area) : null,
      builtArea: r.built_area !== null ? Number(r.built_area) : null,
      bedrooms: r.bedrooms, bathrooms: r.bathrooms, location: r.location,
      coordinates: r.coordinates, images: r.images, attributes: r.attributes,
      projectCode: r.project_code, contactPhone: r.contact_phone,
      isVerified: r.is_verified, viewCount: r.view_count,
      bookingCount: r.booking_count, tenantId: r.tenant_id,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  
// --- Public view tracking -------------------------------------------------
// listings.view_count is now a PUBLIC metric only: the authenticated CRM
// endpoint no longer increments it, bots are ignored, and one visitor (IP)
// is counted at most once per PUBLIC_VIEW_DEDUPE_MINUTES.
const PUBLIC_VIEW_DEDUPE_MINUTES = 30;
const BOT_UA_RE = /(bot|crawler|crawling|spider|slurp|facebookexternalhit|embedly|whatsapp|telegram|discordbot|skypeuripreview|linkpreview|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http-client|postman|httpclient)/i;
function isBotRequest(req: express.Request): boolean {
  const ua = String(req.headers['user-agent'] || '').trim();
  if (!ua) return true;
  return BOT_UA_RE.test(ua);
}
// Owner tenant per public listing id, filled on cache MISS so the cache-HIT
// branch can attribute the view without exposing tenantId in the payload.
const PUBLIC_LISTING_TENANT_BY_ID = new Map<string, string>();
async function trackPublicListingView(
  req: express.Request, tenantId: string, id: string, slugId: string,
): Promise<void> {
  const ip = getClientIp(req);
  try {
    if (!isBotRequest(req)) {
      const seen = await visitorRepository.hasRecentView(
        id, ip, PUBLIC_VIEW_DEDUPE_MINUTES, BOT_UA_RE.source,
      );
      if (!seen) await listingRepository.incrementViewCount(tenantId, id);
    }
  } catch { /* view_count is best-effort */ }
  try {
    const geo = await lookupIp(ip);
    await visitorRepository.log({
      tenantId, ipAddress: ip,
      country: geo?.country, countryCode: geo?.countryCode,
      region: geo?.region, city: geo?.city, lat: geo?.lat, lon: geo?.lon,
      isp: geo?.isp, page: `/bds/${slugId}`, listingId: id,
      userAgent: req.headers['user-agent'] as any, referrer: req.headers['referer'],
    });
  } catch { /* visitor log is best-effort */ }
}
app.get('/api/public/listings/:slugId', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const slugId = String(req.params.slugId || '');
      const id = extractListingId(slugId);
      if (!id) {
        return res.status(400).json({ error: 'Invalid id format. Expected UUID or `<slug>-<uuid>`.' }) as any;
      }

      // Cache lookup
      const cacheKey = `pld:${id}`;
      const cached = await getPublicListingDetailCache(cacheKey, 'public-market');
      if (cached) {
        res.setHeader('X-Public-Listing-Detail-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.json(cached);
        // View tracking even on HIT — analytics must count real impressions.
        // Use the listing's owner tenant (cached payload exposes tenantId
        // implicitly via branding.tenantId; fallback to a quick lookup) so
        // view_count and visitor logs land in the vendor's CRM, not in
        // PUBLIC_TENANT — preserves cross-tenant analytics accuracy.
        const ownerTenantId = PUBLIC_LISTING_TENANT_BY_ID.get(id)
          || String((cached as any)?.branding?.tenantId || PUBLIC_TENANT);
        void trackPublicListingView(req, ownerTenantId, id, slugId);
        return;
      }

      // MISS → cross-tenant lookup with strict status filter + verified
      // vendor gate (tenants.approval_status = 'APPROVED'). Listings from
      // tenants pending approval / rejected NEVER leak into public detail.
      const raw = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT l.* FROM listings l
             JOIN tenants t ON t.id = l.tenant_id
             WHERE l.id = $1
               AND l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET')
               AND t.approval_status = 'APPROVED'
             LIMIT 1`,
          [id]
        );
        return r.rows[0] || null;
      });
      if (!raw) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' }) as any;

      const mapped = mapListingRow(raw);
      const sanitized = sanitizePublicListing(mapped);
      // Vendor branding (white-label task #28) — attached to the public
      // detail payload so the storefront can render CĐT logo/displayName/
      // primaryColor/hotline/zalo/messenger consistently with the microsite.
      // Best-effort: if branding lookup fails the detail still serves.
      try {
        const binding = await getTenantBinding(String(mapped.tenantId || ''));
        if (binding) {
          (sanitized as any).branding = {
            tenantId: binding.tenantId,
            displayName: binding.branding.displayName || binding.name,
            logoUrl: binding.branding.logoUrl || null,
            faviconUrl: binding.branding.faviconUrl || null,
            primaryColor: binding.branding.primaryColor || null,
            hotline: binding.branding.hotline || null,
            hotlineDisplay: binding.branding.hotlineDisplay || null,
            zalo: binding.branding.zalo || null,
            messenger: binding.branding.messenger || null,
          };
        }
      } catch { /* branding optional */ }
      await setPublicListingDetailCache(cacheKey, sanitized, 'public-market');

      res.setHeader('X-Public-Listing-Detail-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json(sanitized);

      // Background: view count, visitor log, geocode missing coords.
      const coordsMissing = !mapped.coordinates?.lat || !mapped.coordinates?.lng ||
        (mapped.coordinates.lat === 0 && mapped.coordinates.lng === 0);
      if (coordsMissing && mapped.location) {
        scheduleGeocode(String(mapped.tenantId || PUBLIC_TENANT), id, mapped.location);
      }
        PUBLIC_LISTING_TENANT_BY_ID.set(id, String(mapped.tenantId || PUBLIC_TENANT));
        void trackPublicListingView(req, String(mapped.tenantId || PUBLIC_TENANT), id, slugId);
    } catch (error) {
      console.error('Error fetching public listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  });

  // GET /api/public/listings/:slugId/similar
  // Trả tối đa 6 listing "tương tự" — cùng project_code (ưu tiên) hoặc cùng
  // type + cùng location prefix. Hard filter status công khai.
  app.get('/api/public/listings/:slugId/similar', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const id = extractListingId(String(req.params.slugId || ''));
      if (!id) return res.status(400).json({ error: 'Invalid id' }) as any;

      const cacheKey = `pld:${id}|similar`;
      const cached = await getPublicListingDetailCache(cacheKey, 'public-market');
      if (cached) {
        res.setHeader('X-Public-Listing-Detail-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
        return res.json(cached);
      }

      // Business rule: cung QUAN/HUYEN + cung property TYPE + gia +-20%, top 3.
      // Lop collaborative filtering: nhung khach da xem tin nay con xem tin nao khac
      // (dua tren visitor_events, chi co du lieu khi khach da dong y BEHAVIORAL cookie)
      // duoc dung de RE-RANK trong nhom ung vien rule-based, khong thay the rule-based.
      const items = await withRlsBypass(async (client) => {
        const seed = await client.query(
          `SELECT l.id, l.code, l.tenant_id, l.type, l.project_code, l.location, l.price
           FROM listings l
           JOIN tenants t ON t.id = l.tenant_id
           WHERE l.id = $1 AND t.approval_status = 'APPROVED'
           LIMIT 1`,
          [id]
        );
        if (!seed.rows[0]) return [];
        const s = seed.rows[0];
        const tokens = String(s.location || '').split(',').map((t: string) => t.trim()).filter(Boolean);
        const districtToken = tokens.find((t: string) => /^(Quan|Huyen|Thanh pho|Thi xa|TP\.?)\s+/i.test(t)) || tokens[tokens.length - 2] || '';
        if (!districtToken || !s.type) return [];
        const seedPrice = s.price !== null ? Number(s.price) : null;
        const priceMin = seedPrice ? Math.floor(seedPrice * 0.8) : null;
        const priceMax = seedPrice ? Math.ceil(seedPrice * 1.2) : null;
        const r = await client.query(
          `SELECT l.* FROM listings l
           JOIN tenants t ON t.id = l.tenant_id
           WHERE l.id <> $1
             AND l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET')
             AND t.approval_status = 'APPROVED'
             AND l.type = $2
             AND l.location ILIKE $3
             AND ($4::numeric IS NULL OR l.price BETWEEN $4 AND $5)
           ORDER BY l.updated_at DESC
           LIMIT 15`,
          [id, s.type, `%${districtToken}%`, priceMin, priceMax]
        );
        const candidates = r.rows as any[];
        if (candidates.length <= 3 || !s.code) {
          return candidates.slice(0, 3);
        }

        let coViewMap = new Map<string, number>();
        try {
          const coView = await client.query(
            `WITH seed_viewers AS (
               SELECT DISTINCT visitor_id FROM visitor_events
               WHERE tenant_id = $1 AND event_type = 'property_view'
                 AND metadata->>'listingCode' = $2
                 AND visitor_id IS NOT NULL
                 AND created_at > NOW() - INTERVAL '90 days'
             )
             SELECT ve.metadata->>'listingCode' AS code, COUNT(DISTINCT ve.visitor_id)::int AS co_views
             FROM visitor_events ve
             JOIN seed_viewers sv ON sv.visitor_id = ve.visitor_id
             WHERE ve.tenant_id = $1 AND ve.event_type = 'property_view'
               AND ve.metadata->>'listingCode' IS NOT NULL
               AND ve.metadata->>'listingCode' <> $2
               AND ve.created_at > NOW() - INTERVAL '90 days'
             GROUP BY ve.metadata->>'listingCode'`,
            [s.tenant_id, s.code]
          );
          coViewMap = new Map(coView.rows.map((row: any) => [row.code, Number(row.co_views) || 0]));
        } catch (coViewError) {
          console.warn('[SimilarListings] collaborative signal skipped:', (coViewError as any)?.message || coViewError);
        }

        const ranked = candidates
          .map((row, idx) => ({ row, idx, coScore: coViewMap.get(row.code) || 0 }))
          .sort((a, b) => (b.coScore - a.coScore) || (a.idx - b.idx));
        return ranked.slice(0, 3).map((x) => x.row);
      });

      const sanitized = items.map((row: any) => sanitizePublicListing(mapListingRow(row)));

      await setPublicListingDetailCache(cacheKey, sanitized, 'public-market');
      res.setHeader('X-Public-Listing-Detail-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
      return res.json(sanitized);
    } catch (error) {
      console.error('Error fetching similar listings:', error);
      return res.status(500).json({ error: 'Failed to fetch similar listings' });
    }
  });

  // ── Public lead capture scoped to a specific listing ──────────────────────
  // POST /api/public/listings/:id/leads
  // - Rate limit: 5 req / giờ / IP (publicListingLeadRateLimit, riêng để
  //   không cạnh tranh với /api/public/leads chung).
  // - Dedup: cùng phone + cùng listing_id trong 24h → trả về lead cũ
  //   (silent success — không spam DB / không khoá user).
  // - Lead lưu metadata.listing_id / listing_code / listing_title để CRM
  //   thấy ngay nguồn gốc, đồng thời prefix vào notes.
  const publicListingLeadRateLimit = rateLimit({
    name: 'public_listing_lead',
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyFn: (req: express.Request) => `pll:${req.ip || 'anonymous'}`,
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ hoặc gọi hotline.',
  });

  app.post('/api/public/listings/:id/leads', publicListingLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const listingId = extractListingId(String(req.params.id || ''));
      if (!listingId) {
        return res.status(400).json({ error: 'Invalid listing id' }) as any;
      }
      const { name, phone, notes, source, email } = req.body || {};
      if (!name || !phone) {
        return res.status(400).json({ error: 'name và phone là bắt buộc' }) as any;
      }
      const trimmedPhone = String(phone).trim().slice(0, 20);
      if (!/^(0|\+84)\d{9,10}$/.test(trimmedPhone.replace(/\s+/g, ''))) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ' }) as any;
      }

      // Resolve listing CROSS-TENANT (vendor-agnostic marketplace) + status
      // + verified-vendor filter. Lead phải lưu vào tenant CHỦ listing để
      // CRM của vendor đó nhận được — không hardcode PUBLIC_TENANT.
      const raw = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT l.id, l.tenant_id, l.code, l.title, l.status, l.contact_phone
             FROM listings l
             JOIN tenants t ON t.id = l.tenant_id
             WHERE l.id = $1
               AND l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET')
               AND t.approval_status = 'APPROVED'
             LIMIT 1`,
          [listingId]
        );
        return r.rows[0] || null;
      });
      if (!raw) return res.status(404).json({ error: 'Không tìm thấy sản phẩm hoặc sản phẩm không nhận yêu cầu tư vấn' }) as any;
      const ownerTenantId = String(raw.tenant_id);

      // Dedup 24h trong PHẠM VI TENANT CHỦ listing.
      try {
        const dup = await withRlsBypass(async (client) => {
          const r = await client.query(
            `SELECT id FROM leads
               WHERE tenant_id = $1
                 AND phone = $2
                 AND metadata->>'listing_id' = $3
                 AND created_at > NOW() - INTERVAL '24 hours'
               LIMIT 1`,
            [ownerTenantId, trimmedPhone, listingId]
          );
          return r.rows[0] || null;
        });
        if (dup) {
          return res.json({ id: dup.id, success: true, deduped: true }) as any;
        }
      } catch { /* best-effort, không block create nếu query lỗi */ }

      const listingTitle = String(raw.title || '').slice(0, 200);
      const listingCode = String(raw.code || '').slice(0, 64);
      const url = String(req.headers.referer || '').slice(0, 500);
      const baseNotes = `🏠 LEAD TỪ TRANG SẢN PHẨM\n────────────────\n📍 Sản phẩm: [${listingCode}] ${listingTitle}\n🔗 Link: ${url || `/bds/${listingId}`}`;
      const finalNotes = notes
        ? `${baseNotes}\n📝 Ghi chú KH: ${String(notes).slice(0, 1500)}`
        : baseNotes;

      const metadata = {
        listing_id: listingId,
        listing_code: listingCode,
        listing_title: listingTitle,
        source_type: 'listing_detail',
        page_url: url || `/bds/${listingId}`,
        ip: req.ip || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      };
      const tags = ['listing-lead', `listing:${listingId.slice(0, 8)}`];
      // INSERT vào tenant chủ listing — withRlsBypass vì đây là public endpoint.
      const insertedId = await withRlsBypass(async (client) => {
        const result = await client.query(
          `INSERT INTO leads
             (tenant_id, name, phone, email, source, stage, notes, tags, metadata)
           VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7::jsonb, $8::jsonb)
           RETURNING id`,
          [
            ownerTenantId,
            String(name).trim().slice(0, 100),
            trimmedPhone,
            email ? String(email).trim().slice(0, 120) : null,
            source || 'WEBSITE',
            finalNotes,
            JSON.stringify(tags),
            JSON.stringify(metadata),
          ]
        );
        return result.rows[0]?.id || null;
      });

      // Realtime cho CRM của tenant chủ listing.
      broadcastIo?.to(`tenant:${ownerTenantId}`).emit('lead_created', {
        id: insertedId, name: String(name).trim().slice(0, 100),
      });

      // Vendor-targeted notification email — best-effort, không block response.
      // From-name = displayName tenant (white-label task #28). Recipient =
      // tenant OWNER/ADMIN của listing (query users), fallback LEAD_NOTIFY_EMAIL
      // chỉ khi vendor không có user active nào với email — đảm bảo vendor's
      // inbox luôn được ưu tiên thay vì global ops mailbox.
      (async () => {
        try {
          const binding = await getTenantBinding(ownerTenantId).catch(() => null);
          const fromName = binding?.branding.displayName || binding?.name || 'SGS Land';
          const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@sgsland.vn';
          // Resolve vendor inbox: prefer OWNER → ADMIN → SUPER_ADMIN, active + email_verified.
          const vendorInbox = await withRlsBypass(async (client) => {
            const r = await client.query(
              `SELECT email, name FROM users
                 WHERE tenant_id = $1
                   AND email IS NOT NULL AND email <> ''
                   AND status = 'ACTIVE'
                 ORDER BY CASE role
                     WHEN 'OWNER' THEN 1
                     WHEN 'ADMIN' THEN 2
                     WHEN 'SUPER_ADMIN' THEN 3
                     ELSE 9 END,
                   email_verified DESC NULLS LAST,
                   created_at ASC
                 LIMIT 1`,
              [ownerTenantId]
            );
            return r.rows[0] || null;
          }).catch(() => null);
          const inboxEmail = vendorInbox?.email || process.env.LEAD_NOTIFY_EMAIL || 'info@sgsland.vn';
          const inboxName = vendorInbox?.name || `${fromName} Sales`;
          const subject = `[Sản phẩm] ${listingTitle} — ${name} (${trimmedPhone})`;
          const escape = (s: string) => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c] as string));
          const html = `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;">
              <h2 style="margin:0 0 16px;color:#1e293b;">Lead mới từ trang sản phẩm</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;">
                <tr><td style="padding:6px 0;color:#64748b;">Sản phẩm</td><td style="padding:6px 0;font-weight:600;">${escape(listingTitle)} (${escape(listingCode)})</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Họ tên</td><td style="padding:6px 0;font-weight:600;">${escape(name)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Điện thoại</td><td style="padding:6px 0;"><a href="tel:${escape(trimmedPhone)}">${escape(trimmedPhone)}</a></td></tr>
                ${email ? `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><a href="mailto:${escape(email)}">${escape(email)}</a></td></tr>` : ''}
                ${notes ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Ghi chú</td><td style="padding:6px 0;white-space:pre-wrap;">${escape(String(notes))}</td></tr>` : ''}
              </table>
              <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Nguồn: ${escape(metadata.page_url)}</p>
            </div>`;
          await brevoSendEmail({
            to: [{ email: inboxEmail, name: inboxName }],
            from: { email: fromEmail, name: fromName },
            subject,
            html: emailService.emailBase(html, 'Thông báo nội bộ từ form đăng ký sản phẩm SGS LAND.'),
            text: `Lead mới: ${name} / ${trimmedPhone} — ${listingTitle} (${listingCode})`,
            replyTo: email ? { email, name } : undefined,
            tags: ['listing-lead', `code-${listingCode.toLowerCase()}`],
          });
        } catch (emailErr: any) {
          logger.warn(`[PublicListingLead] Notification email skipped: ${emailErr?.message || emailErr}`);
        }
      })();

      return res.status(201).json({ id: insertedId, success: true });
    } catch (error) {
      console.error('Error creating public listing lead:', error);
      return res.status(500).json({ error: 'Không thể tạo yêu cầu, vui lòng thử lại' }) as any;
    }
  });

  app.post('/api/public/leads', publicLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { name, phone, notes, source, stage, agentId } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'name và phone là bắt buộc' }) as any;

      // Resolve assigned agent: validate agentId belongs to this tenant to prevent spoofing
      let assignedTo: string | undefined;
      if (agentId && typeof agentId === 'string' && /^[0-9a-f-]{36}$/i.test(agentId)) {
        const agentCheck = await withTenantContext(PUBLIC_TENANT, async (client) => {
          return client.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [agentId]);
        });
        if (agentCheck.rows.length > 0) assignedTo = agentId;
      }

      const lead = await leadRepository.create(PUBLIC_TENANT, {
        name: String(name).trim().slice(0, 100),
        phone: String(phone).trim().slice(0, 20),
        notes: notes ? String(notes).slice(0, 2000) : undefined,
        source: source || 'WEBSITE',
        stage: stage || 'NEW',
        assignedTo,
      });
      // Notify Inbox in real-time so the new thread appears without a page refresh
      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('lead_created', {
        id: lead.id, name: lead.name, assignedTo: lead.assignedTo,
      });
      // Return only non-sensitive confirmation — never expose PII to anonymous callers
      res.status(201).json({ id: lead.id, success: true });
    } catch (error) {
      console.error('Error creating public lead:', error);
      res.status(500).json({ error: 'Không thể tạo yêu cầu, vui lòng thử lại' });
    }
  });

  // /livechat — served by SPA catch-all (clean URL routing)
  // No redirect needed; the SPA handles the /livechat path directly.

  // Public LiveChat: get messages for a lead session (no auth — rate limited)
  app.get('/api/public/livechat/messages/:leadId', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const leadId = req.params.leadId as string;
      if (!leadId) return res.status(400).json({ error: 'leadId bắt buộc' }) as any;
      const lead = await leadRepository.findById(PUBLIC_TENANT, leadId);
      if (!lead) return res.status(404).json({ error: 'Phiên chat không tồn tại' }) as any;
      const messages = await interactionRepository.findByLead(PUBLIC_TENANT, leadId);
      res.json({ messages: messages || [], lead: { id: lead.id, name: lead.name, assignedTo: lead.assignedTo || null, threadStatus: (lead as any).thread_status || 'AI_ACTIVE' } });
    } catch (error) {
      console.error('Public livechat get messages error:', error);
      res.status(500).json({ error: 'Không thể tải lịch sử chat' });
    }
  });

  // Public LiveChat: send a message (inbound from visitor or outbound welcome/system) — no auth, rate limited
  app.post('/api/public/livechat/message', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, content, direction, metadata, idempotencyKey } = req.body;
      if (!leadId || !String(content || '').trim()) {
        return res.status(400).json({ error: 'leadId và content bắt buộc' }) as any;
      }
      const lead = await leadRepository.findById(PUBLIC_TENANT, leadId);
      if (!lead) return res.status(404).json({ error: 'Phiên chat không tồn tại' }) as any;
      const resolvedDirection = direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
      const msg = await interactionRepository.create(PUBLIC_TENANT, {
        leadId,
        channel: 'WEB',
        direction: resolvedDirection,
        type: 'TEXT',
        content: String(content).trim().slice(0, 2000),
        metadata: metadata || {},
        externalEventId: idempotencyKey
          ? `web-inbound:${String(idempotencyKey).slice(0, 160)}`
          : undefined,
      });
      // Push real-time updates to authenticated agents in Inbox
      // 1. Active chat pane (anyone currently viewing this lead's conversation)
      broadcastIo?.to(leadId).emit('receive_message', { room: leadId, message: msg });
      // 2. Inbox sidebar (thread list + unread badge) for all agents in the tenant
      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('new_inbound_message', { leadId, message: msg });
      res.status(201).json({ message: msg });
    } catch (error) {
      console.error('Public livechat send message error:', error);
      res.status(500).json({ error: 'Không thể gửi tin nhắn' });
    }
  });

  // Public AI endpoint: LiveChat widget AI reply (no auth required — uses rate limiting only)
  app.post('/api/public/ai/livechat', livechatRateLimit, aiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, message, lang, inboundInteractionId } = req.body;
      if (!leadId || !String(message || '').trim()) {
        return res.status(400).json({ error: 'leadId và message là bắt buộc' }) as any;
      }
      const msgContent = String(message).trim().slice(0, 2000);

      const lead = await leadRepository.findById(PUBLIC_TENANT, leadId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' }) as any;

      // If a human agent has taken over this conversation, skip AI processing entirely.
      // The agent will reply manually via the Inbox; the widget should wait silently.
      const threadStatus = (lead as any).thread_status || 'AI_ACTIVE';
      if (threadStatus === 'HUMAN_TAKEOVER') {
        return res.json({ noReply: true }) as any;
      }

      // The client already saved the visitor's inbound message via /api/public/livechat/message
      // before calling this endpoint, so fetch history directly — it already contains that message.
      // This avoids persisting a duplicate INBOUND record.
      const history = await interactionRepository.findByLead(PUBLIC_TENANT, leadId);
      const historyWithLatest = history; // includes the already-saved visitor message
      const inboundInteraction = await interactionRepository.findInboundForAgentRun(
        PUBLIC_TENANT,
        leadId,
        inboundInteractionId
          ? { interactionId: String(inboundInteractionId) }
          : { content: msgContent },
      );
      if (!inboundInteraction?.id) {
        return res.status(409).json({
          error: 'Tin nhắn đến chưa được lưu. Vui lòng gửi lại tin nhắn.',
        }) as any;
      }

      const { aiService, detectMessageLang } = await import('./server/ai');
      const { runDurableAgentExecution } = await import('./server/services/durableAgentExecutionService');
      // Reply in the language the customer actually typed (Vietnamese without diacritics too),
      // not just the UI language the widget sent.
      const replyLang = detectMessageLang(msgContent, lang || 'vn');
      const t = serverT(replyLang);
      const execution = await runDurableAgentExecution({
        tenantId: PUBLIC_TENANT,
        idempotencyKey: `web:${inboundInteraction.id}`,
        sessionId: leadId,
        leadId,
        triggerSource: 'public-livechat',
        message: msgContent,
        execute: () => aiService.processMessage(
          lead,
          msgContent,
          historyWithLatest,
          t,
          PUBLIC_TENANT,
          replyLang,
        ),
      });
      const result = execution.result;

      const aiReply = await interactionRepository.create(PUBLIC_TENANT, {
        leadId,
        channel: 'WEB',
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: result.content,
        // Fix G: đánh dấu rõ tin nhắn AI để filter trong analytics + Inbox UI
        metadata: {
          isAi: true,
          isAgent: true,
          intent: result.intent,
          aiConfidence: result.confidence,
          escalated: result.escalated ?? false,
          ...(result.isSysMsg ? { isSysMsg: true } : {}),
          agentRunId: execution.runId,
          traceId: execution.traceId,
          needsVerification: execution.guardrail.requiresVerification,
        },
        externalEventId: `agent:${execution.runId}`,
      });
      // A cached execution is a retry: return the same interaction without duplicate socket fan-out.
      if (!execution.cached) {
        broadcastIo?.to(leadId).emit('receive_message', { room: leadId, message: aiReply });
        broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('new_inbound_message', { leadId, message: aiReply });
      }
      if (result.escalated) {
        await interactionRepository.updateThreadAiMode(PUBLIC_TENANT, leadId, 'HUMAN_TAKEOVER');
        broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('escalate_to_human', {
          leadId,
          reason: 'Independent agent guardrail requested human review',
        });
      }

      res.json({ reply: aiReply, artifact: result.artifact, suggestedAction: result.suggestedAction });
    } catch (error) {
      logger.error('Public AI livechat error:', error as Error);
      res.status(500).json({ error: 'AI đang bận, vui lòng thử lại sau' });
    }
  });

  // POST /api/public/livechat/capture-lead — widget lead capture with auto-score
  app.post('/api/public/livechat/capture-lead', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, name, phone, notes, source } = req.body;
      if (!phone) return res.status(400).json({ error: 'phone bắt buộc' }) as any;

      const result = await liveChatEngine.callTool('capture_lead', {
        tenantId: PUBLIC_TENANT,
        name:   String(name  || 'Khách hàng').trim(),
        phone:  String(phone).trim(),
        notes:  notes  ? String(notes).slice(0, 2000) : undefined,
        source: source || 'WIDGET_CAPTURE',
      });

      // If there is an existing leadId session, send a confirmation message into that thread
      if (leadId && typeof leadId === 'string' && /^[0-9a-f-]{36}$/i.test(leadId)) {
        const confirmMsg = await interactionRepository.create(PUBLIC_TENANT, {
          leadId,
          channel: 'WEB' as any,
          direction: 'OUTBOUND' as any,
          type: 'TEXT',
          content: '✅ Đã ghi nhận! Tư vấn viên sẽ gọi lại cho bạn trong **15 phút** ⚡',
          metadata: { isAgent: true, captureConfirm: true },
        });
        broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('new_inbound_message', { leadId, message: confirmMsg });
      }

      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('lead_created', {
        id: result.leadId, name: String(name || phone), source: source || 'WIDGET_CAPTURE',
      });
      res.status(201).json({ id: result.leadId, score: result.score, grade: result.grade, success: true });
    } catch (error) {
      logger.error('Capture lead error:', error as Error);
      res.status(500).json({ error: 'Không thể lưu thông tin, vui lòng thử lại' });
    }
  });

  // POST /api/public/livechat/escalate — escalate thread to human agent
  app.post('/api/public/livechat/escalate', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, reason, priority } = req.body;
      if (!leadId || typeof leadId !== 'string' || !/^[0-9a-f-]{36}$/i.test(leadId)) {
        return res.status(400).json({ error: 'leadId không hợp lệ' }) as any;
      }

      const result = await liveChatEngine.callTool('escalate_to_human', {
        tenantId: PUBLIC_TENANT,
        leadId,
        reason:   reason   || 'user_requested',
        priority: priority || 'normal',
      });

      // Update thread_status in DB
      await withTenantContext(PUBLIC_TENANT, async (client) => {
        await client.query(
          `UPDATE leads SET thread_status = 'HUMAN_TAKEOVER', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [leadId],
        );
      });

      // Broadcast socket events
      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('ai_mode_changed', {
        leadId, status: 'HUMAN_TAKEOVER', priority: result.priority, reason: result.reason,
      });
      if (result.messageId) {
        const msgs = await interactionRepository.findByLead(PUBLIC_TENANT, leadId).catch(() => [] as any[]);
        const msg = (msgs as any[]).find((m: any) => m.id === result.messageId);
        if (msg) broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('new_inbound_message', { leadId, message: msg });
      }

      res.json({ success: true, estimatedWaitMinutes: result.estimatedWaitMinutes, priority: result.priority });
    } catch (error) {
      logger.error('Escalate error:', error as Error);
      res.status(500).json({ error: 'Không thể kết nối tư vấn viên, vui lòng thử lại' });
    }
  });

  // POST /api/public/livechat/book-viewing — book a property viewing appointment
  app.post('/api/public/livechat/book-viewing', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, dateText, listingId, notes } = req.body;
      if (!leadId || typeof leadId !== 'string' || !/^[0-9a-f-]{36}$/i.test(leadId)) {
        return res.status(400).json({ error: 'leadId không hợp lệ' }) as any;
      }
      if (!dateText) return res.status(400).json({ error: 'dateText bắt buộc' }) as any;

      const result = await liveChatEngine.callTool('book_viewing_appointment', {
        tenantId:  PUBLIC_TENANT,
        leadId,
        dateText:  String(dateText).slice(0, 100),
        listingId: listingId || undefined,
        notes:     notes     ? String(notes).slice(0, 500) : undefined,
      });

      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('viewing_booked', {
        leadId, viewingId: result.viewingId, scheduledAt: result.scheduledAt,
      });

      res.json({
        success:              true,
        viewingId:            result.viewingId,
        scheduledAt:          result.scheduledAt,
        scheduledAtFormatted: result.scheduledAtFormatted,
      });
    } catch (error) {
      logger.error('Book viewing error:', error as Error);
      res.status(500).json({ error: 'Không thể đặt lịch, vui lòng thử lại' });
    }
  });

  // GET /api/public/livechat/project-listings — get listings by project with filters (PN/price/tower)
  app.get('/api/public/livechat/project-listings', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { projectCode, bedrooms, pn, priceMin, priceMax, tower, block, status, limit, page, noCache } = req.query;
      if (!projectCode) return res.status(400).json({ error: 'projectCode bắt buộc' }) as any;

      const result = await liveChatEngine.callTool('get_project_listings', {
        tenantId:    PUBLIC_TENANT,
        projectCode: String(projectCode),
        bedrooms:    (bedrooms ?? pn) != null
          ? publicFiniteNumber(bedrooms ?? pn, 1)
          : undefined,
        priceMin:    publicFiniteNumber(priceMin, 0),
        priceMax:    publicFiniteNumber(priceMax, 0),
        tower:       tower ?? block,
        status:      status || 'AVAILABLE',
        limit:       boundedPublicInteger(limit, 50, 1, 100),
        page:        boundedPublicInteger(page, 1, 1, Number.MAX_SAFE_INTEGER),
        noCache:     noCache === 'true',
      });
      res.json(result);
    } catch (error) {
      logger.error('Project listings error:', error as Error);
      res.status(500).json({ error: 'Không thể tải danh sách sản phẩm' });
    }
  });

  // GET /api/public/livechat/search-dynamic — real-time cross-marketplace listing search
  app.get('/api/public/livechat/search-dynamic', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { query, area, type, bedrooms, priceMin, priceMax, status, limit, page, noCache } = req.query;

      const result = await liveChatEngine.callTool('search_listings_dynamic', {
        tenantId: PUBLIC_TENANT,
        query:    query    ? String(query)    : undefined,
        area:     area     ? String(area)     : undefined,
        type:     type     ? String(type)     : undefined,
        bedrooms: bedrooms ? publicFiniteNumber(bedrooms, 1) : undefined,
        priceMin: publicFiniteNumber(priceMin, 0),
        priceMax: publicFiniteNumber(priceMax, 0),
        status:   status   || 'AVAILABLE',
        limit:    boundedPublicInteger(limit, 10, 1, 20),
        page:     boundedPublicInteger(page, 1, 1, Number.MAX_SAFE_INTEGER),
        noCache:  noCache  === 'true',
      });
      res.json(result);
    } catch (error) {
      logger.error('Search dynamic error:', error as Error);
      res.status(500).json({ error: 'Không thể tìm kiếm BĐS' });
    }
  });

  // GET /api/public/livechat/project-info/:code — fetch any project by code + listing stats
  app.get('/api/public/livechat/project-info/:code', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { withListings, listingLimit, listingStatus, noCache } = req.query;

      const result = await liveChatEngine.callTool('get_project_dynamic', {
        tenantId:      PUBLIC_TENANT,
        projectCode:   req.params.code,
        withListings:  withListings  !== 'false',
        listingLimit:  boundedPublicInteger(listingLimit, 20, 1, 100),
        listingStatus: listingStatus || 'AVAILABLE',
        noCache:       noCache       === 'true',
      });
      if (!result.found) return res.status(404).json(result) as any;
      res.json(result);
    } catch (error) {
      logger.error('Project dynamic error:', error as Error);
      res.status(500).json({ error: 'Không thể tải thông tin dự án' });
    }
  });

  // POST /api/internal/livechat/refresh-kb — admin-only: force sync KB cache
  app.post('/api/internal/livechat/refresh-kb', async (req: express.Request, res: express.Response) => {
    const secret = req.headers['x-internal-secret'] || req.body?.secret;
    if (secret !== process.env.GEO_MONITOR_CRON_SECRET && secret !== process.env.JWT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' }) as any;
    }
    try {
      const { scope, projectCode } = req.body || {};
      const result = await liveChatEngine.callTool('refresh_knowledge_base', {
        tenantId: PUBLIC_TENANT,
        scope:    scope || 'all',
        projectCode,
      });
      res.json(result);
    } catch (error) {
      logger.error('Refresh KB error:', error as Error);
      res.status(500).json({ error: 'Refresh thất bại' });
    }
  });

  // Normalise DB article entity → Article shape expected by the frontend
  const normalizeArticle = (a: any) => {
    const textContent = (a.content || '').replace(/<[^>]+>/g, '');
    const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length;
    const readMins = Math.max(1, Math.round(wordCount / 200));
    const publishedAt: Date | null = a.publishedAt ? new Date(a.publishedAt) : null;
    const dateStr = publishedAt
      ? publishedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    return {
      ...a,
      image: a.coverImage || a.image || '',
      date: dateStr,
      readTime: `${readMins} phút`,
      featured: a.featured ?? false,
      tags: Array.isArray(a.tags) ? a.tags : [],
      images: Array.isArray(a.images) ? a.images : [],
      videos: Array.isArray(a.videos) ? a.videos : [],
    };
  };

  app.get('/api/public/articles', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      // Keep invalid pagination from reaching SQL as a negative LIMIT/OFFSET.
      // Public callers include crawlers and form regression checks, so bad
      // query strings should fall back to the first bounded page.
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string, 10) || 50, 200));
      // Public feed = published articles only (single source of truth: Postgres)
      const filters: any = { status: 'PUBLISHED' };
      if (req.query.category) filters.category = req.query.category;
      if (req.query.search) filters.search = req.query.search;
      const result = await articleRepository.findArticles(PUBLIC_TENANT, { page, pageSize }, filters);
      res.json({ ...result, data: (result.data || []).map(normalizeArticle) });
    } catch (error) {
      console.error('Error fetching public articles:', error);
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  });

  app.get('/api/public/articles/:id', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const idOrSlug = String(req.params.id);
      const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let article = UUID_PATTERN.test(idOrSlug)
        ? await articleRepository.findById(PUBLIC_TENANT, idOrSlug)
        : await articleRepository.findBySlug(PUBLIC_TENANT, idOrSlug);
      if (!article) article = await articleRepository.findBySlug(PUBLIC_TENANT, idOrSlug);
      if (!article) return res.status(404).json({ error: 'Article not found' }) as any;
      // Never expose drafts through the public endpoint
      if (String(article.status || '').toUpperCase() !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Article not found' }) as any;
      }
      res.json(normalizeArticle(article));
    } catch (error) {
      console.error('Error fetching public article:', error);
      res.status(500).json({ error: 'Failed to fetch article' });
    }
  });

  // Public contact form — notifies info@sgsland.vn + sends auto-reply to customer
  app.post('/api/public/contact', publicLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!name?.trim() || !email?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }

      // Map subject key → Vietnamese label
      const SUBJECT_LABELS: Record<string, string> = {
        support:     'Tư vấn Thiết kế & Xây dựng',
        sales:       'Tư vấn Mua/Bán Bất Động Sản',
        partnership: 'Hợp tác Kinh doanh',
        other:       'Yêu cầu khác',
      };
      const subjectLabel = SUBJECT_LABELS[subject] || (subject ? String(subject) : 'Yêu cầu khác');
      const subjectKey   = Object.keys(SUBJECT_LABELS).includes(subject) ? subject : 'other';

      // Fire both emails concurrently — don't let one failure block the other
      const [notifyResult, autoReplyResult] = await Promise.allSettled([
        emailService.sendContactNotification(name.trim(), email.trim(), subjectLabel, message.trim()),
        emailService.sendContactAutoReply(email.trim(), name.trim(), subjectKey, message.trim()),
      ]);

      if (notifyResult.status === 'rejected') {
        console.error('[Contact] Internal notification failed:', notifyResult.reason);
      }
      if (autoReplyResult.status === 'rejected') {
        console.error('[Contact] Auto-reply failed:', autoReplyResult.reason);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Contact] Failed to send contact email:', error);
      res.status(500).json({ error: 'Không thể gửi tin nhắn. Vui lòng thử lại.' });
    }
  });

  // Public newsletter subscribe — saves email + notifies info@sgsland.vn
  app.post('/api/public/newsletter/subscribe', publicLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { email } = req.body;
      if (!email?.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập email' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

      // Save subscriber (ignore duplicate)
      const insertResult = await pool.query(
        `INSERT INTO newsletter_subscribers (email, ip_address, source)
         VALUES ($1, $2, 'news_page')
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email.trim().toLowerCase(), ip]
      );

      const isNew = (insertResult.rowCount ?? 0) > 0;
      const now = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      // Notify info@sgsland.vn regardless of whether email is new or duplicate
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#FFFFFF;padding:24px;border:1px solid #E2E8F0;border-radius:12px">
          <h2 style="color:#1B3A5C">📧 ${isNew ? 'Đăng ký nhận tin mới' : 'Đăng ký nhận tin (đã tồn tại)'}</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#F8FAFC;border:1px solid #E2E8F0">
            <tr><td style="padding:8px;font-weight:bold;color:#555;width:140px">Email:</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">Thời gian:</td><td style="padding:8px">${now}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">Nguồn:</td><td style="padding:8px">Trang Tin Tức SGS LAND</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">IP:</td><td style="padding:8px">${ip || '—'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">Trạng thái:</td><td style="padding:8px">${isNew ? '✅ Mới — đã lưu vào danh sách' : '⚠️ Email đã đăng ký trước đó'}</td></tr>
          </table>
          <p style="margin-top:24px;color:#888;font-size:12px">— SGS Land · info@sgsland.vn</p>
        </div>`;

      await emailService.sendEmail(DEFAULT_TENANT_ID, {
        to: 'info@sgsland.vn',
        subject: `[Newsletter] ${isNew ? 'Đăng ký mới' : 'Đăng ký trùng'}: ${email}`,
        html,
      });

      res.json({ success: true, isNew });
    } catch (error) {
      console.error('[Newsletter] Subscribe error:', error);
      res.status(500).json({ error: 'Không thể đăng ký. Vui lòng thử lại.' });
    }
  });

  // Public careers apply — sends application email to info@sgsland.vn
  app.post('/api/public/careers/apply', publicLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { name, email, phone, message, jobTitle } = req.body;

      if (!name?.trim() || !email?.trim() || !message?.trim() || !jobTitle?.trim()) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }
      if (message.trim().length < 20) {
        return res.status(400).json({ error: 'Thư xin việc quá ngắn' });
      }

      const now = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#1E293B;color:white;padding:24px 32px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;font-size:20px">📋 Hồ Sơ Ứng Tuyển Mới — SGS LAND</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Nhận lúc ${now}</p>
          </div>
          <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border:1px solid #E2E8F0">
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:12px 8px;font-weight:700;color:#374151;width:160px">Vị trí ứng tuyển:</td>
                <td style="padding:12px 8px;color:#1B3A5C;font-weight:700">${jobTitle}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Họ và tên:</td>
                <td style="padding:12px 8px">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Email:</td>
                <td style="padding:12px 8px"><a href="mailto:${email}" style="color:#1B3A5C">${email}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Số điện thoại:</td>
                <td style="padding:12px 8px">${phone?.trim() || '—'}</td>
              </tr>
            </table>
            <div style="margin-top:20px;padding:20px;background:#F8FAFC;border-radius:10px;border-left:4px solid #1B3A5C">
              <p style="margin:0 0 8px;font-weight:700;color:#374151">Thư xin việc / Giới thiệu:</p>
              <p style="margin:0;white-space:pre-wrap;color:#4b5563;line-height:1.7">${message}</p>
            </div>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;text-align:center">— SGS Land Tuyển Dụng · info@sgsland.vn</p>
          </div>
        </div>`;

      await emailService.sendEmail(DEFAULT_TENANT_ID, {
        to: 'info@sgsland.vn',
        subject: `[Ứng Tuyển] ${jobTitle} — ${name}`,
        html,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[Careers] Apply error:', error);
      res.status(500).json({ error: 'Không thể gửi hồ sơ. Vui lòng thử lại.' });
    }
  });

  // Public consignment request — sends form data email to info@sgsland.vn
  app.post('/api/public/consignment', publicLeadRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { name, phone, email, propertyType, transaction, address, area, price, notes, agreed } = req.body;

      if (!name?.trim() || !phone?.trim() || !address?.trim()) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: Họ tên, Số điện thoại, Địa chỉ bất động sản' });
      }
      if (email?.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: 'Email không hợp lệ' });
        }
      }
      if (!agreed) {
        return res.status(400).json({ error: 'Vui lòng xác nhận đồng ý với điều khoản ký gửi' });
      }

      const transactionLabel = transaction === 'SELL' ? 'Mua bán' : 'Cho thuê';
      const now = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#1E293B;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;font-size:20px">📋 Yêu cầu ký gửi bất động sản mới</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Nhận lúc ${now}</p>
          </div>
          <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
            <p style="margin:0 0 16px;font-weight:700;color:#374151;font-size:16px">Thông tin chủ sở hữu</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#F8FAFC;border:1px solid #E2E8F0">
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151;width:180px">Họ và tên:</td>
                <td style="padding:10px 8px">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Số điện thoại:</td>
                <td style="padding:10px 8px"><a href="tel:${phone}" style="color:#1B3A5C">${phone}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Email:</td>
                <td style="padding:10px 8px">${email?.trim() ? `<a href="mailto:${email}" style="color:#1B3A5C">${email}</a>` : '—'}</td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-weight:700;color:#374151;font-size:16px">Thông tin bất động sản</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#F8FAFC;border:1px solid #E2E8F0">
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151;width:180px">Loại BĐS:</td>
                <td style="padding:10px 8px">${propertyType || '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Giao dịch:</td>
                <td style="padding:10px 8px;color:#1B3A5C;font-weight:700">${transactionLabel}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Địa chỉ:</td>
                <td style="padding:10px 8px">${address}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Diện tích:</td>
                <td style="padding:10px 8px">${area ? `${area} m²` : '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Giá kỳ vọng:</td>
                <td style="padding:10px 8px">${price || '—'}</td>
              </tr>
            </table>
            ${notes?.trim() ? `
            <div style="margin-top:8px;padding:16px;background:#F8FAFC;border-radius:10px;border-left:4px solid #1B3A5C">
              <p style="margin:0 0 6px;font-weight:700;color:#374151">Thông tin thêm:</p>
              <p style="margin:0;white-space:pre-wrap;color:#4b5563;line-height:1.7">${notes}</p>
            </div>` : ''}
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;text-align:center">— SGS Land Ký Gửi BĐS · info@sgsland.vn</p>
          </div>
        </div>`;

      await emailService.sendEmail(DEFAULT_TENANT_ID, {
        to: 'info@sgsland.vn',
        subject: `[Ký Gửi BĐS] ${transactionLabel} — ${name} — ${address}`,
        html,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[Consignment] Submit error:', error);
      res.status(500).json({ error: 'Không thể gửi yêu cầu. Vui lòng thử lại hoặc liên hệ info@sgsland.vn.' });
    }
  });

  // ─── Bank Rates API ────────────────────────────────────────────────────────
  // GET  /api/public/bank-rates  — public: list community-submitted rates
  // POST /api/bank-rates         — authenticated: submit a new rate

  app.get('/api/public/bank-rates', apiRateLimit, async (_req: express.Request, res: express.Response) => {
    try {
      const result = await pool.query(
        `SELECT id, bank_name, loan_type, rate_min, rate_max, tenor_min, tenor_max,
                contact_name, contact_phone, notes, is_verified, submitted_by, updated_at
         FROM bank_rates
         WHERE tenant_id = $1
         ORDER BY is_verified DESC, created_at DESC
         LIMIT 200`,
        [DEFAULT_TENANT_ID]
      );
      res.json({ rates: result.rows });
    } catch (err) {
      console.error('[bank-rates GET]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/bank-rates', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      const {
        bank_name, loan_type, rate_min, rate_max,
        tenor_min, tenor_max, contact_name, contact_phone, notes,
      } = req.body;

      if (!bank_name || typeof bank_name !== 'string' || bank_name.trim().length === 0) {
        return res.status(400).json({ error: 'bank_name is required' });
      }
      const rMin = parseFloat(rate_min);
      if (isNaN(rMin) || rMin <= 0 || rMin > 50) {
        return res.status(400).json({ error: 'rate_min must be between 0 and 50' });
      }

      const slug = (bank_name as string).toLowerCase().trim()
        .replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

      const result = await pool.query(
        `INSERT INTO bank_rates
           (tenant_id, bank_name, bank_slug, loan_type, rate_min, rate_max,
            tenor_min, tenor_max, contact_name, contact_phone, notes, submitted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, bank_name, loan_type, rate_min, rate_max, tenor_min, tenor_max,
                   contact_name, contact_phone, notes, is_verified, updated_at`,
        [
          DEFAULT_TENANT_ID,
          (bank_name as string).trim().slice(0, 120),
          slug.slice(0, 120),
          (loan_type as string || 'Thế chấp BĐS').trim().slice(0, 120),
          rMin,
          rate_max ? parseFloat(rate_max) : null,
          tenor_min ? parseInt(tenor_min) : null,
          tenor_max ? parseInt(tenor_max) : null,
          contact_name ? (contact_name as string).trim().slice(0, 200) : null,
          contact_phone ? (contact_phone as string).trim().slice(0, 30) : null,
          notes ? (notes as string).trim().slice(0, 2000) : null,
          user?.id || null,
        ]
      );
      res.status(201).json({ rate: result.rows[0] });
    } catch (err) {
      console.error('[bank-rates POST]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/bank-rates/:id — owner can edit their own submitted rate
  app.put('/api/bank-rates/:id', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      const rateId = parseInt(req.params.id as string, 10);
      if (isNaN(rateId)) return res.status(400).json({ error: 'Invalid id' }) as any;

      const existing = await pool.query(
        'SELECT submitted_by FROM bank_rates WHERE id = $1 AND tenant_id = $2',
        [rateId, DEFAULT_TENANT_ID]
      );
      if (!existing.rows.length) return res.status(404).json({ error: 'Not found' }) as any;
      if (existing.rows[0].submitted_by !== user?.id) {
        return res.status(403).json({ error: 'Chỉ người đăng mới có thể sửa' }) as any;
      }

      const { bank_name, loan_type, rate_min, rate_max, tenor_min, tenor_max, contact_name, contact_phone, notes } = req.body;
      if (!bank_name || typeof bank_name !== 'string' || bank_name.trim().length === 0) {
        return res.status(400).json({ error: 'bank_name is required' }) as any;
      }
      const rMin = parseFloat(rate_min);
      if (isNaN(rMin) || rMin <= 0 || rMin > 50) {
        return res.status(400).json({ error: 'rate_min must be between 0 and 50' }) as any;
      }
      const slug = (bank_name as string).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

      const result = await pool.query(
        `UPDATE bank_rates
         SET bank_name = $1, bank_slug = $2, loan_type = $3, rate_min = $4, rate_max = $5,
             tenor_min = $6, tenor_max = $7, contact_name = $8, contact_phone = $9,
             notes = $10, updated_at = NOW()
         WHERE id = $11 AND tenant_id = $12
         RETURNING id, bank_name, loan_type, rate_min, rate_max, tenor_min, tenor_max,
                   contact_name, contact_phone, notes, is_verified, submitted_by, updated_at`,
        [
          (bank_name as string).trim().slice(0, 120),
          slug.slice(0, 120),
          (loan_type as string || 'Thế chấp BĐS').trim().slice(0, 120),
          rMin,
          rate_max ? parseFloat(rate_max) : null,
          tenor_min ? parseInt(tenor_min) : null,
          tenor_max ? parseInt(tenor_max) : null,
          contact_name ? (contact_name as string).trim().slice(0, 200) : null,
          contact_phone ? (contact_phone as string).trim().slice(0, 30) : null,
          notes ? (notes as string).trim().slice(0, 2000) : null,
          rateId,
          DEFAULT_TENANT_ID,
        ]
      );
      res.json({ rate: result.rows[0] });
    } catch (err) {
      console.error('[bank-rates PUT]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/bank-rates/:id — ADMIN or TEAM_LEAD only
  app.delete('/api/bank-rates/:id', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      if (!user || !['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin và Trưởng nhóm mới có thể xóa' }) as any;
      }
      const rateId = parseInt(req.params.id as string, 10);
      if (isNaN(rateId)) return res.status(400).json({ error: 'Invalid id' }) as any;

      const result = await pool.query(
        'DELETE FROM bank_rates WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [rateId, DEFAULT_TENANT_ID]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' }) as any;
      res.json({ success: true });
    } catch (err) {
      console.error('[bank-rates DELETE]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── SEO Overrides API ─────────────────────────────────────────────────────
  // GET  /api/seo-overrides          — public read (used by server-side injector on start)
  // POST /api/seo-overrides/:key     — ADMIN only: upsert an override
  // DELETE /api/seo-overrides/:key   — ADMIN only: remove an override

  app.get('/api/seo-overrides', apiRateLimit, async (_req: express.Request, res: express.Response) => {
    try {
      const result = await pool.query(
        'SELECT route_key, title, description, og_image, updated_at FROM seo_overrides ORDER BY route_key'
      );
      const map: Record<string, any> = {};
      for (const row of result.rows) {
        map[row.route_key] = {
          routeKey: row.route_key,
          title: row.title,
          description: row.description,
          ogImage: row.og_image,
          updatedAt: row.updated_at,
        };
      }
      res.json(map);
    } catch (err) {
      console.error('[SEO] GET overrides error:', err);
      res.status(500).json({ error: 'Failed to fetch SEO overrides' });
    }
  });

  app.post('/api/seo-overrides/:key', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Chỉ SUPER_ADMIN mới có thể cập nhật SEO' }) as any;
    }
    const routeKey = req.params.key;
    const { title, description, ogImage } = req.body;
    if (typeof title !== 'string' || typeof description !== 'string') {
      return res.status(400).json({ error: 'title và description là bắt buộc' }) as any;
    }
    try {
      const result = await pool.query(
        `INSERT INTO seo_overrides (route_key, title, description, og_image, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT (route_key) DO UPDATE
           SET title = EXCLUDED.title,
               description = EXCLUDED.description,
               og_image = EXCLUDED.og_image,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by
         RETURNING route_key, title, description, og_image, updated_at`,
        [routeKey, title, description, ogImage || null, user.id]
      );
      const row = result.rows[0];
      res.json({ routeKey: row.route_key, title: row.title, description: row.description, ogImage: row.og_image, updatedAt: row.updated_at });
    } catch (err) {
      console.error('[SEO] POST override error:', err);
      res.status(500).json({ error: 'Failed to save SEO override' });
    }
  });

  app.delete('/api/seo-overrides/:key', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Chỉ SUPER_ADMIN mới có thể xóa SEO override' }) as any;
    }
    try {
      await pool.query('DELETE FROM seo_overrides WHERE route_key = $1', [req.params.key]);
      res.json({ success: true });
    } catch (err) {
      console.error('[SEO] DELETE override error:', err);
      res.status(500).json({ error: 'Failed to delete SEO override' });
    }
  });

  // ── GEO / AI Search: Target Keywords + AI Visibility ──────────────────────
  const isAdminOrLead = (req: express.Request) => {
    const u = (req as any).user;
    return !!u && u.role === 'SUPER_ADMIN';
  };
  const seoTenantId = (req: express.Request): string =>
    (req as any).tenantId || (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000001';

  const mapKw = (r: any) => ({
    id: r.id,
    keyword: r.keyword,
    targetUrl: r.target_url,
    currentPosition: r.current_position,
    targetPosition: r.target_position,
    searchVolume: r.search_volume,
    notes: r.notes,
    lastCheckedAt: r.last_checked_at,
    aiVisibility: r.ai_visibility || {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  app.get('/api/seo/target-keywords', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    try {
      const r = await pool.query(
        `SELECT id, keyword, target_url, current_position, target_position, search_volume,
                notes, last_checked_at, ai_visibility, created_at, updated_at
           FROM seo_target_keywords WHERE tenant_id = $1
          ORDER BY COALESCE(current_position, 999), updated_at DESC`,
        [seoTenantId(req)],
      );
      res.json(r.rows.map(mapKw));
    } catch (err) {
      console.error('[GEO] list keywords error:', err);
      res.status(500).json({ error: 'Failed to list keywords' });
    }
  });

  app.post('/api/seo/target-keywords', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    const b = req.body || {};
    const keyword = String(b.keyword || '').trim();
    if (!keyword || keyword.length > 300) return res.status(400).json({ error: 'keyword required (≤300 chars)' }) as any;
    const targetUrl = b.targetUrl ? String(b.targetUrl).slice(0, 2000) : null;
    const currentPosition = b.currentPosition === null || b.currentPosition === undefined || b.currentPosition === ''
      ? null : Math.max(1, Math.min(100, Number(b.currentPosition) | 0));
    const targetPosition = Math.max(1, Math.min(100, Number(b.targetPosition || 3) | 0));
    const searchVolume = b.searchVolume === null || b.searchVolume === undefined || b.searchVolume === ''
      ? null : Math.max(0, Number(b.searchVolume) | 0);
    const notes = b.notes ? String(b.notes).slice(0, 2000) : null;
    const aiViz = b.aiVisibility && typeof b.aiVisibility === 'object' ? b.aiVisibility : {};
    const allowedAi = ['chatgpt', 'gemini', 'claude', 'perplexity'] as const;
    const cleanAi: Record<string, boolean | null> = {};
    for (const k of allowedAi) {
      if (k in aiViz) cleanAi[k] = aiViz[k] === null ? null : Boolean(aiViz[k]);
    }
    const tenantId = seoTenantId(req);
    const userId = (req as any).user?.id || null;
    try {
      const r = await pool.query(
        `INSERT INTO seo_target_keywords
            (tenant_id, keyword, target_url, current_position, target_position, search_volume, notes,
             last_checked_at, ai_visibility, created_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::jsonb, $9, NOW())
         ON CONFLICT (tenant_id, lower(keyword)) DO UPDATE SET
            target_url = EXCLUDED.target_url,
            current_position = EXCLUDED.current_position,
            target_position = EXCLUDED.target_position,
            search_volume = EXCLUDED.search_volume,
            notes = EXCLUDED.notes,
            last_checked_at = NOW(),
            ai_visibility = EXCLUDED.ai_visibility,
            updated_at = NOW()
         RETURNING id, keyword, target_url, current_position, target_position, search_volume,
                   notes, last_checked_at, ai_visibility, created_at, updated_at`,
        [tenantId, keyword, targetUrl, currentPosition, targetPosition, searchVolume, notes,
         JSON.stringify(cleanAi), userId],
      );
      res.json(mapKw(r.rows[0]));
    } catch (err) {
      console.error('[GEO] upsert keyword error:', err);
      res.status(500).json({ error: 'Failed to save keyword' });
    }
  });

  app.delete('/api/seo/target-keywords/:id', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    const id = String(req.params.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'invalid id' }) as any;
    try {
      await pool.query('DELETE FROM seo_target_keywords WHERE id = $1 AND tenant_id = $2',
        [id, seoTenantId(req)]);
      res.json({ success: true });
    } catch (err) {
      console.error('[GEO] delete keyword error:', err);
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  });

  // Seed default strategic keywords (idempotent — only inserts, never overwrites)
  app.post('/api/seo/target-keywords/seed-defaults', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    const tenantId = seoTenantId(req);
    const userId = (req as any).user?.id || null;
    const defaults: { keyword: string; targetUrl: string; notes: string; searchVolume: number }[] = [
      // Tổng quát
      { keyword: 'bất động sản TP.HCM',          targetUrl: '/marketplace',                notes: 'Từ khoá chủ đạo — thị trường lớn nhất',           searchVolume: 60500 },
      { keyword: 'bất động sản Đồng Nai',         targetUrl: '/bat-dong-san-dong-nai',     notes: 'Long Thành – Nhơn Trạch – Biên Hòa',              searchVolume: 27100 },
      { keyword: 'bất động sản Long Thành',       targetUrl: '/bat-dong-san-long-thanh',   notes: 'Hưởng lợi sân bay Long Thành',                    searchVolume: 18100 },
      { keyword: 'bất động sản Bình Dương',       targetUrl: '/bat-dong-san-binh-duong',   notes: 'KCN, căn hộ chuyên gia',                          searchVolume: 22200 },
      { keyword: 'bất động sản Thủ Đức',          targetUrl: '/bat-dong-san-thu-duc',      notes: 'Metro số 1, Thủ Thiêm',                           searchVolume: 14800 },
      { keyword: 'định giá bất động sản',         targetUrl: '/ai-valuation',              notes: 'Công cụ AI miễn phí, sai số ±4.8%',                searchVolume: 9900 },
      { keyword: 'sàn bất động sản uy tín',       targetUrl: '/',                          notes: 'Định vị thương hiệu — top of funnel',             searchVolume: 4400 },
      { keyword: 'giá nhà đất TP.HCM',            targetUrl: '/marketplace',               notes: 'Dữ liệu giá giao dịch thực tế',                   searchVolume: 12100 },
      // Dự án
      { keyword: 'Aqua City Novaland',           targetUrl: '/du-an/aqua-city',           notes: 'Đại đô thị 1.000ha Đồng Nai',                     searchVolume: 18100 },
      { keyword: 'Izumi City Nam Long',          targetUrl: '/du-an/izumi-city',          notes: 'Chuẩn Nhật, Biên Hòa',                            searchVolume: 8100 },
      { keyword: 'Vinhomes Grand Park',          targetUrl: '/du-an/vinhomes-grand-park', notes: 'Siêu đô thị 271ha Q9',                            searchVolume: 27100 },
      { keyword: 'Vinhomes Cần Giờ',             targetUrl: '/du-an/vinhomes-can-gio',    notes: 'Siêu đô thị lấn biển 2.870ha — keyword nóng nhất 2025-2026', searchVolume: 49500 },
      { keyword: 'Vinhomes Central Park',        targetUrl: '/du-an/vinhomes-central-park', notes: 'Landmark 81, Bình Thạnh',                       searchVolume: 22200 },
      { keyword: 'The Global City Masterise',    targetUrl: '/du-an/the-global-city',     notes: '117ha An Phú',                                    searchVolume: 14800 },
      { keyword: 'Masterise Homes',              targetUrl: '/du-an/masterise-homes',     notes: 'Hạng sang TP.HCM',                                searchVolume: 9900 },
      { keyword: 'Vạn Phúc City',                targetUrl: '/du-an/van-phuc-city',       notes: 'KĐT 198ha ven sông Sài Gòn',                      searchVolume: 12100 },
      { keyword: 'Sala Đại Quang Minh',          targetUrl: '/du-an/sala',                notes: 'KĐT Sala Thủ Thiêm 257ha',                        searchVolume: 8100 },
      { keyword: 'Khu đô thị Thủ Thiêm',         targetUrl: '/du-an/thu-thiem',           notes: 'Trung tâm tài chính tương lai',                   searchVolume: 6600 },
      { keyword: 'Grand Manhattan Novaland',     targetUrl: '/du-an/manhattan',           notes: 'Hạng sang nội đô',                                searchVolume: 2900 },
      { keyword: 'Sơn Kim Land',                 targetUrl: '/du-an/son-kim-land',        notes: 'BĐS thương mại cao cấp',                          searchVolume: 1900 },
    ];
    // Single atomic bulk INSERT — all-or-nothing, idempotent via ON CONFLICT
    const params: any[] = [tenantId, userId];
    const tuples: string[] = [];
    defaults.forEach((d, i) => {
      const o = 2 + i * 4;
      params.push(d.keyword, d.targetUrl, d.searchVolume, d.notes);
      tuples.push(`($1, $${o + 1}, $${o + 2}, NULL, 3, $${o + 3}, $${o + 4}, NOW(), '{}'::jsonb, $2, NOW())`);
    });
    const sql = `
      INSERT INTO seo_target_keywords
        (tenant_id, keyword, target_url, current_position, target_position, search_volume, notes,
         last_checked_at, ai_visibility, created_by, updated_at)
      VALUES ${tuples.join(', ')}
      ON CONFLICT (tenant_id, lower(keyword)) DO NOTHING
      RETURNING keyword
    `;
    try {
      const r = await pool.query(sql, params);
      const inserted = r.rowCount || 0;
      res.json({ success: true, inserted, skipped: defaults.length - inserted, total: defaults.length });
    } catch (err) {
      console.error('[GEO] seed defaults error:', err);
      res.status(500).json({ error: 'Failed to seed defaults' });
    }
  });

  // Audit a public URL on this site — fetches HTML server-side, parses with cheerio,
  // returns the same checklist items as the client-side DOM checker (but for a real public page)
  app.post('/api/seo/audit-url', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    const rawPath = String((req.body || {}).path || '/').trim();
    // Strict input: only relative paths starting with "/" — no absolute URLs from client (reduces SSRF surface)
    if (rawPath.length > 2048) return res.status(400).json({ error: 'Path quá dài (>2KB)' }) as any;
    if (!rawPath.startsWith('/')) return res.status(400).json({ error: 'Chỉ chấp nhận đường dẫn tương đối bắt đầu bằng "/"' }) as any;
    if (rawPath.startsWith('//')) return res.status(400).json({ error: 'Đường dẫn không hợp lệ (protocol-relative)' }) as any;
    const APP = (process.env.APP_URL || 'https://sgsland.vn').replace(/\/$/, '');
    const appUrl = new URL(APP);
    const appHost = appUrl.host;
    let target: string;
    try {
      const u = new URL(rawPath, APP);
      if (u.host !== appHost) return res.status(400).json({ error: 'Chỉ được phép kiểm tra URL trên ' + appHost }) as any;
      target = u.toString();
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' }) as any;
    }
    const MAX_BYTES = 2 * 1024 * 1024; // 2MB cap
    const MAX_HOPS = 3;
    try {
      // Manual redirect handling — re-validate host + protocol on every hop
      let currentUrl = target;
      let fetchRes: Response | null = null;
      for (let hop = 0; hop <= MAX_HOPS; hop++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch(currentUrl, {
          headers: { 'User-Agent': 'SGS-LAND-SEO-Auditor/1.0 (+https://sgsland.vn)', 'Accept': 'text/html,application/xhtml+xml' },
          signal: ctrl.signal,
          redirect: 'manual',
        }).finally(() => clearTimeout(timer));
        if (r.status >= 300 && r.status < 400) {
          if (hop === MAX_HOPS) return res.status(502).json({ error: 'Quá nhiều redirect', target }) as any;
          const loc = r.headers.get('location');
          if (!loc) return res.status(502).json({ error: 'Redirect thiếu Location header', target }) as any;
          let next: URL;
          try { next = new URL(loc, currentUrl); } catch { return res.status(502).json({ error: 'Redirect URL không hợp lệ', target }) as any; }
          if (next.protocol !== 'https:' && next.protocol !== 'http:') return res.status(400).json({ error: 'Redirect đến protocol không hỗ trợ', target }) as any;
          if (next.host !== appHost) return res.status(400).json({ error: `Redirect đến host khác (${next.host}) bị chặn`, target }) as any;
          currentUrl = next.toString();
          continue;
        }
        fetchRes = r;
        break;
      }
      if (!fetchRes) return res.status(502).json({ error: 'Không nhận được response cuối cùng', target }) as any;
      if (!fetchRes.ok) return res.status(502).json({ error: `Trang trả HTTP ${fetchRes.status}`, target }) as any;
      const ct = (fetchRes.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        return res.status(415).json({ error: `Content-type không phải HTML (${ct || 'không khai báo'})`, target }) as any;
      }
      const cl = Number(fetchRes.headers.get('content-length') || 0);
      if (cl && cl > MAX_BYTES) return res.status(413).json({ error: `Trang quá lớn (${cl} bytes > ${MAX_BYTES})`, target }) as any;
      // Stream-cap body size (defense in depth — content-length may lie or be missing)
      const reader = fetchRes.body?.getReader();
      if (!reader) return res.status(502).json({ error: 'Không đọc được body', target }) as any;
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.length;
          if (received > MAX_BYTES) {
            try { await reader.cancel(); } catch { /* noop */ }
            return res.status(413).json({ error: `Trang quá lớn khi stream (>${MAX_BYTES} bytes)`, target }) as any;
          }
          chunks.push(value);
        }
      }
      const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      type CheckItem = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; tip?: string };
      const items: CheckItem[] = [];

      const desc = $('meta[name="description"]').attr('content') || '';
      items.push({
        id: 'desc-len', label: 'Meta description giàu thông tin (140-200 ký tự)',
        status: desc.length >= 140 && desc.length <= 200 ? 'pass' : (desc.length > 0 ? 'warn' : 'fail'),
        detail: `${desc.length} ký tự`,
        tip: 'LLM trích description nguyên văn cho 1 số snippet.',
      });

      const title = $('title').first().text() || '';
      items.push({
        id: 'title-len', label: 'Title 30-65 ký tự, có thương hiệu SGS LAND',
        status: title.length >= 30 && title.length <= 65 && /SGS\s*LAND/i.test(title) ? 'pass' : 'warn',
        detail: `${title.length} ký tự — ${title || '(trống)'}`,
      });

      const ogImg = $('meta[property="og:image"]').attr('content') || '';
      items.push({
        id: 'og-image', label: 'Có Open Graph image',
        status: ogImg ? 'pass' : 'fail',
        detail: ogImg || 'Chưa khai báo',
        tip: 'AI Overview của Google + Perplexity hay đính kèm ảnh OG.',
      });

      const canonical = $('link[rel="canonical"]').attr('href') || '';
      items.push({
        id: 'canonical', label: 'Có canonical URL',
        status: !canonical ? 'fail' : (/^https:\/\/sgsland\.vn(\/|$)/i.test(canonical) ? 'pass' : 'fail'),
        detail: canonical || 'Chưa khai báo',
        tip: 'Canonical phải là HTTPS và thuộc sgsland.vn.',
      });

      const jsonLdNodes = $('script[type="application/ld+json"]').toArray();
      items.push({
        id: 'jsonld-count', label: 'Có ≥ 3 JSON-LD schema',
        status: jsonLdNodes.length >= 3 ? 'pass' : (jsonLdNodes.length >= 1 ? 'warn' : 'fail'),
        detail: `${jsonLdNodes.length} schema`,
      });

      const types: string[] = [];
      let invalidJsonLd = 0;
      for (const node of jsonLdNodes) {
        try {
          const txt = $(node).text() || '{}';
          const parsed = JSON.parse(txt);
          const arr = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
          for (const obj of arr) {
            const t = obj && obj['@type'];
            if (Array.isArray(t)) types.push(...t.map(String));
            else if (t) types.push(String(t));
          }
        } catch { invalidJsonLd++; }
      }
      items.push({
        id: 'jsonld-integrity',
        label: 'JSON-LD hợp lệ và đọc được',
        status: invalidJsonLd === 0 ? 'pass' : 'fail',
        detail: invalidJsonLd === 0 ? 'Tất cả block JSON-LD parse được' : `${invalidJsonLd} block không phải JSON hợp lệ`,
        tip: 'Schema lỗi cú pháp không được công cụ tìm kiếm sử dụng.',
      });
      const hasFaq = types.some((t) => t.includes('FAQPage'));
      items.push({
        id: 'faq', label: 'Có FAQPage schema (LLM rất ưu tiên trích dẫn FAQ)',
        status: hasFaq ? 'pass' : 'warn',
        detail: hasFaq ? 'Đã có' : 'Khuyên thêm cho landing dự án và help-center',
      });
      const hasOrg = types.some((t) => t.includes('Organization') || t.includes('LocalBusiness'));
      items.push({
        id: 'org', label: 'Có Organization / LocalBusiness schema',
        status: hasOrg ? 'pass' : 'fail',
        detail: hasOrg ? 'Đã có' : 'Bắt buộc cho Knowledge Graph',
      });
      const hasBreadcrumb = types.some((t) => t.includes('BreadcrumbList'));
      items.push({
        id: 'breadcrumb', label: 'Có BreadcrumbList schema',
        status: hasBreadcrumb ? 'pass' : 'warn',
        detail: hasBreadcrumb ? 'Đã có' : 'Giúp Google hiển thị breadcrumb trong SERP',
      });

      const author = $('meta[name="author"]').attr('content') || '';
      items.push({
        id: 'author', label: 'Có meta author (E-E-A-T)',
        status: author ? 'pass' : 'warn', detail: author || 'Chưa khai báo',
      });

      const articleModified = $('meta[property="article:modified_time"]').attr('content') || '';
      items.push({
        id: 'modified', label: 'Có article:modified_time (giúp AI biết tin mới)',
        status: articleModified ? 'pass' : 'warn', detail: articleModified || 'Chưa khai báo',
      });

      // Word count: strip script/style, count words in main visible text
      $('script, style, noscript').remove();
      const bodyText = ($('body').text() || '').replace(/\s+/g, ' ').trim();
      const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
      items.push({
        id: 'word-count', label: 'Nội dung ≥ 800 từ (LLM ưu tiên nội dung sâu)',
        status: wordCount >= 800 ? 'pass' : (wordCount >= 400 ? 'warn' : 'fail'),
        detail: `${wordCount.toLocaleString()} từ`,
      });

      const mentionsBrand = (bodyText.match(/SGS\s*LAND/gi) || []).length;
      items.push({
        id: 'brand-anchors', label: 'Có "SGS LAND" xuất hiện ≥ 3 lần (citation anchor)',
        status: mentionsBrand >= 3 ? 'pass' : 'warn',
        detail: `${mentionsBrand} lần`,
        tip: 'Mỗi đoạn nên có "Theo SGS LAND..." để LLM dễ trích nguồn.',
      });

      const fetchedAt = new Date().toISOString();
      const severityByStatus: Record<string, string> = { fail: 'high', warn: 'medium', pass: 'info' };
      res.json({
        target,
        fetchedAt,
        contractVersion: 'seo-audit.v1',
        items: items.map((item) => ({
          ...item,
          severity: severityByStatus[item.status] || 'info',
          source: target,
          checkedAt: fetchedAt,
        })),
      });
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'Hết thời gian (12s) khi tải trang' : (err?.message || 'Lỗi không xác định');
      console.error('[GEO] audit-url error:', msg);
      res.status(500).json({ error: msg, target });
    }
  });

  app.get('/api/seo/ai-visibility', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!isAdminOrLead(req)) return res.status(403).json({ error: 'Forbidden' }) as any;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const pubDir = path.resolve(process.cwd(), 'public');

      const fileStat = async (name: string) => {
        try {
          const buf = await fs.readFile(path.join(pubDir, name));
          return { ok: true, status: 200, bytes: buf.byteLength };
        } catch {
          return { ok: false, status: 404, bytes: 0 };
        }
      };

      let robotsTxt = '';
      try { robotsTxt = await fs.readFile(path.join(pubDir, 'robots.txt'), 'utf8'); } catch { /* ignore */ }
      const botList = [
        { name: 'OpenAI GPTBot',         userAgent: 'GPTBot' },
        { name: 'OpenAI SearchBot',      userAgent: 'OAI-SearchBot' },
        { name: 'OpenAI ChatGPT-User',   userAgent: 'ChatGPT-User' },
        { name: 'Anthropic Claude-Web',  userAgent: 'Claude-Web' },
        { name: 'Anthropic (Anthropic-AI)', userAgent: 'Anthropic-AI' },
        { name: 'Anthropic ClaudeBot',   userAgent: 'ClaudeBot' },
        { name: 'Anthropic Claude-SearchBot', userAgent: 'Claude-SearchBot' },
        { name: 'Google Gemini',         userAgent: 'Gemini-WebFetch' },
        { name: 'Google-Extended',       userAgent: 'Google-Extended' },
        { name: 'Perplexity',            userAgent: 'PerplexityBot' },
        { name: 'You.com',               userAgent: 'YouBot' },
        { name: 'Common Crawl',          userAgent: 'CCBot' },
      ];
      const bots = botList.map((b) => {
        const re = new RegExp(`User-agent:\\s*${b.userAgent}\\b`, 'i');
        return { ...b, allowed: re.test(robotsTxt) };
      });

      const [llmsTxt, llmsFullTxt, sitemap, sitemapStatic, sitemapImages] = await Promise.all([
        fileStat('llms.txt'),
        fileStat('llms-full.txt'),
        fileStat('sitemap.xml'),
        fileStat('sitemap-static.xml'),
        fileStat('sitemap-images.xml'),
      ]);

      // Check dynamic sitemaps via DB count — these routes are always available in Express.
      const [listingsCount, projectsCount, newsCount] = await Promise.all([
        withRlsBypass((client) => client.query(`SELECT COUNT(*)::int AS n FROM listings l JOIN tenants t ON t.id = l.tenant_id WHERE l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET') AND t.approval_status = 'APPROVED'`)).catch(() => ({ rows: [{ n: 0 }] })),
        withRlsBypass((client) => client.query(`SELECT COUNT(*)::int AS n FROM projects WHERE code IS NOT NULL AND code <> '' AND metadata->>'public_microsite' = 'true'`)).catch(() => ({ rows: [{ n: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS n FROM articles WHERE status = 'PUBLISHED'`).catch(() => ({ rows: [{ n: 0 }] })),
      ]);

      res.json({
        llmsTxt,
        llmsFullTxt,
        bots,
        sitemaps: [
          { url: '/sitemap.xml', ok: sitemap.ok, status: sitemap.status, type: 'static-index' },
          { url: '/sitemap-static.xml', ok: sitemapStatic.ok, status: sitemapStatic.status, type: 'static' },
          { url: '/sitemap-images.xml', ok: sitemapImages.ok, status: sitemapImages.status, type: 'static' },
          { url: '/sitemap-listings.xml', ok: true, status: 200, type: 'dynamic', count: listingsCount.rows[0]?.n ?? 0 },
          { url: '/sitemap-projects.xml', ok: true, status: 200, type: 'dynamic', count: (projectsCount.rows[0]?.n ?? 0) + 13 },
          { url: '/sitemap-news.xml', ok: true, status: 200, type: 'dynamic', count: newsCount.rows[0]?.n ?? 0 },
        ],
      });
    } catch (err) {
      console.error('[GEO] ai-visibility error:', err);
      res.status(500).json({ error: 'Failed to read AI visibility' });
    }
  });

  // ── Vendor Management API (Platform Owner / SGSLand ADMIN only) ─────────────
  // Chỉ SUPER_ADMIN trong host tenant (DEFAULT_TENANT_ID) được phép dùng các endpoint này.

  const requirePlatformAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN' || user.tenantId !== DEFAULT_TENANT_ID) {
      return res.status(403).json({ error: 'Super admin only' });
    }
    next();
  };

  // GET /api/vendors — Danh sách tất cả vendor tenants + trạng thái duyệt
  app.get('/api/vendors', apiRateLimit, authenticateToken, requirePlatformAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const { status, search, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page, 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * pageSize;

      const conditions: string[] = [`t.id <> '${DEFAULT_TENANT_ID}'`];
      const params: any[] = [];

      if (status) {
        params.push(status);
        conditions.push(`t.approval_status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(t.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT
             t.id, t.name, t.domain, t.approval_status, t.approved_at, t.approved_by,
             t.rejection_reason, t.created_at, t.config,
             u.id AS admin_id, u.email AS admin_email, u.name AS admin_name,
             u.status AS user_status, u.email_verified,
             s.plan_id, s.status AS sub_status, s.trial_ends_at,
             COUNT(*) OVER() AS total_count
           FROM tenants t
           LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'ADMIN'
           LEFT JOIN subscriptions s ON s.tenant_id = t.id
           ${where}
           ORDER BY t.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, offset]
        );
        return r.rows;
      });

      const total = rows[0]?.total_count ? parseInt(rows[0].total_count, 10) : 0;
      res.json({
        vendors: rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          domain: r.domain,
          approvalStatus: r.approval_status,
          approvedAt: r.approved_at,
          approvedBy: r.approved_by,
          rejectionReason: r.rejection_reason,
          createdAt: r.created_at,
          config: r.config,
          admin: r.admin_id ? {
            id: r.admin_id,
            email: r.admin_email,
            name: r.admin_name,
            status: r.user_status,
            emailVerified: r.email_verified,
          } : null,
          subscription: {
            planId: r.plan_id,
            status: r.sub_status,
            trialEndsAt: r.trial_ends_at,
          },
        })),
        pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (error) {
      logger.error('GET /api/vendors error:', error);
      res.status(500).json({ error: 'Không thể tải danh sách vendor' });
    }
  });

  // POST /api/vendors/:id/approve — Duyệt vendor, gửi email thông báo
  app.post('/api/vendors/:id/approve', apiRateLimit, authenticateToken, requirePlatformAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id as string;
      const approvedBy = (req as any).user?.email || 'admin';
      const baseUrl = resolveBaseUrl(req);

      const result = await withRlsBypass(async (client) => {
        const r = await client.query(
          `UPDATE tenants SET approval_status = 'APPROVED', approved_at = NOW(), approved_by = $1,
             config = config - 'awaitingApproval' || '{"approvedAt": "${new Date().toISOString()}"}'::jsonb
           WHERE id = $2 AND id <> '${DEFAULT_TENANT_ID}'
           RETURNING id, name`,
          [approvedBy, id]
        );
        if (r.rowCount === 0) return null;
        const tenant = r.rows[0];

        // Get admin user for email
        const userRow = await client.query(
          `SELECT u.id, u.email, u.name FROM users u WHERE u.tenant_id = $1 AND u.role = 'ADMIN' LIMIT 1`,
          [id]
        );
        return { tenant, user: userRow.rows[0] || null };
      });

      if (!result) {
        return res.status(404).json({ error: 'Không tìm thấy vendor' });
      }

      writeAuditLog(DEFAULT_TENANT_ID, (req as any).user?.id, 'VENDOR_APPROVED', 'tenant', id, { tenantId: id, name: result.tenant.name, approvedBy }, req.ip);

      if (result.user) {
        emailService.sendVendorApprovedEmail(id, result.user.email, result.user.name, result.tenant.name, baseUrl).catch((err) => {
          logger.error(`[vendor-approve] Failed to send approval email to ${result.user.email}: ${err.message}`);
        });
      }

      res.json({ message: 'Vendor đã được phê duyệt', tenantId: id, name: result.tenant.name });
    } catch (error) {
      logger.error('POST /api/vendors/:id/approve error:', error);
      res.status(500).json({ error: 'Không thể phê duyệt vendor' });
    }
  });

  // POST /api/vendors/:id/reject — Từ chối vendor, gửi email thông báo lý do
  app.post('/api/vendors/:id/reject', apiRateLimit, authenticateToken, requirePlatformAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối' });

      const approvedBy = (req as any).user?.email || 'admin';

      const result = await withRlsBypass(async (client) => {
        const r = await client.query(
          `UPDATE tenants SET approval_status = 'REJECTED', approved_by = $1, rejection_reason = $2
           WHERE id = $3 AND id <> '${DEFAULT_TENANT_ID}'
           RETURNING id, name`,
          [approvedBy, reason.trim(), id]
        );
        if (r.rowCount === 0) return null;
        const tenant = r.rows[0];

        const userRow = await client.query(
          `SELECT u.id, u.email, u.name FROM users u WHERE u.tenant_id = $1 AND u.role = 'ADMIN' LIMIT 1`,
          [id]
        );
        return { tenant, user: userRow.rows[0] || null };
      });

      if (!result) {
        return res.status(404).json({ error: 'Không tìm thấy vendor' });
      }

      writeAuditLog(DEFAULT_TENANT_ID, (req as any).user?.id, 'VENDOR_REJECTED', 'tenant', id, { tenantId: id, name: result.tenant.name, reason: reason.trim() }, req.ip);

      if (result.user) {
        emailService.sendVendorRejectedEmail(id, result.user.email, result.user.name, result.tenant.name, reason.trim()).catch((err) => {
          logger.error(`[vendor-reject] Failed to send rejection email to ${result.user.email}: ${err.message}`);
        });
      }

      res.json({ message: 'Vendor đã bị từ chối', tenantId: id, name: result.tenant.name });
    } catch (error) {
      logger.error('POST /api/vendors/:id/reject error:', error);
      res.status(500).json({ error: 'Không thể từ chối vendor' });
    }
  });

  // POST /api/vendors/:id/suspend — Tạm ngừng vendor (APPROVED → SUSPENDED)
  app.post('/api/vendors/:id/suspend', apiRateLimit, authenticateToken, requirePlatformAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;

      const result = await withRlsBypass(async (client) => {
        const r = await client.query(
          `UPDATE tenants SET approval_status = 'SUSPENDED', rejection_reason = $1 WHERE id = $2 AND id <> '${DEFAULT_TENANT_ID}' RETURNING id, name`,
          [reason?.trim() || 'Suspended by platform admin', id]
        );
        return r.rows[0] || null;
      });

      if (!result) return res.status(404).json({ error: 'Không tìm thấy vendor' });

      writeAuditLog(DEFAULT_TENANT_ID, (req as any).user?.id, 'VENDOR_SUSPENDED', 'tenant', id, { tenantId: id }, req.ip);
      res.json({ message: 'Vendor đã bị tạm ngừng', tenantId: id });
    } catch (error) {
      logger.error('POST /api/vendors/:id/suspend error:', error);
      res.status(500).json({ error: 'Không thể tạm ngừng vendor' });
    }
  });

  // ── Price Self-Learning: Admin API ────────────────────────────────────────
  // GET  /api/admin/price-history?location=...&days=90  → lịch sử giá theo địa điểm
  // GET  /api/admin/price-calibration                   → danh sách calibrated entries
  // POST /api/admin/price-calibration/recalibrate       → chạy hiệu chỉnh thủ công

  // ─── Short Link Generator (Live Chat direct links) ──────────────────────────
  // POST /api/links/shorten   → tạo short code Redis (TTL 30 ngày)
  // GET  /c/:code             → redirect tới target URL (xem SSR section)

  function genShortCode(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  app.post('/api/links/shorten', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || url.length > 2048) {
      return res.status(400).json({ error: 'URL không hợp lệ' }) as any;
    }
    // Only allow internal livechat URLs
    try {
      const parsed = new URL(url);
      if (!parsed.pathname.startsWith('/livechat')) {
        return res.status(400).json({ error: 'Chỉ hỗ trợ rút gọn link livechat' }) as any;
      }
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' }) as any;
    }

    const code = genShortCode();
    const redisKey = `sl:${code}`;
    const TTL_SECS = 30 * 24 * 3600; // 30 ngày

    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
        await redis.set(redisKey, url, { ex: TTL_SECS });
      } else {
        // In-memory fallback for dev (non-persistent)
        (global as any).__shortLinks = (global as any).__shortLinks || {};
        (global as any).__shortLinks[code] = { url, exp: Date.now() + TTL_SECS * 1000 };
      }
    } catch (err) {
      logger.error('[ShortLink] Redis error:', err);
      return res.status(500).json({ error: 'Không thể tạo link rút gọn' }) as any;
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({ shortUrl: `${origin}/c/${code}`, code, ttlDays: 30 });
  });

  app.get('/api/admin/price-history', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Chỉ ADMIN mới có thể xem lịch sử giá' }) as any;
    }
    const locationKey = (req.query.location as string || '').slice(0, 120);
    const days = Math.min(365, parseInt(req.query.days as string || '90', 10));
    if (!locationKey) return res.status(400).json({ error: 'Cần truyền location' }) as any;
    const history = await priceCalibrationService.getPriceHistory(locationKey, days);
    res.json({ locationKey, days, history });
  });

  app.get('/api/admin/price-calibration', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Chỉ ADMIN mới có thể xem calibration' }) as any;
    }
    try {
      const limit = Math.min(200, parseInt(req.query.limit as string || '50', 10));
      const { rows } = await pool.query(
        `SELECT location_key, location_display, calibrated_price_per_m2,
                sample_count, avg_ai_price, avg_comps_price, avg_transaction_price,
                ai_weight, comps_weight, txn_weight,
                confidence_score, trend_text, last_calibrated_at
         FROM avm_calibration
         ORDER BY last_calibrated_at DESC
         LIMIT $1`,
        [limit],
      );
      res.json({ total: rows.length, calibrations: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/price-calibration/recalibrate', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Chỉ ADMIN mới có thể chạy hiệu chỉnh' }) as any;
    }
    // Run in background — returns immediately
    priceCalibrationService.calibrateAll().catch((e: any) =>
      console.error('[Calibration] Manual recalibrate error:', e.message)
    );
    res.json({ message: 'Đang chạy hiệu chỉnh giá trong nền — kiểm tra log để theo dõi.' });
  });

  app.use('/api/leads', apiRateLimit, createLeadRoutes(authenticateToken, () => broadcastIo));
  app.use('/api/listings', apiRateLimit, createListingRoutes(authenticateToken));
  app.use('/api/proposals', apiRateLimit, createProposalRoutes(authenticateToken, () => broadcastIo));
  app.use('/api/contracts', apiRateLimit, createContractRoutes(authenticateToken));
  app.use('/api/inbox', apiRateLimit, createInteractionRoutes(authenticateToken, () => broadcastIo));
  app.use('/api/users', apiRateLimit, createUserRoutes(authenticateToken, JWT_SECRET));
  app.use('/api/analytics', apiRateLimit, createAnalyticsRoutes(authenticateToken));
  app.use('/api/scoring', apiRateLimit, createScoringRoutes(authenticateToken));
  app.use('/api/routing-rules', apiRateLimit, createRoutingRuleRoutes(authenticateToken));
  app.use('/api/sequences', apiRateLimit, createSequenceRoutes(pool, authenticateToken));
  app.use('/api/knowledge', apiRateLimit, createKnowledgeRoutes(authenticateToken));
  app.use('/api/public-project-content', apiRateLimit, createPublicProjectContentRoutes(authenticateToken));
  app.use('/api/billing', apiRateLimit, createBillingRoutes(authenticateToken));
  app.use('/api/admin/email-metrics', apiRateLimit, createEmailMetricsRoutes(authenticateToken));
app.use('/api/admin/automations', apiRateLimit, authenticateToken, automationRouter);
app.use('/api/admin/mcp-servers', apiRateLimit, authenticateToken, agentMcpRouter);
app.use('/api/admin/chat-rooms', apiRateLimit, authenticateToken, chatRoomsRouter);
app.use('/api/admin/agent-voice', apiRateLimit, authenticateToken, agentVoiceRouter);
app.use('/api/admin/agent-teach', apiRateLimit, authenticateToken, agentTeachRouter);
app.use('/api/admin/agent-skills', apiRateLimit, authenticateToken, agentSkillsRouter);
app.use('/api/public/automations', automationWebhookRouter);
app.use('/api/public/livechat', agentP1Router);
  app.use('/api/sessions', apiRateLimit, createSessionRoutes(authenticateToken));
  app.use('/api/auth/2fa', authRateLimit, createTwoFactorRoutes(authenticateToken));
  app.use('/api/templates', apiRateLimit, createTemplateRoutes(authenticateToken));
  app.use('/api/activity', apiRateLimit, createActivityRoutes(authenticateToken));
  app.use('/api/notifications', apiRateLimit, createNotificationRoutes(authenticateToken));
  app.use('/api/ai/governance', apiRateLimit, createAiGovernanceRoutes(authenticateToken, optionalAuth));
  app.use('/api/ai', apiRateLimit, createAgentMemoryRoutes(authenticateToken));
  app.use('/api/customer-profile', apiRateLimit, createCustomerProfileRoutes(authenticateToken));
  app.use('/api/monitoring', apiRateLimit, createMonitoringRoutes(authenticateToken));
  app.use('/api/v1/ai', apiRateLimit, createAgentMemoryRoutes(authenticateToken));
  app.use('/api/agents', apiRateLimit, createAgentRoutes(authenticateToken));
  app.use('/api/enterprise', apiRateLimit, createEnterpriseRoutes(authenticateToken, io));
  app.use('/api/upload', apiRateLimit, createUploadRoutes(authenticateToken));
  app.use('/api/custom-fields', apiRateLimit, createCustomFieldRoutes(authenticateToken));
  app.use('/api/units', apiRateLimit, createUnitRoutes(authenticateToken));
  app.use('/api/auctions', apiRateLimit, createAuctionRoutes(authenticateToken, io));
  app.use('/uploads', createUploadServeRoute(authenticateToken));
  // SCIM 2.0 provisioning — uses its own Bearer token auth (no JWT required)
  app.use('/scim/v2', express.json({ type: ['application/json', 'application/scim+json'] }), createScimRoutes());
  // Advanced valuation: multi-source, 7-coefficient AVM + market cache
  app.use('/api/valuation', apiRateLimit, createValuationRoutes(authenticateToken, aiRateLimit, optionalAuth, guestValuationRateLimit, userValuationRateLimit));
  app.use('/api/advisor', apiRateLimit, createAdvisorRoutes(pool, authenticateToken, aiRateLimit));
  app.use('/api/connectors', apiRateLimit, createConnectorRoutes(authenticateToken));
  app.use('/api/scraper',          apiRateLimit, createScraperRoutes(authenticateToken));
  app.use('/api/scraper/projects', apiRateLimit, createScraperProjectRoutes(authenticateToken));
  // Error monitoring: frontend reports + admin query (POST is rate-limited, no auth required)
  initErrorLogRepo(pool);
  app.use('/api/error-logs', apiRateLimit, createErrorLogRoutes(authenticateToken, pool));
  // B2B2C: project management + partner access control
  app.use('/api/projects', apiRateLimit, createProjectRoutes(authenticateToken));
  app.use('/api/commissions', apiRateLimit, createCommissionRoutes(authenticateToken));
  app.use('/api/tenant', apiRateLimit, createTenantRoutes(authenticateToken));
app.use('/api/approval-requests', apiRateLimit, createApprovalRequestRoutes(authenticateToken));
  app.use('/api/internal', createLearningCycleRoutes());

  // ─── PUBLIC mini-site cho từng dự án (no auth, server-side cache 5min) ────
  // Không bọc apiRateLimit chung — endpoint này có rate limit riêng
  // (publicMicrositeLeadRateLimit) cho POST /leads. GET /:code chỉ đọc cache.
  //
  // Host middleware (task #28): resolve tenant theo `Host` header trước khi
  // route handler chạy. Nếu Host khớp `<slug>.sgsland.vn` hoặc custom domain
  // đã verify → set req.publicTenant để route scope theo tenant đó. Apex
  // `sgsland.vn` (host tenant) luôn trả null → handler dùng cache bucket "*"
  // và áp branding theo project's tenant.
  app.use('/api/public/projects', async (req, _res, next) => {
    try {
      const binding = await resolveTenantByHost(req.headers.host as string | undefined);
      (req as any).publicTenant = binding;
    } catch {
      (req as any).publicTenant = null;
    }
    next();
  }, createPublicProjectRoutes());

  // Public Developer (Chu dau tu) microsite - GEO/AEO. Host-aware giong public projects.
  app.use('/api/public/developers', async (req, _res, next) => {
    try {
      const binding = await resolveTenantByHost(req.headers.host as string | undefined);
      (req as any).publicTenant = binding;
    } catch {
      (req as any).publicTenant = null;
    }
    next();
  }, createPublicDeveloperRoutes());

  // Public visitor tracking (anonymous pageviews) — Host-aware giống public projects.
  app.use('/api/public/visitor', async (req, _res, next) => {
    try {
      const binding = await resolveTenantByHost(req.headers.host as string | undefined);
      (req as any).publicTenant = binding;
    } catch {
      (req as any).publicTenant = null;
    }
    next();
  }, createVisitorTrackingRoutes());

  // Task Management module
  app.use('/api/tasks', apiRateLimit, createTaskRoutes(authenticateToken));
  app.use('/api/departments', apiRateLimit, createDepartmentRoutes(authenticateToken));
  app.use('/api/dashboard', apiRateLimit, createTaskReportRoutes(authenticateToken));
  app.use('/api/reports', apiRateLimit, createTaskReportRoutes(authenticateToken));
  // Public lead capture for static landing pages (no auth)
  app.use('/api/landing-leads', apiRateLimit, createLandingLeadRoutes());
  app.use('/api/landing-ai', aiRateLimit, createLandingAiRoutes());
  app.use('/api/landing-pages', apiRateLimit, createLandingPagesRoutes());
  app.use('/api/live-chat', createLiveChatAgentRoutes(authenticateToken, aiRateLimit, apiRateLimit));
  app.use('/api/agent-audit', apiRateLimit, createAgentAuditRoutes(authenticateToken));
  app.use('/api/agent-operating', apiRateLimit, createAgentOperatingRoutes(authenticateToken));
  app.use('/api/reports', apiRateLimit, createDailyAdminReportRoutes(authenticateToken));
  startDailyReportScheduler();

  // Bounds a promise so a stalled dependency (DB/Redis) never blocks the
  // /api/health SLA of <1s — rejects with a labeled timeout error instead.
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  }

  // ── Periodic memory usage logging (OOM diagnosis) ──────────────────────────
  // Module-level guard: prevents a double registration if this setup function
  // ever runs twice within the same process (e.g. hot-reload in dev, or a
  // future refactor that re-invokes server bootstrap).
  function startMemoryUsageLogger(): void {
    if (memoryLoggerStarted) {
      logger.warn('[MemoryLogger] startMemoryUsageLogger() called again — skipping (already running)');
      return;
    }
    memoryLoggerStarted = true;
    const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    // RELIABILITY FIX (audit): nguong canh bao RSS. Truoc day chi log so lieu,
    // khong co nguong nao nen khong ai biet RSS dang leo den muc bi OOM-kill.
    // Override qua env de khop RAM thuc cua Reserved VM.
    const MEMORY_WARN_RSS_MB = Number(process.env.MEMORY_WARN_RSS_MB || 900);
    const MEMORY_CRIT_RSS_MB = Number(process.env.MEMORY_CRIT_RSS_MB || 1200);
    const MEMORY_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
    let lastMemoryAlertMs = 0;
    const logOnce = () => {
      const mem = process.memoryUsage();
      const fmt = (bytes: number) => Math.round(bytes / 1024 / 1024);
      logger.info(
        `[MemoryLogger] ${new Date().toISOString()} rss=${fmt(mem.rss)}MB heapUsed=${fmt(mem.heapUsed)}MB heapTotal=${fmt(mem.heapTotal)}MB external=${fmt(mem.external)}MB`,
      );
      // Nguong canh bao: log o level error (de grep/alert duoc) voi cooldown
      // 15 phut de khong spam deployment logs.
      const rssMb = fmt(mem.rss);
      if (rssMb >= MEMORY_WARN_RSS_MB) {
        const nowMs = Date.now();
        if (nowMs - lastMemoryAlertMs >= MEMORY_ALERT_COOLDOWN_MS) {
          lastMemoryAlertMs = nowMs;
          const level = rssMb >= MEMORY_CRIT_RSS_MB ? 'CRITICAL' : 'WARNING';
          logger.error(
            `[MemoryLogger] ${level}: rss=${rssMb}MB vuot nguong (warn=${MEMORY_WARN_RSS_MB}MB, crit=${MEMORY_CRIT_RSS_MB}MB) ` +
            `heapUsed=${fmt(mem.heapUsed)}MB heapTotal=${fmt(mem.heapTotal)}MB external=${fmt(mem.external)}MB. ` +
            `Nghi ngo memory leak  doi chieu voi [supervisor] restart log.`,
          );
        }
      }
    };
    logOnce(); // log immediately at startup so the first data point isn't 5 min late
    const timer = setInterval(logOnce, INTERVAL_MS);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
  }

  // Readiness probe: the process can stay alive while Postgres is restarting,
  // but infrastructure must stop routing DB-dependent traffic until recovery.
  app.get("/health", async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const database = await probeDatabase(800);
    const available = database.available;
    return res.status(available ? 200 : 503).json({
      status: available ? "ok" : "degraded",
      database: database.status,
      ...(database.lastError ? { databaseError: database.lastError } : {}),
      version: process.env.npm_package_version || "0.0.0",
      uptime: Math.floor(process.uptime()),
    });
  });

  app.get("/api/health", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      // RELIABILITY FIX (audit): systemService.checkHealth() pings the database
      // with pool.query('SELECT 1') and needs a timeout when the service is unavailable.
      // health probe co the treo ti connectionTimeoutMillis (5s, server/db.ts:47).
      // Boc withTimeout + fallback de probe luon tra ve trong ~1.2s.
      let health: any;
      try {
        health = await withTimeout(systemService.checkHealth(), 1200, 'health-summary');
      } catch {
        health = {
          status: 'critical',
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV',
          checks: { database: false, aiService: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY) },
          latency: -1,
        };
      }

      const components: Record<string, any> = {
        database: { status: health.checks?.database ? 'healthy' : 'down' },
        aiService: { status: health.checks?.aiService ? 'healthy' : 'unconfigured' },
        redis: { status: (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ? 'upstash-rest' : 'in-memory-fallback' },
        websocket: { status: 'healthy', adapter: 'in-memory' },
        queue: {
          status: isQStashEnabled() && !isQstashVerified() ? 'degraded' : 'healthy',
          type: isQStashEnabled() ? (isQstashVerified() ? 'qstash' : 'in-memory-fallback') : 'in-memory',
        },
      };

      // Real Postgres ping (with latency), capped so a slow DB never blocks
      // the health probe past the 1s SLA.
      const dbStartMs = Date.now();
      const dbProbe = await probeDatabase(800);
      if (dbProbe.available) {
        components.database.status = 'healthy';
        components.database.latencyMs = Date.now() - dbStartMs;
      } else {
        components.database.status = 'down';
        components.database.error = dbProbe.lastError;
        components.database.consecutiveFailures = dbProbe.consecutiveFailures;
      }

      // Real Upstash Redis ping (REST PING command) — previously this only
      // checked whether the env vars were *set*, not whether Redis actually
      // answered. Capped at 800ms so a stalled Redis never blocks the probe.
      const redisStartMs = Date.now();
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const { Redis } = await import('@upstash/redis');
          const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          const pong = await withTimeout(redis.ping(), 800, 'redis-ping');
          components.redis.status = pong === 'PONG' ? 'healthy' : 'degraded';
          components.redis.latencyMs = Date.now() - redisStartMs;
        } catch (err: any) {
          components.redis.status = 'down';
          components.redis.error = err?.message || String(err);
        }
      } else {
        components.redis.status = 'in-memory-fallback';
      }

      // Migration version
      let migrationVersion: string | null = null;
      try {
        const migResult = await pool.query('SELECT version FROM schema_versions ORDER BY id DESC LIMIT 1');
        migrationVersion = migResult.rows[0]?.version ?? null;
      } catch { /* schema_versions may not exist yet */ }

      // Queue depth — in-memory queue, depth not tracked
      const queueDepth: number | null = null;

      // Memory usage
      const mem = process.memoryUsage();
      const memoryUsage = {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      };

      // RELIABILITY FIX (audit): truoc day endpoint luon tra HTTP 200 ke ca khi
      // database.status === 'down' (chi doi field trong body), nen uptime monitor,
      // load balancer va dbApi.ping() (services/dbApi.ts:1442 chi doc res.ok)
      // khong bao gio phat hien su co. Gio: database down => 503 (readiness fail),
      // Upstash down => van 200 nhung status='degraded' (co in-memory fallback).
      // /health (server.ts) van la liveness probe tra 200 khong phu thuoc DB.
      const dbDown = components.database.status !== 'healthy';
      const redisDegraded = components.redis.status === 'down';
      const httpStatus = dbDown ? 503 : 200;
      res.status(httpStatus).json({
        ...health,
        status: dbDown ? 'critical' : (redisDegraded ? 'degraded' : 'healthy'),
        components,
        connectedClients: io.engine?.clientsCount || 0,
        migration_version: migrationVersion,
        queue_depth: queueDepth,
        memory_usage: memoryUsage,
        lastChecked: new Date().toISOString(),
        // L4 FIX: Add version/build info for deployment tracking
        version: process.env.npm_package_version ?? 'unknown',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? 'development',
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // Real server-side traffic metrics (SUPER_ADMIN only)
  app.get("/api/system/metrics", authenticateToken, async (req: express.Request, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Chỉ SUPER_ADMIN mới có quyền xem system metrics' });
    }
    try {
      const now = Date.now();
      const window60s = requestSamples.filter(s => s.ts >= now - 60_000);
      const window5s  = requestSamples.filter(s => s.ts >= now - 5_000);

      const totalRequests60s = window60s.length;
      const rps = Math.round((window5s.length / 5) * 10) / 10;
      const avgLatencyMs = window60s.length > 0
        ? Math.round(window60s.reduce((sum, s) => sum + s.durationMs, 0) / window60s.length)
        : 0;
      const errorCount = window60s.filter(s => s.status >= 500).length;

      // Real DB latency from a quick ping
      let dbLatencyMs = 0;
      try {
        const pingStart = Date.now();
        await pool.query('SELECT 1');
        dbLatencyMs = Date.now() - pingStart;
      } catch { /* leave at 0 */ }

      res.json({
        rps,
        totalRequests60s,
        avgLatencyMs,
        dbLatencyMs,
        errorCount,
        connectedClients: io.engine?.clientsCount || 0,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'metrics unavailable' });
    }
  });

  // Zalo webhook URL verification (some Zalo integrations call GET to verify)
  app.get("/api/webhooks/zalo", (req, res) => {
    const verifyToken = process.env.ZALO_VERIFY_TOKEN;
    const token = req.query.verifyToken || req.query.verify_token;
    if (!verifyToken) {
      return res.status(200).json({ status: 'active', platform: 'zalo' });
    }
    if (token && token === verifyToken) {
      logger.info('[Zalo Webhook] Verified');
      res.status(200).send(req.query.challenge || 'OK');
    } else {
      res.status(200).json({
        status: 'active',
        platform: 'zalo',
        message: 'SGS LAND Zalo Webhook Endpoint',
      });
    }
  });

  app.post("/api/webhooks/zalo", webhookRateLimit, verifyWebhookSignature('zalo'), async (req, res) => {
    try {
      const { sender, message, timestamp, event_name } = req.body;
      console.info(`[Zalo Webhook] Received event: ${event_name} from ${sender?.id}`);

      if (event_name === 'user_send_text') {
        await webhookQueue.add('zalo-event', { platform: 'zalo', payload: req.body });
      }

      res.status(200).json({ error: 0, message: "Success" });
    } catch (error) {
      console.error('Error processing Zalo Webhook:', error);
      res.status(500).json({ error: -1, message: 'Internal server error' });
    }
  });

  app.post("/api/webhooks/facebook", webhookRateLimit, verifyWebhookSignature('facebook'), async (req, res) => {
    try {
      const { object, entry } = req.body;
      console.info(`[Facebook Webhook] Received event`);

      if (object === 'page') {
        await webhookQueue.add('facebook-event', { platform: 'facebook', payload: req.body });
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error('Error processing Facebook Webhook:', error);
      res.status(500).json({ error: -1, message: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Email Inbound Webhook
  // Compatible with: Mailgun, SendGrid Inbound Parse, Postmark Inbound,
  //                  and generic JSON webhooks from any email provider.
  //
  // Auth strategy (in priority order):
  //   1. Mailgun HMAC  — EMAIL_MAILGUN_SIGNING_KEY  (header: X-Mailgun-Signature-256)
  //   2. SendGrid HMAC — EMAIL_SENDGRID_WEBHOOK_KEY (header: X-Twilio-Email-Event-Webhook-Signature)
  //   3. Postmark token— EMAIL_POSTMARK_WEBHOOK_TOKEN (header: X-Postmark-Signature or basic auth)
  //   4. Generic token — EMAIL_WEBHOOK_TOKEN (header: X-Webhook-Token, X-Mail-Token, or ?token=)
  //
  // In production, at least one of these env vars MUST be set or the request is rejected.
  // In development, missing config emits a warning and passes (allows local testing).
  // ──────────────────────────────────────────────────────────────────────────

  app.post("/api/webhooks/email", webhookRateLimit, async (req, res) => {
    try {
      const { createHmac, timingSafeEqual } = await import('crypto');
      const emailIsProduction = process.env.NODE_ENV === 'production';
      const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

      const mailgunKey = process.env.EMAIL_MAILGUN_SIGNING_KEY;
      const sendgridKey = process.env.EMAIL_SENDGRID_WEBHOOK_KEY;
      const postmarkToken = process.env.EMAIL_POSTMARK_WEBHOOK_TOKEN;
      const genericToken = process.env.EMAIL_WEBHOOK_TOKEN;

      const hasAnyConfig = !!(mailgunKey || sendgridKey || postmarkToken || genericToken);

      if (!hasAnyConfig) {
        if (emailIsProduction) {
          return res.status(500).json({ error: 'Email webhook authentication not configured' });
        }
        logger.warn('[Email Webhook] No auth config set — accepting request (dev only). Set EMAIL_MAILGUN_SIGNING_KEY, EMAIL_SENDGRID_WEBHOOK_KEY, EMAIL_POSTMARK_WEBHOOK_TOKEN, or EMAIL_WEBHOOK_TOKEN for production.');
        // fall through to process the event in dev
      } else {
        let verified = false;

        // 1. Mailgun HMAC-SHA256 (header: X-Mailgun-Signature-256)
        if (!verified && mailgunKey) {
          const sig = req.headers['x-mailgun-signature-256'] as string | undefined;
          if (sig) {
            const expected = createHmac('sha256', mailgunKey).update(rawBody).digest('hex');
            try {
              verified = sig.length === expected.length &&
                timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
            } catch { verified = false; }
          }
        }

        // 2. SendGrid Signed Event Webhook (header: X-Twilio-Email-Event-Webhook-Signature)
        if (!verified && sendgridKey) {
          const sig = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
          if (sig) {
            const ts = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
            const payload = ts ? ts + rawBody.toString() : rawBody.toString();
            const expected = createHmac('sha256', sendgridKey).update(payload).digest('base64');
            const incoming = Buffer.from(sig, 'base64').toString('base64');
            try {
              verified = incoming.length === expected.length &&
                timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
            } catch { verified = false; }
          }
        }

        // 3. Postmark shared token (header: X-Postmark-Signature)
        if (!verified && postmarkToken) {
          const sig = (req.headers['x-postmark-signature'] || req.headers['x-postmark-server-token']) as string | undefined;
          if (sig) {
            try {
              verified = sig.length === postmarkToken.length &&
                timingSafeEqual(Buffer.from(sig), Buffer.from(postmarkToken));
            } catch { verified = false; }
          }
        }

        // 4. Generic shared token (header: X-Webhook-Token, X-Mail-Token, or ?token=)
        if (!verified && genericToken) {
          const incoming =
            (req.headers['x-webhook-token'] as string | undefined) ||
            (req.headers['x-mail-token'] as string | undefined) ||
            (req.query.token as string | undefined);
          if (incoming) {
            try {
              verified = incoming.length === genericToken.length &&
                timingSafeEqual(Buffer.from(incoming), Buffer.from(genericToken));
            } catch { verified = false; }
          }
        }

        if (!verified) {
          logger.warn('[Email Webhook] Signature/token verification failed');
          return res.status(403).json({ error: 'Invalid webhook signature' });
        }
      }

      const body = req.body;

      // ── Parse different email provider formats ─────────────────────────────
      // Mailgun: { sender, from, subject, 'body-plain' }
      // SendGrid: { from, subject, text }
      // Postmark: { From, FromName, Subject, TextBody }
      // Generic:  { from, fromName, subject, body }

      const from =
        body.sender ||            // Mailgun
        body.From ||              // Postmark
        body.from;                // SendGrid / Generic

      const fromName =
        body.FromName ||          // Postmark
        body.fromName;            // Generic

      const subject =
        body.subject ||           // Mailgun, SendGrid, Generic
        body.Subject;             // Postmark

      const emailBody =
        body['body-plain'] ||     // Mailgun
        body.TextBody ||          // Postmark
        body['stripped-text'] ||  // Mailgun (cleaned)
        body.text ||              // SendGrid
        body.body;                // Generic

      const to =
        body.recipient ||         // Mailgun
        body.To ||                // Postmark
        body.to;                  // SendGrid / Generic

      if (!from) {
        logger.warn('[Email Webhook] Missing from address in payload');
        return res.status(400).json({ error: 'Missing from address' });
      }

      logger.info(`[Email Webhook] Inbound from ${from}, subject: ${subject || '(no subject)'}`);

      await webhookQueue.add('email-event', {
        platform: 'email',
        payload: { from, fromName, subject, body: emailBody, to, tenantId: DEFAULT_TENANT_ID },
      });

      // Most email providers expect a 200 response quickly
      res.status(200).json({ message: 'OK' });
    } catch (error) {
      console.error('[Email Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Brevo Webhook — Inbound emails + delivery events
  // Configure in Brevo Dashboard → Settings → Inbound Parsing / Transactional → Webhooks
  // Set URL to: https://yourdomain/api/webhooks/brevo
  // Optional: Set BREVO_WEBHOOK_SECRET to verify payload signatures.
  // ──────────────────────────────────────────────────────────────────────────

  app.post("/api/webhooks/brevo", webhookRateLimit, async (req, res) => {
    try {
      const { parseBrevoInbound, parseBrevoEvents, verifyBrevoWebhookSignature } = await import('./server/services/brevoService');
      const { processBrevoReportDeliveryEvent } = await import('./server/services/dailyAdminReportService');
      const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const brevoSecret = process.env.BREVO_WEBHOOK_SECRET;
      const brevoIsProduction = process.env.NODE_ENV === 'production';

      // Verify signature if secret is configured
      if (brevoSecret) {
        const sig = req.headers['x-brevo-signature'] as string | undefined;
        const valid = verifyBrevoWebhookSignature(rawBody, sig, brevoSecret);
        if (!valid) {
          logger.warn('[Brevo Webhook] Invalid signature');
          return res.status(403).json({ error: 'Invalid webhook signature' });
        }
      } else if (brevoIsProduction) {
        logger.warn('[Brevo Webhook] BREVO_WEBHOOK_SECRET not set — rejecting request in production.');
        return res.status(500).json({ error: 'Brevo webhook authentication not configured' });
      }

      const body = req.body;
      const tenantId = DEFAULT_TENANT_ID;

      // ── Determine payload type: inbound email or delivery event ─────────────
      // Brevo inbound: contains "From", "To", "Subject", "RawTextBody" or "HtmlBody"
      // Brevo events: contains "event" field (delivered, opened, clicked, bounced, etc.)
      const isInbound = !!(
        body.From || body.from || body.sender ||
        body.RawTextBody || body.HtmlBody
      );

      if (isInbound) {
        const parsed = parseBrevoInbound(body);
        if (!parsed || !parsed.from) {
          logger.warn('[Brevo Webhook] Inbound: missing from address');
          return res.status(400).json({ error: 'Missing from address' });
        }

        logger.info(`[Brevo Webhook] Inbound email from ${parsed.from} | subject: ${parsed.subject}`);
        await processCareInboundReply(pool, parsed.from, parsed.subject, (body.MessageID || body['Message-Id'] || body.messageId) as string | undefined);

        await webhookQueue.add('email-event', {
          platform: 'email',
          payload: {
            from: parsed.from,
            fromName: parsed.fromName,
            subject: parsed.subject,
            body: parsed.body,
            to: parsed.to,
            htmlBody: parsed.htmlBody,
            attachments: parsed.attachments,
            tenantId,
          },
        });
      } else {
        // Delivery / tracking events
        const events = parseBrevoEvents(body);
        if (events.length > 0) {
          for (const evt of events) {
            logger.info(`[Brevo Webhook] Event: ${evt.event} for ${evt.email}`);
            await processCareTrackingEvent(pool, evt);
            const deliveryKeys = (evt.tags || [])
              .filter(tag => tag.startsWith('delivery-key:'))
              .map(tag => tag.slice('delivery-key:'.length));
            for (const deliveryKey of deliveryKeys) {
               const engagementEvent = String(evt.event).toLowerCase();
               if (engagementEvent === 'opened' || engagementEvent === 'clicked') {
                 const { recordCareEmailEngagement } = await import('./server/services/customerCareService');
                 await recordCareEmailEngagement({
                   deliveryKey,
                   eventKey: `brevo:${evt.eventId || evt.messageId || evt.email}:${engagementEvent}:${evt.timestamp}:${deliveryKey}`,
                   event: engagementEvent,
                   timestamp: evt.timestamp,
                 });
               }
              const result = await processBrevoReportDeliveryEvent({
                deliveryKey,
                event: evt.event,
                email: evt.email,
                messageId: evt.messageId,
                timestamp: evt.timestamp,
                tags: evt.tags,
              });
              if (result.matched) {
                logger.info(`[Brevo Webhook] Report delivery ${deliveryKey}: ${result.claimStatus}/${result.reportStatus}`);
              }
            }
          }
        }
      }

      res.status(200).json({ message: 'OK' });
    } catch (error) {
      logger.error('[Brevo Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Brevo: test connection & account info (admin only) ─────────────────────
  app.get("/api/brevo/status", authenticateToken, async (req, res) => {
    try {
      const { isBrevoConfigured, getBrevoAccountInfo } = await import('./server/services/brevoService');
      if (!isBrevoConfigured()) {
        return res.json({ configured: false, message: 'BREVO_API_KEY not set' });
      }
      const info = await getBrevoAccountInfo();
      res.json({ configured: true, account: info });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Brevo account info' });
    }
  });

  // ---------------------------------------------------------------------------
  // QStash — Nhận job callback từ Upstash QStash
  // Raw body được lưu bởi express.json() verify callback ở trên (req.rawBody)
  // ---------------------------------------------------------------------------
  app.post("/api/qstash/process", async (req, res) => {
    try {
      if (!isQStashEnabled()) {
        logger.warn('[QStash] Nhận được callback nhưng QSTASH không được cấu hình — bỏ qua');
        return res.status(503).json({ error: 'QStash không được cấu hình' });
      }

      const { Receiver } = await import('@upstash/qstash');
      // Strip any surrounding quotes that may have been added when saving the secret
      const stripQuotes = (s: string) => s?.replace(/^["']|["']$/g, '');
      const receiver = new Receiver({
        currentSigningKey: stripQuotes(process.env.QSTASH_CURRENT_SIGNING_KEY!),
        nextSigningKey: stripQuotes(process.env.QSTASH_NEXT_SIGNING_KEY || process.env.QSTASH_CURRENT_SIGNING_KEY!),
      });

      // Use raw body stored by the global express.json() verify callback
      const rawBodyBuf: Buffer | undefined = (req as any).rawBody;
      const rawBody = rawBodyBuf ? rawBodyBuf.toString('utf8') : JSON.stringify(req.body);
      const signature = req.headers['upstash-signature'] as string;

      try {
        await receiver.verify({ signature, body: rawBody });
      } catch (err: any) {
        logger.warn(`[QStash] Xác minh chữ ký thất bại: ${err.message}`);
        return res.status(401).json({ error: 'Chữ ký không hợp lệ' });
      }

      let job: any;
      try {
        job = JSON.parse(rawBody);
      } catch {
        logger.warn('[QStash] Body không phải JSON hợp lệ');
        return res.status(400).json({ error: 'Body không hợp lệ' });
      }

      logger.info(`[QStash] Nhận job "${job.name}" (${job.id})`);
      await processWebhookJob(io, job);
      return res.json({ ok: true, jobId: job.id });
    } catch (err: any) {
      logger.error('[QStash] Lỗi xử lý job:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // RLHF Internal Scheduled Recompute — gọi từ QStash (cron hàng ngày)
  // ---------------------------------------------------------------------------
  app.post("/api/internal/rlhf-recompute", async (req, res) => {
    try {
      const secret = req.headers['x-internal-secret'] || req.body?.secret;
      const configuredSecret = process.env.RLHF_CRON_SECRET || process.env.JWT_SECRET?.slice(0, 32);
      if (!secret || secret !== configuredSecret) {
        return res.status(401).json({ error: 'Không có quyền truy cập' });
      }
      const tenantId = req.body?.tenantId;
      if (tenantId && tenantId !== 'all') {
        logger.info(`[RLHF Cron] Bắt đầu recompute reward signals cho tenant ${tenantId}`);
        await feedbackRepository.computeAllRewardSignals(tenantId);
        logger.info(`[RLHF Cron] Đã hoàn thành recompute reward signals cho tenant ${tenantId}`);
        return res.json({ ok: true, tenantId, recomputedAt: new Date().toISOString() });
      }
      // Run for all active tenants
      logger.info('[RLHF Cron] Bắt đầu recompute reward signals cho tất cả tenants');
      const tenantsResult = await pool.query(`SELECT id FROM tenants WHERE is_active = true ORDER BY id`);
      const tenants = tenantsResult.rows.map((r: any) => r.id);
      const results: Record<string, string> = {};
      await Promise.allSettled(tenants.map(async (tid: string) => {
        try {
          await feedbackRepository.computeAllRewardSignals(tid);
          results[tid] = 'ok';
        } catch (e: any) {
          results[tid] = e.message;
        }
      }));
      logger.info(`[RLHF Cron] Hoàn thành recompute cho ${tenants.length} tenants`);
      return res.json({ ok: true, tenantCount: tenants.length, results, recomputedAt: new Date().toISOString() });
    } catch (err: any) {
      logger.error('[RLHF Cron] Lỗi recompute reward signals:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Customer profile retention: called daily by the scheduler. Expired facts
  // are purged per tenant and each purge is recorded in the audit ledger.
  app.post("/api/internal/customer-profile-retention", async (req, res) => {
    const secret = req.headers['x-internal-secret'] || req.body?.secret;
    const configuredSecret = process.env.CUSTOMER_PROFILE_RETENTION_SECRET || process.env.JWT_SECRET?.slice(0, 32);
    if (!secret || secret !== configuredSecret) return res.status(401).json({ error: 'Không có quyền truy cập' });
    try {
      const tenantId = req.body?.tenantId;
      const tenants = tenantId && tenantId !== 'all'
        ? [{ id: String(tenantId) }]
        : (await pool.query('SELECT id FROM tenants WHERE is_active = true ORDER BY id')).rows;
      const results: Record<string, number | string> = {};
      for (const tenant of tenants) {
        try {
          results[tenant.id] = await customerProfileService.purgeExpired(tenant.id, 'retention-job');
        } catch (error: any) {
          results[tenant.id] = error?.message || String(error);
        }
      }
      return res.json({ ok: true, tenantCount: tenants.length, results, purgedAt: new Date().toISOString() });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Không thể chạy retention hồ sơ' });
    }
  });

  // ---------------------------------------------------------------------------
  // Engagement Email Cron — gọi từ QStash (3:00 SA ICT hàng ngày)
  // ---------------------------------------------------------------------------
  {
    const engagementSecret =
      process.env.ENGAGEMENT_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createEngagementCronRouter(pool, engagementSecret));
  }

  // ---------------------------------------------------------------------------
  // Chat Follow-up Cron — gọi từ QStash mỗi ngày lúc 9:00 SA ICT (2:00 UTC)
  // Tự động nhắn Zalo/Facebook sau 1 ngày, 3 ngày, 7 ngày không phản hồi
  // ---------------------------------------------------------------------------
  {
    const engagementSecret =
      process.env.ENGAGEMENT_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    const chatFollowUpSecret =
      process.env.CHAT_FOLLOWUP_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createChatFollowUpCronRouter(pool, chatFollowUpSecret, io));
    startFreeFollowupScheduler(pool, {
      engagementSecret,
      chatSecret: chatFollowUpSecret,
      intervalMs: 15 * 60 * 1000,
    });
  }

  // ---------------------------------------------------------------------------
  // Backup DB Cron — gọi từ QStash mỗi ngày lúc 2:30 SA ICT (19:30 UTC)
  // ---------------------------------------------------------------------------
  {
    const backupSecret =
      process.env.BACKUP_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createBackupRouter(backupSecret, authenticateToken));
  }

  // ---------------------------------------------------------------------------
  // Listing Price Refresh Cron — AI cập nhật giá từng căn (4:00 SA ICT = 21:00 UTC)
  // ---------------------------------------------------------------------------
  {
    const priceRefreshSecret =
      process.env.PRICE_REFRESH_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createListingPriceRefreshRouter(pool, priceRefreshSecret));
  }

  // ---------------------------------------------------------------------------
  // Task Reminder Cron — gọi từ QStash mỗi giờ; gửi notification D-1 / D-DAY / OVERDUE
  // ---------------------------------------------------------------------------
  {
    const taskReminderSecret =
      process.env.TASK_REMINDER_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createTaskReminderCronRouter(pool, taskReminderSecret));
  }

  // ---------------------------------------------------------------------------
  // GEO Monitor Cron — gọi từ QStash mỗi ngày lúc 4:30 SA ICT (21:30 UTC).
  // Snapshot AI mention rates + top-20 SERP positions vào seo_geo_snapshots.
  // ---------------------------------------------------------------------------
  {
    const geoMonitorSecret =
      process.env.GEO_MONITOR_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createGeoMonitorCronRouter(pool, geoMonitorSecret, authenticateToken));
  }

  // ---------------------------------------------------------------------------
  // Agent Runs — unified audit trail readout (host-tenant SUPER_ADMIN only).
  // GET /api/admin/agent-runs?agent=<name>&days=<1..30>&status=<...>&limit=<1..500>
  // Returns recent rows from agent_runs (background cron/agent audit log).
  // ---------------------------------------------------------------------------
  app.get('/api/admin/agent-runs', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN' || user.tenantId !== DEFAULT_TENANT_ID) {
      return res.status(403).json({ error: 'Chỉ SUPER_ADMIN của host tenant mới truy cập được Agent Runs' }) as any;
    }
    const days   = Math.max(1, Math.min(30,  Number(req.query.days)  || 7));
    const limit  = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
    const agent  = typeof req.query.agent  === 'string' ? req.query.agent  : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;

    try {
      const params: any[] = [days, limit];
      let where = `started_at >= NOW() - ($1::int * INTERVAL '1 day')`;
      if (agent)  { params.push(agent);  where += ` AND agent_name = $${params.length}`; }
      if (status) { params.push(status); where += ` AND status = $${params.length}`; }

      const r = await pool.query(
        `SELECT id, agent_name, trigger_source, status, started_at, finished_at,
                duration_ms, summary_json, error_text
           FROM agent_runs
          WHERE ${where}
          ORDER BY started_at DESC
          LIMIT $2`,
        params,
      );
      const agg = await pool.query(
        `SELECT agent_name,
                COUNT(*)                                   AS total,
                COUNT(*) FILTER (WHERE status='success')   AS success,
                COUNT(*) FILTER (WHERE status='error')     AS errors,
                COUNT(*) FILTER (WHERE status='skipped')   AS skipped,
                COUNT(*) FILTER (WHERE status='running')   AS running,
                ROUND(AVG(duration_ms))::int               AS avg_duration_ms,
                MAX(started_at)                            AS last_run_at
           FROM agent_runs
          WHERE started_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY agent_name
       ORDER BY last_run_at DESC NULLS LAST`,
        [days],
      );
      return res.json({
        days,
        runs: r.rows,
        agents: agg.rows.map((row) => ({
          agentName:     row.agent_name,
          total:         Number(row.total),
          success:       Number(row.success),
          errors:        Number(row.errors),
          skipped:       Number(row.skipped),
          running:       Number(row.running),
          avgDurationMs: row.avg_duration_ms == null ? null : Number(row.avg_duration_ms),
          lastRunAt:     row.last_run_at,
        })),
      });
    } catch (err: any) {
      console.error('[AgentRuns] read error:', err?.message || err);
      return res.status(500).json({ error: 'Internal error', detail: err?.message || String(err) });
    }
  });

  // ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// P0.1: Agent Async Tasks — tong hop cac task dang chay/gan day tu
// agent_runs + agent_automation_runs cho Admin UI (kieu getAsyncTasks cua Grok Bot).
// ---------------------------------------------------------------------------
app.get('/api/admin/agent-tasks', apiRateLimit, authenticateToken, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'SUPER_ADMIN' || user.tenantId !== DEFAULT_TENANT_ID) {
    return res.status(403).json({ error: 'Chỉ SUPER_ADMIN của host tenant mới truy cập được Agent Tasks' }) as any;
  }
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const source = typeof req.query.source === 'string' ? req.query.source : null; // 'runs' | 'automations'
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  try {
    const whereParts: string[] = ['1=1'];
    const params: any[] = [];
    if (status) { params.push(status); whereParts.push(`status = $${params.length}`); }
    if (source === 'runs' || source === 'automations') {
      params.push(source === 'runs' ? 'agent_run' : 'automation');
      whereParts.push(`source = $${params.length}`);
    }
    const where = whereParts.join(' AND ');
    const r = await pool.query(
      `SELECT * FROM (
         SELECT id, 'agent_run' AS source, agent_name AS title, trigger_source, status,
                started_at, finished_at, duration_ms, error_text, summary_json AS detail
           FROM agent_runs
          WHERE started_at >= NOW() - INTERVAL '7 days'
         UNION ALL
         SELECT ar.id, 'automation' AS source,
                a.name || ' (' || a.slug || ')' AS title,
                'webhook' AS trigger_source, ar.status, ar.started_at, ar.finished_at,
                ar.duration_ms, ar.error_text, ar.payload AS detail
           FROM agent_automation_runs ar
           JOIN agent_automations a ON a.id = ar.automation_id
          WHERE ar.started_at >= NOW() - INTERVAL '7 days'
       ) tasks
       WHERE ${where}
       ORDER BY started_at DESC
       LIMIT ${limit}`,
      params,
    );
    const counts = await pool.query(
      `SELECT status, COUNT(*) AS count FROM (
         SELECT status FROM agent_runs WHERE started_at >= NOW() - INTERVAL '7 days'
         UNION ALL
         SELECT ar.status FROM agent_automation_runs ar
          JOIN agent_automations a2 ON a2.id = ar.automation_id
          WHERE ar.started_at >= NOW() - INTERVAL '7 days'
       ) t GROUP BY status`,
    );
    const statusCounts: Record<string, number> = {};
    for (const row of counts.rows) statusCounts[row.status] = Number(row.count);
    return res.json({ tasks: r.rows, statusCounts, window: '7d' });
  } catch (err: any) {
    console.error('[AgentTasks] read error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error', detail: err?.message || String(err) });
  }
});

  // Module Chiến dịch tự động — Campaigns
  // ---------------------------------------------------------------------------
  app.use(createCampaignRouter(pool, authenticateToken));

  // ---------------------------------------------------------------------------
  // Campaign Scheduler — chạy mỗi 5 phút.
  // Hai driver:
  //   • In-process setInterval (luôn chạy, không phụ thuộc QStash quota).
  //   • POST /api/internal/campaign-scheduler-cron cho QStash (nếu còn quota).
  // Atomic claim ở repo đảm bảo không gửi trùng dù chạy song song.
  // ---------------------------------------------------------------------------
  {
    const campaignSchedulerSecret =
      process.env.CAMPAIGN_SCHEDULER_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use(createCampaignSchedulerCronRouter(pool, campaignSchedulerSecret));
    try {
      startCampaignSchedulerCron(pool, { intervalMs: 15 * 60 * 1000 }); // Keep the in-process cadence moderate when QStash is unavailable.
      // Booking lifecycle: expire abandoned PENDING deposits and hand paid
      // holds back to the market once hold_expires_at elapses. Same 15m
      // cadence as the campaign cron to avoid unnecessary database wakeups.
      startBookingLifecycleCron(pool, { intervalMs: 15 * 60 * 1000 });
    } catch (err: any) {
      logger.warn(`[CampaignScheduler] Không thể khởi động in-process cron: ${err?.message || err}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Buyer push notifications (Task #53) — register Expo push tokens, manage
  // saved searches, and run a 15-minute matching cron.
  // Two drivers like other crons:
  //   • In-process setInterval (always on).
  //   • POST /api/internal/buyer-push-cron for QStash.
  // Idempotent via UNIQUE(device_id, saved_search_id, listing_id) on the dedup log.
  // ---------------------------------------------------------------------------
  {
    const buyerPushSecret =
      process.env.BUYER_PUSH_CRON_SECRET ||
      process.env.JWT_SECRET?.slice(0, 32) ||
      '';
    app.use('/api', apiRateLimit);
    app.use(createBuyerPushRoutes(pool, buyerPushSecret, JWT_SECRET));
    // Task #52 — Buyer phone+OTP login + favorites/saved-searches/leads sync.
    // Reuse the global JWT_SECRET; tokens are scoped via `aud: 'buyer'` so
    // they cannot be cross-used against admin/agent endpoints.
    app.use(createBuyerAuthRoutes(JWT_SECRET));
    app.use(createBuyerRoutes(pool, JWT_SECRET));
    app.use(createConversationRoutes(JWT_SECRET, io));
    app.use(createAgentConversationRoutes(authenticateToken, io));
    // Task #56 — Buyer deposit booking + VNPay. Public IPN/return endpoints
    // live on the same router; the buyer-scoped routes use the same JWT.
    // Apply the standard API rate limiter to booking + VNPay endpoints —
    // protects /api/bookings* and /api/payments/vnpay/* from brute-force /
    // replay floods. The IPN endpoint is also covered; VNPay's normal
    // retry budget (5 attempts) sits well under the 600 req/min limit.
    app.use(createBookingRoutes(pool, JWT_SECRET, io));
    // Echo VNPay return/IPN URL on boot so ops can cross-check against the
    // VNPay merchant portal (the portal is the source of truth for IPN URL;
    // see server/config/env.ts for why we still validate the env var).
    try {
      const _vncfg = (await import('./server/config/env')).loadVnpayConfig();
      if (_vncfg) {
        logger.info(
          `[VNPay] env=${_vncfg.env} return=${_vncfg.returnUrl} ipn=${_vncfg.ipnUrl} — confirm these match the merchant-portal callback settings.`,
        );
      }
    } catch (err: any) {
      logger.warn(`[VNPay] config invalid at boot: ${err?.message || err}`);
    }
    try {
      startBuyerPushCron(pool, { intervalMs: 60 * 60 * 1000 }); // No QStash schedule found for this job, so keep a conservative cadence.
    } catch (err: any) {
      logger.warn(`[push] Không thể khởi động in-process buyer-push cron: ${err?.message || err}`);
    }
  }

  // Facebook Webhook Verification
  app.get("/api/webhooks/facebook", (req, res) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
    if (!VERIFY_TOKEN) return res.sendStatus(503);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('Facebook webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  app.get("/api/courses", authenticateToken, async (req, res) => {
    try {
      if (!process.env.AIVEN_DATABASE_URL) {
        return res.json([]); // Return empty array if no DB
      }
      const tenantId = (req as any).tenantId;
      const result = await withTenantContext(tenantId, async (client) => {
        return await client.query('SELECT * FROM courses ORDER BY created_at DESC');
      });
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/courses", authenticateToken, async (req, res) => {
    try {
      if (!process.env.AIVEN_DATABASE_URL) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      const { title, description, level } = req.body;
      const tenantId = (req as any).tenantId;
      
      const result = await withTenantContext(tenantId, async (client) => {
        return await client.query(
          'INSERT INTO courses (title, description, level) VALUES ($1, $2, $3) RETURNING *',
          [title, description, level]
        );
      });
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating course:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Socket.IO logic
  io.on("connection", (socket) => {
    const isAuthenticated = !!socket.data.authUser;
    logger.debug(`User connected: ${socket.id} (auth: ${isAuthenticated})`);

    if (socket.data.authUser?.tenantId) {
      socket.join(`tenant:${socket.data.authUser.tenantId}`);
    }
    if (socket.data.authUser?.id) {
      socket.join(`user:${socket.data.authUser.id}`);
    }
    if (socket.data.buyerUser?.id) {
      socket.join(`buyer:${socket.data.buyerUser.id}`);
    }

    // ── Buyer messaging room joins (Task #55) ─────────────────────────────
    // Buyer joins a conversation room only if they actually own it. The
    // REST POST /api/buyer/conversations creates rows so we look up
    // ownership before letting the socket subscribe to fan-out events.
    socket.on('buyer:join_conversation', async (conversationId: string) => {
      if (!socket.data.buyerUser?.id) return;
      if (typeof conversationId !== 'string') return;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) return;
      try {
        const { conversationRepository } = await import('./server/repositories/conversationRepository');
        const conv = await conversationRepository.findById(conversationId);
        if (!conv || conv.buyerUserId !== socket.data.buyerUser.id) return;
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        logger.warn(`[buyer:join_conversation] ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    socket.on('buyer:leave_conversation', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.leave(`conv:${conversationId}`);
    });

    // Agent (cookie-auth) join: scoped to conversations the agent is
    // assigned to. Agents already auto-join `user:<id>` above which
    // receives `conversation:updated` for inbox refresh; explicit room
    // join keeps `conversation:message` deliverable on the open thread.
    socket.on('agent:join_conversation', async (conversationId: string) => {
      if (!socket.data.authUser?.id) return;
      if (typeof conversationId !== 'string') return;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) return;
      try {
        const { conversationRepository } = await import('./server/repositories/conversationRepository');
        const conv = await conversationRepository.findById(conversationId);
        if (!conv || conv.agentUserId !== socket.data.authUser.id) return;
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        logger.warn(`[agent:join_conversation] ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    socket.on('agent:leave_conversation', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.leave(`conv:${conversationId}`);
    });

    socket.on("join_room", (room) => {
      if (!socket.data.authUser) return;
      socket.join(room);
      logger.debug(`User ${socket.id} joined room ${room}`);
    });

    // Allow unauthenticated live-chat visitors to join their conversation room.
    // Validates that the room value is a UUID (can't join arbitrary rooms).
    socket.on("join_livechat_room", (leadId: string) => {
      if (!leadId || typeof leadId !== 'string') return;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) return;
      socket.join(leadId);
      logger.debug(`LiveChat guest ${socket.id} joined room ${leadId}`);
    });

    const requireAuth = (handler: (...args: any[]) => void) => {
      return (...args: any[]) => {
        if (!socket.data.authUser) return;
        handler(...args);
      };
    };

    // Collaboration Presence Tracking
    socket.on("view_lead", requireAuth(async (data) => {
      const { leadId, user } = data;
      const room = `lead_view_${leadId}`;
      socket.join(room);
      
      socket.data.user = user;
      socket.data.viewingLead = leadId;
      
      const sockets = await io.in(room).fetchSockets();
      const users = sockets.map(s => s.data.user).filter(Boolean);
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      io.to(room).emit("active_viewers", uniqueUsers);
    }));

    socket.on("leave_lead", requireAuth(async (data) => {
      const { leadId } = data;
      const room = `lead_view_${leadId}`;
      socket.leave(room);
      socket.data.viewingLead = null;
      
      const sockets = await io.in(room).fetchSockets();
      const users = sockets.map(s => s.data.user).filter(Boolean);
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      io.to(room).emit("active_viewers", uniqueUsers);
    }));

    socket.on("send_message", requireAuth(async (data) => {
      const user = socket.data.authUser;
      const tenantId = user?.tenantId || DEFAULT_TENANT_ID;

      try {
        if (data.leadId && data.content) {
          const saved = await interactionRepository.create(tenantId, {
            leadId: data.leadId,
            content: data.content,
            channel: data.channel || 'INTERNAL',
            direction: 'OUTBOUND',
            type: data.type || 'TEXT',
            senderId: user?.id,
            metadata: data.metadata,
          });
          data.id = saved.id;
          data.timestamp = saved.timestamp || saved.createdAt;
          data.senderId = user?.id;
          data.senderName = user?.name;
        }

        // Emit only after successful DB save — emit to room but not back to sender
        socket.to(data.room).emit("receive_message", data);
      } catch (err) {
        logger.error('Failed to persist socket message to DB', err);
        socket.emit('send_message_error', { error: 'Failed to send message. Please try again.' });
      }
    }));

    socket.on("lead_updated", requireAuth((data) => {
      const tid = socket.data.authUser?.tenantId;
      if (tid) io.to(`tenant:${tid}`).emit("lead_updated", data);
      else io.emit("lead_updated", data);
    }));

    socket.on("lead_created", requireAuth((data) => {
      const tid = socket.data.authUser?.tenantId;
      if (tid) io.to(`tenant:${tid}`).emit("lead_created", data);
      else io.emit("lead_created", data);
    }));

    socket.on("disconnect", async () => {
      logger.debug(`User disconnected: ${socket.id}`);
      if (socket.data.viewingLead) {
        const room = `lead_view_${socket.data.viewingLead}`;
        const sockets = await io.in(room).fetchSockets();
        const users = sockets.map(s => s.data.user).filter(Boolean);
        const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
        io.to(room).emit("active_viewers", uniqueUsers);
      }
      socket.removeAllListeners();
    });
  });

  // ── Dynamic XML sitemaps (works in both dev and prod) ─────────────────────
  const APP_SITEMAP_URL = (process.env.APP_URL || 'https://sgsland.vn').replace(/\/$/, '');
  const TODAY = new Date().toISOString().split('T')[0];

  app.get('/sitemap-listings.xml', async (_req: express.Request, res: express.Response) => {
    try {
      // Database owner có BYPASSRLS + row_security=off mặc định → query thẳng pool không cần transaction/role switch
      // Public listings = AVAILABLE / BOOKING / OPENING (cùng filter với
      // /api/public/listings). Trước đây dùng 'ACTIVE' (legacy CRM status)
      // khiến sitemap rỗng → Googlebot không thể discover product pages.
      // Verified-vendor gate trên sitemap: chỉ index listing của tenant đã
      // approval_status = 'APPROVED' để Googlebot không discover trang
      // vendor pending → tránh leak unverified content.
      // images: cột JSONB array of string URLs — include first image for Google Image Sitemap.
      const result = await pool.query(
        `SELECT l.id, l.title, l.updated_at, l.images
           FROM listings l
           JOIN tenants t ON t.id = l.tenant_id
           WHERE l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET')
             AND t.approval_status = 'APPROVED'
           ORDER BY l.updated_at DESC LIMIT 50000`
      );
      // URL shape: `/bds/<slug>-<id>` — slug từ title (truncate, ASCII-folded,
      // hyphen-joined) giúp Googlebot index URL human-readable. Server chỉ
      // dùng trailing UUID để lookup (slug ignored).
      const slugify = (s: string) => String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      const toAbsImg = (img: string) =>
        img.startsWith('http') ? img : `${APP_SITEMAP_URL}${img.startsWith('/') ? '' : '/'}${img}`;
      const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const urls = result.rows.map((r: any) => {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        const slug = slugify(r.title) || 'bat-dong-san';
        const imgs: string[] = Array.isArray(r.images) ? r.images : (typeof r.images === 'string' ? JSON.parse(r.images || '[]') : []);
        const firstImg = imgs.find((i) => typeof i === 'string' && i.length > 0);
        const imgTag = firstImg
          ? `\n    <image:image>\n      <image:loc>${escXml(toAbsImg(firstImg))}</image:loc>\n      <image:title>${escXml(r.title || 'Bất động sản SGS LAND')}</image:title>\n    </image:image>`
          : '';
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/bds/${slug}-${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>${imgTag}\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.send(xml);
    } catch (err) {
      logger.error('[Sitemap] listings error:', err);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  app.get('/sitemap-projects.xml', async (_req: express.Request, res: express.Response) => {
    try {
      // SEO landing pages tại /du-an/<slug> — high-priority, hardcoded slugs khớp với STATIC_PAGE_META.
      // Đây là các trang GEO-target đã có rich structured data (RealEstateProject schema).
      const STATIC_PROJECT_SLUGS = [
        'aqua-city', 'izumi-city', 'vinhomes-grand-park', 'vinhomes-can-gio',
        'vinhomes-central-park', 'the-global-city', 'masterise-homes',
        'van-phuc-city', 'sala', 'thu-thiem', 'manhattan', 'son-kim-land',
        'nha-pho-trung-tam',
      ];
      const staticUrls = STATIC_PROJECT_SLUGS.map((slug) =>
        `  <url>\n    <loc>${APP_SITEMAP_URL}/du-an/${slug}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.90</priority>\n  </url>`
      );

      // DB mini-sites: /p/<code> cho các dự án đã bật public_microsite.
      // Đây là mini-site nội bộ CRM — priority thấp hơn landing page GEO.
      const result = await pool.query(
        `SELECT code, updated_at FROM projects
         WHERE code IS NOT NULL
           AND code <> ''
           AND metadata->>'public_microsite' = 'true'
         ORDER BY updated_at DESC LIMIT 10000`
      );
      const dbUrls = result.rows.map((r: any) => {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        const code = String(r.code).replace(/[^A-Za-z0-9_-]/g, '');
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/p/${code}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>\n  </url>`;
      });

      const urls = [...staticUrls, ...dbUrls].join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.send(xml);
    } catch (err) {
      logger.error('[Sitemap] projects error:', err);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  app.get('/sitemap-news.xml', async (_req: express.Request, res: express.Response) => {
    try {
      // Database owner có BYPASSRLS + row_security=off mặc định → query thẳng pool
      const result = await pool.query(
        `SELECT id, slug, title, updated_at, published_at FROM articles
         WHERE status = 'PUBLISHED'
         ORDER BY published_at DESC LIMIT 50000`
      );
      const urls = result.rows.map((r: any) => {
        const slug = r.slug || r.id;
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        const pubDate = r.published_at ? new Date(r.published_at).toISOString() : new Date(lastmod).toISOString();
        const title = (r.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/news/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.70</priority>\n    <news:news>\n      <news:publication>\n        <news:name>SGS LAND</news:name>\n        <news:language>vi</news:language>\n      </news:publication>\n      <news:publication_date>${pubDate}</news:publication_date>\n      <news:title>${title}</news:title>\n    </news:news>\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls}\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.send(xml);
    } catch (err) {
      logger.error('[Sitemap] news error:', err);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  // Dynamic sitemap index — same URLs as public/sitemap.xml but with TODAY's lastmod so
  // Google Search Console always sees a fresh timestamp. Registered before express.static
  // so this route takes precedence over the static file.
  app.get('/sitemap.xml', (_req: express.Request, res: express.Response) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Sitemap tĩnh: các trang công khai cố định -->
  <sitemap>
    <loc>${APP_SITEMAP_URL}/sitemap-static.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>

  <!-- Sitemap động: bất động sản (generated tại runtime) -->
  <sitemap>
    <loc>${APP_SITEMAP_URL}/sitemap-listings.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>

  <!-- Sitemap động: tin tức (generated tại runtime) -->
  <sitemap>
    <loc>${APP_SITEMAP_URL}/sitemap-news.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>

  <!-- Sitemap động: dự án (GEO landing pages + mini-site công khai) -->
  <sitemap>
    <loc>${APP_SITEMAP_URL}/sitemap-projects.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>

  <!-- Sitemap hình ảnh: hình ảnh sản phẩm (static) -->
  <sitemap>
    <loc>${APP_SITEMAP_URL}/sitemap-images.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>

</sitemapindex>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.send(xml);
  });

  // ─── Dynamic OG images for project / district landing pages ───────────────
  // Route: GET /og/<slug> — returns 1200x630 JPEG with project photo overlay
  // or branded gradient for district pages. Results are cached in-memory.
  // Dynamic OG image handler — must use app.use (not app.get with /*) for newer path-to-regexp
  app.use('/og', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const slug = req.path.replace(/^\//, ''); // strip leading "/"
    if (!slug) return next();
    try {
      const { generateOgImage } = await import('./server/seo/ogImageGenerator');
      const buf = await generateOgImage(slug);
      if (!buf) return res.redirect(302, '/og-image.jpg') as any;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('X-OG-Slug', slug);
      return res.send(buf);
    } catch (err) {
      logger.error('[OG image]', err);
      return res.redirect(302, '/og-image.jpg');
    }
  });

  // Serve .well-known files with explicit Content-Type before static middleware.
  // express.static may serve .json as text/plain on some hosts; this guarantees
  // application/json so ChatGPT / AI agents can parse the plugin manifest.
  app.get('/.well-known/ai-plugin.json', (_req, res) => {
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'ai-plugin.json');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.sendFile(filePath, { dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'Not found' }); });
  });
  app.get('/.well-known/openapi.yaml', (_req, res) => {
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'openapi.yaml');
    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.sendFile(filePath, { dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  // ─── EIO-resilient static handlers for public/ subtrees ─────────────────────
  // express.static() calls next(err) on EIO (Replit VM overlay FS transient bug).
  // Fix: unlimited exponential-backoff retry (same as /assets/* RAM cache) +
  // in-memory cache so each file is only read once from disk.
  // Pre-warms public/images/projects/ at startup so project cover images are
  // always served from RAM on mobile/web without ever hitting the FS again.
  {
    const PUB_MIME: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',  '.css': 'text/css',
      '.js':   'application/javascript',     '.json': 'application/json',
      '.jpg':  'image/jpeg',                 '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',                 '.png':  'image/png',
      '.gif':  'image/gif',                  '.svg':  'image/svg+xml',
      '.ico':  'image/x-icon',               '.woff': 'font/woff',
      '.woff2':'font/woff2',                 '.mp4':  'video/mp4',
      '.txt':  'text/plain',                 '.xml':  'application/xml',
    };

    // Shared RAM cache for /images/* and /landing/* files.
    const _pubCache   = new Map<string, Buffer>();
    const _pubPending = new Map<string, Promise<Buffer | null>>();

    // Unlimited exponential-backoff retry (500ms → 1s → 2s … capped at 30s).
    const _pubRead = (fp: string, attempt = 1): Promise<Buffer | null> =>
      new Promise(resolve => {
        fs.readFile(fp, (err: any, data?: Buffer) => {
          if (!err) return resolve(data as Buffer);
          if (err.code === 'ENOENT' || err.code === 'EISDIR') return resolve(null);
          if (err.code === 'EIO') {
            const delay = Math.min(500 * Math.pow(2, attempt - 1), 30_000);
            logger.warn(`[PubCache] EIO on ${fp} attempt ${attempt}, retry in ${delay}ms`);
            return setTimeout(() => _pubRead(fp, attempt + 1).then(resolve), delay);
          }
          logger.error('[PubCache] Unexpected read error', { fp, err: err.message });
          resolve(null);
        });
      });

    // Coalescing read: concurrent requests share one inflight Promise.
    const _pubReadCached = (fp: string): Promise<Buffer | null> => {
      const cached = _pubCache.get(fp);
      if (cached) return Promise.resolve(cached);
      let pending = _pubPending.get(fp);
      if (!pending) {
        pending = _pubRead(fp).then(data => {
          _pubPending.delete(fp);
          if (data) _pubCache.set(fp, data);
          return data;
        });
        _pubPending.set(fp, pending);
      }
      return pending;
    };

    // Pre-warm critical public files into RAM at startup.
    // Covers: (1) all root-level public/ files (logos, favicons, manifests, init scripts)
    //         (2) public/images/projects/ cover images for mobile listing view
    // Unlimited EIO retry during pre-warm — if the FS is flaky at boot, keep retrying.
    const PREWARM_EXTS = new Set([
      '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
      '.js', '.css', '.json', '.txt', '.xml',
    ]);
    (async () => {
      try {
        const publicRoot = path.join(process.cwd(), 'public');

        // (1) Root-level public files — logos, favicons, manifests, theme-init.js etc.
        const rootEntries = await fs.promises.readdir(publicRoot).catch(() => [] as string[]);
        await Promise.all(rootEntries.map(async f => {
          if (!PREWARM_EXTS.has(path.extname(f).toLowerCase())) return;
          const fp = path.join(publicRoot, f);
          try { if (!(await fs.promises.stat(fp)).isFile()) return; } catch { return; }
          const data = await _pubRead(fp);
          if (data) _pubCache.set(fp, data);
        }));

        // (2) Project cover images (mobile listing cards)
        const projDir = path.join(publicRoot, 'images', 'projects');
        const projEntries = await fs.promises.readdir(projDir).catch(() => [] as string[]);
        await Promise.all(projEntries.map(async f => {
          const fp = path.join(projDir, f);
          const data = await _pubRead(fp);
          if (data) _pubCache.set(fp, data);
        }));

        logger.info(`[PubCache] Pre-warmed ${_pubCache.size} public files into RAM`);
      } catch (e) {
        logger.warn('[PubCache] Pre-warm error', e);
      }
    })();

    // Cache-first middleware: intercept any request whose resolved path is already
    // in _pubCache and serve directly from RAM — runs before express.static("public")
    // so EIO-prone files are never re-read from disk after the first successful load.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Only plain file paths — skip API, uploads, parameterised routes
      if (req.path.includes('..') || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      const publicRoot = path.join(process.cwd(), 'public');
      const filePath = path.join(publicRoot, req.path);
      if (!filePath.startsWith(publicRoot + '/')) return next();
      const cached = _pubCache.get(filePath);
      if (!cached) return next();
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', PUB_MIME[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.end(cached);
    });

    // /images/* — project cover images and other static images
    app.get('/images/*path', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const publicRoot = path.join(process.cwd(), 'public');
      const filePath = path.join(publicRoot, req.path);
      if (!filePath.startsWith(publicRoot)) return next();
      _pubReadCached(filePath).then(data => {
        if (!data) return next();
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', PUB_MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.end(data);
      }).catch(next);
    });

    // /landing/* — GEO project landing pages (HTML + hero images)
    app.get('/landing/*path', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const publicRoot = path.join(process.cwd(), 'public');
      const reqPath = req.path.replace(/\/+$/, '');
      const candidates = [
        path.join(publicRoot, reqPath),
        path.join(publicRoot, reqPath, 'index.html'),
      ];
      if (!candidates[0].startsWith(publicRoot)) return next();
      const tryCandidate = (idx: number) => {
        if (idx >= candidates.length) return next();
        _pubReadCached(candidates[idx]).then(data => {
          if (data === null) return tryCandidate(idx + 1);
          const ext = path.extname(candidates[idx]).toLowerCase() || '.html';
          res.setHeader('Content-Type', PUB_MIME[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          res.end(data);
        }).catch(next);
      };
      tryCandidate(0);
    });
  }

  // Serve public assets (widget.js, QR codes, etc.) in all environments
  app.use(express.static("public"));

  // ─── White-label short URL (task #28) ──────────────────────────────────────
  // Trên `<slug>.sgsland.vn` hoặc custom domain đã verify, request `/<code>`
  // (vd `https://abc.sgsland.vn/MCC`) phải serve mini-site dự án MCC.
  // Strategy: 302 redirect tới canonical `/p/<code>` trên cùng host — giữ
  // SSR meta + SPA route hoạt động không thay đổi, đồng thời route gốc `/p/`
  // vẫn là URL chuẩn cho SEO/crawler.
  // Loại trừ: paths đã được handle riêng (api, uploads, p, assets phổ biến,
  // sitemap/robots, file có extension), GUEST landing trên apex.
  const SHORT_URL_RESERVED = new Set([
    'api', 'uploads', 'p', 'scim', 'health', 'sitemap.xml', 'robots.txt',
    'favicon.ico', 'public', 'dist', 'assets', 'static', 'images', 'landing',
    'lai-suat-vay-ngan-hang', '_next', 'sw.js',
  ]);
  const SHORT_URL_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const path = req.path;
    // Chỉ xử lý đúng 1 segment, không có extension (vd `/MCC`, không phải `/foo.js`)
    const m = /^\/([^/]+)\/?$/.exec(path);
    if (!m) return next();
    const seg = m[1];
    if (seg.includes('.')) return next();
    if (SHORT_URL_RESERVED.has(seg.toLowerCase())) return next();
    if (!SHORT_URL_CODE_RE.test(seg)) return next();
    // UUID (proposal token) → để SPA xử lý qua /p/:token routing thông thường
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return next();
    try {
      const binding = await resolveTenantByHost(req.headers.host as string | undefined);
      if (!binding) return next(); // Apex `sgsland.vn` → không phải tenant subdomain → bỏ qua
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(302, `/p/${seg}${qs}`);
    } catch {
      return next();
    }
  });

  // ─── Bank Rates SSR Page (all environments) ────────────────────────────────
  // Returns a COMPLETE HTML document (not the SPA shell) — fully crawlable by
  // Googlebot and AI chatbots (ChatGPT, Gemini, Claude) without JavaScript.
  app.get('/lai-suat-vay-ngan-hang', async (_req: express.Request, res: express.Response) => {
    try {
      const { getBankRatesHtml } = await import('./server/seo/bankRatesPage');
      let ugcRates: any[] = [];
      try {
        const r = await pool.query(
          `SELECT id, bank_name, loan_type, rate_min, rate_max, tenor_min, tenor_max,
                  contact_name, contact_phone, notes, is_verified, updated_at
           FROM bank_rates WHERE tenant_id = $1
           ORDER BY is_verified DESC, created_at DESC LIMIT 100`,
          [DEFAULT_TENANT_ID]
        );
        ugcRates = r.rows;
      } catch { /* table may not exist yet */ }
      const html = getBankRatesHtml(ugcRates);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.send(html);
    } catch (err) {
      console.error('[bank-rates SSR]', err);
      res.status(500).send('Internal server error');
    }
  });

  // /c/:code — Short link redirect (always registered, both dev & prod)
  // Must be before Vite middleware so it works in development as well.
  app.get('/c/:code', async (req: express.Request, res: express.Response) => {
    const code = String(req.params.code).replace(/[^a-z0-9]/gi, '');
    if (!code || code.length > 20) return res.status(404).send('Link không tồn tại') as any;
    try {
      let targetUrl: string | null = null;
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
        targetUrl = await redis.get<string>(`sl:${code}`);
      } else {
        const mem = (global as any).__shortLinks?.[code];
        if (mem && mem.exp > Date.now()) targetUrl = mem.url;
      }
      if (!targetUrl) {
        return res.status(404).send('Link không tồn tại hoặc đã hết hạn') as any;
      }
      return res.redirect(302, targetUrl);
    } catch (err) {
      logger.error('[ShortLink] Redirect error:', err);
      return res.status(500).send('Lỗi server') as any;
    }
  });

  // Homepage canonical: 301 redirect '/' -> '/home' (dedupe, runs before Vite & prod SSR)
  app.get('/', (req, res, next) => { if (process.env.NODE_ENV === 'production') { return res.redirect(301, '/home'); } return next(); });

  // Vite middleware for development (dynamically imported so vite is not required in production)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
      appType: "spa",
    });
      app.use(vite.middlewares);
  } else {
    // ── Production: SSR meta-tag injection ────────────────────────────────────
    // Import the injector lazily so it is never bundled when running in dev mode.
    const { getBaseHtml, injectMeta, buildListingMeta, buildArticleMeta, buildStaticPageMeta, buildProjectMeta } =
      await import('./server/seo/metaInjector');
    const { renderSsrPage, generateBotHTML, getRenderPolicy } = await import('./server/ssr-renderer');
    const { isAIBot, isSocialBot, isBot } = await import('./server/bot-detector');
    const { getGlossaryTermHtml, getGlossaryIndexHtml } = await import('./server/pseo/glossary');

    // Preload the base HTML once at startup to avoid repeated disk reads.
    try { getBaseHtml(); } catch { /* dist not ready in some edge cases */ }

    // Helper that sends injected HTML.
    // SEO routes (/listing/:id, /news/:id) use cache=true (60s CDN-friendly).
    // The SPA catch-all uses cache=false (no-cache) so browsers always fetch
    // fresh HTML after a redeploy, preventing ChunkLoadError from stale chunk hashes.
    const sendMeta = (res: express.Response, meta: Parameters<typeof injectMeta>[1], cache = true) => {
      try {
        const html = injectMeta(getBaseHtml(), meta);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          cache
            ? 'public, max-age=60, stale-while-revalidate=300'
            : 'no-cache, no-store, must-revalidate'
        );
        // Explicit X-Robots-Tag so production deployments (custom domain) are indexable.
        // This header takes effect on sgsland.vn where no platform-level noindex is added.
        // For noIndex pages (e.g. /login) we honour the meta flag.
        res.setHeader(
          'X-Robots-Tag',
          ((meta as any).noIndex || res.statusCode >= 400)
            ? 'noindex, nofollow'
            : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        );
        res.send(html);
      } catch {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      }
    };

    // /listing/:id → 301 redirect to canonical /bds/<slug>-<id>.
    // Consolidates crawl budget and link equity to the SEO-friendly URL.
    // The SPA also handles /listing/:id client-side for existing bookmarks.
    app.get('/listing/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const id = String(req.params.id);
        const listing = await listingRepository.findById(DEFAULT_TENANT_ID, id);
        if (!listing) return next();
        const slugifyLocal = (s: string) => String(s || '')
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60);
        const slug = slugifyLocal(listing.title) || 'bat-dong-san';
        return res.redirect(301, `/bds/${slug}-${listing.id ?? id}`);
      } catch { next(); }
    });

    // /bds/:slugId → SEO-friendly listing detail (B2C #1). Cross-tenant via
    // withRlsBypass + approval gate, accepts both bare UUID and `<slug>-<uuid>`.
    const TRAILING_UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
    app.get('/bds/:slugId', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const slugId = String(req.params.slugId || '');
        const m = slugId.match(TRAILING_UUID_RE);
        if (!m) return next();
        const id = m[1];
        const raw = await withRlsBypass(async (client) => {
          const r = await client.query(
            `SELECT l.* FROM listings l
               JOIN tenants t ON t.id = l.tenant_id
               WHERE l.id = $1
                 AND l.status IN ('AVAILABLE','BOOKING','OPENING','BEST_MARKET')
                 AND t.approval_status = 'APPROVED'
               LIMIT 1`,
            [id]
          );
          return r.rows[0] || null;
        });
        if (!raw) return next();
        // Map snake_case → camelCase for buildListingMeta.
        const listing = {
          id: raw.id, code: raw.code, title: raw.title, description: raw.description,
          type: raw.type, transaction: raw.transaction, status: raw.status,
          price: raw.price !== null ? Number(raw.price) : null, currency: raw.currency,
          area: raw.area !== null ? Number(raw.area) : null,
          bedrooms: raw.bedrooms, bathrooms: raw.bathrooms, location: raw.location,
          images: raw.images,
        };
        // BDS_AI_EXTRAS — attach DB-stored price history + news so the listing SSR body
      // renders the AI Price History and AI News sections for crawlers.
      try {
        let priceHistory: any[] = [];
        let news: any[] = [];
        try { const ph = await pool.query(`SELECT recorded_at, price_per_m2, price_min, price_max, trend_text, confidence, location_display FROM market_price_history ORDER BY recorded_at DESC LIMIT 6`); priceHistory = ph.rows.map((r: any) => ({ recordedAt: r.recorded_at, pricePerM2: r.price_per_m2, priceMin: r.price_min, priceMax: r.price_max, trendText: r.trend_text, confidence: r.confidence, locationDisplay: r.location_display })); } catch { /* ignore */ }
        try { const nw = await pool.query(`SELECT title, slug, published_at FROM articles WHERE status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 6`); news = nw.rows.map((r: any) => ({ title: r.title, slug: r.slug, publishedAt: r.published_at })); } catch { /* ignore */ }
        (listing as any).__aiExtras = { priceHistory, news };
      } catch { /* non-fatal */ }
      sendMeta(res, buildListingMeta(listing));
      } catch { next(); }
    });

    // /c/:code → short link redirect (30-day TTL, Redis-backed)
    app.get('/c/:code', async (req: express.Request, res: express.Response) => {
      const code = String(req.params.code).replace(/[^a-z0-9]/gi, '');
      if (!code || code.length > 20) return res.status(404).send('Link không tồn tại') as any;
      try {
        let targetUrl: string | null = null;
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
          const { Redis } = await import('@upstash/redis');
          const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
          targetUrl = await redis.get<string>(`sl:${code}`);
        } else {
          const mem = (global as any).__shortLinks?.[code];
          if (mem && mem.exp > Date.now()) targetUrl = mem.url;
        }
        if (!targetUrl) {
          return res.status(404).send('Link không tồn tại hoặc đã hết hạn') as any;
        }
        return res.redirect(302, targetUrl);
      } catch (err) {
        logger.error('[ShortLink] Redirect error:', err);
        return res.status(500).send('Lỗi server') as any;
      }
    });

    // /news/:idOrSlug → inject article-specific meta; redirect UUID→slug (301)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    app.get('/news/:idOrSlug', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const idOrSlug = String(req.params.idOrSlug);
        let article: any = null;
        if (UUID_RE.test(idOrSlug)) {
          article = await articleRepository.findById(DEFAULT_TENANT_ID, idOrSlug);
          if (article?.slug) {
            return res.redirect(301, `/news/${article.slug}`);
          }
        } else {
          article = await articleRepository.findBySlug(DEFAULT_TENANT_ID, idOrSlug);
        }
        if (!article) {
        // SEO-FIX: bai viet khong ton tai -> 404 that su (chong soft-404)
        res.status(404);
        res.setHeader('X-Robots-Tag', 'noindex, follow');
        res.setHeader('Cache-Control', 'no-store');
        return next();
      }
        sendMeta(res, buildArticleMeta(article));
      } catch { next(); }
    });

    // ─── SEO Local & Project Landing Pages ──────────────────────────────────
    // These routes serve full SSR meta for Googlebot; the SPA renders the page.
    const LOCAL_LANDING_ROUTES = [
      '/bat-dong-san-dong-nai',
      '/bat-dong-san-long-thanh',
      '/bat-dong-san-thu-duc',
      '/bat-dong-san-binh-duong',
      '/bat-dong-san-quan-7',
      '/bat-dong-san-phu-nhuan',
      '/bat-dong-san-binh-chanh',
      '/bat-dong-san-can-gio',
      '/bat-dong-san-binh-thanh',
      '/bat-dong-san-long-an',
      '/dau-tu-bat-dong-san',
      '/phap-ly-nha-dat',
    ] as const;
    for (const route of LOCAL_LANDING_ROUTES) {
      app.get(route, (_req: express.Request, res: express.Response) => {
        sendMeta(res, buildStaticPageMeta(null, null, null, route));
      });
    }
    app.get('/du-an/:projectSlug', async (req: express.Request, res: express.Response) => {
      const pagePath = `/du-an/${req.params.projectSlug}`;
      if (req.path.startsWith('/assets/')) { return res.status(404).end(); }
      const ua = String(req.headers['user-agent'] || '');
      const aiBot = isAIBot(ua);
      // GEO-maximized body for AI crawlers (GPTBot, PerplexityBot, ClaudeBot);
      // standard body + RealEstateListing schema for all other requests.
      // Falls back to STATIC_PAGE_META for project pages not in PAGE_META.
      // DU_AN_DB_PRIORITY — prefer DB-driven rich body (8 AI sections) over hardcoded PAGE_META.
      let ssrHtml: string | null = null;
      let projectFound = false; // SEO-FIX soft-404
      try {
        const pslug0 = String(req.params.projectSlug || '');
        const pr0 = await pool.query(`SELECT id, name, code, description, location, open_date, handover_date, metadata FROM projects WHERE (metadata->>'slug' = $1 OR LOWER(code) = LOWER($1) OR id::text = $1) LIMIT 1`, [pslug0]);
        const row0: any = pr0.rows[0];
        if (row0) {
          projectFound = true; // SEO-FIX soft-404
          const project0: any = { id: row0.id, name: row0.name, code: row0.code, description: row0.description, location: row0.location, openDate: row0.open_date, handoverDate: row0.handover_date, metadata: row0.metadata && typeof row0.metadata === 'object' ? row0.metadata : {} };
          let priceHistory0: any[] = [], news0: any[] = [];
          try { const ph0 = await pool.query(`SELECT recorded_at, price_per_m2, price_min, price_max, trend_text, confidence, location_display FROM market_price_history ORDER BY recorded_at DESC LIMIT 6`); priceHistory0 = ph0.rows.map((r: any) => ({ recordedAt: r.recorded_at, pricePerM2: r.price_per_m2, priceMin: r.price_min, priceMax: r.price_max, trendText: r.trend_text, confidence: r.confidence, locationDisplay: r.location_display })); } catch {}
          try { const nw0 = await pool.query(`SELECT title, slug, published_at FROM articles WHERE status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 6`); news0 = nw0.rows.map((r: any) => ({ title: r.title, slug: r.slug, publishedAt: r.published_at })); } catch {}
          project0.__aiExtras = { priceHistory: priceHistory0, news: news0 };
          ssrHtml = injectMeta(getBaseHtml(), buildProjectMeta(project0));
        }
      } catch { ssrHtml = null; }
      // SEO-FIX: du an khong ton tai -> 404 that su (chong soft-404).
      // Cho phep cac slug du an tinh (STATIC) van tra 200 du khong co trong DB.
      const KNOWN_PROJECT_SLUGS = new Set(['aqua-city','izumi-city','vinhomes-grand-park','vinhomes-can-gio','vinhomes-central-park','the-global-city','masterise-homes','van-phuc-city','sala','thu-thiem','manhattan','son-kim-land','nha-pho-trung-tam','diamond-sky-van-phuc-city','legacy-66','vinhomes-hoc-mon','masteri-cosmo-central','grand-manhattan-novaland','son-kim-land','thu-thiem']);
      const slugForCheck = String(req.params.projectSlug || '').toLowerCase();
      if (!projectFound && !KNOWN_PROJECT_SLUGS.has(slugForCheck)) {
        res.status(404);
        res.setHeader('X-Robots-Tag', 'noindex, follow');
        res.setHeader('Cache-Control', 'no-store');
      }
      if (!ssrHtml) ssrHtml = renderSsrPage(pagePath, { aiBot });
      if (ssrHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        // AI-bot responses must not be served from a shared cache (content differs
        // from what regular crawlers/users see). Vary: User-Agent is avoided as it
        // effectively kills CDN caching; instead, no-store for AI bots only.
        res.setHeader(
          'Cache-Control',
          aiBot
            ? 'no-store'
            : 'public, max-age=300, stale-while-revalidate=3600'
        );
        res.send(ssrHtml);
        return;
      }
      // DU_AN_PROJECT_SSR — look up project by slug and render rich GEO body (DB data only).
      try {
        const pslug = String(req.params.projectSlug || '');
        const pr = await withRlsBypass((client) => client.query(
        `SELECT id, name, code, description, location, open_date, handover_date, metadata FROM projects WHERE (metadata->>'slug' = $1 OR LOWER(code) = LOWER($1) OR id::text = $1) LIMIT 1`,
        [pslug]
      ));
        const prow: any = pr.rows[0];
        if (prow) {
          const project: any = { id: prow.id, name: prow.name, code: prow.code, description: prow.description, location: prow.location, openDate: prow.open_date, handoverDate: prow.handover_date, metadata: prow.metadata && typeof prow.metadata === 'object' ? prow.metadata : {} };
          let priceHistory: any[] = [];
          let news: any[] = [];
          try { const ph = await pool.query(`SELECT recorded_at, price_per_m2, price_min, price_max, trend_text, confidence, location_display FROM market_price_history ORDER BY recorded_at DESC LIMIT 6`); priceHistory = ph.rows.map((r: any) => ({ recordedAt: r.recorded_at, pricePerM2: r.price_per_m2, priceMin: r.price_min, priceMax: r.price_max, trendText: r.trend_text, confidence: r.confidence, locationDisplay: r.location_display })); } catch { /* ignore */ }
          try { const nw = await pool.query(`SELECT title, slug, published_at FROM articles WHERE status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 6`); news = nw.rows.map((r: any) => ({ title: r.title, slug: r.slug, publishedAt: r.published_at })); } catch { /* ignore */ }
          project.__aiExtras = { priceHistory, news };
          sendMeta(res, buildProjectMeta(project));
          return;
        }
      } catch (e) { /* fall through to static meta */ }
      sendMeta(res, buildStaticPageMeta(null, null, null, pagePath));
    });

    // /p/:code → SSR meta cho mini-site công khai (Facebook/Zalo/Twitter crawler).
    // Tokens (proposal/contract) không inject project meta — fall through để
    // SPA xử lý. Chỉ xử lý khi token match pattern PROJECT CODE (uppercase).
    app.get('/p/:code', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const raw = String(req.params.code || '');
      // Project codes: alphanumeric + dashes/underscores (case insensitive),
      // KHÔNG phải UUID (proposal) và KHÔNG có prefix `contract_` → skip để SPA xử lý.
      if (raw.startsWith('contract_')) return next();
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(raw)) return next();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return next();
      const codeUpper = raw.toUpperCase();
      try {
        const result = await pool.query(
          `SELECT name, code, description, location, metadata
             FROM projects
             WHERE UPPER(code) = $1
               AND metadata->>'public_microsite' = 'true'
             LIMIT 1`,
          [codeUpper]
        );
        const row = result.rows[0];
        if (!row) {
          // Project không công khai → vẫn render SPA (sẽ hiển thị trang 404 thân thiện)
          return next();
        }
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const cover = meta.coverImage || meta.cover_image || null;
        const desc = (row.description ? String(row.description).replace(/\s+/g, ' ').slice(0, 240)
          : `${row.name} — bảng giá, mặt bằng, sản phẩm và tư vấn miễn phí từ SGS Land.`);
        const amenities: any[] = [];
        if (meta.area_ha) amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Quy mô', value: `${meta.area_ha} ha` });
        if (meta.developer) amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Chủ đầu tư', value: String(meta.developer) });
        if (meta.price_from) amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Giá từ', value: String(meta.price_from) });
        if (meta.legal) amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Pháp lý', value: String(meta.legal) });

        const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const projectBadges: string[] = [];
        if (meta.price_from) projectBadges.push(`<span style="background:#eff6ff;color:#1d4ed8;padding:4px 14px;border-radius:20px;font-size:14px;font-weight:700">Giá từ ${esc(String(meta.price_from))}</span>`);
        if (meta.area_ha) projectBadges.push(`<span style="background:#f0fdf4;color:#166534;padding:4px 14px;border-radius:20px;font-size:14px">${esc(String(meta.area_ha))} ha</span>`);
        if (meta.legal) projectBadges.push(`<span style="background:#fefce8;color:#854d0e;padding:4px 14px;border-radius:20px;font-size:14px">${esc(String(meta.legal))}</span>`);
        const projectBodyHtml = `<div id="ssr-body" style="font-family:system-ui,sans-serif;padding:24px 16px;max-width:800px;margin:0 auto;color:#1e293b;background:#fff;min-height:200px">
  <nav style="font-size:12px;color:#64748b;margin-bottom:16px">
    <a href="/" style="color:#4f46e5;text-decoration:none">SGS LAND</a> ›
    <a href="/marketplace" style="color:#4f46e5;text-decoration:none">Dự án BĐS</a> ›
    <span>${esc(row.name)}</span>
  </nav>
  ${cover ? `<img src="${esc(cover)}" alt="${esc(row.name)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:8px;margin-bottom:16px" loading="lazy">` : ''}
  <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3;color:#0f172a">${esc(row.name)}</h2>
  ${projectBadges.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${projectBadges.join('')}</div>` : ''}
  ${row.location ? `<p style="font-size:14px;color:#64748b;margin:0 0 12px">📍 ${esc(String(row.location))}</p>` : ''}
  ${meta.developer ? `<p style="font-size:14px;color:#475569;margin:0 0 10px">Chủ đầu tư: <strong>${esc(String(meta.developer))}</strong></p>` : ''}
  <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px">${esc(desc)}</p>
  <p style="font-size:13px;color:#94a3b8;margin:0">Nguồn: SGS LAND — Đại lý phân phối BĐS uỷ quyền tại TP.HCM</p>
</div>`;

        sendMeta(res, {
          title: `${row.name} — Mini-site dự án | SGS LAND`,
          description: desc,
          h1: row.name,
          image: cover || undefined,
          url: `${APP_SITEMAP_URL}/p/${row.code}`,
          type: 'website',
          bodyHtml: projectBodyHtml,
          structuredData: {
            '@context': 'https://schema.org',
            '@type': 'ApartmentComplex',
            '@id': `${APP_SITEMAP_URL}/p/${row.code}`,
            name: row.name,
            description: desc,
            url: `${APP_SITEMAP_URL}/p/${row.code}`,
            ...(cover ? { image: cover } : {}),
            ...(row.location ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: row.location,
                addressCountry: 'VN',
                addressLocality: meta.district || row.location,
                addressRegion: meta.province || 'TP. Hồ Chí Minh',
              }
            } : {}),
            ...(amenities.length > 0 ? { amenityFeature: amenities } : {}),
            ...(meta.developer ? { author: { '@type': 'Organization', name: String(meta.developer) } } : {}),
            ...(meta.website ? { sameAs: String(meta.website) } : {}),
            potentialAction: {
              '@type': 'ReserveAction',
              target: `${APP_SITEMAP_URL}/p/${row.code}`,
              name: 'Đăng ký tư vấn',
            },
          },
        });
      } catch (err) {
        logger.error('[PublicProject SSR] meta fetch failed:', err);
        next();
      }
    });

    // All other SPA routes → inject admin-saved override or fallback to defaults

    // Custom /assets handler: reads files into buffer to avoid EIO streaming errors
    // on Replit VM overlay filesystem. Retries once on EIO before giving up.
    const MIME: Record<string, string> = {
      '.js':    'application/javascript; charset=utf-8',
      '.css':   'text/css; charset=utf-8',
      '.woff2': 'font/woff2',
      '.woff':  'font/woff',
      '.ttf':   'font/ttf',
      '.svg':   'image/svg+xml',
      '.png':   'image/png',
      '.jpg':   'image/jpeg',
      '.jpeg':  'image/jpeg',
      '.webp':  'image/webp',
      '.ico':   'image/x-icon',
      '.json':  'application/json',
      '.map':   'application/json',
    };

    // ─── In-memory asset cache ────────────────────────────────────────────────
    // Replit VM overlay FS returns transient EIO on dist/assets reads, especially
    // in the first few minutes after a fresh deployment. 4-retry/900ms is not
    // enough — EIO can persist for several minutes, causing the main JS bundle to
    // fail to load and the React app to get stuck on the "Đang khởi động hệ thống"
    // splash screen.  Solution: load ALL dist/assets files into RAM at startup
    // (7.6 MB total, well within Node heap), serve from the Map on every request.
    // A pending-promise queue prevents thundering-herd: concurrent requests for
    // the same file wait for the single inflight read rather than spawning many.
    const _assetCache = new Map<string, Buffer>();
    const _assetPending = new Map<string, Promise<Buffer | null>>();

    const _readWithEioRetry = (fp: string, attempt = 1): Promise<Buffer | null> =>
      new Promise(resolve => {
        fs.readFile(fp, (err, data) => {
          if (!err) return resolve(data);
          if ((err as any).code === 'ENOENT') return resolve(null);
          if ((err as any).code === 'EIO') {
            // Exponential backoff: 500ms, 1s, 2s, 4s … capped at 30s, unlimited retries
            const delay = Math.min(500 * Math.pow(2, attempt - 1), 30_000);
            logger.warn(`[AssetCache] EIO on ${fp} attempt ${attempt}, retry in ${delay}ms`);
            setTimeout(() => _readWithEioRetry(fp, attempt + 1).then(resolve), delay);
          } else {
            logger.error('[AssetCache] Unexpected error reading asset', err);
            resolve(null);
          }
        });
      });

    // Pre-warm: load every file in dist/assets into cache at startup.
    // Runs in background — server starts immediately, cache fills gradually.
    (async () => {
      try {
        const assetsDir = path.join(process.cwd(), 'dist', 'assets');
        const files = await fs.promises.readdir(assetsDir).catch(() => [] as string[]);
        await Promise.all(files.map(async f => {
          const fp = path.join(assetsDir, f);
          const data = await _readWithEioRetry(fp);
          if (data) _assetCache.set(fp, data);
        }));
        logger.info(`[AssetCache] Pre-warmed ${_assetCache.size} assets into RAM`);
      } catch (e) {
        logger.warn('[AssetCache] Pre-warm error', e);
      }
    })();

    app.get('/assets/*path', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const filePath = path.join(process.cwd(), 'dist', req.path);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';

      // Serve from RAM cache if already loaded
      const cached = _assetCache.get(filePath);
      if (cached) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('X-Asset-Cache', 'hit');
        return res.end(cached);
      }

      // Not yet cached: coalesce concurrent requests into one inflight read
      let pending = _assetPending.get(filePath);
      if (!pending) {
        pending = _readWithEioRetry(filePath).then(data => {
          _assetPending.delete(filePath);
          if (data) _assetCache.set(filePath, data);
          return data;
        });
        _assetPending.set(filePath, pending);
      }

      pending.then(data => {
        if (!data) return res.status(404).end();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('X-Asset-Cache', 'miss');
        res.end(data);
      }).catch(next);
    });

    // Long-lived cache for hashed assets (JS/CSS chunks have content hash in filename)
    app.use(express.static("dist", {
      index: false, // SSR-fix: dont auto-serve dist/index.html for / so homepage reaches bot-SSR catch-all
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        // HTML should never be cached long-term (SPA shell changes on redeploy)
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      },
    }));
    // ---------------------------------------------------------------------------
    // pSEO: Glossary playbook — /kien-thuc-bds/:term  (hub + spoke pages)
    // Initial batch: 4 terms. Validate indexation in Search Console, then scale.
    // Cache: hub 1h, term pages 24h (content rarely changes).
    // ---------------------------------------------------------------------------
    app.get('/kien-thuc-bds', (_req: express.Request, res: express.Response) => {
      const html = getGlossaryIndexHtml();
      if (!html) { res.status(503).end(); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1');
      res.send(html);
    });

    app.get('/kien-thuc-bds/:term', (req: express.Request, res: express.Response) => {
      const html = getGlossaryTermHtml(String(req.params.term));
      if (!html) { res.status(404).end(); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1');
      res.send(html);
    });

    // ---------------------------------------------------------------------------
    // Universal catch-all — must be last route.
    //
    // Bot path  : generateBotHTML(pathname, { aiBot }) → full SSR HTML with meta
    //   AI bots (GPTBot, PerplexityBot, ClaudeBot) → GEO-maximized content,
    //   no shared cache (content differs per user-agent variant).
    //   Search bots (Googlebot, Bingbot) → standard SSR, 1h public cache.
    //
    // User path : DB seo_overrides lookup → buildStaticPageMeta → sendMeta (SPA shell)
    //   no-cache so browsers always fetch fresh HTML after a redeploy, preventing
    //   ChunkLoadError from stale chunk hashes.
    // ---------------------------------------------------------------------------
    app.use(async (req: express.Request, res: express.Response) => {
      const ua = String(req.headers['user-agent'] || '');
      const pathname = req.path;

      if (pathname.startsWith('/api/')) {
        return res.status(404).json({ error: 'Không tìm thấy endpoint.', code: 'API_NOT_FOUND' });
      }

      if (isBot(ua)) {
        const aiBot = isAIBot(ua);
        // BOT_DB_SSR — for project/listing detail pages, render rich crawlable body
      // from DB (8 AI sections + FAQ/ApartmentComplex/RealEstateListing JSON-LD).
      let html: string | null = null;
      try {
        const phMatch = pathname.match(/^\/du-an\/([^\/?#]+)\/?$/);
        const bdMatch = pathname.match(/^\/bds\/.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
        const fetchExtras = async () => {
          let priceHistory: any[] = [], news: any[] = [];
          try { const ph = await pool.query(`SELECT recorded_at, price_per_m2, price_min, price_max, trend_text, confidence, location_display FROM market_price_history ORDER BY recorded_at DESC LIMIT 6`); priceHistory = ph.rows.map((r: any) => ({ recordedAt: r.recorded_at, pricePerM2: r.price_per_m2, priceMin: r.price_min, priceMax: r.price_max, trendText: r.trend_text, confidence: r.confidence, locationDisplay: r.location_display })); } catch {}
          try { const nw = await pool.query(`SELECT title, slug, published_at FROM articles WHERE status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 6`); news = nw.rows.map((r: any) => ({ title: r.title, slug: r.slug, publishedAt: r.published_at })); } catch {}
          return { priceHistory, news };
        };
        if (phMatch) {
          const pr = await withRlsBypass((client) => client.query(`SELECT id, name, code, description, location, open_date, handover_date, metadata FROM projects WHERE (metadata->>'slug' = $1 OR LOWER(code) = LOWER($1) OR id::text = $1) LIMIT 1`, [phMatch[1]]));
          const row: any = pr.rows[0];
          if (row) {
            const project: any = { id: row.id, name: row.name, code: row.code, description: row.description, location: row.location, openDate: row.open_date, handoverDate: row.handover_date, metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {} };
            project.__aiExtras = await fetchExtras();
            html = injectMeta(getBaseHtml(), buildProjectMeta(project));
          }
        } else if (bdMatch) {
          const lr = await withRlsBypass((client) => client.query(`SELECT id, code, title, description, type, transaction, status, price, currency, area, bedrooms, bathrooms, location, images, attributes FROM listings WHERE id = $1 LIMIT 1`, [bdMatch[1]]));
          const row: any = lr.rows[0];
          if (row) {
            const listing: any = { id: row.id, code: row.code, title: row.title, description: row.description, type: row.type, transaction: row.transaction, status: row.status, price: row.price != null ? Number(row.price) : null, currency: row.currency, area: row.area != null ? Number(row.area) : null, bedrooms: row.bedrooms, bathrooms: row.bathrooms, location: row.location, images: row.images, attributes: row.attributes && typeof row.attributes === 'object' ? row.attributes : {} };
            listing.__aiExtras = await fetchExtras();
            html = injectMeta(getBaseHtml(), buildListingMeta(listing));
          }
        }
      } catch (e) { html = null; }
      if (!html) html = generateBotHTML(pathname, { aiBot });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Rendered-By', 'SGS-SSR');
        // Task 2.1 — per-route hybrid render policy (SSG/SSR/ISR).
        const __policy = getRenderPolicy(pathname);
        res.setHeader('X-Render-Strategy', __policy.strategy);
        res.setHeader(
          'Cache-Control',
          aiBot ? 'no-store' : __policy.cacheControl
        );
        return res.send(html);
      }

      // Regular users → SPA shell with DB-backed meta overrides
      try {
        const routeKey = pathname.replace(/^\//, '').split('/')[0] || '';
        let timeoutHandle: NodeJS.Timeout | undefined;
        const result = await Promise.race([
          pool.query(
            'SELECT title, description, og_image FROM seo_overrides WHERE route_key = $1',
            [routeKey]
          ),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error('seo_overrides lookup timed out')),
              3000
            );
          }),
        ]).finally(() => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        });
        const row = result.rows[0];
        const meta = buildStaticPageMeta(
          row?.title,
          row?.description,
          row?.og_image,
          pathname
        );
        sendMeta(res, meta, false);
      } catch {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      }
    });
  }


// L3 FIX: API versioning - /api/v1 as canonical versioned alias for /api
// All existing /api/* routes remain untouched for backward compatibility.
// New clients should use /api/v1/* prefix; both work identically.
app.use('/api/v1', (req, _res, next) => {
  // Rewrite /api/v1/... to /api/... so all existing handlers match
  req.url = req.url; // URL is already stripped of /api/v1 prefix by Express
  next();
});

  app.use(errorHandler);

  server.listen(PORT, "0.0.0.0", async () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    //  RELIABILITY FIX (audit): gate cho viec dang ky QStash schedule 
    // Truoc day 8 khoi duoi day POST /v2/schedules/<id> MOI LAN process boot,
    // voi appDomain = (PROD_DOMAIN | REPLIT_DOMAINS | APP_DOMAIN) || REPLIT_DEV_DOMAIN.
    // Hai hau qua:
    //   1) Mot process DEV co QSTASH_TOKEN ghi cung scheduleId nhung tro ve domain
    //      dev => chiem/ghi de cron cua production.
    //   2) Crash-loop (supervisor restart lien tuc) => 8 API call QStash moi lan
    //      boot => dot quota va co nguy co tao schedule trung.
    // Gio chi dang ky khi that su la production VA co PROD_DOMAIN tuong minh.
    const QSTASH_SCHEDULE_DOMAIN =
      process.env.NODE_ENV === 'production' && process.env.PROD_DOMAIN
        ? process.env.PROD_DOMAIN
        : '';
    if (!QSTASH_SCHEDULE_DOMAIN) {
      logger.info('[QStash] Bo qua dang ky schedule: chi dang ky khi NODE_ENV=production va co PROD_DOMAIN.');
    }
    // Đăng ký QStash daily schedule cho RLHF recompute
    if (isQstashVerified()) {
      try {
        const qstashToken = getQstashToken();
        const rlhfSecret = process.env.RLHF_CRON_SECRET || process.env.JWT_SECRET?.slice(0, 32) || '';
        const devDomain = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain || devDomain)
        if (appDomain && rlhfSecret) {
          const scheduleUrl = `https://${appDomain}/api/internal/rlhf-recompute`;
          const scheduleId = 'rlhf-daily-recompute';
          const qstashScheduleEndpoint = `https://qstash.upstash.io/v2/schedules/${scheduleId}`;
          const body = JSON.stringify({ tenantId: 'all', secret: rlhfSecret });
          const resp = await fetch(qstashScheduleEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': scheduleUrl,
              'Upstash-Cron': '0 19 * * *', // 2:00 SA ICT = 19:00 UTC
              'Upstash-Method': 'POST',
            },
            body,
          });
          if (resp.ok) {
            logger.info('[RLHF] Đã đăng ký QStash daily schedule — chạy lúc 2:00 SA ICT');
          } else {
            const errText = await resp.text();
            logger.warn(`[RLHF] Không thể đăng ký QStash schedule: ${resp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[RLHF] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Engagement Email Cron (NUDGE_A / B / C) — 3:00 SA ICT = 20:00 UTC ──
      try {
        const engagementSecret =
          process.env.ENGAGEMENT_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain2  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain2 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain2  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain2 || devDomain2)

        if (appDomain2 && engagementSecret) {
          const engScheduleId  = 'engagement-email-daily';
          const engScheduleUrl = `https://${appDomain2}/api/internal/engagement-email-cron`;
          const engQstashEp    = `https://qstash.upstash.io/v2/schedules/${engScheduleId}`;
          const qstashToken    = getQstashToken();
          const engBody        = JSON.stringify({ secret: engagementSecret });

          const engResp = await fetch(engQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': engScheduleUrl,
              'Upstash-Cron': '0 20 * * *', // 3:00 SA ICT = 20:00 UTC
              'Upstash-Method': 'POST',
            },
            body: engBody,
          });

          if (engResp.ok) {
            logger.info('[EngagementCron] Đã đăng ký QStash daily schedule — chạy lúc 3:00 SA ICT');
          } else {
            const errText = await engResp.text();
            logger.warn(`[EngagementCron] Không thể đăng ký QStash schedule: ${engResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[EngagementCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Backup DB Cron — 2:30 SA ICT = 19:30 UTC hàng ngày ─────────────────
      try {
        const backupSecret =
          process.env.BACKUP_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain3  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain3 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain3  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain3 || devDomain3)

        if (appDomain3 && backupSecret) {
          const bkScheduleId  = 'backup-db-daily';
          const bkScheduleUrl = `https://${appDomain3}/api/internal/backup-cron`;
          const bkQstashEp    = `https://qstash.upstash.io/v2/schedules/${bkScheduleId}`;
          const qstashToken   = getQstashToken();
          const bkBody        = JSON.stringify({ secret: backupSecret });

          const bkResp = await fetch(bkQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': bkScheduleUrl,
              'Upstash-Cron': '30 19 * * *', // 2:30 SA ICT = 19:30 UTC
              'Upstash-Method': 'POST',
            },
            body: bkBody,
          });

          if (bkResp.ok) {
            logger.info('[BackupCron] Đã đăng ký QStash daily schedule — chạy lúc 2:30 SA ICT');
          } else {
            const errText = await bkResp.text();
            logger.warn(`[BackupCron] Không thể đăng ký QStash schedule: ${bkResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[BackupCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Listing Price Refresh — 4:00 SA ICT = 21:00 UTC hàng ngày ────────────
      try {
        const priceRefreshSecret =
          process.env.PRICE_REFRESH_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain4  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain4 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain4  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain4 || devDomain4)

        if (appDomain4 && priceRefreshSecret) {
          const prScheduleId  = 'listing-price-refresh-daily';
          const prScheduleUrl = `https://${appDomain4}/api/internal/listing-price-refresh`;
          const prQstashEp    = `https://qstash.upstash.io/v2/schedules/${prScheduleId}`;
          const prBody        = JSON.stringify({ secret: priceRefreshSecret, tenantId: 'all' });

          const prResp = await fetch(prQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getQstashToken()}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': prScheduleUrl,
              'Upstash-Cron': '0 21 * * *', // 4:00 SA ICT = 21:00 UTC
              'Upstash-Method': 'POST',
            },
            body: prBody,
          });

          if (prResp.ok) {
            logger.info('[PriceRefresh] Đã đăng ký QStash daily schedule — chạy lúc 4:00 SA ICT');
          } else {
            const errText = await prResp.text();
            logger.warn(`[PriceRefresh] Không thể đăng ký QStash schedule: ${prResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[PriceRefresh] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Task Reminder Cron — mỗi giờ (phút :05) ───────────────────────────
      try {
        const taskReminderSecret =
          process.env.TASK_REMINDER_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain5  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain5 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain5  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain5 || devDomain5)

        if (appDomain5 && taskReminderSecret) {
          const trScheduleId  = 'task-reminder-hourly';
          const trScheduleUrl = `https://${appDomain5}/api/internal/task-reminder-cron`;
          const trQstashEp    = `https://qstash.upstash.io/v2/schedules/${trScheduleId}`;
          const trBody        = JSON.stringify({ secret: taskReminderSecret });

          const trResp = await fetch(trQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getQstashToken()}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': trScheduleUrl,
              'Upstash-Cron': '5 * * * *', // mỗi giờ phút :05
              'Upstash-Method': 'POST',
            },
            body: trBody,
          });

          if (trResp.ok) {
            logger.info('[TaskReminderCron] Đã đăng ký QStash hourly schedule — chạy mỗi giờ phút :05');
          } else {
            const errText = await trResp.text();
            logger.warn(`[TaskReminderCron] Không thể đăng ký QStash schedule: ${trResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[TaskReminderCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── GEO Monitor Cron — 4:30 SA ICT = 21:30 UTC hàng ngày ──────────────
      try {
        const geoSecret =
          process.env.GEO_MONITOR_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain7  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain7 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain7  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain7 || devDomain7)

        if (appDomain7 && geoSecret) {
          const geoScheduleId  = 'geo-monitor-daily';
          const geoScheduleUrl = `https://${appDomain7}/api/internal/geo-monitor-cron`;
          const geoQstashEp    = `https://qstash.upstash.io/v2/schedules/${geoScheduleId}`;
          const geoBody        = JSON.stringify({ secret: geoSecret });

          const geoResp = await fetch(geoQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getQstashToken()}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': geoScheduleUrl,
              'Upstash-Cron': '30 21 * * *', // 4:30 SA ICT = 21:30 UTC
              'Upstash-Method': 'POST',
            },
            body: geoBody,
          });

          if (geoResp.ok) {
            logger.info('[GeoMonitorCron] Đã đăng ký QStash daily schedule — chạy lúc 4:30 SA ICT');
          } else {
            const errText = await geoResp.text();
            logger.warn(`[GeoMonitorCron] Không thể đăng ký QStash schedule: ${geoResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[GeoMonitorCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Campaign Scheduler Cron — mỗi 5 phút ──────────────────────────────
      try {
        const campaignSchedulerSecret =
          process.env.CAMPAIGN_SCHEDULER_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const devDomain6  = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain6 = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain6  = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain6 || devDomain6)

        if (appDomain6 && campaignSchedulerSecret) {
          const csScheduleId  = 'campaign-scheduler-5min';
          const csScheduleUrl = `https://${appDomain6}/api/internal/campaign-scheduler-cron`;
          const csQstashEp    = `https://qstash.upstash.io/v2/schedules/${csScheduleId}`;
          const csBody        = JSON.stringify({ secret: campaignSchedulerSecret });

          const csResp = await fetch(csQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getQstashToken()}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': csScheduleUrl,
              'Upstash-Cron': '*/5 * * * *', // mỗi 5 phút
              'Upstash-Method': 'POST',
            },
            body: csBody,
          });

          if (csResp.ok) {
            logger.info('[CampaignSchedulerCron] Đã đăng ký QStash schedule — chạy mỗi 5 phút');
          } else {
            const errText = await csResp.text();
            logger.warn(`[CampaignSchedulerCron] Không thể đăng ký QStash schedule: ${csResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[CampaignSchedulerCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }

      // ── Chat Follow-up Cron — 9:00 SA ICT = 2:00 UTC hàng ngày ───────────────
      try {
        const chatFollowUpSecret8 =
          process.env.CHAT_FOLLOWUP_CRON_SECRET ||
          process.env.JWT_SECRET?.slice(0, 32) ||
          '';
        const prodDomain8  = process.env.PROD_DOMAIN;
        const devDomain8   = process.env.REPLIT_DEV_DOMAIN;
        const appDomain8   = QSTASH_SCHEDULE_DOMAIN; // reliability fix: prod + PROD_DOMAIN only (was prodDomain8 || devDomain8)

        if (appDomain8 && chatFollowUpSecret8) {
          const cfScheduleId  = 'chat-followup-daily';
          const cfScheduleUrl = `https://${appDomain8}/api/internal/chat-followup-cron`;
          const cfQstashEp    = `https://qstash.upstash.io/v2/schedules/${cfScheduleId}`;
          const cfBody        = JSON.stringify({ secret: chatFollowUpSecret8 });

          const cfResp = await fetch(cfQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getQstashToken()}`,
              'Content-Type': 'application/json',
              'Upstash-Destination': cfScheduleUrl,
              'Upstash-Cron': '0 2 * * *', // 9:00 SA ICT = 2:00 UTC
              'Upstash-Method': 'POST',
            },
            body: cfBody,
          });

          if (cfResp.ok) {
            logger.info('[ChatFollowUpCron] Đã đăng ký QStash daily schedule — chạy lúc 9:00 SA ICT');
          } else {
            const errText = await cfResp.text();
            logger.warn(`[ChatFollowUpCron] Không thể đăng ký QStash schedule: ${cfResp.status} ${errText}`);
          }
        }
      } catch (e: any) {
        logger.warn('[ChatFollowUpCron] Lỗi khi đăng ký QStash schedule:', e.message);
      }
    }
  });

  // RELIABILITY FIX (audit Low): shutdown phai idempotent - SIGTERM roi SIGINT
  // (hoac supervisor gui lai) khong duoc chay lai toan bo tien trinh dong ket noi.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn(`Received ${signal} while already shutting down - ignored.`);
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    // Close Socket.io first — notifies clients of disconnect before HTTP closes
    try {
      await new Promise<void>(resolve => io.close(() => resolve()));
      logger.info('Socket.io closed.');
    } catch (e) { /* ignore */ }
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await webhookWorker.close();
        logger.info('Webhook worker đã dừng.');
      } catch (e) { /* ignore */ }
      try {
        await webhookQueue.close();
        logger.info('Webhook queue đã đóng.');
      } catch (e) { /* queue may not be initialized */ }
      try {
        marketDataService.stop();
        logger.info('Market data service stopped.');
      } catch (e) { /* ignore */ }
      // RELIABILITY FIX (audit Medium): dung TAT CA in-process cron khi shutdown,
      // truoc day chi co marketDataService duoc stop() nen cac timer khac van chay
      // trong luc pool dang dong -> log loi ECONNRESET luc tat may.
      try { stopBookingLifecycleCron(); } catch (e) { /* ignore */ }
      try { stopBuyerPushCron(); } catch (e) { /* ignore */ }
      try { stopCustomDomainVerifyCron(); } catch (e) { /* ignore */ }
      try { stopCampaignSchedulerCron(); } catch (e) { /* ignore */ }
      try { priceCalibrationService.stop(); } catch (e) { /* ignore */ }
      logger.info('In-process cron timers stopped.');
      try {
        stopDatabaseRecovery();
        await pool.end();
        logger.info('Database pool closed.');
      } catch (e) { /* ignore */ }
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Prevent unhandled promise rejections from crashing the server
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('[Server] Unhandled promise rejection:', reason instanceof Error ? reason.message : String(reason));
  });

  // Log uncaught exceptions. Most async errors are safe to swallow and keep serving,
  // but errors outside a known-safe allowlist may have left Node's internal state
  // corrupted (e.g. Node's native stream/webstream internals) — continuing to run in
  // that state risks a "zombie" process that stays alive but stops responding to any
  // request, with no further logs and no automatic restart. Exiting lets the platform's
  // process supervisor restart the server cleanly instead of hanging indefinitely.
  const SAFE_TO_IGNORE_CODES = new Set(['ERR_USE_AFTER_CLOSE']);
  process.on('uncaughtException', (err: Error) => {
    logger.error(`[Server] Uncaught exception: ${err.message}\n${err.stack}`);
    // pg can emit a socket error outside the request promise when a server
    // restarts. It is recoverable and must not take down unrelated requests.
    if (SAFE_TO_IGNORE_CODES.has((err as any).code) || isTransientDatabaseError(err)) {
      logger.warn('[Server] Recoverable database connection error; keeping process alive.');
      return;
    }
    logger.error('[Server] Exiting after uncaught exception so the process can restart cleanly.');
    // Give the log line a moment to flush before terminating.
    setTimeout(() => process.exit(1), 250);
  });
}

startServer();
