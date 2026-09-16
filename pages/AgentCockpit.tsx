import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle, BarChart3, ClipboardCheck, RotateCcw, Filter, PlayCircle, Save, Trash2, Edit3, BrainCircuit, Lightbulb, Download } from 'lucide-react';
import { api } from '../services/api/apiClient';
import { Dropdown } from '../components/Dropdown';
import { GalleryCleanupPanel } from '../components/GalleryCleanupPanel';
import { AgentNeuronMap } from '../components/AgentNeuronMap';
import { notificationApi, ZaloReadinessWarning } from '../services/api/notificationApi';

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
  degraded?: boolean;
  warning?: string;
  availability?: Partial<Record<CockpitPanel, { available: boolean; error?: string }>>;
  unavailablePanels?: CockpitPanel[];
};
type CockpitPanel = 'events' | 'questions' | 'executions' | 'audit' | 'rollouts' | 'weeklyKpi' | 'shiftReports' | 'roleCards' | 'rollbackAudits';
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
type AutoPostingDiagnosticComponent = {
  ready: boolean;
  code: string;
  message: string;
};
type AutoPostingDiagnostic = {
  ok: boolean;
  code: string;
  dryRun: boolean;
  checkedAt: string;
  failedComponents: string[];
  endpoint: AutoPostingDiagnosticComponent & {
    destination: string | null;
    path: string;
    auth: string;
  };
  cronSecret: AutoPostingDiagnosticComponent & { configured: boolean };
  qstash: AutoPostingDiagnosticComponent & {
    configured: boolean;
    verified: boolean;
    endpoint: string | null;
    schedule: {
      id: string;
      destination: string | null;
      cron: string | null;
      startup: { status?: string; destination?: string | null; cron?: string | null };
      current: { destination: string | null; cron: string | null; method: string | null } | null;
    };
  };
  sideEffects: {
    dailyRuns: boolean;
    ledgerWrites: boolean;
    publications: boolean;
    providerCalls: boolean;
    qstashWrites: boolean;
  };
};
type MinhOpportunity = {
  id: string;
  subjectType: string;
  subjectId: string;
  createdAt: string;
  kind: string;
  priority: number;
  confidence: number;
  title: string;
  rationale: string;
  suggestedNextStep: string;
  evidence: Record<string, unknown>;
  permission: string;
  actionCreated: boolean;
  approval?: { id: string; status: string; actionType: string } | null;
};
type MinhDecisionApproval = {
  id: string;
  actionType: string;
  status: string;
  reasoning?: string | null;
  requestedAt?: string;
  subjectType?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
};
type MinhDecisionLearning = {
  windowDays: number;
  totals: {
    total: number;
    approved: number;
    rejected: number;
    executed: number;
    execution_failed: number;
    answered: number;
  };
  byOutcome?: Array<{ outcome: string; count: number }>;
  byCategory?: Array<{ category: string; count: number }>;
  byAction: Array<{ action_type: string; outcome: string; count: number }>;
  rawPayloadIncluded: boolean;
  rawAnswerIncluded?: boolean;
  providerPayloadIncluded?: boolean;
};
type MinhLearningTrendResponse = {
  generatedAt: string;
  degraded: boolean;
  warning?: string;
  trend: {
    windowDays: number;
    granularity: 'day';
    points: Array<{
      date: string;
      total: number;
      approved: number;
      rejected: number;
      executed: number;
      execution_failed: number;
      answered: number;
    }>;
    empty: boolean;
    rawPayloadIncluded: false;
    rawAnswerIncluded: false;
    providerPayloadIncluded: false;
  } | null;
};
type MinhLearningSnapshot = NonNullable<MinhLearningTrendResponse['trend']>;
type MinhLearningExportHistoryItem = {
  operatorId: string;
  windowDays: number;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
};
type MinhLearningExportHistoryResponse = {
  exports: MinhLearningExportHistoryItem[];
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  degraded?: boolean;
  warning?: string;
};
type MinhBrainOverview = {
  scheduler: {
    mode: string;
    enabled: boolean;
    lastTickAt: string | null;
    detectorSummary: {
      enabled: boolean;
      lastRunAt: string | null;
      tenantRuns: number;
      opportunitiesFound: number;
      opportunitiesPersisted: number;
      degradedRuns: number;
    detectorStatus: Array<{ detector: string; status: 'OBSERVED' | 'DEGRADED'; tenantRuns: number; found: number; persisted: number; lastError?: string }>;
    };
  };
  routing: { registryErrors: string[] };
  opportunities: MinhOpportunity[];
  decisionQueue?: MinhDecisionApproval[];
  proactiveBudget?: { used: number; budget: number; exceeded: boolean } | null;
  proactiveRollout?: { capabilityKey: string; rollout: string; active: boolean } | null;
  learning?: MinhDecisionLearning | null;
  degraded?: boolean;
  warning?: string;
};
type MinhCommandCenterPanel<T> = {
  state: 'available' | 'unavailable' | 'degraded' | 'not_loaded';
  data: T | null;
  message?: string;
};
type MinhCommandCenterSummary = {
  generatedAt: string;
  stale?: boolean;
  warning?: string;
  brainHealth: MinhCommandCenterPanel<{
    delegations7d: number;
    delegationSuccess7d: number;
    capabilityGaps7d: number;
    latencySloBreaches24h: number;
    pendingRuns: number | null;
    errors24h: number | null;
  }>;
  opportunityQueue: MinhCommandCenterPanel<Array<{ opportunityId: string; detector: string | null; priority: string | number | null; confidence: number | null; approvalStatus: string | null }>>;
  approvalQueue: MinhCommandCenterPanel<Array<{ id: string; actionType: string | null; risk: string; requiredApprover: string; status: string }>>;
  learningStatus: MinhCommandCenterPanel<{
    candidate: { id: string; agentKey: string; status: string; createdAt: string; gateSummary: unknown } | null;
    evaluation: { id: string; cycleKey: string; status: string; startedAt: string; finishedAt: string | null; summary: unknown } | null;
    gateStatus: 'PASSED' | 'FAILED' | 'PENDING' | null;
    canary: { candidateId: string; agentKey: string; since: string } | null;
    regression: { failures: string[] } | null;
    rollback: { candidateId: string; reason: string; createdAt: string } | null;
  }>;
  schedulerRepair: MinhCommandCenterPanel<{
    timer: { mode: string; enabled: boolean; startedAt: string | null; lastTickAt: string | null; tickCount: number; lastStatus: string };
    deadLetterCount: number | null;
    staleLeaseCount: number | null;
    repairSpikeCount7d: number | null;
    lastSuccessfulRunAt: string | null;
  }>;
};

const count = (rows: Array<{ status: string; count: number }> = [], status: string) => rows.find(row => row.status === status)?.count || 0;
const cockpitPanelAvailable = (summary: CockpitSummary, panel: CockpitPanel) =>
  summary.availability?.[panel]?.available ?? !summary.degraded;
const cockpitMetric = (summary: CockpitSummary, panel: CockpitPanel, rows: Array<{ status: string; count: number }>, status: string) =>
  cockpitPanelAvailable(summary, panel) ? count(rows, status) : '—';
const cockpitPanelLabel: Record<CockpitPanel, string> = {
  events: 'sự kiện',
  questions: 'hàng đợi câu hỏi nhân viên',
  executions: 'lượt chạy',
  audit: 'audit gần đây',
  rollouts: 'rollout',
  weeklyKpi: 'KPI tuần',
  shiftReports: 'báo cáo ca',
  roleCards: 'thẻ vai trò',
  rollbackAudits: 'audit rollback',
};
const panelUnavailableMessage = (summary: CockpitSummary, panel: CockpitPanel) =>
  cockpitPanelAvailable(summary, panel) ? null : `Không thể tải ${cockpitPanelLabel[panel]}. Dữ liệu chưa khả dụng; hãy thử làm mới.`;
function PanelWarning({ summary, panel }: { summary: CockpitSummary; panel: CockpitPanel }) {
  const message = panelUnavailableMessage(summary, panel);
  return message ? <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={15} /> {message}</div> : null;
}
function MinhCommandCenterPanelCard({ title, panel, children }: { title: string; panel: MinhCommandCenterPanel<unknown>; children: React.ReactNode }) {
  const stateLabel = panel.state === 'available' ? 'Sẵn sàng'
    : panel.state === 'degraded' ? 'Degraded'
      : panel.state === 'not_loaded' ? 'Chưa tải' : 'Không khả dụng';
  const stateClass = panel.state === 'available' ? 'bg-emerald-100 text-emerald-700'
    : panel.state === 'degraded' ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-700';
  const headingId = `minh-command-center-panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const statusAnnouncement = `${title}: ${stateLabel}${panel.message ? `. ${panel.message}` : ''}`;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3" role="group" aria-labelledby={headingId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-xs font-semibold text-slate-800">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateClass}`}
          role="status"
          aria-label={statusAnnouncement}
          aria-live="polite"
          aria-atomic="true"
        >
          {stateLabel}
        </span>
      </div>
      {panel.data === null
        ? <div className="text-xs text-rose-700">{panel.message || 'Dữ liệu chưa khả dụng; hãy thử làm mới.'}</div>
        : <>
          {panel.message && <div className="mb-2 text-[11px] text-amber-700">{panel.message}</div>}
          {children}
        </>}
    </div>
  );
}
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
  const [zaloReadinessWarnings, setZaloReadinessWarnings] = useState<ZaloReadinessWarning[]>([]);
  const [autoPostingDiagnostic, setAutoPostingDiagnostic] = useState<AutoPostingDiagnostic | null>(null);
  const [autoPostingDiagnosticError, setAutoPostingDiagnosticError] = useState('');
  const [minhBrainOverview, setMinhBrainOverview] = useState<MinhBrainOverview | null>(null);
  const [minhCommandCenter, setMinhCommandCenter] = useState<MinhCommandCenterSummary | null>(null);
  const [minhCommandCenterRefreshError, setMinhCommandCenterRefreshError] = useState('');
  const [minhLearningTrend, setMinhLearningTrend] = useState<MinhLearningTrendResponse | null>(null);
  const [minhDecisionBusy, setMinhDecisionBusy] = useState<string | null>(null);
  const [minhLearningDays, setMinhLearningDays] = useState(30);
  const [minhLearningExporting, setMinhLearningExporting] = useState(false);
  const [minhLearningExportHistory, setMinhLearningExportHistory] = useState<MinhLearningExportHistoryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setAutoPostingDiagnosticError(''); setAutoPostingDiagnostic(null);
    setMinhLearningTrend(null);
    try {
      const query = new URLSearchParams(eventFilters).toString();
      const nextSummary = await api.get<CockpitSummary>('/api/agent-operating/cockpit');
      setSummary(nextSummary);
      const [questionsResult, eventsResult, supportResult, marketingGrowthResult, zaloReadinessResult, autoPostingDiagnosticResult, minhBrainResult, minhCommandCenterResult, minhLearningTrendResult, minhLearningExportHistoryResult] = await Promise.allSettled([
        api.get<HumanQuestion[]>('/api/agent-operating/questions'),
        api.get<OperatingEvent[]>(`/api/agent-operating/events?${query}`),
        api.get<{ data: SupportRequest[] }>('/api/live-chat/support-requests'),
        api.get<MarketingGrowthStatus>('/api/agent-operating/marketing-growth'),
        notificationApi.getZaloReadinessWarnings(),
        api.get<AutoPostingDiagnostic>('/api/auto-posting/diagnostic'),
        api.get<MinhBrainOverview>(`/api/internal/minh-brain/overview?limit=50&days=${minhLearningDays}`),
        api.get<MinhCommandCenterSummary>('/api/internal/minh-brain/command-center'),
        api.get<MinhLearningTrendResponse>(`/api/internal/minh-brain/learning/trends?days=${minhLearningDays}`),
        api.get<MinhLearningExportHistoryResponse>('/api/internal/minh-brain/learning/trends/exports?limit=20&offset=0'),
      ]);
      if (questionsResult.status === 'fulfilled') setQuestions(questionsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
      if (supportResult.status === 'fulfilled') setSupportRequests(supportResult.value.data || []);
      if (marketingGrowthResult.status === 'fulfilled') setMarketingGrowth(marketingGrowthResult.value);
      if (zaloReadinessResult.status === 'fulfilled') setZaloReadinessWarnings(zaloReadinessResult.value.warnings || []);
      if (autoPostingDiagnosticResult.status === 'fulfilled') {
        setAutoPostingDiagnostic(autoPostingDiagnosticResult.value);
      } else {
        setAutoPostingDiagnosticError(autoPostingDiagnosticResult.reason?.message || 'Không thể tải readiness trigger Facebook.');
      }
      if (minhBrainResult.status === 'fulfilled') setMinhBrainOverview(minhBrainResult.value);
      if (minhCommandCenterResult.status === 'fulfilled') {
        setMinhCommandCenter({ ...minhCommandCenterResult.value, stale: false, warning: undefined });
        setMinhCommandCenterRefreshError('');
      } else {
        const refreshWarning = 'Không thể làm mới Command Center. Dữ liệu đang hiển thị có thể đã cũ; hãy thử lại.';
        setMinhCommandCenter(current => current
          ? { ...current, stale: true, warning: refreshWarning }
          : current);
        setMinhCommandCenterRefreshError(refreshWarning);
      }
      if (minhLearningTrendResult.status === 'fulfilled') setMinhLearningTrend(minhLearningTrendResult.value);
      if (minhLearningExportHistoryResult.status === 'fulfilled') setMinhLearningExportHistory(minhLearningExportHistoryResult.value);
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
  }, [eventFilters, memoryFilters, minhLearningDays]);
  useEffect(() => { void load(); }, [load]);

  const exportMinhLearningSnapshot = async () => {
    setMinhLearningExporting(true);
    try {
      const snapshot = await api.get<MinhLearningSnapshot>(`/api/internal/minh-brain/learning/trends/export?days=${minhLearningDays}`);
      const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `minh-learning-${snapshot.windowDays}d-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      try {
        const history = await api.get<MinhLearningExportHistoryResponse>('/api/internal/minh-brain/learning/trends/exports?limit=20&offset=0');
        setMinhLearningExportHistory(history);
      } catch {
        // The downloaded snapshot remains successful even if history refresh is temporarily unavailable.
      }
    } catch (e: any) {
      setError(e?.data?.warning || e?.message || 'Không thể xuất snapshot learning của Minh.');
    } finally {
      setMinhLearningExporting(false);
    }
  };

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
  const reviewMinhDecision = async (id: string, action: 'approve' | 'reject') => {
    setMinhDecisionBusy(id);
    try {
      const note = action === 'reject'
        ? window.prompt('Lý do từ chối đề xuất Minh:', 'Chưa đủ bằng chứng hoặc chưa phù hợp') || ''
        : '';
      if (action === 'reject' && !note.trim()) return;
      await api.post(`/api/approval-requests/${id}/${action}`, note ? { note: note.trim() } : {});
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không thể cập nhật đề xuất proactive.');
    } finally {
      setMinhDecisionBusy(null);
    }
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
      <GalleryCleanupPanel />
      <AgentNeuronMap />
      {loading && minhCommandCenter && (
        <div className="sr-only" role="status" aria-label="Đang làm mới Command Center" aria-live="polite" aria-atomic="true">
          Đang làm mới Command Center…
        </div>
      )}
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={17} /> {error}</div>}
      {loading && !summary ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Đang tải trạng thái agent…</div> : summary && <>
         {summary.degraded && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
           <div className="flex items-center gap-2"><AlertTriangle size={17} /> {summary.warning || 'Một phần dữ liệu vận hành đang tạm thời không khả dụng.'}</div>
           {!!summary.unavailablePanels?.length && <div className="mt-1 pl-6 text-xs">Chưa tải được: {summary.unavailablePanels.map(panel => cockpitPanelLabel[panel]).join(', ')}.</div>}
         </div>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           {[
             ['Lần chạy đang xử lý', cockpitMetric(summary, 'executions', summary.executions, 'RUNNING'), 'text-indigo-600'],
             ['Chờ nhân viên', cockpitMetric(summary, 'questions', summary.humanQuestions, 'OPEN'), 'text-amber-600'],
             ['Event lỗi', cockpitPanelAvailable(summary, 'events') ? count(summary.events, 'FAILED') + count(summary.events, 'DEAD_LETTER') : '—', 'text-rose-600'],
             ['Đã hoàn tất', cockpitMetric(summary, 'executions', summary.executions, 'SUCCESS'), 'text-emerald-600'],
           ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div></div>)}
        </div>
          {(minhCommandCenter || minhCommandCenterRefreshError) && <section className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm" aria-labelledby="minh-command-center-title">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <BrainCircuit size={19} className="mt-0.5 text-indigo-600" />
                <div>
                  <h2 id="minh-command-center-title" className="font-semibold text-slate-900">Command Center của Minh</h2>
                  <p className="text-xs text-slate-600">Năm panel vận hành độc lập; dữ liệu chưa tải được luôn được hiển thị rõ ràng.</p>
                </div>
              </div>
              {minhCommandCenter
                ? <span className={`text-[11px] ${minhCommandCenter.stale ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                    {minhCommandCenter.stale ? 'Snapshot cuối có thể đã cũ' : `Cập nhật ${new Date(minhCommandCenter.generatedAt).toLocaleTimeString('vi-VN')}`}
                  </span>
                : <span className="text-[11px] font-semibold text-rose-700">Chưa có snapshot</span>}
            </div>
            {minhCommandCenterRefreshError && <div role="alert" aria-label="Không thể làm mới Command Center" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={16} /> {minhCommandCenterRefreshError}
            </div>}
            {minhCommandCenter
              ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MinhCommandCenterPanelCard title="Brain health" panel={minhCommandCenter.brainHealth as MinhCommandCenterPanel<unknown>}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Delegation 7 ngày</span><b className="block text-lg text-slate-900">{minhCommandCenter.brainHealth.data?.delegations7d ?? '—'}</b></div>
                  <div><span className="text-slate-500">Thành công</span><b className="block text-lg text-emerald-700">{minhCommandCenter.brainHealth.data?.delegationSuccess7d ?? '—'}</b></div>
                  <div><span className="text-slate-500">Capability gap</span><b className="block text-lg text-amber-700">{minhCommandCenter.brainHealth.data?.capabilityGaps7d ?? '—'}</b></div>
                  <div><span className="text-slate-500">Lỗi 24 giờ</span><b className="block text-lg text-rose-700">{minhCommandCenter.brainHealth.data?.errors24h ?? '—'}</b></div>
                </div>
              </MinhCommandCenterPanelCard>
              <MinhCommandCenterPanelCard title="Opportunity queue" panel={minhCommandCenter.opportunityQueue as MinhCommandCenterPanel<unknown>}>
                <div className="text-sm font-semibold text-slate-900">{minhCommandCenter.opportunityQueue.data?.length ?? '—'} cơ hội</div>
                <p className="mt-1 text-[11px] text-slate-500">Chỉ đọc; hành động vẫn phải qua approval.</p>
              </MinhCommandCenterPanelCard>
              <MinhCommandCenterPanelCard title="Approval queue" panel={minhCommandCenter.approvalQueue as MinhCommandCenterPanel<unknown>}>
                <div className="text-sm font-semibold text-slate-900">{minhCommandCenter.approvalQueue.data?.filter(item => item.status === 'PENDING').length ?? '—'} đang chờ duyệt</div>
                <p className="mt-1 text-[11px] text-slate-500">Risk cao yêu cầu SUPER_ADMIN.</p>
                {minhCommandCenter.approvalQueue.data?.slice(0, 2).map(item => <div key={item.id} className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{item.actionType || 'Unknown'} · {item.risk}</div>)}
              </MinhCommandCenterPanelCard>
              <MinhCommandCenterPanelCard title="Learning status" panel={minhCommandCenter.learningStatus as MinhCommandCenterPanel<unknown>}>
                <div className="space-y-1 text-xs text-slate-600">
                  <div>Gate: <b className="text-slate-900">{minhCommandCenter.learningStatus.data?.gateStatus || 'Chưa có'}</b></div>
                  <div>Candidate: <b className="text-slate-900">{minhCommandCenter.learningStatus.data?.candidate?.status || 'Chưa có'}</b></div>
                  <div>Canary: <b className="text-slate-900">{minhCommandCenter.learningStatus.data?.canary?.agentKey || 'Không có'}</b></div>
                  {minhCommandCenter.learningStatus.data?.regression && <div className="text-rose-700">Regression: {minhCommandCenter.learningStatus.data.regression.failures.length}</div>}
                </div>
              </MinhCommandCenterPanelCard>
              <MinhCommandCenterPanelCard title="Scheduler / repair" panel={minhCommandCenter.schedulerRepair as MinhCommandCenterPanel<unknown>}>
                <div className="space-y-1 text-xs text-slate-600">
                  <div>Scheduler: <b className="text-slate-900">{minhCommandCenter.schedulerRepair.data?.timer.lastStatus || '—'}</b></div>
                  <div>Dead-letter: <b className="text-rose-700">{minhCommandCenter.schedulerRepair.data?.deadLetterCount ?? '—'}</b></div>
                  <div>Lease cũ: <b className="text-amber-700">{minhCommandCenter.schedulerRepair.data?.staleLeaseCount ?? '—'}</b></div>
                  <div>Repair spike 7 ngày: <b className="text-slate-900">{minhCommandCenter.schedulerRepair.data?.repairSpikeCount7d ?? '—'}</b></div>
                </div>
              </MinhCommandCenterPanelCard>
              </div>
              : <div role="status" className="rounded-lg border border-dashed border-rose-200 bg-white p-4 text-sm text-rose-700">
                Command Center hiện không khả dụng vì chưa tải được dữ liệu.
              </div>}
          </section>}
         {minhBrainOverview && <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm" aria-labelledby="minh-opportunities-title">
           <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
             <div className="flex items-start gap-2">
               <Lightbulb size={19} className="mt-0.5 text-amber-600" />
               <div>
                 <h2 id="minh-opportunities-title" className="font-semibold text-slate-900">Cơ hội proactive của Minh</h2>
                  <p className="text-xs text-slate-600">Minh phát hiện cơ hội và tạo đề xuất chờ duyệt; chưa gửi provider hoặc sửa dữ liệu khi chưa có approval.</p>
               </div>
             </div>
             <div className="flex flex-wrap items-center gap-2 text-xs">
               <span className={`rounded-full px-2.5 py-1 font-semibold ${minhBrainOverview.scheduler.detectorSummary.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                 Detector: {minhBrainOverview.scheduler.detectorSummary.enabled ? 'đang quan sát' : 'tắt'}
               </span>
               <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">
                 Tìm thấy: {minhBrainOverview.scheduler.detectorSummary.opportunitiesFound}
               </span>
               {minhBrainOverview.scheduler.detectorSummary.degradedRuns > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-700">
                 Degraded: {minhBrainOverview.scheduler.detectorSummary.degradedRuns}
               </span>}
                {minhBrainOverview.proactiveBudget && <span className={`rounded-full px-2.5 py-1 font-semibold ${minhBrainOverview.proactiveBudget.exceeded ? 'bg-rose-100 text-rose-700' : 'bg-white text-slate-600'}`}>
                  Budget: {minhBrainOverview.proactiveBudget.used}/{minhBrainOverview.proactiveBudget.budget}
                </span>}
                {minhBrainOverview.proactiveRollout && <span className={`rounded-full px-2.5 py-1 font-semibold ${minhBrainOverview.proactiveRollout.rollout === 'SHADOW' || !minhBrainOverview.proactiveRollout.active ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'}`}>
                  Rollout: {minhBrainOverview.proactiveRollout.active ? minhBrainOverview.proactiveRollout.rollout : 'paused'}
                </span>}
             </div>
           </div>
           {minhBrainOverview.scheduler.detectorSummary.detectorStatus.length > 0 && <div className="mb-3 flex flex-wrap gap-2">
             {minhBrainOverview.scheduler.detectorSummary.detectorStatus.map(detector => <span key={detector.detector} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${detector.status === 'DEGRADED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
               {detector.detector}: {detector.status === 'DEGRADED' ? 'degraded' : 'observed'} · {detector.found} cơ hội
             </span>)}
           </div>}
           {minhBrainOverview.routing.registryErrors.length > 0 && <div role="status" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">Registry agent chưa hợp lệ; cơ hội chỉ được hiển thị để kiểm tra, không được phép hành động.</div>}
           {minhBrainOverview.opportunities.length === 0
             ? <div className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-6 text-center text-sm text-slate-500">Chưa có cơ hội nào trong lần quan sát gần nhất.</div>
             : <div className="space-y-2">{minhBrainOverview.opportunities.map(opportunity => (
               <div key={opportunity.id} className="rounded-lg border border-amber-100 bg-white p-3">
                 <div className="flex flex-wrap items-start justify-between gap-3">
                   <div className="min-w-0">
                     <div className="flex flex-wrap items-center gap-2">
                       <b className="text-sm text-slate-900">{opportunity.title}</b>
                       <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{opportunity.kind}</span>
                       <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">READ-only</span>
                     </div>
                     <p className="mt-1 text-xs text-slate-500">{opportunity.subjectType}: {opportunity.subjectId} · {new Date(opportunity.createdAt).toLocaleString('vi-VN')}</p>
                   </div>
                   <div className="flex shrink-0 gap-2 text-[11px] text-slate-600">
                     <span>Ưu tiên <b className="text-slate-900">{opportunity.priority}</b></span>
                     <span>Tin cậy <b className="text-slate-900">{Math.round(opportunity.confidence * 100)}%</b></span>
                   </div>
                 </div>
                 <p className="mt-2 text-sm text-slate-700">{opportunity.rationale}</p>
                 <p className="mt-1 text-xs text-slate-500">Bước tiếp theo: {opportunity.suggestedNextStep}</p>
                 <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(opportunity.evidence || {}).filter(([key]) => key !== 'detector').slice(0, 6).map(([key, value]) => <span key={key} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{key}: <b>{String(value)}</b></span>)}</div>
                  {opportunity.approval && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                    <span className="text-slate-500">Đề xuất: <b className="text-slate-700">{opportunity.approval.actionType}</b> · {opportunity.approval.status}</span>
                  </div>}
                    <div className="mt-3 rounded-lg bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700">Lịch sử xuất snapshot</h4>
                          <p className="mt-1 text-[11px] text-slate-500">Chỉ lưu người xuất, khoảng thời gian, trạng thái và thời điểm; không lưu nội dung snapshot.</p>
                        </div>
                        {minhLearningExportHistory?.degraded && <span role="status" className="text-[11px] text-amber-700">{minhLearningExportHistory.warning || 'Lịch sử tạm thời chưa khả dụng.'}</span>}
                      </div>
                      {!minhLearningExportHistory
                        ? <div role="status" className="mt-3 text-xs text-slate-500">Lịch sử snapshot chưa khả dụng; hãy thử làm mới.</div>
                        : minhLearningExportHistory.exports.length === 0
                          ? <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">Chưa có lần xuất snapshot nào.</div>
                          : <div className="mt-3 space-y-2">
                            {minhLearningExportHistory.exports.map((entry, index) => (
                              <div key={`${entry.createdAt}-${entry.operatorId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 text-xs">
                                <div className="text-slate-600">
                                  <span className="font-semibold text-slate-800">{entry.windowDays} ngày</span>
                                  <span className="mx-1.5 text-slate-300">·</span>
                                  <span>{new Date(entry.createdAt).toLocaleString('vi-VN')}</span>
                                  <span className="mx-1.5 text-slate-300">·</span>
                                  <span title={entry.operatorId}>Người xuất: {entry.operatorId.slice(0, 8)}</span>
                                </div>
                                <span className={`rounded-full px-2 py-1 font-semibold ${entry.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {entry.status === 'SUCCESS' ? 'Đã xuất' : 'Thất bại'}
                                </span>
                              </div>
                            ))}
                            {minhLearningExportHistory.hasMore && <button
                              type="button"
                              onClick={async () => {
                                const next = await api.get<MinhLearningExportHistoryResponse>(`/api/internal/minh-brain/learning/trends/exports?limit=${minhLearningExportHistory.limit}&offset=${minhLearningExportHistory.nextOffset || 0}`);
                                setMinhLearningExportHistory(current => current ? { ...next, exports: [...current.exports, ...next.exports] } : next);
                              }}
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >Xem thêm lịch sử</button>}
                          </div>}
                    </div>
               </div>
             ))}</div>}
            <div className="mt-4 border-t border-amber-100 pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Decision Queue</h3>
                  <p className="text-xs text-slate-500">Mọi đề xuất proactive phải qua approval; approve chỉ tạo draft/review nội bộ, không gọi provider.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{minhBrainOverview.decisionQueue?.length || 0} pending</span>
              </div>
              {(minhBrainOverview.decisionQueue?.length || 0) === 0
                ? <div className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-4 text-center text-xs text-slate-500">Không có đề xuất đang chờ duyệt.</div>
                : <div className="space-y-2">{minhBrainOverview.decisionQueue?.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <b className="text-xs text-slate-900">{request.actionType}</b>
                    <p className="mt-1 text-xs text-slate-500">{request.reasoning || `${request.subjectType || 'subject'}: ${request.subjectId || 'n/a'}`}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => void reviewMinhDecision(request.id, 'reject')} disabled={minhDecisionBusy === request.id} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">Từ chối</button>
                    <button onClick={() => void reviewMinhDecision(request.id, 'approve')} disabled={minhDecisionBusy === request.id} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Duyệt</button>
                  </div>
                </div>)}</div>}
            </div>
            <div className="mt-4 border-t border-amber-100 pt-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Learning loop</h3>
                  <p className="text-xs text-slate-500">Chỉ lưu outcome phân loại; không hiển thị câu trả lời thô hoặc payload từ provider.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  Khoảng thời gian
                  <select
                    aria-label="Khoảng thời gian learning của Minh"
                    value={minhLearningDays}
                    onChange={event => setMinhLearningDays(Number(event.target.value))}
                    className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                  >
                    <option value={7}>7 ngày</option>
                    <option value={30}>30 ngày</option>
                    <option value={90}>90 ngày</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void exportMinhLearningSnapshot()}
                  disabled={minhLearningExporting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-50"
                  title="Xuất snapshot learning chỉ gồm số lượng phân loại theo ngày"
                >
                  <Download size={14} />
                  {minhLearningExporting ? 'Đang xuất…' : 'Xuất snapshot'}
                </button>
              </div>
              {!minhBrainOverview.learning
                ? <div role="status" className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-4 text-center text-xs text-amber-800">
                  {minhBrainOverview.degraded
                    ? (minhBrainOverview.warning || 'Learning loop đang degraded; dữ liệu tạm thời chưa khả dụng.')
                    : 'Learning loop chưa khả dụng; hãy thử làm mới.'}
                </div>
                : <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Trong {minhBrainOverview.learning.windowDays} ngày gần nhất</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{minhBrainOverview.learning.totals.total} events</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {[
                      ['Duyệt', minhBrainOverview.learning.totals.approved, 'text-emerald-700'],
                      ['Từ chối', minhBrainOverview.learning.totals.rejected, 'text-rose-700'],
                      ['Đã chạy', minhBrainOverview.learning.totals.executed, 'text-indigo-700'],
                      ['Lỗi', minhBrainOverview.learning.totals.execution_failed, 'text-amber-700'],
                      ['Đã trả lời', minhBrainOverview.learning.totals.answered, 'text-slate-700'],
                    ].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-white p-2.5"><div className="text-[11px] text-slate-500">{label}</div><b className={`text-lg ${color}`}>{value}</b></div>)}
                  </div>
                  {minhBrainOverview.learning.totals.total === 0
                    ? <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-white/70 p-4 text-center text-xs text-slate-500">Chưa có dữ liệu learning trong khoảng thời gian này.</div>
                    : <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg bg-white p-3">
                        <h4 className="text-xs font-semibold text-slate-700">Theo outcome</h4>
                        <div className="mt-2 space-y-1.5">
                          {(minhBrainOverview.learning.byOutcome || []).map(row => <div key={row.outcome} className="flex items-center justify-between text-xs"><span className="text-slate-500">{row.outcome}</span><b className="text-slate-800">{row.count}</b></div>)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <h4 className="text-xs font-semibold text-slate-700">Theo phản hồi phân loại</h4>
                        <div className="mt-2 space-y-1.5">
                          {(minhBrainOverview.learning.byCategory || []).map(row => <div key={row.category} className="flex items-center justify-between text-xs"><span className="text-slate-500">{row.category}</span><b className="text-slate-800">{row.count}</b></div>)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <h4 className="text-xs font-semibold text-slate-700">Theo action</h4>
                        <div className="mt-2 space-y-1.5">
                          {(minhBrainOverview.learning.byAction || []).map(row => <div key={`${row.action_type}-${row.outcome}`} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-500">{row.action_type} · {row.outcome}</span><b className="text-slate-800">{row.count}</b></div>)}
                        </div>
                      </div>
                    </div>}
                   <div className="mt-3 rounded-lg bg-white p-3">
                     <div className="flex flex-wrap items-start justify-between gap-3">
                       <div>
                         <h4 className="text-xs font-semibold text-slate-700">Xu hướng theo ngày</h4>
                         <p className="mt-1 text-[11px] text-slate-500">Mỗi cột là tổng outcome trong một ngày; dữ liệu chỉ là số lượng phân loại.</p>
                       </div>
                       {minhLearningTrend?.trend && minhLearningTrend.trend.points.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                         {[
                           ['Duyệt', 'bg-emerald-500'],
                           ['Từ chối', 'bg-rose-500'],
                           ['Đã chạy', 'bg-indigo-500'],
                           ['Lỗi', 'bg-amber-500'],
                           ['Trả lời', 'bg-slate-500'],
                         ].map(([label, color]) => <span key={label} className="inline-flex items-center gap-1"><i className={`h-2 w-2 rounded-sm ${color}`} />{label}</span>)}
                       </div>}
                     </div>
                     {minhLearningTrend?.degraded
                       ? <div role="status" className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/70 p-4 text-center text-xs text-amber-800">{minhLearningTrend.warning || 'Xu hướng learning đang degraded; dữ liệu tạm thời chưa khả dụng.'}</div>
                       : !minhLearningTrend?.trend
                         ? <div role="status" className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/70 p-4 text-center text-xs text-amber-800">Xu hướng learning chưa khả dụng; hãy thử làm mới.</div>
                         : minhLearningTrend.trend.empty
                           ? <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/70 p-4 text-center text-xs text-slate-500">Chưa có dữ liệu xu hướng trong khoảng thời gian này.</div>
                           : <div className="mt-3 overflow-x-auto pb-1">
                             <div className="min-w-[360px]">
                               <div className="flex h-20 items-end gap-1 border-b border-slate-100 px-1" aria-label="Biểu đồ xu hướng learning theo ngày">
                                 {(() => {
                                   const points = minhLearningTrend.trend.points;
                                   const maxTotal = Math.max(...points.map(point => point.total), 1);
                                   return points.map(point => {
                                     const segments: Array<[number, string]> = [
                                       [point.approved, 'bg-emerald-500'],
                                       [point.rejected, 'bg-rose-500'],
                                       [point.executed, 'bg-indigo-500'],
                                       [point.execution_failed, 'bg-amber-500'],
                                       [point.answered, 'bg-slate-500'],
                                     ];
                                     return <div key={point.date} className="flex min-w-[7px] flex-1 items-end justify-center" title={`${point.date}: ${point.total} events`}>
                                       <div className="flex w-full max-w-[18px] flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${Math.max(point.total ? 4 : 1, Math.round((point.total / maxTotal) * 72))}px` }} aria-label={`${point.date}: ${point.total} events`}>
                                         {segments.map(([count, color], index) => count > 0 && <div key={`${point.date}-${index}`} className={`min-h-[2px] ${color}`} style={{ flex: count }} />)}
                                       </div>
                                     </div>;
                                   });
                                 })()}
                               </div>
                               <div className="mt-1 flex justify-between px-1 text-[10px] text-slate-400">
                                 <span>{minhLearningTrend.trend.points[0]?.date}</span>
                                 <span>{minhLearningTrend.trend.points[minhLearningTrend.trend.points.length - 1]?.date}</span>
                               </div>
                             </div>
                           </div>}
                   </div>
                </>}
            </div>
         </section>}
        {zaloReadinessWarnings.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm" aria-labelledby="zalo-readiness-warning-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={19} className="text-amber-700" />
              <div>
                <h2 id="zalo-readiness-warning-title" className="font-semibold text-slate-900">Cảnh báo quyền broadcast Zalo</h2>
                <p className="text-xs text-slate-600">Theo dõi việc gửi cảnh báo readiness tới quản trị viên.</p>
              </div>
            </div>
            {zaloReadinessWarnings.some(warning => warning.retryState.status === 'PENDING') && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Cần chú ý</span>}
          </div>
          <div className="space-y-2">
            {zaloReadinessWarnings.slice(0, 8).map((warning, index) => {
              const state = warning.retryState.status;
              const stateLabel = state === 'PENDING' ? 'Đang chờ gửi lại' : state === 'DELIVERED' ? 'Đã gửi' : 'Đã hết lần thử';
              const stateClass = state === 'PENDING' ? 'bg-amber-100 text-amber-800' : state === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
              return <div key={`${warning.checkedAt}-${warning.reasonCode}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white p-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-800">{warning.reasonCode}</div>
                  <div className="mt-1 text-xs text-slate-500">Kiểm tra lúc {new Date(warning.checkedAt).toLocaleString('vi-VN')}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-1 font-semibold ${stateClass}`}>{stateLabel}</span>
                  <span className="text-slate-500">Lần thử: {warning.retryState.attemptCount}</span>
                </div>
              </div>;
            })}
          </div>
        </section>}
         <section className={`rounded-xl border p-5 shadow-sm ${autoPostingDiagnostic?.ok ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`} aria-labelledby="facebook-trigger-readiness-title">
           <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
             <div className="flex items-start gap-2">
               <ShieldCheck size={19} className={autoPostingDiagnostic?.ok ? 'text-emerald-700' : 'text-rose-700'} />
               <div>
                 <h2 id="facebook-trigger-readiness-title" className="font-semibold text-slate-900">Readiness trigger Facebook</h2>
                 <p className="text-xs text-slate-600">Kiểm tra chỉ đọc endpoint, cron secret và QStash; không chạy cron hoặc tạo publication.</p>
               </div>
             </div>
             {autoPostingDiagnostic && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${autoPostingDiagnostic.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
               {autoPostingDiagnostic.ok ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
             </span>}
           </div>
           {autoPostingDiagnosticError ? <div role="alert" className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">{autoPostingDiagnosticError}</div> : autoPostingDiagnostic ? <>
             <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
               <span>Mã tổng: <code className="font-semibold text-slate-800">{autoPostingDiagnostic.code}</code></span>
               <span>Kiểm tra lúc: <time dateTime={autoPostingDiagnostic.checkedAt}>{autoPostingDiagnostic.checkedAt}</time></span>
             </div>
             <div className="grid gap-3 md:grid-cols-3">
               {[
                 { key: 'endpoint', label: 'Endpoint production', component: autoPostingDiagnostic.endpoint },
                 { key: 'cronSecret', label: 'Cron secret', component: autoPostingDiagnostic.cronSecret },
                 { key: 'qstash', label: 'QStash', component: autoPostingDiagnostic.qstash },
               ].map(({ key, label, component }) => (
                 <div key={key} className="rounded-lg border border-white/80 bg-white p-3">
                   <div className="flex items-center justify-between gap-2">
                     <b className="text-sm text-slate-800">{label}</b>
                     {component.ready
                       ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Sẵn sàng" />
                       : <XCircle size={16} className="text-rose-600" aria-label="Chưa sẵn sàng" />}
                   </div>
                   <div className={`mt-2 break-words font-mono text-xs font-semibold ${component.ready ? 'text-emerald-700' : 'text-rose-700'}`}>{component.code}</div>
                   <p className="mt-1 text-xs leading-5 text-slate-600">{component.message}</p>
                   {key === 'endpoint' && <div className="mt-2 text-[11px] text-slate-500">Đường dẫn: <code>{(component as AutoPostingDiagnostic['endpoint']).path}</code> · header: <code>{(component as AutoPostingDiagnostic['endpoint']).auth}</code></div>}
                   {key === 'cronSecret' && <div className="mt-2 text-[11px] text-slate-500">Trạng thái cấu hình: {(component as AutoPostingDiagnostic['cronSecret']).configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</div>}
                   {key === 'qstash' && <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                     <div>Host: {(component as AutoPostingDiagnostic['qstash']).endpoint || '—'} · lịch: {(component as AutoPostingDiagnostic['qstash']).schedule.id}</div>
                     <div>Cron: <code>{(component as AutoPostingDiagnostic['qstash']).schedule.cron || '—'}</code></div>
                   </div>}
                 </div>
               ))}
             </div>
           </> : <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">Chưa có kết quả readiness.</div>}
         </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
             <div className="flex items-center gap-2"><Filter size={19} className="text-rose-600" /><div><h2 className="font-semibold text-slate-900">Sự kiện cần vận hành</h2><p className="text-xs text-slate-500">Sự kiện treo phiên xử lý hoặc lỗi nhiều lần được đưa lên đầu.</p></div></div>
            <button onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} /> Làm mới</button>
          </div>
           <PanelWarning summary={summary} panel="events" />
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
             <Dropdown label="Mức độ ưu tiên" value={eventFilters.urgency} onChange={value => eventFilter('urgency', String(value))} options={[{ value: 'ALL', label: 'Mọi mức độ' }, { value: 'HIGH', label: 'Cao (≥75)' }, { value: 'NORMAL', label: 'Vừa (40–74)' }, { value: 'LOW', label: 'Thấp (<40)' }]} variant="compact" />
             <Dropdown label="Phiên xử lý" value={eventFilters.lease} onChange={value => eventFilter('lease', String(value))} options={[{ value: 'ALL', label: 'Mọi phiên' }, { value: 'EXPIRED', label: 'Đã hết hạn' }, { value: 'ACTIVE', label: 'Đang giữ phiên' }, { value: 'NONE', label: 'Không có phiên' }]} variant="compact" />
             <Dropdown label="Sự kiện lỗi" value={eventFilters.deadLetter} onChange={value => eventFilter('deadLetter', String(value))} options={[{ value: 'ALL', label: 'Tất cả sự kiện' }, { value: 'YES', label: 'Chỉ sự kiện lỗi' }, { value: 'NO', label: 'Không có sự kiện lỗi' }]} variant="compact" />
          </div>
            {events.length === 0 && cockpitPanelAvailable(summary, 'events') ? <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Không có sự kiện phù hợp bộ lọc.</div> : events.length > 0 ? <div className="space-y-2">{events.map(event => {
            const attention = event.status === 'DEAD_LETTER' || event.lease_expired;
            return <div key={event.id} className={`rounded-lg border p-4 ${event.status === 'DEAD_LETTER' ? 'border-rose-200 bg-rose-50/40' : event.lease_expired ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
               <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{event.event_type}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.status === 'DEAD_LETTER' ? 'bg-rose-100 text-rose-800' : event.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{eventStatusLabel[event.status] || event.status}</span><span className="text-xs text-slate-500">Mức độ {event.urgency}</span></div><p className="mt-1 text-xs text-slate-500">Mã {event.event_id} · {new Date(event.created_at).toLocaleString('vi-VN')}</p></div>{(event.status === 'FAILED' || event.status === 'DEAD_LETTER') && <button onClick={() => void replayEvent(event)} disabled={replaying === event.id} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><PlayCircle size={14} /> {replaying === event.id ? 'Đang chạy lại…' : 'Chạy lại có kiểm soát'}</button>}</div>
               <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><span><b>Số lần thử:</b> {event.attempts}</span><span><b>Phiên:</b> {event.lease_expires_at ? `${event.lease_expired ? 'Đã hết hạn' : 'Hết hạn'} ${new Date(event.lease_expires_at).toLocaleString('vi-VN')}` : 'Không có'}</span><span><b>Mã chống trùng:</b> <code className="break-all">{event.idempotency_key}</code></span></div>
              {(attention || event.last_error) && <div className="mt-3 rounded-md bg-white/80 px-3 py-2 text-xs"><b>{event.last_error ? 'Lỗi cuối: ' : ''}</b>{event.last_error || (event.lease_expired ? 'Worker không hoàn tất trước khi lease hết hạn.' : '')}</div>}
               {event.replay_history?.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><div className="mb-2 text-xs font-semibold text-slate-700">Lịch sử chạy lại</div><div className="space-y-1.5">{event.replay_history.map(replay => <div key={replay.id} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="flex flex-wrap justify-between gap-2"><span><b>Lần {replay.replay_number}</b> · {eventStatusLabel[replay.result_status] || replay.result_status} · người vận hành {replay.operator_id}</span><span>{new Date(replay.requested_at).toLocaleString('vi-VN')}</span></div><div className="mt-1">{replay.reason}</div>{replay.result_error && <div className="mt-1 text-rose-700">Kết quả lỗi: {replay.result_error}</div>}</div>)}</div></div>}
            </div>;
           })}</div> : null}
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
           <PanelWarning summary={summary} panel="roleCards" />
           <PanelWarning summary={summary} panel="rollouts" />
          <div className="grid gap-3 md:grid-cols-3">{summary.roleCards.map(card => {
            const rollout = summary.rollouts.find(item => item.agent_key === card.agentKey);
             const roleCardsAvailable = cockpitPanelAvailable(summary, 'roleCards');
             const rolloutsAvailable = cockpitPanelAvailable(summary, 'rollouts');
            return <div key={card.agentKey} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
               <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{card.title}</h3><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{rolloutsAvailable ? rollout?.status || card.rollout : 'Chưa tải'}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{card.mission}</p>
              <div className="mt-3 text-[11px] text-slate-500">KPI: {card.kpis.join(' · ')}</div>
               {rolloutsAvailable && rollout?.shadow_enabled && <div className="mt-2 text-[11px] font-medium text-amber-700">Chế độ quan sát · không tác động hệ thống thật</div>}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                 <span className={`text-[11px] font-semibold ${!roleCardsAvailable ? 'text-amber-700' : card.approval_status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>{!roleCardsAvailable ? 'Chưa tải' : card.approval_status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}</span>
                 <button onClick={() => void approveCard(card.agentKey, card.approval_status !== 'APPROVED')} disabled={!roleCardsAvailable || approving === card.agentKey} className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-50">{!roleCardsAvailable ? 'Không khả dụng' : approving === card.agentKey ? 'Đang cập nhật…' : card.approval_status === 'APPROVED' ? 'Thu hồi phê duyệt' : 'Thực hiện phê duyệt thẻ vai trò'}</button>
              </div>
            </div>;
          })}</div>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><BarChart3 size={19} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">KPI tuần</h2></div>
             <PanelWarning summary={summary} panel="weeklyKpi" />
             {summary.weeklyKpi.length === 0 && cockpitPanelAvailable(summary, 'weeklyKpi') ? <p className="text-sm text-slate-500">Chưa có snapshot KPI.</p> : summary.weeklyKpi.length > 0 ? <div className="space-y-2">{summary.weeklyKpi.map((kpi, i) => <div key={`${kpi.agent_key}-${kpi.period_start}-${i}`} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs font-semibold text-slate-700"><span>{kpi.agent_key}</span><span>{kpi.period_start} → {kpi.period_end}</span></div><div className="mt-2 flex flex-wrap gap-2">{Object.entries(kpi.metrics_json || {}).map(([key, value]) => <span key={key} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">{key}: <b>{String(value)}</b></span>)}</div></div>)}</div> : null}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><ClipboardCheck size={19} className="text-emerald-600" /><h2 className="font-semibold text-slate-900">Báo cáo ca hằng ngày</h2></div>
             <PanelWarning summary={summary} panel="shiftReports" />
             {summary.shiftReports.length === 0 && cockpitPanelAvailable(summary, 'shiftReports') ? <p className="text-sm text-slate-500">Chưa có báo cáo ca.</p> : summary.shiftReports.length > 0 ? <div className="space-y-2">{summary.shiftReports.slice(0, 7).map(report => <div key={report.id} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between text-xs"><b>{report.report_date} · {report.shift}</b>{report.reviewed ? <span className="text-emerald-700">Đã duyệt</span> : <button onClick={() => void reviewShift(report.id)} className="font-semibold text-indigo-700">Duyệt</button>}</div><p className="mt-2 text-sm text-slate-700">{report.summary || 'Không có ghi chú.'}</p></div>)}</div> : null}
          </section>
        </div>
         <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><RotateCcw size={18} className="text-rose-700" /><h2 className="font-semibold text-slate-900">Audit rollback</h2></div><PanelWarning summary={summary} panel="rollbackAudits" />{summary.rollbackAudits.length === 0 && cockpitPanelAvailable(summary, 'rollbackAudits') ? <p className="text-sm text-slate-500">Chưa có rollback.</p> : summary.rollbackAudits.length > 0 ? <div className="space-y-2">{summary.rollbackAudits.slice(0, 8).map((audit, i) => <div key={`${audit.created_at}-${i}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span><b>{audit.entity_id}</b> · {audit.from_status} → ROLLED_BACK</span><span className="text-xs text-slate-500">{audit.reason} · {new Date(audit.created_at).toLocaleString('vi-VN')}</span></div>)}</div> : null}</section>
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
           <div className="mb-4 flex items-center gap-2"><Clock3 size={19} className="text-amber-700" /><h2 className="font-semibold text-slate-900">Hàng đợi cần nhân viên xử lý</h2><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{cockpitPanelAvailable(summary, 'questions') ? questions.length : '—'}</span></div>
           <PanelWarning summary={summary} panel="questions" />
           {questions.length === 0 && cockpitPanelAvailable(summary, 'questions') ? <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-600" /> Không có câu hỏi đang chờ.</div> : questions.length > 0 ? <div className="space-y-3">{questions.map(question => <div key={question.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-indigo-700">{question.agent_key}</span><span className="text-xs text-slate-500">Ưu tiên {question.priority}</span></div>
            <p className="mt-2 text-sm text-slate-800">{question.question}</p>
            <div className="mt-3 flex flex-wrap gap-2"><input value={answering === question.id ? answer : ''} onChange={event => { setAnswering(question.id); setAnswer(event.target.value); }} placeholder="Trả lời để agent tiếp tục…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" /><button onClick={() => void submitAnswer(question.id)} disabled={answering === question.id && !answer.trim()} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> Trả lời</button></div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={approveMemory} onChange={event => setApproveMemory(event.target.checked)} /> Cho phép đưa câu trả lời vào memory</label>
           </div>)}</div> : null}
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
         <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><XCircle size={18} className="text-slate-500" /><h2 className="font-semibold text-slate-900">Audit gần đây</h2></div><PanelWarning summary={summary} panel="audit" />{summary.recentAudit.length > 0 ? <div className="divide-y divide-slate-100">{summary.recentAudit.slice(0, 8).map((event, index) => <div key={`${event.created_at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{event.event_type}</span><span className="text-xs text-slate-500">{event.status} · {new Date(event.created_at).toLocaleString('vi-VN')}</span></div>)}</div> : cockpitPanelAvailable(summary, 'audit') ? <p className="text-sm text-slate-500">Chưa có audit gần đây.</p> : null}</section>
      </>}
    </div>
  );
}