// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Target, RefreshCw, AlertCircle, Calendar, User, Flag } from "lucide-react";

interface Task {
  id: string; title: string; status?: string; priority?: string;
  deadline?: string; assignee_name?: string; category?: string;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "Cần làm", in_progress: "Đang làm", review: "Đang review",
  done: "Hoàn thành", cancelled: "Đã huỷ",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600", in_progress: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700", done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-500",
};
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-500", high: "text-orange-500", medium: "text-yellow-500", low: "text-gray-400",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Khẩn", high: "Cao", medium: "Trung bình", low: "Thấp",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchTasks = useCallback(() => {
    setLoading(true); setError(null);
    const qs = statusFilter ? `?status=${statusFilter}&limit=100` : "?limit=100";
    fetch(`/api/tasks${qs}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setTasks(Array.isArray(d) ? d : (d.tasks ?? d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const isOverdue = (t: Task) =>
    t.deadline && t.status !== "done" && t.status !== "cancelled" &&
    new Date(t.deadline) < new Date();

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Danh sách Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Tất cả công việc trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-xl outline-none"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={fetchTasks} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchTasks} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Không có task nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tasks sẽ hiển thị ở đây khi được tạo</p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr>
                {["Tiêu đề", "Trạng thái", "Ưu tiên", "Phụ trách", "Deadline", "Danh mục"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="border-t hover:bg-indigo-50/30 dark:hover:bg-sgs-primary/10 transition-colors"
                  style={{ borderColor: "var(--border-default)" }}>
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: "var(--text-primary)" }}>
                    <span className={isOverdue(t) ? "text-red-500" : ""}>{t.title}</span>
                    {isOverdue(t) && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Quá hạn</span>}
                  </td>
                  <td className="px-4 py-3">
                    {t.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.priority && (
                      <div className="flex items-center gap-1">
                        <Flag className={`w-3 h-3 ${PRIORITY_COLOR[t.priority] ?? "text-gray-400"}`} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {t.assignee_name ? <div className="flex items-center gap-1"><User className="w-3 h-3 shrink-0" />{t.assignee_name}</div> : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: isOverdue(t) ? "#dc2626" : "var(--text-tertiary)" }}>
                    {t.deadline ? <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.deadline).toLocaleDateString("vi-VN")}</div> : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>{t.category ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
