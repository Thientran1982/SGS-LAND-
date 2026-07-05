/**
 * Migration 114 — Visitor consent ledger + data erasure requests
 *
 * Muc dich:
 * 1. Ghi lai (append-only) tung lan khach truy cap dong y / tu choi theo doi hanh vi,
 *    tuan thu Nghi dinh 13/2023/ND-CP va Luat 91/2025/QH15 (yeu cau co bang chung dong y,
 *    "im lang khong phai la dong y").
 * 2. Hang doi xu ly yeu cau xoa du lieu ca nhan, SLA 72 gio ke tu luc yeu cau.
 *
 * Luu y: hai bang nay KHONG bat RLS - giong visitor_events, day la public ingest
 * khong co user session, tenant_id duoc resolve tu Host va truyen explicit.
 */
import type { Migration } from './runner';

const migration: Migration = {
  description: 'consent_records + data_erasure_requests tables for visitor tracking compliance',

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID,
        visitor_id       TEXT NOT NULL,
        category         TEXT NOT NULL CHECK (category IN ('ESSENTIAL','BEHAVIORAL','ADVERTISING')),
        granted          BOOLEAN NOT NULL,
        consent_version  TEXT,
        ip_address       TEXT,
        user_agent       TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_consent_records_visitor
      ON consent_records(tenant_id, visitor_id, category, created_at DESC)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS data_erasure_requests (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID,
        visitor_id       TEXT,
        requested_email  TEXT,
        requested_phone  TEXT,
        status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','REJECTED')),
        notes            TEXT,
        requested_at     TIMESTAMPTZ DEFAULT NOW(),
        due_at           TIMESTAMPTZ NOT NULL,
        completed_at     TIMESTAMPTZ
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_data_erasure_requests_status
      ON data_erasure_requests(tenant_id, status, due_at)`);
  },

  async down(client) {
    await client.query(`DROP TABLE IF EXISTS data_erasure_requests`);
    await client.query(`DROP TABLE IF EXISTS consent_records`);
  },
};

export default migration;
