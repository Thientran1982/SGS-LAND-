import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import http from "http";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import { initializeDatabase, pool, withTenantContext } from "./server/db";
import { systemService } from "./server/services/systemService";
import { webhookQueue, setupWebhookWorker } from "./server/queue";
import { userRepository } from "./server/repositories/userRepository";
import { listingRepository } from "./server/repositories/listingRepository";
import { leadRepository } from "./server/repositories/leadRepository";
import { articleRepository } from "./server/repositories/articleRepository";
import { createLeadRoutes } from "./server/routes/leadRoutes";
import { createListingRoutes } from "./server/routes/listingRoutes";
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
import { createBillingRoutes } from "./server/routes/billingRoutes";
import { createUploadRoutes, createUploadServeRoute } from "./server/routes/uploadRoutes";
import { createScimRoutes } from "./server/routes/scimRoutes";
import { createValuationRoutes } from "./server/routes/valuationRoutes";
import { createProjectRoutes } from "./server/routes/projectRoutes";
import { marketDataService } from "./server/services/marketDataService";
import { securityHeaders, corsMiddleware, verifyWebhookSignature, preventParamPollution } from "./server/middleware/security";
import { errorHandler } from "./server/middleware/errorHandler";
import { sanitizeInput, validateBody, schemas } from "./server/middleware/validation";
import { aiRateLimit, authRateLimit, webhookRateLimit, apiRateLimit, publicLeadRateLimit } from "./server/middleware/rateLimiter";
import { logger, requestLogger } from "./server/middleware/logger";
import { writeAuditLog } from "./server/middleware/auditLog";
import { DEFAULT_TENANT_ID } from "./server/constants";
import { interactionRepository } from "./server/repositories/interactionRepository";
import { sessionRepository } from "./server/repositories/sessionRepository";
import { visitorRepository } from "./server/repositories/visitorRepository";
import { lookupIp, getClientIp } from "./server/services/geoService";

async function startServer() {
  const app = express();
  const PORT = 5000;

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use('/api/webhooks', express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(preventParamPollution);
  app.use(sanitizeInput);
  app.use(requestLogger);

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
      // A raw pool.query() without tenant context always returns 0 rows (RLS blocks them),
      // causing every registration to incorrectly receive the ADMIN role.
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
      });

      const jwtPayload = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        tenantId,
      };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, cookieOptions);
      res.json({ message: 'Registered successfully', user: userRepository.toPublicUser(dbUser), token });

      emailService.sendWelcomeEmail(tenantId, email, dbUser.name).catch(err => {
        logger.error(`Failed to send welcome email to ${email}: ${err.message}`);
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
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
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      await pool.query(
        `INSERT INTO password_reset_tokens (tenant_id, user_id, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, user.id, tokenHash, expiresAt]
      );

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/#/reset-password/${rawToken}`;

      const emailResult = await emailService.sendPasswordResetEmail(tenantId, email, resetUrl, user.name);
      if (!emailResult.success) {
        logger.error(`Failed to send password reset email to ${email}: ${emailResult.error}`);
      }

      writeAuditLog(tenantId, user.id, 'PASSWORD_RESET_REQUEST', 'auth', user.id, { email }, req.ip);
      await uniformDelay();
      const isDevMode = !isProduction && emailResult.messageId?.startsWith('console-');
      res.json({
        message: 'If an account exists, a reset link has been sent.',
        ...(isDevMode && { devToken: rawToken }),
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
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const userId = result.rows[0].user_id;

      const userResult = await pool.query(`SELECT tenant_id FROM users WHERE id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({ error: 'User not found' });
      }
      const tenantId = userResult.rows[0].tenant_id;

      await userRepository.updatePassword(tenantId, userId, newPassword);

      writeAuditLog(tenantId, userId, 'PASSWORD_RESET_COMPLETE', 'auth', userId, undefined, req.ip);
      res.json({ message: 'Password has been reset successfully' });
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
      const t = (k: string) => k; // Mock translation for backend
      const result = await aiService.processMessage(lead, userMessage, history, t, tenantId);
      res.json(result);
    } catch (error) {
      console.error('AI process message error:', error);
      res.status(500).json({ error: 'AI processing failed' });
    }
  });

  app.post("/api/ai/score-lead", authenticateToken, aiRateLimit, validateBody(schemas.aiScoreLead), async (req, res) => {
    try {
      const { leadData, messageContent, weights, lang } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.scoreLead(leadData, messageContent, weights, lang);

      if (result && leadData?.id) {
        const tenantId = (req as any).tenantId;
        try {
          await leadRepository.update(tenantId, leadData.id, {
            score: { score: result.score || result.totalScore, grade: result.grade, reasoning: result.reasoning },
          }, (req as any).user?.id, (req as any).user?.role || 'ADMIN');
          logger.info(`AI score persisted for lead ${leadData.id}: ${result.score || result.totalScore}`);
        } catch (e) {
          logger.warn(`Could not persist AI score for lead ${leadData.id}`);
        }
      }

      res.json(result);
    } catch (error) {
      logger.error('AI score lead error:', error);
      res.status(500).json({ error: 'AI scoring failed' });
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

      const result = await aiService.summarizeLead(lead, interactions || [], lang);
      res.json({ summary: result });
    } catch (error) {
      logger.error('AI summarize lead error:', error);
      res.status(500).json({ error: 'AI summarization failed' });
    }
  });

  app.post("/api/ai/valuation", aiRateLimit, validateBody(schemas.aiValuation), async (req, res) => {
    try {
      const { address, area, roadWidth, legal, propertyType } = req.body;
      const { aiService } = await import('./server/ai');

      // Run AI valuation in parallel with cache warm-up (non-blocking)
      const [result] = await Promise.all([
        aiService.getRealtimeValuation(address, area, roadWidth, legal, propertyType),
        // Populate/warm the market data cache from this request (fire-and-forget)
        marketDataService.getMarketData(address).catch(() => null),
      ]);

      res.json(result);
    } catch (error) {
      logger.error('AI valuation error:', error);
      res.status(500).json({ error: 'AI valuation failed' });
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
      console.error('AI generate content error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'AI generation failed' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'AI generation failed' })}\n\n`);
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
      console.error('AI embed content error:', error);
      res.status(500).json({ error: 'AI embedding failed' });
    }
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : undefined;

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins || (isProduction ? false : true),
      methods: ["GET", "POST"],
      credentials: true
    }
  });

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

  // Setup BullMQ Worker
  setupWebhookWorker(io);

  // Start market data service — in-memory cache with 6h TTL + background refresh
  marketDataService.start(io);

  // Redis Adapter Setup
  if (process.env.REDIS_URL) {
    try {
      const redisUrl = process.env.REDIS_URL;
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => console.warn('Redis pubClient error:', err.message));
      subClient.on('error', (err) => console.warn('Redis subClient error:', err.message));

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Redis adapter connected successfully for Socket.io");
    } catch (err: any) {
      console.warn("Redis connection failed, falling back to in-memory adapter:", err.message);
    }
  } else {
    console.log("No REDIS_URL provided, using in-memory adapter for Socket.io");
  }

  // Initialize DB schema
  if (process.env.DATABASE_URL) {
    await initializeDatabase();
  } else {
    console.warn("DATABASE_URL not set. Skipping database initialization.");
  }

  const PUBLIC_TENANT = DEFAULT_TENANT_ID;

  app.get('/api/public/listings', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 200);
      const filters: any = { status_in: ['AVAILABLE', 'OPENING', 'BOOKING'] };
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
      const listing = await listingRepository.findById(PUBLIC_TENANT, req.params.id);
      if (!listing) return res.status(404).json({ error: 'Listing not found' }) as any;
      res.json(listing);
      // Increment view count and log visitor in background (non-blocking)
      const ip = getClientIp(req);
      Promise.all([
        listingRepository.incrementViewCount(PUBLIC_TENANT, req.params.id),
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
          listingId: req.params.id,
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
      const { name, phone, notes, source, stage } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'name và phone là bắt buộc' }) as any;
      const lead = await leadRepository.create(PUBLIC_TENANT, {
        name: String(name).trim().slice(0, 100),
        phone: String(phone).trim().slice(0, 20),
        notes: notes ? String(notes).slice(0, 2000) : undefined,
        source: source || 'WEBSITE',
        stage: stage || 'NEW',
      });
      // Return only non-sensitive confirmation — never expose PII to anonymous callers
      res.status(201).json({ id: lead.id, success: true });
    } catch (error) {
      console.error('Error creating public lead:', error);
      res.status(500).json({ error: 'Không thể tạo yêu cầu, vui lòng thử lại' });
    }
  });

  // Public AI endpoint: LiveChat widget AI reply (no auth required — uses rate limiting only)
  app.post('/api/public/ai/livechat', publicLeadRateLimit, aiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const { leadId, message, lang } = req.body;
      if (!leadId || !String(message || '').trim()) {
        return res.status(400).json({ error: 'leadId và message là bắt buộc' }) as any;
      }
      const msgContent = String(message).trim().slice(0, 2000);

      const lead = await leadRepository.findById(PUBLIC_TENANT, leadId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' }) as any;

      const history = await interactionRepository.findByLead(PUBLIC_TENANT, leadId);

      const { aiService } = await import('./server/ai');
      const t = (k: string) => k;
      const result = await aiService.processMessage(lead, msgContent, history, t, PUBLIC_TENANT);

      const aiReply = await interactionRepository.create(PUBLIC_TENANT, {
        leadId,
        channel: 'WEB',
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: result.content,
        metadata: { isAgent: true }
      });

      res.json({ reply: aiReply, artifact: result.artifact, suggestedAction: result.suggestedAction });
    } catch (error) {
      console.error('Public AI livechat error:', error);
      res.status(500).json({ error: 'AI đang bận, vui lòng thử lại sau' });
    }
  });

  app.get('/api/public/articles', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
      const filters: any = {};
      if (req.query.category) filters.category = req.query.category;
      if (req.query.search) filters.search = req.query.search;
      const result = await articleRepository.findArticles(PUBLIC_TENANT, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching public articles:', error);
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  });

  app.get('/api/public/articles/:id', apiRateLimit, async (req: express.Request, res: express.Response) => {
    try {
      const article = await articleRepository.findById(PUBLIC_TENANT, req.params.id);
      if (!article) return res.status(404).json({ error: 'Article not found' }) as any;
      res.json(article);
    } catch (error) {
      console.error('Error fetching public article:', error);
      res.status(500).json({ error: 'Failed to fetch article' });
    }
  });

  app.use('/api/leads', apiRateLimit, createLeadRoutes(authenticateToken));
  app.use('/api/listings', apiRateLimit, createListingRoutes(authenticateToken));
  app.use('/api/proposals', apiRateLimit, createProposalRoutes(authenticateToken));
  app.use('/api/contracts', apiRateLimit, createContractRoutes(authenticateToken));
  app.use('/api/inbox', apiRateLimit, createInteractionRoutes(authenticateToken));
  app.use('/api/users', apiRateLimit, createUserRoutes(authenticateToken));
  app.use('/api/analytics', apiRateLimit, createAnalyticsRoutes(authenticateToken));
  app.use('/api/scoring', apiRateLimit, createScoringRoutes(authenticateToken));
  app.use('/api/routing-rules', apiRateLimit, createRoutingRuleRoutes(authenticateToken));
  app.use('/api/sequences', apiRateLimit, createSequenceRoutes(authenticateToken));
  app.use('/api/knowledge', apiRateLimit, createKnowledgeRoutes(authenticateToken));
  app.use('/api/billing', apiRateLimit, createBillingRoutes(authenticateToken));
  app.use('/api/sessions', apiRateLimit, createSessionRoutes(authenticateToken));
  app.use('/api/templates', apiRateLimit, createTemplateRoutes(authenticateToken));
  app.use('/api/ai/governance', apiRateLimit, createAiGovernanceRoutes(authenticateToken));
  app.use('/api/enterprise', apiRateLimit, createEnterpriseRoutes(authenticateToken));
  app.use('/api/upload', apiRateLimit, createUploadRoutes(authenticateToken));
  app.use('/uploads', createUploadServeRoute(authenticateToken));
  // SCIM 2.0 provisioning — uses its own Bearer token auth (no JWT required)
  app.use('/scim/v2', express.json({ type: ['application/json', 'application/scim+json'] }), createScimRoutes());
  // Advanced valuation: multi-source, 7-coefficient AVM + market cache
  app.use('/api/valuation', apiRateLimit, createValuationRoutes(authenticateToken, aiRateLimit));
  // B2B2C: project management + partner access control
  app.use('/api/projects', apiRateLimit, createProjectRoutes(authenticateToken));

  app.get("/api/health", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const health = await systemService.checkHealth();

      const components: Record<string, any> = {
        database: { status: health.checks?.database ? 'healthy' : 'down' },
        aiService: { status: health.checks?.aiService ? 'healthy' : 'unconfigured' },
        redis: { status: process.env.REDIS_URL ? 'healthy' : 'in-memory-fallback' },
        websocket: { status: 'healthy', adapter: process.env.REDIS_URL ? 'redis' : 'in-memory' },
        queue: { status: 'healthy', type: process.env.REDIS_URL ? 'bullmq' : 'in-memory' },
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

      // Queue depth (BullMQ only)
      let queueDepth: number | null = null;
      try {
        if (webhookQueue?.getWaitingCount) {
          queueDepth = await webhookQueue.getWaitingCount();
        }
      } catch { /* ignore */ }

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

  // Real server-side traffic metrics (no auth required — public status endpoint)
  app.get("/api/system/metrics", async (_req, res) => {
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
  // Required env var: EMAIL_WEBHOOK_TOKEN (optional — skip if not set)
  // Set it in your email provider dashboard as a header or query param.
  // ──────────────────────────────────────────────────────────────────────────

  app.post("/api/webhooks/email", webhookRateLimit, async (req, res) => {
    try {
      // Optional token-based auth (simple shared secret)
      const configuredToken = process.env.EMAIL_WEBHOOK_TOKEN;
      if (configuredToken) {
        const incoming =
          req.headers['x-webhook-token'] ||
          req.headers['x-mail-token'] ||
          req.query.token;
        if (incoming !== configuredToken) {
          return res.status(403).json({ error: 'Invalid webhook token' });
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
        payload: { from, fromName, subject, body: emailBody, to },
      });

      // Most email providers expect a 200 response quickly
      res.status(200).json({ message: 'OK' });
    } catch (error) {
      console.error('[Email Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
    console.log(`User connected: ${socket.id} (auth: ${isAuthenticated})`);

    socket.on("join_room", (room) => {
      if (!socket.data.authUser) return;
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);
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
      socket.broadcast.emit("lead_updated", data);
    }));

    socket.on("lead_created", requireAuth((data) => {
      socket.broadcast.emit("lead_created", data);
    }));

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
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

  // Serve public assets (widget.js, QR codes, etc.) in all environments
  app.use(express.static("public"));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.use(errorHandler);

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await webhookQueue.close();
        logger.info('BullMQ queue closed.');
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
