import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { commissionApi, type LedgerItem, type LedgerStatus } from '../services/api/commissionApi';
import { db } from '../services/dbApi';
import { Dropdown } from '../components/Dropdown';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<LedgerStatus, string> = {
  PENDING:   'Chờ chốt',
  DUE:       'Đến hạn',
  PAID:      'Đã thanh toán',
  CANCELLED: 'Đã huỷ',
};

const STATUS_COLOR: Record<LedgerStatus, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
  DUE:       'bg-orange-50 text-orange-700 border-orange-200',
  PAID:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function fmtMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; }
}

export const Commissions: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [fProjectId, setFProjectId] = useState<string>('');
  const [fStatus, setFStatus] = useState<string>('');
  const [fFrom, setFFrom] = useState<string>('');
  const [fTo, setFTo] = useState<string>('');

  const [paying, setPaying] = useState<string | null>(null);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [payNote, setPayNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const isAdmin = !!user && ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role);

  useEffect(() => {
    db.getCurrentUser().then(setUser).catch(() => setUser(null));
    db.getProjects(1, 200).then((r: any) => setProjects(r?.data || [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    commissionApi.list({
      page, pageSize: PAGE_SIZE,
      projectId: fProjectId || undefined,
      status: (fStatus as LedgerStatus) || undefined,
      fromDate: fFrom || undefined,
      toDate:   fTo   || undefined,
    })
      .then(res => { setItems(res.data); setTotal(res.total); })
      .catch(e => setErr(e?.message || 'Không tải được danh sách hoa hồng'))
      .finally(() => setLoading(false));
  }, [page, fProjectId, fStatus, fFrom, fTo]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const sum = (key: 'pending' | 'paid') =>
      items
        .filter(i => key === 'pending' ? i.status !== 'PAID' && i.status !== 'CANCELLED' : i.status === 'PAID')
        .reduce((acc, i) => acc + Number(i.gross_amount || 0), 0);
    return { pending: sum('pending'), paid: sum('paid') };
  }, [items]);

  const handlePaid = async (id: string) => {
    try {
      setPaying(id);
      await commissionApi.markPaid(id, payNote || undefined);
      setToast({ msg: 'Đã đánh dấu thanh toán', type: 'success' });
      setPayNote('');
      load();
    } catch (e: any) {
      setToast({ msg: e?.message || 'Lỗi đánh dấu thanh toán', type: 'error' });
    } finally {
      setPaying(null);
    }
  };

  const handleBulkPaid = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Đánh dấu đã trả ${ids.length} bút toán?`)) return;
    try {
      setBulkPaying(true);
      const res = await commissionApi.markPaidBulk(ids, payNote || undefined);
      setToast({ msg: `Đã đánh dấu ${res.updated}/${res.requested} bút toán`, type: 'success' });
      setSelected(new Set());
      setPayNote('');
      load();
    } catch (e: any) {
      setToast({ msg: e?.message || 'Lỗi đánh dấu hàng loạt', type: 'error' });
    } finally {
      setBulkPaying(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const eligibleIds = items.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').map(i => i.id);
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every(id => selected.has(id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      if (allEligibleSelected) {
        const next = new Set(prev);
        eligibleIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      eligibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const exportUrl = commissionApi.exportXlsxUrl({
    projectId: fProjectId || undefined,
    status:    fStatus || undefined,
    fromDate:  fFrom || undefined,
    toDate:    fTo || undefined,
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">Hoa hồng</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isAdmin ? 'Toàn bộ giao dịch hoa hồng theo dự án.' : 'Hoa hồng của sàn đối tác bạn quản lý.'}
          </p>
        </div>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          ⬇ Xuất Excel
        </a>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Tổng dòng hiện hiển thị" value={String(items.length)} />
        <Stat label="Tổng kết quả" value={String(total)} />
        <Stat label="Đang chờ chi" value={fmtMoney(totals.pending)} />
        <Stat label="Đã thanh toán (trang)" value={fmtMoney(totals.paid)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)]">
        <Dropdown
          value={fProjectId}
          onChange={v => { setPage(1); setFProjectId(v as string); }}
          placeholder="Tất cả dự án"
          className="h-[36px] min-w-[180px]"
          options={[{ value: '', label: 'Tất cả dự án' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
        />
        <Dropdown
          value={fStatus}
          onChange={v => { setPage(1); setFStatus(v as string); }}
          placeholder="Mọi trạng thái"
          className="h-[36px] min-w-[160px]"
          options={[
            { value: '',          label: 'Mọi trạng thái' },
            { value: 'PENDING',   label: STATUS_LABEL.PENDING },
            { value: 'DUE',       label: STATUS_LABEL.DUE },
            { value: 'PAID',      label: STATUS_LABEL.PAID },
            { value: 'CANCELLED', label: STATUS_LABEL.CANCELLED },
          ]}
        />
        <input
          type="date"
          value={fFrom}
          onChange={e => { setPage(1); setFFrom(e.target.value); }}
          className="h-[36px] px-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] text-sm"
        />
        <span className="text-xs text-[var(--text-tertiary)]">→</span>
        <input
          type="date"
          value={fTo}
          onChange={e => { setPage(1); setFTo(e.target.value); }}
          className="h-[36px] px-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] text-sm"
        />
        {(fProjectId || fStatus || fFrom || fTo) && (
          <button
            type="button"
            onClick={() => { setPage(1); setFProjectId(''); setFStatus(''); setFFrom(''); setFTo(''); }}
            className="h-[36px] px-3 rounded-xl text-sm text-rose-600 hover:bg-rose-50"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {err && (
        <div className="p-3 mb-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--glass-border)] bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-[var(--text-tertiary)]">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={allEligibleSelected} onChange={toggleSelectAll}
                      aria-label="Chọn tất cả" disabled={eligibleIds.length === 0} />
                  </th>
                )}
                <th className="text-left px-3 py-2">Ngày bán</th>
                <th className="text-left px-3 py-2">Dự án / Sản phẩm</th>
                <th className="text-left px-3 py-2">Sale / Đối tác</th>
                <th className="text-right px-3 py-2">Giá bán</th>
                <th className="text-right px-3 py-2">Hoa hồng</th>
                <th className="text-left px-3 py-2">% / Loại</th>
                <th className="text-left px-3 py-2">Trạng thái</th>
                {isAdmin && <th className="text-right px-3 py-2">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-[var(--text-tertiary)]">Đang tải…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-[var(--text-tertiary)]">Chưa có giao dịch hoa hồng nào.</td></tr>
              ) : items.map(it => (
                <tr key={it.id} className="border-t border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]">
                  {isAdmin && (
                    <td className="px-3 py-2">
                      {it.status !== 'PAID' && it.status !== 'CANCELLED' ? (
                        <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)}
                          aria-label={`Chọn ${it.id}`} />
                      ) : null}
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(it.sale_date)}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[var(--text-primary)]">{it.project_name || '—'}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{it.listing_code || it.listing_title || it.listing_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{it.sales_user_name || '—'}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {it.partner_tenant_name ? `Đối tác: ${it.partner_tenant_name}` : 'Bán nội bộ'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(it.sale_price)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-emerald-700">{fmtMoney(it.gross_amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {it.rate_pct ? `${Number(it.rate_pct).toFixed(2)}%` : '—'}
                    <div className="text-xs text-[var(--text-tertiary)]">{it.policy_type || '—'}{it.policy_version ? ` v${it.policy_version}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLOR[it.status]}`}>
                      {STATUS_LABEL[it.status]}
                    </span>
                    {it.paid_at && <div className="text-xs text-[var(--text-tertiary)] mt-1">Trả: {fmtDate(it.paid_at)}</div>}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      {it.status !== 'PAID' && it.status !== 'CANCELLED' ? (
                        <button
                          type="button"
                          onClick={() => handlePaid(it.id)}
                          disabled={paying === it.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {paying === it.id ? '...' : 'Đánh dấu đã trả'}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--glass-border)] text-sm">
            <div className="text-[var(--text-tertiary)]">Trang {page} / {pageCount} · Tổng {total}</div>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-[var(--glass-border)] disabled:opacity-40">‹</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                className="px-3 py-1 rounded-lg border border-[var(--glass-border)] disabled:opacity-40">›</button>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span>Ghi chú khi đánh dấu thanh toán:</span>
          <input
            type="text"
            value={payNote}
            onChange={e => setPayNote(e.target.value)}
            placeholder="VD: chuyển khoản đợt 1"
            className="h-8 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] text-sm flex-1 max-w-[400px]"
          />
          {selected.size > 0 && (
            <>
              <span className="font-bold text-emerald-700">Đã chọn: {selected.size}</span>
              <button type="button" onClick={handleBulkPaid} disabled={bulkPaying}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                {bulkPaying ? 'Đang xử lý…' : `Đánh dấu đã trả (${selected.size})`}
              </button>
              <button type="button" onClick={() => setSelected(new Set())}
                className="px-2 py-1.5 text-rose-600 text-xs hover:underline">Bỏ chọn</button>
            </>
          )}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-xl shadow-lg text-sm font-bold ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)]">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="text-lg font-extrabold text-[var(--text-primary)] mt-1">{value}</div>
  </div>
);

export default Commissions;
