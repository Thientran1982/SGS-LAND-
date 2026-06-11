// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Shield, Smartphone, Globe, Clock, LogOut, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface Session { id: string; ip?: string; user_agent?: string; created_at?: string; last_active_at?: string; is_current?: boolean; }
interface SecurityInfo { two_factor_enabled?: boolean; sessions?: Session[]; login_history?: { ip: string; created_at: string; success: boolean }[]; }

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 mb-5"><Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2></div>
      {children}
    </div>
  );
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleString("vi-VN") : "—"; }

export default function SecurityPage() {
  const [info, setInfo] = useState<SecurityInfo>({});
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/me/sessions", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/users/me/security", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([sessions, sec]) => {
      setInfo({ sessions: sessions || [], two_factor_enabled: sec?.two_factor_enabled, login_history: sec?.login_history || [] });
    }).finally(() => setLoading(false));
  }, []);

  const revokeSession = async (id: string) => {
    setRevoking(id);
    try {
      await fetch(`/api/users/me/sessions/${id}`, { method: "DELETE", credentials: "include" });
      setInfo((prev) => ({ ...prev, sessions: prev.sessions?.filter((s) => s.id !== id) }));
      setToast({ ok: true, msg: "Đã thu hồi phiên đăng nhập" });
    } catch { setToast({ ok: false, msg: "Lỗi thu hồi phiên" }); } finally { setRevoking(null); }
  };

  if (loading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bảo mật tài khoản</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý bảo mật và phiên đăng nhập</p></div>
      {toast && <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: toast.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: toast.ok ? "#10b981" : "#ef4444" }}>
        {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
      </div>}

      <Card title="Xác thực hai bước (2FA)" icon={Smartphone}>
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          <div>
            <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>Xác thực hai bước</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Tăng cường bảo mật với mã OTP</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: info.two_factor_enabled ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: info.two_factor_enabled ? "#10b981" : "#ef4444" }}>
            {info.two_factor_enabled ? "Đã bật" : "Chưa bật"}
          </span>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>Để cấu hình 2FA, vui lòng liên hệ quản trị viên hệ thống.</p>
      </Card>

      <Card title="Phiên đăng nhập đang hoạt động" icon={Globe}>
        {(info.sessions || []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Không có phiên nào</p>
        ) : (
          <div className="space-y-3">
            {(info.sessions || []).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.is_current ? "Phiên hiện tại" : s.ip || "—"}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.user_agent?.split(")")[0]?.replace("(", "")?.trim() || "—"} · {fmtDate(s.last_active_at)}</p>
                </div>
                {!s.is_current && (
                  <button onClick={() => revokeSession(s.id)} disabled={revoking === s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                    {revoking === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}Thu hồi
                  </button>
                )}
                {s.is_current && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>Hiện tại</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Lịch sử đăng nhập" icon={Clock}>
        {(info.login_history || []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Chưa có lịch sử</p>
        ) : (
          <div className="space-y-2">
            {(info.login_history || []).slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-2 border-b last:border-0" style={{ borderColor: "var(--border-default)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{h.ip || "—"}</span>
                <span style={{ color: h.success ? "#10b981" : "#ef4444" }}>{h.success ? "Thành công" : "Thất bại"}</span>
                <span style={{ color: "var(--text-muted)" }}>{fmtDate(h.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
