// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw, Search, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface ErrorLog { id: number; message?: string; stack?: string; url?: string; user_agent?: string; user_id?: number; user_name?: string; created_at?: string; level?: string; }

const LEVEL_COLOR: Record<string, string> = { error: "#ef4444", warn: "#f59e0b", info: "#6366f1" };
function fmtDate(d?: string) { return d ? new Date(d).toLocaleString("vi-VN") : "—"; }

export default function ErrorMonitorPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/error-logs?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setLogs(Array.isArray(d) ? d : d.logs || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clearAll = async () => {
    if (!confirm("Xóa tất cả lỗi?")) return;
    setClearing(true);
    try {
      await fetch("/api/error-logs", { method: "DELETE", credentials: "include" });
      setLogs([]);
    } finally { setClearing(false); }
  };

  const filtered = logs.filter((l) => !q || (l.message || "").toLowerCase().includes(q.toLowerCase()) || (l.url || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Giám sát lỗi</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{logs.length} bản ghi lỗi</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
          </button>
          {logs.length > 0 && (
            <button onClick={clearAll} disabled={clearing} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              <Trash2 className="w-4 h-4" />Xóa tất cả
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Tìm lỗi..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Không có lỗi nào</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Hệ thống hoạt động bình thường</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div key={log.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <button className="w-full flex items-center gap-3 p-3 text-left hover:opacity-80 transition-opacity" style={{ background: "var(--bg-surface)" }}
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: LEVEL_COLOR[log.level || "error"] || "#ef4444" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{log.message || "Lỗi không xác định"}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{log.url || "—"} · {fmtDate(log.created_at)}</p>
                </div>
                {expanded === log.id ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
              </button>
              {expanded === log.id && log.stack && (
                <div className="p-3 border-t" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap" style={{ color: "#ef4444", fontFamily: "var(--font-jetbrains-mono, monospace)" }}>{log.stack}</pre>
                  {log.user_name && <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Người dùng: {log.user_name}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
