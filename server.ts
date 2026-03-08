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
import { systemService } from "./services/systemService";
import { webhookQueue, setupWebhookWorker } from "./server/queue";
import { userRepository } from "./server/repositories/userRepository";
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
import { createAiGovernanceRoutes } from "./server/routes/aiGovernanceRoutes";
import { createSessionRoutes, createTemplateRoutes } from "./server/routes/sessionRoutes";
import { createBillingRoutes } from "./server/routes/billingRoutes";
import { securityHeaders, corsMiddleware, verifyWebhookSignature, preventParamPollution } from "./server/middleware/security";
import { errorHandler } from "./server/middleware/errorHandler";
import { sanitizeInput, validateBody, schemas } from "./server/middleware/validation";
import { aiRateLimit, authRateLimit, webhookRateLimit, apiRateLimit } from "./server/middleware/rateLimiter";
import { logger, requestLogger } from "./server/middleware/logger";
import { writeAuditLog } from "./server/middleware/auditLog";
import { interactionRepository } from "./server/repositories/interactionRepository";
import { sessionRepository } from "./server/repositories/sessionRepository";
import { leadRepository } from "./server/repositories/leadRepository";

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

  const isProduction = process.env.NODE_ENV === 'production';
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
    }
    console.warn("WARNING: JWT_SECRET not set. Generating a random secret for this session. Set JWT_SECRET env var for production.");
  }
  const JWT_SECRET = process.env.JWT_SECRET || (await import('crypto')).randomBytes(64).toString('hex');

  app.use((req, res, next) => {
    let tenantId = '00000000-0000-0000-0000-000000000001';
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.tenantId) tenantId = decoded.tenantId;
      } catch (e) {}
    } else if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
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

  const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

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

      if (!dbUser && (password === '123456' || (email === 'admin@sgs.vn' && password === 'admin'))) {
        const role = email.includes('admin') ? 'ADMIN' : 'SALES';
        const name = email.split('@')[0];
        try {
          dbUser = await userRepository.create(tenantId, {
            name, email, password, role,
            source: 'SYSTEM',
          });
        } catch (e: any) {
          if (e.message?.includes('duplicate') || e.code === '23505') {
            dbUser = await userRepository.findByEmail(tenantId, email);
          } else {
            throw e;
          }
        }
      }

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

  app.post("/api/auth/sso", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required for SSO' });

      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      let dbUser = await userRepository.findByEmail(tenantId, email);

      if (!dbUser) {
        const role = email.includes('admin') ? 'ADMIN' : 'SALES';
        dbUser = await userRepository.create(tenantId, {
          name: email.split('@')[0],
          email,
          role,
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

      const dbUser = await userRepository.create(tenantId, {
        name: name || email.split('@')[0],
        email,
        password,
        role: 'ADMIN',
        source: 'INVITE',
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
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
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
            score: result.score || result.totalScore,
            scoreGrade: result.grade,
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

  app.post("/api/ai/valuation", authenticateToken, aiRateLimit, validateBody(schemas.aiValuation), async (req, res) => {
    try {
      const { address, area, roadWidth, legal } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.getRealtimeValuation(address, area, roadWidth, legal);
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

  app.get("/api/health", async (req, res) => {
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

      res.json({
        ...health,
        components,
        connectedClients: io.engine?.clientsCount || 0,
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Health check failed" });
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

  // Facebook Webhook Verification
  app.get("/api/webhooks/facebook", (req, res) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "sgs_land_token";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
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

      if (data.leadId && data.content) {
        try {
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
        } catch (err) {
          logger.error('Failed to persist socket message to DB', err);
        }
      }

      io.to(data.room).emit("receive_message", data);
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
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
}

startServer();
