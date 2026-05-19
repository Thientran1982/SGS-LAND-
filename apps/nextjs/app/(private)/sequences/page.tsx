"use client";
import { useEffect, useState, useCallback } from "react";
import { Workflow, RefreshCw, AlertCircle, Users, Play, Pause } from "lucide-react";

interface Sequence {
  id: string; name: string; description?: string; status?: string;
  trigger_type?: string; steps_count?: number; enrolled_count?: number;
  active_count?: number; completed_count?: number; created_at?: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700", paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600", archived: "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Đang chạy", paused: "Tạm dừng", draft: "Nháp", archived: "Lưu trữ",
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSequences = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/sequences", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setSequences(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Email Sequences</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Chuỗi email tự động theo hành trình khách hàng</p>
        </div>
        <button onClick={fetchSequences} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchSequences} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && sequences.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Workflow className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có sequence nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tạo sequence để tự động hóa quy trình chăm sóc lead</p>
        </div>
      )}

      {!loading && sequences.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sequences.map(s => (
            <div key={s.id} className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                  {s.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{s.description}</p>
                  )}
                </div>
                {s.status && (
                  <span className={`shrink-0 ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                {s.steps_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Workflow className="w-3.5 h-3.5" />{s.steps_count} bước
                  </div>
                )}
                {s.enrolled_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />{s.enrolled_count} đã đăng ký
                  </div>
                )}
                {s.active_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Play className="w-3.5 h-3.5 text-emerald-500" />{s.active_count} đang chạy
                  </div>
                )}
                {s.completed_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Pause className="w-3.5 h-3.5 text-blue-500" />{s.completed_count} xong
                  </div>
                )}
              </div>
              {s.trigger_type && (
                <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}>
                  Trigger: <span style={{ color: "var(--text-secondary)" }}>{s.trigger_type}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
