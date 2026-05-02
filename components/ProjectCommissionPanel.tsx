import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  commissionApi,
  type CommissionPolicy,
  type LedgerItem,
  type LedgerListResponse,
  type PolicyType,
  type ProjectCommissionSummary,
  type TierBand,
  type MilestoneStep,
  type PolicyConfig,
} from '../services/api/commissionApi';

interface Props {
  projectId: string;
  projectName: string;
  isAdmin: boolean;
  onClose: () => void;
}

function fmtMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ chốt', DUE: 'Đến hạn', PAID: 'Đã trả', CANCELLED: 'Huỷ',
};

export const ProjectCommissionPanel: React.FC<Props> = ({ projectId, projectName, isAdmin, onClose }) => {
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [summary, setSummary] = useState<ProjectCommissionSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const emptyLedger: LedgerListResponse = { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const [p, l] = await Promise.all([
        commissionApi.listPolicies(projectId).catch(() => ({ data: [] as CommissionPolicy[] })),
        commissionApi.list({ projectId, page: 1, pageSize: 50 }).catch(() => emptyLedger),
      ]);
      setPolicies(p.data || []);
      setLedger(l.data || []);
      if (isAdmin) {
        try { setSummary(await commissionApi.getProjectSummary(projectId)); } catch { setSummary(null); }
      }
    } catch (e: any) {
      setErr(e?.message || 'Không tải được dữ liệu hoa hồng');
    } finally {
      setLoading(false);
    }
  }, [projectId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const active = policies.find(p => !p.active_to);

  const handleCreate = async (type: PolicyType, config: PolicyConfig) => {
    try {
      setWorking(true);
      await commissionApi.createPolicy(projectId, { type, config });
      setShowEditor(false);
      load();
    } catch (e: any) {
      alert(e?.message || 'Không lưu được chính sách');
    } finally {
      setWorking(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Đóng chính sách hoa hồng đang hiệu lực? Các giao dịch SOLD sau thời điểm này sẽ không sinh hoa hồng cho tới khi tạo chính sách mới.')) return;
    try {
      setWorking(true);
      await commissionApi.closeActivePolicy(projectId);
      load();
    } catch (e: any) {
      alert(e?.message || 'Lỗi đóng chính sách');
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-6 overflow-y-auto"
         onClick={onClose}>
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[var(--glass-border)] my-4"
           onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--glass-border)] sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Hoa hồng &amp; doanh số</h2>
            <p className="text-xs text-[var(--text-tertiary)]">{projectName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        {err && <div className="m-4 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">{err}</div>}

        <section className="p-5 space-y-5">
          {/* Active policy */}
          <div className="rounded-xl border border-[var(--glass-border)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Chính sách hoa hồng đang áp dụng</h3>
              {isAdmin && (
                <div className="flex gap-2">
                  {active && (
                    <button type="button" onClick={handleClose} disabled={working}
                      className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50">
                      Đóng chính sách
                    </button>
                  )}
                  <button type="button" onClick={() => setShowEditor(s => !s)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
                    {showEditor ? 'Huỷ' : (active ? '+ Tạo phiên bản mới' : '+ Tạo chính sách')}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="text-sm text-[var(--text-tertiary)]">Đang tải…</div>
              ) : active ? (
                <PolicyView policy={active} />
              ) : (
                <div className="text-sm text-[var(--text-tertiary)]">Chưa có chính sách hoa hồng. {isAdmin ? 'Hãy tạo chính sách mới.' : 'Liên hệ quản trị viên.'}</div>
              )}
            </div>

            {isAdmin && showEditor && (
              <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                <PolicyEditor onSubmit={handleCreate} working={working} />
              </div>
            )}

            {policies.length > 1 && (
              <details className="mt-3">
                <summary className="text-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)]">
                  Lịch sử chính sách ({policies.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {policies.map(p => (
                    <li key={p.id} className="flex items-center gap-2">
                      <span className="font-mono">v{p.version}</span>
                      <span className="font-bold">{p.type}</span>
                      <span className="text-[var(--text-tertiary)]">
                        {fmtDate(p.active_from)} → {p.active_to ? fmtDate(p.active_to) : 'hiện tại'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Summary stats */}
          {isAdmin && summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Tổng giao dịch" value={String(summary.totalCount)} />
                <Stat label="Đang chờ chi" value={fmtMoney(summary.grossPending)} />
                <Stat label="Đã thanh toán" value={fmtMoney(summary.grossPaid)} />
                <Stat label="Trạng thái 'Đến hạn'" value={String(summary.due)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={`Sắp đến hạn (≤7 ngày) — ${summary.dueSoonCount} bút toán`} value={fmtMoney(summary.grossDueSoon)} />
                <Stat label={`Quá hạn — ${summary.overdueCount} bút toán`} value={fmtMoney(summary.grossOverdue)} />
              </div>
            </>
          )}

          {/* Leaderboard */}
          {isAdmin && summary && (summary.leaderboard.partners.length > 0 || summary.leaderboard.sales.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Leaderboard title="Top sàn đối tác" rows={summary.leaderboard.partners.map(r => ({ name: r.partner_name || 'Bán nội bộ', units: r.units, gross: r.gross }))} />
              <Leaderboard title="Top sale" rows={summary.leaderboard.sales.map(r => ({ name: r.sales_name || '—', units: r.units, gross: r.gross }))} />
            </div>
          )}

          {/* Ledger */}
          <div className="rounded-xl border border-[var(--glass-border)]">
            <div className="px-4 py-2 border-b border-[var(--glass-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold">Giao dịch hoa hồng (50 mới nhất)</h3>
              <a href={commissionApi.exportXlsxUrl({ projectId })}
                 className="text-xs font-bold text-emerald-700 hover:underline">⬇ Xuất Excel</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-[var(--text-tertiary)]">
                  <tr>
                    <th className="text-left px-3 py-2">Ngày</th>
                    <th className="text-left px-3 py-2">SP</th>
                    <th className="text-left px-3 py-2">Sale / Đối tác</th>
                    <th className="text-right px-3 py-2">Giá bán</th>
                    <th className="text-right px-3 py-2">Hoa hồng</th>
                    <th className="text-left px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-6 text-[var(--text-tertiary)]">Đang tải…</td></tr>
                  ) : ledger.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-[var(--text-tertiary)]">Chưa có giao dịch nào.</td></tr>
                  ) : ledger.map(it => (
                    <tr key={it.id} className="border-t border-[var(--glass-border)]">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(it.sale_date)}</td>
                      <td className="px-3 py-2">{it.listing_code || it.listing_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <div>{it.sales_user_name || '—'}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{it.partner_tenant_name || 'Bán nội bộ'}</div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(it.sale_price)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-emerald-700">{fmtMoney(it.gross_amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{STATUS_LABEL[it.status] || it.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)]">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="text-base font-extrabold text-[var(--text-primary)] mt-1">{value}</div>
  </div>
);

const Leaderboard: React.FC<{ title: string; rows: Array<{ name: string; units: number; gross: string | number }> }> = ({ title, rows }) => (
  <div className="rounded-xl border border-[var(--glass-border)] p-3">
    <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-2">{title}</h4>
    {rows.length === 0 ? (
      <div className="text-xs text-[var(--text-tertiary)]">Chưa có dữ liệu</div>
    ) : (
      <ul className="space-y-1">
        {rows.slice(0, 5).map((r, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="truncate">{i + 1}. {r.name}</span>
            <span className="text-xs text-[var(--text-tertiary)]">{r.units} đv · <span className="font-bold text-emerald-700">{fmtMoney(r.gross)}</span></span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const PolicyView: React.FC<{ policy: CommissionPolicy }> = ({ policy }) => {
  const cfg: any = policy.config;
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          v{policy.version} · {policy.type}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">Hiệu lực từ {fmtDate(policy.active_from)}</span>
      </div>
      {policy.type === 'FLAT' && <div>Tỷ lệ cố định: <span className="font-bold">{cfg.ratePct}%</span> trên giá bán.</div>}
      {policy.type === 'TIERED' && (
        <div>
          <div className="text-xs text-[var(--text-tertiary)] mb-1">Bậc theo số sản phẩm bán/tháng:</div>
          <ul className="text-sm space-y-0.5">
            {(cfg.tiers || []).map((t: TierBand, i: number) => (
              <li key={i}>≥ <span className="font-bold">{t.minUnitsThisMonth}</span> sản phẩm: <span className="font-bold text-emerald-700">{t.ratePct}%</span></li>
            ))}
          </ul>
        </div>
      )}
      {policy.type === 'MILESTONE' && (
        <div>
          <div>Tỷ lệ cơ sở: <span className="font-bold">{cfg.ratePct}%</span></div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">Mốc chi:</div>
          <ul className="text-sm space-y-0.5">
            {(cfg.milestones || []).map((m: MilestoneStep, i: number) => (
              <li key={i}>{m.label}: <span className="font-bold">{m.pct}%</span> sau <span className="font-mono">{m.offsetDays}</span> ngày</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const PolicyEditor: React.FC<{ onSubmit: (type: PolicyType, config: PolicyConfig) => void; working: boolean }> = ({ onSubmit, working }) => {
  const [type, setType] = useState<PolicyType>('FLAT');
  const [flatRate, setFlatRate] = useState('2.0');
  const [tiers, setTiers] = useState<TierBand[]>([
    { minUnitsThisMonth: 0, ratePct: 1.5 },
    { minUnitsThisMonth: 5, ratePct: 2.0 },
    { minUnitsThisMonth: 10, ratePct: 2.5 },
  ]);
  const [msRate, setMsRate] = useState('3.0');
  const [milestones, setMilestones] = useState<MilestoneStep[]>([
    { key: 'booking', label: 'Đặt cọc', pct: 30, offsetDays: 0 },
    { key: 'contract', label: 'Ký HĐMB', pct: 40, offsetDays: 30 },
    { key: 'handover', label: 'Bàn giao', pct: 30, offsetDays: 90 },
  ]);

  const submit = () => {
    if (type === 'FLAT') {
      const r = Number(flatRate);
      if (!(r > 0 && r <= 100)) return alert('Tỷ lệ phải > 0 và ≤ 100');
      onSubmit('FLAT', { ratePct: r });
    } else if (type === 'TIERED') {
      const sorted = [...tiers].sort((a, b) => a.minUnitsThisMonth - b.minUnitsThisMonth);
      if (sorted.some(t => !(t.ratePct > 0))) return alert('Tỷ lệ mỗi bậc phải > 0');
      onSubmit('TIERED', { tiers: sorted });
    } else {
      const r = Number(msRate);
      if (!(r > 0 && r <= 100)) return alert('Tỷ lệ phải > 0 và ≤ 100');
      const sum = milestones.reduce((s, m) => s + Number(m.pct || 0), 0);
      if (Math.abs(sum - 100) > 0.01) return alert(`Tổng % các mốc phải = 100 (hiện tại: ${sum})`);
      onSubmit('MILESTONE', { ratePct: r, milestones });
    }
  };

  return (
    <div className="text-sm space-y-3">
      <div className="flex gap-2">
        {(['FLAT', 'TIERED', 'MILESTONE'] as PolicyType[]).map(opt => (
          <button key={opt} type="button" onClick={() => setType(opt)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${type === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]'}`}>
            {opt === 'FLAT' ? 'Cố định' : opt === 'TIERED' ? 'Theo bậc' : 'Theo mốc tiến độ'}
          </button>
        ))}
      </div>

      {type === 'FLAT' && (
        <label className="flex items-center gap-2">
          <span className="w-32">Tỷ lệ %:</span>
          <input type="number" step="0.01" min="0" max="100" value={flatRate} onChange={e => setFlatRate(e.target.value)}
            className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-32" />
        </label>
      )}

      {type === 'TIERED' && (
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs">≥</span>
              <input type="number" min="0" value={tier.minUnitsThisMonth}
                onChange={e => setTiers(arr => arr.map((t, idx) => idx === i ? { ...t, minUnitsThisMonth: Number(e.target.value) } : t))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-24" />
              <span className="text-xs">sp/tháng →</span>
              <input type="number" step="0.01" min="0" max="100" value={tier.ratePct}
                onChange={e => setTiers(arr => arr.map((t, idx) => idx === i ? { ...t, ratePct: Number(e.target.value) } : t))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-24" />
              <span className="text-xs">%</span>
              <button type="button" onClick={() => setTiers(arr => arr.filter((_, idx) => idx !== i))}
                className="text-rose-600 text-xs hover:underline">Xoá</button>
            </div>
          ))}
          <button type="button" onClick={() => setTiers(arr => [...arr, { minUnitsThisMonth: 0, ratePct: 1 }])}
            className="text-xs font-bold text-emerald-700 hover:underline">+ Thêm bậc</button>
        </div>
      )}

      {type === 'MILESTONE' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <span className="w-32">Tỷ lệ cơ sở %:</span>
            <input type="number" step="0.01" min="0" max="100" value={msRate} onChange={e => setMsRate(e.target.value)}
              className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-32" />
          </label>
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input type="text" placeholder="key" value={m.key}
                onChange={e => setMilestones(arr => arr.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-28" />
              <input type="text" placeholder="Nhãn" value={m.label}
                onChange={e => setMilestones(arr => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] flex-1 min-w-[120px]" />
              <input type="number" step="0.01" min="0" max="100" placeholder="%" value={m.pct}
                onChange={e => setMilestones(arr => arr.map((x, idx) => idx === i ? { ...x, pct: Number(e.target.value) } : x))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-20" />
              <span className="text-xs">%</span>
              <input type="number" min="0" placeholder="ngày" value={m.offsetDays}
                onChange={e => setMilestones(arr => arr.map((x, idx) => idx === i ? { ...x, offsetDays: Number(e.target.value) } : x))}
                className="h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] w-24" />
              <span className="text-xs">ngày</span>
              <button type="button" onClick={() => setMilestones(arr => arr.filter((_, idx) => idx !== i))}
                className="text-rose-600 text-xs hover:underline">Xoá</button>
            </div>
          ))}
          <button type="button" onClick={() => setMilestones(arr => [...arr, { key: '', label: '', pct: 0, offsetDays: 0 }])}
            className="text-xs font-bold text-emerald-700 hover:underline">+ Thêm mốc</button>
        </div>
      )}

      <div className="pt-2 border-t border-[var(--glass-border)]">
        <button type="button" onClick={submit} disabled={working}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
          {working ? 'Đang lưu…' : 'Lưu chính sách'}
        </button>
        <p className="text-xs text-[var(--text-tertiary)] mt-2">
          Lưu sẽ đóng phiên bản đang hiệu lực và tạo phiên bản mới (v+1). Các giao dịch SOLD sau thời điểm này áp dụng phiên bản mới.
        </p>
      </div>
    </div>
  );
};

export default ProjectCommissionPanel;
