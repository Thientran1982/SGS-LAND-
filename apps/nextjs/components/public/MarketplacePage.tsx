// @ts-nocheck
"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
type L = "vi" | "en";
import dynamic from "next/dynamic";
import {
  Search, MapPin, Bed, ChevronLeft, ChevronRight, ChevronDown, Check,
  LayoutGrid, List as ListIcon, Columns, Map as MapIcon, BadgeCheck, Eye, Heart, Star, Camera, X, SlidersHorizontal,
} from "lucide-react";
import type { Listing } from "@/types";
import Image from "next/image";
import { formatPriceLang, formatUnitPriceLang, rentSuffix } from "@/utils/priceFormat";
import { trackEvent } from "@/lib/tracking";

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
    legalStatus?: string; direction?: string; sort?: string;
  };
  facets?: {
    topAreas: { name: string; count: number }[];
    types: { value: string; count: number }[];
    legalStatus: { value: string; count: number }[];
    direction: { value: string; count: number }[];
    priceBenchmarks: Record<string, { avgPricePerM2: number; sampleSize: number }>;
  } | null;
  locations?: string[];
}

const TRANSACTION_OPTIONS = (g: L) => [
  { label: tt(g, "Tất cả giao dịch", "All transactions"), value: "" },
  { label: tt(g, "Bán", "For sale"), value: "SALE" },
  { label: tt(g, "Cho thuê", "For rent"), value: "RENT" },
];
const TYPE_OPTIONS = (g: L) => [
  { label: tt(g, "Tất cả loại hình", "All property types"), value: "" },
  { label: tt(g, "Căn hộ", "Apartment"), value: "Apartment" },
  { label: tt(g, "Biệt thự", "Villa"), value: "Villa" },
  { label: tt(g, "Nhà phố", "Townhouse"), value: "Townhouse" },
  { label: tt(g, "Đất nền", "Land"), value: "Land" },
  { label: tt(g, "Thương mại", "Commercial"), value: "Commercial" },
  { label: tt(g, "Văn phòng", "Office"), value: "Office" },
];
const LOCATION_OPTIONS = (g: L, locs?: string[]) => [
  { label: tt(g, "Tất cả vị trí", "All locations"), value: "" },
  ...(((locs || []).length > 0) ? (locs as string[]).map((loc) => ({ label: loc, value: loc })) : []),
];
const PRICE_OPTIONS = (g: L) => [
  { label: tt(g, "Tất cả mức giá", "Any price"), min: "", max: "" },
  { label: tt(g, "Dưới 3 tỷ", "Under 3B VND"), min: "", max: "3" },
  { label: tt(g, "3 – 5 tỷ", "3 – 5B VND"), min: "3", max: "5" },
  { label: tt(g, "5 – 10 tỷ", "5 – 10B VND"), min: "5", max: "10" },
  { label: tt(g, "10 – 20 tỷ", "10 – 20B VND"), min: "10", max: "20" },
  { label: tt(g, "Trên 20 tỷ", "Over 20B VND"), min: "20", max: "" },
];
const CHIP_EN: Record<string, string> = {
  "BĐS Đồng Nai": "Dong Nai property",
  "BĐS Long Thành": "Long Thanh property",
  "BĐS Thủ Đức": "Thu Duc property",
  "BĐS Bình Dương": "Binh Duong property",
  "BĐS Quận 7": "District 7 property",
  "BĐS Phú Nhuận": "Phu Nhuan property",
  "BĐS Bình Chánh": "Binh Chanh property",
  "BĐS Long An": "Long An property",
  "BĐS Nhơn Trạch": "Nhon Trach property",
  "BĐS Bình Thạnh": "Binh Thanh property",
  "BĐS Cần Giờ": "Can Gio property",
};
const chipLabel = (label: string, g: "vi" | "en") => (g === "en" ? CHIP_EN[label] || label : label);

const LOCATION_CHIPS = [
  { label: "BĐS Đồng Nai", href: "/khu-vuc/bat-dong-san-dong-nai" }, { label: "BĐS Long Thành", href: "/bat-dong-san-long-thanh" },
  { label: "BĐS Thủ Đức", href: "/bat-dong-san-thu-duc" }, { label: "BĐS Bình Dương", href: "/bat-dong-san-binh-duong" },
  { label: "BĐS Quận 7", href: "/khu-vuc/bat-dong-san-quan-7" }, { label: "BĐS Phú Nhuận", href: "/bat-dong-san-phu-nhuan" },
  { label: "BĐS Bình Chánh", href: "/bat-dong-san-binh-chanh" }, { label: "Aqua City", href: "/du-an/aqua-city" },
  { label: "Vinhomes Grand Park", href: "/du-an/vinhomes-grand-park" }, { label: "Izumi City", href: "/du-an/izumi-city" },
  { label: "The Global City", href: "/du-an/the-global-city" }, { label: "Thủ Thiêm", href: "/du-an/thu-thiem" },
];
const TYPE_LABELS = (g: L): Record<string, string> => ({
  Apartment: tt(g, "Căn hộ", "Apartment"), Villa: tt(g, "Biệt thự", "Villa"),
  Townhouse: tt(g, "Nhà phố", "Townhouse"), Land: tt(g, "Đất nền", "Land"),
  Commercial: tt(g, "Thương mại", "Commercial"), Office: tt(g, "Văn phòng", "Office"),
  PROJECT: tt(g, "Dự án", "Project"),
});

/* Shared listing presentation helpers.
   Price formatting comes from utils/priceFormat.ts - the SAME module the CRM
   inventory card uses, so one listing now renders identically on both sides.
   Vietnamese labels are \uXXXX escapes to keep this file ASCII-safe. */
type Bi = [string, string];
const bi = (m: Record<string, Bi>, key: string, g: L): string => {
  const v = m[String(key)];
  return v ? (g === "en" ? v[1] : v[0]) : String(key || "");
};
const STATUS_LABELS: Record<string, Bi> = {
  AVAILABLE: ["\u0110ang giao d\u1ecbch", "In transaction"],
  READY: ["S\u1eb5n s\u00e0ng", "Ready"],
  BOOKING: ["Nh\u1eadn Booking", "Booking"],
  OPENING: ["\u0110ang m\u1edf b\u00e1n", "Opening"],
  BEST_MARKET: ["T\u1ed1t nh\u1ea5t th\u1ecb tr\u01b0\u1eddng", "Best in market"],
};
const LEGAL_LABELS: Record<string, Bi> = {
  PinkBook: ["S\u1ed5 H\u1ed3ng", "Pink Book"],
  Contract: ["H\u0110MB", "Sales contract"],
  Waiting: ["\u0110ang ch\u1edd s\u1ed5/Vi b\u1eb1ng", "Waiting for title"],
};
const DIRECTION_LABELS: Record<string, Bi> = {
  North: ["B\u1eafc", "North"], South: ["Nam", "South"],
  East: ["\u0110\u00f4ng", "East"], West: ["T\u00e2y", "West"],
  NorthEast: ["\u0110\u00f4ng B\u1eafc", "North East"], NorthWest: ["T\u00e2y B\u1eafc", "North West"],
  SouthEast: ["\u0110\u00f4ng Nam", "South East"], SouthWest: ["T\u00e2y Nam", "South West"],
};
const UI_LABELS: Record<string, Bi> = {
  legal: ["Ph\u00e1p l\u00fd", "Legal"],
  direction: ["H\u01b0\u1edbng", "Direction"],
  noImage: ["Ch\u01b0a c\u00f3 \u1ea3nh", "No photo"],
  save: ["L\u01b0u tin", "Save"],
  saved: ["\u0110\u00e3 l\u01b0u", "Saved"],
};
const ui = (k: string, g: L): string => bi(UI_LABELS, k, g);

/* Same thumbnail contract as components/ListingCard.tsx: round the width up to
   a multiple of 64 so both apps share the server resize cache. */
function toThumbnailUrl(src: string, width = 800): string {
  if (src.startsWith("/uploads/") && !src.includes("?")) {
    const w = Math.max(64, Math.ceil(width / 64) * 64);
    return `${src}?w=${w}`;
  }
  return src;
}

/* Anonymous visitors have no favourites API yet - persist locally so the heart
   is a real control instead of a dead icon inside the card link. */
const FAV_KEY = "sgs:favorites";
const readFavs = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};
const writeFavs = (ids: string[]) => {
  try { window.localStorage.setItem(FAV_KEY, JSON.stringify(ids.slice(0, 300))); } catch { /* quota */ }
};

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
        <div className="absolute z-50 mt-1 left-0 min-w-full rounded-xl shadow-2xl overflow-hidden"
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

function ActiveChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-xs font-medium pl-3 pr-1.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
      {label}
      <button type="button" onClick={onRemove} aria-label="remove filter" className="rounded-full p-0.5 hover:opacity-70 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/* ── Listing card ─────────────────────────────────────────── */
function ListingCard({ listing, list, eager, facets }: { listing: any; list?: boolean; eager?: boolean; facets?: { priceBenchmarks: Record<string, { avgPricePerM2: number; sampleSize: number }> } | null }) {
  const lang = useLang();
  const slug = `${(listing.title || "bds").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${listing.id}`;
  const isRent = String(listing.transaction || "").toUpperCase() === "RENT";
  const attrs = listing.attributes || {};
  const area = Number(listing.area) || 0;
  const priceText = formatPriceLang(Number(listing.price) || 0, lang);
  const ppm = area > 0 ? formatUnitPriceLang(Number(listing.price) || 0, area, lang) : "";
  const views = listing.viewCount || 0;
  const rawStatus = String(listing.status || "");
  const statusKey = rawStatus === "AVAILABLE" && isRent ? "READY" : rawStatus;
  const statusLabel = STATUS_LABELS[statusKey] ? bi(STATUS_LABELS, statusKey, lang) : "";
  const isBest = rawStatus === "BEST_MARKET";
  const legal = attrs.legalStatus ? bi(LEGAL_LABELS, String(attrs.legalStatus), lang) : "";
  const direction = attrs.direction ? bi(DIRECTION_LABELS, String(attrs.direction), lang) : "";
  const images: string[] = Array.isArray(listing.images) ? listing.images : [];
  const src = images[0] || "";
  const [imgFailed, setImgFailed] = useState(false);
  const [optFailed, setOptFailed] = useState(false);
  const [fav, setFav] = useState(false);
  useEffect(() => { setFav(readFavs().includes(listing.id)); }, [listing.id]);
  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ids = readFavs();
    const next = ids.includes(listing.id) ? ids.filter((x) => x !== listing.id) : [listing.id, ...ids];
    writeFavs(next);
    setFav(next.includes(listing.id));
  };
  // next/image only for same-origin paths (/uploads/...): a remote host that is
  // missing from next.config remotePatterns must never blank out the card.
  const optimized = src.startsWith("/") && !optFailed;
  const sizes = list ? "288px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw";
  const savedLabel = fav ? ui("saved", lang) : ui("save", lang);
  return (
    <Link href={lang === "en" ? `/en/bds/${slug}` : `/bds/${slug}`}
      className={`group block rounded-3xl overflow-hidden hover:shadow-token-lg transition-all hover:-translate-y-1 ${list ? "flex" : ""}`}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      {/* Image */}
      <div className={`relative overflow-hidden ${list ? "w-32 h-32 sm:w-72 sm:h-auto shrink-0" : "aspect-[4/3]"}`} style={{ background: "var(--bg-elevated)" }}>
        {src && !imgFailed ? (
          optimized ? (
            <Image src={src} alt={listing.title || ""} fill sizes={sizes} priority={!!eager}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setOptFailed(true)} />
          ) : (
            <img src={toThumbnailUrl(src, 800)} alt={listing.title || ""}
              loading={eager ? "eager" : "lazy"} decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgFailed(true)} />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-5xl opacity-20">{"\ud83c\udfe2"}</span>
            <span className="text-xs2" style={{ color: "var(--text-tertiary)" }}>{ui("noImage", lang)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        {/* Badges top-left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <div className="flex gap-1.5">
            <span className="px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: isRent ? "rgba(37,99,235,0.9)" : "rgba(11,107,84,0.92)" }}>
              {isRent ? tt(lang, "CHO THU\u00ca", "FOR RENT") : tt(lang, "B\u00c1N", "FOR SALE")}
            </span>
            {listing.isVerified && (
              <span title={tt(lang, "\u0110\u00c3 X\u00c1C TH\u1ef0C", "VERIFIED")} aria-label={tt(lang, "\u0110\u00c3 X\u00c1C TH\u1ef0C", "VERIFIED")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: "rgba(5,150,105,0.95)" }}>
                <BadgeCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{tt(lang, "\u0110\u00c3 X\u00c1C TH\u1ef0C", "VERIFIED")}</span>
              </span>
            )}
            {list && (
              <button type="button" onClick={toggleFav} aria-pressed={fav} aria-label={savedLabel} title={savedLabel}
                className="sm:hidden w-7 h-7 rounded-lg flex items-center justify-center bg-black/35 backdrop-blur-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Heart className={`w-3.5 h-3.5 ${fav ? "text-rose-300" : "text-white"}`} fill={fav ? "currentColor" : "none"} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {isBest && (
              <span title={bi(STATUS_LABELS, "BEST_MARKET", lang)} aria-label={bi(STATUS_LABELS, "BEST_MARKET", lang)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold shadow-sm backdrop-blur-sm uppercase" style={{ background: "rgba(250,204,21,0.95)", color: "#3f2d00" }}>
                <Star className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{bi(STATUS_LABELS, "BEST_MARKET", lang)}</span>
              </span>
            )}
            {views > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }}>
                <Eye className="w-3.5 h-3.5" /> {views}
              </span>
            )}
            {images.length > 1 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }}>
                <Camera className="w-3.5 h-3.5" /> {images.length}
              </span>
            )}
          </div>
        </div>
        {/* Save - a real control, no longer a decorative icon */}
        <button type="button" onClick={toggleFav} aria-pressed={fav} aria-label={savedLabel} title={savedLabel}
          className={`absolute right-3 w-8 h-8 rounded-full items-center justify-center bg-black/25 backdrop-blur-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${list ? "hidden sm:flex top-3" : "flex top-3"}`}>
          <Heart className={`w-4 h-4 ${fav ? "text-rose-400" : "text-white"}`} fill={fav ? "currentColor" : "none"} />
        </button>
      </div>
      {/* Body */}
      <div className="p-3 sm:p-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {listing.code && (
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{listing.code}</span>
          )}
          {statusLabel && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={statusKey === "READY" || statusKey === "OPENING" || statusKey === "BEST_MARKET"
                ? { background: "var(--primary-subtle)", color: "var(--primary-600)" }
                : { background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}>{statusLabel}</span>
          )}
        </div>
        <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-snug group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>
          {listing.title}
        </h3>
        <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{listing.location}</span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-extrabold text-lg leading-none" style={{ color: "var(--primary-600)" }}>
              {priceText}
              {isRent && <span className="text-xs font-semibold ml-0.5" style={{ color: "var(--text-tertiary)" }}>{rentSuffix(lang)}</span>}
            </p>
            {ppm && <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>{ppm}</p>}
            {(() => {
              if (!facets || area <= 0) return null;
              const locKey = String(listing.location || "").split(",").pop()?.trim() || "";
              const bench = facets.priceBenchmarks?.[`${locKey}|${listing.type}`];
              if (!bench || bench.sampleSize < 3 || !bench.avgPricePerM2) return null;
              const listingPpm = (Number(listing.price) || 0) / area;
              if (!listingPpm) return null;
              const diffPct = Math.round(((listingPpm - bench.avgPricePerM2) / bench.avgPricePerM2) * 100);
              if (diffPct === 0) return null;
              const isBelow = diffPct < 0;
              return (
                <p className="text-xs font-semibold mt-1" style={{ color: isBelow ? "var(--color-success)" : "var(--sgs-accent)" }}>
                  {isBelow
                    ? tt(lang, `Th\u1ea5p h\u01a1n ${Math.abs(diffPct)}% so v\u1edbi TB khu v\u1ef1c`, `${Math.abs(diffPct)}% below area average`)
                    : tt(lang, `Cao h\u01a1n ${Math.abs(diffPct)}% so v\u1edbi TB khu v\u1ef1c`, `${Math.abs(diffPct)}% above area average`)}
                </p>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
            {area > 0 ? <span>{area}{"m\u00b2"}</span> : null}
            {listing.bedrooms ? <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{listing.bedrooms}PN</span> : null}
          </div>
        </div>
        {(direction || legal) && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 flex-wrap text-xs" style={{ borderTop: "1px solid var(--border-default)" }}>
            {direction && (
              <span style={{ color: "var(--text-tertiary)" }}>
                {ui("direction", lang)}: <b style={{ color: "var(--text-secondary)" }}>{direction}</b>
              </span>
            )}
            {legal && (
              <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                {ui("legal", lang)}: {legal}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function MarketplacePage({ initialListings, totalCount, totalPages, searchParams: sp, facets, locations }: Props) {
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(sp.q ?? "");
  const [view, setView] = useState<"GRID" | "LIST" | "BOARD" | "MAP">("GRID");
  const [heroOpen, setHeroOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem("sgs:recentSearches") || "[]");
      setRecentSearches(Array.isArray(raw) ? raw : []);
    } catch {}
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (heroRef.current && !heroRef.current.contains(e.target as Node)) setHeroOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const saveRecentSearch = (q: string) => {
    if (!q.trim()) return;
    try {
      const raw = JSON.parse(window.localStorage.getItem("sgs:recentSearches") || "[]");
      const list: string[] = Array.isArray(raw) ? raw : [];
      const next = [q, ...list.filter((x: string) => x !== q)].slice(0, 5);
      window.localStorage.setItem("sgs:recentSearches", JSON.stringify(next));
      setRecentSearches(next);
    } catch {}
  };
  const AI_PRESETS = [
    { label: tt(lang, "C\u0103n h\u1ed9 d\u01b0\u1edbi 3 t\u1ef7", "Apartments under 3B"), apply: (p: URLSearchParams) => { p.set("type", "Apartment"); p.set("maxPrice", "3"); } },
    { label: tt(lang, "Nh\u00e0 ph\u1ed1 cho thu\u00ea", "Townhouses for rent"), apply: (p: URLSearchParams) => { p.set("type", "Townhouse"); p.set("transaction", "RENT"); } },
    { label: tt(lang, "\u0110\u1ea5t n\u1ec1n s\u1ed5 h\u1ed3ng", "Land with Pink Book"), apply: (p: URLSearchParams) => { p.set("type", "Land"); p.set("legalStatus", "PinkBook"); } },
    { label: tt(lang, "C\u0103n h\u1ed9 2-3 ph\u00f2ng ng\u1ee7", "2-3 bedroom apartments"), apply: (p: URLSearchParams) => { p.set("type", "Apartment"); p.set("bedrooms", "2"); } },
  ];

  const pushParams = useCallback((mut: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.type) params.set("type", sp.type);
    if (sp.area) params.set("area", sp.area);
    if (sp.minPrice) params.set("minPrice", sp.minPrice);
    if (sp.maxPrice) params.set("maxPrice", sp.maxPrice);
    if (sp.bedrooms) params.set("bedrooms", sp.bedrooms);
    if (sp.transaction) params.set("transaction", sp.transaction);
    if (sp.legalStatus) params.set("legalStatus", sp.legalStatus);
    if (sp.direction) params.set("direction", sp.direction);
    if (sp.sort) params.set("sort", sp.sort);
    mut(params);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [sp, pathname, router]);

  const setParam = (key: string, value: string) => pushParams((p) => { if (value) p.set(key, value); else p.delete(key); });
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    saveRecentSearch(query);
    if (query) {
      trackEvent("listing_search", {
        pageLabel: "Marketplace search",
        metadata: { query, category: sp.type || null, location: sp.area || null },
      });
    }
    setHeroOpen(false);
    setParam("q", query);
  };
  const currentPage = parseInt(sp.page ?? "1");
  const activePriceLabel = (PRICE_OPTIONS(lang).find((pr) => pr.min === (sp.minPrice ?? "") && pr.max === (sp.maxPrice ?? "")) || PRICE_OPTIONS(lang)[0]).label;
  const activeFilterCount = [sp.type, sp.area, (sp.minPrice || sp.maxPrice) ? "price" : "", sp.sort, sp.legalStatus, sp.direction].filter(Boolean).length;
  const activeTab = sp.type === "PROJECT" ? "PROJECT" : (sp.transaction === "SALE" || sp.transaction === "RENT" ? sp.transaction : "");
  const setTransactionTab = (tab) => {
    pushParams((p) => {
      if (sp.type === "PROJECT") p.delete("type");
      if (tab === activeTab) { p.delete("transaction"); return; }
      p.set("transaction", tab);
    });
  };

  const VIEWS = [
    { id: "GRID", icon: LayoutGrid }, { id: "LIST", icon: ListIcon }, { id: "BOARD", icon: Columns }, { id: "MAP", icon: MapIcon },
  ] as const;

  // Group for board view
  const boards = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    (initialListings || []).forEach((l: any) => {
      const label = TYPE_LABELS(lang)[l.type] || tt(lang, "Khác", "Other");
      (groups[label] = groups[label] || []).push(l);
    });
    return Object.entries(groups);
  }, [initialListings, lang]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pb-10 pt-3 sm:pt-24">
      {/* Hero: navy panel, serif heading, expandable smart search (real data
          only - "gan day" from localStorage, "AI" presets set real filters,
          "noi bat" areas from real GROUP BY counts via /api/public/listings/facets). */}
      <div className="relative left-1/2 -translate-x-1/2 w-screen mb-5 sm:mb-8 -mt-3 sm:-mt-24 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--sgs-hero-deep)" }} />
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 12% 20%, transparent 0, transparent 38px, rgba(255,255,255,0.7) 39px, transparent 40px), repeating-radial-gradient(circle at 88% 75%, transparent 0, transparent 46px, rgba(255,255,255,0.7) 47px, transparent 48px)",
        }} />
        <div className="relative max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pt-10 pb-7 sm:pt-28 sm:pb-14">
          <h2 className="text-xl sm:text-4xl font-bold mb-2 leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--text-inverse)" }}>
            {tt(lang, "T\u00ecm ng\u00f4i nh\u00e0 m\u01a1 \u01b0\u1edbc c\u1ee7a b\u1ea1n", "Find your dream property")}
          </h2>
          <p className="text-xs sm:text-base mb-4 sm:mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
            {tt(lang, "H\u00e0ng ngh\u00ecn b\u1ea5t \u0111\u1ed9ng s\u1ea3n \u0111\u00e3 x\u00e1c th\u1ef1c tr\u00ean kh\u1eafp \u0110\u00f4ng Nam B\u1ed9", "Thousands of verified properties across the Southeast region")}
          </p>
          <div ref={heroRef} className="relative max-w-2xl">
            {!heroOpen ? (
              <button type="button" onClick={() => setHeroOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-left transition-colors shadow-xl"
                style={{ background: "var(--bg-surface)", color: "var(--text-tertiary)" }}>
                <Search className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-sm truncate">{tt(lang, "T\u00ecm theo t\u00ean, d\u1ef1 \u00e1n, khu v\u1ef1c, m\u00e3 code...", "Search by name, project, area or code...")}</span>
                <span className="text-xs px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline" style={{ borderColor: "var(--border-default)" }}>K</span>
              </button>
            ) : (
              <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                <form onSubmit={handleSearch} className="relative p-3 border-b" style={{ borderColor: "var(--border-default)" }}>
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                  <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={tt(lang, "T\u00ecm theo t\u00ean, d\u1ef1 \u00e1n, khu v\u1ef1c, m\u00e3 code...", "Search by name, project, area or code...")}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", color: "var(--text-primary)" }} />
                </form>
                <div className="p-4 grid gap-5 sm:grid-cols-3 max-h-[60vh] overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-tertiary)" }}>
                      {tt(lang, "T\u00ecm g\u1ea7n \u0111\u00e2y", "Recent searches")}
                    </h4>
                    {recentSearches.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Ch\u01b0a c\u00f3 t\u00ecm ki\u1ebfm g\u1ea7n \u0111\u00e2y", "No recent searches yet")}</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {recentSearches.map((q) => (
                          <li key={q}>
                            <button type="button" onClick={() => {
                              setSearch(q);
                              saveRecentSearch(q);
                              setHeroOpen(false);
                              trackEvent("listing_search", { pageLabel: "Marketplace recent search", metadata: { query: q, category: sp.type || null, location: sp.area || null } });
                              setParam("q", q);
                            }}
                              className="text-xs text-left hover:opacity-70 transition-opacity truncate w-full" style={{ color: "var(--text-secondary)" }}>{q}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-tertiary)" }}>
                      {tt(lang, "G\u1ee3i \u00fd theo AI", "AI suggestions")}
                    </h4>
                    <ul className="flex flex-col gap-1">
                      {AI_PRESETS.map((preset) => (
                        <li key={preset.label}>
                          <button type="button" onClick={() => { setHeroOpen(false); pushParams((p) => { p.delete("type"); p.delete("area"); p.delete("minPrice"); p.delete("maxPrice"); p.delete("bedrooms"); p.delete("transaction"); p.delete("legalStatus"); p.delete("direction"); preset.apply(p); }); }}
                            className="text-xs text-left hover:opacity-70 transition-opacity w-full" style={{ color: "var(--text-secondary)" }}>{preset.label}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-tertiary)" }}>
                      {tt(lang, "Khu v\u1ef1c n\u1ed5i b\u1eadt", "Popular areas")}
                    </h4>
                    {(!facets || facets.topAreas.length === 0) ? (
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u", "No data yet")}</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {facets.topAreas.map((a) => (
                          <li key={a.name}>
                            <button type="button" onClick={() => { setHeroOpen(false); setParam("area", a.name); }}
                              className="text-xs text-left hover:opacity-70 transition-opacity w-full flex items-center justify-between gap-2" style={{ color: "var(--text-secondary)" }}>
                              <span className="truncate">{a.name}</span>
                              <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>{a.count} {tt(lang, "tin \u0111\u0103ng", "listings")}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Primary row: transaction segmented control + view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 mb-3">
        <div className="flex items-center gap-1 p-0.5 rounded-lg w-full sm:w-auto" style={{ background: "var(--bg-app)" }}>
          <button type="button" onClick={() => setTransactionTab("SALE")}
            className="px-3 sm:px-4 h-9 rounded-md text-sm font-semibold transition-colors whitespace-nowrap"
            style={activeTab === "SALE" ? { background: "var(--primary-600)", color: "var(--text-inverse)" } : { color: "var(--text-secondary)" }}>
            {tt(lang, "Bán", "For sale")}
          </button>
          <button type="button" onClick={() => setTransactionTab("RENT")}
            className="px-3 sm:px-4 h-9 rounded-md text-sm font-semibold transition-colors whitespace-nowrap"
            style={activeTab === "RENT" ? { background: "var(--primary-600)", color: "var(--text-inverse)" } : { color: "var(--text-secondary)" }}>
            {tt(lang, "Cho thuê", "For rent")}
          </button>
          <Link href={lang === "en" ? "/en/du-an" : "/du-an"}
            className="px-3 sm:px-4 h-9 rounded-md text-sm font-semibold transition-colors whitespace-nowrap flex items-center"
            style={{ color: "var(--text-secondary)" }}>
            {tt(lang, "Dự án", "Projects")}
          </Link>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => setFiltersOpen((open) => !open)}
            className="sm:hidden h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors"
            style={filtersOpen || activeFilterCount > 0
              ? { background: "var(--primary-600)", color: "var(--text-inverse)" }
              : { background: "var(--bg-app)", color: "var(--primary-600)" }}>
            <SlidersHorizontal className="w-4 h-4" />
            <span>{tt(lang, "Bộ lọc", "Filters")}</span>
            {activeFilterCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full text-xs flex items-center justify-center" style={{ background: filtersOpen ? "rgba(255,255,255,.22)" : "var(--primary-600)", color: "var(--text-inverse)" }}>{activeFilterCount}</span>}
          </button>
          <div className="flex self-end p-0.5 rounded-lg shrink-0" style={{ background: "var(--bg-app)" }}>
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button key={v.id} type="button" onClick={() => setView(v.id)} aria-label={v.id}
                className="p-2 rounded-md transition-colors" style={active ? { background: "var(--primary-600)", color: "var(--text-inverse)" } : { color: "var(--text-secondary)" }}>
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          </div>
        </div>
      </div>
      {/* Secondary row: refine filters */}
      <div className="hidden sm:flex sm:flex-wrap items-center gap-2 pb-1 mb-3">
        <div className="min-w-0"><Dropdown value={sp.type ?? ""} options={TYPE_OPTIONS(lang)} onChange={(v) => setParam("type", v)} minWidth={0} /></div>
        <div className="min-w-0"><Dropdown value={sp.area ?? ""} options={LOCATION_OPTIONS(lang, locations)} onChange={(v) => setParam("area", v)} minWidth={0} /></div>
        <div className="min-w-0"><Dropdown value={activePriceLabel} options={PRICE_OPTIONS(lang).map((o) => ({ label: o.label, value: o.label }))}
          onChange={(label) => { const pr = PRICE_OPTIONS(lang).find((x) => x.label === label) || PRICE_OPTIONS(lang)[0]; pushParams((p) => { p.delete("minPrice"); p.delete("maxPrice"); if (pr.min) p.set("minPrice", pr.min); if (pr.max) p.set("maxPrice", pr.max); }); }}
          minWidth={0} /></div>
        <div className="min-w-0"><Dropdown
          value={sp.sort ?? ""}
          options={[
            { label: tt(lang, "M\u1edbi nh\u1ea5t", "Newest"), value: "" },
            { label: tt(lang, "Gi\u00e1: Th\u1ea5p \u0111\u1ebfn cao", "Price: Low to high"), value: "price_asc" },
            { label: tt(lang, "Gi\u00e1: Cao \u0111\u1ebfn th\u1ea5p", "Price: High to low"), value: "price_desc" },
          ]}
          onChange={(v) => setParam("sort", v)}
          minWidth={0}
        /></div>
        {!!facets && facets.legalStatus.length > 0 && (
          <div className="min-w-0"><Dropdown
            value={sp.legalStatus ?? ""}
            options={[{ label: tt(lang, "T\u1ea5t c\u1ea3 ph\u00e1p l\u00fd", "All legal status"), value: "" },
              ...facets.legalStatus.map((f) => ({ label: bi(LEGAL_LABELS, f.value, lang) || f.value, value: f.value }))]}
            onChange={(v) => setParam("legalStatus", v)}
            minWidth={0}
          /></div>
        )}
        {!!facets && facets.direction.length > 0 && (
          <div className="min-w-0"><Dropdown
            value={sp.direction ?? ""}
            options={[{ label: tt(lang, "T\u1ea5t c\u1ea3 h\u01b0\u1edbng", "All directions"), value: "" },
              ...facets.direction.map((f) => ({ label: bi(DIRECTION_LABELS, f.value, lang) || f.value, value: f.value }))]}
            onChange={(v) => setParam("direction", v)}
            minWidth={0}
          /></div>
        )}
      </div>
      <div className="sm:hidden mb-3">
        {filtersOpen && (
          <div className="mt-2 p-3 rounded-2xl grid grid-cols-2 gap-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="min-w-0"><Dropdown value={sp.type ?? ""} options={TYPE_OPTIONS(lang)} onChange={(v) => setParam("type", v)} minWidth={0} /></div>
            <div className="min-w-0"><Dropdown value={sp.area ?? ""} options={LOCATION_OPTIONS(lang, locations)} onChange={(v) => setParam("area", v)} minWidth={0} /></div>
            <div className="min-w-0"><Dropdown value={activePriceLabel} options={PRICE_OPTIONS(lang).map((o) => ({ label: o.label, value: o.label }))}
              onChange={(label) => { const pr = PRICE_OPTIONS(lang).find((x) => x.label === label) || PRICE_OPTIONS(lang)[0]; pushParams((p) => { p.delete("minPrice"); p.delete("maxPrice"); if (pr.min) p.set("minPrice", pr.min); if (pr.max) p.set("maxPrice", pr.max); }); }}
              minWidth={0} /></div>
            <div className="min-w-0"><Dropdown value={sp.sort ?? ""} options={[
              { label: tt(lang, "Mới nhất", "Newest"), value: "" },
              { label: tt(lang, "Giá: Thấp đến cao", "Price: Low to high"), value: "price_asc" },
              { label: tt(lang, "Giá: Cao đến thấp", "Price: High to low"), value: "price_desc" },
            ]} onChange={(v) => setParam("sort", v)} minWidth={0} /></div>
            {!!facets && facets.legalStatus.length > 0 && (
              <div className="min-w-0"><Dropdown value={sp.legalStatus ?? ""} options={[
                { label: tt(lang, "Tất cả pháp lý", "All legal status"), value: "" },
                ...facets.legalStatus.map((f) => ({ label: bi(LEGAL_LABELS, f.value, lang) || f.value, value: f.value })),
              ]} onChange={(v) => setParam("legalStatus", v)} minWidth={0} /></div>
            )}
            {!!facets && facets.direction.length > 0 && (
              <div className="min-w-0"><Dropdown value={sp.direction ?? ""} options={[
                { label: tt(lang, "Tất cả hướng", "All directions"), value: "" },
                ...facets.direction.map((f) => ({ label: bi(DIRECTION_LABELS, f.value, lang) || f.value, value: f.value })),
              ]} onChange={(v) => setParam("direction", v)} minWidth={0} /></div>
            )}
          </div>
        )}
      </div>

      {/* Result count + active filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 [mask-image:linear-gradient(to_right,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,black_88%,transparent)]">
        <span className="text-sm font-medium shrink-0 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{totalCount} kết quả</span>
        {sp.type && sp.type !== "PROJECT" && (
          <ActiveChip label={TYPE_OPTIONS(lang).find((o) => o.value === sp.type)?.label ?? sp.type}
            onRemove={() => pushParams((p) => p.delete("type"))} />
        )}
        {sp.area && (
          <ActiveChip label={LOCATION_OPTIONS(lang, locations).find((o) => o.value === sp.area)?.label ?? sp.area}
            onRemove={() => pushParams((p) => p.delete("area"))} />
        )}
        {(sp.minPrice || sp.maxPrice) && (
          <ActiveChip label={activePriceLabel}
            onRemove={() => pushParams((p) => { p.delete("minPrice"); p.delete("maxPrice"); })} />
        )}
        {sp.legalStatus && (
          <ActiveChip label={bi(LEGAL_LABELS, sp.legalStatus, lang) || sp.legalStatus}
            onRemove={() => pushParams((p) => p.delete("legalStatus"))} />
        )}
        {sp.direction && (
          <ActiveChip label={bi(DIRECTION_LABELS, sp.direction, lang) || sp.direction}
            onRemove={() => pushParams((p) => p.delete("direction"))} />
        )}
      </div>

      {/* Content */}
      {initialListings.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{tt(lang, "Không tìm thấy kết quả", "No results found")}</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Thử thay đổi tiêu chí tìm kiếm hoặc mở rộng khu vực", "Try adjusting your filters or widening the area")}</p>
        </div>
      ) : view === "MAP" ? (
        <div className="relative">
          <MarketplaceMap listings={initialListings} height="min(620px, 68vh)" />
          <button type="button" onClick={() => setView("GRID")}
            className="lg:hidden fixed left-1/2 -translate-x-1/2 bottom-20 z-40 flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl text-sm font-semibold"
            style={{ background: "var(--sgs-hero-deep)", color: "var(--text-inverse)" }}>
            <ListIcon className="w-4 h-4" /> {tt(lang, "Quay l\u1ea1i danh s\u00e1ch", "Back to list")}
          </button>
        </div>
      ) : view === "BOARD" ? (
        <div className="flex gap-4 no-scrollbar pb-2" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {boards.map(([label, items]) => (
            <div key={label} className="shrink-0 w-80 rounded-2xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{label}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{items.length}</span>
              </div>
              <div className="flex flex-col gap-3" style={{ maxHeight: "70vh", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingRight: "6px", scrollbarWidth: "thin" }}>
                {items.map((l: any) => (
                  <div key={l.id} style={{ flexShrink: 0 }}>
                    <ListingCard listing={l} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="lg:flex lg:gap-6 lg:items-start">
          <div className="hidden lg:block lg:w-[42%] lg:shrink-0 lg:sticky overflow-hidden rounded-2xl" style={{ top: 96, height: "calc(100vh - 120px)" }}>
            <MarketplaceMap listings={initialListings} height="100%" />
          </div>
          <div className="lg:flex-1 lg:min-w-0 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
            {view === "LIST" ? (
              <div className="flex flex-col gap-4">
                {initialListings.map((l: any, i: number) => <ListingCard key={l.id} listing={l} facets={facets} list eager={i < 2} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
                {initialListings.map((l: any, i: number) => <ListingCard key={l.id} listing={l} facets={facets} eager={i < 4} />)}
              </div>
            )}
            {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <Link href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.max(1, currentPage - 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium ${currentPage <= 1 ? "opacity-40 pointer-events-none" : ""}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            <ChevronLeft className="w-4 h-4" /> {tt(lang, "Trước", "Previous")}
          </Link>
          <span className="px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Trang", "Page")} {currentPage} / {totalPages}</span>
          <Link href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.min(totalPages, currentPage + 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium ${currentPage >= totalPages ? "opacity-40 pointer-events-none" : ""}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            {tt(lang, "Tiếp", "Next")} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
            )}
          </div>
        </div>
      )}
      {(view === "GRID" || view === "LIST") && (
        <button type="button" onClick={() => setView("MAP")}
          className="lg:hidden fixed left-1/2 -translate-x-1/2 bottom-20 z-40 flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl text-sm font-semibold"
          style={{ background: "var(--sgs-hero-deep)", color: "var(--text-inverse)" }}>
          <MapIcon className="w-4 h-4" /> {tt(lang, "Xem b\u1ea3n \u0111\u1ed3", "View map")}
        </button>
      )}
    </div>
  );
}
