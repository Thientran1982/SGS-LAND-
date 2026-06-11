// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { CreditCard, Zap, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Calendar } from "lucide-react";

interface BillingPlan { plan?: string; status?: string; trial_ends_at?: string; current_period_end?: string; seats?: number; used_seats?: number; }
interface UsageItem { metric: string; used: number; limit: number; unit?: string; }

const PLAN_LABEL: Record<string, string> = { free: "Miễn phí", starter: "Starter", growth: "Growth", enterprise: "Enterprise" };
const PLAN_COLOR: Record<string, string> = { free: "#6b7280", starter: "#6366f1", growth: "#10b981", enterprise: "#f59e0b" };

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 mb-5"><Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2></div>
      {children}
    </div>
  );
}

export default function BillingPage() {
  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/plan", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/billing/usage", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([p, u]) => {
      if (p) setPlan(p);
      if (u) setUsage(Array.isArray(u) ? u : u.usage || []);
    }).finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST", credentials: "include" });
      if (r.ok) { const d = await r.json(); if (d.url) window.open(d.url, "_blank"); }
    } finally { setPortalLoading(false); }
  };

  if (loading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>;

  const planKey = plan?.plan || "free";
  const planColor = PLAN_COLOR[planKey] || "#6b7280";

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Thanh toán & Gói dịch vụ</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý gói dịch vụ và hóa đơn</p></div>

      <Card title="Gói hiện tại" icon={CreditCard}>
        <div className="flex items-center justify-between p-4 rounded-xl mb-4" style={{ background: "var(--bg-elevated)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold" style={{ color: planColor }}>{PLAN_LABEL[planKey] || planKey}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${planColor}18`, color: planColor }}>
                {plan?.status === "active" ? "Đang hoạt động" : plan?.status === "trialing" ? "Dùng thử" : plan?.status || "—"}
              </span>
            </div>
            {plan?.current_period_end && (
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <Calendar className="w-3.5 h-3.5" />Gia hạn: {new Date(plan.current_period_end).toLocaleDateString("vi-VN")}
              </p>
            )}
            {plan?.trial_ends_at && (
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#f59e0b" }}>
                <AlertCircle className="w-3.5 h-3.5" />Hết dùng thử: {new Date(plan.trial_ends_at).toLocaleDateString("vi-VN")}
              </p>
            )}
          </div>
          {plan?.seats && (
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.used_seats || 0}<span className="text-sm font-normal ml-1" style={{ color: "var(--text-secondary)" }}>/ {plan.seats}</span></p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>người dùng</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={openPortal} disabled={portalLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary-600)", color: "#fff" }}>
            {portalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}Quản lý thanh toán
          </button>
        </div>
      </Card>

      {usage.length > 0 && (
        <Card title="Sử dụng tài nguyên" icon={Zap}>
          <div className="space-y-4">
            {usage.map((u) => {
              const pct = Math.min(100, Math.round((u.used / u.limit) * 100));
              const danger = pct >= 90;
              return (
                <div key={u.metric}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span style={{ color: "var(--text-primary)" }}>{u.metric}</span>
                    <span style={{ color: danger ? "#ef4444" : "var(--text-secondary)" }}>{u.used.toLocaleString()} / {u.limit.toLocaleString()} {u.unit || ""}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: danger ? "#ef4444" : "var(--primary-600)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card title="Tính năng gói dịch vụ" icon={CheckCircle}>
        <ul className="space-y-2">
          {["CRM leads & khách hàng", "Quản lý dự án & kho hàng", "Báo cáo & thống kê", "Tích hợp Facebook, Zalo", "AI định giá tự động", "Hỗ trợ ưu tiên 24/7"].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />{f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
