// provider-watchdog.ts — giám sát failover provider + báo Minh qua email khi quá ngưỡng
import { pool, withTenantContext } from "../db";
import { emailService } from "./emailService";

const MAIN = "00000000-0000-0000-0000-000000000001";
const TO = process.env.REPORT_EMAIL || "toletran2408@gmail.com";
const ALERT_THRESHOLD = Number(process.env.PROVIDER_ALERT_THRESHOLD || 3);

interface FailoverEvent {
  provider: string;
  model: string;
  error: string;
  timestamp: string;
}

export async function checkProviderFailovers(): Promise<{ failovers: FailoverEvent[]; alerted: boolean }> {
  // 1. Đếm error runs theo agent trong 1h qua
  const r = await pool.query(
    `SELECT agent_name, LEFT(COALESCE(error_text,''), 100) AS err, created_at::text AS ts
     FROM agent_runs
     WHERE status='error' AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC LIMIT 20`
  );
  const failovers: FailoverEvent[] = r.rows.map((row: any) => ({
    provider: row.agent_name,
    model: "",
    error: row.err,
    timestamp: row.ts,
  }));
  // 2. Nếu ≥ threshold → gửi email alert qua Minh
  if (failovers.length >= ALERT_THRESHOLD) {
    const rows = failovers.map((f) =>
      `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${f.provider}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${f.error}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${f.timestamp.slice(11, 19)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html lang="vi"><body style="font-family:Arial,sans-serif;background:#fef2f2;">
<table width="100%"><tr><td align="center" style="padding:20px;">
<table width="600" style="background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#dc2626;padding:16px 24px;"><h2 style="color:#fff;margin:0;font-size:16px;">🚨 PROVIDER FAILOVER — ${failovers.length} lỗi trong 1 giờ</h2></td></tr>
<tr><td style="padding:16px 24px;">
<table width="100%" style="border-collapse:collapse;"><tr style="background:#f1f5f9;"><th align="left" style="padding:4px 8px;font-size:12px;">Provider/Agent</th><th align="left" style="padding:4px 8px;font-size:12px;">Lỗi</th><th align="left" style="padding:4px 8px;font-size:12px;">Giờ</th></tr>${rows}</table>
<p style="font-size:12px;color:#64748b;margin:12px 0 0;">Minh đã tự chuyển provider theo fallback chain. Kiểm tra token/quota của các provider trên.</p>
</td></tr></table></td></tr></table></body></html>`;
    try {
      await emailService.sendEmail(MAIN, {
        to: TO,
        subject: `🚨 Provider Failover Alert — ${failovers.length} lỗi/1h`,
        html,
      });
      console.log("ALERT-SENT to=" + TO + " failovers=" + failovers.length);
      return { failovers, alerted: true };
    } catch (e: any) {
      console.log("ALERT-SEND-ERR", String(e?.message || e).slice(0, 80));
      return { failovers, alerted: false };
    }
  }
  return { failovers, alerted: false };
}

// Chạy độc lập
if (process.argv[1]?.includes("provider-watchdog")) {
  checkProviderFailovers().then((r) => {
    console.log("WATCHDOG-DONE", JSON.stringify({ failovers: r.failovers.length, alerted: r.alerted }));
    process.exit(0);
  }).catch((e) => { console.log("WATCHDOG-ERR", String(e?.message || e).slice(0, 100)); process.exit(1); });
}
