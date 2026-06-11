// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Building2, RefreshCw, AlertCircle, Calendar, Shield } from "lucide-react";

interface AuditLog {
  id: string; action?: string; actor_name?: string; actor_email?: string;
  target?: string; details?: string; created_at?: string; ip_address?: string;
}

interface EnterpriseConfig {
  id?: string; sso_enabled?: boolean; scim_enabled?: boolean;
  mfa_required?: boolean; branding?: Record<string, unknown>;
  plan?: string; max_users?: number;
}

export default function VendorManagementPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [config, setConfig] = useState<EnterpriseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetch("/api/enterprise/audit-logs", { credentials: "include" }).then(r => r.ok ? r.json() : { data: [] }),
      fetch("/api/enterprise/config", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ])
      .then(([logsData, configData]) => {
        setLogs(Array.isArray(logsData) ? logsData : (logsData.data ?? logsData.logs ?? []));
        if (configData) setConfig(configData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quản lý Vendor</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Cấu hình doanh nghiệp và nhật ký kiểm toán</p>
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
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Config overview */}
          {config && (
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Cấu hình Enterprise</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Gói dịch vụ", value: config.plan ?? "—" },
                  { label: "Tối đa users", value: config.max_users?.toString() ?? "—" },
                  { label: "SSO", value: config.sso_enabled ? "Bật" : "Tắt" },
                  { label: "MFA bắt buộc", value: config.mfa_required ? "Có" : "Không" },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit logs */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 px-5 py-4"
              style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
              <Shield className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Nhật ký kiểm toán</h3>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="w-10 h-10 mb-3" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Chưa có nhật ký nào được ghi lại</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ background: "var(--bg-elevated)" }}>
                  <tr>
                    {["Hành động", "Thực hiện bởi", "Đối tượng", "IP", "Thời gian"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id ?? i} className="border-t hover:bg-indigo-50/20 transition-colors"
                      style={{ borderColor: "var(--border-default)" }}>
                      <td className="px-4 py-3 text-xs font-mono font-medium text-sgs-primary">{log.action ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>
                        {log.actor_name ?? log.actor_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{log.target ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{log.ip_address ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {log.created_at ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(log.created_at).toLocaleString("vi-VN")}
                          </div>
                        ) : "—"}
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
