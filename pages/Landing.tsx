
import React, { useState, useEffect, useRef } from "react";
import { AiChatWidget } from "../components/AiChatWidget";

import {
  Sparkles, ArrowRight, Phone, Mail, MapPin, Shield, ChevronDown,
  CheckCircle, Star, Bot, Search, TrendingUp, Users, Award,
  ChevronRight, BarChart3, Landmark, Clock, Heart, Building2,
  Sun, Moon, Globe, User, Menu, X,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type Lang = "vi" | "en";
type Theme = "light" | "dark";

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
  { slug: "vinhomes-can-gio",      name: "Vinhomes Cần Giờ",         dev: "Vinhomes",          loc: "Cần Giờ, TP.HCM",      scale: "2.870 ha", priceFrom: "8 tỷ", type: "Đô thị biển",         badge: "Nhận đặt cọc", badgeType: "open", img: "/landing/aqua-city/hero-opt.jpg",                          category: "villa"     },
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
  "Nhà phố Aqua City 5×20m — 5,5 tỷ — Sổ hồng trao tay 08/06/2026",
  "Căn hộ Legacy 66 Tp.HCM — 6,1 tỷ — Pháp lý đầy đủ 05/06/2026",
  "Biệt thự The Global City — 15 tỷ — Đặt cọc thành công 03/06/2026",
  "Nhà phố Izumi City 4PN — 7,8 tỷ — Chốt hôm nay 01/06/2026",
  "Shophouse Masteri Cosmo Central — 12,4 tỷ — Sang tên 29/05/2026",
  "Biệt thự Vạn Phúc ven sông — 22 tỷ — Pháp lý sạch 27/05/2026",
];

const PLACEHOLDERS = [
  "Căn hộ 2PN gần Metro số 1, dưới 3 tỷ…",
  "Biệt thự Aqua City có sổ hồng riêng…",
  "Căn hộ Masteri Cosmo Central pháp lý sạch dưới 7 tỷ…",
  "Vay 70% mua Vinhomes Hóc Môn, lãi suất thấp nhất…",
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
  sale: { background: "rgba(30,127,92,0.12)", color: "#1E7F5C", border: "1px solid rgba(30,127,92,0.25)" },
  open: { background: "rgba(27,58,92,0.10)",  color: "var(--sgs-text-heading, #1B3A5C)", border: "1px solid rgba(27,58,92,0.2)"  },
  soon: { background: "rgba(200,150,62,0.12)",color: "#8C6420", border: "1px solid rgba(200,150,62,0.3)" },
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
          color: "var(--sgs-primary, #1B3A5C)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      <div
        className={center ? "mx-auto" : ""}
        style={{ width: "48px", height: "3px", background: "#C8963E", borderRadius: "2px", marginTop: "10px", marginBottom: subtitle ? "12px" : 0 }}
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
      className="relative flex flex-col justify-center overflow-hidden"
      style={{
        minHeight: "88vh",
        paddingTop: "80px",
        background: "linear-gradient(175deg, #0A1E33 0%, #0F2740 45%, #1B3A5C 80%, rgba(200,150,62,0.18) 100%)",
      }}
    >
      {/* City silhouette */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none" style={{ height: "180px" }}>
        <svg viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", opacity: 0.10 }}>
          <path d="M0,180 L0,120 L40,120 L40,90 L60,90 L60,120 L80,120 L80,70 L100,70 L100,55 L120,55 L120,70 L140,70 L140,120 L160,120 L160,80 L180,80 L180,45 L190,45 L190,25 L200,25 L200,45 L210,45 L210,80 L240,80 L240,100 L260,100 L260,60 L280,60 L280,35 L300,35 L300,18 L310,18 L310,8 L320,8 L320,18 L330,18 L330,35 L360,35 L360,60 L380,60 L380,95 L400,95 L400,70 L420,70 L420,45 L440,45 L440,70 L460,70 L460,95 L480,95 L480,120 L500,120 L500,90 L520,90 L520,62 L540,62 L540,90 L560,90 L560,115 L580,115 L580,78 L600,78 L600,52 L620,52 L620,35 L640,35 L640,52 L660,52 L660,78 L680,78 L680,108 L720,108 L720,135 L760,135 L760,108 L780,108 L780,80 L800,80 L800,62 L820,62 L820,80 L840,80 L840,108 L860,108 L860,80 L880,80 L880,52 L900,52 L900,35 L920,35 L920,52 L940,52 L940,80 L960,80 L960,108 L1000,108 L1000,80 L1020,80 L1020,62 L1040,62 L1040,45 L1060,45 L1060,62 L1080,62 L1080,80 L1100,80 L1100,108 L1120,108 L1120,70 L1140,70 L1140,45 L1160,45 L1160,25 L1180,25 L1180,45 L1200,45 L1200,70 L1240,70 L1240,98 L1260,98 L1260,70 L1280,70 L1280,90 L1300,90 L1300,118 L1320,118 L1320,98 L1340,98 L1340,120 L1360,120 L1360,100 L1400,100 L1400,120 L1440,120 L1440,180 Z"
            fill="#C8963E"/>
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: "rgba(200,150,62,0.15)", border: "1px solid rgba(200,150,62,0.4)", color: "#D4A855" }}
        >
          <Award className="w-3.5 h-3.5" />
          Đại lý F1 uỷ quyền — Novaland · Masterise · Nam Long · Vinhomes
        </div>

        {/* Kinetic headline */}
        <h1
          id="seo-h1"
          className="mb-5"
          style={{
            fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
            fontWeight: 600,
            fontSize: "clamp(2rem, 5vw, 3.8rem)",
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
          className="text-base sm:text-lg max-w-lg mb-10"
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
              className="text-xs font-semibold mb-3"
              style={{ color: "#8C6420" }}
            >
              {lang === "vi"
                ? "Hỏi AI — mô tả nhu cầu bằng ngôn ngữ tự nhiên"
                : "Ask AI — describe your needs in natural language"}
            </p>
            <form onSubmit={submit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  id="sgs-search"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={PLACEHOLDERS[phIdx]}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "var(--sgs-subtle-bg, #F8F9FB)",
                    border: "1.5px solid rgba(27,58,92,0.1)",
                    color: "var(--sgs-text, #16202B)",
                    caretColor: "#C8963E",
                    fontFamily: "var(--font-be-vietnam, sans-serif)",
                  }}
                  onFocus={e => (e.currentTarget.style.border = "1.5px solid rgba(200,150,62,0.6)")}
                  onBlur={e  => (e.currentTarget.style.border = "1.5px solid rgba(27,58,92,0.1)")}
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                style={{ background: "#C8963E", color: "#0F2740" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
                onMouseLeave={e => (e.currentTarget.style.background = "#C8963E")}
              >
                {lang === "vi" ? "Hỏi ngay" : "Search"}
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_CHIPS.map(c => (
                <button
                  key={c}
                  onClick={() => chip(c)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: "#F5EAD5", color: "var(--sgs-text-heading, #1B3A5C)",
                    border: "1px solid rgba(200,150,62,0.25)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#EAD5B0")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#F5EAD5")}
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
          color: "var(--sgs-primary, #1B3A5C)",
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 divide-x divide-slate-100">
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
      className="overflow-hidden"
      style={{
        background: "#0F2740",
        borderTop: "1px solid rgba(200,150,62,0.15)",
        borderBottom: "1px solid rgba(200,150,62,0.15)",
        padding: "9px 0",
      }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker-scroll 55s linear infinite" }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-sm px-8"
            style={{
              color: "#B9C6D4",
              fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
            }}
          >
            <span style={{ color: "#C8963E", fontSize: "8px" }}>●</span>
            <span style={{ color: "#1E7F5C", fontWeight: 600 }}>✓</span>
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
    <a
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
        style={{ aspectRatio: "16/9", background: "linear-gradient(135deg, #0F2740, #1B3A5C)" }}
      >
        <img           src={proj.img} alt={proj.name}  loading="lazy"
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
        <span className="text-xs font-medium mb-1" style={{ color: "#8C6420" }}>{proj.type}</span>
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
            style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}
          >
            Xem <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </a>
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
          <a
            href="/du-an"
            className="flex items-center gap-1 text-sm font-semibold shrink-0 mb-2"
            style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}
          >
            {lang === "vi" ? "Xem tất cả" : "View all"} <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: filter === tab.id ? "#1B3A5C" : "var(--sgs-surface, #FFFFFF)",
                color: filter === tab.id ? "#FFFFFF" : "#1B3A5C",
                border: filter === tab.id ? "1px solid #1B3A5C" : "1px solid rgba(27,58,92,0.18)",
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
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#1E7F5C" }} />
                  <span className="text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/ai-valuation"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#C8963E", color: "#0F2740" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
              onMouseLeave={e => (e.currentTarget.style.background = "#C8963E")}
            >
              <Sparkles className="w-4 h-4" />
              {lang === "vi" ? "Định giá ngay — Miễn phí" : "Valuate for Free"}
              <ArrowRight className="w-4 h-4" />
            </a>
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
              <span className="text-sm font-semibold" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}>Kết quả định giá AI</span>
              <span
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(30,127,92,0.1)", color: "#1E7F5C" }}
              >
                <CheckCircle className="w-3 h-3" /> ±4.8%
              </span>
            </div>
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.7)" }}>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}>Vinhomes Grand Park 2PN · 65m²</p>
              <p className="text-xs" style={{ color: "#5C6B7A" }}>TP Thủ Đức · Tầng 15 · Hướng Đông Nam</p>
            </div>
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2" style={{ color: "#5C6B7A" }}>
                <span>2,85 tỷ</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "#8C6420", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  3,18 tỷ ★
                </span>
                <span>3,45 tỷ</span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: "#E2E8F0" }}>
                <div
                  className="absolute top-0 left-[22%] right-[22%] h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, rgba(200,150,62,0.25), #C8963E, rgba(200,150,62,0.25))" }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
                  style={{ left: "calc(50% - 8px)", background: "#C8963E", boxShadow: "0 2px 6px rgba(200,150,62,0.5)" }}
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
                  <span className="text-xs shrink-0 w-36" style={{ color: "#5C6B7A" }}>{f.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E2E8F0" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${f.score}%`, background: f.score > 85 ? "#1E7F5C" : "#C8963E" }}
                    />
                  </div>
                  <span
                    className="text-xs w-7 text-right font-medium"
                    style={{ color: "var(--sgs-text-heading, #1B3A5C)", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
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
              background: "linear-gradient(145deg, #0F2740, #1B3A5C)",
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
            <p className="text-sm mb-5" style={{ color: "#93A6B8" }}>
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
              <p className="text-[11px]" style={{ color: "#93A6B8" }}>Thị trường BĐS Đông Nam Bộ Q2/2026</p>
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
              <Shield className="w-5 h-5" style={{ color: "#1E7F5C" }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1.5"
                style={{ color: "var(--sgs-text-heading, #1B3A5C)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                Pháp lý 2 lớp độc lập
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "#5C6B7A" }}>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#1E7F5C" }} />
                  AI: Quy hoạch 1/2000 + sổ đỏ
                </span>
                <span style={{ color: "#CBD5E1" }}>→</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#1E7F5C" }} />
                  Chuyên viên: Xác nhận thực địa
                </span>
              </div>
            </div>
          </div>

          {/* Free for buyers */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "#F5EAD5", border: "1px solid rgba(200,150,62,0.2)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(200,150,62,0.15)" }}>
              <Heart className="w-5 h-5" style={{ color: "#8C6420" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}>
              {lang === "vi" ? "Miễn phí 100%" : "100% Free"}
            </h3>
            <p className="text-sm" style={{ color: "#5C6B7A" }}>
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
              <Landmark className="w-5 h-5" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}>
              {lang === "vi" ? "Vay ưu đãi 12+ NH" : "12+ Bank Partners"}
            </h3>
            <p
              className="text-sm tabular-nums"
              style={{
                color: "#5C6B7A",
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
                background: "var(--sgs-subtle-bg, #F8F9FB)", border: "1px solid rgba(27,58,92,0.1)",
                opacity: 0.72, minWidth: "130px",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.72")}
            >
              <span className="font-bold text-sm" style={{ color: "var(--sgs-text-heading, #1B3A5C)", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                {p}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonial card */}
        <div
          className="rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start"
          style={{ background: "var(--sgs-subtle-bg, #F8F9FB)", border: "1px solid rgba(27,58,92,0.08)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: "#1B3A5C", color: "#FFFFFF" }}
          >
            NH
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: "#C8963E" }} />
                ))}
              </div>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(30,127,92,0.1)", color: "#1E7F5C" }}
              >
                Giao dịch đã xác minh
              </span>
            </div>
            <blockquote className="text-sm leading-relaxed mb-3" style={{ color: "var(--sgs-text, #16202B)" }}>
              "Mua biệt thự Aqua City qua SGS LAND tháng 1/2026. Đội tư vấn giải thích rõ chính sách thanh toán, hỗ trợ vay BIDV và kiểm tra pháp lý miễn phí. Quá trình từ đặt cọc đến ký hợp đồng chỉ 5 ngày làm việc."
            </blockquote>
            <p className="text-sm font-semibold" style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}>Anh Nguyễn Văn Hải</p>
            <p className="text-xs" style={{ color: "#5C6B7A" }}>Khách hàng mua Aqua City · TP.HCM, tháng 1/2026</p>
          </div>
        </div>

        {/* Micro-trust bar */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8"
          style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
        >
          {[
            { icon: <Award className="w-5 h-5" />,    label: lang === "vi" ? "GPKD số 0312960439 · TP.HCM"  : "Business Reg. 0312960439 · HCMC" },
            { icon: <Building2 className="w-5 h-5" />, label: lang === "vi" ? "Thành lập từ năm 2018"         : "Established since 2018"           },
            { icon: <Clock className="w-5 h-5" />,    label: lang === "vi" ? "Hotline phản hồi < 15 phút"    : "Hotline response < 15 minutes"    },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, #1B3A5C)" }}>
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
          style={{ color: open ? "#C8963E" : "#5C6B7A", transform: open ? "rotate(180deg)" : "rotate(0)" }}
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
          <div className="space-y-3">
            {FAQ_ITEMS.slice(half).map((item, i) => (
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
        background: "linear-gradient(135deg, #0A1E33 0%, #0F2740 60%, #1B3A5C 100%)",
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
        <p className="text-base mb-8" style={{ color: "#93A6B8" }}>
          {lang === "vi"
            ? "Đội chuyên viên SGS LAND sẵn sàng hỗ trợ — định giá, pháp lý, vay vốn, đặt lịch tham quan dự án"
            : "SGS LAND specialists ready to help — valuation, legal, financing, project visits"}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="tel:+84971132378"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center"
            style={{ background: "#C8963E", color: "#0F2740" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
            onMouseLeave={e => (e.currentTarget.style.background = "#C8963E")}
          >
            <Phone className="w-4 h-4" />
            Hotline +84 971 132 378
          </a>
          <a
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
          </a>
        </div>
      </div>
    </section>
  );
}


function PublicHeader() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [theme, setTheme]         = useState<Theme>("light");
  const [lang, setLang]           = useState<Lang>("vi");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("sgs-theme") as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      const savedLang = localStorage.getItem("sgs-lang") as Lang | null;
      if (savedLang === "vi" || savedLang === "en") setLang(savedLang);
    } catch {}
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.classList.toggle("light", theme === "light");
    try { localStorage.setItem("sgs-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleLang = () => {
    const next: Lang = lang === "vi" ? "en" : "vi";
    setLang(next);
    try { localStorage.setItem("sgs-lang", next); } catch {}
    window.dispatchEvent(new CustomEvent("sgs-lang-change", { detail: next }));
  };

  const navLinks = [
    { href: "/du-an",                vi: "Dự Án",        en: "Projects"     },
    { href: "/ai-valuation",         vi: "Định Giá AI",  en: "AI Valuation" },
    { href: "/marketplace?type=ban", vi: "Mua",          en: "Buy"          },
    { href: "/marketplace?type=thue",vi: "Thuê",         en: "Rent"         },
    { href: "/news",                 vi: "Tin Tức",      en: "News"         },
    { href: "/contact",              vi: "Liên Hệ",      en: "Contact"      },
  ];

  const isHero = !scrolled;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:      isHero ? "transparent" : theme === "dark" ? "rgba(9,21,35,0.95)" : "rgba(255,255,255,0.93)",
        backdropFilter:  isHero ? "none"        : "blur(14px)",
        WebkitBackdropFilter: isHero ? "none"   : "blur(14px)",
        borderBottom:    isHero ? "none"        : theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(27,58,92,0.12)",
        boxShadow:       isHero ? "none"        : "0 1px 20px rgba(15,39,64,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "64px" }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/logo.svg"
              alt="SGS Land"
              className="w-9 h-9 rounded-xl transition-transform group-hover:scale-105"
              style={{ objectFit: "contain" }}
            />
            <div>
              <div
                className="font-bold text-lg leading-tight"
                style={{
                  color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "#1B3A5C",
                  fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                SGS <span style={{ color: "#C8963E" }}>LAND</span>
              </div>
              <div
                className="text-[9px] font-semibold uppercase hidden sm:block"
                style={{
                  color: isHero ? "rgba(200,150,62,0.85)" : theme === "dark" ? "#C8963E" : "#8C6420",
                  letterSpacing: "0.2em",
                }}
              >
                Proptech
              </div>
            </div>
          </a>

          {/* ── Desktop Nav ───────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isHero ? "rgba(255,255,255,0.85)" : theme === "dark" ? "#B0CDE0" : "#1B3A5C",
                  fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isHero ? "rgba(255,255,255,0.1)" : theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(27,58,92,0.06)";
                  el.style.color = isHero ? "#FFFFFF" : theme === "dark" ? "#FFFFFF" : "#0F2740";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = isHero ? "rgba(255,255,255,0.85)" : theme === "dark" ? "#B0CDE0" : "#1B3A5C";
                }}
              >
                {lang === "vi" ? link.vi : link.en}
              </a>
            ))}
          </nav>

          {/* ── Right Controls ─────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {/* VI/EN Toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "#1B3A5C",
              }}
              aria-label="Chuyển ngôn ngữ VI / EN"
            >
              {lang.toUpperCase()}
            </button>

            {/* Light / Dark Toggle */}
            <button
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "#1B3A5C",
              }}
              aria-label="Chuyển chế độ sáng / tối"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Login — ghost outline */}
            <a
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1.5px solid ${isHero ? "rgba(255,255,255,0.45)" : theme === "dark" ? "rgba(255,255,255,0.3)" : "#1B3A5C"}`,
                color: isHero ? "rgba(255,255,255,0.92)" : theme === "dark" ? "#E4EDF5" : "#1B3A5C",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {lang === "vi" ? "Đăng nhập" : "Sign in"}
            </a>

            {/* CTA — Gold */}
            <a
              href="/ai-valuation"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "#C8963E",
                color: "#0F2740",
                boxShadow: "0 2px 8px rgba(200,150,62,0.35)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#D9A94E"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#C8963E"}
            >
              {lang === "vi" ? "Định giá miễn phí" : "Free Valuation"}
            </a>
          </div>

          {/* ── Mobile Hamburger ──────────────────────────── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: isHero ? "#FFFFFF" : theme === "dark" ? "#C8D8E8" : "#1B3A5C" }}
            aria-label="Mở menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu Drawer ─────────────────────────────── */}
      {menuOpen && (
        <div
          className="lg:hidden"
          style={{
            background: theme === "dark" ? "rgba(9,21,35,0.97)" : "rgba(255,255,255,0.97)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(27,58,92,0.1)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                style={{ color: "var(--sgs-text-heading, #1B3A5C)" }}
              >
                {lang === "vi" ? link.vi : link.en}
              </a>
            ))}
            <div
              className="pt-3 flex gap-2"
              style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
            >
              <button
                onClick={toggleLang}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, #1B3A5C)" }}
                aria-label="Chuyển ngôn ngữ"
              >
                <Globe className="w-3.5 h-3.5" /> {lang.toUpperCase()}
              </button>
              <button
                onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, #1B3A5C)" }}
                aria-label="Chuyển chế độ sáng tối"
              >
                {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {theme === "light" ? "Tối" : "Sáng"}
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ border: `1.5px solid var(--sgs-text-heading, #1B3A5C)`, color: "var(--sgs-text-heading, #1B3A5C)" }}
              >
                {lang === "vi" ? "Đăng nhập" : "Sign in"}
              </a>
              <a
                href="/ai-valuation"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: "#C8963E", color: "#0F2740" }}
              >
                Định Giá AI
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

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

function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "#0F2740", borderTop: "1px solid rgba(200,150,62,0.2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">

        {/* ── 4-column grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Col 1 — Brand + contact ────────────────────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#C8963E" }}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5" style={{ color: "#0F2740" }}>
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

            <p className="text-sm leading-relaxed mb-5" style={{ color: "#93A6B8" }}>
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
                <Phone className="w-4 h-4 shrink-0" style={{ color: "#C8963E" }} />
                0971 132 378
              </a>
              <a
                href="mailto:info@sgsland.vn"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => linkHover(e, false)}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: "#C8963E" }} />
                info@sgsland.vn
              </a>
              <div className="flex items-start gap-2.5 text-sm" style={{ color: "#B9C6D4" }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#C8963E" }} />
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
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </a>
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
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </a>
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
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div
              className="space-y-1 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs" style={{ color: "#93A6B8" }}>GPKD: 0312960439</p>
              <p className="text-xs" style={{ color: "#93A6B8" }}>Cấp ngày: 01/01/2018 tại TP.HCM</p>
              <p className="text-xs" style={{ color: "#93A6B8" }}>MST: 0312960439</p>
              <p className="text-xs" style={{ color: "#93A6B8" }}>API: <a href="/developers" style={{ color: "#B9C6D4" }}>developers</a></p>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
          <p className="text-xs" style={{ color: "#93A6B8" }}>
            © {year} Công ty TNHH SGS Land. GPKD số: 0312960439 | Đại lý F1: Novaland · Masterise Homes · Nam Long · Vinhomes.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs transition-colors"
                style={{ color: "#93A6B8" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#93A6B8"}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}


function Landing({ featuredListings, stats }: Props) {
  
  const [lang, setLang] = useState<Lang>("vi");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");

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
    setChatQuery(q.trim());
    setChatOpen(true);
  };

  return (
    <div className="flex flex-col overflow-x-hidden">
      <PublicHeader />
      <HeroSection   onSearch={handleSearch} lang={lang} />
      <StatsBar      lang={lang} />
      <LegalTicker />
      <ProjectsSection  lang={lang} />
      <ValuationSection lang={lang} />
      <BentoSection     lang={lang} />
      <TrustBlock       lang={lang} />
      <FAQSection       lang={lang} />
      <CTABanner        lang={lang} />
      <PublicFooter />

      {/* ── Floating AI Chat Button ───────────────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #1B3A5C 0%, #0F2740 100%)",
          color: "#FFFFFF",
          boxShadow: "0 8px 32px rgba(15,39,64,0.45), 0 2px 8px rgba(200,150,62,0.25)",
          display: chatOpen ? "none" : "flex",
        }}
        aria-label="Mở chat AI"
      >
        <Bot className="w-5 h-5" style={{ color: "#C8963E" }} />
        <span>{lang === "vi" ? "Chat AI" : "AI Chat"}</span>
        <span
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.7)" }}
        />
      </button>

      {/* ── AI Chat Widget ────────────────────────────────────────── */}
      <AiChatWidget isOpen={chatOpen} onClose={() => setChatOpen(false)} initialQuery={chatQuery} />
    </div>
  );
}

export default Landing;
