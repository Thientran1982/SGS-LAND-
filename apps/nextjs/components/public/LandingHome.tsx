// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/components/shared/useLang";
import HeroSearch from "./HeroSearch";
import { PublicListingCard } from "./MarketplacePage";
import {
  BadgeCheck, ShieldCheck, Wallet, Building2, Home, LandPlot, KeyRound, Sparkles, Handshake,
  Calculator, Trees, ArrowRight, ArrowUpRight, MessageCircle, MapPin, Scale, Landmark, FileSearch,
} from "lucide-react";

type Lang = "vi" | "en";
const T = (lang: Lang, vi: React.ReactNode, en: React.ReactNode) => (lang === "vi" ? vi : en);

// ─── Design tokens + section styles ─────────────────────────────────────────
const STYLE = `
  .lp-wrap { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px,4vw,48px); }
  .lp-serif, .lp-sans { font-family: var(--font-be-vietnam, system-ui, sans-serif); }
  .lp-mono  { font-family: var(--font-ibm-plex-mono, monospace); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }

  .lp-root {
    --lp-bg: var(--ui-bg); --lp-paper: var(--ui-surface); --lp-ink: var(--ui-text);
    --lp-muted: var(--ui-text-secondary); --lp-soft: var(--ui-text-disabled); --lp-hair: var(--ui-border);
    --lp-line: var(--ui-border-strong); --lp-navy: var(--ui-brand); --lp-gold: var(--ui-accent-strong);
    --lp-ok: var(--ui-success); --lp-shadow: var(--ui-shadow-md);
    --lp-cardbg: var(--ui-surface); --lp-navbg: color-mix(in srgb, var(--ui-bg) 88%, transparent);
    --lp-tint: color-mix(in srgb, var(--ui-brand) 6%, var(--ui-bg));
  }
  .dark .lp-root {
    --lp-navy: var(--ui-brand-strong); --lp-gold: var(--ui-accent);
    --lp-cardbg: var(--ui-surface-raised);
    --lp-tint: color-mix(in srgb, var(--ui-brand-strong) 10%, var(--ui-bg));
  }

  /* section rhythm */
  .lp-sec { padding: clamp(56px,8vw,104px) 0; }
  .lp-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--lp-navy); }
  .lp-h2 { font-size: clamp(26px,3.4vw,40px); font-weight: 650; line-height: 1.12; letter-spacing: -.02em; color: var(--lp-ink); }
  .lp-lead { font-size: 15px; line-height: 1.65; color: var(--lp-muted); }
  .lp-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; margin-bottom: clamp(24px,3vw,40px); }
  .lp-link { display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--lp-navy); text-decoration:none; }
  .lp-link:hover { text-decoration: underline; text-underline-offset: 4px; }
  .lp-link:focus-visible, .lp-tile:focus-visible, .lp-proj:focus-visible, .lp-tool:focus-visible, .lp-chip:focus-visible, .lp-btn:focus-visible {
    outline: 2px solid var(--lp-navy); outline-offset: 3px;
  }

  /* hero */
  .lp-hero { padding: clamp(96px,11vw,132px) 0 clamp(40px,5vw,64px);
    background:
      radial-gradient(1200px 520px at 85% -10%, color-mix(in srgb, var(--lp-gold) 12%, transparent), transparent 60%),
      radial-gradient(900px 480px at -10% 10%, color-mix(in srgb, var(--lp-navy) 10%, transparent), transparent 60%),
      var(--lp-bg); }
  .lp-hero-grid { display:grid; gap: clamp(32px,4vw,56px); align-items:center; grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .lp-hero-grid { grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr); } }
  .lp-h1 { font-size: clamp(34px,5.4vw,62px); font-weight: 700; line-height: 1.04; letter-spacing: -.03em; color: var(--lp-ink); }
  .lp-h1 em { font-style: normal; color: var(--lp-navy); }
  .lp-badge { display:inline-flex; align-items:center; gap:8px; padding:6px 12px 6px 8px; border-radius:999px;
    background: var(--lp-paper); border:1px solid var(--lp-line); font-size:13px; color: var(--lp-muted); }
  .lp-badge b { color: var(--lp-ink); font-weight: 600; }
  .lp-chip { display:inline-flex; align-items:center; height:34px; padding:0 14px; border-radius:999px; font-size:13.5px;
    color: var(--lp-ink); background: var(--lp-paper); border: 1px solid var(--lp-line); text-decoration:none; white-space:nowrap;
    transition: border-color .15s, background .15s; }
  .lp-chip:hover { border-color: var(--lp-navy); background: color-mix(in srgb, var(--lp-navy) 6%, var(--lp-paper)); }
  .lp-trust { display:flex; flex-wrap:wrap; gap: 10px 26px; font-size: 14px; color: var(--lp-muted); }
  .lp-trust span { display:inline-flex; align-items:center; gap:8px; }
  .lp-trust svg { color: var(--lp-ok); flex-shrink: 0; }
  .lp-trust b { color: var(--lp-ink); font-weight: 650; }

  .lp-collage { position:relative; aspect-ratio: 5/5.4; display:none; }
  @media (min-width: 1024px) { .lp-collage { display:block; } }
  .lp-collage .ph { position:absolute; overflow:hidden; border-radius:24px; background: var(--lp-hair); box-shadow: 0 30px 80px var(--lp-shadow); }
  .lp-collage .ph img { width:100%; height:100%; object-fit:cover; display:block; transition: transform .6s ease; }
  .lp-collage .ph:hover img { transform: scale(1.04); }
  .lp-collage .ph-a { inset: 0 18% 22% 0; }
  .lp-collage .ph-b { width: 46%; aspect-ratio: 4/3.2; right: 0; bottom: 0; border: 6px solid var(--lp-bg); }
  .lp-collage .tag { position:absolute; left:16px; bottom:16px; display:flex; flex-direction:column; gap:2px; padding:10px 14px;
    border-radius:14px; background: color-mix(in srgb, #0b1220 62%, transparent); backdrop-filter: blur(8px); color:#fff; text-decoration:none; }
  .lp-collage .tag small { font-size:11.5px; opacity:.8; }
  .lp-collage .tag b { font-size:15px; font-weight:650; }
  .lp-float { position:absolute; left:-28px; top:9%; width: 250px; padding:16px; border-radius:18px; text-decoration:none;
    background: var(--lp-paper); border:1px solid var(--lp-line); box-shadow: 0 24px 60px var(--lp-shadow); color: var(--lp-ink); }
  .lp-float .ic { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background: color-mix(in srgb, var(--lp-gold) 18%, transparent); color: var(--lp-gold); }

  /* categories */
  .lp-cats { display:grid; gap:12px; grid-template-columns: repeat(2, minmax(0,1fr)); }
  @media (min-width: 640px) { .lp-cats { grid-template-columns: repeat(3, minmax(0,1fr)); } }
  @media (min-width: 1024px) { .lp-cats { grid-template-columns: repeat(6, minmax(0,1fr)); } }
  .lp-tile { display:flex; flex-direction:column; gap:12px; padding:18px; border-radius:18px; text-decoration:none; min-height:128px;
    background: var(--lp-paper); border:1px solid var(--lp-line); color: var(--lp-ink); transition: transform .2s, box-shadow .2s, border-color .2s; }
  .lp-tile:hover { transform: translateY(-3px); box-shadow: 0 18px 40px var(--lp-shadow); border-color: color-mix(in srgb, var(--lp-navy) 40%, var(--lp-line)); }
  .lp-tile .ic { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background: color-mix(in srgb, var(--lp-navy) 9%, transparent); color: var(--lp-navy); }
  .lp-tile b { font-size: 15px; font-weight: 650; }
  .lp-tile small { font-size: 12.5px; color: var(--lp-muted); margin-top:-8px; }

  /* listings */
  .lp-listings { display:grid; gap:20px; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .lp-listings { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (min-width: 1100px) { .lp-listings { grid-template-columns: repeat(4, minmax(0,1fr)); } }

  /* projects bento */
  .lp-bento { display:grid; gap:16px; grid-template-columns: 1fr; }
  @media (min-width: 768px) { .lp-bento { grid-template-columns: repeat(4, minmax(0,1fr)); grid-auto-rows: 250px; }
    .lp-bento .lp-proj:first-child { grid-column: span 2; grid-row: span 2; } }
  .lp-proj { position:relative; display:block; overflow:hidden; border-radius:22px; min-height:240px; text-decoration:none; background: var(--lp-hair); isolation:isolate; }
  .lp-proj img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition: transform .6s ease; z-index:-2; }
  .lp-proj::after { content:""; position:absolute; inset:0; z-index:-1; background: linear-gradient(180deg, transparent 35%, rgba(6,12,24,.82) 100%); }
  .lp-proj:hover img { transform: scale(1.05); }
  .lp-proj .body { position:absolute; left:0; right:0; bottom:0; padding: 18px 20px; color:#fff; }
  .lp-proj .dev { font-size:12px; letter-spacing:.08em; text-transform:uppercase; opacity:.85; }
  .lp-proj h3 { font-size: 21px; font-weight: 650; line-height:1.15; margin-top:4px; }
  .lp-proj:first-child h3 { font-size: clamp(24px,2.6vw,32px); }
  .lp-proj p { font-size: 13.5px; opacity:.85; margin-top:4px; }
  .lp-proj .go { position:absolute; top:16px; right:16px; width:38px; height:38px; border-radius:50%; display:grid; place-items:center;
    background: rgba(255,255,255,.92); color:#0b1220; transform: translateY(-4px); opacity:0; transition: all .25s; }
  .lp-proj:hover .go, .lp-proj:focus-visible .go { opacity:1; transform:none; }

  /* map card */
  @keyframes lp-ring { 0%{transform:scale(.4);opacity:.7} 80%{transform:scale(1.9);opacity:0} 100%{opacity:0} }
  .lp-pin-ring { animation: lp-ring 2.6s ease-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes lp-dash  { to{stroke-dashoffset:-540} }
  .lp-route { animation: lp-dash 30s linear infinite; }
  .lp-map-grid { display:grid; gap: 28px; grid-template-columns: 1fr; align-items:center; }
  @media (min-width: 1024px) { .lp-map-grid { grid-template-columns: minmax(0,.7fr) minmax(0,1.3fr); } }
  .lp-plist { display:flex; flex-direction:column; border-top:1px solid var(--lp-hair); }
  .lp-plist button { display:flex; align-items:center; gap:12px; padding:14px 4px; border:0; border-bottom:1px solid var(--lp-hair); background:none; cursor:pointer; text-align:left; color: var(--lp-ink); font: inherit; }
  .lp-plist button[aria-pressed="true"] b { color: var(--lp-navy); }
  .lp-plist .dot { width:10px; height:10px; border-radius:50%; background: var(--lp-navy); flex-shrink:0; }
  .lp-plist button[aria-pressed="true"] .dot { background: var(--lp-gold); box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-gold) 25%, transparent); }
  .lp-plist small { color: var(--lp-muted); font-size: 12.5px; }

  /* why */
  .lp-why { display:grid; gap:16px; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .lp-why { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (min-width: 1100px) { .lp-why { grid-template-columns: repeat(4, minmax(0,1fr)); } }
  .lp-why > div { padding: 24px; border-radius: 20px; background: var(--lp-paper); border: 1px solid var(--lp-line); }
  .lp-why .ic { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background: color-mix(in srgb, var(--lp-navy) 9%, transparent); color: var(--lp-navy); margin-bottom: 18px; }
  .lp-why h3 { font-size: 17px; font-weight: 650; color: var(--lp-ink); margin-bottom: 8px; }
  .lp-why p { font-size: 14px; line-height: 1.6; color: var(--lp-muted); }

  /* tools band */
  .lp-band { border-radius: 28px; padding: clamp(28px,4vw,48px); background: var(--lp-navy); color: #fff; position:relative; overflow:hidden; }
  .lp-band::before { content:""; position:absolute; width:520px; height:520px; right:-160px; top:-220px; border-radius:50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--lp-gold) 45%, transparent), transparent 65%); opacity:.5; }
  .lp-tools { display:grid; gap:14px; grid-template-columns: 1fr; position:relative; }
  @media (min-width: 900px) { .lp-tools { grid-template-columns: repeat(3, minmax(0,1fr)); } }
  .lp-tool { display:flex; flex-direction:column; gap:10px; padding: 22px; border-radius: 18px; text-decoration:none; color:#fff;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); transition: background .2s, transform .2s; }
  .lp-tool:hover { background: rgba(255,255,255,.13); transform: translateY(-2px); }
  .lp-tool b { font-size: 17px; font-weight: 650; }
  .lp-tool p { font-size: 14px; opacity: .78; line-height:1.55; }
  .lp-tool .cta { margin-top:auto; display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color: var(--lp-gold); }

  /* faq */
  .lp-faq-grid { display:grid; gap: clamp(28px,4vw,64px); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .lp-faq-grid { grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); } .lp-faq-side { position: sticky; top: 110px; align-self:start; } }
  .lp-faq-body { overflow:hidden; transition: max-height .35s ease, opacity .35s ease; }
  .lp-faq-body.closed { max-height:0; opacity:0; }
  .lp-faq-body.open   { max-height:600px; opacity:1; }

  /* buttons */
  .lp-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; padding:0 22px; border-radius:14px;
    font-size:15px; font-weight:600; text-decoration:none; cursor:pointer; border:1px solid transparent; transition: filter .15s, background .15s, transform .15s; }
  .lp-btn-primary { background: var(--lp-navy); color: var(--lp-bg); }
  .lp-btn-primary:hover { filter: brightness(1.12); }
  .lp-btn-ghost { background: transparent; color: var(--lp-ink); border-color: var(--lp-line); }
  .lp-btn-ghost:hover { border-color: var(--lp-navy); }

  /* reveal (content visible without JS) */
  .lp-rv { transition: opacity .45s ease, transform .45s cubic-bezier(.2,.7,.2,1); }
  .lp-ready .lp-rv:not(.in) { opacity:.2; transform:translateY(14px); }


  /* ── Responsive refinements (mobile ≤639, tablet 640–1023) ── */
  @media (pointer: coarse) {
    .lp-chip, .hs-tab { min-height: 40px; }
    .lp-link { min-height: 44px; }
    .lp-listings button[aria-label] { min-width: 40px; min-height: 40px; }
  }
  /* hero on tablet: image strip under the search instead of an empty right column */
  @media (min-width: 640px) and (max-width: 1023px) {
    .lp-collage { display:grid; grid-template-columns: 1.5fr 1fr; gap:14px; aspect-ratio:auto; height: 260px; }
    .lp-collage .ph { position:relative; inset:auto; width:auto; height:100%; aspect-ratio:auto; border:0; box-shadow: 0 16px 40px var(--lp-shadow); }
    .lp-collage .lp-float { display:none; }
  }
  /* categories: compact 3-up tiles on phones */
  @media (max-width: 639px) {
    .lp-cats { grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; }
    .lp-tile { min-height: 0; padding: 14px 8px; align-items:center; text-align:center; gap:8px; border-radius:16px; }
    .lp-tile b { font-size: 13.5px; }
    .lp-tile small { display:none; }
  }
  /* listings: swipeable row on phones, 3-up on small laptops */
  @media (max-width: 639px) {
    .lp-listings { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:14px; margin: 0 calc(-1 * clamp(16px,4vw,48px)); padding: 4px clamp(16px,4vw,48px) 12px; scrollbar-width:none; }
    .lp-listings::-webkit-scrollbar { display:none; }
    .lp-listings > * { flex: 0 0 84%; scroll-snap-align: start; }
  }
  @media (min-width: 900px) and (max-width: 1099px) {
    .lp-listings { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .lp-listings > :nth-child(n+7) { display:none; }
  }
  /* projects: 2-up on tablet with a wide lead card, 4-up bento from 1024 */
  @media (min-width: 640px) and (max-width: 1023px) {
    .lp-bento { grid-template-columns: repeat(2, minmax(0,1fr)); grid-auto-rows: 230px; }
    .lp-bento .lp-proj:first-child { grid-column: span 2; grid-row: span 1; }
  }
  @media (max-width: 639px) {
    .lp-bento { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:14px; margin: 0 calc(-1 * clamp(16px,4vw,48px)); padding: 4px clamp(16px,4vw,48px) 12px; scrollbar-width:none; }
    .lp-bento::-webkit-scrollbar { display:none; }
    .lp-bento .lp-proj { flex: 0 0 82%; min-height: 280px; scroll-snap-align: start; }
    .lp-bento .lp-proj .go { opacity:1; transform:none; }
  }
  /* map: the schematic map is unreadable on phones; the list + card do the job */
  @media (max-width: 639px) { .lp-mapcard { display:none; } }
  /* why + tools: horizontal cards save height on small screens */
  @media (max-width: 639px) {
    .lp-why > div { display:grid; grid-template-columns: 44px 1fr; column-gap:14px; padding:18px; }
    .lp-why .ic { margin-bottom:0; grid-row: span 2; }
  }
  @media (max-width: 899px) {
    .lp-tool { display:grid; grid-template-columns: 28px 1fr; column-gap:14px; row-gap:6px; }
    .lp-tool > svg { grid-row: span 3; }
    .lp-tool .cta { margin-top: 4px; }
  }

  @media (prefers-reduced-motion:reduce) {
    .lp-pin-ring, .lp-route { animation: none !important; }
    .lp-rv, .lp-ready .lp-rv:not(.in) { opacity:1 !important; transform:none !important; transition:none !important; }
    .lp-tile, .lp-proj img, .lp-collage .ph img, .lp-tool { transition: none !important; }
  }
`;

// ─── FAQ data (bilingual) ────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q:"Vì sao nên tham khảo bất động sản qua SGS LAND?", a:"SGS LAND tổng hợp thông tin dự án, sản phẩm và công cụ hỗ trợ người mua. Giá, pháp lý, tiến độ, tồn kho và tư cách phân phối cần được đối chiếu với tài liệu gốc có ngày cập nhật trước khi giao dịch.", q_en:"Why use SGS LAND for real-estate research?", a_en:"SGS LAND provides project references, listings and buyer-support tools. Check prices, legal status, progress, availability and distribution authorization against dated original documents before a transaction." },
  { q:"Công nghệ định giá AI của SGS LAND chính xác bao nhiêu?", a:"Công nghệ SGS-AVM v2.1 sử dụng 9 hệ số định giá chuẩn TĐGVN/IVS, MAPE ±4.8%, dựa trên hơn 2.400 giao dịch công chứng thực tế. Kết quả tức thì, minh bạch từng yếu tố ảnh hưởng.", q_en:"How accurate is SGS LAND's AI valuation technology?", a_en:"SGS-AVM v2.1 uses 9 valuation factors compliant with TĐGVN/IVS standards, MAPE ±4.8%, based on 2,400+ real notarized transactions. Instant results with full transparency on each contributing factor." },
  { q:"Quy trình kiểm tra pháp lý tại SGS LAND như thế nào?", a:"2 lớp độc lập: AI sơ thẩm kiểm tra quy hoạch 1/2000, sổ hồng, tranh chấp tài sản; Chuyên viên pháp lý xác nhận thực địa theo Luật Đất Đai 2024 và Luật Kinh doanh BĐS 2023.", q_en:"How does SGS LAND's legal verification process work?", a_en:"2 independent layers: AI first check covers zoning 1/2000, land title, and dispute records; Legal specialists then perform on-site verification under Land Law 2024 and Real Estate Business Law 2023." },
  { q:"Người mua có phải trả phí dịch vụ không?", a:"Hoàn toàn miễn phí. Định giá AI, tư vấn pháp lý, hỗ trợ vay vốn — tất cả đều không mất phí với người mua và thuê. Người bán và chủ đầu tư chi trả hoa hồng dịch vụ cho SGS LAND.", q_en:"Do buyers pay any service fees?", a_en:"Completely free. AI valuation, legal advice, mortgage support — all at no cost to buyers and renters. Sellers and developers pay the commission to SGS LAND." },
  { q:"SGS LAND hỗ trợ vay ngân hàng như thế nào?", a:"Đối tác với 12+ ngân hàng lớn (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, lãi suất từ 6–8,5%/năm. Đội tư vấn tài chính đồng hành từ hồ sơ đến giải ngân.", q_en:"How does SGS LAND help with bank financing?", a_en:"Partners with 12+ major banks (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, interest rates from 6–8.5%/year. Our financial advisory team guides you from application to disbursement." },
  { q:"Những dự án nào đang phân phối tại SGS LAND?", a:"Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Cần Giờ, Masteri Cosmo Central, Diamond Sky, Vinhomes Hóc Môn — cập nhật liên tục.", q_en:"Which projects does SGS LAND currently distribute?", a_en:"Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Can Gio, Masteri Cosmo Central, Diamond Sky, Vinhomes Hoc Mon — continuously updated." },
  { q:"Giá nhà phố tại TP.HCM hiện nay là bao nhiêu?", a:"Giá nhà phố tại TP.HCM dao động theo khu vực: Quận 1 và trung tâm 150–400 triệu/m², Thủ Đức 40–80 triệu/m², Bình Thạnh và Phú Nhuận 80–150 triệu/m². Nhà phố liền kề dự án như Aqua City, The Global City giá 5–15 tỷ/căn. Dùng công cụ Định Giá AI miễn phí để tra cứu chính xác.", q_en:"What is the current price of townhouses in HCMC?", a_en:"Townhouse prices in HCMC vary: District 1 150–400M/sqm, Thu Duc 40–80M/sqm, Binh Thanh 80–150M/sqm. Project townhouses like Aqua City, The Global City range 5–15B VND. Use SGS LAND free AI valuation for precise pricing." },
  { q:"Nên mua căn hộ hay nhà phố để đầu tư?", a:"Căn hộ dễ cho thuê, thanh khoản cao, phù hợp đầu tư tài chính; nhà phố có biên độ tăng giá tốt hơn dài hạn. Ngân sách 4–6 tỷ: căn hộ Vinhomes/Masterise phù hợp hơn. Ngân sách 5–15 tỷ: nhà phố liền kề Long Thành, Aqua City có tiềm năng tăng giá 3–5 năm.", q_en:"Should I invest in apartments or townhouses?", a_en:"Apartments offer higher liquidity and easier rental management. Townhouses have better long-term appreciation. 4–6B budget: large project apartments; 5–15B budget: project townhouses near Long Thanh/Aqua City offer 3–5 year appreciation potential." },
  { q:"Vay mua nhà cần chuẩn bị những gì?", a:"(1) Vốn tự có tối thiểu 20–30%; (2) Thu nhập ổn định, xác nhận 6–12 tháng; (3) Lịch sử tín dụng tốt; (4) Hồ sơ BĐS đầy đủ pháp lý (sổ đỏ/hồng, HĐMB công chứng); (5) CMND/CCCD, hộ khẩu, giấy đăng ký kết hôn. SGS LAND hỗ trợ tư vấn miễn phí với 12+ ngân hàng, lãi suất từ 6–8.5%/năm.", q_en:"What do I need to prepare to get a mortgage?", a_en:"You need: 20–30% down payment, stable income proof (6–12 months), good credit history, complete legal documentation, and personal ID. SGS LAND provides free mortgage consultation with 12+ partner banks at 6–8.5%/year." },
  { q:"Sổ hồng và sổ đỏ khác nhau như thế nào?", a:"Sổ hồng cấp cho nhà ở, căn hộ chung cư, nhà phố. Sổ đỏ cấp cho đất trống, đất nông nghiệp. Từ 2009, cả hai được gộp thành giấy chứng nhận thống nhất. Khi mua BĐS: phải có giấy chứng nhận hợp lệ, không tranh chấp, pháp lý rõ ràng. SGS LAND kiểm tra pháp lý 2 lớp miễn phí.", q_en:"What is the difference between Pink Book and Red Book in Vietnam?", a_en:"Pink Book covers residential property; Red Book covers land use rights. Since 2009 they are merged into one unified certificate. SGS LAND provides free 2-layer legal verification for all transactions." },
  { q:"BĐS Long Thành có đáng đầu tư không?", a:"Long Thành là điểm nóng 2026–2030: (1) Sân bay quốc tế Long Thành GĐ1 hoàn thành 2026, 25 triệu hành khách/năm; (2) Hạ tầng cao tốc hoàn thiện; (3) Giá đất 8–25 triệu/m² còn thấp so với tiềm năng; (4) Aqua City, Gem Sky World phát triển mạnh. Lưu ý: kiểm tra pháp lý kỹ với các dự án nhỏ.", q_en:"Is investing in Long Thanh real estate worthwhile?", a_en:"Long Thanh is a top 2026–2030 hotspot driven by the new international airport (Phase 1 completing 2026, 25M passengers/year), strong highway infrastructure, and land prices still 8–25M/sqm with significant upside potential." },
  { q:"Thủ Đức có còn là khu vực đáng đầu tư không?", a:"TP. Thủ Đức vẫn là khu vực hàng đầu: trung tâm đổi mới sáng tạo, Vinhomes Grand Park 280ha đang tạo hệ sinh thái đô thị hoàn chỉnh, metro line 1 và vành đai đang phát triển. Giá căn hộ 35–70 triệu/m², thấp hơn quận trung tâm 50–60%.", q_en:"Is Thu Duc City still a good investment area?", a_en:"Thu Duc City remains HCMC's top investment area with its tech innovation hub, Vinhomes Grand Park 280ha mega-project, Metro Line 1, and apartment prices at 35–70M/sqm — still 50–60% below central districts." },
  { q:"Mua nhà lần đầu cần lưu ý gì?", a:"5 điểm quan trọng: (1) Pháp lý rõ ràng — sổ hồng/đỏ, không tranh chấp, quy hoạch 1/2000; (2) Định giá đúng — dùng AI hoặc so sánh 3–5 BĐS tương đương; (3) Tài chính — đừng vay quá 40% thu nhập hàng tháng; (4) Thanh khoản — chọn khu vực gần tiện ích; (5) Uy tín chủ đầu tư.", q_en:"What should first-time home buyers know?", a_en:"5 key points: verify legal documents (title, no disputes, 1/2000 zoning), get proper AI or comparative valuation, keep mortgage payments under 40% of income, choose high-liquidity areas near amenities, and verify developer track record." },
  { q:"SGS LAND phục vụ khu vực nào?", a:"TP.HCM (22 quận/huyện và TP Thủ Đức), Đồng Nai (Long Thành, Nhơn Trạch, Biên Hòa), Bình Dương (Thuận An, Dĩ An, Thủ Dầu Một), Long An (Cần Giuộc, Bến Lức), và Bà Rịa - Vũng Tàu. Công cụ Định Giá AI dùng dữ liệu giao dịch thực tế trong vùng.", q_en:"Which areas does SGS LAND serve?", a_en:"SGS LAND covers all of Southeast Vietnam: HCMC (22 districts + Thu Duc City), Dong Nai (Long Thanh, Nhon Trach, Bien Hoa), Binh Duong, Long An, and Ba Ria-Vung Tau — covering real transaction data in the region." },
  { q:"Làm thế nào để biết giá BĐS trong khu vực đang tăng hay giảm?", a:"(1) Dùng Định Giá AI SGS LAND so sánh lịch sử giá 24 tháng; (2) Theo dõi dữ liệu giao dịch công chứng; (3) Xem lãi suất, tín dụng BĐS, chính sách nhà ở; (4) Chú ý hạ tầng mới: cao tốc, metro, khu công nghiệp; (5) Báo cáo thị trường SGS LAND cập nhật hàng quý.", q_en:"How do I know if real estate prices in my area are rising or falling?", a_en:"Monitor trends using SGS LAND's AI valuation with 24-month history, track notarized transaction data, monitor macro factors (interest rates, policy), watch new infrastructure developments, and subscribe to SGS LAND quarterly market reports." },
];

// ─── Projects ───────────────────────────────────────────────────────────────
const PROJECTS = [
  { slug:"aqua-city",        dev:"Novaland",  name:"Aqua City",              desc:{ vi:"1.000 ha · Biên Hòa · từ 3 tỷ ₫",       en:"1,000 ha · Bien Hoa · from 3B VND" },     price:{ vi:"Từ 3 tỷ ₫",        en:"From 3B VND" },        loc:{ vi:"Biên Hòa · Golf 18 lỗ, Marina",   en:"Bien Hoa · 18-hole Golf, Marina" } },
  { slug:"the-global-city",  dev:"Masterise", name:"The Global City",        desc:{ vi:"117 ha · Thủ Đức · bảng giá T7/2026",    en:"117 ha · Thu Duc · price list Jul/2026" }, price:{ vi:"Bảng giá T7/2026", en:"Price list Jul/2026" }, loc:{ vi:"Thủ Đức · trung tâm mới quốc tế", en:"Thu Duc · New International CBD" } },
  { slug:"vinhomes-can-gio", dev:"Vinhomes",  name:"Vinhomes Cần Giờ",       desc:{ vi:"2.870 ha · siêu đô thị biển · 2026",     en:"2,870 ha · Coastal megacity · 2026" },    price:{ vi:"Mở bán 2026",      en:"Launch 2026" },         loc:{ vi:"Siêu đô thị biển TP.HCM",          en:"Coastal megacity, HCMC" } },
  { slug:"izumi-city",       dev:"Nam Long",  name:"Izumi City",             desc:{ vi:"170 ha · Biên Hòa · chuẩn Nhật Bản",     en:"170 ha · Bien Hoa · Japanese standard" }, price:{ vi:"Giá tốt",          en:"Competitive price" },   loc:{ vi:"Biên Hòa · chuẩn sống Nhật Bản",  en:"Bien Hoa · Japanese living standard" } },
  { slug:"masterise-homes",  dev:"Masterise", name:"Grand Marina · Masteri", desc:{ vi:"TP.HCM · căn hộ hàng hiệu",               en:"HCMC · Branded residences" },             price:{ vi:"Tư vấn 1-1",       en:"1-on-1 consultation" }, loc:{ vi:"Trung tâm TP.HCM · hàng hiệu",    en:"Central HCMC · luxury residences" } },
];

const PIN_DATA = [
  { i:0, cx:810, cy:300, label:"Aqua City"   },
  { i:1, cx:590, cy:285, label:"Global City" },
  { i:2, cx:520, cy:545, label:"Cần Giờ"     },
  { i:3, cx:700, cy:210, label:"Izumi City"  },
  { i:4, cx:452, cy:308, label:"Masterise"   },
];

const lpath = (p: string, g: string) => (g === "en" ? "/en" + p : p);
const projImg = (slug: string) => `/images/projects/${slug}.webp`;

function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

function Reveal({ as: Tag = "div", className = "", children, ...rest }: any) {
  const { ref, inView } = useReveal();
  return <Tag ref={ref} className={`lp-rv${inView ? " in" : ""} ${className}`} {...rest}>{children}</Tag>;
}

function SectionHead({ eyebrow, title, lead, action }: { eyebrow?: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Reveal className="lp-head">
      <div style={{ maxWidth: 680 }}>
        {eyebrow && <span className="lp-eyebrow">{eyebrow}</span>}
        <h2 className="lp-h2" style={{ marginTop: eyebrow ? 10 : 0 }}>{title}</h2>
        {lead && <p className="lp-lead" style={{ marginTop: 10 }}>{lead}</p>}
      </div>
      {action}
    </Reveal>
  );
}

// ─── 1. HERO ─────────────────────────────────────────────────────────────────
function Hero({ lang, listingCount, onAskAi }: { lang: Lang; listingCount: number; onAskAi: (q: string) => void }) {
  const chips = [
    { vi: "Căn hộ Thủ Đức", en: "Thu Duc apartments", href: "/marketplace?q=Th%E1%BB%A7%20%C4%90%E1%BB%A9c&type=APARTMENT" },
    { vi: "Vinhomes Grand Park", en: "Vinhomes Grand Park", href: "/marketplace?q=Vinhomes%20Grand%20Park" },
    { vi: "Aqua City", en: "Aqua City", href: "/marketplace?q=Aqua%20City" },
    { vi: "The Global City", en: "The Global City", href: "/marketplace?q=Global%20City" },
    { vi: "Dưới 3 tỷ", en: "Under 3B VND", href: "/marketplace?maxPrice=3000000000&transaction=SALE" },
  ];
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div>
          <span className="lp-badge">
            <BadgeCheck size={16} color="var(--lp-ok)" aria-hidden="true" />
            {T(lang, <><b>Tin đã kiểm tra</b> · TP.HCM · Đồng Nai · Tây Ninh</>, <><b>Checked listings</b> · HCMC · Dong Nai · Tay Ninh</>)}
          </span>
          <h1 className="lp-h1" style={{ marginTop: 20 }}>
            {T(lang,
              <>Tìm đúng nhà.<br /><em>Đúng giá.</em> Pháp lý rõ ràng.</>,
              <>The right home.<br /><em>The right price.</em> Clear title.</>)}
          </h1>
          <p className="lp-lead" style={{ fontSize: "clamp(15px,1.4vw,18px)", maxWidth: 560, marginTop: 18 }}>
            {T(lang,
              "Xem tin đăng và dự án đã qua kiểm tra pháp lý, so sánh giá theo khu vực và định giá AI miễn phí trước khi xuống tiền.",
              "Browse listings and projects with checked legal status, compare prices by area and get a free AI valuation before you commit.")}
          </p>

          <div style={{ marginTop: 28 }}>
            <HeroSearch lang={lang} action={lpath("/marketplace", lang)} valuationHref={lpath("/ai-valuation", lang)} onAskAi={onAskAi} withTabs />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: -8 }}>
            <span style={{ fontSize: 13, color: "var(--lp-muted)", marginRight: 4 }}>{T(lang, "Tìm nhiều:", "Popular:")}</span>
            {chips.map(c => <a key={c.href} className="lp-chip" href={lpath(c.href, lang)}>{c[lang]}</a>)}
          </div>

          <div className="lp-trust" style={{ marginTop: 28 }}>
            {listingCount > 0 && (
              <span><BadgeCheck size={18} aria-hidden="true" />{T(lang, <><b>{listingCount.toLocaleString("vi-VN")}</b>&nbsp;tin đang mở bán</>, <><b>{listingCount.toLocaleString("en-US")}</b>&nbsp;live listings</>)}</span>
            )}
            <span><ShieldCheck size={18} aria-hidden="true" />{T(lang, <>Kiểm tra pháp lý&nbsp;<b>2 lớp</b></>, <><b>Two-layer</b>&nbsp;legal check</>)}</span>
            <span><Wallet size={18} aria-hidden="true" />{T(lang, <><b>Miễn phí</b>&nbsp;cho người mua</>, <><b>Free</b>&nbsp;for buyers</>)}</span>
          </div>
        </div>

        {/* Visual: real project photography + valuation entry */}
        <div className="lp-collage" aria-label={T(lang, "Dự án nổi bật", "Featured projects")}>
          <a className="ph ph-a" href={lpath("/du-an/the-global-city", lang)}>
            <img src={projImg("the-global-city")} alt="The Global City" fetchPriority="high" />
            <span className="tag"><small>Masterise · Thủ Đức</small><b>The Global City</b></span>
          </a>
          <a className="ph ph-b" href={lpath("/du-an/aqua-city", lang)}>
            <img src={projImg("aqua-city")} alt="Aqua City" loading="lazy" />
            <span className="tag"><small>Novaland · Biên Hòa</small><b>Aqua City</b></span>
          </a>
          <a className="lp-float" href={lpath("/ai-valuation", lang)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="ic"><Calculator size={18} aria-hidden="true" /></span>
              <b style={{ fontSize: 15 }}>{T(lang, "Nhà bạn đáng giá bao nhiêu?", "What is your home worth?")}</b>
            </div>
            <p style={{ fontSize: 13, color: "var(--lp-muted)", marginTop: 8 }}>{T(lang, "Định giá AI theo dữ liệu giao dịch trong khu vực.", "AI valuation from local transaction data.")}</p>
            <span className="lp-link" style={{ marginTop: 10 }}>{T(lang, "Định giá miễn phí", "Free valuation")} <ArrowRight size={16} aria-hidden="true" /></span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── 2. CATEGORIES ───────────────────────────────────────────────────────────
function Categories({ lang }: { lang: Lang }) {
  const cats = [
    { icon: Building2, vi: "Căn hộ", en: "Apartments", svi: "Chung cư, căn hộ dự án", sen: "Condos & project units", href: "/marketplace?type=APARTMENT&transaction=SALE" },
    { icon: Home, vi: "Nhà phố", en: "Townhouses", svi: "Nhà phố, nhà liền kề", sen: "Street & row houses", href: "/marketplace?type=TOWNHOUSE&transaction=SALE" },
    { icon: LandPlot, vi: "Đất nền", en: "Land plots", svi: "Đất nền dự án, thổ cư", sen: "Residential land", href: "/marketplace?type=LAND&transaction=SALE" },
    { icon: KeyRound, vi: "Cho thuê", en: "For rent", svi: "Căn hộ, nhà, mặt bằng", sen: "Homes & premises", href: "/marketplace?transaction=RENT" },
    { icon: Sparkles, vi: "Dự án mới", en: "New projects", svi: "Bảng giá, mặt bằng", sen: "Price lists & plans", href: "/du-an" },
    { icon: Trees, vi: "Biệt thự", en: "Villas", svi: "Biệt thự, song lập", sen: "Detached & semi-detached", href: "/marketplace?type=VILLA&transaction=SALE" },
  ];
  return (
    <section style={{ padding: "8px 0 0" }} aria-label={T(lang, "Danh mục", "Categories")}>
      <div className="lp-wrap">
        <Reveal className="lp-cats">
          {cats.map(c => {
            const Icon = c.icon;
            return (
              <a key={c.href} className="lp-tile" href={lpath(c.href, lang)}>
                <span className="ic"><Icon size={20} aria-hidden="true" /></span>
                <b>{c[lang]}</b>
                <small>{lang === "vi" ? c.svi : c.sen}</small>
              </a>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

// ─── 3. LATEST LISTINGS ──────────────────────────────────────────────────────
function LatestListings({ lang, listings, total }: { lang: Lang; listings: any[]; total: number }) {
  const withPhotos = listings.filter(l => Array.isArray(l?.images) && l.images.length > 0);
  const pool = withPhotos.length >= 4 ? withPhotos : listings;
  // Show variety: at most two listings from the same area/project, then fill up.
  const perArea: Record<string, number> = {};
  const varied = pool.filter(l => {
    const key = String(l?.location || l?.title || "").toLowerCase().slice(0, 24);
    perArea[key] = (perArea[key] || 0) + 1;
    return perArea[key] <= 2;
  });
  const items = [...varied, ...pool.filter(l => !varied.includes(l))].slice(0, 8);
  if (items.length === 0) return null;
  return (
    <section className="lp-sec">
      <div className="lp-wrap">
        <SectionHead
          eyebrow={T(lang, "Tin mới đăng", "Just listed")}
          title={T(lang, "Bất động sản đang mở bán", "Properties on the market")}
          lead={T(lang, "Ảnh thật, giá niêm yết và trạng thái kiểm tra của từng tin.", "Real photos, asking price and check status on every listing.")}
          action={<a className="lp-link" href={lpath("/marketplace", lang)}>{total > 0 ? T(lang, `Xem tất cả ${total.toLocaleString("vi-VN")} tin`, `See all ${total.toLocaleString("en-US")} listings`) : T(lang, "Xem tất cả tin", "See all listings")} <ArrowRight size={16} aria-hidden="true" /></a>}
        />
        <div className="lp-listings">
          {items.map((l, i) => <PublicListingCard key={l.id} listing={l} eager={i < 4} />)}
        </div>
      </div>
    </section>
  );
}

// ─── 4. PROJECTS (bento) ─────────────────────────────────────────────────────
function Projects({ lang }: { lang: Lang }) {
  return (
    <section className="lp-sec" style={{ background: "var(--lp-tint)" }}>
      <div className="lp-wrap">
        <SectionHead
          eyebrow={T(lang, "Dự án nổi bật", "Featured projects")}
          title={T(lang, "Dự án từ các chủ đầu tư lớn", "Projects from leading developers")}
          lead={T(lang, "Bảng giá, mặt bằng và pháp lý dự án, đối chiếu với tài liệu gốc có ngày cập nhật.", "Price lists, floor plans and legal status, checked against dated source documents.")}
          action={<a className="lp-link" href={lpath("/du-an", lang)}>{T(lang, "Tất cả dự án", "All projects")} <ArrowRight size={16} aria-hidden="true" /></a>}
        />
        <Reveal className="lp-bento">
          {PROJECTS.map((p, i) => (
            <a key={p.slug} className="lp-proj" href={lpath(`/du-an/${p.slug}`, lang)}>
              <img src={projImg(p.slug)} alt={p.name} loading={i === 0 ? "eager" : "lazy"} />
              <span className="go" aria-hidden="true"><ArrowUpRight size={18} /></span>
              <div className="body">
                <span className="dev">{p.dev}</span>
                <h3>{p.name}</h3>
                <p>{p.desc[lang]}</p>
              </div>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ─── 5. MAP ──────────────────────────────────────────────────────────────────
function MapSection({ lang }: { lang: Lang }) {
  const [active, setActive] = useState(1);
  const proj = PROJECTS[active];
  return (
    <section className="lp-sec" id="ban-do">
      <div className="lp-wrap lp-map-grid">
        <Reveal>
          <span className="lp-eyebrow"><MapPin size={16} aria-hidden="true" />{T(lang, "Bản đồ dự án", "Project map")}</span>
          <h2 className="lp-h2" style={{ marginTop: 10 }}>{T(lang, "Chọn khu vực, xem dự án gần bạn", "Pick an area, see projects nearby")}</h2>
          <p className="lp-lead" style={{ marginTop: 10 }}>{T(lang, "Các dự án trọng điểm quanh TP.HCM, Đồng Nai và vùng ven.", "Key projects around HCMC, Dong Nai and the surrounding region.")}</p>
          <div className="lp-plist" style={{ marginTop: 22 }}>
            {PROJECTS.map((p, i) => (
              <button key={p.slug} type="button" aria-pressed={active === i} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}>
                <span className="dot" aria-hidden="true" />
                <span style={{ flex: 1 }}><b style={{ fontWeight: 650 }}>{p.name}</b><br /><small>{p.loc[lang]}</small></span>
                <span style={{ fontSize: 13, color: "var(--lp-muted)", whiteSpace: "nowrap" }}>{p.price[lang]}</span>
              </button>
            ))}
          </div>
          <a className="lp-btn lp-btn-primary" style={{ marginTop: 22 }} href={lpath(`/du-an/${proj.slug}`, lang)}>
            {T(lang, `Xem ${proj.name}`, `View ${proj.name}`)} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>

        <Reveal className="lp-mapcard">
          <div style={{ position: "relative", background: "var(--lp-paper)", border: "1px solid var(--lp-line)", borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px var(--lp-shadow)" }}>
            <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block", width: "100%", height: "auto" }}
              role="img" aria-label={T(lang, "Bản đồ vị trí các dự án nổi bật", "Map of featured project locations")}>
              <g stroke="var(--lp-hair)" strokeWidth="1"><path d="M200 0V640M400 0V640M600 0V640M800 0V640M1000 0V640" /><path d="M0 160H1200M0 320H1200M0 480H1200" /></g>
              <path fill="var(--lp-navy)" fillOpacity=".08" d="M0 560 C220 530 420 555 620 585 C820 615 1020 600 1200 570 L1200 640 L0 640 Z" />
              <path stroke="var(--lp-line)" strokeWidth="1.6" d="M0 560 C220 530 420 555 620 585 C820 615 1020 600 1200 570" />
              <path stroke="var(--lp-line)" strokeWidth="7" strokeLinecap="round" d="M340 0 C360 90 300 150 350 220 C400 290 480 300 470 380 C460 450 380 470 400 545" opacity=".85" />
              <path stroke="var(--lp-line)" strokeWidth="6" strokeLinecap="round" d="M980 0 C940 80 850 110 800 180 C750 250 640 260 560 320 C500 365 480 410 470 380" opacity=".85" />
              <g stroke="var(--lp-navy)" strokeWidth="1" strokeDasharray="4 5" opacity=".35">
                <path className="lp-route" d="M430 330 C520 300 620 260 700 210" /><path className="lp-route" d="M430 330 C560 320 700 330 810 300" />
                <path className="lp-route" d="M430 330 C440 400 470 480 520 545" /><path className="lp-route" d="M430 330 C480 310 540 300 590 285" />
              </g>
              <g fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="15" letterSpacing="2" fill="var(--lp-soft)">
                <text x="150" y="90">TÂY NINH</text><text x="120" y="430">LONG AN</text><text x="960" y="520">BR-VT</text>
                <text x="620" y="120">BÌNH DƯƠNG</text><text x="880" y="230">ĐỒNG NAI</text>
              </g>
              <circle fill="var(--lp-ink)" cx="430" cy="330" r="5" />
              <text x="430" y="356" textAnchor="middle" fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="15" letterSpacing="2" fill="var(--lp-soft)">TP.HCM</text>
              {PIN_DATA.map(p => (
                <g key={p.i} style={{ cursor: "pointer" }} onClick={() => setActive(p.i)} onMouseEnter={() => setActive(p.i)}>
                  <circle className="lp-pin-ring" cx={p.cx} cy={p.cy} r="14" stroke="var(--lp-navy)" strokeWidth="1.4" opacity=".55" style={{ animationDelay: `${p.i * 0.5}s` }} />
                  <circle cx={p.cx} cy={p.cy} r={active === p.i ? 9 : 7} fill={active === p.i ? "var(--lp-gold)" : "var(--lp-navy)"} stroke="var(--lp-paper)" strokeWidth="2.5" style={{ transition: "all .2s" }} />
                  <text x={p.cx} y={p.cy - 22} textAnchor="middle" fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="17" letterSpacing=".06em"
                    fill={active === p.i ? "var(--lp-ink)" : "var(--lp-muted)"} style={{ textTransform: "uppercase", fontWeight: active === p.i ? 700 : 400 }}>{p.label}</text>
                </g>
              ))}
            </svg>
            <a href={lpath(`/du-an/${proj.slug}`, lang)} style={{ position: "absolute", right: 16, bottom: 16, display: "flex", gap: 12, alignItems: "center", padding: 10, paddingRight: 16, borderRadius: 16, background: "var(--lp-cardbg)", border: "1px solid var(--lp-line)", boxShadow: "0 18px 40px var(--lp-shadow)", textDecoration: "none", color: "var(--lp-ink)", maxWidth: "calc(100% - 32px)" }}>
              <img src={projImg(proj.slug)} alt="" width={72} height={54} style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontSize: 15, fontWeight: 650 }}>{proj.name}</b>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--lp-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj.dev} · {proj.price[lang]}</span>
              </span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 6. WHY ──────────────────────────────────────────────────────────────────
function Why({ lang }: { lang: Lang }) {
  const items = [
    { icon: Scale, ti: T(lang, "Định giá minh bạch", "Transparent valuation"), tx: T(lang, "Ước tính theo dữ liệu giao dịch trong khu vực, hiển thị rõ từng yếu tố ảnh hưởng đến giá.", "Estimates from local transaction data, showing every factor that moves the price.") },
    { icon: ShieldCheck, ti: T(lang, "Pháp lý hai lớp", "Two-layer legal check"), tx: T(lang, "AI rà soát quy hoạch, sổ và tranh chấp; chuyên viên pháp lý xác nhận trước khi bạn đặt cọc.", "AI screens zoning, title and disputes; a legal specialist confirms before you deposit.") },
    { icon: FileSearch, ti: T(lang, "Thông tin có nguồn", "Sourced information"), tx: T(lang, "Giá và điều kiện giao dịch luôn cần đối chiếu với tài liệu gốc có ngày cập nhật.", "Prices and terms should always be checked against dated source documents.") },
    { icon: Landmark, ti: T(lang, "Hỗ trợ vay ngân hàng", "Mortgage support"), tx: T(lang, "Một bộ hồ sơ, so sánh gói vay của nhiều ngân hàng, đồng hành đến khi giải ngân.", "One application, compare offers from several banks, supported until disbursement.") },
  ];
  return (
    <section className="lp-sec" style={{ background: "var(--lp-tint)" }}>
      <div className="lp-wrap">
        <SectionHead
          eyebrow={T(lang, "Vì sao chọn SGS LAND", "Why SGS LAND")}
          title={T(lang, "Mua nhà an tâm hơn, miễn phí cho người mua", "Buy with more confidence, free for buyers")}
        />
        <Reveal className="lp-why">
          {items.map((it, i) => { const Icon = it.icon; return (
            <div key={i}><span className="ic"><Icon size={22} aria-hidden="true" /></span><h3>{it.ti}</h3><p>{it.tx}</p></div>
          ); })}
        </Reveal>
      </div>
    </section>
  );
}

// ─── 7. TOOLS ────────────────────────────────────────────────────────────────
function Tools({ lang }: { lang: Lang }) {
  const tools = [
    { icon: Calculator, ti: T(lang, "Định giá AI miễn phí", "Free AI valuation"), tx: T(lang, "Nhập địa chỉ và diện tích để biết khoảng giá hợp lý trước khi mua hoặc bán.", "Enter an address and size to see a fair price range before buying or selling."), cta: T(lang, "Định giá ngay", "Get a valuation"), href: "/ai-valuation" },
    { icon: Landmark, ti: T(lang, "Lãi suất & khoản vay", "Rates & mortgage"), tx: T(lang, "So sánh lãi suất ngân hàng, ước tính số tiền trả hằng tháng.", "Compare bank rates and estimate your monthly repayment."), cta: T(lang, "Xem lãi suất", "See rates"), href: "/lai-suat-ngan-hang" },
    { icon: Handshake, ti: T(lang, "Ký gửi bất động sản", "List your property"), tx: T(lang, "Gửi thông tin nhà đất, đội ngũ SGS LAND kiểm tra và giới thiệu đến người mua phù hợp.", "Send us your property; our team checks it and presents it to the right buyers."), cta: T(lang, "Ký gửi ngay", "List now"), href: "/ky-gui-bat-dong-san" },
  ];
  return (
    <section className="lp-sec" style={{ paddingTop: 0, background: "var(--lp-tint)" }}>
      <div className="lp-wrap">
        <Reveal className="lp-band">
          <div style={{ position: "relative", maxWidth: 620, marginBottom: 28 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lp-gold)" }}>{T(lang, "Công cụ miễn phí", "Free tools")}</span>
            <h2 style={{ fontSize: "clamp(24px,3vw,34px)", fontWeight: 650, lineHeight: 1.15, marginTop: 8, color: "#fff" }}>{T(lang, "Tính toán kỹ trước khi xuống tiền", "Run the numbers before you commit")}</h2>
          </div>
          <div className="lp-tools">
            {tools.map((t, i) => { const Icon = t.icon; return (
              <a key={i} className="lp-tool" href={lpath(t.href, lang)}>
                <Icon size={24} aria-hidden="true" style={{ color: "var(--lp-gold)" }} />
                <b>{t.ti}</b><p>{t.tx}</p>
                <span className="cta">{t.cta} <ArrowRight size={16} aria-hidden="true" /></span>
              </a>
            ); })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 8. FAQ ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--lp-hair)" }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", padding: "20px 2px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, textAlign: "left", font: "inherit" }}>
        <span style={{ fontWeight: 600, fontSize: 17, color: "var(--lp-ink)", lineHeight: 1.35 }}>{q}</span>
        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--lp-line)", display: "grid", placeItems: "center", color: "var(--lp-navy)", flexShrink: 0, fontSize: 18, transition: "transform .2s", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      <div className={`lp-faq-body ${open ? "open" : "closed"}`}>
        <p style={{ margin: "0 0 20px", color: "var(--lp-muted)", fontSize: 15, maxWidth: "68ch", lineHeight: 1.7 }}>{a}</p>
      </div>
    </div>
  );
}

function Faq({ lang, onChatOpen }: { lang: Lang; onChatOpen: () => void }) {
  const [all, setAll] = useState(false);
  const list = all ? FAQ_ITEMS : FAQ_ITEMS.slice(0, 6);
  return (
    <section id="faq" className="lp-sec">
      <div className="lp-wrap lp-faq-grid">
        <div className="lp-faq-side">
          <span className="lp-eyebrow">{T(lang, "Hỏi đáp", "FAQ")}</span>
          <h2 className="lp-h2" style={{ marginTop: 10 }}>{T(lang, "Câu hỏi thường gặp", "Frequently asked questions")}</h2>
          <p className="lp-lead" style={{ marginTop: 10, maxWidth: 420 }}>{T(lang, "Chưa thấy câu trả lời bạn cần? Hỏi trợ lý AI hoặc chuyên viên tư vấn.", "Can't find your answer? Ask the AI assistant or an advisor.")}</p>
          <button type="button" className="lp-btn lp-btn-ghost" style={{ marginTop: 20 }} onClick={onChatOpen}>
            <MessageCircle size={18} aria-hidden="true" /> {T(lang, "Đặt câu hỏi", "Ask a question")}
          </button>
        </div>
        <div>
          {list.map((f, i) => <FaqItem key={i} q={lang === "vi" ? f.q : f.q_en} a={lang === "vi" ? f.a : f.a_en} defaultOpen={i === 0} />)}
          {!all && (
            <button type="button" className="lp-link" style={{ marginTop: 18, background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => setAll(true)}>
              {T(lang, `Xem thêm ${FAQ_ITEMS.length - 6} câu hỏi`, `Show ${FAQ_ITEMS.length - 6} more questions`)} <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── 9. FINAL CTA ────────────────────────────────────────────────────────────
function FinalCta({ lang, onChatOpen }: { lang: Lang; onChatOpen: () => void }) {
  return (
    <section className="lp-sec" style={{ paddingTop: 0 }}>
      <div className="lp-wrap">
        <Reveal style={{ borderRadius: 28, border: "1px solid var(--lp-line)", background: "var(--lp-paper)", padding: "clamp(32px,5vw,64px)", textAlign: "center" }}>
          <span className="lp-eyebrow">{T(lang, "Miễn phí · Không cần đăng ký", "Free · No sign-up")}</span>
          <h2 className="lp-h2" style={{ marginTop: 12, fontSize: "clamp(28px,4vw,48px)" }}>{T(lang, <>Bắt đầu bằng <em style={{ fontStyle: "normal", color: "var(--lp-navy)" }}>giá thật.</em></>, <>Start with the <em style={{ fontStyle: "normal", color: "var(--lp-navy)" }}>real price.</em></>)}</h2>
          <p className="lp-lead" style={{ margin: "14px auto 28px", maxWidth: 480 }}>{T(lang, "Định giá AI ngay, hoặc trò chuyện với chuyên viên tư vấn để được hỗ trợ theo nhu cầu.", "Get an AI valuation now, or chat with an advisor for help with your needs.")}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="lp-btn lp-btn-primary" href={lpath("/ai-valuation", lang)}>{T(lang, "Định giá AI miễn phí", "Free AI valuation")} <ArrowRight size={16} aria-hidden="true" /></a>
            <button type="button" className="lp-btn lp-btn-ghost" onClick={onChatOpen}><MessageCircle size={18} aria-hidden="true" /> {T(lang, "Hỏi chuyên viên", "Ask an advisor")}</button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
interface Props {
  featuredListings?: any[];
  stats?: { totalListings: number; totalProjects: number; totalBrokers: number };
}

export function LandingPage({ featuredListings = [], stats }: Props) {
  const lang: Lang = useLang();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const total = stats?.totalListings ?? 0;
  const onChatOpen = useCallback(() => { window.dispatchEvent(new CustomEvent("sgs-open-chat")); }, []);
  const onAskAi = useCallback((q: string) => { window.dispatchEvent(new CustomEvent("sgs-open-chat", { detail: q ? { message: q } : undefined })); }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className={`lp-root lp-sans${ready ? " lp-ready" : ""}`} style={{ background: "var(--lp-bg)", color: "var(--lp-ink)", minHeight: "100vh" }}>
        <Hero lang={lang} listingCount={total} onAskAi={onAskAi} />
        <Categories lang={lang} />
        <LatestListings lang={lang} listings={featuredListings} total={total} />
        <Projects lang={lang} />
        <MapSection lang={lang} />
        <Why lang={lang} />
        <Tools lang={lang} />
        <Faq lang={lang} onChatOpen={onChatOpen} />
        <FinalCta lang={lang} onChatOpen={onChatOpen} />
      </div>
    </>
  );
}

export default LandingPage;
