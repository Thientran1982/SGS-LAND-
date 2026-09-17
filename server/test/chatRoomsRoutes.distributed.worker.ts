import express from 'express';
import http from 'node:http';
import { createAdapter as createSocketIoRedisAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { pool } from '../db';
import { chatRoomsRouter, joinChatRoomSocket } from '../routes/chatRoomsRoutes';
import {
  attachSocketIoAdapterHealth,
  getSocketIoAdapterHealth,
  markSocketIoAdapterConnecting,
  markSocketIoAdapterReady,
} from '../services/socketIoAdapterHealth';

const port = Number(process.env.CHAT_ROOMS_WORKER_PORT);
const redisUrl = process.env.SOCKET_IO_REDIS_URL;
const workerId = process.env.CHAT_ROOMS_WORKER_ID || 'unknown';

if (!port || !redisUrl) {
  throw new Error('CHAT_ROOMS_WORKER_PORT and SOCKET_IO_REDIS_URL are required');
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const userId = req.header('x-test-user-id');
  const tenantId = req.header('x-test-tenant-id');
  (req as any).user = userId && tenantId
    ? { id: userId, name: `Distributed ${userId}`, tenantId }
    : undefined;
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});
const publisher = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
const subscriber = publisher.duplicate({ lazyConnect: true, maxRetriesPerRequest: null });
(globalThis as any).__broadcastIo = io;
app.use('/rooms', chatRoomsRouter);
app.post('/__test/redis/:action', async (req, res) => {
  if (req.params.action === 'disconnect') {
    publisher.disconnect();
    subscriber.disconnect();
  } else if (req.params.action === 'reconnect') {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    markSocketIoAdapterReady();
  } else {
    return res.status(400).json({ error: 'unknown action' });
  }
  res.json({ action: req.params.action });
});
app.get('/__test/redis-health', (_req, res) => {
  res.json(getSocketIoAdapterHealth());
});

io.use((socket, next) => {
  const user = (socket.handshake.auth as { userId?: string; tenantId?: string } | undefined);
  if (user?.userId && user.tenantId) {
    socket.data.authUser = { id: user.userId, tenantId: user.tenantId };
  }
  next();
});

io.on('connection', socket => {
  socket.on('join_chat_room', async (slug: unknown) => {
    if (await joinChatRoomSocket(socket, slug)) {
      socket.emit('distributed_joined');
    }
  });
});

const shutdown = async () => {
  await new Promise<void>(resolve => io.close(() => resolve()));
  publisher.disconnect();
  subscriber.disconnect();
  await pool.end();
  process.exit(0);
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

markSocketIoAdapterConnecting();
attachSocketIoAdapterHealth(publisher, subscriber);
await Promise.all([publisher.connect(), subscriber.connect()]);
markSocketIoAdapterReady();
io.adapter(createSocketIoRedisAdapter(publisher, subscriber));
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`CHAT_ROOMS_WORKER_READY:${workerId}\n`);
});