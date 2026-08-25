import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle, BarChart3, ClipboardCheck, RotateCcw, Filter, PlayCircle, Save, Trash2, Edit3, BrainCircuit } from 'lucide-react';
import { api } from '../services/api/apiClient';
import { Dropdown } from '../components/Dropdown';

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
type SupportRequest = { id: string; trackingCode: string; category: string; title: string; description: string; status: string; latestReply?: string | null; requesterName?: string; requesterEmail?: string; updatedAt: string };
type AdminMemory = { id: string; namespace: string; key: string; kind: 'fact' | 'episodic' | 'procedural'; value: string; importance: number; hits: number; expires_at: string | null; expired?: boolean; conflict?: boolean; piiScrubbed?: boolean; updated_at: string };
type WeightVersion = { id: string; status: 'draft' | 'shadow' | 'live'; weights: Record<string, number>; metrics: Record<string, unknown>; goldenSetPassed: boolean; created_at: string };
type MarketingGrowthStatus = {
  brain: Array<{ id: string; documentType: string; documentKey: string; content?: Record<string, unknown>; source: string; sourceUrl?: string | null; verificationStatus: string; verifiedAt?: string | null; updatedAt: string }>;
  capabilities: Array<{ capabilityKey: string; displayName: string; role: string; cadence: string; requiresHumanApproval: boolean; rollout: string; active: boolean; promptVersion: string; updatedAt?: string | null }>;
};

const count = (rows: Array<{ status: string; count: number }> = [], status: string) => rows.find(row => row.status === status)?.count || 0;
const eventStatusLabel: Record<string, string> = { FAILED: 'Thất bại', DEAD_LETTER: 'Hàng chờ lỗi', PROCESSING: 'Đang xử lý', DONE: 'Hoàn tất', PENDING: 'Đang chờ' };
const memoryKindLabel: Record<string, string> = { fact: 'Sự thật', episodic: 'Theo sự kiện', procedural: 'Quy trình' };
const brainTypeLabel: Record<string, string> = { brand_voice: 'Giọng thương hiệu', developer: 'Chủ đầu tư', project: 'Dự án', legal_disclaimer: 'Lưu ý pháp lý', broker: 'Môi giới', faq: 'Câu hỏi thường gặp', competitor_note: 'Ghi chú cạnh tranh' };
const cadenceLabel: Record<string, string> = { daily: 'Hằng ngày', weekly: 'Hằng tuần', realtime: 'Theo thời gian thực', on_demand: 'Theo yêu cầu', per_publish: 'Mỗi lần xuất bản' };
const rolloutLabel: Record<string, string> = { SHADOW: 'Quan sát', CANARY_25: 'Thử nghiệm 25%', CANARY_50: 'Thử nghiệm 50%', LIVE: 'Đang vận hành' };
const metricLabel = (key: string) => ({ groundedness: 'Độ bám nguồn', schema_validity: 'Đúng cấu trúc', escalation_quality: 'Chất lượng chuyển người' }[key] || key);

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
  const [memories, setMemories] = useState<AdminMemory[]>([]);
  const [memoryFilters, setMemoryFilters] = useState({ namespace: '', kind: '', importance: '' });
  const [editingMemory, setEditingMemory] = useState<AdminMemory | null>(null);
  const [memoryForm, setMemoryForm] = useState({ namespace: '', key: '', value: '', kind: 'fact', importance: '0.5', ttlDays: '' });
  const [weights, setWeights] = useState<{ live: Record<string, number>; versions: WeightVersion[] } | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportReply, setSupportReply] = useState<Record<string, string>>({});
  const [supportStatus, setSupportStatus] = useState<Record<string, string>>({});
  const [updatingSupport, setUpdatingSupport] = useState<string | null>(null);
  const [marketingGrowth, setMarketingGrowth] = useState<MarketingGrowthStatus | null>(null);
  const [updatingGrowth, setUpdatingGrowth] = useState<string | null>(null);
  const [editingBrain, setEditingBrain] = useState<MarketingGrowthStatus['brain'][number] | null>(null);
  const [brainForm, setBrainForm] = useState({ documentType: 'brand_voice', documentKey: '', content: '{}', source: 'internal', sourceUrl: '', verificationStatus: 'unverified' });
  const [savingBrain, setSavingBrain] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams(eventFilters).toString();
      const nextSummary = await api.get<CockpitSummary>('/api/agent-operating/cockpit');
      setSummary(nextSummary);
      const [questionsResult, eventsResult, supportResult, marketingGrowthResult] = await Promise.allSettled([
        api.get<HumanQuestion[]>('/api/agent-operating/questions'),
        api.get<OperatingEvent[]>(`/api/agent-operating/events?${query}`),
        api.get<{ data: SupportRequest[] }>('/api/live-chat/support-requests'),
        api.get<MarketingGrowthStatus>('/api/agent-operating/marketing-growth'),
      ]);
      if (questionsResult.status === 'fulfilled') setQuestions(questionsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
      if (supportResult.status === 'fulfilled') setSupportRequests(supportResult.value.data || []);
      if (marketingGrowthResult.status === 'fulfilled') setMarketingGrowth(marketingGrowthResult.value);
      // Secondary panels must not hide a successfully loaded cockpit or a
      // successful role-card approval.
      const [memoryResult, weightsResult] = await Promise.allSettled([
        api.get<AdminMemory[]>('/api/ai/memory/admin', memoryFilters),
        api.get<{ live: Record<string, number>; versions: WeightVersion[] }>('/api/ai/weights'),
      ]);
      if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);
      if (weightsResult.status === 'fulfilled') setWeights(weightsResult.value);
    } catch (e: any) {
      setError(e?.message || 'Không thể tải bảng điều khiển quản trị Agent.');
    } finally { setLoading(false); }
  }, [eventFilters, memoryFilters]);
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
    try {
      await api.post(`/api/agent-operating/role-cards/${encodeURIComponent(agentKey)}/approval`, { approved });
      setSummary(current => current ? {
        ...current,
        roleCards: current.roleCards.map(card => card.agentKey === agentKey
          ? { ...card, approval_status: approved ? 'APPROVED' : 'REJECTED' }
          : card),
      } : current);
      await load();
    }
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
    catch (e: any) { setError(e?.message || 'Không thể chạy lại sự kiện.'); }
    finally { setReplaying(null); }
  };
  const eventFilter = (key: keyof typeof eventFilters, value: string) => setEventFilters(current => ({ ...current, [key]: value }));
  const beginEdit = (memory: AdminMemory) => {
    setEditingMemory(memory);
    setMemoryForm({ namespace: memory.namespace, key: memory.key, value: memory.value, kind: memory.kind, importance: String(memory.importance), ttlDays: '' });
  };
  const saveMemory = async () => {
    if (!editingMemory || !memoryForm.namespace || !memoryForm.key || !memoryForm.value.trim()) return;
    try {
      const result = await api.put<AdminMemory & { piiScrubbed?: boolean; conflict?: boolean }>(`/api/ai/memory/${editingMemory.id}`, {
        ...memoryForm, importance: Number(memoryForm.importance), ttlDays: memoryForm.ttlDays ? Number(memoryForm.ttlDays) : null,
      });
      setEditingMemory(null); setError(result.conflict ? 'Bộ nhớ chưa được ghi: xung đột với sự thật có độ quan trọng cao.' : result.piiScrubbed ? 'Đã lưu bộ nhớ; dữ liệu nhạy cảm đã được làm sạch.' : '');
      await load();
    } catch (e: any) { setError(e?.message || 'Không thể sửa bộ nhớ.'); }
  };
  const deleteMemory = async (memory: AdminMemory) => {
    if (!window.confirm(`Xóa bộ nhớ “${memory.key}” khỏi ${memory.namespace}?`)) return;
    try { await api.delete(`/api/ai/memory/${memory.id}`); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể xóa bộ nhớ.'); }
  };
  const runReflection = async () => {
    setReflecting(true);
    try { const result = await api.post<{ signalsRead: number; memoriesWritten: number }>('/api/ai/reflection/run', {}); setError(`Phân tích hoàn tất: đọc ${result.signalsRead}, ghi ${result.memoriesWritten} bản ghi bộ nhớ.`); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể chạy reflection.'); } finally { setReflecting(false); }
  };
  const fitWeights = async () => {
    setFitting(true);
    try { await api.post('/api/ai/weights/fit', {}); setError('Đã tạo bản nháp trọng số. Chỉ được đưa vào vận hành sau khi đạt bộ kiểm thử chuẩn.'); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể tính toán trọng số.'); } finally { setFitting(false); }
  };
  const updateSupport = async (request: SupportRequest) => {
    const status = supportStatus[request.id] || 'IN_PROGRESS';
    setUpdatingSupport(request.id);
    try {
      await api.patch(`/api/live-chat/support-requests/${request.id}`, { status, reply: supportReply[request.id] || undefined });
      setSupportReply(current => ({ ...current, [request.id]: '' }));
      await load();
    } catch (e: any) { setError(e?.message || 'Không thể cập nhật yêu cầu hỗ trợ.'); }
    finally { setUpdatingSupport(null); }
  };
  const promoteWeights = async (version: WeightVersion) => {
    if (!version.goldenSetPassed) {
      setError('Chưa thể triển khai: bản nháp chưa đạt bộ kiểm thử chuẩn.');
      return;
    }
    if (!window.confirm('Chỉ triển khai khi bộ kiểm thử chuẩn đã đạt. Tiếp tục?')) return;
    try { await api.post(`/api/ai/weights/${version.id}/promote`, { goldenSetPassed: true, metrics: version.metrics }); await load(); }
    catch (e: any) { setError(e?.message || 'Không thể promote weights.'); }
  };
  const updateGrowthCapability = async (capabilityKey: string, patch: { rollout?: string; active?: boolean }) => {
    setUpdatingGrowth(capabilityKey);
    try {
      await api.patch(`/api/agent-operating/marketing-growth/capabilities/${encodeURIComponent(capabilityKey)}`, patch);
      await load();
    } catch (e: any) { setError(e?.message || 'Không thể cập nhật rollout capability.'); }
    finally { setUpdatingGrowth(null); }
  };
  const updateBrainVerification = async (id: string, verificationStatus: string) => {
    try {
      await api.patch(`/api/agent-operating/marketing-growth/brain/${encodeURIComponent(id)}/verification`, { verificationStatus });
      await load();
    } catch (e: any) { setError(e?.message || 'Không thể cập nhật trạng thái Company Brain.'); }
  };
  const resetBrainForm = () => {
    setEditingBrain(null);
    setBrainForm({ documentType: 'brand_voice', documentKey: '', content: '{}', source: 'internal', sourceUrl: '', verificationStatus: 'unverified' });
  };
  const beginBrainEdit = (document: MarketingGrowthStatus['brain'][number]) => {
    setEditingBrain(document);
    setBrainForm({
      documentType: document.documentType,
      documentKey: document.documentKey,
      content: JSON.stringify(document.content || {}, null, 2),
      source: document.source,
      sourceUrl: document.sourceUrl || '',
      verificationStatus: document.verificationStatus,
    });
  };
  const saveBrain = async () => {
    if (!brainForm.documentKey.trim() || !brainForm.source.trim()) {
      setError('Tên tài liệu và nguồn là bắt buộc.');
      return;
    }
    let content: Record<string, unknown>;
    try {
      const parsed = JSON.parse(brainForm.content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      content = parsed;
    } catch {
      setError('Nội dung Company Brain phải là JSON hợp lệ dạng object.');
      return;
    }
    setSavingBrain(true);
    try {
      const payload = { ...brainForm, documentKey: brainForm.documentKey.trim(), source: brainForm.source.trim(), sourceUrl: brainForm.sourceUrl.trim() || null, content };
      if (editingBrain) await api.put(`/api/agent-operating/marketing-growth/brain/${encodeURIComponent(editingBrain.id)}`, payload);
      else await api.post('/api/agent-operating/marketing-growth/brain', payload);
      resetBrainForm();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không thể lưu tài liệu Company Brain.');
    } finally { setSavingBrain(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600"><Bot size={16} /> Vận hành tác tử AI</div>
          <h1 className="text-2xl font-bold text-slate-900">Bảng điều khiển quản trị Agent</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi Agent Minh và các agent theo nguyên tắc có người kiểm soát.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={17} /> {error}</div>}
      {loading && !summary ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Đang tải trạng thái agent…</div> : summary && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           {[
            ['Lần chạy đang xử lý', count(summary.executions, 'RUNNING'), 'text-indigo-600'],
            ['Chờ nhân viên', count(summary.humanQuestions, 'OPEN'), 'text-amber-600'],
            ['Event lỗi', count(summary.events, 'FAILED') + count(summary.events, 'DEAD_LETTER'), 'text-rose-600'],
            ['Đã hoàn tất', count(summary.executions, 'SUCCESS'), 'text-emerald-600'],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div></div>)}
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
             <div className="flex items-center gap-2"><Filter size={19} className="text-rose-600" /><div><h2 className="font-semibold text-slate-900">Sự kiện cần vận hành</h2><p className="text-xs text-slate-500">Sự kiện treo phiên xử lý hoặc lỗi nhiều lần được đưa lên đầu.</p></div></div>
            <button onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} /> Làm mới</button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
             <Dropdown label="Mức độ ưu tiên" value={eventFilters.urgency} onChange={value => eventFilter('urgency', String(value))} options={[{ value: 'ALL', label: 'Mọi mức độ' }, { value: 'HIGH', label: 'Cao (≥75)' }, { value: 'NORMAL', label: 'Vừa (40–74)' }, { value: 'LOW', label: 'Thấp (<40)' }]} variant="compact" />
             <Dropdown label="Phiên xử lý" value={eventFilters.lease} onChange={value => eventFilter('lease', String(value))} options={[{ value: 'ALL', label: 'Mọi phiên' }, { value: 'EXPIRED', label: 'Đã hết hạn' }, { value: 'ACTIVE', label: 'Đang giữ phiên' }, { value: 'NONE', label: 'Không có phiên' }]} variant="compact" />
             <Dropdown label="Sự kiện lỗi" value={eventFilters.deadLetter} onChange={value => eventFilter('deadLetter', String(value))} options={[{ value: 'ALL', label: 'Tất cả sự kiện' }, { value: 'YES', label: 'Chỉ sự kiện lỗi' }, { value: 'NO', label: 'Không có sự kiện lỗi' }]} variant="compact" />
          </div>
           {events.length === 0 ? <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Không có sự kiện phù hợp bộ lọc.</div> : <div className="space-y-2">{events.map(event => {
            const attention = event.status === 'DEAD_LETTER' || event.lease_expired;
            return <div key={event.id} className={`rounded-lg border p-4 ${event.status === 'DEAD_LETTER' ? 'border-rose-200 bg-rose-50/40' : event.lease_expired ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
               <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{event.event_type}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.status === 'DEAD_LETTER' ? 'bg-rose-100 text-rose-800' : event.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{eventStatusLabel[event.status] || event.status}</span><span className="text-xs text-slate-500">Mức độ {event.urgency}</span></div><p className="mt-1 text-xs text-slate-500">Mã {event.event_id} · {new Date(event.created_at).toLocaleString('vi-VN')}</p></div>{(event.status === 'FAILED' || event.status === 'DEAD_LETTER') && <button onClick={() => void replayEvent(event)} disabled={replaying === event.id} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><PlayCircle size={14} /> {replaying === event.id ? 'Đang chạy lại…' : 'Chạy lại có kiểm soát'}</button>}</div>
               <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><span><b>Số lần thử:</b> {event.attempts}</span><span><b>Phiên:</b> {event.lease_expires_at ? `${event.lease_expired ? 'Đã hết hạn' : 'Hết hạn'} ${new Date(event.lease_expires_at).toLocaleString('vi-VN')}` : 'Không có'}</span><span><b>Mã chống trùng:</b> <code className="break-all">{event.idempotency_key}</code></span></div>
              {(attention || event.last_error) && <div className="mt-3 rounded-md bg-white/80 px-3 py-2 text-xs"><b>{event.last_error ? 'Lỗi cuối: ' : ''}</b>{event.last_error || (event.lease_expired ? 'Worker không hoàn tất trước khi lease hết hạn.' : '')}</div>}
               {event.replay_history?.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><div className="mb-2 text-xs font-semibold text-slate-700">Lịch sử chạy lại</div><div className="space-y-1.5">{event.replay_history.map(replay => <div key={replay.id} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="flex flex-wrap justify-between gap-2"><span><b>Lần {replay.replay_number}</b> · {eventStatusLabel[replay.result_status] || replay.result_status} · người vận hành {replay.operator_id}</span><span>{new Date(replay.requested_at).toLocaleString('vi-VN')}</span></div><div className="mt-1">{replay.reason}</div>{replay.result_error && <div className="mt-1 text-rose-700">Kết quả lỗi: {replay.result_error}</div>}</div>)}</div></div>}
            </div>;
          })}</div>}
        </section>
           <section className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm">
           <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
             <div className="flex items-center gap-2"><BrainCircuit size={19} className="text-indigo-600" /><div><h2 className="font-semibold text-slate-900">Bộ nhớ của Agent</h2><p className="text-xs text-slate-500">Dữ liệu riêng của tenant · bản ghi hết hạn vẫn hiển thị để quản trị viên quyết định xóa.</p></div></div>
             <div className="flex gap-2"><button onClick={() => void runReflection()} disabled={reflecting} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><BrainCircuit size={14} /> {reflecting ? 'Đang phân tích…' : 'Chạy phân tích bộ nhớ'}</button><button onClick={() => void fitWeights()} disabled={fitting} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700">{fitting ? 'Đang tính toán…' : 'Tạo bản nháp trọng số'}</button></div>
           </div>
            <div className="mb-4 grid gap-2 md:grid-cols-3"><input aria-label="Lọc không gian bộ nhớ" value={memoryFilters.namespace} onChange={e => setMemoryFilters({ ...memoryFilters, namespace: e.target.value })} placeholder="Không gian (customer:...)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><Dropdown label="Loại bộ nhớ" value={memoryFilters.kind || '__ALL__'} onChange={value => setMemoryFilters({ ...memoryFilters, kind: String(value) === '__ALL__' ? '' : String(value) })} options={[{ value: '__ALL__', label: 'Mọi loại' }, { value: 'fact', label: 'Sự thật' }, { value: 'episodic', label: 'Theo sự kiện' }, { value: 'procedural', label: 'Quy trình' }]} variant="compact" /><Dropdown label="Mức độ quan trọng" value={memoryFilters.importance || '__ALL__'} onChange={value => setMemoryFilters({ ...memoryFilters, importance: String(value) === '__ALL__' ? '' : String(value) })} options={[{ value: '__ALL__', label: 'Mọi mức độ' }, { value: 'HIGH', label: 'Cao (≥ 0,7)' }, { value: 'MEDIUM', label: 'Vừa' }, { value: 'LOW', label: 'Thấp' }]} variant="compact" /></div>
            {memories.length === 0 ? <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">Không có bản ghi phù hợp.</p> : <div className="space-y-2">{memories.map(memory => <div key={memory.id} className={`rounded-lg border bg-white p-3 ${memory.expired ? 'border-amber-300' : memory.conflict ? 'border-rose-300' : 'border-slate-100'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{memory.key}</b><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{memoryKindLabel[memory.kind] || memory.kind}</span>{memory.expired && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Hết hạn</span>}{memory.conflict && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">Xung đột</span>}</div><p className="mt-1 text-xs text-slate-500">{memory.namespace} · mức độ {Number(memory.importance).toFixed(2)} · {memory.hits} lượt dùng</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{memory.value}</p></div><div className="flex shrink-0 gap-1"><button aria-label={`Sửa ${memory.key}`} onClick={() => beginEdit(memory)} className="rounded-md border border-slate-200 p-2 text-indigo-700 hover:bg-indigo-50"><Edit3 size={14} /></button><button aria-label={`Xóa ${memory.key}`} onClick={() => void deleteMemory(memory)} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></button></div></div></div>)}</div>}
            {weights && <div className="mt-5 border-t border-indigo-100 pt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Trọng số ghép nhu cầu</h3><span className="text-xs text-slate-500">Đang dùng: {Object.entries(weights.live || {}).map(([k, v]) => `${metricLabel(k)} ${v}`).join(' · ')}</span></div><div className="space-y-1">{weights.versions.map(version => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"><span><b className={version.status === 'live' ? 'text-emerald-700' : version.status === 'draft' ? 'text-amber-700' : 'text-slate-500'}>{version.status === 'live' ? 'ĐANG DÙNG' : version.status === 'draft' ? 'BẢN NHÁP' : 'QUAN SÁT'}</b> · {new Date(version.created_at).toLocaleString('vi-VN')}</span><span>{version.goldenSetPassed ? 'Bộ kiểm thử đạt' : 'Chưa đạt'}</span>{version.status === 'draft' && <button disabled={!version.goldenSetPassed} onClick={() => void promoteWeights(version)} className="rounded-md border border-indigo-200 px-2 py-1 font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Triển khai sau khi đạt kiểm thử</button>}</div>)}</div></div>}
         </section>
         {marketingGrowth && <section className="rounded-xl border border-violet-200 bg-violet-50/30 p-5 shadow-sm">
           <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
             <div><div className="flex items-center gap-2"><BrainCircuit size={19} className="text-violet-700" /><h2 className="font-semibold text-slate-900">Company Brain & Marketing/Growth</h2></div><p className="mt-1 text-xs text-slate-500">Dữ liệu riêng của tenant · mọi thay đổi đều bắt đầu ở chế độ quan sát.</p></div>
             <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-800">{marketingGrowth.capabilities.length} capability</span>
           </div>
           <div className="grid gap-4 xl:grid-cols-2">
             <div>
               <h3 className="mb-2 text-sm font-semibold text-slate-800">Nguồn sự thật</h3>
                <div className="mb-3 rounded-lg border border-violet-100 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between"><b className="text-xs text-slate-700">{editingBrain ? 'Sửa tài liệu Company Brain' : 'Thêm tài liệu Company Brain'}</b>{editingBrain && <button onClick={resetBrainForm} className="text-xs text-slate-500">Hủy</button>}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Dropdown label="Loại tài liệu" value={brainForm.documentType} onChange={value => setBrainForm(current => ({ ...current, documentType: String(value) }))} options={Object.entries(brainTypeLabel).map(([value, label]) => ({ value, label }))} variant="compact" />
                    <input aria-label="Tên tài liệu Company Brain" value={brainForm.documentKey} onChange={event => setBrainForm(current => ({ ...current, documentKey: event.target.value }))} placeholder="Tên tài liệu" maxLength={160} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input aria-label="Nguồn tài liệu" value={brainForm.source} onChange={event => setBrainForm(current => ({ ...current, source: event.target.value }))} placeholder="Nguồn tài liệu" maxLength={240} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input aria-label="Đường dẫn nguồn tài liệu" value={brainForm.sourceUrl} onChange={event => setBrainForm(current => ({ ...current, sourceUrl: event.target.value }))} placeholder="Đường dẫn nguồn (không bắt buộc)" maxLength={2000} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <Dropdown label="Trạng thái xác minh" value={brainForm.verificationStatus} onChange={value => setBrainForm(current => ({ ...current, verificationStatus: String(value) }))} options={[{ value: 'unverified', label: 'Chưa xác minh' }, { value: 'needs_review', label: 'Cần xem lại' }, { value: 'verified', label: 'Đã xác minh' }, { value: 'stale', label: 'Đã cũ' }]} variant="compact" />
                    <textarea aria-label="Nội dung Company Brain dạng JSON" value={brainForm.content} onChange={event => setBrainForm(current => ({ ...current, content: event.target.value }))} placeholder={'Nội dung JSON, ví dụ: {"tone":"thân thiện"}'} className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs sm:col-span-2" />
                  </div>
                  <button onClick={() => void saveBrain()} disabled={savingBrain} className="mt-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingBrain ? 'Đang lưu…' : editingBrain ? 'Lưu thay đổi' : 'Thêm tài liệu'}</button>
                </div>
                {marketingGrowth.brain.length === 0 ? <div className="rounded-lg bg-white p-4 text-sm text-slate-500">Chưa có tài liệu Company Brain trong tenant này.</div> : <div className="space-y-2">{marketingGrowth.brain.map(doc => <div key={doc.id} className="rounded-lg border border-violet-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-slate-900">{doc.documentKey}</b><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{brainTypeLabel[doc.documentType] || doc.documentType}</span></div><div className="flex items-center gap-2"><Dropdown label="Trạng thái xác minh" value={doc.verificationStatus} onChange={value => void updateBrainVerification(doc.id, String(value))} options={[{ value: 'verified', label: 'Đã xác minh' }, { value: 'needs_review', label: 'Cần xem lại' }, { value: 'unverified', label: 'Chưa xác minh' }, { value: 'stale', label: 'Đã cũ' }]} variant="compact" /><button onClick={() => beginBrainEdit(doc)} className="rounded-md border border-slate-200 p-2 text-violet-700" aria-label={`Sửa ${doc.documentKey}`}><Edit3 size={14} /></button></div></div><div className="mt-2 text-[11px] text-slate-500">Nguồn: {doc.source}{doc.sourceUrl ? ` · ${doc.sourceUrl}` : ''} · cập nhật {new Date(doc.updatedAt).toLocaleString('vi-VN')}</div></div>)}</div>}
             </div>
             <div>
               <h3 className="mb-2 text-sm font-semibold text-slate-800">Rollout & phê duyệt</h3>
               <div className="space-y-2">{marketingGrowth.capabilities.map(capability => <div key={capability.capabilityKey} className="rounded-lg border border-violet-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-slate-900">{capability.displayName}</b><div className="text-[11px] text-slate-500">{cadenceLabel[capability.cadence] || capability.cadence} · phiên bản {capability.promptVersion}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${capability.rollout === 'LIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{rolloutLabel[capability.rollout] || capability.rollout}</span></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className={`text-[11px] font-semibold ${capability.requiresHumanApproval ? 'text-amber-700' : 'text-emerald-700'}`}>{capability.requiresHumanApproval ? 'Bắt buộc người duyệt' : 'Không tự xuất bản hoặc gửi'}</span><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={capability.active} onChange={event => void updateGrowthCapability(capability.capabilityKey, { active: event.target.checked })} disabled={updatingGrowth === capability.capabilityKey} /> Hoạt động</label><Dropdown label="Mức triển khai" value={capability.rollout} onChange={value => void updateGrowthCapability(capability.capabilityKey, { rollout: String(value) })} disabled={updatingGrowth === capability.capabilityKey} options={[{ value: 'SHADOW', label: 'Quan sát' }, { value: 'CANARY_25', label: 'Thử nghiệm 25%' }, { value: 'CANARY_50', label: 'Thử nghiệm 50%' }, { value: 'LIVE', label: 'Đang vận hành' }]} variant="compact" /></div></div></div>)}</div>
             </div>
           </div>
         </section>}
         {editingMemory && <div className="rounded-xl border border-indigo-300 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Sửa memory: {editingMemory.key}</h3><button onClick={() => setEditingMemory(null)} className="text-sm text-slate-500">Hủy</button></div><div className="grid gap-3 md:grid-cols-2"><input value={memoryForm.namespace} onChange={e => setMemoryForm({ ...memoryForm, namespace: e.target.value })} placeholder="Namespace" className="rounded-lg border px-3 py-2 text-sm" /><input value={memoryForm.key} onChange={e => setMemoryForm({ ...memoryForm, key: e.target.value })} placeholder="Key" className="rounded-lg border px-3 py-2 text-sm" /><Dropdown value={memoryForm.kind} onChange={value => setMemoryForm({ ...memoryForm, kind: String(value) })} options={[{ value: 'fact', label: 'Fact' }, { value: 'episodic', label: 'Episodic' }, { value: 'procedural', label: 'Procedural' }]} variant="compact" /><input type="number" min="0" max="1" step="0.05" value={memoryForm.importance} onChange={e => setMemoryForm({ ...memoryForm, importance: e.target.value })} placeholder="Importance" className="rounded-lg border px-3 py-2 text-sm" /><textarea value={memoryForm.value} onChange={e => setMemoryForm({ ...memoryForm, value: e.target.value })} placeholder="Nội dung memory" className="min-h-24 rounded-lg border px-3 py-2 text-sm md:col-span-2" /></div><button onClick={() => void saveMemory()} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"><Save size={15} /> Lưu an toàn</button></div>}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck size={19} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Thẻ vai trò và triển khai</h2></div>
          <div className="grid gap-3 md:grid-cols-3">{summary.roleCards.map(card => {
            const rollout = summary.rollouts.find(item => item.agent_key === card.agentKey);
            return <div key={card.agentKey} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{card.title}</h3><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{rollout?.status || card.rollout}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{card.mission}</p>
              <div className="mt-3 text-[11px] text-slate-500">KPI: {card.kpis.join(' · ')}</div>
              {rollout?.shadow_enabled && <div className="mt-2 text-[11px] font-medium text-amber-700">Chế độ quan sát · không tác động hệ thống thật</div>}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <span className={`text-[11px] font-semibold ${card.approval_status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>{card.approval_status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}</span>
                <button onClick={() => void approveCard(card.agentKey, card.approval_status !== 'APPROVED')} disabled={approving === card.agentKey} className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-50">{approving === card.agentKey ? 'Đang cập nhật…' : card.approval_status === 'APPROVED' ? 'Thu hồi phê duyệt' : 'Thực hiện phê duyệt thẻ vai trò'}</button>
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
          <div className="mb-4 flex items-center gap-2"><Clock3 size={19} className="text-amber-700" /><h2 className="font-semibold text-slate-900">Hàng đợi cần nhân viên xử lý</h2><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{questions.length}</span></div>
          {questions.length === 0 ? <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-600" /> Không có câu hỏi đang chờ.</div> : <div className="space-y-3">{questions.map(question => <div key={question.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-indigo-700">{question.agent_key}</span><span className="text-xs text-slate-500">Ưu tiên {question.priority}</span></div>
            <p className="mt-2 text-sm text-slate-800">{question.question}</p>
            <div className="mt-3 flex flex-wrap gap-2"><input value={answering === question.id ? answer : ''} onChange={event => { setAnswering(question.id); setAnswer(event.target.value); }} placeholder="Trả lời để agent tiếp tục…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" /><button onClick={() => void submitAnswer(question.id)} disabled={answering === question.id && !answer.trim()} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> Trả lời</button></div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={approveMemory} onChange={event => setApproveMemory(event.target.checked)} /> Cho phép đưa câu trả lời vào memory</label>
          </div>)}</div>}
        </section>
         <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-5 shadow-sm">
           <div className="mb-4 flex items-center gap-2"><Send size={19} className="text-sky-700" /><h2 className="font-semibold text-slate-900">Yêu cầu hỗ trợ từ người dùng</h2><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{supportRequests.length}</span></div>
           {supportRequests.length === 0 ? <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-600" /> Không có yêu cầu mới.</div> : <div className="space-y-3">{supportRequests.map(request => <div key={request.id} className="rounded-lg border border-sky-200 bg-white p-4">
             <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-slate-900">{request.trackingCode}</b><span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{request.status}</span></div><span className="text-xs text-slate-500">{request.requesterName || request.requesterEmail || 'Người dùng'} · {new Date(request.updatedAt).toLocaleString('vi-VN')}</span></div>
             <h3 className="mt-2 text-sm font-semibold text-slate-800">{request.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{request.description}</p>
             {request.latestReply && <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">Phản hồi gần nhất: {request.latestReply}</p>}
             <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><Dropdown value={supportStatus[request.id] || (request.status === 'RECEIVED' ? 'IN_PROGRESS' : request.status)} onChange={value => setSupportStatus(current => ({ ...current, [request.id]: String(value) }))} options={[{ value: 'IN_PROGRESS', label: 'Đang xử lý' }, { value: 'WAITING_FOR_USER', label: 'Chờ người dùng' }, { value: 'RESOLVED', label: 'Đã xử lý' }, { value: 'CLOSED', label: 'Đóng yêu cầu' }]} variant="compact" /><input value={supportReply[request.id] || ''} onChange={event => setSupportReply(current => ({ ...current, [request.id]: event.target.value }))} placeholder="Phản hồi cho người dùng (không gửi dữ liệu nhạy cảm)" maxLength={2000} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button onClick={() => void updateSupport(request)} disabled={updatingSupport === request.id} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{updatingSupport === request.id ? 'Đang lưu…' : 'Cập nhật'}</button></div>
           </div>)}</div>}
         </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><XCircle size={18} className="text-slate-500" /><h2 className="font-semibold text-slate-900">Audit gần đây</h2></div><div className="divide-y divide-slate-100">{summary.recentAudit.slice(0, 8).map((event, index) => <div key={`${event.created_at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{event.event_type}</span><span className="text-xs text-slate-500">{event.status} · {new Date(event.created_at).toLocaleString('vi-VN')}</span></div>)}</div></section>
      </>}
    </div>
  );
}