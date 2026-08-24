import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, PoolClient } from 'pg';
import migration157 from '../migrations/157_agent_memory_and_signals';

const integrationUrl = process.env.INTEGRITY_PG_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

let pool: Pool;
let client: PoolClient;
let appPool: typeof import('../db').pool;
let schema: string;
let agentMemoryService: typeof import('../services/agentMemoryService').agentMemoryService;

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function connectionWithSchema(): string {
  const separator = baseConnectionString!.includes('?') ? '&' : '?';
  const options = encodeURIComponent(`-c search_path="${schema}",public`);
  return `${baseConnectionString}${separator}options=${options}`;
}

async function query(text: string, values?: unknown[]) {
  return client.query(text, values);
}

describePostgres('agent memory tenant isolation against PostgreSQL', () => {
  beforeAll(async () => {
    schema = `agent_memory_isolation_${process.pid}_${Date.now()}`;
    pool = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    client = await pool.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await query(`
      CREATE TABLE tenants (id UUID PRIMARY KEY);
      CREATE TABLE ai_learning_audit_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query('INSERT INTO tenants (id) VALUES ($1), ($2)', [tenantA, tenantB]);
    await migration157.up(client);
    await query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
          CREATE ROLE sgs_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END $$`);
    await query('GRANT sgs_app TO CURRENT_USER');
    await query(`GRANT USAGE ON SCHEMA "${schema}" TO sgs_app`);
    await query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO sgs_app`);
    await query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO sgs_app`);
    await query(`INSERT INTO agent_store
      (id, tenant_id, namespace, key, kind, value, importance)
      VALUES
        ('memory-a', $1, 'customer:a', 'shared-key', 'fact', 'tenant A', 0.8),
        ('memory-b', $2, 'customer:b', 'shared-key', 'fact', 'tenant B', 0.8)`,
      [tenantA, tenantB],
    );
    await query(`INSERT INTO agent_weight_versions
      (id, tenant_id, weights, status, metrics)
      VALUES
        ('draft-a', $1, '{"location":1}', 'draft', '{}'),
        ('draft-b', $2, '{"location":1}', 'draft', '{}')`,
      [tenantA, tenantB],
    );

    // db.ts reads AIVEN_DATABASE_URL. Point it at the disposable integration
    // schema before importing the service, and preserve the same search_path.
    process.env.AIVEN_DATABASE_URL = connectionWithSchema();
    process.env.APP_DB_ROLE = 'sgs_app';
    ({ agentMemoryService } = await import('../services/agentMemoryService'));
    ({ pool: appPool } = await import('../db'));
  });

  afterAll(async () => {
    await appPool?.end();
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
    await pool?.end();
  });

  it('lists only the active tenant and cannot update, delete, or promote another tenant', async () => {
    const rowsA = await agentMemoryService.listAdminMemory(tenantA, {});
    expect(rowsA.map((row) => row.id)).toEqual(['memory-a']);

    await expect(agentMemoryService.updateMemory(tenantA, 'memory-b', {
      namespace: 'customer:a',
      key: 'changed',
      value: 'must not cross tenant boundary',
    })).resolves.toBeNull();
    await expect(agentMemoryService.forgetById(tenantA, 'memory-b')).resolves.toBe(0);
    await expect(agentMemoryService.promoteWeights(tenantA, 'draft-b', true, 'operator-a'))
      .resolves.toBeNull();
    await expect(agentMemoryService.promoteWeights(tenantA, 'draft-a', true, 'operator-a'))
      .resolves.toMatchObject({ id: 'draft-a', tenant_id: tenantA, status: 'live' });

    const untouched = await query(`
      SELECT id, tenant_id, value, NULL::text AS status
      FROM agent_store
      WHERE id = 'memory-b'
      UNION ALL
      SELECT id, tenant_id, NULL::text AS value, status
      FROM agent_weight_versions
      WHERE id = 'draft-b'
      ORDER BY id
    `);
    expect(untouched.rows).toHaveLength(2);
    expect(untouched.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'memory-b', tenant_id: tenantB, value: 'tenant B' }),
      expect.objectContaining({ id: 'draft-b', tenant_id: tenantB, status: 'draft' }),
    ]));
  });

  it('switches isolation correctly between both tenant contexts', async () => {
    const rowsB = await agentMemoryService.listAdminMemory(tenantB, {});
    expect(rowsB.map((row) => row.id)).toEqual(['memory-b']);
    await expect(agentMemoryService.forgetById(tenantB, 'memory-b')).resolves.toBe(1);
    expect((await agentMemoryService.listAdminMemory(tenantB, {})).map((row) => row.id)).toEqual([]);
    expect((await agentMemoryService.listAdminMemory(tenantA, {})).map((row) => row.id)).toEqual(['memory-a']);
  });

  it('fails closed when the database role has no tenant context', async () => {
    const noContext = await pool.connect();
    try {
      await noContext.query('BEGIN');
      await noContext.query('SET LOCAL ROLE sgs_app');
      await noContext.query('SET LOCAL row_security = on');
      expect((await noContext.query('SELECT * FROM agent_store')).rows).toEqual([]);
      await expect(noContext.query(
        `INSERT INTO agent_store (id, tenant_id, namespace, key, kind, value)
         VALUES ('no-context', $1, 'customer:none', 'key', 'fact', 'blocked')`,
        [tenantA],
      )).rejects.toMatchObject({ code: '42501' });
      await noContext.query('ROLLBACK');
    } finally {
      noContext.release();
    }
  });
});