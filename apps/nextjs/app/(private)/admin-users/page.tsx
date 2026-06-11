// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, RefreshCw, Shield, Mail, Phone, Calendar, UserCheck, UserX } from "lucide-react";

interface AppUser { id: number; name: string; email?: string; phone?: string; role?: string; is_active?: boolean; created_at?: string; last_login_at?: string; }

const ROLE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Quản trị viên", TEAM_LEAD: "Trưởng nhóm", SALES: "Kinh doanh", VIEWER: "Xem" };
const ROLE_COLOR: Record<string, string> = { SUPER_ADMIN: "#ef4444", ADMIN: "#f59e0b", TEAM_LEAD: "#8b5cf6", SALES: "#10b981", VIEWER: "#6b7280" };
const ROLES = Object.keys(ROLE);

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setUsers(Array.isArray(d) ? d : d.users || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (user: AppUser) => {
    setToggling(user.id);
    try {
      await fetch(`/api/users/${user.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ is_active: !user.is_active }) });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } finally { setToggling(null); }
  };

  const filtered = users.filter((u) =>
    (!roleFilter || u.role === roleFilter) &&
    (!q || u.name.toLowerCase().includes(q.toLowerCase()) || (u.email || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quản lý người dùng</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{users.length} tài khoản trong hệ thống</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input className="pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none w-60" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            placeholder="Tìm người dùng..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
        </select>
      </div>

      {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Người dùng", "Vai trò", "Ngày tham gia", "Đăng nhập cuối", "Trạng thái", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: "var(--text-secondary)" }}>Không tìm thấy người dùng</td></tr>}
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{u.name[0]?.toUpperCase()}</div>
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{u.name}</p>
                        {u.email && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${ROLE_COLOR[u.role || ""] || "#6b7280"}18`, color: ROLE_COLOR[u.role || ""] || "#6b7280" }}>{ROLE[u.role || ""] || u.role || "—"}</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmtDate(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: u.is_active !== false ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: u.is_active !== false ? "#10b981" : "#ef4444" }}>
                      {u.is_active !== false ? "Hoạt động" : "Vô hiệu"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} disabled={toggling === u.id} className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40">
                      {u.is_active !== false ? <UserX className="w-4 h-4" style={{ color: "#ef4444" }} /> : <UserCheck className="w-4 h-4" style={{ color: "#10b981" }} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
