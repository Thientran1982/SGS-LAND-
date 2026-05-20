"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Users, FileText, TrendingUp,
  Home, MessageSquare, Target, Settings,
  Bell, LogOut, ChevronRight, Building2,
  ClipboardList, ShieldCheck, Zap, Globe,
  Menu, X, DollarSign, Server, BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Dashboard",         icon: BarChart3 },
  { href: "/leads",           label: "Leads",              icon: Users },
  { href: "/inventory",       label: "BĐS quản lý",        icon: Home },
  { href: "/contracts",       label: "Hợp đồng",           icon: FileText },
  { href: "/commissions",     label: "Hoa hồng",           icon: DollarSign },
  { href: "/tasks",           label: "Tasks",               icon: Target },
  { href: "/inbox",           label: "Inbox",               icon: MessageSquare },
  { href: "/reports",         label: "Báo cáo",             icon: TrendingUp },
  { href: "/campaigns",       label: "Chiến dịch",          icon: Zap },
  { href: "/projects",        label: "Dự án",               icon: Building2 },
  { href: "/approvals",       label: "Phê duyệt",          icon: ClipboardList },
  { href: "/seo-manager",     label: "SEO Manager",         icon: Globe },
  { href: "/security",        label: "Bảo mật",             icon: ShieldCheck },
  { href: "/system-status",   label: "Trạng thái hệ thống", icon: Server },
  { href: "/user-guide",      label: "Hướng dẫn",           icon: BookOpen },
  { href: "/profile",         label: "Cài đặt",             icon: Settings },
];

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = () => (
    <aside
      className="flex flex-col w-60 shrink-0 py-6 h-screen sticky top-0"
      style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
    >
      <div className="px-5 mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5">
          <span className="text-xl font-black" style={{ color: "var(--primary-600)" }}>SGS</span>
          <span className="text-xl font-black" style={{ color: "var(--text-primary)" }}>LAND</span>
        </Link>
        <button
          className="lg:hidden p-1 rounded-lg"
          onClick={() => setMobileOpen(false)}
          style={{ color: "var(--text-secondary)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="px-5 text-[10px] mb-4" style={{ color: "var(--text-tertiary)" }}>CRM Platform</p>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group"
              style={{
                color: active ? "var(--primary-600)" : "var(--text-secondary)",
                background: active ? "var(--primary-subtle)" : "transparent",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {!active && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pt-4 mt-4 border-t space-y-0.5" style={{ borderColor: "var(--border-default)" }}>
        <Link href="/api/auth/logout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
          style={{ color: "var(--color-error)" }}>
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-60 h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-1">
            <span className="text-base font-black" style={{ color: "var(--primary-600)" }}>SGS</span>
            <span className="text-base font-black" style={{ color: "var(--text-primary)" }}>LAND</span>
          </Link>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
