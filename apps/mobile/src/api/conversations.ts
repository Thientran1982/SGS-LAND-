/**
 * Buyer messaging API client (Task #55).
 *
 * All calls go through `apiRequest`, which auto-attaches the buyer JWT.
 * Realtime delivery is handled by `src/realtime/socket.ts`; this module is
 * only the persistent REST surface.
 */

import { apiRequest } from './client';

export type SenderKind = 'BUYER' | 'AGENT';

export interface Conversation {
  id: string;
  tenantId: string;
  buyerUserId: string;
  agentUserId: string | null;
  listingId: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadForBuyer: number;
  unreadForAgent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary extends Conversation {
  listingTitle: string | null;
  listingCode: string | null;
  listingImage: string | null;
  listingPrice: number | null;
  agentName: string | null;
  agentAvatar: string | null;
  agentPhone: string | null;
  buyerPhone: string | null;
  buyerDisplayName: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderKind: SenderKind;
  senderUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export const conversationsApi = {
  list() {
    return apiRequest<{ conversations: ConversationSummary[] }>('/api/buyer/conversations');
  },
  openForListing(listingId: string) {
    return apiRequest<{ conversation: Conversation }>('/api/buyer/conversations', {
      method: 'POST',
      body: { listingId },
    });
  },
  messages(id: string, opts: { before?: string; limit?: number } = {}) {
    return apiRequest<{ messages: ChatMessage[]; nextCursor: string | null }>(
      `/api/buyer/conversations/${encodeURIComponent(id)}/messages`,
      { params: { before: opts.before, limit: opts.limit } },
    );
  },
  send(id: string, body: string) {
    return apiRequest<{ message: ChatMessage; conversation: Conversation }>(
      `/api/buyer/conversations/${encodeURIComponent(id)}/messages`,
      { method: 'POST', body: { body } },
    );
  },
  markRead(id: string) {
    return apiRequest<{ conversation: Conversation }>(
      `/api/buyer/conversations/${encodeURIComponent(id)}/read`,
      { method: 'POST', body: {} },
    );
  },
};
