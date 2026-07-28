// @ts-nocheck
"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Search, MapPin, Bed, ChevronLeft, ChevronRight, ChevronDown, Check,
  LayoutGrid, List as ListIcon, Columns, Map as MapIcon, BadgeCheck, Eye, Heart,
} from "lucide-react";
import type { Listing } from "@/types";

const MarketplaceMap = dynamic(() => import("./MarketplaceMap").then((m) => m.MarketplaceMap), {
  ssr: false,
  loading: () => <div className="w-full rounded-2xl flex items-center justify-center" style={{ height: 620, background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}>Đang tải bản đồ…</div>,
});

interface Props {
  initialListings: Listing[];
  totalCount: number;
  totalPages: number;
  searchParams: {
    q?: string; type?: string; area?: string; minPrice?: string;
    maxPrice?: string; bedrooms?: string; page?: string; transaction?: string;
  };
}

const TRANSACTION_OPTIONS = [
  { label: "Tất cả giao dịch", value: "" }, { label: "Bán", value: "SALE" }, { label: "Cho thuê", value: "RENT" },
];
const TYPE_OPTIONS = [
  { label: "Tất cả loại hình", value: "" }, { label: "Căn hộ", value: "Apartment" }, { label: "Biệt thự", value: "Villa" },
  { label: "Nhà phố", value: "Townhouse" }, { label: "Đất nền", value: "Land" }, { label: "Thương mại", value: "Commercial" }, { label: "Văn phòng", value: "Office" },
];
const LOCATION_OPTIONS = [
  { label: "Tất cả vị trí", value: "" }, { label: "Đồng Nai", value: "Đồng Nai" }, { label: "TP.HCM", value: "TP.HCM" },
  { label: "Bình Dương", value: "Bình Dương" }, { label: "Long An", value: "Long An" }, { label: "Bà Rịa - Vũng Tàu", value: "Bà Rịa" },
];
const PRICE_OPTIONS = [
  { label: "Tất cả mức giá", min: "", max: "" }, { label: "Dưới 3 tỷ", min: "", max: "3" }, { label: "3 – 5 tỷ", min: "3", max: "5" },
  { label: "5 – 10 tỷ", min: "5", max: "10" }, { label: "10 – 20 tỷ", min: "10", max: "20" }, { label: "Trên 20 tỷ", min: "20", max: "" },
];
const LOCATION_CHIPS = [
  { label: "BĐS Đồng Nai", href: "/bat-dong-san-dong-nai" }, { label: "BĐS Long Thành", href: "/bat-dong-san-long-thanh" },
  { label: "BĐS Thủ Đức", href: "/bat-dong-san-thu-duc" }, { label: "BĐS Bình Dương", href: "/bat-dong-san-binh-duong" },
  { label: "BĐS Quận 7", href: "/bat-dong-san-quan-7" }, { label: "BĐS Phú Nhuận", href: "/bat-dong-san-phu-nhuan" },
  { label: "BĐS Bình Chánh", href: "/bat-dong-san-binh-chanh" }, { label: "Aqua City", href: "/du-an/aqua-city" },
  { label: "Vinhomes Grand Park", href: "/du-an/vinhomes-grand-park" }, { label: "Izumi City", href: "/du-an/izumi-city" },
  { label: "The Global City", href: "/du-an/the-global-city" }, { label: "Thủ Thiêm", href: "/du-an/thu-thiem" },
];
const TYPE_LABELS = { Apartment: "Căn hộ", Villa: "Biệt thự", Townhouse: "Nhà phố", Land: "Đất nền", Commercial: "Thương mại", Office: "Văn phòng", PROJECT: "Dự án" };

function formatPrice(price: number): string {
  return price >= 1e9 ? `${(price / 1e9).toFixed(2)} tỷ` : `${Math.round(price / 1e6)} triệu`;
}
function pricePerM2(price: number, area: number): string | null {
  if (!area || area <= 0) return null;
  const v = price / area;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ/m²`;
  return `${(v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} Triệu/m²`;
}

const boxStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" };

/* ── Custom dropdown component ────────────────────────────── */
function Dropdown({ value, options, onChange, minWidth = 140 }: { value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; minWidth?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div ref={ref} className="relative shrink-0" style={{ minWidth }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors"
        style={boxStyle}>
        <span className="truncate">{current.label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-tertiary)" }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full rounded-xl shadow-2xl overflow-hidden py-1"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-2 hover:opacity-80 transition-colors"
              style={{ color: o.value === value ? "var(--primary-600)" : "var(--text-secondary)", background: o.value === value ? "var(--primary-subtle)" : "transparent" }}>
              {o.label}
              {o.value === value && <Check className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Listing card ─────────────────────────────────────────── */
function ListingCard({ listing, list }: { listing: any; list?: boolean }) {
  const slug = `${(listing.title || "bds").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${listing.id}`;
  const isRent = String(listing.transaction || "").toUpperCase() === "RENT";
  const ppm = pricePerM2(listing.price, listing.area);
  const views = listing.viewCount || 0;
  return (
    <Link href={`/bds/${slug}`}
      className={`group block rounded-3xl overflow-hidden hover:shadow-token-lg transition-all hover:-translate-y-1 ${list ? "sm:flex" : ""}`}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      {/* Image */}
      <div className={`relative overflow-hidden ${list ? "sm:w-72 h-52 sm:h-auto shrink-0" : "aspect-[4/3]"}`} style={{ background: "var(--bg-elevated)" }}>
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏢</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        {/* Badges top-left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <div className="flex gap-1.5">
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: isRent ? "rgba(37,99,235,0.9)" : "rgba(11,107,84,0.92)" }}>
              {isRent ? "CHO THUÊ" : "BÁN"}
            </span>
            {listing.isVerified && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: "rgba(5,150,105,0.95)" }}>
                <BadgeCheck className="w-3.5 h-3.5" /> ĐÃ XÁC THỰC
              </span>
            )}
          </div>
          {views > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }}>
              <Eye className="w-3.5 h-3.5" /> {views}
            </span>
          )}
        </div>
        {/* Heart top-right */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/25 backdrop-blur-sm">
          <Heart className="w-4 h-4 text-white" />
        </div>
      </div>
      {/* Body */}
      <div className="p-4 flex-1">
        <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-snug group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>
          {listing.title}
        </h3>
        <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{listing.location}</span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-extrabold text-lg leading-none" style={{ color: "var(--primary-600)" }}>{formatPrice(listing.price)}</p>
            {ppm && <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>{ppm}</p>}
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
            {listing.area ? <span>{listing.area}m²</span> : null}
            {listing.bedrooms ? <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{listing.bedrooms}PN</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketplacePage({ initialListings, totalCount, totalPages, searchParams: sp }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(sp.q ?? "");
  const [view, setView] = useState<"GRID" | "LIST" | "BOARD" | "MAP">("GRID");

  const pushParams = useCallback((mut: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.type) params.set("type", sp.type);
    if (sp.area) params.set("area", sp.area);
    if (sp.minPrice) params.set("minPrice", sp.minPrice);
    if (sp.maxPrice) params.set("maxPrice", sp.maxPrice);
    if (sp.bedrooms) params.set("bedrooms", sp.bedrooms);
    if (sp.transaction) params.set("transaction", sp.transaction);
    mut(params);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [sp, pathname, router]);

  const setParam = (key: string, value: string) => pushParams((p) => { if (value) p.set(key, value); else p.delete(key); });
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setParam("q", search.trim()); };
  const currentPage = parseInt(sp.page ?? "1");
  const activePriceLabel = (PRICE_OPTIONS.find((pr) => pr.min === (sp.minPrice ?? "") && pr.max === (sp.maxPrice ?? "")) || PRICE_OPTIONS[0]).label;

  const VIEWS = [
    { id: "GRID", icon: LayoutGrid }, { id: "LIST", icon: ListIcon }, { id: "BOARD", icon: Columns }, { id: "MAP", icon: MapIcon },
  ] as const;

  // Group for board view
  const boards = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    (initialListings || []).forEach((l: any) => {
      const label = TYPE_LABELS[l.type] || "Khác";
      (groups[label] = groups[label] || []).push(l);
    });
    return Object.entries(groups);
  }, [initialListings]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-10" style={{ paddingTop: 96 }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {sp.q ? `Kết quả cho "${sp.q}"` : "Tìm kiếm Bất Động Sản"}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {totalCount.toLocaleString()} bất động sản phù hợp · Kho hàng cập nhật realtime
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên, dự án, khu vực, mã code..."
          className="w-full pl-9 pr-24 py-3 rounded-xl text-sm outline-none" style={boxStyle} />
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--primary-600)" }}>Tìm</button>
      </form>

      {/* Toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        <div className="flex p-0.5 rounded-lg shrink-0" style={{ background: "var(--bg-elevated)" }}>
          {VIEWS.map((v) => {
            const Icon = v.icon; const active = view === v.id;
            return (
              <button key={v.id} type="button" onClick={() => setView(v.id)}
                className="p-2 rounded-md transition-colors" style={active ? { background: "var(--bg-surface)", color: "var(--primary-600)" } : { color: "var(--text-tertiary)" }}>
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        <div className="w-px h-6 shrink-0" style={{ background: "var(--border-default)" }} />
        <Dropdown value={sp.transaction ?? ""} options={TRANSACTION_OPTIONS} onChange={(v) => setParam("transaction", v)} minWidth={140} />
        <Dropdown value={sp.type ?? ""} options={TYPE_OPTIONS} onChange={(v) => setParam("type", v)} minWidth={140} />
        <Dropdown value={sp.area ?? ""} options={LOCATION_OPTIONS} onChange={(v) => setParam("area", v)} minWidth={150} />
        <Dropdown value={activePriceLabel} options={PRICE_OPTIONS.map((o) => ({ label: o.label, value: o.label }))}
          onChange={(label) => { const pr = PRICE_OPTIONS.find((x) => x.label === label) || PRICE_OPTIONS[0]; pushParams((p) => { p.delete("minPrice"); p.delete("maxPrice"); if (pr.min) p.set("minPrice", pr.min); if (pr.max) p.set("maxPrice", pr.max); }); }}
          minWidth={140} />
      </div>

      {/* Location chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
        <span className="text-xs shrink-0 font-medium hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>Tất cả vị trí:</span>
        {LOCATION_CHIPS.map((c) => (
          <Link key={c.href} href={c.href} className="shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-all whitespace-nowrap hover:opacity-80"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>{c.label}</Link>
        ))}
      </div>

      {/* Content */}
      {initialListings.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Không tìm thấy kết quả</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Thử thay đổi tiêu chí tìm kiếm hoặc mở rộng khu vực</p>
        </div>
      ) : view === "MAP" ? (
        <MarketplaceMap listings={initialListings} />
      ) : view === "BOARD" ? (
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {boards.map(([label, items]) => (
            <div key={label} className="shrink-0 w-80 rounded-2xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{label}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{items.length}</span>
              </div>
              <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto no-scrollbar">
                {items.map((l: any) => <ListingCard key={l.id} listing={l} />)}
              </div>
            </div>
          ))}
        </div>
      ) : view === "LIST" ? (
        <div className="flex flex-col gap-4">
          {initialListings.map((l: any) => <ListingCard key={l.id} listing={l} list />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {initialListings.map((l: any) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}

      {/* Pagination (grid/list only) */}
      {totalPages > 1 && view !== "MAP" && view !== "BOARD" && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <Link href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.max(1, currentPage - 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium ${currentPage <= 1 ? "opacity-40 pointer-events-none" : ""}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            <ChevronLeft className="w-4 h-4" /> Trước
          </Link>
          <span className="px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>Trang {currentPage} / {totalPages}</span>
          <Link href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.min(totalPages, currentPage + 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium ${currentPage >= totalPages ? "opacity-40 pointer-events-none" : ""}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            Tiếp <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
