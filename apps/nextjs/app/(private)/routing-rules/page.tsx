// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { GitBranch, RefreshCw, Plus, Trash2, Save, Loader2, CheckCircle, AlertCircle, GripVertical } from "lucide-react";

interface RoutingRule { id: number; name?: string; priority?: number; conditions?: Record<string, unknown>; action?: string; assignee_id?: number; assignee_name?: string; is_active?: boolean; }

function Badge({ active }: { active?: boolean }) {
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: active ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: active ? "#10b981" : "#ef4444" }}>{active ? "Kích hoạt" : "Tắt"}</span>;
}

export default function RoutingRulesPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/routing-rules", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setRules(Array.isArray(d) ? d : d.rules || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (rule: RoutingRule) => {
    try {
      await fetch(`/api/routing-rules/${rule.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ is_active: !rule.is_active }) });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch { }
  };

  const remove = async (id: number) => {
    if (!confirm("Xóa quy tắc này?")) return;
    try {
      await fetch(`/api/routing-rules/${id}`, { method: "DELETE", credentials: "include" });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch { }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quy tắc phân phối</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Tự động phân phối leads cho nhân viên</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
      </div>

      {loading && <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chưa có quy tắc phân phối</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Tạo quy tắc để tự động phân phối leads</p>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div key={rule.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <GripVertical className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{rule.name || `Quy tắc #${rule.id}`}</p>
                  <Badge active={rule.is_active} />
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Hành động: {rule.action || "—"} {rule.assignee_name ? `→ ${rule.assignee_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(rule)} className="px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                  {rule.is_active ? "Tắt" : "Bật"}
                </button>
                <button onClick={() => remove(rule.id)} className="p-1.5 rounded-lg hover:opacity-70"><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
