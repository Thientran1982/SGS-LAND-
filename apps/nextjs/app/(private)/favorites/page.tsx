"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart, Search, RefreshCw, MapPin, Tag, Home, Trash2 } from "lucide-react";

interface Favorite { id: number; listing_id?: number; title?: string; address?: string; price?: number; area?: number; type?: string; status?: string; slug_id?: string; thumbnail_url?: string; created_at?: string; }

function fmtPrice(p?: number) {
  if (!p) return "—";
  if (p >= 1e9) return `${(p / 1e9).toFixed(1)} tỷ`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(0)} triệu`;
  return p.toLocaleString("vi-VN") + " đ";
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/favorites", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setFavorites(Array.isArray(d) ? d : d.favorites || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    setRemoving(id);
    try {
      await fetch(`/api/favorites/${id}`, { method: "DELETE", credentials: "include" });
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } finally { setRemoving(null); }
  };

  const filtered = favorites.filter((f) => !q || (f.title || "").toLowerCase().includes(q.toLowerCase()) || (f.address || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Yêu thích</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Danh sách bất động sản đã lưu</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Tìm BĐS..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chưa có BĐS yêu thích</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Lưu BĐS yêu thích để xem lại sau</p>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <div key={f.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="h-36 flex items-center justify-center" style={{ background: "var(--bg-elevated)" }}>
                {f.thumbnail_url ? <img src={f.thumbnail_url} alt={f.title} className="w-full h-full object-cover" /> : <Home className="w-10 h-10" style={{ color: "var(--border-default)" }} />}
              </div>
              <div className="p-4">
                <p className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: "var(--text-primary)" }}>{f.title || `BĐS #${f.listing_id || f.id}`}</p>
                {f.address && <p className="text-xs flex items-center gap-1 mb-2" style={{ color: "var(--text-secondary)" }}><MapPin className="w-3 h-3" />{f.address}</p>}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: "var(--primary-600)" }}>{fmtPrice(f.price)}</span>
                  <button onClick={() => remove(f.id)} disabled={removing === f.id} className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40">
                    <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
