import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/dbApi';
import { LeadStage, LEAD_SOURCES } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AudienceFilter {
  source?: 'leads' | 'users';
  lead_stages?: string[];
  lead_sources?: string[];
  inactive_days_min?: number;
  has_listings?: boolean;
  user_status?: string[];
}

interface AbTestConfig {
  enabled: boolean;
  variant_b_subject?: string;
  variant_b_body_html?: string;
  split_pct?: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  audience: AudienceFilter;
  subject: string | null;
  body_html?: string | null;
  schedule_type: 'NOW' | 'SCHEDULED';
  scheduled_at: string | null;
  ab_test: AbTestConfig;
  send_count: number;
  open_count: number;
  click_count: number;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-slate-100 text-slate-700 border-slate-200',
  ACTIVE:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  PAUSED:    'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'Bản nháp',
  ACTIVE:    'Đang chạy',
  PAUSED:    'Tạm dừng',
  COMPLETED: 'Hoàn thành',
};

const emptyCampaign = (): Partial<Campaign> => ({
  name: '',
  description: '',
  channel: 'EMAIL',
  audience: { source: 'leads', lead_stages: [], lead_sources: [] },
  subject: '',
  body_html: '<p>Chào {{name}},</p><p>Nội dung email...</p><p>Xem thêm: <a href="https://sgsland.vn">SGS Land</a></p>',
  schedule_type: 'NOW',
  scheduled_at: null,
  ab_test: { enabled: false, split_pct: 50 },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return s; }
};
const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—';

// ─── Page ───────────────────────────────────────────────────────────────────
export const Campaigns: React.FC = () => {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.getCampaigns();
      setItems(data);
    } catch (e: any) {
      setError(e.message || 'Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const showOk  = (msg: string) => setToast({ kind: 'ok',  msg });
  const showErr = (msg: string) => setToast({ kind: 'err', msg });

  const onActivate = async (c: Campaign) => {
    if (!confirm(`Kích hoạt chiến dịch "${c.name}"?\n\nNếu lịch là "Gửi ngay", email sẽ được gửi ngay lập tức cho toàn bộ audience.`)) return;
    setBusy(c.id);
    try {
      const r = await db.activateCampaign(c.id);
      const sent = r?.run?.sent ?? 0;
      const failed = r?.run?.failed ?? 0;
      const queued = r?.run?.queued ?? 0;
      if (queued > 0) {
        showOk(`Đã gửi ${sent}/${queued} email${failed ? ` (${failed} lỗi)` : ''}`);
      } else {
        showOk('Chiến dịch đã được kích hoạt');
      }
      await load();
    } catch (e: any) { showErr(e.message); }
    finally { setBusy(null); }
  };

  const onPause = async (c: Campaign) => {
    setBusy(c.id);
    try { await db.pauseCampaign(c.id); showOk('Đã tạm dừng'); await load(); }
    catch (e: any) { showErr(e.message); }
    finally { setBusy(null); }
  };

  const onRunNow = async (c: Campaign) => {
    if (!confirm(`Gửi chiến dịch "${c.name}" ngay bây giờ?`)) return;
    setBusy(c.id);
    try {
      const r = await db.runCampaignNow(c.id);
      showOk(`Gửi xong: ${r.sent}/${r.queued}${r.failed ? ` (${r.failed} lỗi)` : ''}`);
      await load();
    } catch (e: any) { showErr(e.message); }
    finally { setBusy(null); }
  };

  const onDelete = async (c: Campaign) => {
    if (!confirm(`Xóa chiến dịch "${c.name}"? Hành động này không thể hoàn tác.`)) return;
    setBusy(c.id);
    try { await db.deleteCampaign(c.id); showOk('Đã xóa'); await load(); }
    catch (e: any) { showErr(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
          toast.kind === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Chiến dịch tự động</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Tạo, kích hoạt và theo dõi các chiến dịch email tự động gửi cho lead/user theo điều kiện.
          </p>
        </div>
        <button
          onClick={() => setEditing(emptyCampaign())}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 text-sm"
        >
          + Tạo chiến dịch
        </button>
      </div>

      {loading && <div className="py-12 text-center text-[var(--text-tertiary)]">Đang tải...</div>}
      {error && <div className="py-4 px-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="py-16 text-center bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)]">
          <p className="text-[var(--text-tertiary)] mb-4">Chưa có chiến dịch nào.</p>
          <button
            onClick={() => setEditing(emptyCampaign())}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 text-sm"
          >
            Tạo chiến dịch đầu tiên
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Tên chiến dịch</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-right px-4 py-3">Đã gửi</th>
                <th className="text-right px-4 py-3">Tỉ lệ mở</th>
                <th className="text-right px-4 py-3">Tỉ lệ click</th>
                <th className="text-left px-4 py-3">Chạy lần cuối</th>
                <th className="text-right px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} className="border-t border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--text-primary)]">{c.name}</div>
                    {c.description && <div className="text-xs text-[var(--text-tertiary)] truncate max-w-xs">{c.description}</div>}
                    {c.last_error && <div className="text-xs text-rose-600 mt-1">⚠ {c.last_error}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.send_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct(c.open_count, c.send_count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct(c.click_count, c.send_count)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{fmtDate(c.last_run_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {busy === c.id ? (
                      <span className="text-xs text-[var(--text-tertiary)]">Đang xử lý...</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        {c.status === 'DRAFT' && (
                          <button onClick={() => onActivate(c)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">Kích hoạt</button>
                        )}
                        {c.status === 'ACTIVE' && (
                          <>
                            <button onClick={() => onRunNow(c)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Chạy ngay</button>
                            <button onClick={() => onPause(c)} className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600">Tạm dừng</button>
                          </>
                        )}
                        {c.status === 'PAUSED' && (
                          <button onClick={() => onActivate(c)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">Tiếp tục</button>
                        )}
                        {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
                          <button onClick={() => setEditing(c)} className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300">Sửa</button>
                        )}
                        {c.status !== 'ACTIVE' && (
                          <button onClick={() => onDelete(c)} className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded">Xóa</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CampaignDrawer
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { showOk(msg); setEditing(null); load(); }}
          onError={showErr}
        />
      )}
    </div>
  );
};

export default Campaigns;

// ─── Drawer (create/edit) ───────────────────────────────────────────────────
interface DrawerProps {
  initial: Partial<Campaign>;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

const CampaignDrawer: React.FC<DrawerProps> = ({ initial, onClose, onSaved, onError }) => {
  const [form, setForm] = useState<Partial<Campaign>>(initial);
  const [audCount, setAudCount] = useState<number | null>(null);
  const [audLoading, setAudLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial.id;
  const audience = form.audience || {};
  const ab = form.ab_test || { enabled: false, split_pct: 50 };

  const upd = (patch: Partial<Campaign>) => setForm(p => ({ ...p, ...patch }));
  const updAudience = (patch: Partial<AudienceFilter>) =>
    upd({ audience: { ...audience, ...patch } });
  const updAb = (patch: Partial<AbTestConfig>) =>
    upd({ ab_test: { ...ab, ...patch } });

  // Live preview audience size
  useEffect(() => {
    let cancelled = false;
    setAudLoading(true);
    const t = setTimeout(async () => {
      try {
        const n = await db.previewCampaignAudience(audience);
        if (!cancelled) setAudCount(n);
      } catch { if (!cancelled) setAudCount(null); }
      finally { if (!cancelled) setAudLoading(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [JSON.stringify(audience)]);

  const toggleStage = (s: string) => {
    const cur = audience.lead_stages || [];
    updAudience({ lead_stages: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] });
  };
  const toggleSource = (s: string) => {
    const cur = audience.lead_sources || [];
    updAudience({ lead_sources: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] });
  };

  const save = async () => {
    if (!form.name?.trim()) return onError('Vui lòng nhập tên chiến dịch');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || '',
        channel: 'EMAIL',
        audience: form.audience || {},
        subject: form.subject || '',
        body_html: form.body_html || '',
        schedule_type: form.schedule_type || 'NOW',
        scheduled_at: form.scheduled_at || null,
        ab_test: form.ab_test || { enabled: false },
      };
      if (isEdit) {
        await db.updateCampaign(initial.id!, payload);
        onSaved('Đã lưu thay đổi');
      } else {
        await db.createCampaign(payload);
        onSaved('Đã tạo chiến dịch (DRAFT)');
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const stageOptions = Object.values(LeadStage);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-[var(--glass-border)] px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">{isEdit ? 'Sửa chiến dịch' : 'Tạo chiến dịch mới'}</h2>
          <button onClick={onClose} className="text-2xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">×</button>
        </div>

        <div className="p-6 space-y-6">

          {/* Cơ bản */}
          <Section title="Thông tin cơ bản">
            <Field label="Tên chiến dịch *">
              <input
                type="text"
                value={form.name || ''}
                onChange={e => upd({ name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="VD: Khuyến mãi tháng 4 cho lead QUALIFIED"
              />
            </Field>
            <Field label="Mô tả">
              <textarea
                value={form.description || ''}
                onChange={e => upd({ description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </Section>

          {/* Audience */}
          <Section title="Đối tượng nhận" subtitle="Chọn điều kiện lọc — số lượng cập nhật theo thời gian thực">
            <Field label="Nguồn dữ liệu">
              <div className="flex gap-2">
                {[['leads', 'Leads'], ['users', 'Users']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => updAudience({ source: v as 'leads' | 'users' })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      (audience.source || 'leads') === v
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>

            {(audience.source || 'leads') === 'leads' && (
              <>
                <Field label="Giai đoạn lead (chọn nhiều)">
                  <div className="flex flex-wrap gap-1.5">
                    {stageOptions.map(s => {
                      const on = (audience.lead_stages || []).includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleStage(s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Nguồn lead (chọn nhiều)">
                  <div className="flex flex-wrap gap-1.5">
                    {LEAD_SOURCES.map(s => {
                      const on = (audience.lead_sources || []).includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleSource(s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Lead không cập nhật trong (ngày)">
                  <input
                    type="number" min={0}
                    value={audience.inactive_days_min ?? ''}
                    onChange={e => updAudience({ inactive_days_min: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Để trống nếu không lọc"
                    className="w-32 px-3 py-2 border rounded-lg"
                  />
                </Field>
              </>
            )}

            {audience.source === 'users' && (
              <>
                <Field label="Trạng thái user">
                  <div className="flex gap-1.5">
                    {['ACTIVE', 'INACTIVE'].map(s => {
                      const on = (audience.user_status || ['ACTIVE']).includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            const cur = audience.user_status || ['ACTIVE'];
                            updAudience({ user_status: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] });
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Đã đăng tin?">
                  <div className="flex gap-1.5">
                    {[
                      { v: undefined, l: 'Bất kỳ' },
                      { v: true,      l: 'Có ≥ 1 tin' },
                      { v: false,     l: 'Chưa đăng tin nào' },
                    ].map((o, i) => (
                      <button
                        key={i}
                        onClick={() => updAudience({ has_listings: o.v as any })}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${audience.has_listings === o.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="User không đăng nhập trong (ngày)">
                  <input
                    type="number" min={0}
                    value={audience.inactive_days_min ?? ''}
                    onChange={e => updAudience({ inactive_days_min: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Để trống nếu không lọc"
                    className="w-32 px-3 py-2 border rounded-lg"
                  />
                </Field>
              </>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <div className="text-xs text-indigo-600 uppercase font-semibold">Số người sẽ nhận</div>
              <div className="text-2xl font-bold text-indigo-900 mt-1">
                {audLoading ? '...' : audCount ?? '—'}
                <span className="text-sm font-normal text-indigo-700 ml-2">người</span>
              </div>
            </div>
          </Section>

          {/* Nội dung */}
          <Section title="Nội dung email">
            <Field label="Tiêu đề email *">
              <input
                type="text"
                value={form.subject || ''}
                onChange={e => upd({ subject: e.target.value })}
                placeholder="VD: Ưu đãi đặc biệt dành riêng cho {{name}}"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </Field>
            <Field label="Nội dung HTML *" hint="Hỗ trợ biến: {{name}}. Link http(s) sẽ được tự động thay để track click.">
              <textarea
                value={form.body_html || ''}
                onChange={e => upd({ body_html: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
              />
            </Field>
          </Section>

          {/* Lịch */}
          <Section title="Lịch gửi">
            <div className="flex gap-2">
              {[['NOW', 'Gửi ngay khi kích hoạt'], ['SCHEDULED', 'Hẹn giờ']].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => upd({ schedule_type: v as any })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    (form.schedule_type || 'NOW') === v
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {form.schedule_type === 'SCHEDULED' && (
              <Field label="Thời điểm gửi">
                <input
                  type="datetime-local"
                  value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
                  onChange={e => upd({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-emerald-600 mt-1">
                  Hệ thống tự động chạy chiến dịch khi đến giờ hẹn (kiểm tra mỗi 5 phút). Bạn không cần thao tác thêm sau khi kích hoạt.
                </p>
              </Field>
            )}
          </Section>

          {/* A/B Test */}
          <Section title="A/B Test (tùy chọn)">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!ab.enabled}
                onChange={e => updAb({ enabled: e.target.checked })}
              />
              <span className="text-sm">Bật A/B test (chia ngẫu nhiên audience giữa 2 phiên bản)</span>
            </label>
            {ab.enabled && (
              <>
                <Field label={`Tỉ lệ phiên bản B: ${ab.split_pct || 50}%`}>
                  <input
                    type="range" min={5} max={95}
                    value={ab.split_pct || 50}
                    onChange={e => updAb({ split_pct: Number(e.target.value) })}
                    className="w-full"
                  />
                </Field>
                <Field label="Tiêu đề phiên bản B">
                  <input
                    type="text"
                    value={ab.variant_b_subject || ''}
                    onChange={e => updAb({ variant_b_subject: e.target.value })}
                    placeholder="Để trống = dùng tiêu đề chính"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </Field>
                <Field label="Nội dung HTML phiên bản B">
                  <textarea
                    value={ab.variant_b_body_html || ''}
                    onChange={e => updAb({ variant_b_body_html: e.target.value })}
                    rows={5}
                    placeholder="Để trống = dùng nội dung chính"
                    className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
                  />
                </Field>
              </>
            )}
          </Section>

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo chiến dịch')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="space-y-3">
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</h3>
      {subtitle && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</p>}
  </div>
);
