import express from "express";
import path from "path";
import { Server } from "socket.io";
import http from "http";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import { pool, withTenantContext } from "./server/db";
import { runPendingMigrations } from "./server/migrations/runner";
import { systemService } from "./server/services/systemService";
import { webhookQueue, setupWebhookWorker, processWebhookJob, isQStashEnabled } from "./server/queue";
import { userRepository } from "./server/repositories/userRepository";
import { listingRepository } from "./server/repositories/listingRepository";
import { leadRepository } from "./server/repositories/leadRepository";
import { feedbackRepository } from "./server/repositories/feedbackRepository";
import { articleRepository } from "./server/repositories/articleRepository";
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
import { createSessionRoutes, createTemplateRoutes } from "./server/routes/sessionRoutes";
import { createActivityRoutes } from "./server/routes/activityRoutes";
import { createNotificationRoutes } from "./server/routes/notificationRoutes";
import { createBillingRoutes } from "./server/routes/billingRoutes";
import { createUploadRoutes, createUploadServeRoute } from "./server/routes/uploadRoutes";
import { createScimRoutes } from "./server/routes/scimRoutes";
import { createValuationRoutes } from "./server/routes/valuationRoutes";
import { createProjectRoutes } from "./server/routes/projectRoutes";
import { createTenantRoutes } from "./server/routes/tenantRoutes";
import { createTaskRoutes } from "./server/routes/taskRoutes";
import { createDepartmentRoutes } from "./server/routes/departmentRoutes";
import { createTaskReportRoutes } from "./server/routes/taskReportRoutes";
import { createConnectorRoutes } from "./server/routes/connectorRoutes";
import { marketDataService } from "./server/services/marketDataService";
import { securityHeaders, corsMiddleware, verifyWebhookSignature, preventParamPollution } from "./server/middleware/security";
import { errorHandler } from "./server/middleware/errorHandler";
import { sanitizeInput, validateBody, schemas } from "./server/middleware/validation";
import { aiRateLimit, authRateLimit, webhookRateLimit, apiRateLimit, publicLeadRateLimit, livechatRateLimit, guestValuationRateLimit } from "./server/middleware/rateLimiter";
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

/**
 * Resolve the canonical base URL for email links and external callbacks.
 * Priority: APP_URL env var (explicit production override)
 *   → REPLIT_DOMAINS first entry (Replit production domain, e.g. sgs-land.replit.app)
 *   → REPLIT_DEV_DOMAIN (Replit dev proxy domain)
 *   → req.protocol + host header (last resort / self-hosted)
 */
function resolveBaseUrl(req: express.Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return `${req.protocol}://${req.get('host')}`;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '5000', 10);

  app.use(securityHeaders);
  app.use(corsMiddleware);
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
      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;

      let dbUser = await userRepository.authenticate(tenantId, email, password);

      if (!dbUser) {
        writeAuditLog(tenantId, email, 'LOGIN_FAILED', 'auth', undefined, { email }, req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Block login if email not yet verified (only for self-registered users)
      if (!dbUser.emailVerified && dbUser.source === 'REGISTER') {
        return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', email: dbUser.email });
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
      const verifyUrl = `${baseUrl}/#/verify-email/${rawToken}`;

      const verifyResult = await emailService.sendVerificationEmail(tenantId, email, dbUser.name, verifyUrl).catch(err => {
        logger.error(`Failed to send verification email to ${email}: ${err.message}`);
        return { success: false, status: 'failed' as const, error: err.message };
      });

      writeAuditLog(tenantId, dbUser.id, 'REGISTER', 'auth', dbUser.id, { email, emailSent: verifyResult.success }, req.ip);

      // In dev mode without SMTP/Brevo, expose the raw token so developer can test
      const isDevMode = !isProduction && verifyResult.status === 'queued_no_smtp';

      res.json({
        message: 'Registration successful. Please verify your email to continue.',
        needsVerification: true,
        email: dbUser.email,
        emailStatus: verifyResult.status,
        ...(isDevMode && { devVerifyToken: rawToken, devVerifyUrl: verifyUrl }),
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // ── Email Verification ──────────────────────────────────────────────────────
  app.get("/api/auth/verify-email", authRateLimit, async (req, res) => {
    try {
      const rawToken = (req.query.token as string)?.trim();
      if (!rawToken) return res.status(400).json({ error: 'Verification token is required' });

      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tenantId = DEFAULT_TENANT_ID;

      // Look up user by verification token
      const user = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(
          `SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()`,
          [tokenHash]
        );
        return r.rows[0] ? userRepository['rowToEntity']<any>(r.rows[0]) : null;
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Mark email as verified and activate the account
      await withTenantContext(tenantId, async (client) => {
        await client.query(
          `UPDATE users SET email_verified = TRUE, status = 'ACTIVE', email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1`,
          [user.id]
        );
      });

      // Issue JWT so user is immediately logged in
      const jwtPayload = { id: user.id, email: user.email, name: user.name, role: user.role, tenantId };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);

      await userRepository.updateLastLogin(tenantId, user.id);
      writeAuditLog(tenantId, user.id, 'EMAIL_VERIFIED', 'auth', user.id, { email: user.email }, req.ip);

      // Send welcome email now that verification is complete
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

      const tenantId = DEFAULT_TENANT_ID;
      const user = await userRepository.findByEmail(tenantId, email);

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
          [tokenHash, tokenExpires, user.id]
        );
      });

      const baseUrl = resolveBaseUrl(req);
      const verifyUrl = `${baseUrl}/#/verify-email/${rawToken}`;

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

      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      const user = await userRepository.findByEmail(tenantId, email);

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
      const resetUrl = `${baseUrl}/#/reset-password/${rawToken}`;

      const emailResult = await emailService.sendPasswordResetEmail(tenantId, email, resetUrl, user.name);
      if (emailResult.status === 'failed') {
        logger.error(`Failed to send password reset email to ${email}: ${emailResult.error}`);
      } else if (emailResult.status === 'queued_no_smtp') {
        logger.warn(`Password reset email for ${email} not sent — SMTP not configured.`);
      }

      writeAuditLog(tenantId, user.id, 'PASSWORD_RESET_REQUEST', 'auth', user.id, { email }, req.ip);
      await uniformDelay();
      // Uniform response regardless of whether user exists or email was sent.
      // No devToken exposed — reset link is always delivered via email only.
      if (emailResult.status === 'queued_no_smtp' || emailResult.status === 'failed') {
        logger.warn(`[ForgotPassword] Email not delivered for ${email} — status: ${emailResult.status}. Check BREVO_FROM_EMAIL / SMTP config.`);
      }
      res.json({
        message: 'If an account exists, a reset link has been sent.',
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
      const tenantId = DEFAULT_TENANT_ID;

      const pwUpdated = await userRepository.updatePassword(tenantId, userId, newPassword);
      if (!pwUpdated) {
        return res.status(500).json({ error: 'Failed to update password' });
      }

      // Activate invited users who are still PENDING — they've now set their password
      await withTenantContext(tenantId, async (client) => {
        await client.query(
          `UPDATE users SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING'`,
          [userId]
        );
      });

      const userRow = await pool.query(
        `SELECT email FROM users WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );
      const userEmail = userRow.rows[0]?.email || '';

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
      const { aiService } = await import('./server/ai');
      const t = serverT(lang || 'vn');
      const result = await aiService.processMessage(lead, userMessage, history, t, tenantId, lang || 'vn');
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

  app.post("/api/ai/summarize-lead", authenticateToken, aiRateLimit, async (req, res) => {
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
      res.json({ summary: result });
    } catch (error) {
      sendAiError(res, error, 'summarize-lead');
    }
  });

  app.post("/api/ai/valuation", optionalAuth, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const limiter = (req as any).user ? aiRateLimit : guestValuationRateLimit;
    return limiter(req, res, next);
  }, validateBody(schemas.aiValuation), async (req, res) => {
    try {
      const {
        address, area, roadWidth, legal, propertyType,
        // Advanced AVM inputs (Kfl, Kdir, Kmf, Kfurn, Kage, Kbr)
        floorLevel, direction, frontageWidth, furnishing, monthlyRent, buildingAge, bedrooms,
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
        }),
        // Populate/warm the market data cache from this request (fire-and-forget)
        marketDataService.getMarketData(address).catch(() => null),
      ]);

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
  } else {
    console.warn("DATABASE_URL not set. Skipping database migrations.");
  }

  const PUBLIC_TENANT = DEFAULT_TENANT_ID;

  app.get('/api/public/listings', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 200);
      const hasProjectCode = !!req.query.projectCode;
      const filters: any = { status_in: ['AVAILABLE', 'OPENING', 'BOOKING'] };
      if (!hasProjectCode) filters.noProjectCode = true;
      if (hasProjectCode) filters.projectCode = req.query.projectCode as string;
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.types) filters.type_in = (req.query.types as string).split(',');
      if (req.query.transaction) filters.transaction = req.query.transaction as string;
      if (req.query.priceMin) filters.price_gte = parseFloat(req.query.priceMin as string);
      if (req.query.priceMax) filters.price_lte = parseFloat(req.query.priceMax as string);
      if (req.query.search) filters.search = req.query.search as string;
      const result = await listingRepository.findListings(PUBLIC_TENANT, { page, pageSize }, filters);
      res.json(result);
      // Log visitor in background (only page 1, to avoid spamming on pagination)
      if (page === 1) {
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

  // Redirect /livechat (no hash) → /#/livechat so QR codes & embed links work with hash-router
  app.get('/livechat', (_req: express.Request, res: express.Response) => {
    res.redirect('/#/livechat');
  });

  // Public LiveChat: get messages for a lead session (no auth — rate limited)
  app.get('/api/public/livechat/messages/:leadId', livechatRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const leadId = req.params.leadId as string;
      if (!leadId) return res.status(400).json({ error: 'leadId bắt buộc' }) as any;
      const lead = await leadRepository.findById(PUBLIC_TENANT, leadId);
      if (!lead) return res.status(404).json({ error: 'Phiên chat không tồn tại' }) as any;
      const messages = await interactionRepository.findByLead(PUBLIC_TENANT, leadId);
      res.json({ messages: messages || [], lead: { id: lead.id, name: lead.name, assignedTo: lead.assignedTo || null } });
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
        metadata: { isAgent: true }
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
      const article = await articleRepository.findById(PUBLIC_TENANT, String(req.params.id));
      if (!article) return res.status(404).json({ error: 'Article not found' }) as any;
      res.json(normalizeArticle(article));
    } catch (error) {
      console.error('Error fetching public article:', error);
      res.status(500).json({ error: 'Failed to fetch article' });
    }
  });

  // Public contact form — sends email to info@sgsland.vn
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

      const subjectLine = subject
        ? `[Liên Hệ] ${subject} — ${name}`
        : `[Liên Hệ] Tin nhắn từ ${name}`;

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#4f46e5">Tin nhắn mới từ trang Liên Hệ</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:bold;color:#555">Họ tên:</td><td style="padding:8px">${name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">Email:</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555">Chủ đề:</td><td style="padding:8px">${subject || '—'}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px;border-left:4px solid #4f46e5">
            <strong style="color:#555">Nội dung:</strong>
            <p style="margin-top:8px;white-space:pre-wrap">${message}</p>
          </div>
          <p style="margin-top:24px;color:#888;font-size:12px">— SGS Land CRM · info@sgsland.vn</p>
        </div>`;

      await emailService.sendEmail(DEFAULT_TENANT_ID, {
        to: 'info@sgsland.vn',
        subject: subjectLine,
        html,
      });

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
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Chỉ ADMIN mới có thể cập nhật SEO' }) as any;
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
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Chỉ ADMIN mới có thể xóa SEO override' }) as any;
    }
    try {
      await pool.query('DELETE FROM seo_overrides WHERE route_key = $1', [req.params.key]);
      res.json({ success: true });
    } catch (err) {
      console.error('[SEO] DELETE override error:', err);
      res.status(500).json({ error: 'Failed to delete SEO override' });
    }
  });

  app.use('/api/leads', apiRateLimit, createLeadRoutes(authenticateToken));
  app.use('/api/listings', apiRateLimit, createListingRoutes(authenticateToken));
  app.use('/api/proposals', apiRateLimit, createProposalRoutes(authenticateToken, () => broadcastIo));
  app.use('/api/contracts', apiRateLimit, createContractRoutes(authenticateToken));
  app.use('/api/inbox', apiRateLimit, createInteractionRoutes(authenticateToken));
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
  app.use('/api/ai/governance', apiRateLimit, createAiGovernanceRoutes(authenticateToken));
  app.use('/api/enterprise', apiRateLimit, createEnterpriseRoutes(authenticateToken, io));
  app.use('/api/upload', apiRateLimit, createUploadRoutes(authenticateToken));
  app.use('/uploads', createUploadServeRoute(authenticateToken));
  // SCIM 2.0 provisioning — uses its own Bearer token auth (no JWT required)
  app.use('/scim/v2', express.json({ type: ['application/json', 'application/scim+json'] }), createScimRoutes());
  // Advanced valuation: multi-source, 7-coefficient AVM + market cache
  app.use('/api/valuation', apiRateLimit, createValuationRoutes(authenticateToken, aiRateLimit));
  app.use('/api/connectors', apiRateLimit, createConnectorRoutes(authenticateToken));
  // B2B2C: project management + partner access control
  app.use('/api/projects', apiRateLimit, createProjectRoutes(authenticateToken));
  app.use('/api/tenant', apiRateLimit, createTenantRoutes(authenticateToken));
  // Task Management module
  app.use('/api/tasks', apiRateLimit, createTaskRoutes(authenticateToken));
  app.use('/api/departments', apiRateLimit, createDepartmentRoutes(authenticateToken));
  app.use('/api/dashboard', apiRateLimit, createTaskReportRoutes(authenticateToken));
  app.use('/api/reports', apiRateLimit, createTaskReportRoutes(authenticateToken));

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

  // Real server-side traffic metrics (requires authentication)
  app.get("/api/system/metrics", authenticateToken, async (_req, res) => {
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

  app.get('/sitemap-news.xml', async (_req: express.Request, res: express.Response) => {
    try {
      const result = await pool.query(
        `SELECT id, updated_at, published_at FROM articles
         WHERE status = 'PUBLISHED'
         ORDER BY published_at DESC LIMIT 50000`
      );
      const urls = result.rows.map((r: any) => {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : TODAY;
        return `  <url>\n    <loc>${APP_SITEMAP_URL}/news/${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.70</priority>\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
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

    // Helper that sends injected HTML
    const sendMeta = (res: express.Response, meta: Parameters<typeof injectMeta>[1]) => {
      try {
        const html = injectMeta(getBaseHtml(), meta);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
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

    // /news/:id → inject article-specific meta
    app.get('/news/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const article = await articleRepository.findById(DEFAULT_TENANT_ID, String(req.params.id));
        if (!article) return next();
        sendMeta(res, buildArticleMeta(article));
      } catch { next(); }
    });

    // All other SPA routes → inject admin-saved override or fallback to defaults
    app.use(express.static("dist"));
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
        sendMeta(res, meta);
      } catch {
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
}

startServer();
