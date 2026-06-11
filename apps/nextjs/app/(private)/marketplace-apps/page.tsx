// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Puzzle, RefreshCw, AlertCircle, Zap, CheckCircle2, XCircle } from "lucide-react";

interface Connector {
  id: string; name: string; type?: string; status?: string;
  config?: Record<string, unknown>; last_synced_at?: string; created_at?: string;
}

const TYPE_ICON: Record<string, string> = {
  facebook: "F", zalo: "Z", google: "G", hubspot: "H",
  zapier: "Zap", webhook: "🔗", email: "✉",
};
const TYPE_LABEL: Record<string, string> = {
  facebook: "Facebook Ads", zalo: "Zalo OA", google: "Google Ads",
  hubspot: "HubSpot", zapier: "Zapier", webhook: "Webhook", email: "Email",
};

const AVAILABLE_APPS = [
  { type: "facebook", label: "Facebook Ads", desc: "Đồng bộ leads từ Facebook Lead Ads" },
  { type: "zalo", label: "Zalo OA", desc: "Gửi tin nhắn qua Zalo Official Account" },
  { type: "google", label: "Google Ads", desc: "Theo dõi chuyển đổi từ Google Ads" },
  { type: "hubspot", label: "HubSpot", desc: "Đồng bộ dữ liệu với HubSpot CRM" },
  { type: "zapier", label: "Zapier", desc: "Kết nối với 5000+ ứng dụng qua Zapier" },
  { type: "webhook", label: "Webhook", desc: "Nhận dữ liệu từ nguồn tùy chỉnh" },
];

export default function MarketplaceAppsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnectors = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/connectors", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setConnectors(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  const connectedTypes = new Set(connectors.map(c => c.type));

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Marketplace Ứng dụng</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Kết nối và quản lý tích hợp bên thứ ba</p>
        </div>
        <button onClick={fetchConnectors} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchConnectors} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {/* Active connections */}
      {!loading && connectors.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>ĐÃ KẾT NỐI ({connectors.length})</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {connectors.map(c => (
              <div key={c.id} className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  {TYPE_ICON[c.type ?? ""] ?? <Puzzle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                    {c.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {TYPE_LABEL[c.type ?? ""] ?? c.type}
                    {c.last_synced_at && ` · Sync: ${new Date(c.last_synced_at).toLocaleDateString("vi-VN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.status === "active" || !c.status
                    ? <CheckCircle2 className="w-4 h-4 text-sgs-verified" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {c.status === "active" || !c.status ? "Hoạt động" : "Lỗi"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {/* Available apps */}
      {!loading && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>ỨNG DỤNG CÓ SẴN</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_APPS.map(app => {
              const connected = connectedTypes.has(app.type);
              return (
                <div key={app.type} className="rounded-2xl p-5"
                  style={{ background: "var(--bg-elevated)", border: `1px solid ${connected ? "#10b98133" : "var(--border-default)"}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: connected ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                      {TYPE_ICON[app.type] ?? <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{app.label}</p>
                      {connected && <span className="text-[10px] text-sgs-verified font-medium">● Đã kết nối</span>}
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{app.desc}</p>
                  <button className="mt-4 w-full py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: connected ? "var(--border-default)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      color: connected ? "var(--text-secondary)" : "white",
                    }}>
                    {connected ? "Cài đặt" : "Kết nối"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
