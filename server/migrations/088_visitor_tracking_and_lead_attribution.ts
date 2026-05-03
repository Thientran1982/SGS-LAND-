/**
 * Migration 088 — Visitor tracking & lead attribution columns
 *
 * Mục đích:
 * 1. Theo dõi khách vãng lai (anonymous visitor) qua bảng `visitor_events`
 *    với visitor_id (cookie ID) + session_id, lưu UTM/referrer/click IDs.
 * 2. Tách UTM ra khỏi leads.metadata thành cột riêng để query nhanh, build
 *    báo cáo Marketing Attribution dễ dàng. Vẫn giữ metadata để backward
 *    compatible.
 * 3. Liên kết lead ↔ visitor để first-click attribution: 1 visitor có thể
 *    xem nhiều trang trước khi để lại số.
 *
 * Lưu ý: visitor_events KHÔNG bật RLS — public ingest không có user session.
 * Insert luôn kèm tenant_id explicit (resolved từ Host).
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'visitor_events table + leads UTM/visitor_id columns for marketing attribution',

  async up(client) {
    // 1. Leads — thêm cột attribution
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS utm_source     TEXT,
        ADD COLUMN IF NOT EXISTS utm_medium     TEXT,
        ADD COLUMN IF NOT EXISTS utm_campaign   TEXT,
        ADD COLUMN IF NOT EXISTS utm_term       TEXT,
        ADD COLUMN IF NOT EXISTS utm_content    TEXT,
        ADD COLUMN IF NOT EXISTS landing_page   TEXT,
        ADD COLUMN IF NOT EXISTS first_referrer TEXT,
        ADD COLUMN IF NOT EXISTS gclid          TEXT,
        ADD COLUMN IF NOT EXISTS fbclid         TEXT,
        ADD COLUMN IF NOT EXISTS visitor_id     TEXT
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant_utm_source
      ON leads(tenant_id, utm_source) WHERE utm_source IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant_utm_campaign
      ON leads(tenant_id, utm_campaign) WHERE utm_campaign IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant_visitor
      ON leads(tenant_id, visitor_id) WHERE visitor_id IS NOT NULL`);

    // 2. visitor_events — pageview/event log cho khách vãng lai
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_events (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID,
        visitor_id   TEXT NOT NULL,
        session_id   TEXT,
        event_type   TEXT NOT NULL DEFAULT 'pageview',
        page         TEXT,
        page_label   TEXT,
        referrer     TEXT,
        utm_source   TEXT,
        utm_medium   TEXT,
        utm_campaign TEXT,
        utm_term     TEXT,
        utm_content  TEXT,
        gclid        TEXT,
        fbclid       TEXT,
        project_code TEXT,
        ip_address   TEXT,
        user_agent   TEXT,
        metadata     JSONB,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_events_tenant_created
      ON visitor_events(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_created
      ON visitor_events(visitor_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_events_tenant_utm_source
      ON visitor_events(tenant_id, utm_source) WHERE utm_source IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_events_tenant_utm_campaign
      ON visitor_events(tenant_id, utm_campaign) WHERE utm_campaign IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_events_project
      ON visitor_events(tenant_id, project_code) WHERE project_code IS NOT NULL`);

    // Retention helper: optional — cleanup dữ liệu > 365 ngày bằng cron riêng.
  },

  async down(client) {
    await client.query(`DROP TABLE IF EXISTS visitor_events`);
    await client.query(`
      ALTER TABLE leads
        DROP COLUMN IF EXISTS utm_source,
        DROP COLUMN IF EXISTS utm_medium,
        DROP COLUMN IF EXISTS utm_campaign,
        DROP COLUMN IF EXISTS utm_term,
        DROP COLUMN IF EXISTS utm_content,
        DROP COLUMN IF EXISTS landing_page,
        DROP COLUMN IF EXISTS first_referrer,
        DROP COLUMN IF EXISTS gclid,
        DROP COLUMN IF EXISTS fbclid,
        DROP COLUMN IF EXISTS visitor_id
    `);
  },
};

export default migration;
