import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, PoolClient } from 'pg';
import migration172 from '../migrations/172_customer_profiles';
import migration173 from '../migrations/173_customer_profile_topics';

const integrationUrl = process.env.INTEGRITY_PG_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const customerA = 'customer-minh-a';
const customerB = 'customer-minh-b';

let pool: Pool;
let setupClient: PoolClient | undefined;
let appPool: typeof import('../db').pool;
let schema: string;
let schemaCreated = false;
let customerProfileService: typeof import('../services/customerProfileService').customerProfileService;

function connectionWithSchema(): string {
  const separator = baseConnectionString!.includes('?') ? '&' : '?';
  const options = encodeURIComponent(`-c search_path="${schema}",public`);
  return `${baseConnectionString}${separator}options=${options}`;
}

async function setupQuery(text: string, values?: unknown[]) {
  if (!setupClient) throw new Error('PostgreSQL fixture client is not connected');
  return setupClient.query(text, values);
}

describePostgres('customer profile isolation against PostgreSQL', () => {
  beforeAll(async () => {
    schema = `customer_profile_isolation_${process.pid}_${Date.now()}`;
    pool = new Pool({
      connectionString: baseConnectionString,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await pool.connect();
    await setupClient.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupQuery('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await setupQuery('CREATE TABLE tenants (id UUID PRIMARY KEY)');
    await setupQuery('INSERT INTO tenants (id) VALUES ($1), ($2)', [tenantA, tenantB]);
    await migration172.up(setupClient);
    await migration173.up(setupClient);

    await setupQuery(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
          CREATE ROLE sgs_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END
    $$`);
    await setupQuery('GRANT sgs_app TO CURRENT_USER');
    await setupQuery(`GRANT USAGE ON SCHEMA "${schema}" TO sgs_app`);
    await setupQuery(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO sgs_app`);
    await setupQuery(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO sgs_app`);

    process.env.AIVEN_DATABASE_URL = connectionWithSchema();
    process.env.APP_DB_ROLE = 'sgs_app';
    ({ customerProfileService } = await import('../services/customerProfileService'));
    ({ pool: appPool } = await import('../db'));
  });

  afterAll(async () => {
    try {
      await appPool?.end();
      setupClient?.release();
      setupClient = undefined;
      if (schemaCreated) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await pool?.end();
    }
  });

  it('keeps reads, deletes, and personalization within each tenant/customer', async () => {
    await customerProfileService.setConsent(tenantA, customerA, 'OPTED_IN', 'agent-a');
    await customerProfileService.setConsent(tenantB, customerB, 'OPTED_IN', 'agent-b');
    const factA = await customerProfileService.addFact(tenantA, customerA, {
      fact: 'Ngân sách Minh A là 3 tỷ',
      category: 'budget',
      source: 'customer A thật',
    }, 'agent-a');
    const factB = await customerProfileService.addFact(tenantB, customerB, {
      fact: 'Ngân sách Minh B là 7 tỷ',
      category: 'budget',
      source: 'customer B thật',
    }, 'agent-b');

    expect((await customerProfileService.getProfile(tenantA, customerA))?.facts.map((f: { fact: string }) => f.fact))
      .toEqual(['Ngân sách Minh A là 3 tỷ']);
    expect(await customerProfileService.getProfile(tenantA, customerB)).toBeNull();
    expect(await customerProfileService.deleteFact(tenantA, customerB, factB.id, 'agent-a')).toBe(false);
    expect(await customerProfileService.deleteFact(tenantA, customerA, factB.id, 'agent-a')).toBe(false);
    expect(await customerProfileService.deleteFact(tenantA, customerA, factA.id, 'agent-a')).toBe(true);
    expect((await customerProfileService.getProfile(tenantB, customerB))?.facts.map((f: { fact: string }) => f.fact))
      .toEqual(['Ngân sách Minh B là 7 tỷ']);
  });

  it('does not write or provide context while consent is PENDING or OPTED_OUT', async () => {
    await customerProfileService.getOrCreate(tenantA, 'pending-customer');
    await expect(customerProfileService.addFact(tenantA, 'pending-customer', {
      fact: 'Không được ghi',
      category: 'budget',
      source: 'test',
    })).rejects.toThrow('consent');
    await expect(customerProfileService.recordOutcome(tenantA, 'pending-customer', {
      actionTaken: 'recommend',
      result: 'positive',
    })).rejects.toThrow('consent');
    await expect(customerProfileService.addTopicToAvoid(tenantA, 'pending-customer', {
      topic: 'chủ đề riêng tư',
      source: 'test',
    })).rejects.toThrow('consent');
    expect((await customerProfileService.getPersonalizationContext(
      tenantA, 'pending-customer', 'giá phù hợp',
    )).block).toBe('');

    await customerProfileService.setConsent(tenantA, 'opted-out-customer', 'OPTED_OUT');
    await expect(customerProfileService.addFact(tenantA, 'opted-out-customer', {
      fact: 'Không được ghi sau opt-out',
      category: 'budget',
      source: 'test',
    })).rejects.toThrow('consent');
    expect((await customerProfileService.getProfile(tenantA, 'opted-out-customer'))?.facts).toEqual([]);
    expect((await customerProfileService.getPersonalizationContext(
      tenantA, 'opted-out-customer', 'ngân sách',
    )).consent).toBe(false);

    const counts = await setupQuery(`
      SELECT
        (SELECT count(*) FROM customer_profile_facts f JOIN customer_profiles p ON p.id=f.profile_id WHERE p.customer_id = $1) AS facts,
        (SELECT count(*) FROM customer_profile_outcomes o JOIN customer_profiles p ON p.id=o.profile_id WHERE p.customer_id = $1) AS outcomes
    `, ['pending-customer']);
    expect(counts.rows[0]).toMatchObject({ facts: '0', outcomes: '0' });
  });

  it('preserves supersession and audit history, purges retention-expired facts, and carries topics to avoid', async () => {
    await customerProfileService.setConsent(tenantB, customerB, 'OPTED_IN', 'agent-b');
    const oldFact = await customerProfileService.addFact(tenantB, customerB, {
      fact: 'Cần căn 2 phòng ngủ',
      category: 'property_need',
      source: 'customer B thật',
    }, 'agent-b');
    const newFact = await customerProfileService.addFact(tenantB, customerB, {
      fact: 'Cần căn 3 phòng ngủ',
      category: 'property_need',
      source: 'customer B thật',
    }, 'agent-b');
    const topic = await customerProfileService.addTopicToAvoid(tenantB, customerB, {
      topic: 'không nhắc khoản nợ',
      source: 'customer B yêu cầu',
    }, 'agent-b');
    await customerProfileService.recordOutcome(tenantB, customerB, {
      actionTaken: 'recommend',
      result: 'negative: không phù hợp',
    });

    const history = await setupQuery(
      'SELECT fact, valid_until, superseded_by FROM customer_profile_facts WHERE id=$1',
      [oldFact.id],
    );
    expect(history.rows[0]).toMatchObject({ fact: 'Cần căn 2 phòng ngủ', superseded_by: newFact.id });
    expect(history.rows[0].valid_until).not.toBeNull();
    expect((await customerProfileService.getPersonalizationContext(
      tenantB, customerB, 'căn phòng ngủ',
    )).topicsToAvoid).toContain('không nhắc khoản nợ');

    await setupQuery(
      'UPDATE customer_profile_facts SET valid_until = CURRENT_DATE - 1 WHERE id=$1',
      [newFact.id],
    );
    expect(await customerProfileService.purgeExpired(tenantB, 'retention-worker')).toBe(1);
    expect((await customerProfileService.getProfile(tenantB, customerB))?.facts).toEqual([]);

    const audit = await setupQuery(
      'SELECT action, actor_id, details_json FROM customer_profile_erasure_audit WHERE tenant_id=$1 AND customer_id=$2 ORDER BY id',
      [tenantB, customerB],
    );
    expect(audit.rows.map(row => row.action)).toEqual(expect.arrayContaining([
      'CONSENT_CHANGED', 'FACT_CREATED', 'TOPIC_ADDED', 'RETENTION_PURGED',
    ]));
    expect(audit.rows.find(row => row.action === 'FACT_CREATED').details_json.supersededFactId).toBeNull();
    expect(audit.rows.find(row => row.action === 'RETENTION_PURGED').actor_id).toBe('retention-worker');
    expect(topic.id).toBeTruthy();

    expect(await customerProfileService.erase(tenantB, customerB, 'customer-request')).toBe(true);
    expect(await customerProfileService.getProfile(tenantB, customerB)).toBeNull();
    const erasedAudit = await setupQuery(
      'SELECT action, actor_id FROM customer_profile_erasure_audit WHERE tenant_id=$1 AND customer_id=$2 AND action=$3',
      [tenantB, customerB, 'PROFILE_ERASED'],
    );
    expect(erasedAudit.rows).toEqual([{ action: 'PROFILE_ERASED', actor_id: 'customer-request' }]);
  });

  it('fails closed for direct database access without tenant context', async () => {
    const noContext = await pool.connect();
    try {
      await noContext.query('BEGIN');
      await noContext.query(`SET LOCAL search_path TO "${schema}", public`);
      await noContext.query('SET LOCAL ROLE sgs_app');
      await noContext.query('SET LOCAL row_security = on');
      expect((await noContext.query('SELECT * FROM customer_profiles')).rows).toEqual([]);
      await expect(noContext.query(
        `INSERT INTO customer_profiles (tenant_id, customer_id) VALUES ($1, 'blocked')`,
        [tenantA],
      )).rejects.toMatchObject({ code: '42501' });
      await noContext.query('ROLLBACK');
    } finally {
      noContext.release();
    }
  });
});