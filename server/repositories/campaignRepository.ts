/**
 * campaignRepository.ts
 *
 * Truy vấn phân khúc người dùng cho hệ thống email tự động.
 * Mỗi segment có cooldown riêng để tránh spam.
 *
 * Segment A — Chưa đăng tin:     đăng ký ≥ 3 ngày, 0 listing, gửi 1 lần duy nhất
 * Segment B — Dừng sau 1 tin:    có đúng 1 listing tạo ≥ 7 ngày, cooldown 7 ngày
 * Segment C — Không hoạt động:   last_login_at ≥ 30 ngày, cooldown 30 ngày
 */

import { Pool } from 'pg';

export type CampaignType = 'NUDGE_A' | 'NUDGE_B' | 'NUDGE_C';

export interface CampaignUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
}

// Cooldown theo từng segment (ngày)
const COOLDOWN_DAYS: Record<CampaignType, number> = {
  NUDGE_A: 3650, // Chỉ gửi 1 lần (~10 năm)
  NUDGE_B: 7,
  NUDGE_C: 30,
};

/**
 * Kiểm tra xem user này đã nhận email campaign trong cooldown chưa.
 */
export async function hasReceivedCampaign(
  pool: Pool,
  userId: string,
  campaign: CampaignType,
): Promise<boolean> {
  const cooldown = COOLDOWN_DAYS[campaign];
  const result = await pool.query(
    `SELECT 1 FROM email_campaign_log
     WHERE user_id = $1
       AND campaign = $2
       AND sent_at > NOW() - ($3 || ' days')::INTERVAL
     LIMIT 1`,
    [userId, campaign, cooldown],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Ghi lại email đã gửi vào log.
 */
export async function logCampaignEmail(
  pool: Pool,
  tenantId: string,
  userId: string,
  email: string,
  campaign: CampaignType,
): Promise<void> {
  await pool.query(
    `INSERT INTO email_campaign_log (tenant_id, user_id, email, campaign)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, userId, email, campaign],
  );
}

/**
 * Segment A — User đăng ký ≥ 3 ngày nhưng chưa đăng bất kỳ tin nào.
 * Chỉ lấy user ACTIVE có email, loại bỏ các user đã nhận NUDGE_A rồi.
 */
export async function querySegmentA(pool: Pool): Promise<CampaignUser[]> {
  const result = await pool.query(`
    SELECT u.id, u.tenant_id, u.email, u.name
    FROM users u
    WHERE u.status = 'ACTIVE'
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.created_at <= NOW() - INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM listings l
        WHERE l.created_by = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_campaign_log ecl
        WHERE ecl.user_id = u.id
          AND ecl.campaign = 'NUDGE_A'
          AND ecl.sent_at > NOW() - INTERVAL '3650 days'
      )
    ORDER BY u.created_at ASC
    LIMIT 100
  `);
  return result.rows;
}

/**
 * Segment B — User có đúng 1 listing, tin đó tạo ≥ 7 ngày, chưa thêm tin mới.
 * Cooldown 7 ngày: không gửi lại nếu đã gửi NUDGE_B trong 7 ngày qua.
 */
export async function querySegmentB(pool: Pool): Promise<CampaignUser[]> {
  const result = await pool.query(`
    SELECT u.id, u.tenant_id, u.email, u.name
    FROM users u
    WHERE u.status = 'ACTIVE'
      AND u.email IS NOT NULL
      AND u.email != ''
      AND (
        SELECT COUNT(*) FROM listings l WHERE l.created_by = u.id
      ) = 1
      AND (
        SELECT MAX(l.created_at) FROM listings l WHERE l.created_by = u.id
      ) <= NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM email_campaign_log ecl
        WHERE ecl.user_id = u.id
          AND ecl.campaign = 'NUDGE_B'
          AND ecl.sent_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY u.created_at ASC
    LIMIT 100
  `);
  return result.rows;
}

/**
 * Segment C — User không đăng nhập ≥ 30 ngày.
 * Cooldown 30 ngày: không gửi lại nếu đã gửi NUDGE_C trong 30 ngày qua.
 */
export async function querySegmentC(pool: Pool): Promise<CampaignUser[]> {
  const result = await pool.query(`
    SELECT u.id, u.tenant_id, u.email, u.name
    FROM users u
    WHERE u.status = 'ACTIVE'
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.last_login_at IS NOT NULL
      AND u.last_login_at <= NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM email_campaign_log ecl
        WHERE ecl.user_id = u.id
          AND ecl.campaign = 'NUDGE_C'
          AND ecl.sent_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY u.last_login_at ASC
    LIMIT 100
  `);
  return result.rows;
}
