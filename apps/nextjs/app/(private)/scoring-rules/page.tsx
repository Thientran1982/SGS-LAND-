"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, RefreshCw, Save, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from "lucide-react";

interface ScoringRule { id: number; name?: string; field?: string; operator?: string; value?: string; score?: number; is_active?: boolean; }

const FIELD_OPTIONS = [
  { v: "source", l: "Nguồn lead" }, { v: "budget", l: "Ngân sách" }, { v: "timeline", l: "Thời gian mua" },
  { v: "property_type", l: "Loại BĐS" }, { v: "location", l: "Khu vực" }, { v: "engagement", l: "Mức độ tương tác" },
];
const OPS = [{ v: "eq", l: "Bằng" }, { v: "gt", l: "Lớn hơn" }, { v: "lt", l: "Nhỏ hơn" }, { v: "contains", l: "Chứa" }];

export default function ScoringRulesPage() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/scoring/rules", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setRules(Array.isArray(d) ? d : d.rules || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAll = async () => {
    setSaving(true); setToast(null);
    try {
      const r = await fetch("/api/scoring/rules/bulk", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ rules }) });
      setToast(r.ok ? { ok: true, msg: "Lưu quy tắc thành công!" } : { ok: false, msg: "Lỗi lưu quy tắc" });
    } catch { setToast({ ok: false, msg: "Lỗi kết nối" }); } finally { setSaving(false); }
  };

  const add = () => setRules((prev) => [...prev, { id: Date.now(), name: "", field: "source", operator: "eq", value: "", score: 10, is_active: true }]);
  const update = (id: number, k: keyof ScoringRule, v: unknown) => setRules((prev) => prev.map((r) => r.id === id ? { ...r, [k]: v } : r));
  const remove = (id: number) => setRules((prev) => prev.filter((r) => r.id !== id));

  const inpS: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quy tắc chấm điểm</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Cấu hình tự động chấm điểm leads</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
          </button>
          <button onClick={add} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
            <Plus className="w-4 h-4" />Thêm quy tắc
          </button>
          <button onClick={saveAll} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Lưu tất cả
          </button>
        </div>
      </div>

      {loading && <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}
      {toast && <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: toast.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: toast.ok ? "#10b981" : "#ef4444" }}>
        {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
      </div>}

      {!loading && rules.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chưa có quy tắc chấm điểm</p>
          <button onClick={add} className="mt-3 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>Thêm quy tắc đầu tiên</button>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl p-4 grid grid-cols-[1fr_1fr_1fr_80px_40px] gap-3 items-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <select className="px-3 py-2 rounded-xl text-sm outline-none" style={inpS} value={rule.field || ""} onChange={(e) => update(rule.id, "field", e.target.value)}>
                {FIELD_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select className="px-3 py-2 rounded-xl text-sm outline-none" style={inpS} value={rule.operator || ""} onChange={(e) => update(rule.id, "operator", e.target.value)}>
                {OPS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input className="px-3 py-2 rounded-xl text-sm outline-none" style={inpS} value={rule.value || ""} placeholder="Giá trị..." onChange={(e) => update(rule.id, "value", e.target.value)} />
              <div className="flex items-center gap-1">
                <input type="number" className="w-16 px-2 py-2 rounded-xl text-sm outline-none text-center" style={inpS} value={rule.score ?? 10} onChange={(e) => update(rule.id, "score", Number(e.target.value))} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>đ</span>
              </div>
              <button onClick={() => remove(rule.id)} className="p-1.5 rounded-lg hover:opacity-70"><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
