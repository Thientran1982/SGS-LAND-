/**
 * Buyer realtime socket (Task #55).
 *
 * Wraps a single `socket.io-client` connection that authenticates with the
 * buyer JWT via the handshake `auth.token` field. The server's `io.use`
 * middleware (server.ts) recognises buyer tokens (`aud: 'buyer'`) and
 * stamps `socket.data.buyerUser` so server-side room-join handlers can
 * authorise the buyer.
 *
 * The client is lazy: it only connects when something subscribes, and
 * disconnects when the last subscriber leaves. This keeps the socket idle
 * while the user is browsing listings and only opens it on the messages
 * surface.
 */

import { io as createSocket, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../api/client';
import { getBuyerToken } from '../storage/auth';
import type { ChatMessage, Conversation } from '../api/conversations';

export interface IncomingMessageEvent {
  conversationId: string;
  message: ChatMessage;
  conversation: Conversation;
}
export interface ConversationReadEvent {
  conversationId: string;
  side: 'BUYER' | 'AGENT';
  conversation: Conversation | null;
}

let socket: Socket | null = null;
let connectingPromise: Promise<Socket> | null = null;
const refCount = new Map<string, number>(); // conversation room → subscriber count

async function ensureSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  if (connectingPromise) return connectingPromise;
  connectingPromise = (async () => {
    const token = await getBuyerToken();
    const base = getApiBaseUrl();
    const s = createSocket(base, {
      transports: ['websocket'],
      // Bearer token in the handshake — the server's io.use middleware
      // verifies this and rejects on aud mismatch.
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 15_000,
    });
    socket = s;
    s.on('disconnect', () => {
      // Re-join all rooms on reconnect — the server forgets membership when
      // the underlying transport drops.
      // (Handled in `connect` listener below.)
    });
    s.on('connect', () => {
      for (const room of refCount.keys()) {
        s.emit('buyer:join_conversation', room);
      }
    });
    return new Promise<Socket>((resolve) => {
      // Resolve as soon as the connect event fires OR immediately if it's
      // already connected mid-attempt; the caller can subscribe even before
      // `connected` fires (events queue inside socket.io-client).
      const onConnect = () => {
        s.off('connect', onConnect);
        resolve(s);
      };
      s.on('connect', onConnect);
      // Fall back to resolving in 5s so subscribers don't deadlock if the
      // server is unreachable; events still queue and flush on reconnect.
      setTimeout(() => resolve(s), 5_000);
    });
  })();
  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

function maybeShutdown() {
  if (refCount.size === 0 && socket) {
    try {
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
  }
}

export interface ConversationSubscriptionHandlers {
  onMessage?: (e: IncomingMessageEvent) => void;
  onRead?: (e: ConversationReadEvent) => void;
}

/**
 * Subscribe to realtime events for a single conversation. Returns an
 * unsubscribe function. Opens (and closes) the underlying socket on
 * demand based on the active subscription count.
 */
export function subscribeToConversation(
  conversationId: string,
  handlers: ConversationSubscriptionHandlers,
): () => void {
  let active = true;
  const messageHandler = (e: IncomingMessageEvent) => {
    if (!active || e.conversationId !== conversationId) return;
    handlers.onMessage?.(e);
  };
  const readHandler = (e: ConversationReadEvent) => {
    if (!active || e.conversationId !== conversationId) return;
    handlers.onRead?.(e);
  };

  refCount.set(conversationId, (refCount.get(conversationId) || 0) + 1);

  void ensureSocket().then((s) => {
    if (!active) return;
    s.emit('buyer:join_conversation', conversationId);
    s.on('conversation:message', messageHandler);
    s.on('conversation:read', readHandler);
  });

  return () => {
    if (!active) return;
    active = false;
    const next = (refCount.get(conversationId) || 1) - 1;
    if (next <= 0) {
      refCount.delete(conversationId);
      socket?.emit('buyer:leave_conversation', conversationId);
    } else {
      refCount.set(conversationId, next);
    }
    socket?.off('conversation:message', messageHandler);
    socket?.off('conversation:read', readHandler);
    maybeShutdown();
  };
}

/**
 * Force-disconnect (e.g. on sign-out) so the next subscriber re-opens with
 * a fresh handshake / token.
 */
export function disconnectRealtime() {
  refCount.clear();
  if (socket) {
    try {
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
  }
}
