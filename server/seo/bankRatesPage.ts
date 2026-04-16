/**
 * SSR Bank Interest Rates Page — /lai-suat-vay-ngan-hang
 *
 * Fully server-rendered HTML: crawlable by Googlebot AND AI chatbots
 * (ChatGPT, Gemini, Claude) without JavaScript execution.
 *
 * Schema.org: WebPage + Dataset + FAQPage + BreadcrumbList
 * Cache: public, s-maxage=3600, stale-while-revalidate=86400
 */

const APP_URL = 'https://sgsland.vn';
const CANONICAL = `${APP_URL}/lai-suat-vay-ngan-hang`;
const NOW_ISO = new Date().toISOString().slice(0, 10);

// ── Seed data — updated Q2 2026 ───────────────────────────────────────────────
// Source: published rate schedules from each bank's official website.
// Rates shown are indicative annual interest rates (%/năm).
export interface BankRateRow {
  id?: number;
  bank_name: string;
  bank_slug: string;
  loan_type: string;
  rate_min: number;
  rate_max: number | null;
  tenor_min: number | null;
  tenor_max: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_verified: boolean;
  updated_at?: string;
}

export const SEED_RATES: BankRateRow[] = [
  {
    bank_name: 'Agribank', bank_slug: 'agribank',
    loan_type: 'Thế chấp BĐS', rate_min: 6.0, rate_max: 7.8,
    tenor_min: 60, tenor_max: 360,
    contact_name: 'Bộ phận KHCN', contact_phone: '1900 558 818',
    notes: 'Ưu đãi 6 tháng đầu từ 6,0%/năm cho nhà ở xã hội. Ưu tiên khách hàng lương qua Agribank.',
    is_verified: true,
  },
  {
    bank_name: 'Vietcombank', bank_slug: 'vietcombank',
    loan_type: 'Thế chấp BĐS', rate_min: 6.5, rate_max: 8.0,
    tenor_min: 60, tenor_max: 360,
    contact_name: 'Phòng KHCN', contact_phone: '1800 545 413',
    notes: 'Lãi suất ưu đãi 12 tháng đầu từ 6,5%/năm. Miễn phí quản lý tài khoản khi vay.',
    is_verified: true,
  },
  {
    bank_name: 'VietinBank', bank_slug: 'vietinbank',
    loan_type: 'Vay mua nhà', rate_min: 6.5, rate_max: 8.3,
    tenor_min: 60, tenor_max: 300,
    contact_name: 'KHCN', contact_phone: '1800 588 895',
    notes: 'Cho vay tối đa 80% giá trị BĐS. Ân hạn gốc tối đa 12 tháng.',
    is_verified: true,
  },
  {
    bank_name: 'BIDV', bank_slug: 'bidv',
    loan_type: 'Thế chấp BĐS', rate_min: 7.0, rate_max: 8.5,
    tenor_min: 60, tenor_max: 360,
    contact_name: 'KHCN', contact_phone: '1900 9247',
    notes: 'Lãi ưu đãi cho dự án liên kết BIDV. Hỗ trợ vay tối đa 85% giá trị BĐS.',
    is_verified: true,
  },
  {
    bank_name: 'Sacombank', bank_slug: 'sacombank',
    loan_type: 'Thế chấp BĐS', rate_min: 7.0, rate_max: 8.9,
    tenor_min: 12, tenor_max: 240,
    contact_name: 'KHCN', contact_phone: '1800 5858 82',
    notes: 'Không yêu cầu chứng minh thu nhập với tài sản đảm bảo cao. Giải ngân trong 5 ngày.',
    is_verified: true,
  },
  {
    bank_name: 'ACB', bank_slug: 'acb',
    loan_type: 'Thế chấp BĐS', rate_min: 7.3, rate_max: 9.5,
    tenor_min: 12, tenor_max: 300,
    contact_name: 'KHCN', contact_phone: '1900 545 486',
    notes: 'Ưu đãi cho dự án đối tác ACB. Phê duyệt trong 48h. Vay linh hoạt từng đợt.',
    is_verified: true,
  },
  {
    bank_name: 'MB Bank', bank_slug: 'mb-bank',
    loan_type: 'Vay mua nhà', rate_min: 7.2, rate_max: 9.0,
    tenor_min: 12, tenor_max: 240,
    contact_name: 'KHCN', contact_phone: '1800 0080',
    notes: 'Miễn phí bảo hiểm năm đầu. Phê duyệt online qua ứng dụng MBBank.',
    is_verified: true,
  },
  {
    bank_name: 'Techcombank', bank_slug: 'techcombank',
    loan_type: 'Thế chấp BĐS', rate_min: 7.5, rate_max: 9.8,
    tenor_min: 12, tenor_max: 240,
    contact_name: 'KHCN', contact_phone: '1800 588 822',
    notes: 'Không phí trả nợ trước hạn từ năm thứ 4. Liên kết Vinhomes, Masterise, Gamuda.',
    is_verified: true,
  },
  {
    bank_name: 'SHB', bank_slug: 'shb',
    loan_type: 'Thế chấp BĐS', rate_min: 7.2, rate_max: 8.8,
    tenor_min: 12, tenor_max: 240,
    contact_name: null, contact_phone: '1800 599 928',
    notes: 'Lãi suất ưu đãi kèm gói bảo hiểm nhân thọ. Thủ tục đơn giản.',
    is_verified: false,
  },
  {
    bank_name: 'HDBank', bank_slug: 'hdbank',
    loan_type: 'Thế chấp BĐS', rate_min: 7.8, rate_max: 10.2,
    tenor_min: 12, tenor_max: 240,
    contact_name: null, contact_phone: '1800 599 999',
    notes: 'Ưu tiên khách mua BĐS dự án liên kết HDBank. Giải ngân nhanh trong tuần.',
    is_verified: false,
  },
  {
    bank_name: 'VPBank', bank_slug: 'vpbank',
    loan_type: 'Vay mua nhà', rate_min: 8.2, rate_max: 11.0,
    tenor_min: 12, tenor_max: 240,
    contact_name: null, contact_phone: '1900 545 415',
    notes: 'Phê duyệt trong 24h. Cho vay tín chấp kết hợp thế chấp linh hoạt.',
    is_verified: false,
  },
  {
    bank_name: 'OCB', bank_slug: 'ocb',
    loan_type: 'Vay mua nhà', rate_min: 7.9, rate_max: 10.5,
    tenor_min: 12, tenor_max: 240,
    contact_name: null, contact_phone: '1800 6678',
    notes: 'Liên kết Masterise Homes, Nam Long. Ưu đãi lãi suất cho khách hàng ưu tiên.',
    is_verified: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtRate(min: number, max: number | null): string {
  return max ? `${min}% – ${max}%` : `${min}%`;
}

function fmtTenor(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const toYr = (m: number) => (m % 12 === 0 ? `${m / 12} năm` : `${m} tháng`);
  if (min && max) return `${toYr(min)} – ${toYr(max)}`;
  if (max) return `Tối đa ${toYr(max)}`;
  return `Từ ${toYr(min!)}`;
}

// ── FAQ content — structured for AI discoverability ───────────────────────────

const FAQ = [
  {
    q: 'Lãi suất vay mua nhà hiện tại năm 2026 là bao nhiêu?',
    a: 'Lãi suất vay mua nhà (thế chấp bất động sản) tại Việt Nam năm 2026 dao động từ 6,0%/năm (Agribank) đến 11,0%/năm (VPBank). Các ngân hàng quốc doanh như Vietcombank, BIDV, VietinBank, Agribank có lãi suất từ 6,5–8,5%/năm. Ngân hàng tư nhân (Techcombank, VPBank, ACB…) thường từ 7,5–11%/năm. Xu hướng lãi suất đang ở mức ổn định trong Q2/2026 sau đợt điều chỉnh giảm từ NHNN.',
  },
  {
    q: 'Ngân hàng nào có lãi suất vay bất động sản thấp nhất năm 2026?',
    a: 'Agribank hiện có lãi suất vay bất động sản thấp nhất thị trường (từ 6,0%/năm), đặc biệt dành cho vay nhà ở xã hội và khách hàng nhận lương qua Agribank. Tiếp theo là Vietcombank và VietinBank với lãi suất từ 6,5%/năm trong giai đoạn ưu đãi. Ngân hàng quốc doanh thường yêu cầu hồ sơ chặt chẽ hơn so với ngân hàng tư nhân.',
  },
  {
    q: 'Điều kiện vay mua nhà tại ngân hàng là gì?',
    a: 'Để vay mua nhà tại ngân hàng Việt Nam, bạn cần: (1) Thu nhập hàng tháng ổn định và có thể chứng minh; (2) Tài sản thế chấp — thường là chính bất động sản dự định mua; (3) Hồ sơ pháp lý đầy đủ (CCCD, hộ khẩu, hợp đồng mua bán hoặc đặt cọc); (4) Lịch sử tín dụng tốt tại CIC. Vốn tự có tối thiểu 20–30% giá trị bất động sản.',
  },
  {
    q: 'Thời hạn vay mua nhà tối đa là bao lâu?',
    a: 'Thời hạn vay mua nhà tối đa tại các ngân hàng Việt Nam hiện nay: Agribank, Vietcombank, BIDV — tối đa 30 năm; VietinBank — tối đa 25 năm; Techcombank, ACB, Sacombank — tối đa 20 năm; VPBank, MB Bank, HDBank — tối đa 20 năm. Thời hạn vay phụ thuộc vào độ tuổi và thu nhập của người vay.',
  },
  {
    q: 'Cho vay bao nhiêu phần trăm giá trị bất động sản?',
    a: 'Hầu hết ngân hàng cho vay tối đa 70–85% giá trị tài sản thẩm định. BIDV và Agribank hỗ trợ đến 85%. Vietcombank, VietinBank thường tối đa 80%. Ngân hàng tư nhân linh hoạt hơn nhưng lãi suất cao hơn. Phần còn lại (15–30%) là vốn tự có của người mua.',
  },
  {
    q: 'Lãi suất cố định hay thả nổi có lợi hơn?',
    a: 'Lãi suất cố định phù hợp nếu bạn cần ổn định tài chính và dự báo lãi suất sẽ tăng. Lãi suất thả nổi thường thấp hơn trong ngắn hạn nhưng có rủi ro tăng theo thị trường. Đa số ngân hàng Việt Nam áp dụng lãi suất ưu đãi cố định 6–24 tháng đầu, sau đó thả nổi theo lãi suất huy động cộng biên độ 2–4%/năm.',
  },
];

// ── Shared CSS ────────────────────────────────────────────────────────────────

function css(): string {
  return `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#F1F5F9;color:#1E293B;line-height:1.6;font-size:15px}
    a{color:#4F46E5;text-decoration:none}a:hover{text-decoration:underline}
    .wrap{max-width:1100px;margin:0 auto;padding:0 20px}
    /* Header */
    .hdr{background:#1E293B;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:100}
    .hdr-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
    .hdr-brand:hover{text-decoration:none}
    .hdr-brand-name{font-weight:700;font-size:16px;color:#fff;letter-spacing:0.5px;white-space:nowrap}
    .hdr-nav{display:flex;align-items:center;gap:8px}
    .hdr-nav a{color:#CBD5E1;font-size:13px;font-weight:600;padding:7px 14px;border-radius:8px;border:1px solid #334155;transition:background .15s;white-space:nowrap}
    .hdr-nav a:hover{background:#334155;color:#fff;text-decoration:none}
    .hdr-nav a.primary{background:#4F46E5;border-color:#4F46E5;color:#fff}
    .hdr-nav a.primary:hover{background:#4338CA;border-color:#4338CA}
    /* Hero */
    .hero{background:linear-gradient(135deg,#1E293B 0%,#1e3a5f 100%);padding:48px 20px 60px;text-align:center}
    .hero h1{color:#fff;font-size:clamp(22px,4vw,36px);font-weight:800;line-height:1.25;margin-bottom:12px}
    .hero p{color:#94A3B8;font-size:15px;max-width:640px;margin:0 auto 24px}
    .hero-meta{display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap;margin-top:8px}
    .hero-badge{background:rgba(79,70,229,.25);color:#A5B4FC;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(79,70,229,.4)}
    /* Content */
    .content{padding:40px 0 60px;margin-top:-20px}
    /* Table card */
    .card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden;margin-bottom:28px}
    .card-hdr{padding:20px 24px 16px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;gap:10px}
    .card-hdr h2{font-size:18px;font-weight:700;color:#0F172A}
    .card-hdr p{color:#64748B;font-size:13px;margin-top:3px}
    .badge-green{background:#DCFCE7;color:#166534;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap}
    .badge-blue{background:#EEF2FF;color:#3730A3;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap}
    .tbl-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;min-width:620px}
    thead th{background:#F8FAFC;padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #E2E8F0;white-space:nowrap}
    tbody tr{border-bottom:1px solid #F1F5F9;transition:background .1s}
    tbody tr:hover{background:#F8FAFC}
    tbody td{padding:13px 16px;font-size:14px;color:#334155;vertical-align:top}
    .rate-val{font-weight:700;color:#0F172A;font-size:15px}
    .bank-name{font-weight:700;color:#0F172A}
    .verified{color:#16A34A;font-size:11px;display:inline-flex;align-items:center;gap:3px}
    .note{color:#64748B;font-size:12px;margin-top:3px}
    /* FAQ */
    .faq-list{padding:24px}
    .faq-item{border:1px solid #E2E8F0;border-radius:10px;margin-bottom:14px;overflow:hidden}
    .faq-q{padding:15px 18px;font-weight:700;color:#0F172A;font-size:15px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
    .faq-a{padding:14px 18px;color:#475569;font-size:14px;line-height:1.7}
    /* CTA */
    .cta-box{background:linear-gradient(135deg,#4F46E5,#6D28D9);border-radius:16px;padding:36px 28px;text-align:center;color:#fff;margin-bottom:28px}
    .cta-box h2{font-size:22px;font-weight:700;margin-bottom:8px}
    .cta-box p{color:#C7D2FE;font-size:14px;margin-bottom:24px}
    .cta-btn{display:inline-block;background:#fff;color:#4F46E5;padding:13px 32px;border-radius:10px;font-weight:700;font-size:15px;transition:transform .15s}
    .cta-btn:hover{transform:translateY(-1px);text-decoration:none}
    /* Info boxes */
    .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:28px}
    .info-item{background:#fff;border-radius:12px;padding:20px;border:1px solid #E2E8F0;text-align:center}
    .info-val{font-size:28px;font-weight:800;color:#4F46E5;display:block;line-height:1}
    .info-label{font-size:12px;color:#64748B;margin-top:6px}
    /* Breadcrumb */
    .bc{padding:14px 0;font-size:13px;color:#64748B;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .bc-sep{color:#CBD5E1}
    /* Footer */
    .ftr{background:#1E293B;color:#94A3B8;padding:32px 20px;text-align:center}
    .ftr a{color:#A5B4FC;font-size:13px}
    .ftr p{font-size:12px;margin-top:10px}
    /* Disclaimer */
    .disclaimer{background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px 18px;font-size:12px;color:#92400E;margin-bottom:24px}
    /* UGC section */
    .ugc-intro{padding:20px 24px;color:#64748B;font-size:13px;border-bottom:1px solid #E2E8F0}
    .ugc-empty{padding:32px 24px;text-align:center;color:#94A3B8;font-size:14px}
    .ugc-row td:first-child{min-width:130px}
    .chip{display:inline-block;background:#F1F5F9;border:1px solid #E2E8F0;padding:2px 8px;border-radius:6px;font-size:11px;color:#475569}
  `;
}

// ── Table row helpers ─────────────────────────────────────────────────────────

function seedRow(r: BankRateRow): string {
  const verified = r.is_verified
    ? `<span class="verified">&#10003; Đã xác minh</span>`
    : `<span class="chip">Cộng đồng</span>`;
  return `<tr>
    <td><span class="bank-name">${esc(r.bank_name)}</span><br/>${verified}</td>
    <td><span class="chip">${esc(r.loan_type)}</span></td>
    <td><span class="rate-val">${fmtRate(r.rate_min, r.rate_max)}/năm</span></td>
    <td>${fmtTenor(r.tenor_min, r.tenor_max)}</td>
    <td>${r.contact_phone ? `<a href="tel:${esc(r.contact_phone)}">${esc(r.contact_phone)}</a>` : '—'}</td>
    <td><span class="note">${esc(r.notes)}</span></td>
  </tr>`;
}

function ugcRow(r: BankRateRow): string {
  const rawDate = r.updated_at as unknown;
  const dt = rawDate
    ? (rawDate instanceof Date
        ? (rawDate as Date).toISOString()
        : String(rawDate)
      ).slice(0, 10)
    : '';
  return `<tr class="ugc-row">
    <td><span class="bank-name">${esc(r.bank_name)}</span></td>
    <td><span class="chip">${esc(r.loan_type)}</span></td>
    <td><span class="rate-val">${fmtRate(r.rate_min, r.rate_max)}/năm</span></td>
    <td>${fmtTenor(r.tenor_min, r.tenor_max)}</td>
    <td>${r.contact_name ? esc(r.contact_name) : '—'}</td>
    <td>${r.contact_phone ? `<a href="tel:${esc(r.contact_phone)}">${esc(r.contact_phone)}</a>` : '—'}</td>
    <td><span class="note">${dt}</span></td>
  </tr>`;
}

// ── Schema.org markup ─────────────────────────────────────────────────────────

function buildSchema(ugcCount: number): string {
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Bảng lãi suất vay ngân hàng mua bất động sản Việt Nam 2026',
    description: 'Dữ liệu lãi suất vay thế chấp bất động sản từ các ngân hàng lớn tại Việt Nam, bao gồm Vietcombank, BIDV, Agribank, Techcombank, MB Bank và nhiều ngân hàng khác. Cập nhật Q2 2026.',
    url: CANONICAL,
    creator: { '@type': 'Organization', name: 'SGS Land', url: APP_URL },
    dateModified: NOW_ISO,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    variableMeasured: 'Lãi suất vay thế chấp bất động sản (%/năm)',
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Lãi Suất Ngân Hàng', item: CANONICAL },
    ],
  };
  const webpage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Lãi Suất Vay Ngân Hàng 2026 | Bảng So Sánh Mới Nhất – SGS Land',
    description: 'So sánh lãi suất vay thế chấp bất động sản từ 12 ngân hàng lớn tại Việt Nam. Cập nhật Q2 2026.',
    url: CANONICAL,
    datePublished: '2024-01-01',
    dateModified: NOW_ISO,
    publisher: { '@type': 'Organization', name: 'SGS Land', url: APP_URL },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: breadcrumb.itemListElement },
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return [dataset, breadcrumb, webpage, faqSchema]
    .map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n');
}

// ── Main HTML generator ───────────────────────────────────────────────────────

export function getBankRatesHtml(ugcRates: BankRateRow[] = []): string {
  const totalBanks = SEED_RATES.length;
  const minRate    = Math.min(...SEED_RATES.map(r => r.rate_min)).toFixed(1);
  const maxRate    = Math.max(...SEED_RATES.map(r => r.rate_max ?? r.rate_min)).toFixed(1);

  const seedTableRows = SEED_RATES.map(seedRow).join('');
  const ugcTableRows  = ugcRates.length
    ? ugcRates.map(ugcRow).join('')
    : `<tr><td colspan="7" class="ugc-empty">Chưa có thông tin lãi suất nào được đăng từ cộng đồng.<br/>
        <a href="/#/lai-suat-ngan-hang" class="ugc-cta-link">Đăng thông tin lãi suất ngay →</a>
       </td></tr>`;

  const faqHtml = FAQ.map(f => `
    <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="faq-q" itemprop="name">${esc(f.q)}</div>
      <div class="faq-a" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
        <span itemprop="text">${esc(f.a)}</span>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="vi" itemscope itemtype="https://schema.org/WebPage">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
  <link rel="apple-touch-icon" href="/icon-192.png"/>
  <title>Lãi Suất Vay Ngân Hàng 2026 | Bảng So Sánh Mới Nhất – SGS Land</title>
  <meta name="description" content="Cập nhật bảng lãi suất vay ngân hàng mua bất động sản mới nhất Q2/2026. So sánh lãi suất thế chấp từ Vietcombank, BIDV, Techcombank, Agribank, MB Bank. Tư vấn vay miễn phí."/>
  <link rel="canonical" href="${CANONICAL}"/>
  <meta property="og:title" content="Lãi Suất Vay Ngân Hàng 2026 – SGS Land"/>
  <meta property="og:description" content="So sánh lãi suất vay thế chấp bất động sản từ 12+ ngân hàng lớn tại Việt Nam. Cập nhật Q2 2026."/>
  <meta property="og:url" content="${CANONICAL}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:image" content="${APP_URL}/og-image.jpg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <link rel="alternate" hreflang="vi" href="${CANONICAL}"/>
  <link rel="alternate" hreflang="x-default" href="${CANONICAL}"/>
  ${buildSchema(ugcRates.length)}
  <link rel="stylesheet" href="/bank-rates.css"/>
</head>
<body>

<!-- HEADER -->
<header class="hdr">
  <a href="/" class="hdr-brand">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" class="svg-p1"/>
      <path d="M2 12l10 5 10-5" class="svg-p2"/>
      <path d="M2 17l10 5 10-5" class="svg-p3"/>
    </svg>
    <span class="hdr-brand-name">SGS LAND</span>
  </a>
  <nav class="hdr-nav">
    <a href="/#/marketplace">Tin rao</a>
    <a href="/#/lai-suat-ngan-hang">Đăng lãi suất</a>
    <a href="/#/contact" class="primary">Tư vấn miễn phí</a>
  </nav>
</header>

<!-- HERO -->
<section class="hero">
  <div class="wrap">
    <nav aria-label="Breadcrumb">
      <div class="bc bc-center">
        <a href="/" class="bc-home">Trang chủ</a>
        <span class="bc-sep">›</span>
        <span>Lãi suất ngân hàng</span>
      </div>
    </nav>
    <h1 itemprop="name">Bảng Lãi Suất Vay Ngân Hàng Mua BĐS Mới Nhất 2026</h1>
    <p itemprop="description">So sánh lãi suất vay thế chấp bất động sản từ ${totalBanks} ngân hàng lớn tại Việt Nam. Tư vấn vay mua nhà miễn phí từ chuyên gia SGS Land.</p>
    <div class="hero-meta">
      <span class="hero-badge">Cập nhật Q2/2026</span>
      <span class="hero-badge">${totalBanks} ngân hàng</span>
      <span class="hero-badge">${minRate}% – ${maxRate}%/năm</span>
    </div>
  </div>
</section>

<!-- MAIN CONTENT -->
<main class="content">
  <div class="wrap">

    <!-- Key stats -->
    <div class="info-grid">
      <div class="info-item">
        <span class="info-val">${minRate}%</span>
        <div class="info-label">Lãi suất thấp nhất/năm<br/>(Agribank)</div>
      </div>
      <div class="info-item">
        <span class="info-val">${totalBanks}</span>
        <div class="info-label">Ngân hàng trong bảng<br/>so sánh</div>
      </div>
      <div class="info-item">
        <span class="info-val">30</span>
        <div class="info-label">Thời hạn vay tối đa<br/>(năm)</div>
      </div>
      <div class="info-item">
        <span class="info-val">85%</span>
        <div class="info-label">Tỷ lệ cho vay tối đa<br/>giá trị BĐS</div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div class="disclaimer">
      <strong>Lưu ý:</strong> Bảng lãi suất mang tính tham khảo, cập nhật Q2/2026. Lãi suất thực tế phụ thuộc vào hồ sơ khách hàng, loại tài sản và chính sách từng ngân hàng. Liên hệ ngân hàng hoặc chuyên gia SGS Land để được báo giá chính xác.
    </div>

    <!-- Community UGC Table -->
    <div class="card">
      <div class="card-hdr">
        <div>
          <h2>Lãi Suất Cập Nhật Từ Cộng Đồng <span class="badge-blue">UGC</span></h2>
          <p>Thông tin do môi giới và ngân hàng đối tác chia sẻ — bao gồm người liên hệ trực tiếp</p>
        </div>
      </div>
      <div class="ugc-intro">
        Bạn là nhân viên ngân hàng hoặc chuyên gia tài chính? 
        <a href="/#/lai-suat-ngan-hang">Đăng nhập để chia sẻ thông tin lãi suất →</a>
      </div>
      <span class="tbl-scroll-hint">&#8592; Vuốt ngang để xem thêm &#8594;</span>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Ngân hàng</th>
              <th>Loại vay</th>
              <th>Lãi suất</th>
              <th>Kỳ hạn</th>
              <th>Người liên hệ</th>
              <th>Số điện thoại</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>${ugcTableRows}</tbody>
        </table>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-box">
      <h2>Cần Tư Vấn Vay Mua Nhà Miễn Phí?</h2>
      <p>Chuyên gia SGS Land kết nối bạn với ngân hàng phù hợp, hỗ trợ hồ sơ và đàm phán lãi suất tốt nhất</p>
      <a href="/#/contact" class="cta-btn">Tư Vấn Miễn Phí Ngay</a>
    </div>

    <!-- FAQ -->
    <div class="card">
      <div class="card-hdr">
        <div>
          <h2>Câu Hỏi Thường Gặp Về Lãi Suất Vay Ngân Hàng</h2>
          <p>Giải đáp các thắc mắc phổ biến về vay thế chấp bất động sản tại Việt Nam</p>
        </div>
      </div>
      <div class="faq-list" itemscope itemtype="https://schema.org/FAQPage">
        ${faqHtml}
      </div>
    </div>

    <!-- Internal links -->
    <div class="card card-links">
      <h2>Tìm Hiểu Thêm Về Bất Động Sản</h2>
      <ul class="links-list">
        <li><a href="/#/bat-dong-san-dong-nai">BĐS Đồng Nai</a></li>
        <li>·</li>
        <li><a href="/#/bat-dong-san-long-thanh">BĐS Long Thành</a></li>
        <li>·</li>
        <li><a href="/#/bat-dong-san-thu-duc">BĐS Thủ Đức</a></li>
        <li>·</li>
        <li><a href="/#/bat-dong-san-binh-duong">BĐS Bình Dương</a></li>
        <li>·</li>
        <li><a href="/#/ai-valuation">Định giá AI</a></li>
        <li>·</li>
        <li><a href="/#/marketplace">Tin rao mua bán</a></li>
      </ul>
    </div>

  </div>
</main>

<!-- FOOTER -->
<footer class="ftr">
  <div class="wrap">
    <a href="/" class="ftr-brand">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" class="svg-p1"/>
        <path d="M2 12l10 5 10-5" class="svg-p2"/>
        <path d="M2 17l10 5 10-5" class="svg-p3"/>
      </svg>
      <span class="ftr-brand-name">SGS LAND</span>
    </a>
    <p>
      <a href="/#/about-us">Về chúng tôi</a> &nbsp;·&nbsp;
      <a href="/#/contact">Liên hệ</a> &nbsp;·&nbsp;
      <a href="/#/privacy-policy">Chính sách</a> &nbsp;·&nbsp;
      <a href="/lai-suat-vay-ngan-hang">Lãi suất ngân hàng</a>
    </p>
    <p class="ftr-copy">&copy; ${new Date().getFullYear()} SGS Land &mdash; 122-124 B2, Sala, Thủ Đức, TP.HCM &mdash; 0971 132 378</p>
    <p class="ftr-note">Thông tin lãi suất mang tính tham khảo. Liên hệ ngân hàng để biết lãi suất chính xác.</p>
  </div>
</footer>

</body>
</html>`;
}
