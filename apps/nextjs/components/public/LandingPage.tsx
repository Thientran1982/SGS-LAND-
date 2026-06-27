// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sparkles, ArrowRight, Phone, MapPin, Shield, ChevronDown,
  CheckCircle, Star, Bot, Search, TrendingUp, Users, Award,
  ChevronRight, BarChart3, Landmark, Clock, Heart, Building2,
} from "lucide-react";
// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════
type Lang = "vi" | "en";
interface FeaturedProject {
  slug: string; name: string; dev: string; loc: string;
  scale: string; priceFrom: string; type: string;
  badge: string; badgeType: "sale" | "open" | "soon";
  img: string; legal?: boolean; category: string;
}
interface Props {
  featuredListings: any[];
  stats: { totalListings: number; totalProjects: number; totalBrokers: number };
}
// ═══════════════════════════════════════════════════════════════
//  STATIC DATA
// ═══════════════════════════════════════════════════════════════
const PROJECTS: FeaturedProject[] = [
  { slug: "aqua-city",             name: "Aqua City Novaland",       dev: "Novaland",          loc: "Biên Hòa, Đồng Nai",   scale: "1.000 ha", priceFrom: "6,5 tỷ",  type: "Biệt thự & Nhà phố", badge: "Đang bàn giao", badgeType: "sale", img: "/landing/aqua-city/hero-opt.jpg",            legal: true,  category: "villa"     },
  { slug: "the-global-city",       name: "The Global City",          dev: "Masterise Homes",   loc: "An Phú, TP Thủ Đức",    scale: "117 ha",   priceFrom: "7,5 tỷ",  type: "Căn hộ cao cấp",     badge: "Đang mở bán",  badgeType: "open", img: "/images/projects/the-global-city.webp",      legal: true,  category: "apt"       },
  { slug: "izumi-city",            name: "Izumi City Nam Long",      dev: "Nam Long Group",    loc: "Biên Hòa, Đồng Nai",   scale: "170 ha",   priceFrom: "1,2 tỷ",  type: "Đô thị chuẩn Nhật",  badge: "Đang mở bán",  badgeType: "open", img: "/images/projects/izumi-city.webp",           legal: true,  category: "apt"       },
  { slug: "vinhomes-can-gio",      name: "Vinhomes Cần Giờ",         dev: "Vinhomes",          loc: "Cần Giờ, TP.HCM",      scale: "2.870 ha", priceFrom: "8 tỷ",    type: "Đô thị biển",         badge: "Nhận đặt cọc", badgeType: "open", img: "/landing/aqua-city/hero-opt.jpg",                          category: "villa"     },
  { slug: "masteri-cosmo-central", name: "Masteri Cosmo Central",    dev: "Masterise Homes",   loc: "Đỗ Xuân Hợp, Thủ Đức", scale: "20 căn",   priceFrom: "6,43 tỷ", type: "Căn hộ cao cấp",     badge: "Còn hàng",     badgeType: "sale", img: "/landing/masteri-cosmo-central/hero.jpg",    legal: true,  category: "apt"       },
  { slug: "vinhomes-grand-park",   name: "Vinhomes Grand Park",      dev: "Vinhomes",          loc: "TP Thủ Đức",           scale: "271 ha",   priceFrom: "2,5 tỷ",  type: "Đại đô thị",          badge: "Còn hàng",     badgeType: "sale", img: "/landing/vinhomes-hoc-mon/hero.jpg",         legal: true,  category: "apt"       },
  { slug: "van-phuc-city",         name: "Vạn Phúc City",            dev: "Vạn Phúc Group",    loc: "TP Thủ Đức",           scale: "198 ha",   priceFrom: "15 tỷ",   type: "Nhà phố & Biệt thự", badge: "Đang mở bán",  badgeType: "open", img: "/landing/legacy-66/hero.jpg",                              category: "townhouse" },
];
const STATS_DATA = [
  { num: 45000, suffix: "+",        prefix: "",   vi: "BĐS quản lý",        en: "Properties"       },
  { num: 15000, suffix: "+",        prefix: "",   vi: "Môi giới đối tác",   en: "Partner Agents"   },
  { num: 1,     suffix: " tỷ USD+", prefix: "",   vi: "Giá trị giao dịch",  en: "Transaction Value"},
  { num: 48,    suffix: "/5",       prefix: "4.", vi: "Đánh giá khách hàng",en: "Customer Rating"  },
  { num: 5,     suffix: "%",        prefix: "±",  vi: "Sai số định giá AI", en: "AI Valuation MAPE"},
];
const TICKER_ITEMS = [
  "Căn hộ Vinhomes Grand Park 2PN — 3,2 tỷ — Đã công chứng 10/06/2026",
  "Nhà phố Aqua City 5×20m — 8,5 tỷ — Sổ hồng trao tay 08/06/2026",
  "Đất nền Legacy 66 Long An — 2,1 tỷ — Pháp lý đầy đủ 05/06/2026",
  "Biệt thự The Global City — 15 tỷ — Đặt cọc thành công 03/06/2026",
  "Căn hộ Izumi City 3PN — 4,8 tỷ — Chốt hôm nay 01/06/2026",
  "Shophouse Masteri Cosmo Central — 6,43 tỷ — Sang tên 29/05/2026",
  "Biệt thự Vạn Phúc ven sông — 18 tỷ — Pháp lý sạch 27/05/2026",
];
const PLACEHOLDERS = [
  "Căn hộ 2PN gần Metro số 1, dưới 3 tỷ…",
  "Biệt thự Aqua City có sổ hồng riêng…",
  "Đất nền Biên Hòa pháp lý sạch dưới 2 tỷ…",
  "Vay 70% mua Grand Park, lãi suất thấp nhất…",
];
const QUICK_CHIPS = [
  "Biệt thự Aqua City có sổ hồng",
  "Đất nền pháp lý sạch Biên Hòa",
  "Vay 70% lãi suất thấp",
];
const FAQ_ITEMS = [
  { q: "Tại sao nên mua bất động sản qua SGS LAND?",           a: "SGS LAND là đại lý F1 uỷ quyền chính thức của Novaland, Masterise Homes, Nam Long và Vinhomes — đảm bảo giá gốc, không phát sinh phí môi giới cho người mua, pháp lý minh bạch 2 lớp độc lập." },
  { q: "Công nghệ định giá AI của SGS LAND chính xác bao nhiêu?", a: "Công nghệ SGS-AVM v2.1 sử dụng 9 hệ số định giá chuẩn TĐGVN/IVS, MAPE ±4.8%, dựa trên hơn 2.400 giao dịch công chứng thực tế. Kết quả tức thì, minh bạch từng yếu tố ảnh hưởng." },
  { q: "Quy trình kiểm tra pháp lý tại SGS LAND như thế nào?", a: "2 lớp độc lập: AI sơ thẩm kiểm tra quy hoạch 1/2000, sổ hồng, tranh chấp tài sản; Chuyên viên pháp lý xác nhận thực địa theo Luật Đất Đai 2024 và Luật Kinh doanh BĐS 2023." },
  { q: "Người mua có phải trả phí dịch vụ không?",             a: "Hoàn toàn miễn phí. Định giá AI, tư vấn pháp lý, hỗ trợ vay vốn — tất cả đều không mất phí với người mua và thuê. Người bán và chủ đầu tư chi trả hoa hồng dịch vụ cho SGS LAND." },
  { q: "SGS LAND hỗ trợ vay ngân hàng như thế nào?",           a: "Đối tác với 12+ ngân hàng lớn (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, lãi suất từ 6–8,5%/năm. Đội tư vấn tài chính đồng hành từ hồ sơ đến giải ngân." },
  { q: "Những dự án nào đang phân phối tại SGS LAND?",         a: "Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Cần Giờ, Masteri Cosmo Central, Vinhomes Hóc Môn — cập nhật liên tục." },
];
const FILTER_TABS = [
  { id: "all", vi: "Tất cả", en: "All" },
  { id: "apt", vi: "Căn hộ", en: "Apartments" },
  { id: "villa", vi: "Biệt thự", en: "Villas" },
  { id: "townhouse", vi: "Nhà phố", en: "Townhouses" },
];
const BADGE_STYLES: Record<string, React.CSSProperties> = {
  sale: { background: "rgba(30,127,92,0.12)", color: "var(--sgs-verified)", border: "1px solid rgba(30,127,92,0.25)" },
  open: { background: "rgba(27,58,92,0.10)",  color: "var(--sgs-primary)", border: "1px solid rgba(27,58,92,0.2)"  },
  soon: { background: "rgba(200,150,62,0.12)",color: "var(--sgs-accent-text)", border: "1px solid rgba(200,150,62,0.3)" },
};
// ═══════════════════════════════════════════════════════════════
//  HOOKS
// ═══════════════════════════════════════════════════════════════
function useInView(threshold = 0.25) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}
function useCountUp(target: number, duration = 1800, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setCount(target);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, active]);
  return count;
}
// ═══════════════════════════════════════════════════════════════
//  SHARED: Section Heading
// ═══════════════════════════════════════════════════════════════
function SectionHeading({ title, subtitle, center = false }: {
  title: React.ReactNode; subtitle?: string; center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <h2
        className="text-2xl sm:text-3xl font-semibold leading-tight"
        style={{
          fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
          color: "var(--sgs-primary, var(--sgs-primary))",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      <div
        className={center ? "mx-auto" : ""}
        style={{ width: "48px", height: "3px", background: "var(--sgs-accent)", borderRadius: "2px", marginTop: "10px", marginBottom: subtitle ? "12px" : 0 }}
      />
      {subtitle && (
        <p className="text-base mt-2" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — HERO
// ═══════════════════════════════════════════════════════════════
function HeroSection({ onSearch, lang }: { onSearch: (q: string) => void; lang: Lang }) {
  const [query, setQuery]           = useState("");
  const [phIdx, setPhIdx]           = useState(0);
  const [visible, setVisible]       = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const id = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query || PLACEHOLDERS[phIdx]);
  };
  const chip = (text: string) => {
    setQuery(text);
    document.getElementById("sgs-search")?.focus();
  };
  return (
    <section
      className="relative flex flex-col justify-center overflow-hidden min-h-[74vh] sm:min-h-[88vh]"
      style={{
        paddingTop: "72px",
        background: "linear-gradient(175deg, #0A1E33 0%, #0F2740 45%, var(--sgs-primary) 80%, rgba(200,150,62,0.18) 100%)",
      }}
    >
      {/* City silhouette */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none" style={{ height: "180px" }}>
        <svg viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", opacity: 0.10 }}>
          <path d="M0,180 L0,120 L40,120 L40,90 L60,90 L60,120 L80,120 L80,70 L100,70 L100,55 L120,55 L120,70 L140,70 L140,120 L160,120 L160,80 L180,80 L180,45 L190,45 L190,25 L200,25 L200,45 L210,45 L210,80 L240,80 L240,100 L260,100 L260,60 L280,60 L280,35 L300,35 L300,18 L310,18 L310,8 L320,8 L320,18 L330,18 L330,35 L360,35 L360,60 L380,60 L380,95 L400,95 L400,70 L420,70 L420,45 L440,45 L440,70 L460,70 L460,95 L480,95 L480,120 L500,120 L500,90 L520,90 L520,62 L540,62 L540,90 L560,90 L560,115 L580,115 L580,78 L600,78 L600,52 L620,52 L620,35 L640,35 L640,52 L660,52 L660,78 L680,78 L680,108 L720,108 L720,135 L760,135 L760,108 L780,108 L780,80 L800,80 L800,62 L820,62 L820,80 L840,80 L840,108 L860,108 L860,80 L880,80 L880,52 L900,52 L900,35 L920,35 L920,52 L940,52 L940,80 L960,80 L960,108 L1000,108 L1000,80 L1020,80 L1020,62 L1040,62 L1040,45 L1060,45 L1060,62 L1080,62 L1080,80 L1100,80 L1100,108 L1120,108 L1120,70 L1140,70 L1140,45 L1160,45 L1160,25 L1180,25 L1180,45 L1200,45 L1200,70 L1240,70 L1240,98 L1260,98 L1260,70 L1280,70 L1280,90 L1300,90 L1300,118 L1320,118 L1320,98 L1340,98 L1340,120 L1360,120 L1360,100 L1400,100 L1400,120 L1440,120 L1440,180 Z"
            fill="var(--sgs-accent)"/>
        </svg>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-14 sm:py-20">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4 sm:mb-6"
          style={{ background: "rgba(200,150,62,0.15)", border: "1px solid rgba(200,150,62,0.4)", color: "#D4A855" }}
        >
          <Award className="w-3.5 h-3.5" />
          Đại lý F1 uỷ quyền — Novaland · Masterise · Nam Long · Vinhomes
        </div>
        {/* Kinetic headline */}
        <h1
          id="seo-h1"
          className="mb-3 sm:mb-5"
          style={{
            fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 5vw, 3.8rem)",
            lineHeight: 1.15,
            color: "#FFFFFF",
            letterSpacing: "-0.02em",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.75s ease, transform 0.75s ease",
          }}
        >
          {lang === "vi" ? (
            <>
              Tìm kiếm, mua &amp;{" "}
              <span
                className="italic"
                style={{ color: "#D4A855", display: "inline-block", position: "relative" }}
              >
                đầu tư
                <span
                  style={{
                    position: "absolute", bottom: "-2px", left: 0, height: "2.5px",
                    background: "#D4A855", borderRadius: "2px",
                    animation: "underline-draw 0.55s ease 0.85s forwards",
                    width: 0,
                  }}
                />
              </span>{" "}
              BĐS TP.HCM
            </>
          ) : (
            <>
              Search, Buy &amp;{" "}
              <span className="italic" style={{ color: "#D4A855" }}>invest</span>{" "}
              in HCMC Real Estate
            </>
          )}
        </h1>
        <p
          className="text-sm sm:text-lg max-w-lg mb-6 sm:mb-10"
          style={{
            color: "rgba(220,232,244,0.78)",
            fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.75s ease 0.18s",
          }}
        >
          {lang === "vi"
            ? "Định giá AI ±5%, pháp lý 2 lớp, CRM đa kênh. Kết nối 15.000+ môi giới và 45.000+ sản phẩm BĐS tại TP.HCM, Đồng Nai, Bình Dương."
            : "AI Valuation ±5%, 2-layer legal check, multi-channel CRM. Connecting 15,000+ agents and 45,000+ properties across HCMC, Dong Nai, Binh Duong."}
        </p>
        {/* Glass AI Search Panel */}
        <div style={{ marginBottom: "-52px", maxWidth: "680px" }}>
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(200,150,62,0.4)",
              boxShadow: "0 20px 60px rgba(10,30,51,0.4), 0 4px 16px rgba(200,150,62,0.12)",
            }}
          >
            <p
              className="text-xs font-semibold mb-3 flex items-center gap-1.5"
              style={{ color: "var(--sgs-accent-text)" }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--sgs-accent)" }} />
              {lang === "vi"
                ? "Hỏi AI — mô tả nhu cầu bằng ngôn ngữ tự nhiên"
                : "Ask AI — describe your needs in natural language"}
            </p>
            <form onSubmit={submit} className="flex gap-2">
              <div className="flex-1 relative min-w-0">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 shrink-0" style={{ color: "var(--sgs-accent)" }} />
                <input
                  id="sgs-search"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Mô tả nhu cầu BĐS..."
                  data-placeholder-full={PLACEHOLDERS[phIdx]}
                  className="w-full pl-10 pr-3 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "#F8F9FB",
                    border: "1.5px solid rgba(27,58,92,0.1)",
                    color: "var(--sgs-text)",
                    caretColor: "var(--sgs-accent)",
                    fontFamily: "var(--font-be-vietnam, sans-serif)",
                  }}
                  onFocus={e => {
                    e.currentTarget.placeholder = e.currentTarget.dataset.placeholderFull || "Mô tả nhu cầu BĐS...";
                    e.currentTarget.style.border = "1.5px solid rgba(200,150,62,0.6)";
                  }}
                  onBlur={e => {
                    e.currentTarget.placeholder = "Mô tả nhu cầu BĐS...";
                    e.currentTarget.style.border = "1.5px solid rgba(27,58,92,0.1)";
                  }}
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 sm:px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0"
                style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-accent)")}
              >
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === "vi" ? "Hỏi ngay" : "Search"}</span>
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_CHIPS.map(c => (
                <button
                  key={c}
                  onClick={() => chip(c)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: "var(--sgs-champagne)", color: "var(--sgs-primary)",
                    border: "1px solid rgba(200,150,62,0.25)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#EAD5B0")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-champagne)")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — STATS BAR
// ═══════════════════════════════════════════════════════════════
function StatItem({ num, suffix, prefix, label }: { num: number; suffix: string; prefix: string; label: string }) {
  const { ref, inView } = useInView(0.3);
  const count = useCountUp(num, 1800, inView);
  const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("vi-VN") : String(n));
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="text-center px-2 py-1">
      <div
        className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums"
        style={{
          fontFamily: "var(--font-ibm-plex-mono, var(--font-jetbrains-mono), monospace)",
          color: "var(--sgs-primary, var(--sgs-primary))",
        }}
      >
        {prefix}{fmt(count)}{suffix}
      </div>
      <div className="text-xs sm:text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{label}</div>
    </div>
  );
}
function StatsBar({ lang }: { lang: Lang }) {
  return (
    <section
      className="relative z-10"
      style={{
        background: "var(--sgs-surface, #FFFFFF)",
        borderBottom: "1px solid rgba(27,58,92,0.08)",
        paddingTop: "76px",
        paddingBottom: "28px",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-2 gap-y-4 sm:gap-6">
          {STATS_DATA.map(s => (
            <StatItem
              key={s.vi}
              num={s.num} suffix={s.suffix} prefix={s.prefix}
              label={lang === "vi" ? s.vi : s.en}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 3 — LEGAL TICKER
// ═══════════════════════════════════════════════════════════════
function LegalTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      className="overflow-hidden relative"
      style={{
        background: "var(--sgs-primary-deep)",
        borderTop: "1px solid rgba(200,150,62,0.15)",
        borderBottom: "1px solid rgba(200,150,62,0.15)",
        padding: "7px 0",
      }}
    >
      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-10 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, var(--sgs-primary-deep), transparent)" }} />
      <div className="absolute inset-y-0 right-0 w-10 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, var(--sgs-primary-deep), transparent)" }} />
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker-scroll 32s linear infinite" }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-5 sm:px-8"
            style={{
              color: "rgba(185,198,212,0.88)",
              fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ color: "var(--sgs-accent)", fontSize: "6px", opacity: 0.75 }}>●</span>
            <span style={{ color: "var(--sgs-verified)", fontWeight: 600, fontSize: "10px" }}>✓</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — PROJECTS
// ═══════════════════════════════════════════════════════════════
function ProjectCard({ proj }: { proj: FeaturedProject }) {
  return (
    <Link
      href={`/du-an/${proj.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--sgs-surface, #FFFFFF)",
        border: "1px solid rgba(27,58,92,0.08)",
        boxShadow: "0 1px 4px rgba(22,32,43,0.06)",
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 28px rgba(22,32,43,0.12)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(22,32,43,0.06)")}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16/9", background: "linear-gradient(135deg, #0F2740, var(--sgs-primary))" }}
      >
        <Image
          src={proj.img} alt={proj.name} fill loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span
          className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={BADGE_STYLES[proj.badgeType]}
        >
          {proj.badge}
        </span>
        {proj.legal && (
          <span
            className="absolute top-3 right-3 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(30,127,92,0.9)", color: "#FFFFFF", backdropFilter: "blur(4px)" }}
          >
            <CheckCircle className="w-3 h-3" /> Pháp lý ✓
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-medium mb-1" style={{ color: "var(--sgs-accent-text)" }}>{proj.type}</span>
        <h3
          className="font-semibold text-sm mb-1 leading-snug"
          style={{ color: "var(--sgs-text, #16202B)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}
        >
          {proj.name}
        </h3>
        <div className="flex items-center gap-1 text-xs mb-3" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          <MapPin className="w-3 h-3 shrink-0" />{proj.dev} · {proj.loc}
        </div>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="text-[11px] mb-0.5" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>Quy mô {proj.scale}</div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--sgs-accent-text, #8C6420)", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              Từ {proj.priceFrom}
            </div>
          </div>
          <div
            className="flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-1"
            style={{ color: "var(--sgs-primary)" }}
          >
            Xem <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}
function ProjectsSection({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? PROJECTS : PROJECTS.filter(p => p.category === filter);
  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <SectionHeading
            title={lang === "vi" ? "Dự án nổi bật" : "Featured Projects"}
            subtitle={lang === "vi" ? "Đại lý phân phối F1 uỷ quyền chính thức" : "Official F1 authorized distributor"}
          />
          <Link
            href="/du-an"
            className="flex items-center gap-1 text-sm font-semibold shrink-0 mb-2"
            style={{ color: "var(--sgs-primary)" }}
          >
            {lang === "vi" ? "Xem tất cả" : "View all"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: filter === tab.id ? "var(--sgs-primary)" : "var(--sgs-surface, #FFFFFF)",
                color: filter === tab.id ? "#FFFFFF" : "var(--sgs-primary)",
                border: filter === tab.id ? "1px solid var(--sgs-primary)" : "1px solid rgba(27,58,92,0.18)",
              }}
            >
              {lang === "vi" ? tab.vi : tab.en}
            </button>
          ))}
        </div>
        {/* 1-col mobile / 2-col tablet / 3-col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => <ProjectCard key={p.slug} proj={p} />)}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 5 — VALUATION PROMO
// ═══════════════════════════════════════════════════════════════
function ValuationSection({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-surface, #FFFFFF)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div>
            <SectionHeading
              title={lang === "vi" ? "Định giá AI ±5% — Chính xác tức thì" : "AI Valuation ±5% — Instant Accuracy"}
              subtitle={lang === "vi"
                ? "SGS-AVM v2.1 · 9 hệ số · 2.400+ giao dịch thực · Chuẩn TĐGVN/IVS"
                : "SGS-AVM v2.1 · 9 factors · 2,400+ real transactions · TĐGVN/IVS standard"}
            />
            <ul className="space-y-3 my-7">
              {(lang === "vi" ? [
                "Kết quả tức thì dưới 30 giây",
                "Phân tích 9 yếu tố: vị trí, pháp lý, tiện ích, thị trường",
                "Báo cáo PDF chuyên nghiệp kèm so sánh thị trường",
                "Hoàn toàn miễn phí cho người dùng cá nhân",
              ] : [
                "Results in under 30 seconds",
                "9 factors: location, legal, amenities, market conditions",
                "Professional PDF report with market comparison",
                "Completely free for individual users",
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--sgs-verified)" }} />
                  <span className="text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/ai-valuation"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-accent)")}
            >
              <Sparkles className="w-4 h-4" />
              {lang === "vi" ? "Định giá ngay — Miễn phí" : "Valuate for Free"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {/* Mock valuation UI */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(145deg, #F8F9FB, #EDF1F7)",
              border: "1px solid rgba(27,58,92,0.1)",
              boxShadow: "0 4px 24px rgba(27,58,92,0.08)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold" style={{ color: "var(--sgs-primary)" }}>Kết quả định giá AI</span>
              <span
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(30,127,92,0.1)", color: "var(--sgs-verified)" }}
              >
                <CheckCircle className="w-3 h-3" /> ±4.8%
              </span>
            </div>
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.7)" }}>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--sgs-primary)" }}>Vinhomes Grand Park 2PN · 65m²</p>
              <p className="text-xs" style={{ color: "var(--sgs-text-muted)" }}>TP Thủ Đức · Tầng 15 · Hướng Đông Nam</p>
            </div>
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2" style={{ color: "var(--sgs-text-muted)" }}>
                <span>2,85 tỷ</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "var(--sgs-accent-text)", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  3,18 tỷ ★
                </span>
                <span>3,45 tỷ</span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: "var(--sgs-border)" }}>
                <div
                  className="absolute top-0 left-[22%] right-[22%] h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, rgba(200,150,62,0.25), #C8963E, rgba(200,150,62,0.25))" }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
                  style={{ left: "calc(50% - 8px)", background: "var(--sgs-accent)", boxShadow: "0 2px 6px rgba(200,150,62,0.5)" }}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Vị trí & Kết nối",          score: 88 },
                { label: "Pháp lý",                   score: 95 },
                { label: "Tiện ích nội khu",           score: 82 },
                { label: "Thanh khoản thị trường",     score: 79 },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-xs shrink-0 w-36" style={{ color: "var(--sgs-text-muted)" }}>{f.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--sgs-border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${f.score}%`, background: f.score > 85 ? "var(--sgs-verified)" : "var(--sgs-accent)" }}
                    />
                  </div>
                  <span
                    className="text-xs w-7 text-right font-medium"
                    style={{ color: "var(--sgs-primary)", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 6 — BENTO "WHY SGS LAND"
// ═══════════════════════════════════════════════════════════════
function BentoSection({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <SectionHeading
            title={lang === "vi" ? "Tại sao chọn SGS LAND?" : "Why SGS LAND?"}
            subtitle={lang === "vi"
              ? "Nền tảng proptech tin dùng bởi 15.000+ môi giới và doanh nghiệp BĐS"
              : "Trusted by 15,000+ agents and real estate companies"}
          />
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Big card — spans 2 cols × 2 rows */}
          <div
            className="sm:col-span-2 lg:row-span-2 rounded-2xl p-7 flex flex-col"
            style={{
              background: "linear-gradient(145deg, #0F2740, var(--sgs-primary))",
              border: "1px solid rgba(200,150,62,0.2)",
              minHeight: "260px",
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(200,150,62,0.15)" }}>
              <Sparkles className="w-6 h-6" style={{ color: "#D4A855" }} />
            </div>
            <h3 className="text-xl font-semibold mb-2"
              style={{ color: "#FFFFFF", fontFamily: "var(--font-noto-serif, serif)" }}>
              Định giá AI ±5%
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--sgs-on-dark-muted)" }}>
              SGS-AVM v2.1 — 9 hệ số TĐGVN/IVS. Phân tích realtime từ 2.400+ giao dịch công chứng thực tế.
            </p>
            {/* Sparkline */}
            <div className="mt-auto">
              <svg viewBox="0 0 200 44" className="w-full" style={{ height: "44px" }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(200,150,62,0.25)" />
                    <stop offset="100%" stopColor="rgba(200,150,62,0)" />
                  </linearGradient>
                </defs>
                <polyline points="0,38 28,32 60,27 90,18 120,24 150,14 178,9 200,6"
                  fill="none" stroke="rgba(200,150,62,0.7)" strokeWidth="1.5" strokeLinejoin="round"/>
                <polygon points="0,38 28,32 60,27 90,18 120,24 150,14 178,9 200,6 200,44 0,44"
                  fill="url(#sparkFill)" />
                <circle cx="200" cy="6" r="3" fill="#D4A855" />
              </svg>
              <p className="text-[11px]" style={{ color: "var(--sgs-on-dark-muted)" }}>Thị trường BĐS Đông Nam Bộ Q2/2026</p>
            </div>
          </div>
          {/* Legal */}
          <div
            className="sm:col-span-2 rounded-2xl p-6 flex items-start gap-4"
            style={{
              background: "var(--sgs-surface, #FFFFFF)",
              border: "1px solid rgba(27,58,92,0.09)",
              boxShadow: "0 1px 3px rgba(22,32,43,0.06)",
            }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(30,127,92,0.1)" }}>
              <Shield className="w-5 h-5" style={{ color: "var(--sgs-verified)" }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1.5"
                style={{ color: "var(--sgs-primary)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                Pháp lý 2 lớp độc lập
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "var(--sgs-text-muted)" }}>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--sgs-verified)" }} />
                  AI: Quy hoạch 1/2000 + sổ đỏ
                </span>
                <span style={{ color: "#CBD5E1" }}>→</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--sgs-verified)" }} />
                  Chuyên viên: Xác nhận thực địa
                </span>
              </div>
            </div>
          </div>
          {/* Free for buyers */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--sgs-champagne)", border: "1px solid rgba(200,150,62,0.2)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(200,150,62,0.15)" }}>
              <Heart className="w-5 h-5" style={{ color: "var(--sgs-accent-text)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-primary)" }}>
              {lang === "vi" ? "Miễn phí 100%" : "100% Free"}
            </h3>
            <p className="text-sm" style={{ color: "var(--sgs-text-muted)" }}>
              {lang === "vi" ? "với người mua & thuê" : "for buyers & renters"}
            </p>
          </div>
          {/* Bank loans */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--sgs-surface, #FFFFFF)",
              border: "1px solid rgba(27,58,92,0.09)",
              boxShadow: "0 1px 3px rgba(22,32,43,0.06)",
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(27,58,92,0.07)" }}>
              <Landmark className="w-5 h-5" style={{ color: "var(--sgs-primary)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-primary)" }}>
              {lang === "vi" ? "Vay ưu đãi 12+ NH" : "12+ Bank Partners"}
            </h3>
            <p
              className="text-sm tabular-nums"
              style={{
                color: "var(--sgs-text-muted)",
                fontFamily: "var(--font-ibm-plex-mono, monospace)",
              }}
            >
              LTV 70–80% · 6–8,5%/năm
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 7 — TRUST BLOCK
// ═══════════════════════════════════════════════════════════════
const PARTNERS = ["Novaland", "Masterise Homes", "Nam Long Group", "Vinhomes"];

function TrustBlock({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-surface, #FFFFFF)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title={lang === "vi" ? "Đối tác phân phối F1" : "F1 Distribution Partners"}
          subtitle={lang === "vi" ? "Uỷ quyền chính thức từ chủ đầu tư" : "Officially authorized by developers"}
        />
        {/* Partner logos */}
        <div className="flex flex-wrap items-center gap-4 mt-8 mb-12">
          {PARTNERS.map(p => (
            <div
              key={p}
              className="flex items-center justify-center px-6 py-3 rounded-xl transition-all"
              style={{
                background: "#F8F9FB", border: "1px solid rgba(27,58,92,0.1)",
                opacity: 0.72, minWidth: "130px",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.72")}
            >
              <span className="font-bold text-sm" style={{ color: "var(--sgs-primary)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                {p}
              </span>
            </div>
          ))}
        </div>
        {/* Testimonial card */}
        <div
          className="rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start"
          style={{ background: "#F8F9FB", border: "1px solid rgba(27,58,92,0.08)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: "var(--sgs-primary)", color: "#FFFFFF" }}
          >
            NH
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: "var(--sgs-accent)" }} />
                ))}
              </div>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(30,127,92,0.1)", color: "var(--sgs-verified)" }}
              >
                Giao dịch đã xác minh
              </span>
            </div>
            <blockquote className="text-sm leading-relaxed mb-3" style={{ color: "var(--sgs-text)" }}>
              "Mua biệt thự Aqua City qua SGS LAND tháng 1/2026. Đội tư vấn giải thích rõ chính sách thanh toán, hỗ trợ vay BIDV và kiểm tra pháp lý miễn phí. Quá trình từ đặt cọc đến ký hợp đồng chỉ 5 ngày làm việc."
            </blockquote>
            <p className="text-sm font-semibold" style={{ color: "var(--sgs-primary)" }}>Anh Nguyễn Văn Hải</p>
            <p className="text-xs" style={{ color: "var(--sgs-text-muted)" }}>Khách hàng mua Aqua City · TP.HCM, tháng 1/2026</p>
          </div>
        </div>
        {/* Micro-trust bar */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8"
          style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
        >
          {[
            { icon: <Award className="w-5 h-5" />,    label: lang === "vi" ? "GPKD số 0300000000 · TP.HCM"  : "Business Reg. 0300000000 · HCMC" },
            { icon: <Building2 className="w-5 h-5" />, label: lang === "vi" ? "Thành lập từ năm 2018"         : "Established since 2018"           },
            { icon: <Clock className="w-5 h-5" />,    label: lang === "vi" ? "Hotline phản hồi < 15 phút"    : "Hotline response < 15 minutes"    },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-primary)" }}>
                {item.icon}
              </div>
              <span className="text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 8 — FAQ
// ═══════════════════════════════════════════════════════════════
function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        border: `1.5px solid ${open ? "rgba(200,150,62,0.35)" : "rgba(27,58,92,0.1)"}`,
        background: open ? "rgba(245,234,213,0.25)" : "var(--sgs-surface, #FFFFFF)",
      }}
    >
      <button
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span
          className="font-medium text-sm leading-relaxed"
          style={{ color: "var(--sgs-text, #16202B)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}
        >
          {q}
        </span>
        <ChevronDown
          className="w-4 h-4 shrink-0 mt-0.5 transition-transform duration-200"
          style={{ color: open ? "var(--sgs-accent)" : "var(--sgs-text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>
      <div style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          {a}
        </p>
      </div>
    </div>
  );
}
function FAQSection({ lang }: { lang: Lang }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const half = Math.ceil(FAQ_ITEMS.length / 2);
  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <SectionHeading
            title={lang === "vi" ? "Câu hỏi thường gặp" : "Frequently Asked Questions"}
            subtitle={lang === "vi"
              ? "Giải đáp thắc mắc về mua bán BĐS cùng SGS LAND"
              : "Answers about buying & selling real estate with SGS LAND"}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {FAQ_ITEMS.slice(0, half).map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a}
                open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
            ))}
          </div>
          <div className="space-y-3">            {FAQ_ITEMS.slice(half).map((item, i) => (
              <FAQItem key={i + half} q={item.q} a={item.a}
                open={openIdx === i + half} onToggle={() => setOpenIdx(openIdx === (i + half) ? null : i + half)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 9 — CTA BANNER
// ═══════════════════════════════════════════════════════════════
function CTABanner({ lang }: { lang: Lang }) {
  return (
    <section
      className="py-20"
      style={{
        background: "linear-gradient(135deg, #0A1E33 0%, #0F2740 60%, var(--sgs-primary) 100%)",
        borderTop: "1px solid rgba(200,150,62,0.2)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-2xl sm:text-3xl font-semibold mb-3"
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-noto-serif, Georgia, serif)",
            letterSpacing: "-0.01em",
          }}
        >
          {lang === "vi" ? "Nhận tư vấn miễn phí trong 15 phút" : "Get free consultation in 15 minutes"}
        </h2>
        <p className="text-base mb-8" style={{ color: "var(--sgs-on-dark-muted)" }}>
          {lang === "vi"
            ? "Đội chuyên viên SGS LAND sẵn sàng hỗ trợ — định giá, pháp lý, vay vốn, đặt lịch tham quan dự án"
            : "SGS LAND specialists ready to help — valuation, legal, financing, project visits"}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="tel:+84971132378"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center"
            style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-accent)")}
          >
            <Phone className="w-4 h-4" />
            Hotline +84 971 132 378
          </a>
          <Link
            href="/ai-valuation"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center"
            style={{
              border: "1.5px solid rgba(255,255,255,0.35)",
              color: "#FFFFFF",
              background: "rgba(255,255,255,0.06)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <Bot className="w-4 h-4" />
            {lang === "vi" ? "Hỏi AI ngay" : "Ask AI now"}
          </Link>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export function LandingPage({ featuredListings, stats }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("vi");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sgs-lang") as Lang | null;
      if (saved === "vi" || saved === "en") setLang(saved);
    } catch {}
    const handler = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener("sgs-lang-change", handler);
    return () => window.removeEventListener("sgs-lang-change", handler);
  }, []);

  const handleSearch = (q: string) => {
    if (q.trim()) router.push(`/marketplace?q=${encodeURIComponent(q.trim())}`);
    else router.push("/marketplace");
  };
  return (
    <div className="flex flex-col overflow-x-hidden">
      <HeroSection   onSearch={handleSearch} lang={lang} />
      <StatsBar      lang={lang} />
      <LegalTicker />
      <ProjectsSection  lang={lang} />
      <ValuationSection lang={lang} />
      <BentoSection     lang={lang} />
      <TrustBlock       lang={lang} />
      <FAQSection       lang={lang} />
      <CTABanner        lang={lang} />
    </div>
  );
}