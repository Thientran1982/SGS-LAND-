// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
const FOOTER_PROJECTS = [
  { label: "Aqua City Novaland",       href: "/du-an/aqua-city" },
  { label: "The Global City",          href: "/du-an/the-global-city" },
  { label: "Masteri Park Place",       href: "/du-an/masteri-park-place" },
  { label: "Izumi City Nam Long",      href: "/du-an/izumi-city" },
  { label: "Vinhomes Grand Park",      href: "/du-an/vinhomes-grand-park" },
  { label: "Vinhomes Cần Giờ",         href: "/du-an/vinhomes-can-gio" },
  { label: "Masteri Cosmo Central",    href: "/landing/masteri-cosmo-central/" },
  { label: "Vinhomes Hóc Môn",          href: "/landing/vinhomes-hoc-mon/" },
  { label: "Diamond Sky Van Phúc City", href: "/du-an/diamond-sky-van-phuc-city" },
  { label: "Legacy 66",                href: "/landing/legacy-66/" },
  { label: "Grand Manhattan Novaland", href: "/du-an/grand-manhattan-novaland" },
  { label: "Khu đô thị Thủ Thiêm",      href: "/du-an/thu-thiem" },
  { label: "Sơn Kim Land",             href: "/du-an/son-kim-land" },
];
const FOOTER_SUPPORT_CUSTOMER = [
  { vi: "Tìm kiếm BĐS", en: "Property Search", href: "/marketplace" },
  { vi: "Định giá AI", en: "AI Valuation", href: "/ai-valuation" },
  { vi: "Lãi suất ngân hàng", en: "Bank Rates", href: "/lai-suat-ngan-hang" },
  { vi: "Trò chuyện với Minh", en: "Chat with Minh", href: "/livechat" },
  { vi: "Hướng dẫn sử dụng", en: "User Guide", href: "/huong-dan-su-dung" },
];
const FOOTER_SUPPORT_AGENT = [
  { vi: "CRM Bất Động Sản", en: "Real Estate CRM", href: "/crm-platform" },
  { vi: "Trung tâm hỗ trợ", en: "Help Center", href: "/help-center" },
];
const FOOTER_ABOUT = [
  { vi: "Về chúng tôi",     en: "About Us",             href: "/about-us" },
  { vi: "Tin tức",          en: "News",                 href: "/news" },
  { vi: "Tuyển dụng",       en: "Careers",              href: "/careers" },
  { vi: "Liên hệ",          en: "Contact",              href: "/contact" },
  { vi: "Chủ đầu tư",       en: "Developers",           href: "/chu-dau-tu" },
  { vi: "BĐS Thủ Đức",      en: "Thu Duc Properties",   href: "/khu-vuc/bat-dong-san-thu-duc" },
  { vi: "BĐS Long Thành",    en: "Long Thanh Properties", href: "/khu-vuc/bat-dong-san-long-thanh" },
  { vi: "BĐS Đồng Nai",      en: "Dong Nai Properties",  href: "/khu-vuc/bat-dong-san-dong-nai" },
  { vi: "BĐS Bình Thạnh",    en: "Binh Thanh Properties", href: "/khu-vuc/bat-dong-san-binh-thanh" },
  { vi: "BĐS Quận 7",        en: "District 7 Properties", href: "/khu-vuc/bat-dong-san-quan-7" },
  { vi: "BĐS Long An",       en: "Long An Properties",   href: "/khu-vuc/bat-dong-san-long-an" },
  { vi: "Nhà phố Trung Tâm",  en: "Central Townhouses",   href: "/khu-vuc/nha-pho-trung-tam" },
  { vi: "Trạng thái hệ thống", en: "System Status",        href: "/status" },
];
const LEGAL_LINKS = [
  { vi: "Chính sách bảo mật", en: "Privacy Policy", href: "/privacy-policy" },
  { vi: "Điều khoản",         en: "Terms",          href: "/terms-of-service" },
  { vi: "Cookie",             en: "Cookie",         href: "/cookie-settings" },
];
const linkHover = (e: React.MouseEvent<HTMLAnchorElement | HTMLElement>, hover: boolean) => {
  (e.currentTarget as HTMLElement).style.color = hover ? "#D4A855" : "#B9C6D4";
};
type Lang = "vi" | "en";

// Evaluated once at module load — same on server and client, avoids hydration mismatch
const FOOTER_YEAR = new Date().getFullYear();

export function PublicFooter() {
  const lang: Lang = useLang();
  return (
      <footer className="ui-public-footer" style={{ background: "var(--sgs-primary-deep)", borderTop: "1px solid rgba(200,150,62,0.2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">

        {/* ── 4-column grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Col 1 - Brand + contact */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo-white.png" alt="SGS Land" className="w-9 h-9 shrink-0" style={{ objectFit: "contain" }} />
              <div>
                <div className="font-bold text-base" style={{ color: "#E4EDF5", fontFamily: "var(--font-noto-serif, Georgia, serif)", letterSpacing: "-0.02em" }}>
                  SGS <span style={{ color: "var(--sgs-accent)" }}>LAND</span>
                </div>
                <div className="text-[12px] font-semibold uppercase" style={{ color: "rgba(200,150,62,0.7)", letterSpacing: "0.2em" }}>Proptech</div>
              </div>
            </div>
            <p className="text-[13px] mb-3 leading-relaxed" style={{ color: "#7A91A8" }}>
              {lang === "vi"
                ? "Nền tảng AI quản lý & phân phối BĐS · Sàn BĐS F1 uy tín · Tin dùng bởi 15.000+ môi giới."
                : "AI-powered real estate management & distribution platform · Trusted F1 · Trusted by 15.000+ brokers."}
            </p>
            <div className="flex flex-col gap-1.5">
              <a href="tel:+84971132378" className="text-[13px] flex items-center gap-2" style={{ color: "#B9C6D4" }} onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                0971 132 378
              </a>
              <p className="text-[13px] flex items-start gap-2 mb-1" style={{ color: "#B9C6D4" }}>
                {tt(lang, "122 - 124 B2, Khu đô thị Sala, Phường An Khánh, TP.HCM, Việt Nam", "122 - 124 B2, Sala Urban Area, An Khanh Ward, HCMC, Vietnam")}
              </p>
              <a href="mailto:info@sgsland.vn" className="text-[13px]" style={{ color: "#B9C6D4" }} onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>
                info@sgsland.vn
              </a>
              <p className="text-[13px] mt-1" style={{ color: "#7A91A8" }}>
                {lang === "vi" ? "Hỗ trợ 7/7 · 8:00 - 18:00" : "Support 7/7 · 8:00 - 18:00"}
              </p>
            </div>
          </div>

          {/* Col 2 — Dự án ──────────────────────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#C6923D", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Dự Án Nổi Bật" : "Featured Projects"}
            </h3>
            <ul className="space-y-2.5">
              {[...FOOTER_PROJECTS.slice(0, 6), { label: lang === "en" ? "View all projects →" : "Xem tất cả dự án →", href: "/du-an" }].map((link) => (
                <li key={link.href}>
                  <Link
                    href={lang === "en" ? "/en" + link.href : link.href}
                    className="text-[13px] transition-colors block"
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
              style={{ color: "#C6923D", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Dịch Vụ" : "Services"}
            </h3>
            <p
              className="text-xs font-semibold uppercase mb-2.5"
              style={{ color: "var(--sgs-on-dark-muted)", letterSpacing: "0.08em" }}
            >
              {lang === "vi" ? "Dành cho khách hàng" : "For Customers"}
            </p>
            <ul className="space-y-2.5 mb-5">
              {FOOTER_SUPPORT_CUSTOMER.map((link) => (
                <li key={link.href}>
                  <Link
                    href={lang === "en" ? "/en" + link.href : link.href}
                    className="text-[13px] transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {lang === "vi" ? link.vi : link.en}
                  </Link>
                </li>
              ))}
            </ul>
            <p
              className="text-xs font-semibold uppercase mb-2.5"
              style={{ color: "var(--sgs-on-dark-muted)", letterSpacing: "0.08em" }}
            >
              {lang === "vi" ? "Dành cho môi giới" : "For Agents"}
            </p>
            <ul className="space-y-2.5">
              {FOOTER_SUPPORT_AGENT.map((link) => (
                <li key={link.href}>
                  <Link
                    href={lang === "en" ? "/en" + link.href : link.href}
                    className="text-[13px] transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {lang === "vi" ? link.vi : link.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Col 4 — Về SGS LAND + pháp nhân ────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#C6923D", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Về SGS LAND" : "About SGS LAND"}
            </h3>
            <ul className="space-y-2.5 mb-5">
              {FOOTER_ABOUT.filter((l) => !l.vi.startsWith("BĐS") && l.vi !== "Nhà phố Trung Tâm").map((link) => (
                <li key={link.href}>
                  <Link
                    href={lang === "en" ? "/en" + link.href : link.href}
                    className="text-[13px] transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {lang === "vi" ? link.vi : link.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* ── Bottom bar ────────────────────────────────── */}
        <div
          className="pt-10"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p
            className="text-xs font-semibold uppercase mb-3"
            style={{ color: "var(--sgs-on-dark-muted)", letterSpacing: "0.08em" }}
          >
            {lang === "vi" ? "Khu vực nổi bật" : "Featured Areas"}
          </p>
          <div className="flex flex-wrap gap-2 pb-1">
          {FOOTER_ABOUT.filter((l) => l.vi.startsWith("BĐS") || l.vi === "Nhà phố Trung Tâm").map((link) => (
            <Link
              key={link.href}
              href={lang === "en" ? "/en" + link.href : link.href}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{ color: "#B9C6D4", background: "rgba(255,255,255,0.05)" }}
              onMouseEnter={e => linkHover(e, true)}
              onMouseLeave={e => linkHover(e, false)}
            >
              {lang === "en" ? link.en : link.vi}
            </Link>
          ))}
        </div>
        </div>

        <div className="flex justify-end pt-4">
          <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>
            API: <a href="/developers" style={{ color: "#B9C6D4" }} onMouseEnter={e => linkHover(e, true)} onMouseLeave={e => linkHover(e, false)}>developers</a>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-20 sm:pb-6 sm:pr-24">
          <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>
            © {FOOTER_YEAR} SGS LAND. {lang === "vi" ? "Bảo lưu mọi quyền." : "All rights reserved."} · {tt(lang, "Cấp ngày: 01/01/2018 tại TP.HCM", "Issued: 01/01/2018 in Ho Chi Minh City")}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={lang === "en" ? "/en" + link.href : link.href}
                className="text-xs transition-colors"
                style={{ color: "var(--sgs-on-dark-muted)" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--sgs-on-dark-muted)"}
              >
                {lang === "vi" ? link.vi : link.en}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
