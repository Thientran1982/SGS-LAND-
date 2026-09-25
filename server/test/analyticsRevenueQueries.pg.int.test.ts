import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { buildAnalyticsRevenueQueries } from '../repositories/analyticsRepository';

const integrationUrl = process.env.INTEGRITY_PG_URL || process.env.AIVEN_DATABASE_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantId = '11111111-1111-4111-8111-111111111111';
const salesUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describePostgres('analytics revenue attribution against PostgreSQL', () => {
  let pool: Pool;
  let client: PoolClient | undefined;
  let schema: string;
  let schemaCreated = false;

  beforeAll(async () => {
    schema = `analytics_revenue_${process.pid}_${Date.now()}`;
    pool = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    client = await pool.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE leads (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        stage TEXT NOT NULL,
        assigned_to UUID,
        won_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE proposals (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        lead_id UUID NOT NULL,
        listing_id UUID,
        status TEXT NOT NULL,
        final_price NUMERIC NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE listings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        status TEXT NOT NULL,
        commission NUMERIC,
        commission_unit TEXT,
        price NUMERIC NOT NULL DEFAULT 0,
        assigned_to UUID,
        created_by UUID,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
    await client.query(`
      INSERT INTO leads (id, tenant_id, stage, assigned_to, won_at, updated_at) VALUES
        ('00000000-0000-4000-8000-000000000001', $1, 'WON', $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
        ('00000000-0000-4000-8000-000000000002', $1, 'WON', $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
        ('00000000-0000-4000-8000-000000000003', $1, 'WON', $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
        ('00000000-0000-4000-8000-000000000006', $1, 'WON', $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
        ('00000000-0000-4000-8000-000000000004', $1, 'WON', $2, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
        ('00000000-0000-4000-8000-000000000005', $1, 'WON', $2, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days')
    `, [tenantId, salesUserId]);
    await client.query(`
      INSERT INTO listings
        (id, tenant_id, status, commission, commission_unit, assigned_to, created_by, updated_at) VALUES
        ('20000000-0000-4000-8000-000000000001', $1, 'SOLD', 15000, 'FIXED', $3, $2, NOW() - INTERVAL '10 days'),
        ('20000000-0000-4000-8000-000000000002', $1, 'SOLD', 12000, 'FIXED', $3, $3, NOW() - INTERVAL '10 days'),
        ('20000000-0000-4000-8000-000000000004', $1, 'SOLD', 6000, 'FIXED', $2, $3, NOW() - INTERVAL '10 days'),
        ('20000000-0000-4000-8000-000000000003', $1, 'SOLD', 7000, 'FIXED', $2, $2, NOW() - INTERVAL '40 days')
    `, [tenantId, salesUserId, otherUserId]);
    await client.query(`
      INSERT INTO proposals
        (id, tenant_id, lead_id, listing_id, status, final_price, updated_at) VALUES
        ('10000000-0000-4000-8000-000000000001', $1, '00000000-0000-4000-8000-000000000001', NULL, 'APPROVED', 100000, NOW() - INTERVAL '10 days'),
        ('10000000-0000-4000-8000-000000000002', $1, '00000000-0000-4000-8000-000000000001', NULL, 'APPROVED', 150000, NOW() - INTERVAL '10 days'),
        ('10000000-0000-4000-8000-000000000003', $1, '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'APPROVED', 500000, NOW() - INTERVAL '10 days'),
        ('10000000-0000-4000-8000-000000000004', $1, '00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'APPROVED', 250000, NOW() - INTERVAL '10 days'),
        ('10000000-0000-4000-8000-000000000008', $1, '00000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000004', 'APPROVED', 100000, NOW() - INTERVAL '10 days'),
        ('10000000-0000-4000-8000-000000000005', $1, '00000000-0000-4000-8000-000000000004', NULL, 'APPROVED', 100000, NOW() - INTERVAL '40 days'),
        ('10000000-0000-4000-8000-000000000006', $1, '00000000-0000-4000-8000-000000000004', NULL, 'APPROVED', 200000, NOW() - INTERVAL '40 days'),
        ('10000000-0000-4000-8000-000000000007', $1, '00000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'APPROVED', 400000, NOW() - INTERVAL '40 days')
    `, [tenantId]);
  });

  afterAll(async () => {
    try {
      if (client && schemaCreated) {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
    } finally {
      client?.release();
      await pool?.end();
    }
  });

  async function readRevenue(salesScope = false) {
    if (!client) throw new Error('PostgreSQL fixture client is not connected');
    const queries = buildAnalyticsRevenueQueries({
      days: 30,
      salesUserId: salesScope ? salesUserId : undefined,
    });

    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const proposals = await client.query(queries.currentProposals, [0.02]);
      const listings = await client.query(queries.currentListings);
      const previousProposals = queries.previousProposals
        ? await client.query(queries.previousProposals, [0.02])
        : { rows: [{ revenue: '0' }] };
      const previousListings = queries.previousListings
        ? await client.query(queries.previousListings)
        : { rows: [{ revenue: '0' }] };
      const proposalsByMonth = await client.query(queries.proposalsByMonth, [0.02]);
      const listingsByMonth = await client.query(queries.listingsByMonth);

      const byMonth = new Map<string, number>();
      for (const row of [...proposalsByMonth.rows, ...listingsByMonth.rows]) {
        byMonth.set(row.month, (byMonth.get(row.month) || 0) + Number(row.revenue));
      }
      return {
        current: Number(proposals.rows[0].revenue) + Number(listings.rows[0].revenue),
        previous: Number(previousProposals.rows[0].revenue) + Number(previousListings.rows[0].revenue),
        byMonth: [...byMonth.entries()]
          .map(([month, revenue]) => ({ month, revenue }))
          .sort((a, b) => b.month.localeCompare(a.month)),
      };
    } finally {
      await client.query('ROLLBACK');
    }
  }

  it('counts tied approved proposals once and avoids proposal/listing commission duplication in all dashboard periods', async () => {
    const company = await readRevenue();
    expect(company.current).toBe(36_000);
    expect(company.previous).toBe(11_000);

    const months = await client!.query(`
      SELECT
        TO_CHAR(NOW() - INTERVAL '10 days', 'YYYY-MM') AS current_month,
        TO_CHAR(NOW() - INTERVAL '40 days', 'YYYY-MM') AS previous_month
    `);
    expect(company.byMonth).toEqual([
      { month: months.rows[0].current_month, revenue: 36_000 },
      { month: months.rows[0].previous_month, revenue: 11_000 },
    ].sort((a, b) => b.month.localeCompare(a.month)));

    // The $12,000 listing belongs to another agent. SALES keeps its linked $5,000
    // proposal estimate, but recognizes listings owned through assigned_to OR created_by.
    const personal = await readRevenue(true);
    expect(personal.current).toBe(29_000);
    expect(personal.previous).toBe(11_000);
    expect(personal.byMonth).toEqual([
      { month: months.rows[0].current_month, revenue: 29_000 },
      { month: months.rows[0].previous_month, revenue: 11_000 },
    ].sort((a, b) => b.month.localeCompare(a.month)));
  });
});