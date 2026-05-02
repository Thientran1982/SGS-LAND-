import express from "express";
import compression from "compression";
import path from "path";
import { Server } from "socket.io";
import http from "http";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import { pool, withTenantContext, withRlsBypass } from "./server/db";
import bcrypt from "bcrypt";
import { runPendingMigrations } from "./server/migrations/runner";
import { systemService } from "./server/services/systemService";
import { webhookQueue, setupWebhookWorker, processWebhookJob, isQStashEnabled } from "./server/queue";
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
import { createUserRoutes } from "./server/routes/userRoutes";
import { createAnalyticsRoutes } from "./server/routes/analyticsRoutes";
import { createScoringRoutes } from "./server/routes/scoringRoutes";
import { createRoutingRuleRoutes } from "./server/routes/routingRuleRoutes";
import { createKnowledgeRoutes } from "./server/routes/knowledgeRoutes";
import { createEnterpriseRoutes } from "./server/routes/enterpriseRoutes";
import { createSequenceRoutes } from "./server/routes/sequenceRoutes";
import { emailService } from "./server/services/emailService";
import { createAiGovernanceRoutes } from "./server/routes/aiGovernanceRoutes";
import { createAgentRoutes } from "./server/routes/agentRoutes";
import { createSessionRoutes, createTemplateRoutes } from "./server/routes/sessionRoutes";
import { createActivityRoutes } from "./server/routes/activityRoutes";
import { createNotificationRoutes } from "./server/routes/notificationRoutes";
import { createBillingRoutes } from "./server/routes/billingRoutes";
import { createBillingWebhookRouter } from "./server/routes/billingWebhookRoutes";
import { createUploadRoutes, createUploadServeRoute } from "./server/routes/uploadRoutes";
import { createScimRoutes } from "./server/routes/scimRoutes";
import { createValuationRoutes } from "./server/routes/valuationRoutes";
import { createProjectRoutes } from "./server/routes/projectRoutes";
import { createTenantRoutes } from "./server/routes/tenantRoutes";
import { createTaskRoutes } from "./server/routes/taskRoutes";
import { createDepartmentRoutes } from "./server/routes/departmentRoutes";
import { createTaskReportRoutes } from "./server/routes/taskReportRoutes";
import { createLandingLeadRoutes } from "./server/routes/landingLeadRoutes";
import { createLandingAiRoutes } from "./server/routes/landingAiRoutes";
import { createPublicProjectRoutes } from "./server/routes/publicProjectRoutes";
import { createConnectorRoutes } from "./server/routes/connectorRoutes";
import { createScraperRoutes } from "./server/routes/scraperRoutes";
import { createScraperProjectRoutes } from "./server/routes/scraperProjectRoutes";
import { createEngagementCronRouter } from "./server/routes/engagementCronRoutes";
import { createBackupRouter } from "./server/routes/backupRoutes";
import { createListingPriceRefreshRouter } from "./server/routes/listingPriceRefreshRoutes";
import { createCampaignRouter } from "./server/routes/campaignRoutes";
import { createErrorLogRoutes, initErrorLogRepo } from "./server/routes/errorLogRoutes";
import { marketDataService } from "./server/services/marketDataService";
import { priceCalibrationService } from "./server/services/priceCalibrationService";
import { securityHeaders, corsMiddleware, verifyWebhookSignature, preventParamPollution } from "./server/middleware/security";
import { errorHandler } from "./server/middleware/errorHandler";
import { sanitizeInput, validateBody, schemas } from "./server/middleware/validation";
import { aiRateLimit, authRateLimit, webhookRateLimit, apiRateLimit, publicLeadRateLimit, livechatRateLimit, guestValuationRateLimit, userValuationRateLimit, monthlyValuationQuota, monthlyAriaQuota, getMonthlyQuotaStatus, getMonthlyAriaQuotaStatus } from "./server/middleware/rateLimiter";
import { logger, requestLogger } from "./server/middleware/logger";
import { writeAuditLog } from "./server/middleware/auditLog";
import { DEFAULT_TENANT_ID } from "./server/constants";
import { DICTIONARY } from "./config/locales";
import { interactionRepository } from "./server/repositories/interactionRepository";
import { sessionRepository } from "./server/repositories/sessionRepository";
import { visitorRepository } from "./server/repositories/visitorRepository";
import { lookupIp, getClientIp } from "./server/services/geoService";
import { sendAiError, parseAiError } from "./server/utils/aiErrorHandler";

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
  app.set('trust proxy', 2);
  const PORT = parseInt(process.env.PORT || '5000', 10);

  // Gzip compression — reduces JS/CSS/JSON payload by ~70-80%
  app.use(compression({
    level: 6,  // balanced speed vs ratio
    threshold: 1024,  // only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress SSE streams (they handle their own framing)
      if (req.path.includes('/api/ai-chat-stream') || req.path.includes('/api/events')) return false;
      return compression.filter(req, res);
    },
  }));
  app.use(securityHeaders);
  app.use(corsMiddleware);
  // Stripe webhook MUST be mounted before the global JSON parser so the raw
  // body is available for signature verification.
  app.use('/api/billing/webhook', createBillingWebhookRouter());
  app.use('/api/webhooks', express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }));
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      // Store raw body for routes that need it (e.g. QStash signature verification)
      req.rawBody = buf;
    }
  }));
  app.use(cookieParser());
  app.use(preventParamPollution);
  app.use(sanitizeInput);
  app.use(requestLogger);

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
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
    }
    console.warn("WARNING: JWT_SECRET not set. Generating a random secret for this session. Set JWT_SECRET env var for production.");
  }
  const JWT_SECRET = process.env.JWT_SECRET || (await import('crypto')).randomBytes(64).toString('hex');

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
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    ...(isProduction && { secure: true }),
  };

  app.post("/api/auth/login", authRateLimit, validateBody(schemas.login), async (req, res) => {
    try {
      let { email, password } = req.body;
      email = email?.trim();
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
      const { name, email, password, company } = req.body;

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

      // Generate a secure email verification token
      const crypto = await import('crypto');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      const dbUser = await userRepository.create(tenantId, {
        name: name || email.split('@')[0],
        email,
        password,
        role: isFirstUser ? 'ADMIN' : 'SALES',
        source: 'REGISTER',
        status: 'PENDING',
        emailVerified: false,
        emailVerificationToken: tokenHash,
        emailVerificationExpires: tokenExpires,
      });

      // Build the verification URL using the canonical base URL helper
      const baseUrl = resolveBaseUrl(req);
      const verifyUrl = `${baseUrl}/verify-email/${rawToken}`;

      // Respond immediately — don't block on email delivery under high registration load
      const isDevMode = !isProduction;
      res.json({
        message: 'Registration successful. Please verify your email to continue.',
        needsVerification: true,
        email: dbUser.email,
        emailStatus: 'sending',
        ...(isDevMode && { devVerifyToken: rawToken, devVerifyUrl: verifyUrl }),
      });

      // Fire-and-forget email after response is sent
      emailService.sendVerificationEmail(tenantId, email, dbUser.name, verifyUrl).then((verifyResult) => {
        writeAuditLog(tenantId, dbUser.id, 'REGISTER', 'auth', dbUser.id, { email, emailSent: verifyResult.success }, req.ip);
        if (!verifyResult.success) {
          logger.error(`Failed to send verification email to ${email}: ${verifyResult.error}`);
        }
      }).catch(err => {
        logger.error(`Failed to send verification email to ${email}: ${err.message}`);
        writeAuditLog(tenantId, dbUser.id, 'REGISTER', 'auth', dbUser.id, { email, emailSent: false }, req.ip);
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

        // 2) Sinh email-verify token TRƯỚC khi vào transaction (idempotent — không cần rollback)
        const cryptoMod = await import('crypto');
        const rawToken = cryptoMod.randomBytes(32).toString('hex');
        const tokenHash = cryptoMod.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
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
              await client.query(`SET LOCAL app.current_tenant_id = '${newTenantId}'`);
              const userInsert = await client.query(
                `INSERT INTO users
                   (tenant_id, name, email, password_hash, role, phone, source, status,
                    email_verified, email_verification_token, email_verification_expires)
                 VALUES (current_setting('app.current_tenant_id', true)::uuid,
                         $1, $2, $3, 'ADMIN', $4, 'SELF_SIGNUP_VENDOR', 'PENDING',
                         FALSE, $5, $6)
                 RETURNING id, name, email`,
                [trimmedName, trimmedEmail, passwordHash, phone?.trim() || null, tokenHash, tokenExpires]
              );

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

        // 4) Respond immediately — don't block on email delivery under high registration load
        const baseUrl = resolveBaseUrl(req);
        const verifyUrl = `${baseUrl}/verify-email/${rawToken}`;
        const isDevMode = !isProduction;

        res.status(201).json({
          message:
            'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt workspace của bạn.',
          needsVerification: true,
          email: adminUser.email,
          tenantId: created.tenantId,
          tenantDomain: created.domainSlug,
          plan: 'INDIVIDUAL',
          trialDays: 14,
          emailStatus: 'sending',
          ...(isDevMode && { devVerifyToken: rawToken, devVerifyUrl: verifyUrl }),
        });

        // Fire-and-forget email + audit after response is sent
        emailService
          .sendVerificationEmail(created.tenantId, trimmedEmail, adminUser.name, verifyUrl)
          .then((verifyResult) => {
            writeAuditLog(
              created.tenantId,
              adminUser.id,
              'ONBOARD_VENDOR',
              'tenant',
              created.tenantId,
              { company: trimmedCompany, domain: created.domainSlug, email: trimmedEmail, emailSent: verifyResult.success },
              req.ip
            );
            if (!verifyResult.success) {
              logger.error(`[onboard-vendor] Failed to send verify email to ${trimmedEmail}: ${verifyResult.error}`);
            }
          })
          .catch((err) => {
            logger.error(`[onboard-vendor] Failed to send verify email to ${trimmedEmail}: ${err.message}`);
            writeAuditLog(
              created.tenantId,
              adminUser.id,
              'ONBOARD_VENDOR',
              'tenant',
              created.tenantId,
              { company: trimmedCompany, domain: created.domainSlug, email: trimmedEmail, emailSent: false },
              req.ip
            );
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

  // ── Email Verification ──────────────────────────────────────────────────────
  app.get("/api/auth/verify-email", authRateLimit, async (req, res) => {
    try {
      const rawToken = (req.query.token as string)?.trim();
      if (!rawToken) return res.status(400).json({ error: 'Verification token is required' });

      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Look up user by token CROSS-TENANT (vendor onboarding tạo user trong tenant mới,
      // không phải DEFAULT_TENANT_ID). Token là sha256(32-byte random) → đủ collision-safe
      // để dùng làm cross-tenant lookup; bypass RLS chỉ để tìm bản ghi, sau đó activate
      // user trong đúng tenant của họ.
      const user = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW() LIMIT 1`,
          [tokenHash]
        );
        return r.rows[0] ? userRepository['rowToEntity']<any>(r.rows[0]) : null;
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      const tenantId = user.tenantId as string;

      // Mark email as verified. For SELF_SIGNUP_VENDOR accounts, activate the user but
      // set the tenant to PENDING_APPROVAL — they must wait for SGSLand platform owner to
      // review and approve before they can log in. For regular host-tenant accounts, activate
      // immediately as before.
      const isVendorSignup = user.source === 'SELF_SIGNUP_VENDOR' && tenantId !== DEFAULT_TENANT_ID;

      await withTenantContext(tenantId, async (client) => {
        await client.query(
          `UPDATE users SET email_verified = TRUE, status = 'ACTIVE', email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1`,
          [user.id]
        );
      });

      if (isVendorSignup) {
        // Set tenant approval_status to PENDING_APPROVAL (uses RLS bypass since column has no tenant context)
        await withRlsBypass(async (client) => {
          await client.query(
            `UPDATE tenants SET approval_status = 'PENDING_APPROVAL', config = config || '{"awaitingApproval": true}'::jsonb WHERE id = $1`,
            [tenantId]
          );
        });

        writeAuditLog(tenantId, user.id, 'EMAIL_VERIFIED', 'auth', user.id, { email: user.email, pendingApproval: true }, req.ip);

        return res.json({
          message: 'Email verified successfully. Your workspace is now pending approval.',
          needsApproval: true,
          email: user.email,
        });
      }

      // Regular account (host tenant) — log in immediately
      const jwtPayload = { id: user.id, email: user.email, name: user.name, role: user.role, tenantId };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);

      await userRepository.updateLastLogin(tenantId, user.id);
      writeAuditLog(tenantId, user.id, 'EMAIL_VERIFIED', 'auth', user.id, { email: user.email }, req.ip);

      emailService.sendWelcomeEmail(tenantId, user.email, user.name).catch(() => {});

      res.json({
        message: 'Email verified successfully',
        user: userRepository.toPublicUser({ ...user, emailVerified: true, status: 'ACTIVE' }),
        token,
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // ── Resend Verification Email ───────────────────────────────────────────────
  app.post("/api/auth/resend-verification", authRateLimit, async (req, res) => {
    const uniformDelay = () => new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    try {
      const email = req.body.email?.trim();
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Cross-tenant lookup: vendor accounts live in their own tenant, not DEFAULT_TENANT_ID.
      // Try host tenant first; if not found, search all other tenants (same pattern as login).
      let tenantId = DEFAULT_TENANT_ID;
      let user = await userRepository.findByEmail(tenantId, email);
      if (!user) {
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

      // Always respond the same to prevent email enumeration
      if (!user || user.emailVerified) {
        await uniformDelay();
        return res.json({ message: 'If a pending account exists, a new verification email has been sent.' });
      }

      const crypto = await import('crypto');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await withTenantContext(tenantId, async (client) => {
        await client.query(
          `UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3`,
          [tokenHash, tokenExpires, user!.id]
        );
      });

      const baseUrl = resolveBaseUrl(req);
      const verifyUrl = `${baseUrl}/verify-email/${rawToken}`;

      const result = await emailService.sendVerificationEmail(tenantId, email, user.name, verifyUrl).catch(() =>
        ({ success: false, status: 'failed' as const })
      );

      await uniformDelay();
      const isDevMode = !isProduction && result.status === 'queued_no_smtp';
      res.json({
        message: 'If a pending account exists, a new verification email has been sent.',
        ...(isDevMode && { devVerifyToken: rawToken, devVerifyUrl: verifyUrl }),
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    const uniformDelay = () => new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    try {
      const email = req.body.email?.trim();
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
        `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
        [user.id]
      );

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      const baseUrl = resolveBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

      const emailResult = await emailService.sendPasswordResetEmail(tenantId, email, resetUrl, user.name);
      if (emailResult.status === 'failed') {
        logger.error(`Failed to send password reset email to ${email}: ${emailResult.error}`);
      } else if (emailResult.status === 'queued_no_smtp') {
        logger.warn(`Password reset email for ${email} not sent — SMTP not configured.`);
      }

      writeAuditLog(tenantId, user.id, 'PASSWORD_RESET_REQUEST', 'auth', user.id, { email }, req.ip);
      await uniformDelay();
      if (emailResult.status === 'queued_no_smtp' || emailResult.status === 'failed') {
        logger.warn(`[ForgotPassword] Email not delivered for ${email} — status: ${emailResult.status}. Check BREVO_FROM_EMAIL / SMTP config.`);
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

  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const result = await pool.query(
        `UPDATE password_reset_tokens SET used = TRUE
         WHERE token = $1 AND used = FALSE AND expires_at > NOW()
         RETURNING user_id`,
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
      const pwUpdated = await userRepository.updatePassword(tenantId, userId, newPassword);
      if (!pwUpdated) {
        return res.status(500).json({ error: 'Failed to update password' });
      }

      // Activate invited/pending users — they've now set their password via the link
      if (userTenantRow.status === 'PENDING') {
        await withTenantContext(tenantId, async (client) => {
          await client.query(
            `UPDATE users SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING'`,
            [userId]
          );
        });
      }

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
      sameSite: isProduction ? 'none' as const : 'lax' as const,
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
      const result = await aiService.processMessage(lead, userMessage, history, t, tenantId, lang || 'vn', userFavorites);
      if (result.escalated && lead?.id) {
        broadcastIo?.to(`tenant:${tenantId}`).emit('escalate_to_human', { leadId: lead.id });
      }
      res.json(result);
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
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        socket.data.authUser = null;
        return next();
      }

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach(c => {
        const [key, ...vals] = c.trim().split('=');
        if (key) cookies[key.trim()] = vals.join('=');
      });

      const token = cookies['token'];
      if (!token) {
        socket.data.authUser = null;
        return next();
      }

      jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        socket.data.authUser = err ? null : decoded;
        next();
      });
    } catch (e) {
      socket.data.authUser = null;
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
  });

  // Setup BullMQ Worker — capture instance so we can close it on shutdown
  const webhookWorker = setupWebhookWorker(io);

  // Start market data service — Redis persistence + background seed for all provinces
  marketDataService.start(io).catch((err: any) =>
    console.error('[MarketData] Start error:', err?.message)
  );

  // Socket.io uses in-memory adapter (single-instance).
  // Upstash REST API does not support TCP pub/sub required by @socket.io/redis-adapter.
  logger.info("Socket.io using in-memory adapter (Upstash REST — no TCP pub/sub needed for single-instance).");

  // Initialize DB schema via migration runner (with retry for cold-start DB wakeup)
  if (process.env.DATABASE_URL) {
    const MAX_MIGRATION_ATTEMPTS = 3;
    let migrationOk = false;
    for (let attempt = 1; attempt <= MAX_MIGRATION_ATTEMPTS; attempt++) {
      try {
        await runPendingMigrations(pool);
        migrationOk = true;
        break;
      } catch (err: any) {
        const isTransient = err?.message?.includes('timeout') || err?.message?.includes('ECONNREFUSED') || err?.message?.includes('terminated unexpectedly');
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

    // ── Init self-learning price calibration engine ──────────────────────────
    // Must run AFTER migrations so market_price_history & avm_calibration tables exist
    priceCalibrationService.init(pool);
    logger.info('[PriceCalibration] Self-learning calibration engine initialized');
  } else {
    console.warn("DATABASE_URL not set. Skipping database migrations.");
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

  app.get('/api/public/listings', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 500);
      const filters: any = { status_in: ['AVAILABLE', 'OPENING', 'BOOKING'] };
      if (req.query.projectCode) {
        filters.projectCode = req.query.projectCode as string;
      } else {
        // Exclude project-catalog units (listings that belong to a project's product list)
        // from the public feed. They should only appear when explicitly queried by projectCode.
        filters.noProjectCode = true;
      }
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.transaction) filters.transaction = req.query.transaction as string;
      if (req.query.priceMin) filters.price_gte = parseFloat(req.query.priceMin as string);
      if (req.query.priceMax) filters.price_lte = parseFloat(req.query.priceMax as string);
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.location) {
        const province = req.query.location as string;
        const aliases = VN_PROVINCE_ALIASES[province];
        if (aliases?.length) {
          filters.location_any = aliases;
        } else {
          filters.location_contains = province;
        }
      }
      if (req.query.isVerified === 'true') filters.isVerified = true;
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
        result = await listingRepository.findListings(PUBLIC_TENANT, { page, pageSize }, filters);
      }
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
               AND status IN ('AVAILABLE','OPENING','BOOKING')
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

  app.get('/api/public/listings/:id', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(String(req.params.id))) {
        return res.status(400).json({ error: 'Invalid id format. Must be a valid UUID.' }) as any;
      }
      const listing = await listingRepository.findById(PUBLIC_TENANT, String(req.params.id));
      if (!listing) return res.status(404).json({ error: 'Listing not found' }) as any;
      res.json(listing);
      // Increment view count, log visitor, và tự geocode nếu thiếu tọa độ (background, non-blocking)
      const ip = getClientIp(req);
      const pl = listing as any;
      const plMissingCoords = !pl.coordinates?.lat || !pl.coordinates?.lng || (pl.coordinates.lat === 0 && pl.coordinates.lng === 0);
      if (plMissingCoords && pl.location) scheduleGeocode(PUBLIC_TENANT, String(req.params.id), pl.location);
      Promise.all([
        listingRepository.incrementViewCount(PUBLIC_TENANT, String(req.params.id)),
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
          page: `/listings/${req.params.id}`,
          listingId: String(req.params.id),
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer'],
        })),
      ]).catch(() => {});
    } catch (error) {
      console.error('Error fetching public listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
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
      const { leadId, content, direction, metadata } = req.body;
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
        metadata: metadata || {}
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
      const { leadId, message, lang } = req.body;
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

      const { aiService } = await import('./server/ai');
      const t = serverT(lang || 'vn');
      const result = await aiService.processMessage(lead, msgContent, historyWithLatest, t, PUBLIC_TENANT, lang || 'vn');

      const aiReply = await interactionRepository.create(PUBLIC_TENANT, {
        leadId,
        channel: 'WEB',
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: result.content,
        metadata: { isAgent: true, ...(result.isSysMsg ? { isSysMsg: true } : {}) }
      });
      // Notify Inbox of the AI reply so agents see the outgoing response too
      broadcastIo?.to(leadId).emit('receive_message', { room: leadId, message: aiReply });
      broadcastIo?.to(`tenant:${PUBLIC_TENANT}`).emit('new_inbound_message', { leadId, message: aiReply });

      res.json({ reply: aiReply, artifact: result.artifact, suggestedAction: result.suggestedAction });
    } catch (error) {
      logger.error('Public AI livechat error:', error as Error);
      res.status(500).json({ error: 'AI đang bận, vui lòng thử lại sau' });
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
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
      const filters: any = {};
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
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#4f46e5">📧 ${isNew ? 'Đăng ký nhận tin mới' : 'Đăng ký nhận tin (đã tồn tại)'}</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
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
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#4f46e5;color:white;padding:24px 32px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;font-size:20px">📋 Hồ Sơ Ứng Tuyển Mới — SGS LAND</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Nhận lúc ${now}</p>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse">
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:12px 8px;font-weight:700;color:#374151;width:160px">Vị trí ứng tuyển:</td>
                <td style="padding:12px 8px;color:#4f46e5;font-weight:700">${jobTitle}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Họ và tên:</td>
                <td style="padding:12px 8px">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Email:</td>
                <td style="padding:12px 8px"><a href="mailto:${email}" style="color:#4f46e5">${email}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:12px 8px;font-weight:700;color:#374151">Số điện thoại:</td>
                <td style="padding:12px 8px">${phone?.trim() || '—'}</td>
              </tr>
            </table>
            <div style="margin-top:20px;padding:20px;background:#f9fafb;border-radius:10px;border-left:4px solid #4f46e5">
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
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#4f46e5;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;font-size:20px">📋 Yêu cầu ký gửi bất động sản mới</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Nhận lúc ${now}</p>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
            <p style="margin:0 0 16px;font-weight:700;color:#374151;font-size:16px">Thông tin chủ sở hữu</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151;width:180px">Họ và tên:</td>
                <td style="padding:10px 8px">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Số điện thoại:</td>
                <td style="padding:10px 8px"><a href="tel:${phone}" style="color:#4f46e5">${phone}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Email:</td>
                <td style="padding:10px 8px">${email?.trim() ? `<a href="mailto:${email}" style="color:#4f46e5">${email}</a>` : '—'}</td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-weight:700;color:#374151;font-size:16px">Thông tin bất động sản</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151;width:180px">Loại BĐS:</td>
                <td style="padding:10px 8px">${propertyType || '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Giao dịch:</td>
                <td style="padding:10px 8px;color:#4f46e5;font-weight:700">${transactionLabel}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Địa chỉ:</td>
                <td style="padding:10px 8px">${address}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Diện tích:</td>
                <td style="padding:10px 8px">${area ? `${area} m²` : '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 8px;font-weight:700;color:#374151">Giá kỳ vọng:</td>
                <td style="padding:10px 8px">${price || '—'}</td>
              </tr>
            </table>
            ${notes?.trim() ? `
            <div style="margin-top:8px;padding:16px;background:#f9fafb;border-radius:10px;border-left:4px solid #4f46e5">
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
      { keyword: 'định giá bất động sản',         targetUrl: '/ai-valuation',              notes: 'Công cụ AI miễn phí, sai số ±5%',                searchVolume: 9900 },
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
        status: canonical ? 'pass' : 'fail',
        detail: canonical || 'Chưa khai báo',
      });

      const jsonLdNodes = $('script[type="application/ld+json"]').toArray();
      items.push({
        id: 'jsonld-count', label: 'Có ≥ 3 JSON-LD schema',
        status: jsonLdNodes.length >= 3 ? 'pass' : (jsonLdNodes.length >= 1 ? 'warn' : 'fail'),
        detail: `${jsonLdNodes.length} schema`,
      });

      const types: string[] = [];
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
        } catch { /* skip malformed */ }
      }
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

      res.json({ target, fetchedAt: new Date().toISOString(), items });
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

      res.json({
        llmsTxt,
        llmsFullTxt,
        bots,
        sitemaps: [
          { url: '/sitemap.xml', ok: sitemap.ok, status: sitemap.status },
          { url: '/sitemap-static.xml', ok: sitemapStatic.ok, status: sitemapStatic.status },
          { url: '/sitemap-images.xml', ok: sitemapImages.ok, status: sitemapImages.status },
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
  app.use('/api/sequences', apiRateLimit, createSequenceRoutes(authenticateToken));
  app.use('/api/knowledge', apiRateLimit, createKnowledgeRoutes(authenticateToken));
  app.use('/api/billing', apiRateLimit, createBillingRoutes(authenticateToken));
  app.use('/api/sessions', apiRateLimit, createSessionRoutes(authenticateToken));
  app.use('/api/templates', apiRateLimit, createTemplateRoutes(authenticateToken));
  app.use('/api/activity', apiRateLimit, createActivityRoutes(authenticateToken));
  app.use('/api/notifications', apiRateLimit, createNotificationRoutes(authenticateToken));
  app.use('/api/ai/governance', apiRateLimit, createAiGovernanceRoutes(authenticateToken, optionalAuth));
  app.use('/api/agents', apiRateLimit, createAgentRoutes(authenticateToken));
  app.use('/api/enterprise', apiRateLimit, createEnterpriseRoutes(authenticateToken, io));
  app.use('/api/upload', apiRateLimit, createUploadRoutes(authenticateToken));
  app.use('/uploads', createUploadServeRoute(authenticateToken));
  // SCIM 2.0 provisioning — uses its own Bearer token auth (no JWT required)
  app.use('/scim/v2', express.json({ type: ['application/json', 'application/scim+json'] }), createScimRoutes());
  // Advanced valuation: multi-source, 7-coefficient AVM + market cache
  app.use('/api/valuation', apiRateLimit, createValuationRoutes(authenticateToken, aiRateLimit, optionalAuth, guestValuationRateLimit, userValuationRateLimit));
  app.use('/api/connectors', apiRateLimit, createConnectorRoutes(authenticateToken));
  app.use('/api/scraper',          apiRateLimit, createScraperRoutes(authenticateToken));
  app.use('/api/scraper/projects', apiRateLimit, createScraperProjectRoutes(authenticateToken));
  // Error monitoring: frontend reports + admin query (POST is rate-limited, no auth required)
  initErrorLogRepo(pool);
  app.use('/api/error-logs', apiRateLimit, createErrorLogRoutes(authenticateToken, pool));
  // B2B2C: project management + partner access control
  app.use('/api/projects', apiRateLimit, createProjectRoutes(authenticateToken));
  app.use('/api/tenant', apiRateLimit, createTenantRoutes(authenticateToken));

  // ─── PUBLIC mini-site cho từng dự án (no auth, server-side cache 5min) ────
  // Không bọc apiRateLimit chung — endpoint này có rate limit riêng
  // (publicMicrositeLeadRateLimit) cho POST /leads. GET /:code chỉ đọc cache.
  app.use('/api/public/projects', createPublicProjectRoutes());
  // Task Management module
  app.use('/api/tasks', apiRateLimit, createTaskRoutes(authenticateToken));
  app.use('/api/departments', apiRateLimit, createDepartmentRoutes(authenticateToken));
  app.use('/api/dashboard', apiRateLimit, createTaskReportRoutes(authenticateToken));
  app.use('/api/reports', apiRateLimit, createTaskReportRoutes(authenticateToken));
  // Public lead capture for static landing pages (no auth)
  app.use('/api/landing-leads', apiRateLimit, createLandingLeadRoutes());
  app.use('/api/landing-ai', aiRateLimit, createLandingAiRoutes());

  // Lightweight health probe for deployment infrastructure (no DB call)
  app.get("/health", (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: "ok",
      version: process.env.npm_package_version || "0.0.0",
      uptime: Math.floor(process.uptime()),
    });
  });

  app.get("/api/health", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const health = await systemService.checkHealth();

      const components: Record<string, any> = {
        database: { status: health.checks?.database ? 'healthy' : 'down' },
        aiService: { status: health.checks?.aiService ? 'healthy' : 'unconfigured' },
        redis: { status: (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ? 'upstash-rest' : 'in-memory-fallback' },
        websocket: { status: 'healthy', adapter: 'in-memory' },
        queue: { status: 'healthy', type: isQStashEnabled() ? 'qstash' : 'in-memory' },
      };

      try {
        const dbCheck = await pool.query('SELECT 1');
        components.database.latencyMs = health.uptime !== undefined ? 'ok' : undefined;
        components.database.status = 'healthy';
      } catch {
        components.database.status = 'down';
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

      res.json({
        ...health,
        components,
        connectedClients: io.engine?.clientsCount || 0,
        migration_version: migrationVersion,
        queue_depth: queueDepth,
        memory_usage: memoryUsage,
        lastChecked: new Date().toISOString(),
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
      console.log(`[Zalo Webhook] Received event: ${event_name} from ${sender?.id}`);

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
      console.log(`[Facebook Webhook] Received event`);

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
        logger.warn('[Brevo Webhook] BREVO_WEBHOOK_SECRET not set — accepting request (production). Set BREVO_WEBHOOK_SECRET for security.');
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
            // Future: update lead interaction status, track opens/clicks, handle bounces
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
  // Module Chiến dịch tự động — Campaigns
  // ---------------------------------------------------------------------------
  app.use(createCampaignRouter(pool, authenticateToken));

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
      if (!process.env.DATABASE_URL) {
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
      if (!process.env.DATABASE_URL) {
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
      // neondb_owner có BYPASSRLS + row_security=off mặc định → query thẳng pool không cần transaction/role switch
      const result = await pool.query(
        `SELECT id, updated_at FROM listings
         WHERE status = 'ACTIVE'
         ORDER BY updated_at DESC LIMIT 50000`
      );
      const urls = result.rows.map((r: any) => {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/listing/${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
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
      // Chỉ liệt kê các project đã bật mini-site công khai
      // (metadata.public_microsite = 'true').
      const result = await pool.query(
        `SELECT code, updated_at FROM projects
         WHERE code IS NOT NULL
           AND code <> ''
           AND metadata->>'public_microsite' = 'true'
         ORDER BY updated_at DESC LIMIT 10000`
      );
      const urls = result.rows.map((r: any) => {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        const code = String(r.code).replace(/[^A-Za-z0-9_-]/g, '');
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/p/${code}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>`;
      }).join('\n');
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
      // neondb_owner có BYPASSRLS + row_security=off mặc định → query thẳng pool
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

  // Serve public assets (widget.js, QR codes, etc.) in all environments
  app.use(express.static("public"));

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
    const { getBaseHtml, injectMeta, buildListingMeta, buildArticleMeta, buildStaticPageMeta } =
      await import('./server/seo/metaInjector');

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
        res.send(html);
      } catch {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      }
    };

    // /listing/:id → inject listing-specific meta (singular, matching ROUTES.LISTING)
    app.get('/listing/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const listing = await listingRepository.findById(DEFAULT_TENANT_ID, String(req.params.id));
        if (!listing) return next();
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
        if (!article) return next();
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
    ] as const;
    for (const route of LOCAL_LANDING_ROUTES) {
      app.get(route, (_req: express.Request, res: express.Response) => {
        sendMeta(res, buildStaticPageMeta(null, null, null, route));
      });
    }
    app.get('/du-an/:projectSlug', (req: express.Request, res: express.Response) => {
      const pagePath = `/du-an/${req.params.projectSlug}`;
      sendMeta(res, buildStaticPageMeta(null, null, null, pagePath));
    });

    // /p/:code → SSR meta cho mini-site công khai (Facebook/Zalo/Twitter crawler).
    // Tokens (proposal/contract) không inject project meta — fall through để
    // SPA xử lý. Chỉ xử lý khi token match pattern PROJECT CODE (uppercase).
    app.get('/p/:code', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const raw = String(req.params.code || '');
      // Project codes: uppercase + digits + dashes/underscores. Proposal/contract
      // tokens là UUID/lowercase hoặc có prefix `contract_` → skip để SPA xử lý.
      if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(raw)) return next();
      try {
        const result = await pool.query(
          `SELECT name, code, description, location, metadata
             FROM projects
             WHERE code = $1
               AND metadata->>'public_microsite' = 'true'
             LIMIT 1`,
          [raw]
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
        sendMeta(res, {
          title: `${row.name} — Mini-site dự án | SGS LAND`,
          description: desc,
          h1: row.name,
          image: cover || undefined,
          url: `${APP_SITEMAP_URL}/p/${row.code}`,
          type: 'website',
          structuredData: {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: row.name,
            description: desc,
            url: `${APP_SITEMAP_URL}/p/${row.code}`,
            ...(cover ? { image: cover } : {}),
            ...(row.location ? { address: { '@type': 'PostalAddress', streetAddress: row.location, addressCountry: 'VN' } } : {}),
          },
        });
      } catch (err) {
        logger.error('[PublicProject SSR] meta fetch failed:', err);
        next();
      }
    });

    // All other SPA routes → inject admin-saved override or fallback to defaults
    // Long-lived cache for hashed assets (JS/CSS chunks have content hash in filename)
    app.use(express.static("dist", {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        // HTML should never be cached long-term (SPA shell changes on redeploy)
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      },
    }));
    app.use(async (req: express.Request, res: express.Response) => {
      try {
        // Derive route key from pathname: strip leading "/"
        const routeKey = req.path.replace(/^\//, '').split('/')[0] || '';
        const result = await pool.query(
          'SELECT title, description, og_image FROM seo_overrides WHERE route_key = $1',
          [routeKey]
        );
        const row = result.rows[0];
        const meta = buildStaticPageMeta(
          row?.title,
          row?.description,
          row?.og_image,
          req.path
        );
        sendMeta(res, meta, false); // no-cache: SPA shell must always be fresh after redeploy
      } catch {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      }
    });
  }

  app.use(errorHandler);

  server.listen(PORT, "0.0.0.0", async () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    // Đăng ký QStash daily schedule cho RLHF recompute
    if (isQStashEnabled()) {
      try {
        const qstashToken = process.env.QSTASH_TOKEN!;
        const rlhfSecret = process.env.RLHF_CRON_SECRET || process.env.JWT_SECRET?.slice(0, 32) || '';
        const devDomain = process.env.REPLIT_DEV_DOMAIN;
        const prodDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
        const appDomain = prodDomain || devDomain;
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
        const appDomain2  = prodDomain2 || devDomain2;

        if (appDomain2 && engagementSecret) {
          const engScheduleId  = 'engagement-email-daily';
          const engScheduleUrl = `https://${appDomain2}/api/internal/engagement-email-cron`;
          const engQstashEp    = `https://qstash.upstash.io/v2/schedules/${engScheduleId}`;
          const qstashToken    = process.env.QSTASH_TOKEN!;
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
        const appDomain3  = prodDomain3 || devDomain3;

        if (appDomain3 && backupSecret) {
          const bkScheduleId  = 'backup-db-daily';
          const bkScheduleUrl = `https://${appDomain3}/api/internal/backup-cron`;
          const bkQstashEp    = `https://qstash.upstash.io/v2/schedules/${bkScheduleId}`;
          const qstashToken   = process.env.QSTASH_TOKEN!;
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
        const appDomain4  = prodDomain4 || devDomain4;

        if (appDomain4 && priceRefreshSecret) {
          const prScheduleId  = 'listing-price-refresh-daily';
          const prScheduleUrl = `https://${appDomain4}/api/internal/listing-price-refresh`;
          const prQstashEp    = `https://qstash.upstash.io/v2/schedules/${prScheduleId}`;
          const prBody        = JSON.stringify({ secret: priceRefreshSecret, tenantId: 'all' });

          const prResp = await fetch(prQstashEp, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.QSTASH_TOKEN!}`,
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
    }
  });

  const shutdown = async (signal: string) => {
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
      try {
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

  // Prevent uncaught exceptions from crashing the server (log and continue where safe)
  process.on('uncaughtException', (err: Error) => {
    logger.error(`[Server] Uncaught exception: ${err.message}\n${err.stack}`);
    // Only exit on truly fatal errors; most async errors should not crash the process
    if ((err as any).code === 'ERR_USE_AFTER_CLOSE') return;
  });
}

startServer();
