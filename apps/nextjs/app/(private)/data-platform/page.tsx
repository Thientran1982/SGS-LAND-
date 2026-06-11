// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { Database, RefreshCw, AlertCircle, Zap, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";

interface Connector {
  id: string; name: string; type?: string; status?: string; last_synced_at?: string;
}
interface SyncJob {
  id: string; connector_id?: string; connector_name?: string;
  status?: string; started_at?: string; finished_at?: string;
  records_processed?: number; error?: string;
}

const JOB_STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600", running: "text-blue-600",
  failed: "text-red-500", pending: "text-yellow-600",
};
const JOB_STATUS_LABEL: Record<string, string> = {
  completed: "Hoàn thành", running: "Đang chạy", failed: "Lỗi", pending: "Chờ",
};

export default function DataPlatformPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetch("/api/connectors", { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/connectors/jobs", { credentials: "include" }).then(r => r.ok ? r.json() : []),
    ])
      .then(([connData, jobsData]) => {
        setConnectors(Array.isArray(connData) ? connData : (connData.data ?? []));
        setJobs(Array.isArray(jobsData) ? jobsData : (jobsData.data ?? []));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeConns = connectors.filter(c => !c.status || c.status === "active").length;
  const failedJobs = jobs.filter(j => j.status === "failed").length;
  const totalRecords = jobs.reduce((s, j) => s + (j.records_processed ?? 0), 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Nền tảng Dữ liệu</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý đồng bộ và luồng dữ liệu</p>
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
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Kết nối đang hoạt động", value: activeConns, icon: Zap, color: "text-emerald-600" },
              { label: "Jobs lỗi", value: failedJobs, icon: XCircle, color: "text-red-500" },
              { label: "Bản ghi đã xử lý", value: totalRecords.toLocaleString("vi-VN"), icon: Activity, color: "text-indigo-600" },
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

          {/* Connectors */}
          {connectors.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Nguồn dữ liệu ({connectors.length})</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {connectors.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                      {(c.type ?? c.name).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {c.last_synced_at ? `Sync: ${new Date(c.last_synced_at).toLocaleString("vi-VN")}` : "Chưa sync"}
                      </p>
                    </div>
                    {!c.status || c.status === "active"
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sync jobs */}
          {jobs.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 px-5 py-4"
                style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                <Clock className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Lịch sử đồng bộ</h3>
              </div>
              <table className="w-full text-sm">
                <thead style={{ background: "var(--bg-elevated)" }}>
                  <tr>
                    {["Nguồn", "Trạng thái", "Bản ghi", "Bắt đầu", "Kết thúc"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 20).map((j, i) => (
                    <tr key={j.id ?? i} className="border-t hover:bg-indigo-50/20 transition-colors"
                      style={{ borderColor: "var(--border-default)" }}>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {j.connector_name ?? j.connector_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        <span className={JOB_STATUS_COLOR[j.status ?? ""] ?? "text-gray-500"}>
                          {JOB_STATUS_LABEL[j.status ?? ""] ?? j.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {j.records_processed?.toLocaleString("vi-VN") ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {j.started_at ? new Date(j.started_at).toLocaleString("vi-VN") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {j.finished_at ? new Date(j.finished_at).toLocaleString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {connectors.length === 0 && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Database className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có nguồn dữ liệu nào</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Kết nối nguồn dữ liệu để bắt đầu đồng bộ</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
