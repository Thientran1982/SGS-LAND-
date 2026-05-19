"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertCircle, Flag, Calendar, User } from "lucide-react";

interface Task {
  id: string; title: string; status: string; priority?: string;
  deadline?: string; assignee_name?: string; category?: string;
}

const COLUMNS = [
  { key: "todo",        label: "Cần làm",        color: "#6b7280", bg: "bg-gray-50 dark:bg-gray-800/40" },
  { key: "in_progress", label: "Đang làm",        color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-900/20" },
  { key: "review",      label: "Đang review",     color: "#f59e0b", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  { key: "done",        label: "Hoàn thành",      color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
];
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-500", high: "text-orange-500", medium: "text-yellow-500", low: "text-gray-400",
};

export default function TaskKanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/tasks?limit=200", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setTasks(Array.isArray(d) ? d : (d.tasks ?? d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const byStatus = (status: string) => tasks.filter(t => t.status === status);
  const isOverdue = (t: Task) =>
    t.deadline && !["done", "cancelled"].includes(t.status) && new Date(t.deadline) < new Date();

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bảng Kanban</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Kéo thả để cập nhật trạng thái</p>
        </div>
        <button onClick={fetchTasks} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchTasks} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-96 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = byStatus(col.key);
            return (
              <div key={col.key} className="rounded-2xl p-4 min-h-[400px]"
                style={{ background: "var(--bg-elevated)", border: `2px solid ${col.color}22` }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{col.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${col.color}22`, color: col.color }}>{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(t => (
                    <div key={t.id} className="rounded-xl p-3 text-sm cursor-pointer hover:shadow-sm transition-shadow"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
                      <p className={`font-medium mb-2 leading-snug ${isOverdue(t) ? "text-red-500" : ""}`}
                        style={isOverdue(t) ? undefined : { color: "var(--text-primary)" }}>
                        {t.title}
                        {isOverdue(t) && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full">QH</span>}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.priority && (
                          <div className="flex items-center gap-0.5">
                            <Flag className={`w-3 h-3 ${PRIORITY_COLOR[t.priority] ?? "text-gray-400"}`} />
                          </div>
                        )}
                        {t.deadline && (
                          <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(t.deadline).toLocaleDateString("vi-VN")}
                          </div>
                        )}
                        {t.assignee_name && (
                          <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            <User className="w-2.5 h-2.5" />{t.assignee_name.split(" ").slice(-1)[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: "var(--text-tertiary)" }}>Không có task</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
