// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, RefreshCw, Search, AlertCircle } from "lucide-react";

interface LedgerItem { id: number; agent_name?: string; project_name?: string; listing_title?: string; contract_value?: number; commission_pct?: number; commission_amount?: number; status?: string; paid_at?: string; created_at?: string; }

const STATUS_LABEL: Record<string, string> = { pending: "Chờ thanh toán", paid: "Đã thanh toán", cancelled: "Đã hủy", approved: "Đã duyệt" };
const STATUS_COLOR: Record<string, string> = { pending: "#f59e0b", paid: "#10b981", cancelled: "#ef4444", approved: "#6366f1" };

function fmtMoney(n?: number) { if (!n) return "—"; if (n >= 1e9) return `${(n / 1e9).toFixed(2)} tỷ`; if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`; return n.toLocaleString("vi-VN") + "₫"; }
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

export default function CommissionsPage() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/commissions/ledger", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setItems(Array.isArray(d) ? d : d.items || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) =>
    (!statusFilter || i.status === statusFilter) &&
    (!q || (i.agent_name || "").toLowerCase().includes(q.toLowerCase()) || (i.project_name || "").toLowerCase().includes(q.toLowerCase()))
  );

  const totals = {
    total: filtered.reduce((s, i) => s + (i.commission_amount || 0), 0),
    paid: filtered.filter((i) => i.status === "paid").reduce((s, i) => s + (i.commission_amount || 0), 0),
    pending: filtered.filter((i) => i.status === "pending").reduce((s, i) => s + (i.commission_amount || 0), 0),
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Hoa hồng</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Sổ cái hoa hồng và thanh toán</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng hoa hồng", value: fmtMoney(totals.total), color: "var(--primary-600)" },
          { label: "Đã thanh toán", value: fmtMoney(totals.paid), color: "#10b981" },
          { label: "Chờ thanh toán", value: fmtMoney(totals.pending), color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input className="pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none w-56" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            placeholder="Tìm nhân viên, dự án..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}><AlertCircle className="w-4 h-4" />{error}</div>}

      {!loading && !error && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Ngày", "Nhân viên", "Dự án / BĐS", "Giá trị HĐ", "% HC", "Hoa hồng", "Trạng thái"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: "var(--text-secondary)" }}>Không có dữ liệu hoa hồng</td></tr>}
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(item.created_at)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{item.agent_name || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{item.project_name || item.listing_title || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{fmtMoney(item.contract_value)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{item.commission_pct ? `${item.commission_pct}%` : "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold" style={{ color: "var(--primary-600)" }}>{fmtMoney(item.commission_amount)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLOR[item.status || ""] || "#6b7280"}18`, color: STATUS_COLOR[item.status || ""] || "#6b7280" }}>
                      {STATUS_LABEL[item.status || ""] || item.status || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
