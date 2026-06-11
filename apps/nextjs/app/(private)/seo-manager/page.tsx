// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Plus, Trash2, Globe, TrendingUp, Eye, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Keyword { id: number; keyword: string; target_url?: string; monthly_volume?: number; difficulty?: number; current_position?: number; created_at?: string; }
interface AiVisibility { score?: number; mentions?: number; sentiment?: string; last_checked?: string; }

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 mb-5"><Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2></div>
      {children}
    </div>
  );
}

export default function SeoManagerPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [aiVis, setAiVis] = useState<AiVisibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newKw, setNewKw] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/seo/target-keywords", { credentials: "include" }),
        fetch("/api/seo/ai-visibility", { credentials: "include" }),
      ]);
      if (r1.ok) { const d = await r1.json(); setKeywords(Array.isArray(d) ? d : d.keywords || []); }
      if (r2.ok) { const d = await r2.json(); setAiVis(d); }
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newKw.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/seo/target-keywords", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ keyword: newKw.trim() }) });
      if (r.ok) { const d = await r.json(); setKeywords((prev) => [d, ...prev]); setNewKw(""); setToast({ ok: true, msg: "Đã thêm từ khóa!" }); }
      else setToast({ ok: false, msg: "Lỗi thêm từ khóa" });
    } catch { setToast({ ok: false, msg: "Lỗi kết nối" }); } finally { setAdding(false); }
  };

  const removeKw = async (id: number) => {
    try {
      await fetch(`/api/seo/target-keywords/${id}`, { method: "DELETE", credentials: "include" });
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch { }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quản lý SEO</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Theo dõi từ khóa và hiển thị AI</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {toast && <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: toast.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: toast.ok ? "#10b981" : "#ef4444" }}>
        {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
      </div>}

      {aiVis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Điểm AI Visibility", value: `${aiVis.score || 0}/100`, color: "#6366f1" },
            { label: "Số lần đề cập", value: aiVis.mentions?.toLocaleString() || "0", color: "#10b981" },
            { label: "Cảm xúc", value: aiVis.sentiment === "positive" ? "Tích cực" : aiVis.sentiment === "negative" ? "Tiêu cực" : "Trung tính", color: "#f59e0b" },
            { label: "Cập nhật lần cuối", value: aiVis.last_checked ? new Date(aiVis.last_checked).toLocaleDateString("vi-VN") : "—", color: "#8b5cf6" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
              <p className="text-lg font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <Card title="Từ khóa mục tiêu" icon={Search}>
        <form onSubmit={addKeyword} className="flex gap-2 mb-4">
          <input className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            value={newKw} onChange={(e) => setNewKw(e.target.value)} placeholder="Nhập từ khóa mới..." />
          <button type="submit" disabled={adding || !newKw.trim()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Thêm
          </button>
        </form>

        {loading && <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
        {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
        {!loading && keywords.length === 0 && <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>Chưa có từ khóa nào</p>}
        {!loading && keywords.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: "var(--bg-elevated)" }}>
                {["Từ khóa", "Lượng tìm kiếm", "Độ khó", "Vị trí hiện tại", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {keywords.map((kw, i) => (
                  <tr key={kw.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{kw.keyword}</td>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{kw.monthly_volume?.toLocaleString() || "—"}</td>
                    <td className="px-3 py-2.5">
                      {kw.difficulty != null ? <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: kw.difficulty > 60 ? "rgba(239,68,68,0.08)" : kw.difficulty > 30 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)", color: kw.difficulty > 60 ? "#ef4444" : kw.difficulty > 30 ? "#f59e0b" : "#10b981" }}>{kw.difficulty}</span> : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{kw.current_position ? `#${kw.current_position}` : "—"}</td>
                    <td className="px-3 py-2.5"><button onClick={() => removeKw(kw.id)} className="p-1 rounded-lg hover:opacity-70"><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
