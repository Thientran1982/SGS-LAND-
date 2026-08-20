import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, Calendar, ChevronLeft, ChevronRight, Clock3, ExternalLink, Filter, MessageSquare, RefreshCw, Search, ShieldCheck, Wrench, X } from 'lucide-react';
import { SeoHead } from '../components/SeoHead';

type AuditEvent = {
  id: string;
  event_key: string;
  event_type: 'CHAT_MESSAGE' | 'TOOL_EXECUTION' | 'ENTITY_OBSERVED';
  direction?: 'INBOUND' | 'OUTBOUND';
  session_id?: string;
  lead_id?: string;
  run_id?: string;
  trace_id?: string;
  tool_name?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  parent_entity_type?: string;
  parent_entity_id?: string;
  status?: string;
  input_json?: unknown;
  output_json?: unknown;
  metadata_json?: unknown;
  latency_ms?: number;
  created_at: string;
};

const PAGE_SIZE = 30;
const eventLabels: Record<AuditEvent['event_type'], string> = {
  CHAT_MESSAGE: 'Hội thoại',
  TOOL_EXECUTION: 'Tool execution',
  ENTITY_OBSERVED: 'Dữ liệu được phát hiện',
};

const eventColors: Record<AuditEvent['event_type'], string> = {
  CHAT_MESSAGE: 'bg-[var(--ui-info)]',
  TOOL_EXECUTION: 'bg-[var(--ui-accent)]',
  ENTITY_OBSERVED: 'bg-[var(--ui-success)]',
};

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return 'Không có dữ liệu';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function shortId(value?: string) {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

const AuditDetail = ({ event, onClose }: { event: AuditEvent; onClose: () => void }) => (
  <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[color-mix(in_srgb,var(--ui-brand-strong)_55%,transparent)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Chi tiết nhật ký">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-2xl">
      <div className="flex items-start justify-between border-b border-[var(--glass-border)] p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sgs-primary">{eventLabels[event.event_type]}</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatDate(event.created_at)}</h2>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Event {event.event_key}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]" aria-label="Đóng"><X size={18} /></button>
      </div>
      <div className="max-h-[calc(90vh-105px)] space-y-5 overflow-y-auto p-5">
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          {[
            ['Session', event.session_id], ['Run', event.run_id], ['Trace', event.trace_id],
            ['Lead', event.lead_id], ['Tool', event.tool_name], ['Entity', event.entity_id ? `${event.entity_type || ''} · ${event.entity_id}` : undefined],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--glass-surface-hover)] p-3"><p className="text-[var(--text-tertiary)]">{label}</p><p className="mt-1 break-all font-semibold text-[var(--text-primary)]">{String(value || '—')}</p></div>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {([
            ['Input', event.input_json], ['Output', event.output_json], ['Metadata', event.metadata_json],
          ] as Array<[string, unknown]>).map(([label, value]) => <div key={label} className="min-w-0"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p><pre className="max-h-72 overflow-auto rounded-xl bg-[var(--ui-brand-strong)] p-3 text-[11px] leading-relaxed text-[var(--ui-text-inverse)]">{prettyJson(value)}</pre></div>)}
        </div>
      </div>
    </div>
  </div>
);

export const AgentAudit: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ sessionId: '', runId: '', entityType: '', entityId: '', from: '', to: '' });
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token || ''}` }), [token]);

  const loadEvents = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const response = await fetch(`/api/agent-audit?${params}`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Không thể tải nhật ký.');
      setEvents(Array.isArray(data.events) ? data.events : []);
      setTotal(Number(data.total || 0));
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể tải nhật ký.'); }
    finally { setLoading(false); }
  }, [filters, headers, page]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = useMemo(() => ({
    messages: events.filter(e => e.event_type === 'CHAT_MESSAGE').length,
    tools: events.filter(e => e.event_type === 'TOOL_EXECUTION').length,
    entities: events.filter(e => e.event_type === 'ENTITY_OBSERVED').length,
  }), [events]);

  const updateFilter = (key: keyof typeof filters, value: string) => { setPage(0); setFilters(prev => ({ ...prev, [key]: value })); };
  const resetFilters = () => { setPage(0); setFilters({ sessionId: '', runId: '', entityType: '', entityId: '', from: '', to: '' }); };

  return (
    <div className="min-h-full bg-[var(--bg-app)] px-4 py-6 md:px-8 md:py-8">
      <SeoHead title="Nhật ký Agent Minh | SGS Land" description="Theo dõi hội thoại, tool execution và dữ liệu Agent Minh đã quan sát." />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sgs-primary"><Bot size={17} /> Agent Minh</div><h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Nhật ký hoạt động</h1><p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Đối soát hội thoại, công cụ đã chạy và listing/dự án mà Minh đã sử dụng. Dữ liệu nhạy cảm được che trước khi lưu.</p></div>
          <button onClick={loadEvents} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:bg-[var(--glass-surface-hover)] disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { label: 'Hội thoại', count: counts.messages, Icon: MessageSquare, color: 'text-sky-600 bg-sky-50' },
            { label: 'Tool execution', count: counts.tools, Icon: Wrench, color: 'text-violet-600 bg-violet-50' },
            { label: 'Entity observed', count: counts.entities, Icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
          ] as Array<{ label: string; count: number; Icon: React.ElementType; color: string }>).map(({ label, count, Icon, color }) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] p-4 shadow-sm"><div className={`rounded-xl p-3 ${color}`}><Icon size={19} /></div><div><p className="text-xs text-[var(--text-tertiary)]">{label}</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{count}</p></div></div>)}
        </div>
        <section className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter size={17} className="text-sgs-primary" /><h2 className="font-bold text-[var(--text-primary)]">Bộ lọc đối soát</h2></div><button onClick={resetFilters} className="text-xs font-semibold text-sgs-primary hover:underline">Xoá bộ lọc</button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([['sessionId', 'Session ID'], ['runId', 'Run ID'], ['entityId', 'Entity ID']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold text-[var(--text-secondary)]">{label}<div className="relative mt-1.5"><Search size={14} className="absolute left-3 top-3 text-[var(--text-tertiary)]" /><input value={filters[key]} onChange={e => updateFilter(key, e.target.value)} placeholder={`Lọc theo ${label}`} className="w-full rounded-xl border border-[var(--glass-border)] bg-transparent py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-sgs-primary" /></div></label>)}
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Entity type<select value={filters.entityType} onChange={e => updateFilter('entityType', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-sgs-primary"><option value="">Tất cả loại</option><option value="LISTING">Listing</option><option value="PROJECT">Project</option><option value="PROJECT_ITEM">Project item</option></select></label>
            {([['from', 'Từ ngày'], ['to', 'Đến ngày']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold text-[var(--text-secondary)]">{label}<div className="relative mt-1.5"><Calendar size={14} className="absolute left-3 top-3 text-[var(--text-tertiary)]" /><input type="date" value={filters[key]} onChange={e => updateFilter(key, e.target.value)} className="w-full rounded-xl border border-[var(--glass-border)] bg-transparent py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-sgs-primary" /></div></label>)}
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] px-5 py-4"><div><h2 className="font-bold text-[var(--text-primary)]">Timeline sự kiện</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{total.toLocaleString('vi-VN')} bản ghi trong tenant hiện tại</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={13} className="mr-1 inline" />Tenant-scoped</span></div>
          {error && <div className="m-5 flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={17} />{error}</div>}
          {loading ? <div className="space-y-3 p-5">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : events.length === 0 ? <div className="p-12 text-center text-sm text-[var(--text-secondary)]"><Bot size={30} className="mx-auto mb-3 text-[var(--text-tertiary)]" />Chưa có sự kiện phù hợp với bộ lọc.</div> : <div className="divide-y divide-[var(--glass-border)]">{events.map(event => <button key={event.id || event.event_key} onClick={() => setSelected(event)} className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--glass-surface-hover)]"><div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${eventColors[event.event_type]}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-[var(--text-primary)]">{eventLabels[event.event_type]}</span>{event.direction && <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{event.direction}</span>}<span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${event.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{event.status || 'UNKNOWN'}</span></div><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{event.tool_name ? `Tool: ${event.tool_name}` : event.entity_id ? `${event.entity_type || 'Entity'}: ${event.entity_code || shortId(event.entity_id)}` : `Session: ${shortId(event.session_id)}`}</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--text-tertiary)]"><span><Clock3 size={12} className="mr-1 inline" />{formatDate(event.created_at)}</span>{event.latency_ms != null && <span>{event.latency_ms}ms</span>}<span>Run: {shortId(event.run_id)}</span></div></div><ExternalLink size={15} className="mt-1 shrink-0 text-[var(--text-tertiary)]" /></button>)}</div>}
          <div className="flex items-center justify-between border-t border-[var(--glass-border)] px-5 py-3"><span className="text-xs text-[var(--text-tertiary)]">Trang {Math.min(page + 1, totalPages)} / {totalPages}</span><div className="flex gap-2"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-[var(--glass-border)] p-2 text-[var(--text-secondary)] disabled:opacity-30" aria-label="Trang trước"><ChevronLeft size={16} /></button><button disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-[var(--glass-border)] p-2 text-[var(--text-secondary)] disabled:opacity-30" aria-label="Trang sau"><ChevronRight size={16} /></button></div></div>
        </section>
      </div>
      {selected && <AuditDetail event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default AgentAudit;