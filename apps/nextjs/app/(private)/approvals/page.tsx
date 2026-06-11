// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckSquare, RefreshCw, Search, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface Approval { id: number; type?: string; status?: string; requester_name?: string; description?: string; created_at?: string; reviewed_at?: string; reviewer_name?: string; metadata?: Record<string, unknown>; }

const STATUS_LABEL: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" };
const STATUS_COLOR: Record<string, string> = { pending: "#f59e0b", approved: "#10b981", rejected: "#ef4444" };
const TYPE_LABEL: Record<string, string> = { listing: "Đăng tin", contract: "Hợp đồng", price_change: "Thay đổi giá", refund: "Hoàn tiền" };
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const url = `/api/approval-requests?status=${statusFilter || ""}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setItems(Array.isArray(d) ? d : d.requests || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: "approve" | "reject") => {
    setActing(id);
    try {
      await fetch(`/api/approval-requests/${id}/${action}`, { method: "POST", credentials: "include" });
      setItems((prev) => prev.map((a) => a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a));
    } finally { setActing(null); }
  };

  const filtered = items.filter((a) => !q || (a.description || "").toLowerCase().includes(q.toLowerCase()) || (a.requester_name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Phê duyệt</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Xét duyệt các yêu cầu chờ phê duyệt</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input className="pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none w-56" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            placeholder="Tìm yêu cầu..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          {[["pending", "Chờ duyệt"], ["approved", "Đã duyệt"], ["rejected", "Từ chối"], ["", "Tất cả"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: statusFilter === v ? "var(--bg-surface)" : "transparent", color: statusFilter === v ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: statusFilter === v ? "var(--shadow-sm)" : "none" }}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Không có yêu cầu nào</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-2xl p-4 flex items-start gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${STATUS_COLOR[a.status || "pending"] || "#f59e0b"}18` }}>
                {a.status === "approved" ? <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} /> : a.status === "rejected" ? <XCircle className="w-5 h-5" style={{ color: "#ef4444" }} /> : <Clock className="w-5 h-5" style={{ color: "#f59e0b" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{TYPE_LABEL[a.type || ""] || a.type || "Yêu cầu"}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${STATUS_COLOR[a.status || "pending"]}18`, color: STATUS_COLOR[a.status || "pending"] || "#f59e0b" }}>{STATUS_LABEL[a.status || "pending"]}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.description || "—"}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{a.requester_name} · {fmtDate(a.created_at)}</p>
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => act(a.id, "approve")} disabled={acting === a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    {acting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}Duyệt
                  </button>
                  <button onClick={() => act(a.id, "reject")} disabled={acting === a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                    <XCircle className="w-3.5 h-3.5" />Từ chối
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
