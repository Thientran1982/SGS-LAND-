import { Pool } from 'pg';
import { emailService } from './emailService';
import { createHash } from 'crypto';

export type CareDay = 'D1' | 'D3' | 'D5' | 'D7';
const DAYS: Array<{ mark: CareDay; day: number }> = [{ mark: 'D1', day: 1 }, { mark: 'D3', day: 3 }, { mark: 'D5', day: 5 }, { mark: 'D7', day: 7 }];

export function dayMark(firstContact: Date, now = new Date()): CareDay | null {
  const start = new Date(firstContact); start.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const day = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return DAYS.filter(x => x.day <= day).at(-1)?.mark || null;
}

export function careEmailContent(mark: CareDay, lead: any) {
  const rawName = lead.name || 'Quý khách';
  const rawProject = lead.product_interest || lead.project_name || 'dự án bạn quan tâm';
  const rawSales = lead.sales_owner_name || 'chuyên viên SGS LAND';
  const name = escapeHtml(rawName);
  const project = escapeHtml(rawProject);
  const sales = escapeHtml(rawSales);
  const cta = 'https://sgsland.vn/#/lien-he';
  const content: Record<CareDay, { subject: string; text: string }> = {
    D1: { subject: `SGS LAND – Cảm ơn ${name} đã quan tâm`, text: `Xin chào ${name},\n\nCảm ơn Anh/Chị đã quan tâm đến ${project}. SGS LAND đã ghi nhận nhu cầu và ${sales} sẽ liên hệ để hỗ trợ thêm.\n\nAnh/Chị có thể xem thông tin tổng quan tại: ${cta}\n\nNếu có câu hỏi, Anh/Chị chỉ cần phản hồi email này.\n\nTrân trọng,\nSGS LAND` },
    D3: { subject: `SGS LAND – Thông tin hữu ích về ${project}`, text: `Xin chào ${name},\n\nĐể hỗ trợ Anh/Chị cân nhắc ${project}, đội ngũ SGS LAND có thể cung cấp thông tin về vị trí, tiện ích, pháp lý, tiến độ và chính sách thanh toán theo dữ liệu mới nhất.\n\nAnh/Chị có thể đặt lịch tư vấn hoặc tham quan tại: ${cta}\n\nTrân trọng,\nSGS LAND` },
    D5: { subject: `SGS LAND – Giải đáp trước khi Anh/Chị quyết định`, text: `Xin chào ${name},\n\nTrong quá trình tìm hiểu ${project}, các câu hỏi về pháp lý, tiến độ và khả năng tài chính thường rất quan trọng. Chuyên viên SGS LAND sẵn sàng giải đáp dựa trên thông tin đã được xác minh, không áp đặt quyết định.\n\nTrao đổi 1-1 tại: ${cta}\n\nTrân trọng,\nSGS LAND` },
    D7: { subject: `SGS LAND – Bước tiếp theo cho ${project}`, text: `Xin chào ${name},\n\nĐây là email cuối trong chuỗi chăm sóc tự động của SGS LAND về ${project}. Nếu Anh/Chị vẫn quan tâm, có thể đặt lịch trao đổi trực tiếp trong 48 giờ tới tại ${cta}.\n\nNếu chưa phù hợp, Anh/Chị có thể bỏ qua email này hoặc phản hồi để chúng tôi dừng liên hệ.\n\nTrân trọng,\nSGS LAND` },
  };
  const item = content[mark];
  return { ...item, html: emailService.emailBase(`<h1 style="color:#0F172A;font-family:Arial,sans-serif;">${item.subject}</h1><p style="color:#475569;font:14px Arial;line-height:1.8;white-space:pre-line;">${item.text}</p><p><a href="${cta}" style="color:#1B3A5C;font-weight:bold;">Trao đổi với SGS LAND</a></p>`, 'Email chăm sóc tự động của SGS LAND.') };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}

export async function runCustomerCare(pool: Pool, dryRun = false) {
  const result = { queried: 0, sent: 0, skipped: 0, failed: 0, stopped: 0 };
  const leads = (await pool.query(`
    SELECT DISTINCT ON (l.id) l.id,l.tenant_id,l.email,l.name,l.status,l.created_at,
      COALESCE(l.metadata->>'product_interest', l.metadata->>'project', 'dự án bạn quan tâm') AS product_interest,
      u.name AS sales_owner_name
    FROM leads l LEFT JOIN users u ON u.id=l.assigned_to AND u.tenant_id=l.tenant_id
    WHERE l.email IS NOT NULL AND l.email <> ''
      AND COALESCE(l.marketing_email_consent,false)=true
      AND LOWER(COALESCE(l.status,'new')) NOT IN ('replied','converted','opted_out','unresponsive')
      AND NOT (COALESCE(l.opt_out_channels, '[]'::jsonb) @> '"email"'::jsonb)
      AND NOT EXISTS (
        SELECT 1 FROM interactions i
        WHERE i.lead_id=l.id AND UPPER(COALESCE(i.direction,''))='INBOUND'
          AND i.timestamp >= l.created_at
      )
      AND l.created_at <= NOW() - INTERVAL '1 day'
    ORDER BY l.id, l.created_at LIMIT 500`)).rows;
  result.queried = leads.length;
  for (const lead of leads) {
    const mark = dayMark(lead.created_at);
    if (!mark) continue;
    const existing = await pool.query(`SELECT status FROM care_followup_log WHERE tenant_id=$1 AND lead_id=$2 AND day_mark=$3`, [lead.tenant_id, lead.id, mark]);
    if (existing.rowCount) { result.skipped++; continue; }
    const message = careEmailContent(mark, lead);
    if (dryRun) { result.sent++; continue; }
    const deliveryKey = `care-followup:${lead.tenant_id}:${lead.id}:${mark}`;
    try {
      const sent = await emailService.sendEmail(lead.tenant_id, { to: lead.email, subject: message.subject, text: message.text, html: message.html, template: `care_followup_${mark.toLowerCase()}`, deliveryKey, dedupeKey: deliveryKey, dedupeWindowMinutes: 0 });
      await pool.query(`INSERT INTO care_followup_log (tenant_id,lead_id,day_mark,delivery_key,subject,status,sent_at,error) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6='SENT' THEN NOW() END,$7) ON CONFLICT DO NOTHING`, [lead.tenant_id, lead.id, mark, deliveryKey, message.subject, sent.success ? 'SENT' : (sent.ambiguous ? 'UNKNOWN' : 'FAILED'), sent.error || null]);
      sent.success ? result.sent++ : result.failed++;
    } catch { result.failed++; }
  }
  return result;
}

export async function runInactivityAlerts(pool: Pool, dryRun = false) {
  const result = { queried: 0, sent: 0, skipped: 0, failed: 0 };
  const users = (await pool.query(`
    SELECT DISTINCT ON (u.id) u.id,u.tenant_id,u.email,u.name,u.role,u.last_login_at,
      CASE WHEN u.role IN ('SALES','PARTNER') THEN u.email ELSE owner.email END AS recipient_email,
      CASE WHEN u.role IN ('SALES','PARTNER') THEN u.name ELSE owner.name END AS recipient_name
    FROM users u
    LEFT JOIN users owner ON owner.tenant_id=u.tenant_id AND owner.role IN ('ADMIN','SUPER_ADMIN')
    WHERE u.status='ACTIVE' AND u.email IS NOT NULL AND u.last_login_at IS NOT NULL
      AND u.last_login_at <= NOW()-INTERVAL '3 days'
      AND u.role NOT IN ('ADMIN','SUPER_ADMIN')
      AND (CASE WHEN u.role IN ('SALES','PARTNER') THEN u.email ELSE owner.email END) IS NOT NULL
    ORDER BY u.id, owner.id NULLS LAST LIMIT 500`)).rows;
  result.queried = users.length;
  for (const user of users) {
    const days = Math.floor((Date.now() - new Date(user.last_login_at).getTime()) / 86400000);
    const level = days >= 14 ? 'reminder_14d' : days >= 7 ? 'reminder_7d' : 'first_notice';
    const key = `care-inactivity:${user.tenant_id}:${user.id}:${new Date(user.last_login_at).toISOString()}:${level}`;
    const exists = await pool.query(`SELECT 1 FROM care_inactivity_alert_log WHERE tenant_id=$1 AND user_id=$2 AND last_login_at=$3 AND escalation_level=$4`, [user.tenant_id, user.id, user.last_login_at, level]);
    if (exists.rowCount) { result.skipped++; continue; }
    if (dryRun) { result.sent++; continue; }
    const subject = `SGS LAND – ${user.name || 'Người dùng'} đã vắng mặt ${days} ngày`;
    const text = `Xin chào ${user.recipient_name || 'Quản lý'},\n\n${user.name || 'Người dùng'} đã không đăng nhập SGS LAND ${days} ngày. Lần đăng nhập gần nhất: ${new Date(user.last_login_at).toLocaleDateString('vi-VN')}.\n\nVui lòng kiểm tra và hỗ trợ khi cần: https://sgsland.vn/#/dang-nhap`;
    try {
      const sent = await emailService.sendEmail(user.tenant_id, { to: user.recipient_email, subject, text, html: emailService.emailBase(`<p style="font:14px Arial;line-height:1.8;color:#475569;">${text.replace(/\n/g, '<br>')}</p>`), template: 'care_inactivity_alert', deliveryKey: key, dedupeKey: key, dedupeWindowMinutes: 0 });
      await pool.query(`INSERT INTO care_inactivity_alert_log (tenant_id,user_id,last_login_at,escalation_level,delivery_key,status,sent_at) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6='SENT' THEN NOW() END) ON CONFLICT DO NOTHING`, [user.tenant_id,user.id,user.last_login_at,level,key,sent.success?'SENT':(sent.ambiguous?'UNKNOWN':'FAILED')]);
      sent.success ? result.sent++ : result.failed++;
    } catch { result.failed++; }
  }
  return result;
}

export async function claimCareWebhook(pool: Pool, eventKey: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO webhook_events (platform,event_key,status) VALUES ('brevo-care',$1,'PROCESSED')
     ON CONFLICT (platform,event_key) DO NOTHING RETURNING id`,
    [eventKey.slice(0, 500)],
  );
  return Boolean(result.rowCount);
}

export async function processCareInboundReply(pool: Pool, from: string, subject?: string, eventKey?: string) {
  const key = eventKey || createHash('sha256').update(`${from}|${subject || ''}`).digest('hex');
  if (!(await claimCareWebhook(pool, `inbound:${key}`))) return { duplicate: true, matched: 0 };
  const result = await pool.query(
    `UPDATE leads SET status='replied', updated_at=NOW()
     WHERE LOWER(email)=LOWER($1)
       AND LOWER(COALESCE(status,'new')) NOT IN ('converted','opted_out')
     RETURNING id,tenant_id`,
    [from],
  );
  for (const row of result.rows) {
    await pool.query(
      `UPDATE care_followup_log SET replied_at=NOW(), status='SKIPPED'
       WHERE tenant_id=$1 AND lead_id=$2 AND status NOT IN ('SENT','UNKNOWN')`,
      [row.tenant_id, row.id],
    );
  }
  return { duplicate: false, matched: result.rowCount || 0 };
}

export async function processCareTrackingEvent(pool: Pool, event: { event: string; email?: string; messageId?: string; timestamp?: number; tags?: string[] }) {
  const key = event.messageId || `${event.event}|${event.email || ''}|${event.timestamp || ''}|${(event.tags || []).join(',')}`;
  if (!(await claimCareWebhook(pool, `event:${key}`))) return { duplicate: true, matched: 0 };
  const keys = (event.tags || []).filter(tag => tag.startsWith('delivery-key:')).map(tag => tag.slice(14));
  if (!keys.length) return { duplicate: false, matched: 0 };
  const column = event.event.toLowerCase() === 'opened' ? 'opened_at' : event.event.toLowerCase() === 'clicks' || event.event.toLowerCase() === 'clicked' ? 'clicked_at' : null;
  if (!column) return { duplicate: false, matched: 0 };
  const result = await pool.query(`UPDATE care_followup_log SET ${column}=COALESCE(${column},NOW()) WHERE delivery_key = ANY($1::text[])`, [keys]);
  return { duplicate: false, matched: result.rowCount || 0 };
}