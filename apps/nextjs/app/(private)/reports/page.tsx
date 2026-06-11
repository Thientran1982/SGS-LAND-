// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, Home, FileText, RefreshCw, AlertCircle, BarChart3 } from "lucide-react";

interface DashboardStats {
  total_leads?: number;
  total_listings?: number;
  contracts_this_month?: number;
  revenue_this_month?: number;
  leads_trend?: number;
  listings_trend?: number;
}

function fmtNum(n?: number) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`;
  return n.toLocaleString("vi-VN");
}

function TrendBadge({ v }: { v?: number }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      {up ? "+" : ""}{v}%
    </span>
  );
}

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    setError(null);
    fetch("/api/analytics/dashboard", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Lỗi ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((d: DashboardStats) => setStats(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, []);

  const CARDS = [
    { label: "Tổng leads",          value: fmtNum(stats?.total_leads),            icon: Users,    trend: stats?.leads_trend,    color: "#6366f1" },
    { label: "BĐS đang quản lý",    value: fmtNum(stats?.total_listings),          icon: Home,     trend: stats?.listings_trend,  color: "#10b981" },
    { label: "Hợp đồng tháng này",  value: fmtNum(stats?.contracts_this_month),   icon: FileText, trend: undefined,              color: "#f59e0b" },
    { label: "Doanh số tháng",       value: fmtNum(stats?.revenue_this_month),     icon: TrendingUp, trend: undefined,            color: "#3b82f6" },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Báo cáo & Phân tích</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Doanh số, chuyển đổi, hiệu suất nhóm</p>
        </div>
        <button onClick={fetchStats}
          className="p-2 rounded-xl hover:opacity-70 transition-colors"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {CARDS.map(({ label, value, icon: Icon, trend, color }) => (
          <div key={label} className="p-5 rounded-2xl flex flex-col gap-3"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
              <div className="p-2 rounded-xl" style={{ background: `${color}18`, color }}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            {loading
              ? <div className="h-7 w-24 rounded-lg animate-pulse" style={{ background: "var(--border-default)" }} />
              : <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
            }
            {trend != null && !loading && (
              <div className="flex items-center gap-2">
                <TrendBadge v={trend} />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>vs. tháng trước</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Placeholder chart area */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" style={{ color: "var(--primary-600)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Biểu đồ doanh số</h2>
        </div>
        <div className="flex items-center justify-center h-48 rounded-xl"
          style={{ background: "var(--bg-app)", border: "1.5px dashed var(--border-default)" }}>
          <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
            Biểu đồ chi tiết sẽ được cập nhật trong phiên bản tiếp theo
          </p>
        </div>
      </div>
    </div>
  );
}
