/**
 * Buyer user repository (Task #52).
 *
 * Operates against `buyer_users`, `buyer_favorites`, and the buyer-scoped
 * subset of `buyer_saved_searches`. Buyer-side tables are not tenant-scoped
 * (the marketplace is shared); writes go through the raw pool, not via
 * tenant-context RLS.
 */

import { Pool } from 'pg';
import { pool as defaultPool, withRlsBypass } from '../db';

export interface BuyerUser {
  id: string;
  phone: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface BuyerFavorite {
  id: string;
  buyerUserId: string;
  listingId: string;
  createdAt: Date;
}

function rowToUser(r: any): BuyerUser {
  return {
    id: r.id,
    phone: r.phone,
    displayName: r.display_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastLoginAt: r.last_login_at,
  };
}

export class BuyerUserRepository {
  constructor(private readonly pool: Pool = defaultPool) {}

  // ── Users ────────────────────────────────────────────────────────────────

  async findByPhone(phone: string): Promise<BuyerUser | null> {
    const r = await this.pool.query(
      `SELECT * FROM buyer_users WHERE phone = $1 LIMIT 1`,
      [phone],
    );
    return r.rows[0] ? rowToUser(r.rows[0]) : null;
  }

  async findById(id: string): Promise<BuyerUser | null> {
    const r = await this.pool.query(
      `SELECT * FROM buyer_users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return r.rows[0] ? rowToUser(r.rows[0]) : null;
  }

  async upsertByPhone(phone: string): Promise<BuyerUser> {
    const r = await this.pool.query(
      `INSERT INTO buyer_users (phone, last_login_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE
         SET last_login_at = NOW(),
             updated_at = NOW()
       RETURNING *`,
      [phone],
    );
    return rowToUser(r.rows[0]);
  }

  async setDisplayName(id: string, displayName: string | null): Promise<BuyerUser | null> {
    const r = await this.pool.query(
      `UPDATE buyer_users SET display_name = $2, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, displayName ? displayName.slice(0, 120) : null],
    );
    return r.rows[0] ? rowToUser(r.rows[0]) : null;
  }

  // ── Favorites ────────────────────────────────────────────────────────────

  async listFavorites(buyerUserId: string): Promise<BuyerFavorite[]> {
    const r = await this.pool.query(
      `SELECT id, buyer_user_id, listing_id, created_at
         FROM buyer_favorites
        WHERE buyer_user_id = $1
        ORDER BY created_at DESC
        LIMIT 500`,
      [buyerUserId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      buyerUserId: row.buyer_user_id,
      listingId: row.listing_id,
      createdAt: row.created_at,
    }));
  }

  async addFavorite(buyerUserId: string, listingId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO buyer_favorites (buyer_user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (buyer_user_id, listing_id) DO NOTHING`,
      [buyerUserId, listingId],
    );
  }

  async addFavoritesBulk(buyerUserId: string, listingIds: string[]): Promise<void> {
    if (!listingIds.length) return;
    await this.pool.query(
      `INSERT INTO buyer_favorites (buyer_user_id, listing_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (buyer_user_id, listing_id) DO NOTHING`,
      [buyerUserId, listingIds],
    );
  }

  async removeFavorite(buyerUserId: string, listingId: string): Promise<boolean> {
    const r = await this.pool.query(
      `DELETE FROM buyer_favorites WHERE buyer_user_id = $1 AND listing_id = $2`,
      [buyerUserId, listingId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Leads (cross-tenant, read by phone) ──────────────────────────────────

  /**
   * Look up the buyer's previously-submitted inquiries. Joined cross-tenant
   * because the marketplace is shared and a single phone may have leads
   * across vendors. Bypasses RLS deliberately — buyer is reading their own
   * footprint, not a CRM-wide listing.
   */
  async listLeadsByPhone(
    phone: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      tenantId: string;
      stage: string | null;
      createdAt: Date;
      listingId: string | null;
      listingTitle: string | null;
      listingCode: string | null;
      tenantName: string | null;
    }>
  > {
    return withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT l.id,
                l.tenant_id,
                l.stage,
                l.created_at,
                COALESCE(l.metadata->>'listing_id', NULL) AS listing_id,
                COALESCE(l.metadata->>'listing_title', NULL) AS listing_title,
                COALESCE(l.metadata->>'listing_code', NULL) AS listing_code,
                t.name AS tenant_name
           FROM leads l
           LEFT JOIN tenants t ON t.id = l.tenant_id
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '(', ''), ')', '') = $1
          ORDER BY l.created_at DESC
          LIMIT $2`,
        [phone, limit],
      );
      return r.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        stage: row.stage,
        createdAt: row.created_at,
        listingId: row.listing_id,
        listingTitle: row.listing_title,
        listingCode: row.listing_code,
        tenantName: row.tenant_name,
      }));
    });
  }
}

export const buyerUserRepository = new BuyerUserRepository();
