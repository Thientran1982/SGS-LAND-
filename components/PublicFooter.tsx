import React from 'react';

// -----------------------------------------------------------------------------
// Shared public site footer (single source of truth).
// Extracted from Landing.tsx so the company-info footer is defined ONCE and
// reused across all public pages — eliminates duplicate-content across pages.
// -----------------------------------------------------------------------------

export type Lang = 'vi' | 'en';

const FOOTER_PROJECTS = [
  { label: "Aqua City Novaland",        href: "/du-an/aqua-city"               },
  { label: "The Global City",           href: "/du-an/the-global-city"         },
  { label: "Masteri Park Place",        href: "/du-an/masteri-park-place"       },
  { label: "Izumi City Nam Long",       href: "/du-an/izumi-city"              },
  { label: "Vinhomes Grand Park",       href: "/du-an/vinhomes-grand-park"     },
  { label: "Vinhomes Cần Giờ",          href: "/du-an/vinhomes-can-gio"        },
  { label: "Masteri Cosmo Central",     href: "/landing/masteri-cosmo-central/"},
  { label: "Vinhomes Hóc Môn",          href: "/landing/vinhomes-hoc-mon/"     },
  { label: "Diamond Sky Vạn Phúc City", href: "/du-an/diamond-sky-van-phuc-city"},
  { label: "Legacy 66",                 href: "/landing/legacy-66/"            },
  { label: "Grand Manhattan Novaland",  href: "/du-an/grand-manhattan-novaland"},
  { label: "Khu đô thị Thủ Thiêm",      href: "/du-an/thu-thiem"               },
  { label: "Sơn Kim Land",              href: "/du-an/son-kim-land"            },
];
const FOOTER_SUPPORT = [
  { vi: "Tìm kiếm BĐS",      en: "Property Search",  href: "/marketplace"         },
  { vi: "Định giá AI",        en: "AI Valuation",     href: "/ai-valuation"        },
  { vi: "Lãi suất ngân hàng", en: "Bank Rates",       href: "/lai-suat-ngan-hang"  },
  { vi: "CRM Bất Động Sản",   en: "Real Estate CRM",  href: "/crm-platform"        },
  { vi: "Live Chat AI",       en: "Live Chat AI",     href: "/livechat"            },
  { vi: "Trung tâm hỗ trợ",  en: "Help Center",      href: "/help-center"         },
  { vi: "Hướng dẫn sử dụng", en: "User Guide",       href: "/huong-dan-su-dung"   },
];
const FOOTER_ABOUT = [
  { vi: "Về chúng tôi",       en: "About Us",              href: "/about-us"               },
  { vi: "Tin tức",             en: "News",                  href: "/news"                   },
  { vi: "Tuyển dụng",          en: "Careers",               href: "/careers"                },
  { vi: "Liên hệ",             en: "Contact",               href: "/contact"                },
  { vi: "Chủ đầu tư",         en: "Developers",            href: "/chu-dau-tu"             },
  { vi: "BĐS Thủ Đức",        en: "Thu Duc Properties",    href: "/bat-dong-san-thu-duc"   },
  { vi: "BĐS Long Thành",     en: "Long Thanh Properties", href: "/bat-dong-san-long-thanh"},
  { vi: "BĐS Đồng Nai",       en: "Dong Nai Properties",   href: "/bat-dong-san-dong-nai"  },
  { vi: "BĐS Bình Thạnh",     en: "Binh Thanh Properties", href: "/bat-dong-san-binh-thanh"},
  { vi: "BĐS Quận 7",         en: "District 7 Properties", href: "/bat-dong-san-quan-7"    },
  { vi: "BĐS Long An",        en: "Long An Properties",    href: "/bat-dong-san-long-an"   },
  { vi: "Nhà phố Trung Tâm",  en: "Central Townhouses",    href: "/du-an/nha-pho-trung-tam"},
  { vi: "Trạng thái hệ thống", en: "System Status",        href: "/status"                 },
];
const LEGAL_LINKS = [
  { vi: "Chính sách bảo mật", en: "Privacy Policy",  href: "/privacy-policy"   },
  { vi: "Điều khoản",          en: "Terms",           href: "/terms-of-service" },
  { vi: "Cookie",              en: "Cookie",          href: "/cookie-settings"  },
];

function linkHover(e: React.MouseEvent<HTMLAnchorElement | HTMLElement>, hover: boolean) {
  (e.currentTarget as HTMLElement).style.color = hover ? "#D4A855" : "#B9C6D4";
}

export function PublicFooter({ lang }: { lang: Lang }) {
  const year = new Date().getFullYear();
  return (
    <footer className="ui-public-footer" style={{ background:"var(--sgs-primary-deep)", borderTop:"1px solid rgba(200,150,62,0.2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {/* Col 1 — Brand + contact */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo-white.png" alt="SGS Land" className="w-9 h-9 shrink-0" style={{ objectFit:"contain" }} />
              <div>
                <div className="font-bold text-base" style={{ color:"var(--ui-text-inverse)", fontFamily:"var(--font-display)", letterSpacing:"-0.02em" }}>
                  SGS <span style={{ color:"var(--sgs-accent)" }}>LAND</span>
                </div>
                <div className="text-[9px] font-semibold uppercase" style={{ color:"rgba(200,150,62,0.7)", letterSpacing:"0.2em" }}>Proptech</div>
              </div>
            </div>
            <p className="text-xs mb-3 leading-relaxed" style={{ color:"#7A91A8" }}>
              {lang === "vi"
                ? "Nền tảng AI quản lý & phân phối BĐS · Sàn BĐS F1 uy tín · Tin dùng bởi 15.000+ môi giới."
                : "Ai-powered real estate management & distribution platform · Trusted F1 · Trusted by 15.000+ brokers."}
            </p>
            <div className="flex flex-col gap-1.5">
              <a href="tel:+84379281445" className="text-xs flex items-center gap-2" style={{ color:"#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                0379 281 445
              </a>
              <p className="text-xs flex items-start gap-2 mb-1" style={{ color:"#B9C6D4" }}>
                📍 122 - 124 B2, Khu đô thị Sala, Phường An Khánh, TP.HCM, Việt Nam
              </p>
              <a href="mailto:info@sgsland.vn" className="text-xs" style={{ color:"#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                ✉ info@sgsland.vn
              </a>
              <p className="text-xs mt-1" style={{ color:"#7A91A8" }}>
                {lang === "vi" ? "Hỗ trợ 7/7 · 8:00 – 18:00" : "Support 7/7 · 8:00 – 18:00"}
              </p>
            </div>
          </div>

          {/* Col 2 — Projects */}
          <div>
            <h4 className="text-xs font-semibold uppercase mb-3" style={{ color:"#B9C6D4", letterSpacing:"0.12em" }}>
              {lang === "vi" ? "Dự Án Nổi Bật" : "Featured Projects"}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {FOOTER_PROJECTS.map(p => (
                <li key={p.href}>
                  <a href={p.href} className="text-xs" style={{ color:"#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                    {p.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Support */}
          <div>
            <h4 className="text-xs font-semibold uppercase mb-3" style={{ color:"#B9C6D4", letterSpacing:"0.12em" }}>
              {lang === "vi" ? "Dịch Vụ" : "Services"}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {FOOTER_SUPPORT.map(s => (
                <li key={s.href}>
                  <a href={s.href} className="text-xs" style={{ color:"#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                    {lang === "vi" ? s.vi : s.en}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — About */}
          <div>
            <h4 className="text-xs font-semibold uppercase mb-3" style={{ color:"#B9C6D4", letterSpacing:"0.12em" }}>
              {lang === "vi" ? "Về SGS LAND" : "About SGS LAND"}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {FOOTER_ABOUT.map(a => (
                <li key={a.href}>
                  <a href={a.href} className="text-xs" style={{ color:"#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                    {lang === "vi" ? a.vi : a.en}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
          <p className="text-xs" style={{ color:"#4D657A" }}>
            © {year} SGS LAND. {lang === "vi" ? "Bảo lưu mọi quyền." : "All rights reserved."}
          </p>
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map(l => (
              <a key={l.href} href={l.href} className="text-xs" style={{ color:"#4D657A" }}
                onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                {lang === "vi" ? l.vi : l.en}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
