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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());
  app.use(cookieParser());

  const JWT_SECRET = process.env.JWT_SECRET || 'sgs-land-super-secret-key-2026';

  // Auth Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      (req as any).user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/login", (req, res) => {
    let { email, password } = req.body;
    email = email?.trim();
    
    // Mock authentication logic matching frontend mockDb
    if (password === '123456' || (email === 'admin@sgs.vn' && password === 'admin')) {
      const user = { 
        id: `u_${Date.now()}`, 
        email, 
        role: email.includes('admin') ? 'ADMIN' : 'AGENT', 
        tenantId: '00000000-0000-0000-0000-000000000001' 
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({ message: 'Logged in successfully', user, token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.post("/api/auth/sso", (req, res) => {
    const { email } = req.body;
    
    // Mock SSO authentication logic
    if (email) {
      const user = { 
        id: `u_sso_${Date.now()}`, 
        email, 
        role: email.includes('admin') ? 'ADMIN' : 'AGENT', 
        tenantId: `t_sso_${Date.now()}`
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({ message: 'SSO Login successful', user, token });
    } else {
      res.status(400).json({ error: 'Email is required for SSO' });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, company } = req.body;
    
    if (email && password) {
      const user = { 
        id: `u_${Date.now()}`, 
        name,
        email, 
        role: 'ADMIN', 
        tenantId: company ? `t_${company.toLowerCase().replace(/[^a-z0-9]/g, '')}` : `t_personal_${Date.now()}`
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({ message: 'Registered successfully', user, token });
    } else {
      res.status(400).json({ error: 'Email and password are required' });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // AI Routes
  app.post("/api/ai/process-message", authenticateToken, async (req, res) => {
    try {
      const { lead, userMessage, history, lang } = req.body;
      const { aiService } = await import('./server/ai');
      const t = (k: string) => k; // Mock translation for backend
      const result = await aiService.processMessage(lead, userMessage, history, t);
      res.json(result);
    } catch (error) {
      console.error('AI process message error:', error);
      res.status(500).json({ error: 'AI processing failed' });
    }
  });

  app.post("/api/ai/score-lead", authenticateToken, async (req, res) => {
    try {
      const { leadData, messageContent, weights, lang } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.scoreLead(leadData, messageContent, weights, lang);
      res.json(result);
    } catch (error) {
      console.error('AI score lead error:', error);
      res.status(500).json({ error: 'AI scoring failed' });
    }
  });

  app.post("/api/ai/summarize-lead", authenticateToken, async (req, res) => {
    try {
      const { lead, logs, lang } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.summarizeLead(lead, logs, lang);
      res.json({ summary: result });
    } catch (error) {
      console.error('AI summarize lead error:', error);
      res.status(500).json({ error: 'AI summarization failed' });
    }
  });

  app.post("/api/ai/valuation", authenticateToken, async (req, res) => {
    try {
      const { address, area, roadWidth, legal } = req.body;
      const { aiService } = await import('./server/ai');
      const result = await aiService.getRealtimeValuation(address, area, roadWidth, legal);
      res.json(result);
    } catch (error) {
      console.error('AI valuation error:', error);
      res.status(500).json({ error: 'AI valuation failed' });
    }
  });

  app.post("/api/ai/generate-content", authenticateToken, async (req, res) => {
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

  app.post("/api/ai/embed-content", authenticateToken, async (req, res) => {
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

  // Middleware to extract tenant ID from headers or JWT
  app.use((req, res, next) => {
    let tenantId = '00000000-0000-0000-0000-000000000001';
    
    // Try to get from JWT first if available
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch (e) {
        // Ignore token errors here, let auth middleware handle it for protected routes
      }
    } else if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    }
    
    (req as any).tenantId = tenantId;
    next();
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Setup Yjs WebSocket server for CRDT
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req);
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';
    
    // Let Vite handle its HMR websocket
    if (pathname.includes('vite-hmr')) {
      return;
    }
    
    // Let Socket.IO handle its websocket
    if (pathname.includes('socket.io')) {
      return;
    }
    
    // Handle Yjs websocket
    if (pathname.startsWith('/yjs/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
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

  // API routes FIRST
  app.get("/api/health", async (req, res) => {
    try {
      const health = await systemService.checkHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // API Route: Zalo Webhook (Receive messages from Zalo OA)
  app.post("/api/webhooks/zalo", async (req, res) => {
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

  // API Route: Facebook Webhook
  app.post("/api/webhooks/facebook", async (req, res) => {
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

  // Example API Route: Get all courses
  app.get("/api/courses", async (req, res) => {
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

  // Example API Route: Create a course
  app.post("/api/courses", async (req, res) => {
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
    console.log("A user connected:", socket.id);

    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);
    });

    // Collaboration Presence Tracking
    socket.on("view_lead", async (data) => {
      const { leadId, user } = data;
      const room = `lead_view_${leadId}`;
      socket.join(room);
      
      // Store user info in socket data
      socket.data.user = user;
      socket.data.viewingLead = leadId;
      
      // Broadcast to room
      const sockets = await io.in(room).fetchSockets();
      const users = sockets.map(s => s.data.user).filter(Boolean);
      // Deduplicate users by ID
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      io.to(room).emit("active_viewers", uniqueUsers);
    });

    socket.on("leave_lead", async (data) => {
      const { leadId } = data;
      const room = `lead_view_${leadId}`;
      socket.leave(room);
      socket.data.viewingLead = null;
      
      const sockets = await io.in(room).fetchSockets();
      const users = sockets.map(s => s.data.user).filter(Boolean);
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      io.to(room).emit("active_viewers", uniqueUsers);
    });

    socket.on("send_message", (data) => {
      // Broadcast to everyone in the room
      io.to(data.room).emit("receive_message", data);
    });

    socket.on("lead_updated", (data) => {
      socket.broadcast.emit("lead_updated", data);
    });

    socket.on("lead_created", (data) => {
      socket.broadcast.emit("lead_created", data);
    });

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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
