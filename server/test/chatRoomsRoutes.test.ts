import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  pool: { query },
}));
vi.mock('../middleware/rateLimiter', () => ({
  apiRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {
  chatRoomSocketName,
  broadcastChatRoomMessage,
  chatRoomsRouter,
  disconnectRevokedChatRoomSockets,
  joinChatRoomSocket,
} from '../routes/chatRoomsRoutes';

type TestUser = {
  id?: string;
  name?: string;
  tenantId?: string;
  role?: string;
};

async function startServer(user: TestUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use('/rooms', chatRoomsRouter);

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe('chat room tenant and membership boundaries', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    query.mockReset();
    ({ server, origin } = await startServer({ id: 'user-a', name: 'User A', tenantId: 'tenant-a' }));
  });

  afterEach(async () => {
    delete (globalThis as any).__broadcastIo;
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('fails closed without tenant identity and never queries a default tenant', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    ({ server, origin } = await startServer({ id: 'user-a', name: 'User A' }));

    const responses = await Promise.all([
      fetch(`${origin}/rooms`),
      fetch(`${origin}/rooms/team/messages`),
      fetch(`${origin}/rooms/team/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Should not be sent' }),
      }),
    ]);

    expect(responses.map(response => response.status)).toEqual([403, 403, 403]);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not let a non-member read messages from a room in another tenant', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/rooms/shared-room/messages`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Phong khong ton tai' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN chat_room_members m'),
      ['tenant-a', 'shared-room', 'user-a'],
    );
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('FROM chat_room_messages'), expect.anything());
  });

  it('does not let a non-member send messages to a room', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/rooms/shared-room/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Should not be sent' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Phong khong ton tai hoac da dong' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN chat_room_members m'),
      ['tenant-a', 'shared-room', 'user-a'],
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reads messages only after membership and tenant checks pass', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'room-a' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { id: 'message-2', sender_name: 'User B', kind: 'TEXT', content: 'Second', created_at: '2026-09-17T10:01:00Z' },
          { id: 'message-1', sender_name: 'User B', kind: 'TEXT', content: 'First', created_at: '2026-09-17T10:00:00Z' },
        ],
        rowCount: 2,
      });

    const response = await fetch(`${origin}/rooms/shared-room/messages`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [
        { id: 'message-1', sender_name: 'User B', kind: 'TEXT', content: 'First', created_at: '2026-09-17T10:00:00Z' },
        { id: 'message-2', sender_name: 'User B', kind: 'TEXT', content: 'Second', created_at: '2026-09-17T10:01:00Z' },
      ],
    });
    expect(query.mock.calls[0][1]).toEqual(['tenant-a', 'shared-room', 'user-a']);
    expect(query.mock.calls[1][1]).toEqual(['room-a']);
  });

  it('sends only after membership and tenant checks pass', async () => {
    const recipient = {
      data: { authUser: { id: 'user-a', tenantId: 'tenant-a' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const fetchSockets = vi.fn().mockResolvedValue([recipient]);
    (globalThis as any).__broadcastIo = {
      in: vi.fn(() => ({ fetchSockets })),
    };
    query
      .mockResolvedValueOnce({ rows: [{ id: 'room-a' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 'message-a', sender_name: 'User A', kind: 'TEXT', content: 'Hello', created_at: '2026-09-17T10:00:00Z' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

    const response = await fetch(`${origin}/rooms/shared-room/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).message.id).toBe('message-a');
    expect(query.mock.calls[0][1]).toEqual(['tenant-a', 'shared-room', 'user-a']);
    expect(query.mock.calls[1][1]).toEqual(['room-a', 'user-a', 'User A', 'TEXT', 'Hello']);
    expect(query.mock.calls[2][1]).toEqual(['room-a']);
    expect(fetchSockets).toHaveBeenCalledTimes(1);
    expect(recipient.emit).toHaveBeenCalledWith('room_message', expect.objectContaining({ id: 'message-a' }));
  });

  it('removes revoked sockets before the next broadcast without affecting current members', async () => {
    const revokedSocket = {
      data: { authUser: { id: 'user-revoked', tenantId: 'tenant-a' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const currentSocket = {
      data: { authUser: { id: 'user-current', tenantId: 'tenant-a' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const io = {
      in: vi.fn(() => ({
        fetchSockets: vi.fn().mockResolvedValue([revokedSocket, currentSocket]),
      })),
    };
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

    await broadcastChatRoomMessage(io, 'room-a', { id: 'message-a' });

    expect(revokedSocket.leave).toHaveBeenCalledWith(chatRoomSocketName('room-a'));
    expect(revokedSocket.emit).not.toHaveBeenCalled();
    expect(currentSocket.leave).not.toHaveBeenCalled();
    expect(currentSocket.emit).toHaveBeenCalledWith('room_message', { id: 'message-a' });
    expect(query.mock.calls[0][1]).toEqual(['room-a', 'user-revoked', 'tenant-a']);
    expect(query.mock.calls[1][1]).toEqual(['room-a', 'user-current', 'tenant-a']);
  });

  it('revokes a member, leaves matching sockets, and sends only a scoped signal', async () => {
    const revokedSocket = {
      data: { authUser: { id: 'user-revoked', tenantId: 'tenant-a' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const sameUserOtherTenantSocket = {
      data: { authUser: { id: 'user-revoked', tenantId: 'tenant-b' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const fetchSockets = vi.fn().mockResolvedValue([revokedSocket, sameUserOtherTenantSocket]);
    const serverSideEmit = vi.fn();
    (globalThis as any).__broadcastIo = {
      in: vi.fn(() => ({ fetchSockets })),
      serverSideEmit,
    };
    query.mockResolvedValueOnce({
      rows: [{ room_id: 'room-a', user_id: 'user-revoked' }],
      rowCount: 1,
    });
    await new Promise<void>(resolve => server.close(() => resolve()));
    ({ server, origin } = await startServer({
      id: 'host-a',
      name: 'Host A',
      tenantId: 'tenant-a',
      role: 'ADMIN',
    }));

    const response = await fetch(`${origin}/rooms/shared-room/members/user-revoked`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 'user-revoked' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM chat_room_members m USING chat_rooms r"),
      ['tenant-a', 'shared-room', 'host-a', 'user-revoked', true],
    );
    expect(revokedSocket.leave).toHaveBeenCalledWith(chatRoomSocketName('room-a'));
    expect(sameUserOtherTenantSocket.leave).not.toHaveBeenCalled();
    expect(serverSideEmit).toHaveBeenCalledWith('chat_room_membership_revoked', {
      tenantId: 'tenant-a',
      roomId: 'room-a',
      userId: 'user-revoked',
    });
    expect(serverSideEmit.mock.calls[0][1]).not.toHaveProperty('content');
  });

  it('keeps membership revocation successful when the member disconnected', async () => {
    const fetchSockets = vi.fn().mockResolvedValue([]);
    (globalThis as any).__broadcastIo = {
      in: vi.fn(() => ({ fetchSockets })),
      serverSideEmit: vi.fn(),
    };
    query.mockResolvedValueOnce({
      rows: [{ room_id: 'room-a', user_id: 'user-gone' }],
      rowCount: 1,
    });

    const response = await fetch(`${origin}/rooms/shared-room/members/user-gone`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 'user-gone' });
    expect((globalThis as any).__broadcastIo.in).toHaveBeenCalledWith(chatRoomSocketName('room-a'));
    expect(fetchSockets).toHaveBeenCalledTimes(1);
  });

  it('leaves only the revoked tenant and user when the socket is gone between lookup and leave', async () => {
    const socket = {
      data: { authUser: { id: 'user-revoked', tenantId: 'tenant-a' } },
      leave: vi.fn().mockRejectedValue(new Error('socket disconnected')),
      emit: vi.fn(),
    };
    const io = {
      in: vi.fn(() => ({ fetchSockets: vi.fn().mockResolvedValue([socket]) })),
    };

    await expect(disconnectRevokedChatRoomSockets(io, {
      tenantId: 'tenant-a',
      roomId: 'room-a',
      userId: 'user-revoked',
    })).resolves.toBeUndefined();
  });

  it('joins identical slugs into tenant-specific realtime rooms', async () => {
    const tenantASocket = {
      data: { authUser: { id: 'user-a', tenantId: 'tenant-a' } },
      join: vi.fn(),
    };
    const tenantBSocket = {
      data: { authUser: { id: 'user-b', tenantId: 'tenant-b' } },
      join: vi.fn(),
    };
    query
      .mockResolvedValueOnce({ rows: [{ id: 'room-a' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'room-b' }], rowCount: 1 });

    await expect(joinChatRoomSocket(tenantASocket, 'shared-room')).resolves.toBe(true);
    await expect(joinChatRoomSocket(tenantBSocket, 'shared-room')).resolves.toBe(true);

    expect(query.mock.calls[0][1]).toEqual(['tenant-a', 'shared-room', 'user-a']);
    expect(query.mock.calls[1][1]).toEqual(['tenant-b', 'shared-room', 'user-b']);
    expect(tenantASocket.join).toHaveBeenCalledWith(chatRoomSocketName('room-a'));
    expect(tenantBSocket.join).toHaveBeenCalledWith(chatRoomSocketName('room-b'));
    expect(tenantASocket.join).not.toHaveBeenCalledWith(chatRoomSocketName('room-b'));
    expect(tenantBSocket.join).not.toHaveBeenCalledWith(chatRoomSocketName('room-a'));
  });

  it('does not join a realtime room for a user who is not a member', async () => {
    const socket = {
      data: { authUser: { id: 'user-outsider', tenantId: 'tenant-a' } },
      join: vi.fn(),
    };
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(joinChatRoomSocket(socket, 'shared-room')).resolves.toBe(false);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN chat_room_members m'),
      ['tenant-a', 'shared-room', 'user-outsider'],
    );
    expect(socket.join).not.toHaveBeenCalled();
  });
});