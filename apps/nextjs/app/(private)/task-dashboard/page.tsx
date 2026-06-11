// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, AlertCircle, BarChart3, RefreshCw, Flame, Calendar } from "lucide-react";

interface TaskStats {
  overview?: {
    todo: number; in_progress: number; review: number; done: number;
    cancelled: number; total: number; overdue_count: number;
    due_today_count: number; due_this_week_count: number;
  };
  done_time?: { done_today: number; done_week: number };
  by_priority?: Array<{ priority: string; count: number }>;
  by_assignee?: Array<{ assignee_name: string; count: number; done: number }>;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Khẩn cấp", high: "Cao", medium: "Trung bình", low: "Thấp",
};

export default function TaskDashboardPage() {
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

  const kpis = ov ? [
    { label: "Tổng tasks", value: ov.total, icon: BarChart3, color: "from-indigo-500 to-purple-600" },
    { label: "Đang thực hiện", value: ov.in_progress, icon: Clock, color: "from-blue-500 to-cyan-500" },
    { label: "Hoàn thành", value: ov.done, icon: CheckCircle2, color: "from-emerald-500 to-teal-500" },
    { label: "Quá hạn", value: ov.overdue_count, icon: AlertCircle, color: "from-red-500 to-rose-600" },
    { label: "Xong hôm nay", value: stats?.done_time?.done_today ?? 0, icon: Flame, color: "from-orange-500 to-amber-500" },
    { label: "Đến hạn tuần này", value: ov.due_this_week_count, icon: Calendar, color: "from-violet-500 to-purple-500" },
  ] : [];

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Tổng quan Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Thống kê hiệu suất công việc</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {kpis.map(k => (
              <div key={k.label}>
                <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${k.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium opacity-90">{k.label}</span>
                    <k.icon className="w-5 h-5 opacity-80" />
                  </div>
                  <p className="text-3xl font-bold">{k.value ?? 0}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By priority */}
            {stats.by_priority && stats.by_priority.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <h3 className="font-semibold mb-4 text-sm" style={{ color: "var(--text-primary)" }}>Phân bổ theo ưu tiên</h3>
                <div className="space-y-3">
                  {stats.by_priority.map(p => {
                    const total = ov?.total || 1;
                    const pct = Math.round((p.count / total) * 100);
                    return (
                      <div key={p.priority}>
                        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                          <span>{PRIORITY_LABEL[p.priority] ?? p.priority}</span>
                          <span>{p.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: "var(--border-default)" }}>
                          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By assignee */}
            {stats.by_assignee && stats.by_assignee.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <h3 className="font-semibold mb-4 text-sm" style={{ color: "var(--text-primary)" }}>Top nhân viên</h3>
                <div className="space-y-3">
                  {stats.by_assignee.slice(0, 6).map(a => (
                    <div key={a.assignee_name} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{a.assignee_name ?? "Chưa giao"}</span>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span>{a.done}/{a.count} xong</span>
                        <div className="w-20 h-1.5 rounded-full" style={{ background: "var(--border-default)" }}>
                          <div className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${a.count ? Math.round((a.done / a.count) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
