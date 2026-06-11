// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Building2, Save, Loader2, CheckCircle, AlertCircle, Globe, Bell, Palette } from "lucide-react";

interface TenantSettings { id?: number; name?: string; logo_url?: string; primary_color?: string; timezone?: string; language?: string; notification_email?: string; facebook_page_id?: string; zalo_oa_id?: string; }

const inp = "w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/30";
const inpS: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 mb-5"><Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2></div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}

export default function EnterpriseSettingsPage() {
  const [form, setForm] = useState<TenantSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/tenant/settings", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm(d.settings || d); })
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setToast(null);
    try {
      const r = await fetch("/api/tenant/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      const d = await r.json();
      setToast(r.ok ? { ok: true, msg: "Lưu cài đặt thành công!" } : { ok: false, msg: d.message || "Lỗi lưu cài đặt" });
    } catch { setToast({ ok: false, msg: "Lỗi kết nối" }); } finally { setSaving(false); }
  };

  const set = (k: keyof TenantSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Cài đặt doanh nghiệp</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Tùy chỉnh workspace của công ty bạn</p></div>
      <form onSubmit={save} className="space-y-6">
        <Card title="Thông tin công ty" icon={Building2}>
          <div className="space-y-4">
            <Field label="Tên công ty"><input className={inp} style={inpS} value={form.name || ""} onChange={set("name")} placeholder="SGS Land Corp" /></Field>
            <Field label="URL logo"><input className={inp} style={inpS} value={form.logo_url || ""} onChange={set("logo_url")} placeholder="https://..." /></Field>
            <Field label="Màu chủ đạo (hex)"><input className={inp} style={inpS} value={form.primary_color || ""} onChange={set("primary_color")} placeholder="#4F46E5" /></Field>
          </div>
        </Card>
        <Card title="Khu vực & ngôn ngữ" icon={Globe}>
          <div className="space-y-4">
            <Field label="Múi giờ">
              <select className={inp} style={inpS} value={form.timezone || "Asia/Ho_Chi_Minh"} onChange={set("timezone")}>
                <option value="Asia/Ho_Chi_Minh">Việt Nam (GMT+7)</option>
                <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                <option value="Asia/Singapore">Singapore (GMT+8)</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label="Ngôn ngữ">
              <select className={inp} style={inpS} value={form.language || "vi"} onChange={set("language")}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
        </Card>
        <Card title="Thông báo & Tích hợp" icon={Bell}>
          <div className="space-y-4">
            <Field label="Email nhận thông báo"><input type="email" className={inp} style={inpS} value={form.notification_email || ""} onChange={set("notification_email")} placeholder="admin@company.com" /></Field>
            <Field label="Facebook Page ID"><input className={inp} style={inpS} value={form.facebook_page_id || ""} onChange={set("facebook_page_id")} placeholder="123456789..." /></Field>
            <Field label="Zalo OA ID"><input className={inp} style={inpS} value={form.zalo_oa_id || ""} onChange={set("zalo_oa_id")} placeholder="..." /></Field>
          </div>
        </Card>
        {toast && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: toast.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: toast.ok ? "#10b981" : "#ef4444" }}>
            {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
          </div>
        )}
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Lưu cài đặt
        </button>
      </form>
    </div>
  );
}
