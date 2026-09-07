// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Users, FileText, TrendingUp,
  Home, MessageSquare, Target, Settings,
  Bell, LogOut, ChevronRight, Activity,
} from "lucide-react";
import type { DashboardStats } from "@/types";
import LandingNavSection from "./LandingNavSection";

// ─── Sidebar nav items ────────────────────────────────────
const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard",      icon: BarChart3 },
  { href: "/leads",       label: "Leads",          icon: Users },
  { href: "/contracts",   label: "Hợp đồng",       icon: FileText },
  { href: "/tasks",       label: "Tasks",           icon: Target },
  { href: "/inbox",       label: "Inbox",           icon: MessageSquare },
  { href: "/inventory",   label: "BĐS quản lý",    icon: Home },
  { href: "/reports",     label: "Báo cáo",         icon: TrendingUp },
  { href: "/profile",     label: "Cài đặt",         icon: Settings },
];

function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <div
      className="p-5 rounded-2xl flex flex-col gap-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <div className="p-2 rounded-xl" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {trend !== undefined && (
        <p className="text-xs flex items-center gap-1"
          style={{ color: trend >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
          <Activity className="w-3 h-3" />
          {trend >= 0 ? "+" : ""}{trend}% so với tháng trước
        </p>
      )}
    </div>
  );
}

// ─── Main Dashboard Shell ─────────────────────────────────
export function DashboardShell() {
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      try {
        localStorage.removeItem("sgs_auth_cached");
        localStorage.removeItem("sgs_auth_user");
      } catch {}
      window.location.assign("/login");
    }
  }

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/dashboard", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DashboardStats | null) => { if (d) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtNumber = (n?: number) => {
    if (n == null) return "—";
    if (n >= 1e9)  return `${(n / 1e9).toFixed(1)} tỷ`;
    if (n >= 1e6)  return `${(n / 1e6).toFixed(0)} triệu`;
    return n.toLocaleString("vi-VN");
  };

  const STAT_CARDS = [
    { label: "Tổng leads",         value: loading ? "..." : (stats?.total_leads ?? 0).toLocaleString("vi-VN"),         icon: Users,     trend: stats?.leads_trend },
    { label: "BĐS đang quản lý",   value: loading ? "..." : (stats?.total_listings ?? 0).toLocaleString("vi-VN"),      icon: Home,      trend: stats?.listings_trend },
    { label: "Hợp đồng tháng này", value: loading ? "..." : (stats?.contracts_this_month ?? 0).toLocaleString("vi-VN"), icon: FileText },
    { label: "Doanh số tháng",     value: loading ? "..." : fmtNumber(stats?.revenue_this_month),                       icon: TrendingUp },
  ] as const;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 py-6"
        style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
      >
        <div className="px-5 mb-8">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black" style={{ color: "var(--primary-600)" }}>SGS</span>
            <span className="text-xl font-black" style={{ color: "var(--text-primary)" }}>LAND</span>
          </Link>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>CRM Platform</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group"
              style={{ color: "var(--text-secondary)" }}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />
            </Link>
          ))}
          <LandingNavSection />
        </nav>

        <div className="px-3 pt-4 mt-4 border-t space-y-0.5" style={{ borderColor: "var(--border-default)" }}>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            <Bell className="w-4 h-4" />
            Thông báo
          </button>
          <button type="button" onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: "var(--color-error)" }}>
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <Link href="/leads"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--primary-600)" }}>
            <Users className="w-4 h-4" />
            Thêm Lead
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {STAT_CARDS.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: "/leads",     label: "Quản lý Leads",       desc: "Xem, phân loại và follow-up leads",     icon: Users },
            { href: "/contracts", label: "Hợp đồng",            desc: "Theo dõi hợp đồng và thanh toán",       icon: FileText },
            { href: "/reports",   label: "Báo cáo & Phân tích", desc: "Doanh số, chuyển đổi, hiệu suất nhóm",  icon: BarChart3 },
          ].map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href}
              className="p-5 rounded-2xl flex items-start gap-4 hover:scale-[1.01] transition-transform group"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1 group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>{label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
