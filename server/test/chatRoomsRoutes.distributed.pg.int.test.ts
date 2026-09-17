import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { io as createSocket, type Socket } from 'socket.io-client';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const databaseUrl = process.env.AIVEN_DATABASE_URL || process.env.INTEGRITY_PG_URL;
const socketIoRedisUrl = process.env.SOCKET_IO_REDIS_URL;
const describeDistributed = databaseUrl && socketIoRedisUrl ? describe : describe.skip;
const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
const workerPath = path.resolve(process.cwd(), 'server/test/chatRoomsRoutes.distributed.worker.ts');
const tenantId = randomUUID();
const roomSlug = `distributed-${randomUUID().slice(0, 12)}`;
const hostId = randomUUID();
const revokedId = randomUUID();
const memberId = randomUUID();
const baseConnectionString = databaseUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');

type RunningWorker = {
  child: ChildProcess;
  output: () => string;
  port: number;
};

async function findFreePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === 'string') {
    probe.close();
    throw new Error('Could not allocate a worker port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    probe.close(error => error ? reject(error) : resolve());
  });
  return port;
}

function startWorker(port: number, workerId: string): RunningWorker {
  const child = spawn(process.execPath, [tsxCli, workerPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AIVEN_DATABASE_URL: baseConnectionString,
      DB_POOL_MAX: '2',
      NODE_ENV: 'test',
      CHAT_ROOMS_WORKER_ID: workerId,
      CHAT_ROOMS_WORKER_PORT: String(port),
      SOCKET_IO_REDIS_URL: socketIoRedisUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => { output += String(chunk); });
  child.stderr?.on('data', chunk => { output += String(chunk); });
  return { child, output: () => output, port };
}

async function waitForWorker(worker: RunningWorker): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (worker.child.exitCode !== null) {
      throw new Error(`Worker exited with ${worker.child.exitCode}:\n${worker.output()}`);
    }
    if (worker.output().includes(`CHAT_ROOMS_WORKER_READY:`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Worker did not become ready:\n${worker.output()}`);
}

async function stopWorker(worker: RunningWorker | undefined): Promise<void> {
  if (!worker || worker.child.exitCode !== null) return;
  worker.child.kill('SIGTERM');
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      worker.child.kill('SIGKILL');
      resolve();
    }, 10_000);
    worker.child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function controlRedis(worker: RunningWorker, action: 'disconnect' | 'reconnect'): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${worker.port}/__test/redis/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Redis ${action} failed with ${response.status}: ${await response.text()}`);
  }
}

async function waitForRedisHealth(
  worker: RunningWorker,
  status: 'healthy' | 'degraded',
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${worker.port}/__test/redis-health`);
    const health = await response.json() as { status?: string };
    if (health.status === status) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Worker did not reach Redis adapter status ${status}:\n${worker.output()}`);
}

function connectClient(worker: RunningWorker, userId: string): Socket {
  return createSocket(`http://127.0.0.1:${worker.port}`, {
    transports: ['websocket'],
    auth: { userId, tenantId },
    forceNew: true,
  });
}

function waitForEvent(socket: Socket, event: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 10_000);
    const onEvent = (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

async function observeRoomMessages(
  sockets: Socket[],
  action: () => Promise<Response>,
  settleMs = 5_000,
): Promise<{ response: Response; messages: unknown[][] }> {
  const messages = sockets.map(() => [] as unknown[]);
  let firstMessageResolve: () => void = () => undefined;
  const firstMessage = new Promise<void>(resolve => {
    firstMessageResolve = resolve;
  });
  const listeners = sockets.map((socket, index) => {
    const listener = (payload: unknown) => {
      messages[index].push(payload);
      firstMessageResolve();
    };
    socket.on('room_message', listener);
    return listener;
  });

  try {
    const response = await action();
    await Promise.race([
      firstMessage,
      new Promise<void>(resolve => setTimeout(resolve, settleMs)),
    ]);
    // Allow a delayed duplicate to arrive while keeping revoked sockets
    // observable as silent after the broadcast has completed.
    await new Promise(resolve => setTimeout(resolve, 500));
    return { response, messages };
  } finally {
    sockets.forEach((socket, index) => socket.off('room_message', listeners[index]));
  }
}

describeDistributed('chat room membership revocation across Socket.IO processes', () => {
  let db: Pool;
  let workerA: RunningWorker | undefined;
  let workerB: RunningWorker | undefined;
  let hostSocket: Socket;
  let revokedSocket: Socket;
  let memberSocket: Socket;
  let roomId: string;

  beforeAll(async () => {
    db = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
    await db.query(
      `INSERT INTO tenants (id, name, domain)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, `Distributed Socket.IO ${tenantId}`, `distributed-socket-io-${tenantId}`],
    );
    const room = await db.query(
      `INSERT INTO chat_rooms (tenant_id, name, slug, topic, created_by, max_members)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenantId, 'Distributed test room', roomSlug, 'Socket adapter test', hostId, 10],
    );
    roomId = String(room.rows[0].id);
    await db.query(
      `INSERT INTO chat_room_members (room_id, user_id, role)
       VALUES ($1, $2, 'HOST'), ($1, $3, 'MEMBER'), ($1, $4, 'MEMBER')`,
      [roomId, hostId, revokedId, memberId],
    );

    workerA = startWorker(await findFreePort(), 'A');
    workerB = startWorker(await findFreePort(), 'B');
    await Promise.all([waitForWorker(workerA), waitForWorker(workerB)]);

    hostSocket = connectClient(workerA, hostId);
    revokedSocket = connectClient(workerA, revokedId);
    memberSocket = connectClient(workerB, memberId);
    await Promise.all([
      waitForEvent(hostSocket, 'connect'),
      waitForEvent(revokedSocket, 'connect'),
      waitForEvent(memberSocket, 'connect'),
    ]);
    await Promise.all([
      waitForEvent(hostSocket, 'distributed_joined').then(() => undefined),
      waitForEvent(revokedSocket, 'distributed_joined').then(() => undefined),
      waitForEvent(memberSocket, 'distributed_joined').then(() => undefined),
      new Promise<void>(resolve => {
        hostSocket.emit('join_chat_room', roomSlug);
        revokedSocket.emit('join_chat_room', roomSlug);
        memberSocket.emit('join_chat_room', roomSlug);
        setTimeout(resolve, 100);
      }),
    ]);
  });

  afterAll(async () => {
    hostSocket?.close();
    revokedSocket?.close();
    memberSocket?.close();
    await Promise.all([stopWorker(workerA), stopWorker(workerB)]);
    await db?.query('DELETE FROM chat_rooms WHERE id = $1', [roomId]).catch(() => undefined);
    await db?.query('DELETE FROM tenants WHERE id = $1', [tenantId]).catch(() => undefined);
    await db?.end();
  });

  it('revalidates remote membership and delivers one copy only to the valid member', async () => {
    await db.query(
      'DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, revokedId],
    );

    const first = await observeRoomMessages(
      [memberSocket, revokedSocket],
      () => fetch(`http://127.0.0.1:${workerA?.port}/rooms/${roomSlug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': hostId,
          'x-test-tenant-id': tenantId,
        },
        body: JSON.stringify({ content: 'First after revocation' }),
      }),
    );
    expect(first.response.status).toBe(201);
    expect(first.messages[0]).toEqual([
      expect.objectContaining({ content: 'First after revocation' }),
    ]);
    expect(first.messages[1]).toEqual([]);

    const second = await observeRoomMessages(
      [memberSocket, revokedSocket],
      () => fetch(`http://127.0.0.1:${workerB?.port}/rooms/${roomSlug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': hostId,
          'x-test-tenant-id': tenantId,
        },
        body: JSON.stringify({ content: 'Second after revocation' }),
      }),
    );
    expect(second.response.status).toBe(201);
    expect(second.messages[0]).toEqual([
      expect.objectContaining({ content: 'Second after revocation' }),
    ]);
    expect(second.messages[1]).toEqual([]);
  });

  it('skips room delivery during adapter loss and resumes without replaying old messages', async () => {
    if (!workerA || !workerB) throw new Error('Distributed workers were not started');

    await controlRedis(workerA, 'disconnect');
    await waitForRedisHealth(workerA, 'degraded');

    const duringOutage = await observeRoomMessages(
      [memberSocket, hostSocket],
      () => fetch(`http://127.0.0.1:${workerA?.port}/rooms/${roomSlug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': hostId,
          'x-test-tenant-id': tenantId,
        },
        body: JSON.stringify({ content: 'Stored while adapter is unavailable' }),
      }),
      1_000,
    );
    expect(duringOutage.response.status).toBe(201);
    expect((await duringOutage.response.json()).realtime).toEqual({
      status: 'skipped',
      distributed: false,
      reason: 'adapter_unavailable',
    });
    expect(duringOutage.messages).toEqual([[], []]);

    await controlRedis(workerA, 'reconnect');
    await waitForRedisHealth(workerA, 'healthy');

    const afterRecovery = await observeRoomMessages(
      [memberSocket, hostSocket],
      () => fetch(`http://127.0.0.1:${workerA?.port}/rooms/${roomSlug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': hostId,
          'x-test-tenant-id': tenantId,
        },
        body: JSON.stringify({ content: 'Delivered after adapter recovery' }),
      }),
    );
    expect(afterRecovery.response.status).toBe(201);
    expect((await afterRecovery.response.json()).realtime).toMatchObject({
      status: 'delivered',
      distributed: true,
    });
    expect(afterRecovery.messages[0]).toEqual([
      expect.objectContaining({ content: 'Delivered after adapter recovery' }),
    ]);
    expect(afterRecovery.messages[1]).toEqual([
      expect.objectContaining({ content: 'Delivered after adapter recovery' }),
    ]);
  });
});