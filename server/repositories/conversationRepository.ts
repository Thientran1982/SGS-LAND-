/**
 * conversationRepository.ts (Task #55)
 *
 * Buyer ↔ agent threads + messages. Lives outside the tenant-scoped repos
 * because one thread is owned by a buyer (cross-tenant identity) and one
 * agent (tenant-scoped). Reads use `withRlsBypass` since the policy on
 * `users` would otherwise hide the agent join from a NULL-tenant context.
 */

import { withRlsBypass } from '../db';

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

export interface Message {
  id: string;
  conversationId: string;
  senderKind: SenderKind;
  senderUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

function rowToConversation(r: any): Conversation {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    buyerUserId: r.buyer_user_id,
    agentUserId: r.agent_user_id,
    listingId: r.listing_id,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_preview,
    unreadForBuyer: r.unread_for_buyer,
    unreadForAgent: r.unread_for_agent,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToSummary(r: any): ConversationSummary {
  return {
    ...rowToConversation(r),
    listingTitle: r.listing_title,
    listingCode: r.listing_code,
    listingImage: r.listing_image,
    listingPrice: r.listing_price === null ? null : Number(r.listing_price),
    agentName: r.agent_name,
    agentAvatar: r.agent_avatar,
    agentPhone: r.agent_phone,
    buyerPhone: r.buyer_phone,
    buyerDisplayName: r.buyer_display_name,
  };
}

function rowToMessage(r: any): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderKind: r.sender_kind as SenderKind,
    senderUserId: r.sender_user_id,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export const conversationRepository = {
  /**
   * Look up the listing's tenant + assigned agent so we can route a new
   * conversation to the right party. Returns null if the listing is missing
   * or its tenant is not approved (we don't expose unverified vendors).
   */
  async findListingRouting(listingId: string): Promise<{
    listingId: string;
    tenantId: string;
    agentUserId: string | null;
  } | null> {
    return withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT l.id, l.tenant_id,
                COALESCE(l.assigned_to, l.created_by) AS agent_user_id
           FROM listings l
           JOIN tenants t ON t.id = l.tenant_id
          WHERE l.id = $1
            AND t.approval_status = 'APPROVED'
          LIMIT 1`,
        [listingId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        listingId: row.id,
        tenantId: row.tenant_id,
        agentUserId: row.agent_user_id || null,
      };
    });
  },

  async getOrCreateForListing(input: {
    buyerUserId: string;
    listingId: string;
    tenantId: string;
    agentUserId: string | null;
  }): Promise<Conversation> {
    return withRlsBypass(async (client) => {
      // Try insert; if conflict, return the existing row.
      const insert = await client.query(
        `INSERT INTO conversations (tenant_id, buyer_user_id, agent_user_id, listing_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (buyer_user_id, listing_id) WHERE listing_id IS NOT NULL
         DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.buyerUserId, input.agentUserId, input.listingId],
      );
      return rowToConversation(insert.rows[0]);
    });
  },

  async findById(id: string): Promise<Conversation | null> {
    return withRlsBypass(async (client) => {
      const r = await client.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
      return r.rows[0] ? rowToConversation(r.rows[0]) : null;
    });
  },

  async listForBuyer(buyerUserId: string, limit = 50): Promise<ConversationSummary[]> {
    return withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT c.*,
                l.title  AS listing_title,
                l.code   AS listing_code,
                l.price  AS listing_price,
                COALESCE(l.images->>0, NULL) AS listing_image,
                u.name   AS agent_name,
                u.avatar AS agent_avatar,
                u.phone  AS agent_phone,
                bu.phone AS buyer_phone,
                bu.display_name AS buyer_display_name
           FROM conversations c
           LEFT JOIN listings l   ON l.id = c.listing_id
           LEFT JOIN users u      ON u.id = c.agent_user_id
           LEFT JOIN buyer_users bu ON bu.id = c.buyer_user_id
          WHERE c.buyer_user_id = $1
          ORDER BY c.last_message_at DESC
          LIMIT $2`,
        [buyerUserId, limit],
      );
      return r.rows.map(rowToSummary);
    });
  },

  async listForAgent(agentUserId: string, limit = 100): Promise<ConversationSummary[]> {
    return withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT c.*,
                l.title  AS listing_title,
                l.code   AS listing_code,
                l.price  AS listing_price,
                COALESCE(l.images->>0, NULL) AS listing_image,
                u.name   AS agent_name,
                u.avatar AS agent_avatar,
                u.phone  AS agent_phone,
                bu.phone AS buyer_phone,
                bu.display_name AS buyer_display_name
           FROM conversations c
           LEFT JOIN listings l   ON l.id = c.listing_id
           LEFT JOIN users u      ON u.id = c.agent_user_id
           LEFT JOIN buyer_users bu ON bu.id = c.buyer_user_id
          WHERE c.agent_user_id = $1
          ORDER BY c.last_message_at DESC
          LIMIT $2`,
        [agentUserId, limit],
      );
      return r.rows.map(rowToSummary);
    });
  },

  /**
   * Cursor pagination: messages older than `before` (DESC). Use the latest
   * row's createdAt as the next cursor.
   */
  async listMessages(
    conversationId: string,
    opts: { before?: string; limit?: number } = {},
  ): Promise<Message[]> {
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    return withRlsBypass(async (client) => {
      if (opts.before) {
        const r = await client.query(
          `SELECT * FROM messages
            WHERE conversation_id = $1 AND created_at < $2
            ORDER BY created_at DESC
            LIMIT $3`,
          [conversationId, opts.before, limit],
        );
        return r.rows.map(rowToMessage);
      }
      const r = await client.query(
        `SELECT * FROM messages
          WHERE conversation_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [conversationId, limit],
      );
      return r.rows.map(rowToMessage);
    });
  },

  async appendMessage(input: {
    conversationId: string;
    senderKind: SenderKind;
    senderUserId: string;
    body: string;
  }): Promise<{ message: Message; conversation: Conversation }> {
    return withRlsBypass(async (client) => {
      const ins = await client.query(
        `INSERT INTO messages (conversation_id, sender_kind, sender_user_id, body)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.conversationId, input.senderKind, input.senderUserId, input.body],
      );
      const message = rowToMessage(ins.rows[0]);
      const preview = input.body.length > 160 ? input.body.slice(0, 157) + '…' : input.body;
      // Bump conversation watermark + unread counter for the *other* side.
      const unreadCol =
        input.senderKind === 'BUYER' ? 'unread_for_agent' : 'unread_for_buyer';
      const upd = await client.query(
        `UPDATE conversations
            SET last_message_at      = $2,
                last_message_preview = $3,
                ${unreadCol}         = ${unreadCol} + 1,
                updated_at           = NOW()
          WHERE id = $1
          RETURNING *`,
        [input.conversationId, message.createdAt, preview],
      );
      return { message, conversation: rowToConversation(upd.rows[0]) };
    });
  },

  /**
   * Clear the unread counter for the side that just opened the thread.
   * Stamps `read_at` on the unread incoming messages so the other side can
   * render read receipts later.
   */
  async markRead(input: {
    conversationId: string;
    side: SenderKind;
  }): Promise<Conversation | null> {
    return withRlsBypass(async (client) => {
      const oppositeSender = input.side === 'BUYER' ? 'AGENT' : 'BUYER';
      const unreadCol =
        input.side === 'BUYER' ? 'unread_for_buyer' : 'unread_for_agent';
      await client.query(
        `UPDATE messages
            SET read_at = NOW()
          WHERE conversation_id = $1
            AND sender_kind = $2
            AND read_at IS NULL`,
        [input.conversationId, oppositeSender],
      );
      const r = await client.query(
        `UPDATE conversations
            SET ${unreadCol} = 0, updated_at = NOW()
          WHERE id = $1
          RETURNING *`,
        [input.conversationId],
      );
      return r.rows[0] ? rowToConversation(r.rows[0]) : null;
    });
  },
};
