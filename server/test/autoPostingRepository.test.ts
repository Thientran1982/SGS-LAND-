import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import migration190 from '../migrations/190_auto_posting_phase3';
import {
  getAutoPostingSettings,
  upsertAutoPostingSettings,
} from '../repositories/autoPostingRepository';

const integrationUrl = process.env.INTEGRITY_PG_URL || process.env.AIVEN_DATABASE_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

describePostgres('auto-posting repository tenant isolation against PostgreSQL', () => {
  let pool: Pool;
  let setupClient: PoolClient | undefined;
  let schema: string;

  function connectionWithSchema(): string {
    const separator = baseConnectionString!.includes('?') ? '&' : '?';
    const options = encodeURIComponent(`-c search_path="${schema}",public`);
    return `${baseConnectionString}${separator}options=${options}`;
  }

  beforeAll(async () => {
    schema = `auto_posting_repository_${process.pid}_${Date.now()}`;
    const adminPool = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    try {
      await adminPool.query(`CREATE SCHEMA "${schema}"`);
    } finally {
      await adminPool.end();
    }

    pool = new Pool({
      connectionString: connectionWithSchema(),
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await pool.connect();
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupClient.query(`
      CREATE TABLE projects (
        id UUID PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE social_publications (
        id UUID PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL
      );
    `);
    await migration190.up(setupClient);
    setupClient.release();
    setupClient = undefined;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE auto_posting_settings');
  });

  afterAll(async () => {
    setupClient?.release();
    setupClient = undefined;
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  });

  it('keeps reads and upserts isolated when two tenants have persisted settings', async () => {
    await pool.query(
      `INSERT INTO auto_posting_settings
         (tenant_id, enabled, posts_per_day, time_windows, recycle_after_days, platforms)
       VALUES
         ($1, TRUE, 3, $2::jsonb, 2, $3::jsonb),
         ($4, FALSE, 5, $5::jsonb, 11, $6::jsonb)`,
      [
        tenantA,
        JSON.stringify([{ start: '09:00', end: '10:00' }]),
        JSON.stringify(['FACEBOOK_PAGE']),
        tenantB,
        JSON.stringify([{ start: '19:00', end: '20:00' }]),
        JSON.stringify(['FACEBOOK_PAGE', 'ZALO_OA']),
      ],
    );

    const seededA = await getAutoPostingSettings(pool, tenantA);
    const seededB = await getAutoPostingSettings(pool, tenantB);
    expect(seededA).toMatchObject({
      tenantId: tenantA,
      enabled: true,
      postsPerDay: 3,
      timeWindows: [{ start: '09:00', end: '10:00' }],
      recycleAfterDays: 2,
      platforms: ['FACEBOOK_PAGE'],
    });
    expect(seededB).toMatchObject({
      tenantId: tenantB,
      enabled: false,
      postsPerDay: 5,
      timeWindows: [{ start: '19:00', end: '20:00' }],
      recycleAfterDays: 11,
      platforms: ['FACEBOOK_PAGE', 'ZALO_OA'],
    });

    const updatedA = await upsertAutoPostingSettings(pool, tenantA, {
      enabled: false,
      recycleAfterDays: 9,
    });
    expect(updatedA).toMatchObject({
      tenantId: tenantA,
      enabled: false,
      recycleAfterDays: 9,
    });
    expect(await getAutoPostingSettings(pool, tenantB)).toEqual(seededB);

    const updatedB = await upsertAutoPostingSettings(pool, tenantB, {
      enabled: true,
      recycleAfterDays: 4,
    });
    expect(updatedB).toMatchObject({
      tenantId: tenantB,
      enabled: true,
      recycleAfterDays: 4,
    });
    expect(await getAutoPostingSettings(pool, tenantA)).toEqual(updatedA);

    const persisted = await pool.query(
      `SELECT tenant_id, enabled, recycle_after_days
         FROM auto_posting_settings
        ORDER BY tenant_id`,
    );
    expect(persisted.rows).toEqual([
      { tenant_id: tenantA, enabled: false, recycle_after_days: 9 },
      { tenant_id: tenantB, enabled: true, recycle_after_days: 4 },
    ]);
  });
});