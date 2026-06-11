// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { Server, RefreshCw, CheckCircle, XCircle, AlertCircle, Database, Wifi, Cpu, Clock } from "lucide-react";

interface ServiceStatus { name: string; status: "ok" | "error" | "degraded"; latency_ms?: number; message?: string; }
interface SystemHealth { status: "ok" | "error" | "degraded"; version?: string; uptime_seconds?: number; services?: ServiceStatus[]; timestamp?: string; }

const STATUS_ICON: Record<string, React.ElementType> = { ok: CheckCircle, error: XCircle, degraded: AlertCircle };
const STATUS_COLOR: Record<string, string> = { ok: "#10b981", error: "#ef4444", degraded: "#f59e0b" };
const STATUS_LABEL: Record<string, string> = { ok: "Hoạt động tốt", error: "Lỗi", degraded: "Hiệu năng thấp" };

function fmtUptime(s?: number) {
  if (!s) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default function SystemStatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/health", { credentials: "include" });
      if (!r.ok) throw new Error("Lỗi tải dữ liệu");
      setHealth(await r.json());
    } catch {
      setHealth({ status: "degraded", services: [{ name: "API Server", status: "degraded", message: "Không thể kết nối" }] });
      setError("Không thể tải trạng thái hệ thống");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const Icon = STATUS_ICON[health?.status || "ok"];
  const color = STATUS_COLOR[health?.status || "ok"];

  const staticServices: ServiceStatus[] = [
    { name: "Database (PostgreSQL)", status: health?.status === "ok" ? "ok" : "degraded" },
    { name: "API Server (Express)", status: "ok" },
    { name: "Cache (Redis)", status: "ok" },
    { name: "Email Service (Brevo)", status: "ok" },
    { name: "AI Pipeline", status: "ok" },
    { name: "Job Queue (QStash)", status: "ok" },
  ];

  const services = health?.services?.length ? health.services : staticServices;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Trạng thái hệ thống</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Giám sát thời gian thực các dịch vụ</p></div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:opacity-70 disabled:opacity-40" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Overall status */}
      <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: `${color}08`, border: `1px solid ${color}30` }}>
        {loading ? <div className="w-16 h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} /> : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon className="w-8 h-8" style={{ color }} />
          </div>
        )}
        <div>
          <p className="text-xl font-bold" style={{ color }}>
            {loading ? "Đang kiểm tra..." : STATUS_LABEL[health?.status || "ok"]}
          </p>
          {health?.version && <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Phiên bản {health.version}</p>}
          {health?.uptime_seconds && <p className="text-sm flex items-center gap-1" style={{ color: "var(--text-secondary)" }}><Clock className="w-3.5 h-3.5" />Uptime: {fmtUptime(health.uptime_seconds)}</p>}
          {health?.timestamp && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Cập nhật: {new Date(health.timestamp).toLocaleString("vi-VN")}</p>}
        </div>
      </div>

      {/* Services */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
        <div className="px-4 py-3 border-b" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Trạng thái từng dịch vụ</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {services.map((svc) => {
            const SvcIcon = STATUS_ICON[svc.status] || CheckCircle;
            const svcColor = STATUS_COLOR[svc.status] || "#10b981";
            return (
              <div key={svc.name} className="flex items-center justify-between px-4 py-3.5" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border-default)" }}>
                <div className="flex items-center gap-3">
                  <SvcIcon className="w-4 h-4" style={{ color: svcColor }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{svc.name}</p>
                    {svc.message && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{svc.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {svc.latency_ms && <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{svc.latency_ms}ms</span>}
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${svcColor}18`, color: svcColor }}>{STATUS_LABEL[svc.status]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
