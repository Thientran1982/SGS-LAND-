/**
 * campaignSenderService.ts
 *
 * Tạo audience từ filter JSON + gửi email chiến dịch qua Brevo.
 * Hỗ trợ A/B test, tracking pixel mở mail, và rewrite link để track click.
 */
import { Pool } from 'pg';
import { createHmac } from 'crypto';
import { logger } from '../middleware/logger';
import { isBrevoConfigured } from './brevoService';
import { emailService } from './emailService';
export function signTrackingUrl(recipientId: string, url: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return createHmac('sha256', secret)
    .update(`${recipientId}|${url}`)
    .digest('hex')
    .slice(0, 32);
}
export interface AudienceFilter {
  source?: 'leads' | 'users';
  lead_stages?: string[];
  lead_sources?: string[];
  inactive_days_min?: number;
  has_listings?: boolean;
  user_status?: string[];
}
export interface AbTestConfig {
  enabled: boolean;
  variant_b_subject?: string;
  variant_b_body_html?: string;
  split_pct?: number;
}
const ALLOWED_LEAD_STAGES = new Set([
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'MANUAL',
]);
const ALLOWED_LEAD_SOURCES = new Set(['Facebook', 'Zalo', 'Website', 'Giới thiệu', 'Khách vãng lai']);
const ALLOWED_USER_STATUS = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
interface AudienceRow {
  email: string;
  name: string | null;
  lead_id: string | null;
  user_id: string | null;
}
/**
 * Đếm số người sẽ nhận chiến dịch (dùng cho UI preview).
 */
export async function countAudience(
  pool: Pool,
  tenantId: string,
  filter: AudienceFilter,
): Promise<number> {
  const { sql, params } = buildAudienceQuery(tenantId, filter, true);
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.count || 0);
}
/**
 * Build danh sách người nhận thực tế.
 */
export async function buildAudience(
  pool: Pool,
  tenantId: string,
  filter: AudienceFilter,
  limit = 5000,
): Promise<AudienceRow[]> {
  const { sql, params } = buildAudienceQuery(tenantId, filter, false, limit);
  const r = await pool.query(sql, params);
  return r.rows as AudienceRow[];
}
/**
 * Build SQL từ filter — chỉ dùng tham số hoá + whitelist enum.
 */
function buildAudienceQuery(
  tenantId: string,
  filter: AudienceFilter,
  countOnly: boolean,
  limit = 5000,
): { sql: string; params: any[] } {
  const source = filter.source === 'users' ? 'users' : 'leads';
  if (source === 'leads') {
    const conds: string[] = [`l.tenant_id = $1`, `l.email IS NOT NULL`, `l.email <> ''`];
    const params: any[] = [tenantId];
    const stages = (filter.lead_stages || []).filter(s => ALLOWED_LEAD_STAGES.has(s));
    if (stages.length) {
      params.push(stages);
      conds.push(`l.stage = ANY($${params.length}::text[])`);
    }
    const sources = (filter.lead_sources || []).filter(s => ALLOWED_LEAD_SOURCES.has(s));
    if (sources.length) {
      params.push(sources);
      conds.push(`l.source = ANY($${params.length}::text[])`);
    }
    if (typeof filter.inactive_days_min === 'number' && filter.inactive_days_min > 0) {
      params.push(filter.inactive_days_min);
      conds.push(`l.updated_at < NOW() - ($${params.length}::int || ' days')::INTERVAL`);
    }
    const select = countOnly
      ? `SELECT COUNT(*)::int AS count`
      : `SELECT DISTINCT ON (lower(l.email)) l.email AS email, l.name AS name, l.id::text AS lead_id, NULL::text AS user_id`;
    const order = countOnly ? '' : ' ORDER BY lower(l.email), l.created_at DESC';
    const lim = countOnly ? '' : ` LIMIT ${limit}`;

    return {
      sql: `${select} FROM leads l WHERE ${conds.join(' AND ')}${order}${lim}`,
      params,
    };
  }
  // users
  const conds: string[] = [`u.tenant_id = $1`, `u.email IS NOT NULL`, `u.email <> ''`];
  const params: any[] = [tenantId];
  const status = (filter.user_status || ['ACTIVE']).filter(s => ALLOWED_USER_STATUS.has(s));
  if (status.length) {
    params.push(status);
    conds.push(`u.status = ANY($${params.length}::text[])`);
  }
  if (typeof filter.inactive_days_min === 'number' && filter.inactive_days_min > 0) {
    params.push(filter.inactive_days_min);
    conds.push(`(u.last_login_at IS NULL OR u.last_login_at < NOW() - ($${params.length}::int || ' days')::INTERVAL)`);
  }
  if (filter.has_listings === false) {
    conds.push(`NOT EXISTS (SELECT 1 FROM listings l WHERE l.tenant_id = u.tenant_id AND l.created_by = u.id)`);
  } else if (filter.has_listings === true) {
    conds.push(`EXISTS (SELECT 1 FROM listings l WHERE l.tenant_id = u.tenant_id AND l.created_by = u.id)`);
  }
  const select = countOnly
    ? `SELECT COUNT(*)::int AS count`
    : `SELECT u.email AS email, u.name AS name, NULL::text AS lead_id, u.id::text AS user_id`;
  const lim = countOnly ? '' : ` LIMIT ${limit}`;
  return {
    sql: `${select} FROM users u WHERE ${conds.join(' AND ')}${lim}`,
    params,
  };
}
/**
 * Inject tracking pixel + rewrite link + unsubscribe footer cho email body.
 */
export function decorateBody(
  bodyHtml: string,
  recipientId: string,
  publicBaseUrl: string,
): string {
  const pixel = `<img src="${publicBaseUrl}/api/track/open/${recipientId}.gif" width="1" height="1" style="display:none" alt="" />`;
  // Rewrite tất cả href external (http/https) qua redirect tracker
  const rewritten = bodyHtml.replace(
    /href=("|')(https?:\/\/[^"'<>\s]+)\1/gi,
    (_m, q, url) => {
      const sig = signTrackingUrl(recipientId, url);
      const tracked = `${publicBaseUrl}/api/track/click/${recipientId}?url=${encodeURIComponent(url)}&sig=${sig}`;
      return `href=${q}${tracked}${q}`;
    },
  );
  const unsubscribeFooter = [
    '<p style="margin-top:32px;font-size:12px;color:#999;text-align:center;">',
    'Bạn nhận email này vì đã đăng ký nhận thông tin từ SGS LAND. ',
    `Để hủy đăng ký, <a href="${publicBaseUrl}/api/unsubscribe/${recipientId}" style="color:#999;">nhấn vào đây</a>.`,
    '</p>',
  ].join('');
  return `${rewritten}${unsubscribeFooter}${pixel}`;
}
/**
 * Chạy chiến dịch: build audience, chèn recipients, gửi từng email qua Brevo.
 */
export async function runCampaign(
  pool: Pool,
  campaignId: string,
  publicBaseUrl: string,
): Promise<{ ok: boolean; queued: number; sent: number; failed: number; error?: string }> {
  const cRes = await pool.query(
    `SELECT id, tenant_id, name, status, audience, subject, body_html, ab_test
       FROM campaigns WHERE id = $1`,
    [campaignId],
  );
  if (!cRes.rowCount) return { ok: false, queued: 0, sent: 0, failed: 0, error: 'Không tìm thấy chiến dịch' };
  const c = cRes.rows[0];
  if (c.status !== 'ACTIVE') {
    return { ok: false, queued: 0, sent: 0, failed: 0, error: `Chiến dịch không ở trạng thái ACTIVE (${c.status})` };
  }
  if (!c.subject || !c.body_html) {
    return { ok: false, queued: 0, sent: 0, failed: 0, error: 'Thiếu subject hoặc body_html' };
  }
  if (!isBrevoConfigured()) {
    return { ok: false, queued: 0, sent: 0, failed: 0, error: 'Brevo chưa cấu hình' };
  }
  const filter = (c.audience || {}) as AudienceFilter;
  const ab = (c.ab_test || { enabled: false }) as AbTestConfig;
  const audience = await buildAudience(pool, c.tenant_id, filter);
  if (!audience.length) {
    await pool.query(
      `UPDATE campaigns SET last_run_at = NOW(), last_error = 'Audience trống', updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );
    return { ok: true, queued: 0, sent: 0, failed: 0 };
  }
  // Chèn recipients (bỏ qua trùng email trong cùng campaign)
  const splitPct = ab.enabled ? Math.min(95, Math.max(5, ab.split_pct || 50)) : 0;
  let queued = 0;
  const recipientIds: { id: string; email: string; name: string | null; variant: 'A' | 'B' }[] = [];
  for (const row of audience) {
    const existing = await pool.query(
      `SELECT id, email, name, variant, status
         FROM campaign_recipients
        WHERE campaign_id = $1 AND lower(email) = lower($2)
        LIMIT 1`,
      [campaignId, row.email],
    );
    if (existing.rowCount) {
      const prior = existing.rows[0];
      if (prior.status === 'FAILED') {
        await pool.query(
          `UPDATE campaign_recipients
              SET status='PENDING', error=NULL, name=$2
            WHERE id=$1`,
          [prior.id, row.name],
        );
        queued++;
        recipientIds.push({
          id: prior.id,
          email: prior.email,
          name: prior.name,
          variant: prior.variant === 'B' ? 'B' : 'A',
        });
      }
      // SENT/OPENED/CLICKED and UNSUBSCRIBED recipients are terminal for
      // this campaign and must never be sent again.
      continue;
    }
    const variant: 'A' | 'B' = ab.enabled && Math.random() * 100 < splitPct ? 'B' : 'A';
    const ins = await pool.query(
      `INSERT INTO campaign_recipients
         (campaign_id, tenant_id, lead_id, user_id, email, name, variant, status)
       SELECT $1, $2, $3::uuid, $4::uuid, $5, $6, $7, 'PENDING'
        WHERE NOT EXISTS (
          SELECT 1
            FROM campaign_recipients existing
           WHERE existing.campaign_id = $1
             AND lower(existing.email) = lower($5)
        )
       RETURNING id`,
      [campaignId, c.tenant_id, row.lead_id, row.user_id, row.email, row.name, variant],
    );
    if (ins.rowCount) {
      queued++;
      recipientIds.push({ id: ins.rows[0].id, email: row.email, name: row.name, variant });
    }
  }
  let sent = 0;
  let failed = 0;
  for (const rec of recipientIds) {
    const subjectTpl = rec.variant === 'B' && ab.variant_b_subject ? ab.variant_b_subject : c.subject;
    const bodyTpl = rec.variant === 'B' && ab.variant_b_body_html ? ab.variant_b_body_html : c.body_html;
    const subject = renderTemplate(subjectTpl, rec);
    const renderedHtml = renderTemplateHtml(bodyTpl, rec);
    const decorated = decorateBody(renderedHtml, rec.id, publicBaseUrl);
    const textContent = htmlToPlainText(decorated);
    try {
      const result = await emailService.sendEmail(c.tenant_id, {
        to: rec.email,
        subject,
        html: decorated,
        text: textContent,
        template: 'campaign',
        dedupeKey: `campaign:${campaignId}:${rec.id}`,
        dedupeWindowMinutes: 60 * 24,
        tags: [`campaign:${campaignId}`, `variant:${rec.variant}`],
      });
      if (result.success && result.status !== 'quota_exceeded') {
        sent++;
        await pool.query(
          `UPDATE campaign_recipients
              SET status = CASE WHEN $2 = 'deduped' THEN 'SENT' ELSE 'SENT' END,
                  sent_at = NOW()
            WHERE id = $1`,
          [rec.id, result.status],
        );
      } else {
        failed++;
        const errMsg =
          result.status === 'quota_exceeded'
            ? `Quota vượt: ${result.error || 'tenant đã hết hạn mức email/30 ngày'}`
            : (result.error || 'unknown');
        await pool.query(
          `UPDATE campaign_recipients SET status='FAILED', error=$2 WHERE id=$1`,
          [rec.id, errMsg],
        );
      }
    } catch (err: any) {
      failed++;
      await pool.query(
        `UPDATE campaign_recipients SET status='FAILED', error=$2 WHERE id=$1`,
        [rec.id, err.message],
      );
    }
  }
  await pool.query(
    `UPDATE campaigns
        SET send_count = send_count + $2,
            last_run_at = NOW(),
            last_error = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [campaignId, sent, failed > 0 ? `${failed} email lỗi` : null],
  );
  logger.info(`[Campaign] ${c.name} chạy xong — queued=${queued} sent=${sent} failed=${failed}`);
  return { ok: true, queued, sent, failed };
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
/**
 * Replace {{name}} / {{email}} placeholders — raw output (dùng cho subject và text/plain).
 */
function renderTemplate(
  template: string,
  recipient: { name: string | null; email: string },
): string {
  return template
    .replace(/\{\{name\}\}/g, recipient.name || 'bạn')
    .replace(/\{\{email\}\}/g, recipient.email || '');
}
/**
 * Replace {{name}} / {{email}} placeholders — HTML-escaped output (dùng cho html body).
 */
function renderTemplateHtml(
  template: string,
  recipient: { name: string | null; email: string },
): string {
  return renderTemplate(template, {
    name: escapeHtml(recipient.name || 'bạn'),
    email: escapeHtml(recipient.email || ''),
  });
}
/**
 * Convert HTML sang plain text — dùng cho trường text của email (multipart).
 * Giúp Gmail/Outlook hiển thị đúng khi client ưu tiên text/plain.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
