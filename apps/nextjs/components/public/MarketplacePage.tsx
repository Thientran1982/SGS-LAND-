"use client";

import React, { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, MapPin, Bed, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Listing } from "@/types";

interface Props {
  initialListings: Listing[];
  totalCount: number;
  totalPages: number;
  searchParams: {
    q?: string;
    type?: string;
    area?: string;
    minPrice?: string;
    maxPrice?: string;
    bedrooms?: string;
    page?: string;
    transaction?: string;
  };
}

const PROPERTY_TYPES = ["Apartment", "Villa", "Townhouse", "Land", "Commercial", "Office"];
const BEDROOM_OPTIONS = [1, 2, 3, 4];
const PRICE_RANGES = [
  { label: "Dưới 3 tỷ", min: "", max: "3" },
  { label: "3 – 5 tỷ", min: "3", max: "5" },
  { label: "5 – 10 tỷ", min: "5", max: "10" },
  { label: "10 – 20 tỷ", min: "10", max: "20" },
  { label: "Trên 20 tỷ", min: "20", max: "" },
];

function formatPrice(price: number): string {
  return price >= 1e9
    ? `${(price / 1e9).toFixed(2)} tỷ`
    : `${Math.round(price / 1e6)} triệu`;
}

function ListingCard({ listing }: { listing: Listing }) {
  const slug = `${listing.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${listing.code}`;

  return (
    <Link
      href={`/bds/${slug}`}
      className="group block rounded-2xl overflow-hidden hover:shadow-token-lg transition-all hover:-translate-y-1"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      {/* Image */}
      <div className="h-44 relative overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🏢</div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-700">
          {listing.type}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors"
          style={{ color: "var(--text-primary)" }}>
          {listing.title}
        </h3>
        <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{listing.location}</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-bold text-base" style={{ color: "var(--primary-600)" }}>
            {formatPrice(listing.price)}
          </p>
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {listing.area && <span>{listing.area}m²</span>}
            {listing.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="w-3 h-3" />
                {listing.bedrooms}PN
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketplacePage({ initialListings, totalCount, totalPages, searchParams: sp }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(sp.q ?? "");

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams();
    if (sp.q)           params.set("q", sp.q);
    if (sp.type)        params.set("type", sp.type);
    if (sp.area)        params.set("area", sp.area);
    if (sp.minPrice)    params.set("minPrice", sp.minPrice);
    if (sp.maxPrice)    params.set("maxPrice", sp.maxPrice);
    if (sp.bedrooms)    params.set("bedrooms", sp.bedrooms);
    if (sp.transaction) params.set("transaction", sp.transaction);

    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // reset to page 1

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [sp, pathname, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", search.trim());
  };

  const currentPage = parseInt(sp.page ?? "1");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {sp.q ? `Kết quả cho "${sp.q}"` : "Tìm kiếm Bất Động Sản"}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {totalCount.toLocaleString()} bất động sản phù hợp
        </p>
        {!sp.q && (
          <h2 className="text-sm font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>
            Kho Hàng BDS Cập Nhật Realtime
          </h2>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, dự án, khu vực, mã code..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
          />
        </div>
        <button type="submit" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--primary-600)" }}>
          Tìm
        </button>
        <button type="button" onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}>
          <SlidersHorizontal className="w-4 h-4" />
          Lọc
        </button>
      </form>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 mb-4 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
          {/* Type */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium self-center" style={{ color: "var(--text-secondary)" }}>Loại:</span>
            {PROPERTY_TYPES.map((t) => (
              <button key={t} onClick={() => updateParam("type", sp.type === t ? "" : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sp.type === t ? "text-white" : ""}`}
                style={sp.type === t ? { background: "var(--primary-600)" } : { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                {t}
              </button>
            ))}
          </div>

          {/* Bedrooms */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Phòng ngủ:</span>
            {BEDROOM_OPTIONS.map((b) => (
              <button key={b} onClick={() => updateParam("bedrooms", sp.bedrooms === String(b) ? "" : String(b))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sp.bedrooms === String(b) ? "text-white" : ""}`}
                style={sp.bedrooms === String(b) ? { background: "var(--primary-600)" } : { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                {b}PN
              </button>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Giá:</span>
            {PRICE_RANGES.map((pr) => {
              const active = sp.minPrice === pr.min && sp.maxPrice === pr.max;
              return (
                <button key={pr.label} onClick={() => {
                  const p = new URLSearchParams();
                  if (sp.q) p.set("q", sp.q);
                  if (!active) { if (pr.min) p.set("minPrice", pr.min); if (pr.max) p.set("maxPrice", pr.max); }
                  startTransition(() => router.push(`${pathname}?${p.toString()}`));
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? "text-white" : ""}`}
                  style={active ? { background: "var(--primary-600)" } : { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                  {pr.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filters */}
      {(sp.q || sp.type || sp.bedrooms || sp.minPrice || sp.area) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            sp.q && { label: `"${sp.q}"`, key: "q" },
            sp.type && { label: sp.type, key: "type" },
            sp.bedrooms && { label: `${sp.bedrooms}PN`, key: "bedrooms" },
            sp.area && { label: sp.area, key: "area" },
          ].filter((f): f is { label: string; key: string } => Boolean(f)).map((f) => (
            <button key={f.key} onClick={() => updateParam(f.key, "")}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              {f.label}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
        {initialListings.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Không tìm thấy kết quả</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Thử thay đổi tiêu chí tìm kiếm hoặc mở rộng khu vực</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {initialListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <Link
            href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.max(1, currentPage - 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentPage <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-[var(--bg-elevated)]"}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            <ChevronLeft className="w-4 h-4" /> Trước
          </Link>

          <span className="px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Trang {currentPage} / {totalPages}
          </span>

          <Link
            href={`${pathname}?${new URLSearchParams({ ...sp, page: String(Math.min(totalPages, currentPage + 1)) }).toString()}`}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentPage >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-[var(--bg-elevated)]"}`}
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            Tiếp <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
