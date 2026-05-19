"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Phone, Mail, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";

interface Lead {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
  score?: number;
  source?: string;
  created_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  new:       "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-indigo-100 text-indigo-700",
  proposal:  "bg-purple-100 text-purple-700",
  won:       "bg-emerald-100 text-emerald-700",
  lost:      "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Mới", contacted: "Đã liên hệ", qualified: "Đủ điều kiện",
  proposal: "Báo giá", won: "Thành công", lost: "Thất bại",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = () => {
    setLoading(true);
    setError(null);
    fetch("/api/leads?limit=50", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Lỗi ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.leads ?? data.data ?? []);
        setLeads(list);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Quản lý khách hàng tiềm năng</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeads}
            className="p-2 rounded-xl transition-colors hover:opacity-70"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchLeads} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có leads nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Leads sẽ hiển thị ở đây khi được thêm vào hệ thống</p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr>
                {["Tên", "Liên hệ", "Trạng thái", "Điểm", "Nguồn", "Ngày tạo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t transition-colors hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10"
                  style={{ borderColor: "var(--border-default)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{lead.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs hover:underline"
                          style={{ color: "var(--text-secondary)" }}>
                          <Phone className="w-3 h-3" />{lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs hover:underline"
                          style={{ color: "var(--text-secondary)" }}>
                          <Mail className="w-3 h-3" />{lead.email}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.score != null && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3"
                          style={{ color: lead.score >= 70 ? "#10b981" : lead.score >= 40 ? "#f59e0b" : "#ef4444" }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{lead.score}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString("vi-VN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
