"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, RefreshCw, Search, User, Clock } from "lucide-react";

interface Thread {
  id: number; lead_id?: number; lead_name?: string; lead_phone?: string; lead_email?: string;
  last_message?: string; last_message_at?: string; unread_count?: number;
  source?: string; status?: string; assignee_name?: string;
}

const SOURCE_LABEL: Record<string, string> = { facebook: "Facebook", zalo: "Zalo", website: "Website", phone: "Điện thoại", email: "Email", direct: "Trực tiếp" };
const SOURCE_COLOR: Record<string, string> = { facebook: "#1877F2", zalo: "#0068FF", website: "#6366f1", phone: "#10b981", email: "#f59e0b", direct: "#8b5cf6" };

function fmtTime(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 60000) return "vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return dt.toLocaleDateString("vi-VN");
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/inbox/threads?limit=50", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải hộp thư");
      const d = await r.json();
      setThreads(Array.isArray(d) ? d : d.threads || d.data || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Lỗi kết nối"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = threads.filter((t) => !q || (t.lead_name || "").toLowerCase().includes(q.toLowerCase()) || (t.last_message || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Thread list */}
      <div className="w-80 shrink-0 flex flex-col border-r" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold" style={{ color: "var(--text-primary)" }}>Hộp thư ({threads.length})</h1>
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
              placeholder="Tìm cuộc trò chuyện..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && [...Array(8)].map((_, i) => <div key={i} className="p-4 border-b animate-pulse" style={{ borderColor: "var(--border-default)" }}><div className="h-4 w-32 rounded mb-2" style={{ background: "var(--border-default)" }} /><div className="h-3 w-48 rounded" style={{ background: "var(--border-default)" }} /></div>)}
          {error && <div className="p-4 text-sm" style={{ color: "#ef4444" }}>{error}</div>}
          {!loading && filtered.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-center px-4"><MessageSquare className="w-10 h-10 mb-2" style={{ color: "var(--border-default)" }} /><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Chưa có tin nhắn</p></div>}
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className="w-full text-left p-4 border-b transition-colors hover:opacity-80" style={{ borderColor: "var(--border-default)", background: selected?.id === t.id ? "var(--primary-subtle)" : "transparent" }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: SOURCE_COLOR[t.source || ""] || "#6b7280", color: "#fff" }}>
                    {(t.lead_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.lead_name || "Khách hàng"}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{SOURCE_LABEL[t.source || ""] || t.source || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtTime(t.last_message_at)}</span>
                  {(t.unread_count || 0) > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "var(--primary-600)", color: "#fff" }}>{t.unread_count}</span>}
                </div>
              </div>
              {t.last_message && <p className="text-xs truncate ml-10" style={{ color: "var(--text-secondary)" }}>{t.last_message}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation panel */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: "var(--bg-app)" }}>
        {selected ? (
          <div className="w-full h-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: SOURCE_COLOR[selected.source || ""] || "#6b7280", color: "#fff" }}>
                {(selected.lead_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{selected.lead_name || "Khách hàng"}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{selected.lead_phone || selected.lead_email || SOURCE_LABEL[selected.source || ""] || "—"}</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Chọn cuộc trò chuyện để xem tin nhắn chi tiết trong ứng dụng Vite</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <MessageSquare className="w-14 h-14 mx-auto mb-3" style={{ color: "var(--border-default)" }} />
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>Chọn cuộc trò chuyện</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Danh sách tin nhắn với khách hàng</p>
          </div>
        )}
      </div>
    </div>
  );
}
