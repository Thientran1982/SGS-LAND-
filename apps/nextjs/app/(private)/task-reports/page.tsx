"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertCircle, TrendingUp, Users } from "lucide-react";

interface TaskStats {
  overview?: {
    todo: number; in_progress: number; review: number;
    done: number; cancelled: number; total: number; overdue_count: number;
  };
  done_time?: { done_today: number; done_week: number };
  by_assignee?: Array<{ assignee_name: string; count: number; done: number; overdue: number }>;
  by_priority?: Array<{ priority: string; count: number }>;
  by_category?: Array<{ category: string; count: number; done: number }>;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Khẩn", high: "Cao", medium: "Trung bình", low: "Thấp",
};

export default function TaskReportsPage() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/task-reports/task-stats", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setStats(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const ov = stats?.overview;
  const completionRate = ov && ov.total > 0 ? Math.round((ov.done / ov.total) * 100) : 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Báo cáo Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Phân tích hiệu suất công việc theo thời gian</p>
        </div>
        <button onClick={fetchStats} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchStats} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-6">
          {/* Summary row */}
          {ov && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Tổng", value: ov.total, sub: "tasks" },
                { label: "Hoàn thành", value: ov.done, sub: `${completionRate}%` },
                { label: "Quá hạn", value: ov.overdue_count, sub: "cần xử lý" },
                { label: "Xong tuần này", value: stats.done_time?.done_week ?? 0, sub: "tasks" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Completion rate */}
          {ov && (
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Tỷ lệ hoàn thành theo trạng thái</h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { key: "todo", label: "Cần làm", val: ov.todo, color: "#6b7280" },
                  { key: "in_progress", label: "Đang làm", val: ov.in_progress, color: "#3b82f6" },
                  { key: "review", label: "Review", val: ov.review, color: "#f59e0b" },
                  { key: "done", label: "Xong", val: ov.done, color: "#10b981" },
                  { key: "cancelled", label: "Huỷ", val: ov.cancelled, color: "#ef4444" },
                ].map(s => (
                  <div key={s.key} className="text-center">
                    <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
                    <div className="h-1 rounded-full mt-2" style={{ background: "var(--border-default)" }}>
                      <div className="h-1 rounded-full" style={{ background: s.color, width: `${ov.total ? Math.round((s.val / ov.total) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By assignee table */}
          {stats.by_assignee && stats.by_assignee.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                <Users className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Hiệu suất theo nhân viên</h3>
              </div>
              <table className="w-full text-sm">
                <thead style={{ background: "var(--bg-elevated)" }}>
                  <tr>
                    {["Nhân viên", "Tổng", "Hoàn thành", "Quá hạn", "% Xong"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.by_assignee.map(a => {
                    const pct = a.count > 0 ? Math.round((a.done / a.count) * 100) : 0;
                    return (
                      <tr key={a.assignee_name} className="border-t hover:bg-indigo-50/20 transition-colors"
                        style={{ borderColor: "var(--border-default)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{a.assignee_name ?? "Chưa giao"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{a.count}</td>
                        <td className="px-4 py-3 text-xs text-emerald-600">{a.done}</td>
                        <td className="px-4 py-3 text-xs text-red-500">{a.overdue ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border-default)" }}>
                              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
