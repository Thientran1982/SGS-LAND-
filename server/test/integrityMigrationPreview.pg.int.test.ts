import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { fileURLToPath } from 'node:url';
import { runPendingMigrations, rollbackLastMigration } from '../migrations/runner';

const connectionString = process.env.INTEGRITY_PG_URL;
const describePostgres = connectionString ? describe : describe.skip;
const testConnectionString = connectionString?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const marketReportPath = path.resolve(
  __dirname,
  '../market/db/migrations/002_market_listing_integrity.report.sql',
);

let pool: Pool;
let client: PoolClient;
let schema: string;

async function query<T extends QueryResultRow = any>(text: string, values?: unknown[]) {
  return client.query<T>(text, values);
}

function samplesFromLog(message: string): unknown[] {
  const samples = message.match(/samples=(.*)$/)?.[1];
  if (!samples) throw new Error(`Missing samples in migration report: ${message}`);
  return JSON.parse(samples);
}

describePostgres('listing integrity previews against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: testConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      // The integration URL may be a managed Aiven endpoint whose CA is only
      // configured for the application pool. This pool is test-only and its
      // random schema contains no production data.
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    client = await pool.connect();
    schema = `integrity_preview_${process.pid}_${Date.now()}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);

    // These deliberately omit integrity constraints: a preview must be able
    // to inspect the legacy rows that the real migration will clean up.
    await query(`
      CREATE TABLE listings (
        id UUID PRIMARY KEY,
        tenant_id UUID,
        code TEXT,
        status TEXT,
        transaction TEXT,
        type TEXT,
        price NUMERIC,
        area NUMERIC,
        currency TEXT,
        coordinates JSONB
      );
      CREATE TABLE market_listings (
        id BIGINT PRIMARY KEY,
        price NUMERIC,
        price_unit TEXT,
        area_m2 NUMERIC,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION
      );
      CREATE TABLE market_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE schema_versions (
        id SERIAL PRIMARY KEY,
        version TEXT UNIQUE NOT NULL,
        description TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const tenant = '00000000-0000-0000-0000-000000000001';
    const listingRows: unknown[][] = [];
    for (let id = 1; id <= 7; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'BROKEN', 'SALE', 'APARTMENT', 100, 50, 'VND',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 8; id <= 13; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'BROKEN', 'APARTMENT', 100, 50, 'VND',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 14; id <= 19; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'SALE', 'MYSTERY', 100, 50, 'VND',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 20; id <= 25; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'SALE', 'APARTMENT', 0, 50, 'VND',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 26; id <= 31; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'SALE', 'APARTMENT', 100, 0, 'VND',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 32; id <= 37; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'SALE', 'APARTMENT', 100, 50, 'EURO',
        { lat: '16', lng: '108' },
      ]);
    }
    for (let id = 38; id <= 43; id += 1) {
      listingRows.push([
        `00000000-0000-0000-0000-0000000000${String(id).padStart(2, '0')}`,
        tenant, `L-${id}`, 'AVAILABLE', 'SALE', 'APARTMENT', 100, 50, 'VND',
        { lat: '99', lng: '108' },
      ]);
    }
    listingRows.push([
      '00000000-0000-0000-0000-000000000044', tenant, 'L-44', 'RENTED', 'SALE',
      'APARTMENT', 100, 50, 'VND', { lat: '16', lng: '108' },
    ]);
    listingRows.push([
      '00000000-0000-0000-0000-000000000045', tenant, 'L-45', 'SOLD', 'RENT',
      'APARTMENT', 100, 50, 'VND', { lat: '16', lng: '108' },
    ]);
    for (const row of listingRows) {
      await query(
        `INSERT INTO listings
          (id, tenant_id, code, status, transaction, type, price, area, currency, coordinates)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        row,
      );
    }

    const marketRows = [
      ...Array.from({ length: 7 }, (_, i) => [i + 1, -i - 1, 'VND', 10, 16, 108]),
      ...Array.from({ length: 6 }, (_, i) => [i + 8, 100, 'VND', -i - 1, 16, 108]),
      ...Array.from({ length: 6 }, (_, i) => [i + 14, 100, 'EURO', 10, 16, 108]),
      ...Array.from({ length: 6 }, (_, i) => [i + 20, 100, 'VND', 10, 99, 108]),
      [26, 100, 'VND', 10, null, 108],
    ];
    for (const row of marketRows) {
      await query(
        `INSERT INTO market_listings (id, price, price_unit, area_m2, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        row,
      );
    }
    await query(`INSERT INTO market_migrations (filename) VALUES ('001_market_listings.sql')`);
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
    await pool?.end();
  });

  it('reports full listing counts and capped samples from actual legacy rows', async () => {
    const migration = (await import('../migrations/153_listing_data_integrity')).default;
    const beforeRows = (await query(
      'SELECT id, tenant_id, code, status, transaction, type, price, area, currency, coordinates FROM listings ORDER BY id',
    )).rows;
    const beforeTracking = (await query(
      'SELECT version, description, applied_at FROM schema_versions ORDER BY version',
    )).rows;
    const log: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => log.push(args.join(' '));
    try {
      await migration.report!(client);
    } finally {
      console.log = originalLog;
    }

    const reports = new Map(
      log.map((line) => [line.split('] ').at(-1)?.split(':')[0], line]),
    );
    expect(reports.get('status')).toBeDefined();
    expect(reports.get('transaction')).toBeDefined();
    expect(reports.get('type')).toBeDefined();
    expect(reports.get('price')).toBeDefined();
    expect(reports.get('area')).toBeDefined();
    expect(reports.get('currency')).toBeDefined();
    expect(reports.get('coordinates')).toBeDefined();

    const expectedCounts: Record<string, number> = {
      status: 7,
      transaction: 6,
      type: 6,
      price: 6,
      area: 6,
      currency: 6,
      coordinates: 6,
    };
    for (const [field, count] of Object.entries(expectedCounts)) {
      const line = reports.get(field)!;
      expect(line).toContain(`: ${count} row(s)`);
      expect(samplesFromLog(line)).toHaveLength(5);
    }
    expect(samplesFromLog(reports.get('status')!)[0]).toMatchObject({
      before: 'BROKEN',
      after: 'INACTIVE',
    });
    expect(samplesFromLog(reports.get('price')!)[0]).toMatchObject({
      before: 0,
      after: null,
    });
    expect(log.find((line) => line.includes('transaction/status contradiction'))).toContain('2 row(s)');
    const afterRows = (await query(
      'SELECT id, tenant_id, code, status, transaction, type, price, area, currency, coordinates FROM listings ORDER BY id',
    )).rows;
    const afterTracking = (await query(
      'SELECT version, description, applied_at FROM schema_versions ORDER BY version',
    )).rows;
    expect(afterRows).toEqual(beforeRows);
    expect(afterTracking).toEqual(beforeTracking);
  });

  it('reports market counts and samples, while dry-run leaves rows and tracking unchanged', async () => {
    const beforeRows = (await query(
      'SELECT id, price, price_unit, area_m2, lat, lng FROM market_listings ORDER BY id',
    )).rows;
    const beforeTracking = (await query(
      'SELECT filename, applied_at FROM market_migrations ORDER BY filename',
    )).rows;
    const report = await fs.readFile(marketReportPath, 'utf8');

    const result = await query(report);
    expect(result.rows.map((row) => row.category)).toEqual([
      'area_m2', 'coordinates', 'price', 'price_unit',
    ]);
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'price', count: 7 }),
      expect.objectContaining({ category: 'area_m2', count: 6 }),
      expect.objectContaining({ category: 'price_unit', count: 6 }),
      expect.objectContaining({ category: 'coordinates', count: 7 }),
    ]));
    for (const row of result.rows) {
      expect(row.samples).toHaveLength(5);
      expect(row.samples[0]).toHaveProperty('id');
      expect(row.samples[0]).toHaveProperty('before');
      expect(row.samples[0]).toHaveProperty('after');
    }

    const afterRows = (await query(
      'SELECT id, price, price_unit, area_m2, lat, lng FROM market_listings ORDER BY id',
    )).rows;
    const afterTracking = (await query(
      'SELECT filename, applied_at FROM market_migrations ORDER BY filename',
    )).rows;
    expect(afterRows).toEqual(beforeRows);
    expect(afterTracking).toEqual(beforeTracking);
  });

  it('applies and rolls back the integrity migration through the production runner', async () => {
    const migrationFiles = (await fs.readdir(path.resolve(__dirname, '../migrations')))
      .filter((file) => /^\d+_[^/]+\.ts$/.test(file) && file !== '153_listing_data_integrity.ts')
      .sort();
    for (const [index, file] of migrationFiles.entries()) {
      await query(
        'INSERT INTO schema_versions (version, description) VALUES ($1, $2)',
        [file, `fixture migration ${index + 1}`],
      );
    }

    // The report tests keep a client checked out to preserve their schema
    // search_path. Release it while the actual runner obtains its own client.
    client.release();
    const runnerPool = new Pool({
      connectionString: testConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      options: `-c search_path="${schema}"`,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    try {
      await runPendingMigrations(runnerPool);

      client = await pool.connect();
      await client.query(`SET search_path TO "${schema}"`);
      const applied = await query<{ version: string }>(
        `SELECT version FROM schema_versions WHERE version = '153_listing_data_integrity.ts'`,
      );
      expect(applied.rows).toHaveLength(1);

      const constraints = await query<{ conname: string }>(`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'listings'::regclass
          AND conname LIKE 'listings_%_ck'
        ORDER BY conname
      `);
      expect(constraints.rows.map((row) => row.conname)).toEqual([
        'listings_area_ck',
        'listings_coordinates_ck',
        'listings_currency_ck',
        'listings_price_ck',
        'listings_status_ck',
        'listings_transaction_ck',
        'listings_transaction_status_ck',
        'listings_type_ck',
      ]);

      const index = await query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'idx_listings_tenant_code_norm_unique'
      `);
      expect(index.rows).toHaveLength(1);

      const cleaned = await query<{
        invalid_status: number;
        invalid_transaction: number;
        invalid_type: number;
        invalid_price: number;
        invalid_area: number;
        invalid_currency: number;
        invalid_coordinates: number;
        contradictory_pair: number;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE status IS NOT NULL AND status NOT IN
            ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET'))::int AS invalid_status,
          COUNT(*) FILTER (WHERE transaction IS NOT NULL AND transaction NOT IN ('SALE','RENT'))::int AS invalid_transaction,
          COUNT(*) FILTER (WHERE type IS NOT NULL AND type NOT IN
            ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA'))::int AS invalid_type,
          COUNT(*) FILTER (WHERE price IS NOT NULL AND price <= 0)::int AS invalid_price,
          COUNT(*) FILTER (WHERE area IS NOT NULL AND area <= 0)::int AS invalid_area,
          COUNT(*) FILTER (WHERE currency IS NOT NULL AND currency NOT IN ('VND','USD'))::int AS invalid_currency,
          COUNT(*) FILTER (WHERE coordinates IS NOT NULL AND NOT (
            jsonb_typeof(coordinates) = 'object'
            AND (coordinates->>'lat')::numeric BETWEEN 8 AND 24
            AND (coordinates->>'lng')::numeric BETWEEN 102 AND 110
          ))::int AS invalid_coordinates,
          COUNT(*) FILTER (WHERE (transaction = 'SALE' AND status = 'RENTED')
            OR (transaction = 'RENT' AND status = 'SOLD'))::int AS contradictory_pair
        FROM listings
      `);
      expect(cleaned.rows[0]).toEqual({
        invalid_status: 0,
        invalid_transaction: 0,
        invalid_type: 0,
        invalid_price: 0,
        invalid_area: 0,
        invalid_currency: 0,
        invalid_coordinates: 0,
        contradictory_pair: 0,
      });

      await rollbackLastMigration(runnerPool);

      const afterRollback = await query<{ version: string }>(
        `SELECT version FROM schema_versions WHERE version = '153_listing_data_integrity.ts'`,
      );
      expect(afterRollback.rows).toHaveLength(0);
      const constraintsAfterRollback = await query<{ conname: string }>(`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'listings'::regclass
          AND conname LIKE 'listings_%_ck'
      `);
      expect(constraintsAfterRollback.rows).toHaveLength(0);
      const indexAfterRollback = await query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'idx_listings_tenant_code_norm_unique'
      `);
      expect(indexAfterRollback.rows).toHaveLength(0);
    } finally {
      if (client) {
        // The runner's pool is separate, so this client is safe to release
        // before the fixture schema is removed by afterAll.
        client.release();
        client = await pool.connect();
        await client.query(`SET search_path TO "${schema}"`);
      }
      await runnerPool.end();
    }
  });
});
