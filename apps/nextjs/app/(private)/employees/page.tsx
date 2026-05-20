"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, RefreshCw, UserPlus, Mail, Phone, BarChart3 } from "lucide-react";

interface Employee { id: number; name: string; email?: string; phone?: string; role?: string; task_count?: number; done_count?: number; overdue_count?: number; created_at?: string; }

const ROLE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Quản trị viên", TEAM_LEAD: "Trưởng nhóm", SALES: "Kinh doanh", VIEWER: "Xem" };
const ROLE_COLOR: Record<string, string> = { SUPER_ADMIN: "#ef4444", ADMIN: "#f59e0b", TEAM_LEAD: "#8b5cf6", SALES: "#10b981", VIEWER: "#6b7280" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/reports/task-summary", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      const d = await r.json();
      setEmployees(Array.isArray(d) ? d : d.users || d.data || []);
    } catch { setError("Lỗi kết nối"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || (e.email || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Nhân viên</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Danh sách nhân viên và hiệu suất công việc</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} /></button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Tìm nhân viên..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>}
      {error && <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Nhân viên", "Vai trò", "Công việc", "Hoàn thành", "Quá hạn"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center" style={{ color: "var(--text-secondary)" }}>Chưa có nhân viên</td></tr>}
              {filtered.map((emp, i) => (
                <tr key={emp.id} style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{emp.name[0]?.toUpperCase()}</div>
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                        {emp.email && <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Mail className="w-3 h-3" />{emp.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${ROLE_COLOR[emp.role || ""] || "#6b7280"}18`, color: ROLE_COLOR[emp.role || ""] || "#6b7280" }}>{ROLE[emp.role || ""] || emp.role || "—"}</span></td>
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--text-primary)" }}>{emp.task_count ?? "—"}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: "#10b981" }}>{emp.done_count ?? "—"}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: emp.overdue_count ? "#ef4444" : "var(--text-muted)" }}>{emp.overdue_count ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
