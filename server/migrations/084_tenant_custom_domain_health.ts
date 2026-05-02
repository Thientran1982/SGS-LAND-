/**
 * Migration 084 — Custom domain health tracking (task #34)
 *
 * Cron 5 phút trước đây chỉ verify một chiều (pending → verified). Nếu CĐT lỡ
 * xoá bản ghi TXT sau khi đã verify, hệ thống không phát hiện được rủi ro mất
 * quyền sở hữu tên miền. Thêm 3 cột để re-verify định kỳ + cảnh báo:
 *
 *   custom_domain_failure_count   smallint   số lần verify thất bại liên tiếp
 *   custom_domain_last_check_at   timestamptz   thời điểm cron kiểm tra gần nhất
 *   custom_domain_unverified_at   timestamptz   thời điểm hệ thống huỷ verify do DNS
 *                                              không còn khớp (NULL = chưa từng mất xác thực
 *                                              hoặc đã verify lại thành công)
 */
import { PoolClient } from 'pg';

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS custom_domain_failure_count SMALLINT     NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS custom_domain_last_check_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS custom_domain_unverified_at TIMESTAMPTZ;
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`
    ALTER TABLE tenants
      DROP COLUMN IF EXISTS custom_domain_unverified_at,
      DROP COLUMN IF EXISTS custom_domain_last_check_at,
      DROP COLUMN IF EXISTS custom_domain_failure_count;
  `);
};

export default {
  up,
  down,
  description: 'Tenant custom domain health tracking: failure_count + last_check_at + unverified_at',
};
