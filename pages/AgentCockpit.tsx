import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle, BarChart3, ClipboardCheck, RotateCcw, Filter, PlayCircle } from 'lucide-react';
import { api } from '../services/api/apiClient';

type CockpitSummary = {
  roleCards: Array<{ agentKey: string; title: string; mission: string; permissions: string[]; kpis: string[]; rollout: string; approval_status?: string }>;
  events: Array<{ status: string; count: number }>;
  humanQuestions: Array<{ status: string; count: number }>;
  executions: Array<{ status: string; count: number }>;
  recentAudit: Array<{ event_type: string; status: string; created_at: string }>;
  rollouts: Array<{ agent_key: string; status: string; canary_percent: number; shadow_enabled: boolean }>;
  weeklyKpi: Array<{ agent_key: string; period_start: string; period_end: string; metrics_json: Record<string, unknown> }>;
  shiftReports: Array<{ id: string; report_date: string; shift: string; metrics_json: Record<string, unknown>; summary: string; reviewed: boolean }>;
  rollbackAudits: Array<{ entity_id: string; from_status: string; reason: string; created_at: string }>;
  generatedAt: string;
};
type ReplayHistory = { id: string; operator_id: string; reason: string; replay_number: number; result_status: string; result_error?: string; requested_at: string; completed_at?: string };
type OperatingEvent = { id: string; event_id: string; event_type: string; idempotency_key: string; urgency: number; status: string; attempts: number; last_error?: string; lease_expires_at?: string; lease_expired?: boolean; created_at: string; updated_at: string; replay_history: ReplayHistory[] };
type HumanQuestion = { id: string; agent_key: string; question: string; priority: number; created_at: string; context_json: Record<string, unknown> };

const count = (rows: Array<{ status: string; count: number }> = [], status: string) => rows.find(row => row.status === status)?.count || 0;

export default function AgentCockpit() {
  const [summary, setSummary] = useState<CockpitSummary | null>(null);
  const [questions, setQuestions] = useState<HumanQuestion[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [approveMemory, setApproveMemory] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [events, setEvents] = useState<OperatingEvent[]>([]);
  const [eventFilters, setEventFilters] = useState({ urgency: 'ALL', lease: 'ALL', deadLetter: 'ALL' });
  const [replaying, setReplaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams(eventFilters).toString();
      const [nextSummary, nextQuestions, nextEvents] = await Promise.all([
        api.get<CockpitSummary>('/api/agent-operating/cockpit'),
        api.get<HumanQuestion[]>('/api/agent-operating/questions'),
        api.get<OperatingEvent[]>(`/api/agent-operating/events?${query}`),
      ]);
      setSummary(nextSummary); setQuestions(nextQuestions); setEvents(nextEvents);
    } catch (e: any) {
      setError(e?.message || 'Không thể tải Admin Cockpit.');
    } finally { setLoading(false); }
  }, [eventFilters]);
  useEffect(() => { void load(); }, [load]);

  const submitAnswer = async (id: string) => {
    if (!answer.trim()) return;
    setAnswering(id);
    try {
      await api.post(`/api/agent-operating/questions/${id}/answer`, { answer: answer.trim(), approveMemory });
      setAnswer(''); setApproveMemory(true); await load();
    } catch (e: any) { setError(e?.message || 'Không thể ghi câu trả lời.'); }
    finally { setAnswering(null); }
  };
  const approveCard = async (agentKey: string, approved: boolean) => {
    setApproving(agentKey);
    try { await api.post(`/api/agent-operating/role-cards/${agentKey}/approval`, { approved }); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể cập nhật duyệt role card.'); }
    finally { setApproving(null); }
  };
  const reviewShift = async (id: string) => {
    try { await api.post(`/api/agent-operating/shift-reports/${id}/review`, {}); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể duyệt báo cáo ca.'); }
  };
  const replayEvent = async (event: OperatingEvent) => {
    const reason = window.prompt(`Lý do replay ${event.event_id}:`, 'Đã xử lý nguyên nhân lỗi, cho chạy lại có kiểm soát');
    if (!reason?.trim()) return;
    setReplaying(event.id);
    try { await api.post(`/api/agent-operating/events/${event.id}/replay`, { reason: reason.trim() }); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể replay event.'); }
    finally { setReplaying(null); }
  };
  const eventFilter = (key: keyof typeof eventFilters, value: string) => setEventFilters(current => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600"><Bot size={16} /> Agent operations</div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Cockpit</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi Agent Minh và các agent theo nguyên tắc có người kiểm soát.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={17} /> {error}</div>}
      {loading && !summary ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Đang tải trạng thái agent…</div> : summary && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Runs đang chạy', count(summary.executions, 'RUNNING'), 'text-indigo-600'],
            ['Chờ nhân viên', count(summary.humanQuestions, 'OPEN'), 'text-amber-600'],
            ['Event lỗi', count(summary.events, 'FAILED') + count(summary.events, 'DEAD_LETTER'), 'text-rose-600'],
            ['Đã hoàn tất', count(summary.executions, 'SUCCESS'), 'text-emerald-600'],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div></div>)}
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Filter size={19} className="text-rose-600" /><div><h2 className="font-semibold text-slate-900">Event cần vận hành</h2><p className="text-xs text-slate-500">Event treo lease hoặc dead-letter được đưa lên đầu.</p></div></div>
            <button onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} /> Làm mới</button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <select aria-label="Lọc urgency" value={eventFilters.urgency} onChange={e => eventFilter('urgency', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Mọi urgency</option><option value="HIGH">Cao (≥75)</option><option value="NORMAL">Vừa (40–74)</option><option value="LOW">Thấp (&lt;40)</option></select>
            <select aria-label="Lọc lease" value={eventFilters.lease} onChange={e => eventFilter('lease', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Mọi lease</option><option value="EXPIRED">Lease hết hạn</option><option value="ACTIVE">Đang giữ lease</option><option value="NONE">Không có lease</option></select>
            <select aria-label="Lọc dead letter" value={eventFilters.deadLetter} onChange={e => eventFilter('deadLetter', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Dead-letter &amp; khác</option><option value="YES">Chỉ dead-letter</option><option value="NO">Không dead-letter</option></select>
          </div>
          {events.length === 0 ? <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Không có event phù hợp bộ lọc.</div> : <div className="space-y-2">{events.map(event => {
            const attention = event.status === 'DEAD_LETTER' || event.lease_expired;
            return <div key={event.id} className={`rounded-lg border p-4 ${event.status === 'DEAD_LETTER' ? 'border-rose-200 bg-rose-50/40' : event.lease_expired ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{event.event_type}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.status === 'DEAD_LETTER' ? 'bg-rose-100 text-rose-800' : event.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{event.status}</span><span className="text-xs text-slate-500">Urgency {event.urgency}</span></div><p className="mt-1 text-xs text-slate-500">ID {event.event_id} · {new Date(event.created_at).toLocaleString('vi-VN')}</p></div>{(event.status === 'FAILED' || event.status === 'DEAD_LETTER') && <button onClick={() => void replayEvent(event)} disabled={replaying === event.id} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><PlayCircle size={14} /> {replaying === event.id ? 'Đang replay…' : 'Replay có kiểm soát'}</button>}</div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><span><b>Attempts:</b> {event.attempts}</span><span><b>Lease:</b> {event.lease_expires_at ? `${event.lease_expired ? 'Đã hết hạn' : 'Hết hạn'} ${new Date(event.lease_expires_at).toLocaleString('vi-VN')}` : 'Không có'}</span><span><b>Idempotency:</b> <code className="break-all">{event.idempotency_key}</code></span></div>
              {(attention || event.last_error) && <div className="mt-3 rounded-md bg-white/80 px-3 py-2 text-xs"><b>{event.last_error ? 'Lỗi cuối: ' : ''}</b>{event.last_error || (event.lease_expired ? 'Worker không hoàn tất trước khi lease hết hạn.' : '')}</div>}
              {event.replay_history?.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><div className="mb-2 text-xs font-semibold text-slate-700">Lịch sử replay</div><div className="space-y-1.5">{event.replay_history.map(replay => <div key={replay.id} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="flex flex-wrap justify-between gap-2"><span><b>Lần {replay.replay_number}</b> · {replay.result_status} · operator {replay.operator_id}</span><span>{new Date(replay.requested_at).toLocaleString('vi-VN')}</span></div><div className="mt-1">{replay.reason}</div>{replay.result_error && <div className="mt-1 text-rose-700">Kết quả lỗi: {replay.result_error}</div>}</div>)}</div></div>}
            </div>;
          })}</div>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck size={19} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Role cards & rollout</h2></div>
          <div className="grid gap-3 md:grid-cols-3">{summary.roleCards.map(card => {
            const rollout = summary.rollouts.find(item => item.agent_key === card.agentKey);
            return <div key={card.agentKey} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{card.title}</h3><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{rollout?.status || card.rollout}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{card.mission}</p>
              <div className="mt-3 text-[11px] text-slate-500">KPI: {card.kpis.join(' · ')}</div>
              {rollout?.shadow_enabled && <div className="mt-2 text-[11px] font-medium text-amber-700">Shadow mode · không tác động production</div>}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <span className={`text-[11px] font-semibold ${card.approval_status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>{card.approval_status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}</span>
                <button onClick={() => void approveCard(card.agentKey, card.approval_status !== 'APPROVED')} disabled={approving === card.agentKey} className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-50">{card.approval_status === 'APPROVED' ? 'Thu hồi duyệt' : 'Duyệt role card'}</button>
              </div>
            </div>;
          })}</div>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><BarChart3 size={19} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">KPI tuần</h2></div>
            {summary.weeklyKpi.length === 0 ? <p className="text-sm text-slate-500">Chưa có snapshot KPI.</p> : <div className="space-y-2">{summary.weeklyKpi.map((kpi, i) => <div key={`${kpi.agent_key}-${kpi.period_start}-${i}`} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs font-semibold text-slate-700"><span>{kpi.agent_key}</span><span>{kpi.period_start} → {kpi.period_end}</span></div><div className="mt-2 flex flex-wrap gap-2">{Object.entries(kpi.metrics_json || {}).map(([key, value]) => <span key={key} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">{key}: <b>{String(value)}</b></span>)}</div></div>)}</div>}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><ClipboardCheck size={19} className="text-emerald-600" /><h2 className="font-semibold text-slate-900">Báo cáo ca hằng ngày</h2></div>
            {summary.shiftReports.length === 0 ? <p className="text-sm text-slate-500">Chưa có báo cáo ca.</p> : <div className="space-y-2">{summary.shiftReports.slice(0, 7).map(report => <div key={report.id} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between text-xs"><b>{report.report_date} · {report.shift}</b>{report.reviewed ? <span className="text-emerald-700">Đã duyệt</span> : <button onClick={() => void reviewShift(report.id)} className="font-semibold text-indigo-700">Duyệt</button>}</div><p className="mt-2 text-sm text-slate-700">{report.summary || 'Không có ghi chú.'}</p></div>)}</div>}
          </section>
        </div>
        <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><RotateCcw size={18} className="text-rose-700" /><h2 className="font-semibold text-slate-900">Audit rollback</h2></div>{summary.rollbackAudits.length === 0 ? <p className="text-sm text-slate-500">Chưa có rollback.</p> : <div className="space-y-2">{summary.rollbackAudits.slice(0, 8).map((audit, i) => <div key={`${audit.created_at}-${i}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span><b>{audit.entity_id}</b> · {audit.from_status} → ROLLED_BACK</span><span className="text-xs text-slate-500">{audit.reason} · {new Date(audit.created_at).toLocaleString('vi-VN')}</span></div>)}</div>}</section>
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Clock3 size={19} className="text-amber-700" /><h2 className="font-semibold text-slate-900">Ask-human queue</h2><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{questions.length}</span></div>
          {questions.length === 0 ? <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-600" /> Không có câu hỏi đang chờ.</div> : <div className="space-y-3">{questions.map(question => <div key={question.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-indigo-700">{question.agent_key}</span><span className="text-xs text-slate-500">Ưu tiên {question.priority}</span></div>
            <p className="mt-2 text-sm text-slate-800">{question.question}</p>
            <div className="mt-3 flex flex-wrap gap-2"><input value={answering === question.id ? answer : ''} onChange={event => { setAnswering(question.id); setAnswer(event.target.value); }} placeholder="Trả lời để agent tiếp tục…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" /><button onClick={() => void submitAnswer(question.id)} disabled={answering === question.id && !answer.trim()} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> Trả lời</button></div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={approveMemory} onChange={event => setApproveMemory(event.target.checked)} /> Cho phép đưa câu trả lời vào memory</label>
          </div>)}</div>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><XCircle size={18} className="text-slate-500" /><h2 className="font-semibold text-slate-900">Audit gần đây</h2></div><div className="divide-y divide-slate-100">{summary.recentAudit.slice(0, 8).map((event, index) => <div key={`${event.created_at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{event.event_type}</span><span className="text-xs text-slate-500">{event.status} · {new Date(event.created_at).toLocaleString('vi-VN')}</span></div>)}</div></section>
      </>}
    </div>
  );
}