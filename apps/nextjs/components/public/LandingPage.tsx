"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Search, Sparkles, BarChart3, Globe2, Zap,
  ChevronRight, Phone, MapPin, Scale, Building2, Bot,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────
interface FeaturedProject {
  slug: string;
  name: string;
  dev: string;
  loc: string;
  scale: string;
  priceFrom: string;
  type: string;
  badge: string;
  badgeColor: "emerald" | "indigo" | "amber";
  img: string;
}

import type { Listing } from "@/types";

interface Props {
  featuredListings: Listing[];
  stats: { totalListings: number; totalProjects: number; totalBrokers: number };
}

// ─── Static Data ──────────────────────────────────────────
const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    slug: "aqua-city",
    name: "Aqua City Novaland",
    dev: "Novaland",
    loc: "Biên Hòa, Đồng Nai",
    scale: "1.000 ha",
    priceFrom: "Từ 6,5 tỷ",
    type: "Đại Đô Thị Sinh Thái",
    badge: "Đang bàn giao",
    badgeColor: "emerald",
    img: "/landing/aqua-city/hero-opt.jpg",
  },
  {
    slug: "the-global-city",
    name: "The Global City",
    dev: "Masterise Homes",
    loc: "An Phú, TP Thủ Đức",
    scale: "117 ha",
    priceFrom: "Từ 15 tỷ",
    type: "Đại Đô Thị Thương Mại",
    badge: "Đang mở bán",
    badgeColor: "indigo",
    img: "/images/projects/the-global-city.webp",
  },
  {
    slug: "izumi-city",
    name: "Izumi City Nam Long",
    dev: "Nam Long Group",
    loc: "Biên Hòa, Đồng Nai",
    scale: "170 ha",
    priceFrom: "Từ 8,4 tỷ",
    type: "Đô Thị Chuẩn Nhật",
    badge: "Đang mở bán",
    badgeColor: "indigo",
    img: "/images/projects/izumi-city.webp",
  },
  {
    slug: "mcc",
    name: "Masteri Cosmo Central",
    dev: "Masterise Homes",
    loc: "Đỗ Xuân Hợp, Thủ Đức",
    scale: "20 căn",
    priceFrom: "Từ 6,43 tỷ",
    type: "Căn Hộ Cao Cấp",
    badge: "Còn hàng",
    badgeColor: "emerald",
    img: "/landing/masteri-cosmo-central/hero.jpg",
  },
  {
    slug: "vinhomes-hoc-mon",
    name: "Vinhomes Hóc Môn",
    dev: "Vinhomes",
    loc: "Hóc Môn, TP.HCM",
    scale: "200 ha",
    priceFrom: "Từ 3,5 tỷ",
    type: "Đô Thị Vệ Tinh",
    badge: "Sắp mở bán",
    badgeColor: "amber",
    img: "/landing/vinhomes-hoc-mon/hero.jpg",
  },
  {
    slug: "legacy-66",
    name: "Legacy 66",
    dev: "Trần Anh Group",
    loc: "Long An",
    scale: "30 ha",
    priceFrom: "Từ 2,1 tỷ",
    type: "Nhà Phố Thương Mại",
    badge: "Đang mở bán",
    badgeColor: "indigo",
    img: "/landing/legacy-66/hero.jpg",
  },
];

const STATS = [
  { value: "45.000+", label: "Sản phẩm BĐS" },
  { value: "15.000+", label: "Môi giới & CTV" },
  { value: "2 tỷ USD+", label: "Giá trị giao dịch" },
  { value: "4.8/5 ⭐", label: "Đánh giá khách hàng" },
];

const SEO_AREAS = [
  { name: "BĐS Đồng Nai", href: "/bat-dong-san-dong-nai", count: "12.500+" },
  { name: "BĐS Long Thành", href: "/bat-dong-san-long-thanh", count: "3.200+" },
  { name: "BĐS Thủ Đức", href: "/bat-dong-san-thu-duc", count: "8.700+" },
  { name: "BĐS Bình Dương", href: "/bat-dong-san-binh-duong", count: "6.400+" },
  { name: "BĐS Quận 7", href: "/bat-dong-san-quan-7", count: "4.100+" },
  { name: "BĐS Phú Nhuận", href: "/bat-dong-san-phu-nhuan", count: "2.300+" },
];

const BADGE_COLORS = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  indigo:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

// ─── Landing Page ─────────────────────────────────────────
export function LandingPage({ featuredListings, stats }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/marketplace");
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32"
        style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 50%, #F0FDF4 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6"
              style={{ background: "var(--primary-subtle)", color: "var(--primary-600)", border: "1px solid var(--primary-600)20" }}>
              <Sparkles className="w-4 h-4" />
              Nền tảng BĐS AI số 1 Việt Nam 2025
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{ color: "var(--text-primary)" }}>
              Mua bán BĐS thông minh{" "}
              <span style={{ color: "var(--primary-600)" }}>cùng AI</span>
            </h1>

            <p className="text-lg sm:text-xl mb-10 max-w-2xl leading-relaxed"
              style={{ color: "var(--text-secondary)" }}>
              Định giá tự động, pháp lý minh bạch, CRM đa kênh. Kết nối 15.000+ môi giới và
              45.000+ sản phẩm BĐS tại TP.HCM, Đồng Nai, Bình Dương.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: "var(--text-tertiary)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm BĐS, dự án, khu vực..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl text-sm outline-none shadow-token-md transition-all focus:ring-2 focus:ring-indigo-500/30"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1.5px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-4 rounded-2xl text-sm font-semibold text-white shadow-token-md transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                style={{ background: "var(--primary-600)" }}
              >
                Tìm kiếm
              </button>
            </form>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-4">
              {["Căn hộ Thủ Đức", "Nhà phố Đồng Nai", "Đất Long Thành", "Aqua City"].map((q) => (
                <button
                  key={q}
                  onClick={() => router.push(`/marketplace?q=${encodeURIComponent(q)}`)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────── */}
      <section className="py-10 border-y" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>{s.value}</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PROJECTS ────────────────────────────── */}
      <section className="py-20" style={{ background: "var(--bg-app)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Dự án nổi bật
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>Đại lý phân phối uỷ quyền chính thức</p>
            </div>
            <Link href="/du-an" className="flex items-center gap-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: "var(--primary-600)" }}>
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_PROJECTS.map((proj) => (
              <Link
                key={proj.slug}
                href={proj.slug === "mcc" ? `/p/${proj.slug}` : `/du-an/${proj.slug}`}
                className="group rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-token-lg"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                {/* Project image */}
                <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/20">
                  <Image
                    src={proj.img}
                    alt={proj.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback: hide broken image, show gradient behind
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_COLORS[proj.badgeColor]}`}>
                    {proj.badge}
                  </span>
                </div>

                <div className="p-4">
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--primary-600)" }}>{proj.type}</p>
                  <h3 className="font-bold text-base mb-1 group-hover:text-indigo-600 transition-colors"
                    style={{ color: "var(--text-primary)" }}>{proj.name}</h3>
                  <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                    {proj.dev} · {proj.loc}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Quy mô {proj.scale}</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--primary-600)" }}>{proj.priceFrom}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1"
                      style={{ color: "var(--text-tertiary)" }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI FEATURES ──────────────────────────────────── */}
      <section className="py-20" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Công nghệ AI đồng hành
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Định giá chính xác ±4.8%, pháp lý minh bạch 2 lớp, thị trường cập nhật realtime
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Sparkles className="w-6 h-6" />, title: "Định giá AI tự động", desc: "SGS-AVM v2.1 — 9 hệ số, MAPE ±4.8%, chuẩn TĐGVN/IVS. Kết quả tức thì, minh bạch từng yếu tố.", href: "/ai-valuation", cta: "Định giá ngay" },
              { icon: <Scale className="w-6 h-6" />, title: "Pháp lý 2 lớp", desc: "Kiểm tra sổ hồng, quy hoạch, Luật Đất Đai 2024, KDBĐS 2023. AI sơ thẩm + chuyên viên xác nhận.", href: "/marketplace", cta: "Xem BĐS pháp lý rõ" },
              { icon: <BarChart3 className="w-6 h-6" />, title: "Thị trường realtime", desc: "Chỉ số giá Đông Nam Bộ — TP.HCM, Đồng Nai, Bình Dương. Dữ liệu 9 quý, phân tích ROI 5-10 năm.", href: "/marketplace", cta: "Phân tích thị trường" },
            ].map((f) => (
              <div key={f.title} className="group p-6 rounded-2xl transition-all hover:shadow-token-md"
                style={{ background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                <Link href={f.href}
                  className="flex items-center gap-1 text-sm font-semibold transition-colors"
                  style={{ color: "var(--primary-600)" }}>
                  {f.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO AREA GRID ────────────────────────────────── */}
      <section className="py-16" style={{ background: "var(--bg-app)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8" style={{ color: "var(--text-primary)" }}>
            BĐS theo khu vực
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {SEO_AREAS.map((area) => (
              <Link key={area.href} href={area.href}
                className="flex flex-col items-center p-4 rounded-2xl text-center transition-all hover:-translate-y-1 hover:shadow-token-md"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <MapPin className="w-6 h-6 mb-2" style={{ color: "var(--primary-600)" }} />
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{area.name}</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{area.count} BĐS</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────── */}
      <section className="py-20" style={{ background: "var(--primary-600)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Bắt đầu với SGS LAND ngay hôm nay
          </h2>
          <p className="text-white/80 mb-8 text-lg max-w-xl mx-auto">
            Nền tảng CRM & phân phối BĐS thế hệ mới — miễn phí cho môi giới cá nhân
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login"
              className="px-8 py-4 bg-white rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ color: "var(--primary-600)" }}>
              Dùng miễn phí ngay
            </Link>
            <a href="tel:+84971132378"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold text-white transition-all hover:bg-white/10 border border-white/30">
              <Phone className="w-4 h-4" />
              Tư vấn: 0971 132 378
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
