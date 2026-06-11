// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Megaphone, RefreshCw, AlertCircle, Mail, MessageCircle, Eye, MousePointerClick } from "lucide-react";

interface Campaign {
  id: string; name: string; description?: string; channel?: string;
  status?: string; send_count?: number; open_count?: number;
  click_count?: number; last_run_at?: string; created_at?: string;
  schedule_type?: string; subject?: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", active: "bg-emerald-100 text-emerald-700",
  paused: "bg-yellow-100 text-yellow-700", completed: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp", active: "Đang chạy", paused: "Tạm dừng",
  completed: "Hoàn thành", failed: "Lỗi",
};
const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageCircle className="w-3.5 h-3.5" />,
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/campaigns", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setCampaigns(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const totalSent = campaigns.reduce((s, c) => s + (c.send_count ?? 0), 0);
  const totalOpen = campaigns.reduce((s, c) => s + (c.open_count ?? 0), 0);
  const totalClick = campaigns.reduce((s, c) => s + (c.click_count ?? 0), 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Chiến dịch Marketing</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý email & SMS campaigns</p>
        </div>
        <button onClick={fetchCampaigns} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchCampaigns} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {/* Summary KPIs */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Đã gửi", value: totalSent.toLocaleString("vi-VN"), icon: Mail, color: "text-blue-600" },
            { label: "Đã mở", value: totalOpen.toLocaleString("vi-VN"), icon: Eye, color: "text-emerald-600" },
            { label: "Đã click", value: totalClick.toLocaleString("vi-VN"), icon: MousePointerClick, color: "text-violet-600" },
          ].map(k => (
            <div key={k.label} className="rounded-2xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-2">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{k.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có chiến dịch nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tạo chiến dịch để gửi email marketing đến leads</p>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr>
                {["Tên chiến dịch", "Kênh", "Trạng thái", "Đã gửi", "Mở", "Click", "Lần chạy cuối"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const openRate = c.send_count ? Math.round(((c.open_count ?? 0) / c.send_count) * 100) : 0;
                const clickRate = c.send_count ? Math.round(((c.click_count ?? 0) / c.send_count) * 100) : 0;
                return (
                  <tr key={c.id} className="border-t hover:bg-indigo-50/20 transition-colors"
                    style={{ borderColor: "var(--border-default)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</div>
                      {c.subject && <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{c.subject}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {CHANNEL_ICON[c.channel ?? "email"] ?? <Mail className="w-3.5 h-3.5" />}
                        {c.channel?.toUpperCase() ?? "EMAIL"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.status && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {(c.send_count ?? 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-sgs-verified">{openRate}%</td>
                    <td className="px-4 py-3 text-xs text-sgs-primary">{clickRate}%</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {c.last_run_at ? new Date(c.last_run_at).toLocaleDateString("vi-VN") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
