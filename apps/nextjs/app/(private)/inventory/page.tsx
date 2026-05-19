"use client";

import { useEffect, useState } from "react";
import { Home, RefreshCw, AlertCircle, MapPin, Tag } from "lucide-react";

interface Listing {
  id: number;
  title?: string;
  address?: string;
  price?: number;
  area?: number;
  type?: string;
  status?: string;
  created_at?: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Đang bán", sold: "Đã bán", rented: "Đã thuê",
  pending: "Chờ duyệt", inactive: "Tạm ẩn",
};
const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  sold:     "bg-gray-100 text-gray-600",
  rented:   "bg-blue-100 text-blue-700",
  pending:  "bg-yellow-100 text-yellow-700",
  inactive: "bg-red-100 text-red-600",
};

function fmtPrice(p?: number) {
  if (!p) return "—";
  if (p >= 1e9) return `${(p / 1e9).toFixed(2)} tỷ`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(0)} triệu`;
  return p.toLocaleString("vi-VN") + " đ";
}

export default function InventoryPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = () => {
    setLoading(true);
    setError(null);
    fetch("/api/listings?limit=50", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Lỗi ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.listings ?? data.data ?? []);
        setListings(list);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchListings(); }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>BĐS quản lý</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Danh sách bất động sản đang quản lý</p>
        </div>
        <button onClick={fetchListings}
          className="p-2 rounded-xl transition-colors hover:opacity-70"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchListings} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Home className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có BĐS nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>BĐS sẽ hiển thị ở đây khi được thêm vào hệ thống</p>
        </div>
      )}

      {!loading && listings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="p-4 rounded-2xl flex flex-col gap-3"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="p-2 rounded-xl" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                  <Home className="w-4 h-4" />
                </div>
                {l.status && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                  {l.title ?? `BĐS #${l.id}`}
                </p>
                {l.address && (
                  <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <MapPin className="w-3 h-3 shrink-0" />{l.address}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
                <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <Tag className="w-3 h-3" />{l.type ?? "—"}
                </div>
                <p className="text-sm font-bold" style={{ color: "var(--primary-600)" }}>{fmtPrice(l.price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
