import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';

interface VendorAdmin {
  id: string;
  email: string;
  name: string;
  status: string;
  emailVerified: boolean;
}

interface VendorSubscription {
  planId: string;
  status: string;
  trialEndsAt: string | null;
}

interface Vendor {
  id: string;
  name: string;
  domain: string;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  admin: VendorAdmin | null;
  subscription: VendorSubscription;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  APPROVED:         { label: 'Đã duyệt',  className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  REJECTED:         { label: 'Từ chối',   className: 'bg-rose-100 text-rose-800 border border-rose-200' },
  SUSPENDED:        { label: 'Tạm ngừng', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function RejectModal({
  vendor,
  onConfirm,
  onClose,
}: {
  vendor: Vendor;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Vui lòng nhập lý do từ chối'); return; }
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Từ chối đăng ký</h3>
          <p className="text-sm text-gray-500 mt-1">
            Workspace: <strong>{vendor.name}</strong> — {vendor.admin?.email}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Lý do từ chối <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              rows={4}
              placeholder="Ví dụ: Thông tin đăng ký không đầy đủ, chưa đủ điều kiện tham gia..."
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
            />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuspendModal({
  vendor,
  onConfirm,
  onClose,
}: {
  vendor: Vendor;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(reason.trim() || 'Suspended by platform admin');
      onClose();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Tạm ngừng workspace</h3>
          <p className="text-sm text-gray-500 mt-1"><strong>{vendor.name}</strong></p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            rows={3}
            placeholder="Lý do tạm ngừng (không bắt buộc)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Hủy</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition disabled:opacity-60">
              {loading ? 'Đang xử lý...' : 'Tạm ngừng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorManagement() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Vendor | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await db.getVendors({ status: filterStatus || undefined, search: search || undefined, page, limit: 20 });
      setVendors(data.vendors || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e: any) {
      setError(e.message || 'Không tải được danh sách vendor');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search, page]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleApprove = async (vendor: Vendor) => {
    if (!confirm(`Duyệt workspace "${vendor.name}" (${vendor.admin?.email})?`)) return;
    setActionLoading(vendor.id);
    try {
      await db.approveVendor(vendor.id);
      showSuccess(`Đã duyệt workspace "${vendor.name}". Email thông báo đã được gửi.`);
      fetchVendors();
    } catch (e: any) {
      setError(e.message || 'Duyệt thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (vendor: Vendor, reason: string) => {
    setActionLoading(vendor.id);
    try {
      await db.rejectVendor(vendor.id, reason);
      showSuccess(`Đã từ chối "${vendor.name}". Email thông báo đã được gửi.`);
      fetchVendors();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (vendor: Vendor, reason: string) => {
    setActionLoading(vendor.id);
    try {
      await db.suspendVendor(vendor.id, reason);
      showSuccess(`Đã tạm ngừng workspace "${vendor.name}".`);
      fetchVendors();
    } finally {
      setActionLoading(null);
    }
  };

  const statusCounts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.approvalStatus] = (acc[v.approvalStatus] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý Vendor</h1>
              <p className="text-sm text-gray-500 mt-1">
                Duyệt, từ chối hoặc tạm ngừng workspace của các công ty đăng ký trên SGS Land
              </p>
            </div>
            <button
              onClick={fetchVendors}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => { setFilterStatus(filterStatus === s ? '' : s); setPage(1); }}
                className={`bg-white rounded-2xl border-2 p-4 text-left transition hover:shadow-md ${filterStatus === s ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100'}`}
              >
                <p className="text-2xl font-bold text-gray-900">{statusCounts[s] || 0}</p>
                <p className="text-xs font-semibold mt-1">
                  <StatusBadge status={s} />
                </p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên công ty hoặc email..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Tất cả trạng thái ({total})</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="SUSPENDED">Tạm ngừng</option>
          </select>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {successMsg}
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <svg className="w-6 h-6 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang tải...
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm">Không có vendor nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Công ty</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Admin</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Gói</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Trạng thái</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Ngày đăng ký</th>
                    <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{vendor.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{vendor.domain}</p>
                      </td>
                      <td className="px-5 py-4">
                        {vendor.admin ? (
                          <div>
                            <p className="font-medium text-gray-800">{vendor.admin.name}</p>
                            <p className="text-xs text-gray-500">{vendor.admin.email}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {vendor.admin.emailVerified ? (
                                <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                  Email đã xác minh
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600">Email chưa xác minh</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-700 font-medium">{vendor.subscription?.planId || '—'}</p>
                        {vendor.subscription?.trialEndsAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Trial đến {new Date(vendor.subscription.trialEndsAt).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={vendor.approvalStatus} />
                        {vendor.rejectionReason && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[150px] truncate" title={vendor.rejectionReason}>
                            {vendor.rejectionReason}
                          </p>
                        )}
                        {vendor.approvedBy && vendor.approvalStatus === 'APPROVED' && (
                          <p className="text-xs text-gray-400 mt-0.5">bởi {vendor.approvedBy}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-600">{new Date(vendor.createdAt).toLocaleDateString('vi-VN')}</p>
                        <p className="text-xs text-gray-400">{new Date(vendor.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {vendor.approvalStatus === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => handleApprove(vendor)}
                                disabled={actionLoading === vendor.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60"
                              >
                                {actionLoading === vendor.id ? '...' : 'Duyệt'}
                              </button>
                              <button
                                onClick={() => setRejectTarget(vendor)}
                                disabled={actionLoading === vendor.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-60"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {vendor.approvalStatus === 'APPROVED' && (
                            <button
                              onClick={() => setSuspendTarget(vendor)}
                              disabled={actionLoading === vendor.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-60"
                            >
                              Tạm ngừng
                            </button>
                          )}
                          {(vendor.approvalStatus === 'REJECTED' || vendor.approvalStatus === 'SUSPENDED') && (
                            <button
                              onClick={() => handleApprove(vendor)}
                              disabled={actionLoading === vendor.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition disabled:opacity-60"
                            >
                              {actionLoading === vendor.id ? '...' : 'Kích hoạt lại'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Trước
            </button>
            <span className="text-sm text-gray-500">Trang {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          vendor={rejectTarget}
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {suspendTarget && (
        <SuspendModal
          vendor={suspendTarget}
          onConfirm={(reason) => handleSuspend(suspendTarget, reason)}
          onClose={() => setSuspendTarget(null)}
        />
      )}
    </div>
  );
}
