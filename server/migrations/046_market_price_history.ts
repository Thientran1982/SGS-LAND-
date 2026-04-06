import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Add market_price_history and avm_calibration tables for self-learning price engine',

  async up(client: PoolClient): Promise<void> {
    // ── market_price_history ─────────────────────────────────────────────────
    // Every price observation (AI fetch, internal comps, manual entry, sold txn)
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_price_history (
        id              SERIAL PRIMARY KEY,
        location_key    VARCHAR(120) NOT NULL,
        location_display VARCHAR(255) NOT NULL,
        price_per_m2    BIGINT NOT NULL,
        price_min       BIGINT,
        price_max       BIGINT,
        property_type   VARCHAR(50) DEFAULT 'townhouse_center',
        source          VARCHAR(30) NOT NULL CHECK (source IN (
                          'ai_search','internal_comps','manual','transaction','regional_table','blended'
                        )),
        confidence      SMALLINT DEFAULT 50,
        trend_text      VARCHAR(100),
        source_count    SMALLINT DEFAULT 1,
        data_recency    VARCHAR(20) DEFAULT 'current_year',
        listing_id      INTEGER,
        tenant_id       VARCHAR(36),
        recorded_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_mph_location_key  ON market_price_history (location_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mph_recorded_at   ON market_price_history (recorded_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mph_source        ON market_price_history (source)`);

    // ── avm_calibration ──────────────────────────────────────────────────────
    // Calibrated price per location, updated nightly from history aggregation.
    // This takes priority over the static regional table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS avm_calibration (
        id                      SERIAL PRIMARY KEY,
        location_key            VARCHAR(120) NOT NULL UNIQUE,
        location_display        VARCHAR(255) NOT NULL,
        calibrated_price_per_m2 BIGINT NOT NULL,
        property_type           VARCHAR(50) DEFAULT 'townhouse_center',
        sample_count            INTEGER DEFAULT 0,
        avg_ai_price            BIGINT,
        avg_comps_price         BIGINT,
        avg_transaction_price   BIGINT,
        ai_weight               REAL DEFAULT 0.60,
        comps_weight            REAL DEFAULT 0.30,
        txn_weight              REAL DEFAULT 0.10,
        confidence_score        SMALLINT DEFAULT 50,
        trend_pct               REAL DEFAULT 0,
        trend_text              VARCHAR(100),
        last_calibrated_at      TIMESTAMPTZ DEFAULT NOW(),
        calibration_window_days SMALLINT DEFAULT 90,
        notes                   TEXT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_avm_cal_location ON avm_calibration (location_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_avm_cal_updated  ON avm_calibration (last_calibrated_at DESC)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS market_price_history CASCADE`);
    await client.query(`DROP TABLE IF EXISTS avm_calibration CASCADE`);
  },
};

export default migration;
