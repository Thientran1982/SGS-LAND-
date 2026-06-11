// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Bot, RefreshCw, AlertCircle, ShieldCheck, MessageSquare, TrendingUp, ThumbsUp } from "lucide-react";

interface SafetyLog {
  id: string; input_text?: string; output_text?: string; flagged?: boolean;
  flag_reason?: string; model?: string; feature?: string;
  created_at?: string; user_name?: string;
}
interface FeedbackStats {
  total?: number; positive?: number; negative?: number; avg_score?: number;
}
interface AiConfig {
  safety_enabled?: boolean; moderation_level?: string;
  allowed_models?: string[]; cost_limit_monthly?: number;
}

const FLAG_COLOR: Record<string, string> = {
  "true": "bg-red-100 text-red-600", "false": "bg-emerald-100 text-emerald-700",
};

export default function AiGovernancePage() {
  const [logs, setLogs] = useState<SafetyLog[]>([]);
  const [fbStats, setFbStats] = useState<FeedbackStats | null>(null);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetch("/api/ai-governance/safety-logs?pageSize=50", { credentials: "include" }).then(r => r.ok ? r.json() : { logs: [] }),
      fetch("/api/ai-governance/feedback/stats", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/ai-governance/config", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ])
      .then(([logsData, statsData, configData]) => {
        setLogs(Array.isArray(logsData) ? logsData : (logsData.logs ?? logsData.data ?? []));
        if (statsData) setFbStats(statsData);
        if (configData) setConfig(configData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const flaggedCount = logs.filter(l => l.flagged).length;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AI Governance</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Giám sát an toàn và quản lý AI</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchData} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Tổng yêu cầu AI", value: logs.length, icon: Bot, color: "text-indigo-600" },
              { label: "Bị gắn cờ", value: flaggedCount, icon: ShieldCheck, color: flaggedCount > 0 ? "text-red-500" : "text-emerald-600" },
              { label: "Phản hồi", value: fbStats?.total ?? 0, icon: MessageSquare, color: "text-blue-600" },
              { label: "Tỷ lệ tích cực", value: fbStats?.total ? `${Math.round(((fbStats.positive ?? 0) / fbStats.total) * 100)}%` : "—", icon: ThumbsUp, color: "text-emerald-600" },
            ].map(k => (
              <div key={k.label} className="rounded-2xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{k.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Config */}
          {config && (
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Cấu hình An toàn AI</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Kiểm duyệt", value: config.safety_enabled ? "Bật" : "Tắt" },
                  { label: "Mức độ", value: config.moderation_level ?? "—" },
                  { label: "Giới hạn chi phí/tháng", value: config.cost_limit_monthly ? `$${config.cost_limit_monthly}` : "—" },
                  { label: "Models được phép", value: config.allowed_models?.join(", ") ?? "Tất cả" },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    <p className="font-semibold text-sm mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety logs */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 px-5 py-4"
              style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Nhật ký AI gần đây</h3>
            </div>
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot className="w-10 h-10 mb-3" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Chưa có nhật ký AI</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ background: "var(--bg-elevated)" }}>
                  <tr>
                    {["Tính năng", "Model", "Người dùng", "Gắn cờ", "Lý do", "Thời gian"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 30).map((l, i) => (
                    <tr key={l.id ?? i} className="border-t hover:bg-indigo-50/20 transition-colors"
                      style={{ borderColor: "var(--border-default)" }}>
                      <td className="px-4 py-3 text-xs font-medium text-indigo-600">{l.feature ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{l.model ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{l.user_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FLAG_COLOR[String(l.flagged)] ?? "bg-gray-100 text-gray-500"}`}>
                          {l.flagged ? "Có" : "Không"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                        {l.flag_reason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {l.created_at ? new Date(l.created_at).toLocaleString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
