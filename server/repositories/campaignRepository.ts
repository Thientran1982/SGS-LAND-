/**
 * campaignRepository.ts
 *
 * Truy vấn phân khúc người dùng cho hệ thống email tự động.
 * Mỗi segment có cooldown riêng để tránh spam.
 *
 * Segment A — Chưa đăng tin:       đăng ký ≥ 3 ngày, 0 listing, gửi 1 lần duy nhất
 * Segment B — Dừng sau 1 tin:      có đúng 1 listing tạo ≥ 7 ngày, cooldown 7 ngày
 * Segment C — Không hoạt động:     last_login_at ≥ 30 ngày, cooldown 30 ngày
 * Segment D — Upgrade push:        ≥ 2 listing, đăng ký ≥ 30 ngày, cooldown 60 ngày
 * Segment E — AI discovery:        đăng ký ≥ 14 ngày, hoạt động trong 14 ngày, cooldown 30 ngày
 *
 * Lead segments (dùng bảng lead_email_log):
 * LEAD_WELCOME  — Đã gửi email chào mừng cho lead landing page
 * LEAD_NURTURE  — Gửi email chăm sóc sau 3 ngày, cooldown 7 ngày
 */

import { Pool } from 'pg';

export type CampaignType = 'NUDGE_A' | 'NUDGE_B' | 'NUDGE_C' | 'NUDGE_D' | 'NUDGE_E';
export type LeadCampaignType = 'LEAD_WELCOME' | 'LEAD_NURTURE';

export interface CampaignUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
}

export interface CampaignLead {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  project_name: string;
}

// Cooldown theo từng segment (ngày)
const COOLDOWN_DAYS: Record<CampaignType, number> = {
  NUDGE_A: 3650, // Chỉ gửi 1 lần (~10 năm)
  NUDGE_B: 7,
  NUDGE_C: 30,
  NUDGE_D: 60,
  NUDGE_E: 30,
};

const LEAD_COOLDOWN_DAYS: Record<LeadCampaignType, number> = {
  LEAD_WELCOME: 3650, // Chỉ gửi 1 lần
  LEAD_NURTURE: 7,
};

// ── User campaign helpers ──────────────────────────────────────────────────────

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

// ── Lead campaign helpers ──────────────────────────────────────────────────────

/**
 * Kiểm tra xem lead đã nhận email campaign lead trong cooldown chưa.
 */
export async function hasReceivedLeadCampaign(
  pool: Pool,
  leadId: string,
  campaign: LeadCampaignType,
): Promise<boolean> {
  const cooldown = LEAD_COOLDOWN_DAYS[campaign];
  const result = await pool.query(
    `SELECT 1 FROM lead_email_log
     WHERE lead_id = $1
       AND campaign = $2
       AND sent_at > NOW() - ($3 || ' days')::INTERVAL
     LIMIT 1`,
    [leadId, campaign, cooldown],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Ghi lại email đã gửi cho lead vào lead_email_log.
 */
export async function logLeadCampaignEmail(
  pool: Pool,
  tenantId: string,
  leadId: string,
  email: string,
  campaign: LeadCampaignType,
): Promise<void> {
  await pool.query(
    `INSERT INTO lead_email_log (tenant_id, lead_id, email, campaign)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, leadId, email, campaign],
  );
}

// ── User segment queries ───────────────────────────────────────────────────────

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

/**
 * Segment D — User có ≥ 2 listings (môi giới tích cực), đăng ký ≥ 30 ngày.
 * Khuyến khích nâng cấp Premium. Cooldown 60 ngày.
 */
export async function querySegmentD(pool: Pool): Promise<CampaignUser[]> {
  const result = await pool.query(`
    SELECT u.id, u.tenant_id, u.email, u.name
    FROM users u
    WHERE u.status = 'ACTIVE'
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.created_at <= NOW() - INTERVAL '30 days'
      AND (
        SELECT COUNT(*) FROM listings l WHERE l.created_by = u.id
      ) >= 2
      AND NOT EXISTS (
        SELECT 1 FROM email_campaign_log ecl
        WHERE ecl.user_id = u.id
          AND ecl.campaign = 'NUDGE_D'
          AND ecl.sent_at > NOW() - INTERVAL '60 days'
      )
    ORDER BY u.created_at ASC
    LIMIT 100
  `);
  return result.rows;
}

/**
 * Segment E — User đăng ký ≥ 14 ngày, đăng nhập trong 14 ngày gần đây (hoạt động).
 * Giới thiệu tính năng AI. Cooldown 30 ngày.
 */
export async function querySegmentE(pool: Pool): Promise<CampaignUser[]> {
  const result = await pool.query(`
    SELECT u.id, u.tenant_id, u.email, u.name
    FROM users u
    WHERE u.status = 'ACTIVE'
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.created_at <= NOW() - INTERVAL '14 days'
      AND u.last_login_at IS NOT NULL
      AND u.last_login_at >= NOW() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM email_campaign_log ecl
        WHERE ecl.user_id = u.id
          AND ecl.campaign = 'NUDGE_E'
          AND ecl.sent_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY u.last_login_at DESC
    LIMIT 100
  `);
  return result.rows;
}

// ── Lead segment queries ───────────────────────────────────────────────────────

/**
 * Lead Nurture Segment — Leads có email từ landing page, tạo 3–14 ngày trước,
 * chưa nhận LEAD_NURTURE trong 7 ngày qua.
 * Kèm project_name từ metadata.
 */
export async function queryLeadsNeedingNurture(pool: Pool): Promise<CampaignLead[]> {
  const result = await pool.query(`
    SELECT
      l.id,
      l.tenant_id,
      l.email,
      l.name,
      COALESCE(l.metadata->>'project', 'Dự án SGS Land') AS project_name
    FROM leads l
    WHERE l.email IS NOT NULL
      AND l.email != ''
      AND l.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM lead_email_log lel
        WHERE lel.lead_id = l.id
          AND lel.campaign = 'LEAD_NURTURE'
          AND lel.sent_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY l.created_at ASC
    LIMIT 200
  `);
  return result.rows;
}
