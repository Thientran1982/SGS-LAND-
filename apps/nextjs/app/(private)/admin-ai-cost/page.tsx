"use client";

import { useEffect, useState, useCallback } from "react";
import { Cpu, RefreshCw, DollarSign, Zap, BarChart3, Calendar } from "lucide-react";

interface AgentRun { id: number; agent_type?: string; model?: string; input_tokens?: number; output_tokens?: number; cost_usd?: number; duration_ms?: number; status?: string; created_at?: string; user_name?: string; }
interface CostSummary { total_cost_usd: number; total_input_tokens: number; total_output_tokens: number; total_runs: number; }

function fmtDate(d?: string) { return d ? new Date(d).toLocaleString("vi-VN") : "—"; }
function fmtCost(c?: number) { return c ? `$${c.toFixed(4)}` : "$0.0000"; }
function fmtNum(n?: number) { return n ? n.toLocaleString() : "0"; }

export default function AdminAiCostPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/agent-runs?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      const list: AgentRun[] = Array.isArray(d) ? d : d.runs || d.data || [];
      setRuns(list);
      setSummary({
        total_runs: list.length,
        total_cost_usd: list.reduce((s, r) => s + (r.cost_usd || 0), 0),
        total_input_tokens: list.reduce((s, r) => s + (r.input_tokens || 0), 0),
        total_output_tokens: list.reduce((s, r) => s + (r.output_tokens || 0), 0),
      });
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = summary ? [
    { label: "Tổng chi phí", value: fmtCost(summary.total_cost_usd), icon: DollarSign, color: "#f59e0b" },
    { label: "Số lần chạy", value: fmtNum(summary.total_runs), icon: Zap, color: "#6366f1" },
    { label: "Token đầu vào", value: fmtNum(summary.total_input_tokens), icon: BarChart3, color: "#10b981" },
    { label: "Token đầu ra", value: fmtNum(summary.total_output_tokens), icon: BarChart3, color: "#8b5cf6" },
  ] : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Chi phí AI</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Theo dõi chi phí và mức độ sử dụng AI</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {loading && <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div><div className="h-64 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} /></div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4" style={{ color }} /><p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p></div>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: "var(--bg-elevated)" }}>
                {["Thời gian", "Loại agent", "Model", "Token vào", "Token ra", "Chi phí", "Thời lượng"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: "var(--text-secondary)" }}>Chưa có dữ liệu</td></tr>}
                {runs.map((run, i) => (
                  <tr key={run.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(run.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>{run.agent_type || "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{run.model || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{fmtNum(run.input_tokens)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{fmtNum(run.output_tokens)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "#f59e0b" }}>{fmtCost(run.cost_usd)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

