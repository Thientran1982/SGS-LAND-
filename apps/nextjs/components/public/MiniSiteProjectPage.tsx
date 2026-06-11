// @ts-nocheck
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Phone, MapPin, Bed, Square, Building2, ChevronDown } from "lucide-react";

interface MiniListing {
  id: string;
  code?: string;
  title: string;
  price: number;
  area?: number;
  bedrooms?: number;
  attributes?: { tower?: string; floor?: number; view?: string; legalStatus?: string };
}

interface Project {
  name: string;
  location?: string;
  status?: string;
  code: string;
  url?: string;
  listingCount?: number;
  listings?: MiniListing[];
  developer?: string;
  description?: string;
}

export function MiniSiteProjectPage({ project }: { project: Project }) {
  const [filterBR, setFilterBR] = useState<number | null>(null);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);

  const bedroomGroups = useMemo(() => {
    const map: Record<number, MiniListing[]> = {};
    for (const l of project.listings ?? []) {
      const br = l.bedrooms ?? 0;
      if (!map[br]) map[br] = [];
      map[br].push(l);
    }
    return map;
  }, [project.listings]);

  const listings = project.listings ?? [];

  const filtered = useMemo(() =>
    listings.filter((l) => {
      if (filterBR !== null && l.bedrooms !== filterBR) return false;
      if (filterMaxPrice !== null && l.price > filterMaxPrice * 1e9) return false;
      return true;
    }),
    [listings, filterBR, filterMaxPrice]
  );

  const uniqueBedrooms = [...new Set(listings.map((l) => l.bedrooms).filter(Boolean))].sort() as number[];
  const minPrice = listings.length ? Math.min(...listings.map((l) => l.price)) : 0;
  const maxPrice = listings.length ? Math.max(...listings.map((l) => l.price)) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="mb-10 p-8 rounded-3xl" style={{ background: "linear-gradient(135deg, var(--primary-subtle) 0%, var(--bg-elevated) 100%)", border: "1px solid var(--border-default)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: "var(--primary-600)", color: "#fff" }}>
                {project.status}
              </span>
              {project.developer && (
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>by {project.developer}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {project.name}
            </h1>
            <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <MapPin className="w-4 h-4 shrink-0" style={{ color: "var(--primary-600)" }} />
              {project.location}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Giá từ</p>
            <p className="text-2xl font-bold" style={{ color: "var(--primary-600)" }}>
              {(minPrice / 1e9).toFixed(2)} tỷ
            </p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>đến {(maxPrice / 1e9).toFixed(2)} tỷ</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t" style={{ borderColor: "var(--border-default)" }}>
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{project.listingCount}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>căn đang mở bán</p>
          </div>
          {uniqueBedrooms.map((br) => (
            <div key={br}>
              <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{bedroomGroups[br]?.length ?? 0}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>căn {br} PN</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setFilterBR(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterBR === null ? "text-white" : ""}`}
          style={filterBR === null ? { background: "var(--primary-600)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          Tất cả ({listings.length} căn)
        </button>
        {uniqueBedrooms.map((br) => (
          <button key={br} onClick={() => setFilterBR(filterBR === br ? null : br)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterBR === br ? "text-white" : ""}`}
            style={filterBR === br ? { background: "var(--primary-600)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            {br} phòng ngủ ({bedroomGroups[br]?.length ?? 0})
          </button>
        ))}
      </div>

      {/* Listing table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                {["Mã căn", "Tháp / Tầng", "Diện tích", "Phòng ngủ", "View", "Giá bán", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const attr = l.attributes ?? {};
                return (
                  <tr key={l.id} className="transition-colors hover:bg-[var(--bg-elevated)]"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border-default)" : "none" }}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "var(--primary-600)" }}>
                      {l.code ?? l.id}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {attr.tower ? `Tháp ${attr.tower}` : "—"}{attr.floor ? `, T${attr.floor}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>
                      {l.area ? `${l.area}m²` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>
                      {l.bedrooms ? `${l.bedrooms}PN` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {attr.view ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: "var(--primary-600)" }}>
                      {(l.price / 1e9).toFixed(2)} tỷ
                    </td>
                    <td className="px-4 py-3">
                      <a href="tel:+84971132378"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                        style={{ background: "var(--primary-600)" }}>
                        Liên hệ
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center" style={{ color: "var(--text-secondary)" }}>
          Không có căn hộ phù hợp với bộ lọc hiện tại.
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 p-6 rounded-2xl text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <p className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
          Tư vấn chuyên sâu về {project.name}
        </p>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Đại lý phân phối uỷ quyền chính thức — SGS LAND
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="tel:+84971132378"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--primary-600)" }}>
            <Phone className="w-4 h-4" />
            Gọi ngay: 0971 132 378
          </a>
          <Link href="/contact"
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: "1.5px solid var(--primary-600)", color: "var(--primary-600)" }}>
            Để lại thông tin
          </Link>
        </div>
      </div>
    </div>
  );
}
