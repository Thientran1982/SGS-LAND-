import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Golden-set fixtures for shadow learning evaluation',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_golden_set_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('match','valuation','draft')),
        input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        expected_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        notes TEXT NOT NULL DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_golden_set_cases_tenant_category
        ON ai_golden_set_cases (tenant_id, category, active);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_golden_set_seed_key
        ON ai_golden_set_cases (tenant_id, category, notes)
        WHERE notes LIKE 'system_seed_%';
    `);

    // Keep the fixture deterministic and idempotent. Prefer real, reviewed
    // signals; fill only the missing slots with conservative market examples.
    await client.query(`
      DO $$
      DECLARE
        rec RECORD;
        fallback_tenant UUID;
        i INTEGER;
      BEGIN
        SELECT id INTO fallback_tenant FROM tenants ORDER BY id LIMIT 1;

        i := 0;
        FOR rec IN
          SELECT id, tenant_id, payload
          FROM agent_signals
          WHERE signal_type = 'match_chosen'
          ORDER BY created_at ASC
          LIMIT 10
        LOOP
          i := i + 1;
          INSERT INTO ai_golden_set_cases
            (tenant_id, category, input_json, expected_json, notes, active)
          VALUES
            (rec.tenant_id, 'match',
             jsonb_build_object('signalId', rec.id, 'payload', rec.payload::jsonb),
             jsonb_build_object('chosen', true),
             'system_seed_match_' || lpad(i::text, 2, '0'), true)
          ON CONFLICT DO NOTHING;
        END LOOP;

        WHILE i < 10 LOOP
          i := i + 1;
          INSERT INTO ai_golden_set_cases
            (tenant_id, category, input_json, expected_json, notes, active)
          VALUES
            (fallback_tenant, 'match',
             jsonb_build_object(
               'query', 'golden-match-' || i,
               'factors', jsonb_build_object('location', true, 'price', true, 'legal', true, 'rating', false)
             ),
             jsonb_build_object('chosen', true),
             'system_seed_match_' || lpad(i::text, 2, '0'), true)
          ON CONFLICT DO NOTHING;
        END LOOP;

        i := 0;
        FOR rec IN
          SELECT id, tenant_id, payload
          FROM agent_signals
          WHERE signal_type = 'price_estimate_edit_distance'
          ORDER BY created_at ASC
          LIMIT 10
        LOOP
          i := i + 1;
          INSERT INTO ai_golden_set_cases
            (tenant_id, category, input_json, expected_json, notes, active)
          VALUES
            (rec.tenant_id, 'valuation',
             jsonb_build_object('signalId', rec.id, 'payload', rec.payload::jsonb),
             jsonb_build_object('source', 'verified_signal', 'maxRelativeError', 0.25),
             'system_seed_valuation_' || lpad(i::text, 2, '0'), true)
          ON CONFLICT DO NOTHING;
        END LOOP;

        WHILE i < 10 LOOP
          i := i + 1;
          INSERT INTO ai_golden_set_cases
            (tenant_id, category, input_json, expected_json, notes, active)
          SELECT
            fallback_tenant, 'valuation',
            jsonb_build_object(
              'locationKey', COALESCE(m.location_key, 'hcmc-trung-tam'),
              'pricePerM2', COALESCE(m.price_per_m2, 65000000)
            ),
            jsonb_build_object(
              'expectedPricePerM2', COALESCE(m.price_per_m2, 65000000),
              'source', COALESCE(m.source, 'conservative_market_fixture'),
              'maxRelativeError', 0.25
            ),
            'system_seed_valuation_' || lpad(i::text, 2, '0'), true
          FROM (SELECT NULL::uuid AS tenant_id, NULL::text AS location_key,
                       NULL::numeric AS price_per_m2, NULL::text AS source) empty
          LEFT JOIN LATERAL (
            SELECT location_key, price_per_m2, source
            FROM market_price_history
            WHERE price_per_m2 > 0
            ORDER BY recorded_at DESC
            LIMIT 1
          ) m ON TRUE
          ON CONFLICT DO NOTHING;
        END LOOP;
      END $$;
    `);

    await client.query(`
      ALTER TABLE ai_golden_set_cases ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_golden_set_cases FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON ai_golden_set_cases;
      CREATE POLICY tenant_isolation_v2 ON ai_golden_set_cases AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS ai_golden_set_cases CASCADE');
  },
};

export default migration;