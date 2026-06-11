// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw, AlertCircle, User, Calendar } from "lucide-react";

interface Contract {
  id: number;
  contract_number?: string;
  client_name?: string;
  property_address?: string;
  value?: number;
  status?: string;
  signed_at?: string;
  created_at?: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp", pending: "Chờ ký", signed: "Đã ký",
  completed: "Hoàn tất", cancelled: "Huỷ",
};
const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  pending:   "bg-yellow-100 text-yellow-700",
  signed:    "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

function fmtPrice(p?: number) {
  if (!p) return "—";
  if (p >= 1e9) return `${(p / 1e9).toFixed(2)} tỷ`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(0)} triệu`;
  return p.toLocaleString("vi-VN") + " đ";
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = () => {
    setLoading(true);
    setError(null);
    fetch("/api/contracts?limit=50", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Lỗi ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.contracts ?? data.data ?? []);
        setContracts(list);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchContracts(); }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Hợp đồng</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Theo dõi hợp đồng và thanh toán</p>
        </div>
        <button onClick={fetchContracts}
          className="p-2 rounded-xl hover:opacity-70 transition-colors"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchContracts} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có hợp đồng nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Hợp đồng sẽ hiển thị ở đây khi được tạo</p>
        </div>
      )}

      {!loading && contracts.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr>
                {["Số HĐ", "Khách hàng", "BĐS", "Giá trị", "Trạng thái", "Ngày ký"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors"
                  style={{ borderColor: "var(--border-default)" }}>
                  <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.contract_number ?? `#${c.id}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-primary)" }}>
                      <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                      {c.client_name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>
                    {c.property_address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--primary-600)" }}>
                    {fmtPrice(c.value)}
                  </td>
                  <td className="px-4 py-3">
                    {c.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {(c.signed_at ?? c.created_at)
                      ? new Date((c.signed_at ?? c.created_at)!).toLocaleDateString("vi-VN")
                      : "—"}
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
