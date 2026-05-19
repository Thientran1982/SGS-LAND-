"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Workflow, RefreshCw, AlertCircle, MessageCircle,
  Mail, Phone, CheckCircle2, XCircle, Clock, Ban,
  ChevronDown, ChevronUp, Zap, Users, Play, Pause
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FollowUpSend {
  id: string;
  day_number: 1 | 3 | 5 | 7;
  channel: "ZALO" | "SMS" | "EMAIL" | null;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED" | "CANCELLED";
  message: string | null;
  sent_at: string | null;
  error: string | null;
}

interface FollowUpSequence {
  id: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lead_zalo_id: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  cancel_reason: string | null;
  source: string;
  project_code: string | null;
  sent_count: number;
  pending_count: number;
  failed_count: number;
  channels: string[] | null;
  created_at: string;
}

interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  status?: string;
  trigger_type?: string;
  steps_count?: number;
  enrolled_count?: number;
  active_count?: number;
  completed_count?: number;
  created_at?: string;
}

interface ListResult {
  sequences: FollowUpSequence[];
  total: number;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const SEQ_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Đang chạy",  cls: "bg-indigo-100 text-indigo-700" },
  COMPLETED: { label: "Hoàn tất",   cls: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã hủy",    cls: "bg-red-100 text-red-600" },
};

const SEND_STATUS: Record<string, { label: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Chờ gửi",  icon: <Clock className="w-3.5 h-3.5 text-amber-500" /> },
  SENT:      { label: "Đã gửi",   icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
  FAILED:    { label: "Lỗi",      icon: <XCircle className="w-3.5 h-3.5 text-red-500" /> },
  SKIPPED:   { label: "Bỏ qua",  icon: <Ban className="w-3.5 h-3.5 text-slate-400" /> },
  CANCELLED: { label: "Đã hủy",  icon: <Ban className="w-3.5 h-3.5 text-red-400" /> },
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  ZALO:  <MessageCircle className="w-3.5 h-3.5 text-blue-500" />,
  SMS:   <Phone className="w-3.5 h-3.5 text-violet-500" />,
  EMAIL: <Mail className="w-3.5 h-3.5 text-indigo-500" />,
};

const EMAIL_SEQ_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft:  "bg-gray-100 text-gray-600",
  archived: "bg-gray-100 text-gray-400",
};
const EMAIL_SEQ_LABEL: Record<string, string> = {
  active: "Đang chạy", paused: "Tạm dừng", draft: "Nháp", archived: "Lưu trữ",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── SendsPanel ─────────────────────────────────────────────────────────────────

function SendsPanel({ seqId }: { seqId: string }) {
  const [sends, setSends] = useState<FollowUpSend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/followup/sequences/${seqId}/sends`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setSends)
      .catch(() => setSends([]))
      .finally(() => setLoading(false));
  }, [seqId]);

  if (loading) return <div className="py-3 text-xs text-center text-slate-400">Đang tải...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 px-4">
      {sends.map(s => {
        const st = SEND_STATUS[s.status] || SEND_STATUS.PENDING;
        return (
          <div key={s.id} className="rounded-xl border p-3 text-xs"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>D+{s.day_number}</span>
              {s.channel && CHANNEL_ICON[s.channel]}
            </div>
            <div className="flex items-center gap-1 mb-1">
              {st.icon}
              <span style={{ color: "var(--text-secondary)" }}>{st.label}</span>
            </div>
            {s.sent_at && (
              <div style={{ color: "var(--text-muted)" }} className="mt-1">
                {new Date(s.sent_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {s.error && (
              <div className="text-red-400 mt-1 break-words">{s.error.slice(0, 60)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FollowUpRow ────────────────────────────────────────────────────────────────

function FollowUpRow({ seq, onCancel }: { seq: FollowUpSequence; onCancel: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const st = SEQ_STATUS[seq.status] || SEQ_STATUS.ACTIVE;

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {seq.lead_name || "—"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
            {seq.project_code && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                {seq.project_code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {seq.lead_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{seq.lead_phone}</span>}
            {seq.lead_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{seq.lead_email}</span>}
            {seq.lead_zalo_id && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-500" />Zalo</span>}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{seq.sent_count}/4 gửi</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" />{seq.pending_count} chờ</span>
          {seq.failed_count > 0 && (
            <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" />{seq.failed_count} lỗi</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs hidden md:block" style={{ color: "var(--text-muted)" }}>{fmt(seq.created_at)}</span>
          {seq.status === "ACTIVE" && (
            <button
              onClick={e => { e.stopPropagation(); onCancel(seq.id); }}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              Hủy
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          }
        </div>
      </div>
      {expanded && (
        <div className="border-t" style={{ borderColor: "var(--border-default)" }}>
          <SendsPanel seqId={seq.id} />
        </div>
      )}
    </div>
  );
}

// ── Tab: Follow-up Agent ───────────────────────────────────────────────────────

const FUP_STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "ACTIVE", label: "Đang chạy" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

function FollowUpTab() {
  const [data, setData] = useState<ListResult>({ sequences: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetch_ = useCallback(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (statusFilter) qs.set("status", statusFilter);
    fetch(`/api/followup/sequences?${qs}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleCancel = async (sequenceId: string) => {
    if (!confirm("Hủy chuỗi follow-up này?")) return;
    try {
      const r = await fetch("/api/followup/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ sequenceId, reason: "manual_cancel" }),
      });
      if (!r.ok) throw new Error("Lỗi hủy");
      fetch_();
    } catch (e: any) { alert(e.message); }
  };

  const totalPages = Math.ceil(data.total / pageSize);
  const activeCount = data.sequences.filter(s => s.status === "ACTIVE").length;
  const sentTotal = data.sequences.reduce((a, s) => a + (s.sent_count || 0), 0);

  return (
    <div>
      {/* KPI summary */}
      {!loading && data.total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Tổng chuỗi", value: data.total, icon: <Workflow className="w-4 h-4 text-indigo-500" /> },
            { label: "Đang chạy",  value: activeCount, icon: <Clock className="w-4 h-4 text-amber-500" /> },
            { label: "Tin đã gửi", value: sentTotal,   icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              {kpi.icon}
              <div>
                <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{kpi.value}</div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FUP_STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${statusFilter === f.value ? "bg-indigo-600 text-white border-indigo-600" : "hover:opacity-80"}`}
            style={statusFilter !== f.value ? { background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" } : undefined}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-4 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetch_} className="ml-auto underline">Thử lại</button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}

      {!loading && !error && data.sequences.length === 0 && (
        <div className="text-center py-16">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Chưa có chuỗi follow-up nào</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Chuỗi được tạo tự động khi khách hàng điền form LiveChat
          </p>
        </div>
      )}

      {!loading && data.sequences.length > 0 && (
        <div className="space-y-3">
          {data.sequences.map(seq => (
            <FollowUpRow key={seq.id} seq={seq} onCancel={handleCancel} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {data.total} chuỗi · Trang {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>Trước</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>Tiếp</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Email Drip Sequences ─────────────────────────────────────────────────

function EmailSequencesTab() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSequences = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/sequences", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(`Lỗi ${r.status}`); return r.json(); })
      .then(d => setSequences(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  return (
    <div>
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchSequences} className="ml-auto underline">Thử lại</button>
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />
          ))}
        </div>
      )}
      {!loading && !error && sequences.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Workflow className="w-12 h-12 mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Chưa có sequence nào</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tạo sequence để tự động hóa quy trình chăm sóc lead</p>
        </div>
      )}
      {!loading && sequences.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sequences.map(s => (
            <div key={s.id} className="rounded-2xl p-5"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                  {s.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{s.description}</p>
                  )}
                </div>
                {s.status && (
                  <span className={`shrink-0 ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${EMAIL_SEQ_COLOR[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {EMAIL_SEQ_LABEL[s.status] ?? s.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                {s.steps_count !== undefined && <div className="flex items-center gap-1"><Workflow className="w-3.5 h-3.5" />{s.steps_count} bước</div>}
                {s.enrolled_count !== undefined && <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.enrolled_count} đã đăng ký</div>}
                {s.active_count !== undefined && <div className="flex items-center gap-1"><Play className="w-3.5 h-3.5 text-emerald-500" />{s.active_count} đang chạy</div>}
                {s.completed_count !== undefined && <div className="flex items-center gap-1"><Pause className="w-3.5 h-3.5 text-blue-500" />{s.completed_count} xong</div>}
              </div>
              {s.trigger_type && (
                <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}>
                  Trigger: <span style={{ color: "var(--text-secondary)" }}>{s.trigger_type}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "followup" | "email";

export default function SequencesPage() {
  const [tab, setTab] = useState<Tab>("followup");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Zap className="w-6 h-6 text-indigo-500" />
            Sequences & Follow-up
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Tự động chăm sóc đa kênh · D+1/3/5/7 · Zalo → SMS → Email
          </p>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)}
          className="p-2 rounded-xl hover:opacity-70 transition-opacity"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        {([
          { key: "followup", label: "Follow-up Agent", icon: <Zap className="w-3.5 h-3.5" /> },
          { key: "email",    label: "Email Sequences", icon: <Mail className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "hover:opacity-80"
            }`}
            style={tab !== t.key ? { color: "var(--text-secondary)" } : undefined}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "followup" && <FollowUpTab key={`fup-${refreshKey}`} />}
      {tab === "email"    && <EmailSequencesTab key={`email-${refreshKey}`} />}
    </div>
  );
}
