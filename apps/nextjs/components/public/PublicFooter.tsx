// @ts-nocheck
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

const FOOTER_LINKS = {
  "Bất động sản": [
    { label: "Tìm kiếm BĐS",       href: "/marketplace" },
    { label: "BĐS Đồng Nai",        href: "/bat-dong-san-dong-nai" },
    { label: "BĐS Long Thành",      href: "/bat-dong-san-long-thanh" },
    { label: "BĐS Thủ Đức",         href: "/bat-dong-san-thu-duc" },
    { label: "BĐS Bình Dương",      href: "/bat-dong-san-binh-duong" },
    { label: "Ký gửi BĐS",         href: "/ky-gui-bat-dong-san" },
  ],
  "Dự án nổi bật": [
    { label: "Aqua City Novaland",  href: "/du-an/aqua-city" },
    { label: "The Global City",     href: "/du-an/the-global-city" },
    { label: "Izumi City Nam Long", href: "/du-an/izumi-city" },
    { label: "Vinhomes Grand Park", href: "/du-an/vinhomes-grand-park" },
    { label: "Masteri Cosmo Central", href: "/p/mcc" },
  ],
  "Giải pháp": [
    { label: "CRM Bất Động Sản",  href: "/crm-platform" },
    { label: "Định giá AI",        href: "/ai-valuation" },
    { label: "Lãi suất ngân hàng", href: "/lai-suat-ngan-hang" },
    { label: "Live Chat AI",        href: "/livechat" },
    { label: "API Developers",      href: "/developers" },
  ],
  "Về SGS LAND": [
    { label: "Về chúng tôi",    href: "/about-us" },
    { label: "Tin tức",          href: "/news" },
    { label: "Tuyển dụng",       href: "/careers" },
    { label: "Liên hệ",          href: "/contact" },
    { label: "Trung tâm hỗ trợ", href: "/help-center" },
    { label: "Trạng thái hệ thống", href: "/status" },
  ],
};

const LEGAL_LINKS = [
  { label: "Chính sách bảo mật", href: "/privacy-policy" },
  { label: "Điều khoản sử dụng", href: "/terms-of-service" },
  { label: "Cookie",              href: "/cookie-settings" },
];

// Server Component — no "use client" needed
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t pb-safe-footer"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        {/* Top grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b"
          style={{ borderColor: "var(--border-default)" }}>

          {/* Brand column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--primary-600)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 12l10 5 10-5" />
                <path d="M2 17l10 5 10-5" />
              </svg>
              <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                SGS <span style={{ color: "var(--primary-600)" }}>LAND</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Nền tảng quản lý &amp; phân phối bất động sản AI số 1 Việt Nam.
              Tin dùng bởi 15.000+ môi giới và doanh nghiệp BĐS.
            </p>

            <div className="space-y-2.5">
              <a href="tel:+84971132378"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-secondary)" }}>
                <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--primary-600)" }} />
                0971 132 378
              </a>
              <a href="mailto:info@sgsland.vn"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-secondary)" }}>
                <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--primary-600)" }} />
                info@sgsland.vn
              </a>
              <span className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary-600)" }} />
                TP. Hồ Chí Minh, Việt Nam
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                {title}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:opacity-80"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            © {year} Công ty Cổ phần SGS Land. Đại lý phân phối uỷ quyền Novaland, Masterise Homes, Nam Long, Vinhomes.
          </p>
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--text-tertiary)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
