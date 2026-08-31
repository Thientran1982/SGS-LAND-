/**
 * AgentTasks — (c) Tong quan tac vu Agent: async tasks, automations, MCP servers.
 * Gop 3 endpoint: /api/admin/agent-tasks, /api/admin/automations, /api/admin/mcp-servers.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, ListTodo, Webhook, Plug, PlayCircle, Trash2 } from 'lucide-react';
import { api } from '../services/api/apiClient';
import { SeoHead } from '../components/SeoHead';

type Task = {
  id: string;
  source: string;
  title: string;
  trigger_source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_text: string | null;
};
type Automation = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  agent_name: string;
  trigger_kind: string;
  last_triggered_at: string | null;
  trigger_count: number;
};
type McpServer = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_status: string | null;
  last_checked_at: string | null;
};
type Skill = {
  id: string;
  skill_key: string;
  title: string;
  description: string | null;
  category: string;
  author_name: string | null;
  version: number;
  visibility: string;
  published: boolean;
  install_count: number;
  rating: number;
};
type Room = {
  id: string;
  name: string;
  slug: string;
  topic: string | null;
  is_open: boolean;
  member_count: number;
  message_count: number;
  last_activity_at: string;
};
type VoiceCall = {
  id: string;
  phone: string;
  direction: string;
  status: string;
  duration_sec: number | null;
  started_at: string;
  lead_name: string | null;
};
type TeachRecording = {
  id: string;
  title: string;
  scenario: string | null;
  status: string;
  derived_skill_id: string | null;
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-600',
};

export default function AgentTasks() {
  const [tab, setTab] = useState<'tasks' | 'automations' | 'mcp' | 'skills' | 'rooms' | 'voice' | 'teach'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [voiceCalls, setVoiceCalls] = useState<VoiceCall[]>([]);
  const [teachRecs, setTeachRecs] = useState<TeachRecording[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a, m, sk, rm, vc, tr] = await Promise.all([
        api.get<{ tasks: Task[]; statusCounts: Record<string, number> }>('/api/admin/agent-tasks?limit=50'),
        api.get<{ automations: Automation[] }>('/api/admin/automations'),
        api.get<{ servers: McpServer[] }>('/api/admin/mcp-servers'),
        api.get<{ skills: Skill[] }>('/api/admin/agent-skills').catch(() => ({ skills: [] })),
        api.get<{ rooms: Room[] }>('/api/admin/chat-rooms').catch(() => ({ rooms: [] })),
        api.get<{ calls: VoiceCall[] }>('/api/admin/agent-voice').catch(() => ({ calls: [] })),
        api.get<{ recordings: TeachRecording[] }>('/api/admin/agent-teach').catch(() => ({ recordings: [] })),
      ]);
      setTasks(t.tasks || []);
      setCounts(t.statusCounts || {});
      setAutomations(a.automations || []);
      setServers(m.servers || []);
      setSkills(sk.skills || []);
      setRooms(rm.rooms || []);
      setVoiceCalls(vc.calls || []);
      setTeachRecs(tr.recordings || []);
    } catch {
      // endpoint co the tra 403 neu khong phai SUPER_ADMIN — de trong
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tabsDef = [
    { key: 'tasks' as const, label: 'Tác vụ đang chạy', icon: <ListTodo size={16} /> },
    { key: 'automations' as const, label: 'Automations', icon: <Webhook size={16} /> },
    { key: 'mcp' as const, label: 'MCP Servers', icon: <Plug size={16} /> },
    { key: 'skills' as const, label: 'Skills', icon: <Bot size={16} /> },
    { key: 'rooms' as const, label: 'Phòng Chat', icon: <ListTodo size={16} /> },
    { key: 'voice' as const, label: 'Cuộc Gọi', icon: <Webhook size={16} /> },
    { key: 'teach' as const, label: 'Dạy Agent', icon: <Plug size={16} /> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
<SeoHead title="Tác vụ Agent — SGS LAND" description="Theo dõi tác vụ nền, automations và MCP servers của Agent Minh" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            <Bot size={16} /> Vận hành Agent
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tác vụ & Tự động hóa Agent</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi tác vụ nền, webhook automations và MCP servers mà Agent Minh có thể gọi.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="flex gap-2">
        {tabsDef.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ' + (tab === t.key
              ? 'bg-slate-900 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 text-xs">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className={'rounded-full px-2 py-0.5 font-medium ' + (STATUS_COLOR[k] || 'bg-slate-100 text-slate-600')}>
                {k}: {v}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Tác vụ</th>
                  <th className="px-4 py-2">Nguồn</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2">Bắt đầu</th>
                  <th className="px-4 py-2">Thời lượng</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{t.title}</td>
                    <td className="px-4 py-2.5 text-slate-500">{t.source === 'automation' ? 'Webhook' : t.trigger_source}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_COLOR[t.status] || 'bg-slate-100 text-slate-600')}>{t.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(t.started_at).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{t.duration_ms != null ? (t.duration_ms / 1000).toFixed(1) + 's' : '—'}</td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Không có tác vụ nào trong 7 ngày qua.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'automations' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Tên</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Đã kích hoạt</th>
                  <th className="px-4 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {automations.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{a.slug}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.agent_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.trigger_count} lần{a.last_triggered_at ? ' · ' + new Date(a.last_triggered_at).toLocaleString('vi-VN') : ''}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (a.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                        {a.enabled ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </td>
                  </tr>
                ))}
                {automations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có automation nào. Tạo qua POST /api/admin/automations.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mcp' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Server</th>
                  <th className="px-4 py-2">URL</th>
                  <th className="px-4 py-2">Trạng thái cuối</th>
                  <th className="px-4 py-2">Bật</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-slate-500">{s.url}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.last_status || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                        {s.enabled ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </td>
                  </tr>
                ))}
                {servers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa đăng ký MCP server nào. Agent Minh gọi tool ngoài qua tiền tố mcp_&lt;server&gt;_&lt;tool&gt;.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'skills' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Danh mục</th>
                  <th className="px-4 py-2">Phiên bản</th>
                  <th className="px-4 py-2">Cài đặt</th>
                  <th className="px-4 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{s.title}</div>
                      <div className="text-xs text-slate-400">{s.description}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{s.category}</td>
                    <td className="px-4 py-2.5 text-slate-500">v{s.version}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.install_count}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (s.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                        {s.published ? 'Đã xuất bản' : 'Nháp'}
                      </span>
                    </td>
                  </tr>
                ))}
                {skills.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có skill nào. 13 role mặc định sẽ tự sinh khi lần đầu mở API.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'rooms' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Phòng</th>
                  <th className="px-4 py-2">Thành viên</th>
                  <th className="px-4 py-2">Tin nhắn</th>
                  <th className="px-4 py-2">Hoạt động cuối</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{r.name}</div>
                      <div className="font-mono text-xs text-slate-400">{r.slug}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.member_count}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.message_count}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(r.last_activity_at).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có phòng chat nào. Tạo qua POST /api/admin/chat-rooms.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'voice' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Số điện thoại</th>
                  <th className="px-4 py-2">Khách hàng</th>
                  <th className="px-4 py-2">Chiều gọi</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2">Thời lượng</th>
                  <th className="px-4 py-2">Bắt đầu</th>
                </tr>
              </thead>
              <tbody>
                {voiceCalls.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.phone}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.lead_name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.direction === 'INBOUND' ? 'Gọi vào' : 'Gọi ra'}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (c.status === 'ENDED' ? 'bg-emerald-100 text-emerald-700' : c.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : c.status === 'FAILED' || c.status === 'MISSED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}>
                        {c.status === 'ENDED' ? 'Đã kết thúc' : c.status === 'ACTIVE' ? 'Đang gọi' : c.status === 'DIALING' ? 'Đang quay số' : c.status === 'FAILED' ? 'Lỗi' : 'Cuộc gọi nhỡ'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.duration_sec != null ? Math.floor(c.duration_sec / 60) + 'p' + (c.duration_sec % 60) + 's' : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(c.started_at).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
                {voiceCalls.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có cuộc gọi nào được ghi nhận.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'teach' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Bản ghi</th>
                  <th className="px-4 py-2">Tình huống</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {teachRecs.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{r.title}</div>
                      {r.derived_skill_id && <div className="text-xs text-emerald-600">Đã promote thành skill</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.scenario || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : r.status === 'EXTRACTED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                        {r.status === 'APPROVED' ? 'Đã duyệt' : r.status === 'EXTRACTED' ? 'Đã trích bước' : r.status === 'TRANSCRIBED' ? 'Có transcript' : 'Mới ghi'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(r.created_at).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
                {teachRecs.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có bản ghi nào. Tạo qua POST /api/admin/agent-teach với transcript quy trình bán hàng.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
