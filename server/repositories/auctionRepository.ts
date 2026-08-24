import { BaseRepository } from './baseRepository';

const TERMINAL = new Set(['ENDED', 'CANCELLED']);

export interface AuctionFilters { status?: string; search?: string }

class AuctionRepository extends BaseRepository {
  constructor() { super('auction_sessions'); }

  async list(tenantId: string, filters: AuctionFilters = {}) {
    return this.withTenant(tenantId, async client => {
      const values: any[] = [tenantId];
      const conditions = ['a.tenant_id = $1'];
      if (filters.status && filters.status !== 'ALL') {
        values.push(filters.status.toUpperCase());
        conditions.push(`a.status = $${values.length}`);
      }
      if (filters.search?.trim()) {
        values.push(`%${filters.search.trim()}%`);
        conditions.push(`(a.title ILIKE $${values.length} OR l.code ILIKE $${values.length})`);
      }
      await client.query(`
        UPDATE auction_sessions a SET
          status = 'ENDED',
          winner_user_id = (SELECT b.bidder_id FROM auction_bids b WHERE b.auction_id = a.id ORDER BY b.amount DESC, b.created_at ASC LIMIT 1),
          winning_bid = current_bid,
          updated_at = NOW()
        WHERE tenant_id = $1 AND status IN ('UPCOMING','LIVE','PAUSED') AND ends_at <= NOW()
      `, [tenantId]);
      await client.query(`
        UPDATE auction_sessions SET status = 'LIVE', updated_at = NOW()
        WHERE tenant_id = $1 AND status = 'UPCOMING' AND starts_at <= NOW() AND ends_at > NOW()
      `, [tenantId]);
      const result = await client.query(`
        SELECT a.*, l.code AS listing_code, l.images AS listing_images,
               u.name AS winner_name
        FROM auction_sessions a
        JOIN listings l ON l.id = a.listing_id AND l.tenant_id = a.tenant_id
        LEFT JOIN users u ON u.id = a.winner_user_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.starts_at DESC, a.created_at DESC
      `, values);
      return result.rows.map(row => this.rowToEntity<any>(row));
    });
  }

  async create(tenantId: string, data: any, userId: string) {
    return this.withTenant(tenantId, async client => {
      const listing = await client.query(
        'SELECT id, title, code FROM listings WHERE id = $1 AND tenant_id = $2',
        [data.listingId, tenantId],
      );
      if (!listing.rows[0]) throw new Error('LISTING_NOT_FOUND');
      const result = await client.query(`
        INSERT INTO auction_sessions
          (tenant_id, listing_id, title, start_price, step_price, current_bid,
           status, starts_at, ends_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$4,'UPCOMING',$6,$7,$8)
        RETURNING *
      `, [tenantId, data.listingId, data.title || listing.rows[0].title,
          data.startPrice, data.stepPrice, data.startsAt, data.endsAt, userId]);
      return this.rowToEntity<any>(result.rows[0]);
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    return this.withTenant(tenantId, async client => {
      const allowed = ['LIVE', 'PAUSED', 'ENDED', 'CANCELLED'];
      if (!allowed.includes(status)) throw new Error('INVALID_STATUS');
      const result = await client.query(`
        UPDATE auction_sessions a
        SET status = $1,
            updated_at = NOW(),
            winning_bid = CASE WHEN $1 = 'ENDED' THEN current_bid ELSE winning_bid END,
            winner_user_id = CASE WHEN $1 = 'ENDED'
              THEN (SELECT b.bidder_id FROM auction_bids b WHERE b.auction_id = a.id ORDER BY b.amount DESC, b.created_at ASC LIMIT 1)
              ELSE winner_user_id END
        WHERE id = $2 AND tenant_id = $3 AND status NOT IN ('ENDED','CANCELLED')
        RETURNING *
      `, [status, id, tenantId]);
      if (!result.rows[0]) throw new Error('AUCTION_NOT_FOUND_OR_TERMINAL');
      return this.rowToEntity<any>(result.rows[0]);
    });
  }

  async placeBid(tenantId: string, auctionId: string, bidderId: string, amount: number, idempotencyKey: string) {
    return this.withTenant(tenantId, async client => {
      await client.query('BEGIN');
      try {
        const existing = await client.query(`
          SELECT * FROM auction_bids
          WHERE auction_id = $1 AND bidder_id = $2 AND idempotency_key = $3
        `, [auctionId, bidderId, idempotencyKey]);
        if (existing.rows[0]) {
          await client.query('COMMIT');
          return { bid: this.rowToEntity<any>(existing.rows[0]), replayed: true };
        }
        const auction = await client.query(`
          SELECT * FROM auction_sessions
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE
        `, [auctionId, tenantId]);
        const a = auction.rows[0];
        if (!a) throw new Error('AUCTION_NOT_FOUND');
        const now = Date.now();
        if (a.ends_at <= new Date(now)) {
          await client.query(`UPDATE auction_sessions SET status='ENDED', updated_at=NOW() WHERE id=$1`, [auctionId]);
          throw new Error('AUCTION_ENDED');
        }
        if (a.status !== 'LIVE' || a.starts_at > new Date(now)) throw new Error('AUCTION_NOT_LIVE');
        const minimum = Number(a.current_bid) + Number(a.step_price);
        if (!Number.isFinite(amount) || amount < minimum) {
          const err: any = new Error('BID_TOO_LOW');
          err.minimum = minimum;
          throw err;
        }
        const bid = await client.query(`
          INSERT INTO auction_bids (auction_id, tenant_id, bidder_id, amount, idempotency_key)
          VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [auctionId, tenantId, bidderId, amount, idempotencyKey]);
        const updated = await client.query(`
          UPDATE auction_sessions
          SET current_bid=$1, bid_count=bid_count+1, updated_at=NOW()
          WHERE id=$2 AND tenant_id=$3
          RETURNING *
        `, [amount, auctionId, tenantId]);
        await client.query('COMMIT');
        return { bid: this.rowToEntity<any>(bid.rows[0]), auction: this.rowToEntity<any>(updated.rows[0]), replayed: false };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async bids(tenantId: string, auctionId: string) {
    return this.withTenant(tenantId, async client => {
      const result = await client.query(`
        SELECT b.*, u.name AS bidder_name
        FROM auction_bids b JOIN users u ON u.id = b.bidder_id
        WHERE b.auction_id = $1 AND b.tenant_id = $2
        ORDER BY b.created_at DESC
      `, [auctionId, tenantId]);
      return result.rows.map(row => this.rowToEntity<any>(row));
    });
  }
}

export const auctionRepository = new AuctionRepository();