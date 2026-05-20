"use client";

import { useEffect, useState } from "react";
import { User, Save, Loader2, AlertCircle, CheckCircle, KeyRound } from "lucide-react";

interface UserProfile { id: number; name: string; email: string; phone?: string; role?: string; created_at?: string; }
const inp = "w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all";
const inpS: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
const ROLE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Quản trị viên", TEAM_LEAD: "Trưởng nhóm", SALES: "Kinh doanh", VIEWER: "Xem" };

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 mb-5"><Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2></div>
      {children}
    </div>
  );
}
function Toast({ ok, msg }: { ok: boolean; msg: string }) {
  return <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: ok ? "#10b981" : "#ef4444" }}>{ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg}</div>;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwToast, setPwToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/users/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setUser(d); setForm({ name: d.name || "", phone: d.phone || "" }); } })
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setToast(null);
    try {
      const r = await fetch("/api/users/me", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      const d = await r.json();
      setToast(r.ok ? { ok: true, msg: "Cập nhật thành công!" } : { ok: false, msg: d.message || "Lỗi cập nhật" });
    } catch { setToast({ ok: false, msg: "Lỗi kết nối" }); } finally { setSaving(false); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setPwToast({ ok: false, msg: "Mật khẩu xác nhận không khớp" }); return; }
    setPwSaving(true); setPwToast(null);
    try {
      const r = await fetch("/api/users/me/password", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      const d = await r.json();
      if (r.ok) { setPwToast({ ok: true, msg: "Đổi mật khẩu thành công!" }); setPw({ current: "", next: "", confirm: "" }); }
      else setPwToast({ ok: false, msg: d.message || "Lỗi đổi mật khẩu" });
    } catch { setPwToast({ ok: false, msg: "Lỗi kết nối" }); } finally { setPwSaving(false); }
  };

  if (loading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Hồ sơ cá nhân</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý thông tin tài khoản</p></div>
      <Card title="Thông tin cá nhân" icon={User}>
        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{user?.name}</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{user?.email}</p>
            <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{ROLE[user?.role || ""] || user?.role}</span>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4">
          {[["name", "Họ và tên", false], ["phone", "Số điện thoại", false]].map(([k, lbl]) => (
            <div key={k as string} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{lbl as string}</label>
              <input className={inp} style={inpS} value={(form as any)[k as string]} onChange={(e) => setForm((f) => ({ ...f, [k as string]: e.target.value }))} />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
            <input className={inp} style={{ ...inpS, opacity: 0.6 }} value={user?.email || ""} disabled />
          </div>
          {toast && <Toast ok={toast.ok} msg={toast.msg} />}
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Lưu thay đổi
          </button>
        </form>
      </Card>
      <Card title="Đổi mật khẩu" icon={KeyRound}>
        <form onSubmit={changePw} className="space-y-4">
          {([["current", "Mật khẩu hiện tại"], ["next", "Mật khẩu mới"], ["confirm", "Xác nhận mật khẩu mới"]] as const).map(([k, lbl]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{lbl}</label>
              <input type="password" className={inp} style={inpS} value={pw[k]} placeholder="••••••••" onChange={(e) => setPw((f) => ({ ...f, [k]: e.target.value }))} required />
            </div>
          ))}
          {pwToast && <Toast ok={pwToast.ok} msg={pwToast.msg} />}
          <button type="submit" disabled={pwSaving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
            {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}Đổi mật khẩu
          </button>
        </form>
      </Card>
    </div>
  );
}
