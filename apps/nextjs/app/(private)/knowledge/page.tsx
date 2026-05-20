"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Search, RefreshCw, FileText, Trash2, Upload, AlertCircle } from "lucide-react";

interface KnowledgeDoc { id: number; title?: string; filename?: string; file_type?: string; status?: string; created_at?: string; char_count?: number; }

const STATUS_LABEL: Record<string, string> = { ready: "Sẵn sàng", processing: "Đang xử lý", error: "Lỗi", pending: "Chờ xử lý" };
const STATUS_COLOR: Record<string, string> = { ready: "#10b981", processing: "#f59e0b", error: "#ef4444", pending: "#6b7280" };
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/knowledge/documents", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setDocs(Array.isArray(d) ? d : d.documents || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteDoc = async (id: number) => {
    if (!confirm("Xóa tài liệu này?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/knowledge/documents/${id}`, { method: "DELETE", credentials: "include" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } finally { setDeleting(null); }
  };

  const filtered = docs.filter((d) => !q || (d.title || d.filename || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Cơ sở tri thức</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Tài liệu huấn luyện AI chatbot</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} /></button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Tìm tài liệu..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}><AlertCircle className="w-4 h-4" />{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-12 h-12 mb-3" style={{ color: "var(--border-default)" }} />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chưa có tài liệu</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Upload tài liệu để huấn luyện AI chatbot</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Tài liệu", "Loại", "Ký tự", "Trạng thái", "Ngày tải", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((doc, i) => (
                <tr key={doc.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /><span className="font-medium" style={{ color: "var(--text-primary)" }}>{doc.title || doc.filename || `Tài liệu #${doc.id}`}</span></div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-mono" style={{ color: "var(--text-muted)" }}>{doc.file_type || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{doc.char_count?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLOR[doc.status || ""] || "#6b7280"}18`, color: STATUS_COLOR[doc.status || ""] || "#6b7280" }}>{STATUS_LABEL[doc.status || ""] || doc.status || "—"}</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(doc.created_at)}</td>
                  <td className="px-4 py-3"><button onClick={() => deleteDoc(doc.id)} disabled={deleting === doc.id} className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40"><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
