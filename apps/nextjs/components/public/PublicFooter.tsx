// @ts-nocheck
"use client";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
const FOOTER_PROJECTS = [
  { label: "Aqua City Novaland",      href: "/du-an/aqua-city"           },
  { label: "The Global City",         href: "/du-an/the-global-city"     },
  { label: "Izumi City Nam Long",     href: "/du-an/izumi-city"          },
  { label: "Vinhomes Grand Park",     href: "/du-an/vinhomes-grand-park" },
  { label: "Vinhomes Cần Giờ",        href: "/du-an/vinhomes-can-gio"    },
  { label: "Masteri Cosmo Central",   href: "/p/mcc"                     },
  { label: "Vinhomes Hóc Môn",        href: "/du-an/vinhomes-hoc-mon"    },
];
const FOOTER_SUPPORT = [
  { label: "Tìm kiếm BĐS",          href: "/marketplace"          },
  { label: "Định giá AI",            href: "/ai-valuation"         },
  { label: "Lãi suất ngân hàng",     href: "/lai-suat-ngan-hang"   },
  { label: "CRM Bất Động Sản",       href: "/crm-platform"         },
  { label: "Live Chat AI",           href: "/livechat"             },
  { label: "Trung tâm hỗ trợ",       href: "/help-center"          },
  { label: "Chính sách bảo mật",     href: "/privacy-policy"       },
  { label: "Điều khoản sử dụng",     href: "/terms-of-service"     },
  { label: "Cookie",                 href: "/cookie-settings"      },
];
const FOOTER_ABOUT = [
  { label: "Về chúng tôi",       href: "/about-us"            },
  { label: "Tin tức",             href: "/news"                },
  { label: "Tuyển dụng",          href: "/careers"             },
  { label: "Liên hệ",             href: "/contact"             },
  { label: "BĐS Đồng Nai",        href: "/bat-dong-san-dong-nai"   },
  { label: "BĐS Long Thành",      href: "/bat-dong-san-long-thanh" },
  { label: "BĐS Thủ Đức",         href: "/bat-dong-san-thu-duc"    },
  { label: "Vinhomes Central Park", href: "/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan" },
  { label: "Central Park cho thuê", href: "/bat-dong-san-binh-thanh/central-park-cho-thue" },
  { label: "Aqua City có nên mua?", href: "/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026" },
  { label: "Đất Long Thành 2026", href: "/bat-dong-san-dong-nai/dat-long-thanh-gia-bao-nhieu" },
  { label: "The Global City", href: "/bat-dong-san-thu-duc/the-global-city-masterise" },
  { label: "Căn hộ Thủ Thiêm", href: "/bat-dong-san-thu-duc/can-ho-thu-thiem-gia-bao-nhieu" },
  { label: "Aqua City vs Izumi", href: "/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh" },
  { label: "Izumi City 2026", href: "/bat-dong-san-dong-nai/izumi-city-tien-do-moi-nhat" },
  { label: "Trạng thái hệ thống", href: "/status"              },
];
const LEGAL_LINKS = [
  { label: "Chính sách bảo mật", href: "/privacy-policy"  },
  { label: "Điều khoản",          href: "/terms-of-service" },
  { label: "Cookie",              href: "/cookie-settings"  },
];
const linkHover = (e: React.MouseEvent<HTMLAnchorElement | HTMLElement>, hover: boolean) => {
  (e.currentTarget as HTMLElement).style.color = hover ? "#D4A855" : "#B9C6D4";
};
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: "var(--sgs-primary-deep)", borderTop: "1px solid rgba(200,150,62,0.2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">

        {/* ── 4-column grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Col 1 — Brand + contact ────────────────────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--sgs-accent)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5" style={{ color: "var(--sgs-primary-deep)" }}>
                  <path
                    d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
                    stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
                    fill="currentColor" fillOpacity="0.18"
                  />
                  <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div
                  className="font-bold text-base leading-tight"
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "var(--font-noto-serif, Georgia, serif)",
                  }}
                >
                  SGS <span style={{ color: "#D4A855" }}>LAND</span>
                </div>
                <div
                  className="text-[9px] font-semibold uppercase"
                  style={{ color: "rgba(200,150,62,0.7)", letterSpacing: "0.2em" }}
                >
                  Proptech
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--sgs-on-dark-muted)" }}>
              Nền tảng quản lý &amp; phân phối BĐS AI — Đại lý F1 uỷ quyền Novaland,
              Masterise Homes, Nam Long, Vinhomes. Tin dùng bởi 15.000+ môi giới.
            </p>

            <div className="space-y-2.5">
              <a
                href="tel:+84971132378"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => linkHover(e, false)}
              >
                <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--sgs-accent)" }} />
                0971 132 378
              </a>
              <a
                href="mailto:info@sgsland.vn"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => linkHover(e, false)}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--sgs-accent)" }} />
                info@sgsland.vn
              </a>
              <div className="flex items-start gap-2.5 text-sm" style={{ color: "#B9C6D4" }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--sgs-accent)" }} />
                TP. Hồ Chí Minh, Việt Nam
              </div>
            </div>
          </div>
          {/* Col 2 — Dự án ──────────────────────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              Dự án phân phối
            </h3>
            <ul className="space-y-2.5">
              {FOOTER_PROJECTS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Col 3 — Hỗ trợ & Chính sách ────────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              Hỗ trợ &amp; Chính sách
            </h3>
            <ul className="space-y-2.5">
              {FOOTER_SUPPORT.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Col 4 — Về SGS LAND + pháp nhân ────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              Về SGS LAND
            </h3>
            <ul className="space-y-2.5 mb-5">
              {FOOTER_ABOUT.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div
              className="space-y-1 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>GPKD: 0312960439</p>
              <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>Cấp ngày: 01/01/2018 tại TP.HCM</p>
              <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>MST: 0312960439</p>
              <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>API: <a href="/developers" style={{ color: "#B9C6D4" }}>developers</a></p>
            </div>
          </div>
        </div>
        {/* ── Bottom bar ────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
          <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>
            © {year} Công ty TNHH SGS Land. Đại lý F1: Novaland · Masterise Homes · Nam Long · Vinhomes.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs transition-colors"
                style={{ color: "var(--sgs-on-dark-muted)" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--sgs-on-dark-muted)"}
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
