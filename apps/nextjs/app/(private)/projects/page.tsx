// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Search, RefreshCw, MapPin, Calendar, Users, ExternalLink, Loader2 } from "lucide-react";

interface Project {
  id: number; name: string; code?: string; description?: string; location?: string;
  status?: string; total_units?: number; open_date?: string; handover_date?: string;
  created_at?: string; metadata?: Record<string, unknown>;
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Đang mở bán", COMPLETED: "Đã bàn giao", UPCOMING: "Sắp mở bán", SUSPENDED: "Tạm dừng" };
const STATUS_COLOR: Record<string, string> = { ACTIVE: "#10b981", COMPLETED: "#6366f1", UPCOMING: "#f59e0b", SUSPENDED: "#ef4444" };

function fmt(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/projects", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setProjects(Array.isArray(d) ? d : d.projects || d.data || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Lỗi kết nối"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.code || "").toLowerCase().includes(q.toLowerCase()) || (p.location || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dự án</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý danh sách dự án bất động sản</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl transition-opacity hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <RefreshCw className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </button>
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--primary-600)", color: "#fff" }}>
            <Plus className="w-4 h-4" />Thêm dự án
          </a>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Tìm dự án..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chưa có dự án nào</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Thêm dự án đầu tiên của bạn</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-md" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{p.name}</h3>
                  {p.code && <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{p.code}</p>}
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLOR[p.status || ""] || "#6b7280"}18`, color: STATUS_COLOR[p.status || ""] || "#6b7280" }}>
                  {STATUS_LABEL[p.status || ""] || p.status || "—"}
                </span>
              </div>
              {p.location && <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><MapPin className="w-3.5 h-3.5" />{p.location}</div>}
              <div className="flex gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                {p.total_units && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{p.total_units.toLocaleString()} căn</span>}
                {p.open_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Mở bán {fmt(p.open_date)}</span>}
              </div>
              {p.description && <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{p.description}</p>}
              <div className="flex justify-end pt-1 border-t" style={{ borderColor: "var(--border-default)" }}>
                <a href={`/du-an/${p.code || p.id}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity" style={{ color: "var(--primary-600)" }}>
                  <ExternalLink className="w-3.5 h-3.5" />Xem microsite
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
