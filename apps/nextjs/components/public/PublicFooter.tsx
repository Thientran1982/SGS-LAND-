// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, switchLangPath } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
import { Globe, Moon, Sun, Phone, Mail, MapPin, Clock, ArrowUpRight, Sparkles, ChevronDown } from "lucide-react";

const FOOTER_PROJECTS = [
  { label: "Aqua City Novaland",       href: "/du-an/aqua-city" },
  { label: "The Global City",          href: "/du-an/the-global-city" },
  { label: "Masteri Park Place",       href: "/du-an/masteri-park-place" },
  { label: "Izumi City Nam Long",      href: "/du-an/izumi-city" },
  { label: "Vinhomes Grand Park",      href: "/du-an/vinhomes-grand-park" },
  { label: "Vinhomes C\u1ea7n Gi\u1edd",         href: "/du-an/vinhomes-can-gio" },
];
const FOOTER_PROJECTS_EN: Record<string, string> = { "Vinhomes C\u1ea7n Gi\u1edd": "Vinhomes Can Gio" };
const FOOTER_SERVICES = [
  { vi: "T\u00ecm ki\u1ebfm B\u0110S", en: "Property Search", href: "/marketplace" },
  { vi: "\u0110\u1ecbnh gi\u00e1 AI", en: "AI Valuation", href: "/ai-valuation" },
  { vi: "L\u00e3i su\u1ea5t ng\u00e2n h\u00e0ng", en: "Bank Rates", href: "/lai-suat-ngan-hang" },
  { vi: "K\u00fd g\u1eedi t\u00e0i s\u1ea3n", en: "Consign property", href: "/ky-gui-bat-dong-san" },
  { vi: "H\u01b0\u1edbng d\u1eabn s\u1eed d\u1ee5ng", en: "User Guide", href: "/huong-dan-su-dung" },
  { vi: "CRM cho m\u00f4i gi\u1edbi", en: "CRM for agents", href: "/crm-platform" },
  { vi: "Trung t\u00e2m h\u1ed7 tr\u1ee3", en: "Help Center", href: "/help-center" },
];
const FOOTER_ABOUT = [
  { vi: "V\u1ec1 ch\u00fang t\u00f4i", en: "About Us", href: "/about-us" },
  { vi: "Ki\u1ebfn th\u1ee9c & tin t\u1ee9c", en: "Knowledge & News", href: "/tin-tuc" },
  { vi: "Ch\u1ee7 \u0111\u1ea7u t\u01b0", en: "Developers", href: "/chu-dau-tu" },
  { vi: "Tuy\u1ec3n d\u1ee5ng", en: "Careers", href: "/careers" },
  { vi: "Li\u00ean h\u1ec7", en: "Contact", href: "/contact" },
  { vi: "Tr\u1ea1ng th\u00e1i h\u1ec7 th\u1ed1ng", en: "System Status", href: "/status" },
];
const FOOTER_AREAS = [
  { vi: "Th\u1ee7 \u0110\u1ee9c", en: "Thu Duc", href: "/khu-vuc/bat-dong-san-thu-duc" },
  { vi: "Qu\u1eadn 7", en: "District 7", href: "/khu-vuc/bat-dong-san-quan-7" },
  { vi: "B\u00ecnh Th\u1ea1nh", en: "Binh Thanh", href: "/khu-vuc/bat-dong-san-binh-thanh" },
  { vi: "Long Th\u00e0nh", en: "Long Thanh", href: "/khu-vuc/bat-dong-san-long-thanh" },
  { vi: "\u0110\u1ed3ng Nai", en: "Dong Nai", href: "/khu-vuc/bat-dong-san-dong-nai" },
  { vi: "Long An", en: "Long An", href: "/khu-vuc/bat-dong-san-long-an" },
  { vi: "Nh\u00e0 ph\u1ed1 trung t\u00e2m", en: "Central townhouses", href: "/khu-vuc/nha-pho-trung-tam" },
];
const LEGAL_LINKS = [
  { vi: "Ch\u00ednh s\u00e1ch b\u1ea3o m\u1eadt", en: "Privacy", href: "/privacy-policy" },
  { vi: "\u0110i\u1ec1u kho\u1ea3n", en: "Terms", href: "/terms-of-service" },
  { vi: "Cookie", en: "Cookie", href: "/cookie-settings" },
];
const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/share/1JqSi4hRgV/?mibextid=wwXIfr", mark: "f" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/sgs-land/", mark: "in" },
  { label: "TikTok", href: "https://www.tiktok.com/@sgsland?_r=1&_t=ZS-99Be1XaRlBc", mark: "\u266a" },
  { label: "YouTube", href: "https://www.youtube.com/@sgslandvn?si=FJh_eg1zv_t1-Wyb", mark: "\u25b6" },
];
const FOOTER_YEAR = 2026;

const CSS = `
.ft { position:relative; overflow:hidden; background:#0B1B2B; color:#B9C6D4; font-family:var(--font-be-vietnam,Arial,sans-serif); }
.ft::before { content:""; position:absolute; inset:0 0 auto 0; height:1px; background:linear-gradient(90deg,transparent,rgba(200,150,62,.65),transparent); }
.ft::after { content:""; position:absolute; width:720px; height:720px; right:-260px; top:-380px; border-radius:50%; background:radial-gradient(circle,rgba(200,150,62,.14),transparent 65%); pointer-events:none; }
.ft-wrap { position:relative; z-index:1; width:min(100%,1344px); margin-inline:auto; padding-inline:clamp(20px,4.4vw,64px); }
.ft-cta { display:flex; align-items:flex-end; justify-content:space-between; gap:32px; padding:clamp(56px,7vw,96px) 0 clamp(40px,5vw,64px); border-bottom:1px solid rgba(255,255,255,.08); }
.ft-eyebrow { color:#E4C47E; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
.ft-cta h2 { margin:12px 0 0; max-width:640px; color:#fff; font:500 clamp(32px,4.4vw,56px)/1.04 var(--font-fraunces,Georgia,serif); letter-spacing:-.035em; }
.ft-cta h2 em { color:#E4C47E; font-style:italic; }
.ft-actions { display:flex; flex-wrap:wrap; gap:10px; flex:0 0 auto; }
.ft-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:50px; padding:0 22px; border-radius:999px; border:1px solid rgba(255,255,255,.28); color:#fff; font-size:14px; font-weight:650; text-decoration:none; transition:background .2s,border-color .2s,transform .2s; }
.ft-btn:hover { background:rgba(255,255,255,.08); border-color:#E4C47E; transform:translateY(-1px); }
.ft-btn-gold { background:#C8963E; border-color:#C8963E; color:#0B1B2B; }
.ft-btn-gold:hover { background:#D9A94E; border-color:#D9A94E; }
.ft-main { display:grid; grid-template-columns:1.35fr 1fr 1fr 1fr; gap:clamp(28px,4vw,64px); padding:clamp(44px,5vw,64px) 0; }
.ft-brand-row { display:flex; align-items:center; gap:10px; }
.ft-brand-name { color:#fff; font:600 20px var(--font-fraunces,Georgia,serif); letter-spacing:-.02em; }
.ft-brand-name span { color:#C8963E; }
.ft-brand-sub { color:rgba(200,150,62,.75); font-size:11px; font-weight:650; letter-spacing:.22em; text-transform:uppercase; }
.ft-tag { margin:16px 0 22px; max-width:320px; color:#8FA2B5; font-size:14px; line-height:1.65; }
.ft-contact { display:grid; gap:11px; margin:0; padding:0; list-style:none; }
.ft-contact li { display:flex; align-items:flex-start; gap:10px; font-size:14px; line-height:1.5; }
.ft-contact svg { flex:0 0 auto; margin-top:2px; color:#C8963E; }
.ft-contact a { color:#DCE4EC; text-decoration:none; }
.ft-contact a:hover { color:#E4C47E; }
.ft-social { display:flex; gap:8px; margin-top:22px; }
.ft-social a { display:grid; width:40px; height:40px; place-items:center; border:1px solid rgba(185,198,212,.25); border-radius:50%; color:#DCE4EC; font-size:13px; font-weight:700; text-decoration:none; transition:all .2s; }
.ft-social a:hover { border-color:#C8963E; background:#C8963E; color:#0B1B2B; }
.ft-col summary { list-style:none; display:flex; align-items:center; justify-content:space-between; color:#fff; font:500 18px var(--font-fraunces,Georgia,serif); cursor:default; pointer-events:none; }
.ft-col summary::-webkit-details-marker { display:none; }
.ft-col summary svg { display:none; }
.ft-col ul { display:grid; gap:12px; margin:18px 0 0; padding:0; list-style:none; }
.ft-col a { display:inline-flex; align-items:center; gap:4px; color:#B9C6D4; font-size:14px; text-decoration:none; transition:color .2s,transform .2s; }
.ft-col a:hover { color:#E4C47E; transform:translateX(3px); }
.ft-col a.ft-more { color:#E4C47E; font-weight:650; }
.ft-areas { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:22px 0; border-top:1px solid rgba(255,255,255,.08); border-bottom:1px solid rgba(255,255,255,.08); }
.ft-areas > span { margin-right:6px; white-space:nowrap; color:#7A91A8; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
.ft-areas a { min-height:36px; display:inline-flex; align-items:center; padding:0 14px; border:1px solid rgba(255,255,255,.12); border-radius:999px; color:#DCE4EC; font-size:13px; text-decoration:none; transition:all .2s; }
.ft-areas a:hover { border-color:#C8963E; color:#E4C47E; }
.ft-mark { margin:clamp(24px,4vw,40px) 0 0; color:transparent; -webkit-text-stroke:1px rgba(228,196,126,.22); font:600 clamp(64px,17vw,260px)/.82 var(--font-fraunces,Georgia,serif); letter-spacing:-.05em; text-align:center; white-space:nowrap; user-select:none; }
.ft-bottom { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px; padding:22px 0 28px; border-top:1px solid rgba(255,255,255,.08); color:#7A91A8; font-size:12px; }
.ft-legal { display:flex; flex-wrap:wrap; align-items:center; gap:18px; }
.ft-legal a { color:#7A91A8; text-decoration:none; }
.ft-legal a:hover { color:#E4C47E; }
.ft .lp-footer-controls { display:flex; gap:7px; }
.ft .lp-footer-controls button { display:inline-flex; align-items:center; gap:6px; min-height:36px; padding:0 12px; border:1px solid rgba(255,255,255,.18); border-radius:999px; background:transparent; color:#DCE4EC; font:600 12px var(--font-be-vietnam,Arial,sans-serif); cursor:pointer; }
.ft .lp-footer-controls button:hover { border-color:#C8963E; }
.ft a:focus-visible,.ft button:focus-visible,.ft summary:focus-visible { outline:3px solid #C8963E; outline-offset:3px; border-radius:6px; }
@media (max-width:1023px) {
  .ft-cta { flex-direction:column; align-items:flex-start; }
  .ft-main { grid-template-columns:1fr 1fr; }
  .ft-brand { grid-column:1 / -1; }
}
@media (max-width:767px) {
  .ft-cta { padding:56px 0 36px; gap:24px; }
  .ft-actions { width:100%; display:grid; grid-template-columns:1fr 1fr; }
  .ft-actions .ft-btn-gold { grid-column:1 / -1; }
  .ft-main { grid-template-columns:1fr; gap:0; padding:36px 0 24px; }
  .ft-brand { padding-bottom:28px; }
  .ft-col { border-top:1px solid rgba(255,255,255,.08); }
  .ft-col summary { min-height:56px; pointer-events:auto; cursor:pointer; font-size:17px; }
  .ft-col summary svg { display:block; color:#C8963E; transition:transform .2s; }
  .ft-col[open] summary svg { transform:rotate(180deg); }
  .ft-col ul { margin:0 0 18px; gap:4px; }
  .ft-col a { min-height:40px; font-size:15px; }
  .ft-areas { flex-wrap:nowrap; overflow-x:auto; margin-inline:-20px; padding-inline:20px; scrollbar-width:none; }
  .ft-areas::-webkit-scrollbar { display:none; }
  .ft-areas a { flex:0 0 auto; }
  .ft-bottom { flex-direction:column; align-items:flex-start; padding-bottom:calc(96px + env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion:reduce) { .ft * { transition:none!important; } }
`;

export function PublicFooter() {
  const lang = useLang();
  const vi = lang === "vi";
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/+$/, "") || "/";
  const isHomepage = normalizedPath === "/" || normalizedPath === "/en";
  const [theme, setTheme] = useState("light");
  const [wide, setWide] = useState(true);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const href = (h) => (lang === "en" ? "/en" + h : h);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    try { localStorage.setItem("sgs-theme", next); } catch {}
    setTheme(next);
    window.dispatchEvent(new CustomEvent("sgs-theme-change", { detail: next }));
  };
  const toggleLanguage = () => {
    const next = vi ? "en" : "vi";
    const current = new URL(window.location.href);
    current.pathname = switchLangPath(current.pathname, next);
    window.location.assign(`${current.pathname}${current.search}${current.hash}`);
  };

  const columns = [
    {
      title: vi ? "D\u1ef1 \u00e1n n\u1ed5i b\u1eadt" : "Featured projects",
      links: [
        ...FOOTER_PROJECTS.map(p => ({ label: vi ? p.label : (FOOTER_PROJECTS_EN[p.label] || p.label), href: p.href })),
        { label: vi ? "Xem t\u1ea5t c\u1ea3 d\u1ef1 \u00e1n" : "All projects", href: "/du-an", more: true },
      ],
    },
    { title: vi ? "D\u1ecbch v\u1ee5" : "Services", links: FOOTER_SERVICES.map(l => ({ label: vi ? l.vi : l.en, href: l.href })) },
    { title: vi ? "V\u1ec1 SGS LAND" : "About SGS LAND", links: FOOTER_ABOUT.map(l => ({ label: vi ? l.vi : l.en, href: l.href })) },
  ];

  return (
    <footer className="sgs-home-footer ft">
      <style>{CSS}</style>
      <div className="ft-wrap">
        <section className="ft-cta" aria-labelledby="ft-cta-title">
          <div>
            <span className="ft-eyebrow">{vi ? "T\u01b0 v\u1ea5n mi\u1ec5n ph\u00ed \u00b7 7 ng\u00e0y/tu\u1ea7n" : "Free advice \u00b7 7 days a week"}</span>
            <h2 id="ft-cta-title">
              {vi ? "T\u00ecm nh\u00e0 an t\u00e2m, " : "Find a home with "}
              <em>{vi ? "c\u00f9ng chuy\u00ean gia." : "expert care."}</em>
            </h2>
          </div>
          <div className="ft-actions">
            <a className="ft-btn" href="tel:+84379281445"><Phone size={17} aria-hidden="true" />0379 281 445</a>
            <a className="ft-btn" href="https://zalo.me/0379281445" target="_blank" rel="noreferrer">Zalo</a>
            <Link className="ft-btn ft-btn-gold" href={href("/ai-valuation")}>
              <Sparkles size={17} aria-hidden="true" />{vi ? "\u0110\u1ecbnh gi\u00e1 AI mi\u1ec5n ph\u00ed" : "Free AI valuation"}
            </Link>
          </div>
        </section>

        <div className="ft-main">
          <div className="ft-brand">
            <div className="ft-brand-row">
              <img src="/logo-white.png" alt="" width={40} height={40} style={{ objectFit: "contain" }} />
              <div>
                <div className="ft-brand-name">SGS <span>LAND</span></div>
                <div className="ft-brand-sub">Proptech</div>
              </div>
            </div>
            <p className="ft-tag">
              {vi
                ? "N\u1ec1n t\u1ea3ng AI qu\u1ea3n l\u00fd v\u00e0 ph\u00e2n ph\u1ed1i b\u1ea5t \u0111\u1ed9ng s\u1ea3n. Tin \u0111\u0103ng ki\u1ec3m tra ph\u00e1p l\u00fd, gi\u00e1 c\u00f3 ngu\u1ed3n r\u00f5 r\u00e0ng."
                : "AI-powered real estate platform. Legally checked listings, prices with clear sources."}
            </p>
            <ul className="ft-contact">
              <li><Phone size={16} aria-hidden="true" /><a href="tel:+84379281445">0379 281 445</a></li>
              <li><Mail size={16} aria-hidden="true" /><a href="mailto:info@sgsland.vn">info@sgsland.vn</a></li>
              <li><MapPin size={16} aria-hidden="true" /><span>{tt(lang, "122 - 124 B2, Khu \u0111\u00f4 th\u1ecb Sala, Ph\u01b0\u1eddng An Kh\u00e1nh, TP.HCM", "122 - 124 B2, Sala Urban Area, An Khanh Ward, HCMC")}</span></li>
              <li><Clock size={16} aria-hidden="true" /><span>{vi ? "H\u1ed7 tr\u1ee3 7/7 \u00b7 8:00 - 18:00" : "Support 7/7 \u00b7 8:00 - 18:00"}</span></li>
            </ul>
            <div className="ft-social" aria-label={vi ? "M\u1ea1ng x\u00e3 h\u1ed9i" : "Social media"}>
              {SOCIAL_LINKS.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>{s.mark}</a>
              ))}
            </div>
          </div>

          {columns.map(col => (
            <details key={col.title} className="ft-col" open={wide || undefined}>
              <summary>{col.title}<ChevronDown size={18} aria-hidden="true" /></summary>
              <ul>
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={href(l.href)} className={l.more ? "ft-more" : undefined}>
                      {l.label}{l.more && <ArrowUpRight size={15} aria-hidden="true" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <nav className="ft-areas" aria-label={vi ? "Khu v\u1ef1c n\u1ed5i b\u1eadt" : "Featured areas"}>
          <span>{vi ? "Khu v\u1ef1c" : "Areas"}</span>
          {FOOTER_AREAS.map(a => (
            <Link key={a.href} href={href(a.href)}>{vi ? a.vi : a.en}</Link>
          ))}
        </nav>

        <div className="ft-mark" aria-hidden="true">SGS LAND</div>

        <div className="ft-bottom">
          <p style={{ margin: 0 }}>
            {"\u00a9"} {FOOTER_YEAR} SGS LAND. {vi ? "B\u1ea3o l\u01b0u m\u1ecdi quy\u1ec1n." : "All rights reserved."}
          </p>
          <div className="ft-legal">
            {LEGAL_LINKS.map(l => (
              <Link key={l.href} href={href(l.href)}>{vi ? l.vi : l.en}</Link>
            ))}
            {isHomepage && (
              <div className="lp-footer-controls" aria-label={vi ? "T\u00f9y ch\u1ecdn hi\u1ec3n th\u1ecb" : "Display options"}>
                <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? (vi ? "Giao di\u1ec7n s\u00e1ng" : "Light theme") : (vi ? "Giao di\u1ec7n t\u1ed1i" : "Dark theme")}>
                  {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                  {theme === "dark" ? (vi ? "S\u00e1ng" : "Light") : (vi ? "T\u1ed1i" : "Dark")}
                </button>
                <button type="button" onClick={toggleLanguage} aria-label={vi ? "Switch to English" : "Chuy\u1ec3n sang ti\u1ebfng Vi\u1ec7t"}>
                  <Globe size={14} aria-hidden="true" />{vi ? "EN" : "VI"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
