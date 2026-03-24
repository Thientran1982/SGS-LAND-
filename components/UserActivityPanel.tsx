import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/dbApi';

interface ActivityUser {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userAvatar?: string;
  totalViews: number;
  views30d: number;
  viewsInRange: number;
  firstVisit: string | null;
  lastVisit: string | null;
  topPage: string | null;
  totalSessions: number;
}

interface PageStat {
  path: string;
  pageLabel: string;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
}

interface RecentVisit {
  id: string;
  path: string;
  pageLabel: string;
  visitedAt: string;
  ipAddress: string | null;
}

type DateRange = 'today' | '7d' | '30d' | 'all' | 'custom';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getPresetFromDate(range: Exclude<DateRange, 'custom'>): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  const days = range === '7d' ? 7 : 30;
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

function RoleChip({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN: 'bg-violet-100 text-violet-700',
    TEAM_LEAD: 'bg-blue-100 text-blue-700',
    SALES: 'bg-emerald-100 text-emerald-700',
    PARTNER_ADMIN: 'bg-amber-100 text-amber-700',
    PARTNER_AGENT: 'bg-orange-100 text-orange-700',
  };
  const labels: Record<string, string> = {
    ADMIN: 'Admin',
    TEAM_LEAD: 'Trưởng nhóm',
    SALES: 'Kinh doanh',
    PARTNER_ADMIN: 'Đối tác Admin',
    PARTNER_AGENT: 'Đối tác Đại lý',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${map[role] || 'bg-slate-100 text-slate-600'}`}>
      {labels[role] || role}
    </span>
  );
}

function UserAvatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  const initials = name?.split(' ').slice(-1)[0]?.[0]?.toUpperCase() || '?';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

interface UserDetailDrawerProps {
  user: ActivityUser;
  fromDate?: string;
  onClose: () => void;
}

function UserDetailDrawer({ user, fromDate, onClose }: UserDetailDrawerProps) {
  const { data: detail, isLoading } = useQuery<{ pageStats: PageStat[]; recentVisits: RecentVisit[] }>({
    queryKey: ['user-activity-detail', user.userId, fromDate],
    queryFn: () => db.getUserActivityDetail(user.userId, fromDate),
    staleTime: 60_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-xl h-full bg-[var(--bg-surface)] shadow-2xl flex flex-col overflow-hidden animate-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-5 border-b border-[var(--glass-border)]">
          <UserAvatar name={user.userName} avatar={user.userAvatar} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[var(--text-primary)] truncate">{user.userName}</div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{user.userEmail}</div>
          </div>
          <RoleChip role={user.userRole} />
          <button
            onClick={onClose}
            className="ml-2 p-2 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--glass-surface)] rounded-xl p-3 text-center border border-[var(--glass-border)]">
              <div className="text-xl font-bold text-[var(--primary-600)]">{user.totalViews}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Tổng lượt</div>
            </div>
            <div className="bg-[var(--glass-surface)] rounded-xl p-3 text-center border border-[var(--glass-border)]">
              <div className="text-xl font-bold text-[var(--primary-600)]">{user.views30d}</div>
              <div className="text-xs text-[var(--text-tertiary)]">30 ngày qua</div>
            </div>
            <div className="bg-[var(--glass-surface)] rounded-xl p-3 text-center border border-[var(--glass-border)]">
              <div className="text-xl font-bold text-[var(--text-secondary)]">{user.totalSessions}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Phiên đăng nhập</div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[var(--glass-surface)] rounded-xl" />)}
            </div>
          ) : !detail ? (
            <div className="text-center text-[var(--text-tertiary)] py-10">Không có dữ liệu</div>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">Thống Kê Theo Trang</h4>
                {detail.pageStats.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)]">Chưa có lượt xem nào.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.pageStats.map(ps => (
                      <div
                        key={ps.path}
                        className="flex items-center gap-3 p-3 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                            {ps.pageLabel || ps.path}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            Lần cuối: {formatDateShort(ps.lastVisit)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-[var(--primary-600)]">{ps.visitCount}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">lượt</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">Lịch Sử Truy Cập Gần Đây</h4>
                {detail.recentVisits.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)]">Chưa có lịch sử.</p>
                ) : (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {detail.recentVisits.map(visit => (
                      <div
                        key={visit.id}
                        className="flex items-center gap-3 px-3 py-2 bg-[var(--glass-surface)] rounded-lg border border-[var(--glass-border)]"
                      >
                        <div className="w-2 h-2 rounded-full bg-[var(--primary-600)] shrink-0 opacity-60" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-[var(--text-primary)] font-medium truncate">
                            {visit.pageLabel || visit.path}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] shrink-0 tabular-nums">
                          {formatDateTime(visit.visitedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function UserActivityPanel() {
  const [range, setRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedUser, setSelectedUser] = useState<ActivityUser | null>(null);

  const fromDate: string | undefined = range === 'custom'
    ? (customFrom ? new Date(customFrom).toISOString() : undefined)
    : getPresetFromDate(range as Exclude<DateRange, 'custom'>);

  const { data: users = [], isLoading } = useQuery<ActivityUser[]>({
    queryKey: ['activity-summary', fromDate],
    queryFn: () => db.getActivitySummary(fromDate),
    staleTime: 60_000,
    enabled: range !== 'custom' || !!customFrom,
  });

  const isCustomRangeActive = range === 'custom' && !!customFrom;
  const showRangeCount = range !== 'all' && (range !== 'custom' || isCustomRangeActive);

  const rangeOptions: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Hôm nay' },
    { key: '7d', label: '7 ngày' },
    { key: '30d', label: '30 ngày' },
    { key: 'all', label: 'Tất cả' },
    { key: 'custom', label: 'Tùy chọn' },
  ];

  return (
    <div className="animate-enter max-w-5xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Nhật Ký Truy Cập Người Dùng</h3>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              Theo dõi lịch sử truy cập, trang đã xem và số lần đăng nhập của từng thành viên.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[var(--glass-surface-hover)] p-1 rounded-xl shrink-0">
            {rangeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  range === opt.key
                    ? 'bg-[var(--bg-surface)] shadow text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--text-tertiary)] whitespace-nowrap">Từ ngày</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 text-sm bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--text-tertiary)] whitespace-nowrap">Đến ngày</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 text-sm bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] transition-all"
              />
            </div>
            {!customFrom && (
              <span className="text-xs text-[var(--text-tertiary)]">Chọn ngày bắt đầu để lọc dữ liệu</span>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[var(--glass-surface)] rounded-2xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-tertiary)]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="font-medium">Chưa có dữ liệu truy cập</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">
                    Người dùng
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden sm:table-cell">
                    Vai trò
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">
                    Tổng lượt
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden md:table-cell">
                    30 ngày
                  </th>
                  {showRangeCount && (
                    <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden md:table-cell">
                      Trong kỳ
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden xl:table-cell">
                    Trang hay xem nhất
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden lg:table-cell">
                    Lần đầu
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden lg:table-cell">
                    Lần cuối
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide hidden sm:table-cell">
                    Phiên
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {users.map(u => (
                  <tr
                    key={u.userId}
                    className="hover:bg-[var(--glass-surface)] transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.userName} avatar={u.userAvatar} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)] truncate max-w-[160px]">
                            {u.userName}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)] truncate max-w-[160px]">
                            {u.userEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <RoleChip role={u.userRole} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-bold text-[var(--primary-600)] text-base">{u.totalViews}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">lượt</div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <div className="font-semibold text-[var(--text-secondary)]">{u.views30d}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">lượt</div>
                    </td>
                    {showRangeCount && (
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <div className="font-semibold text-[var(--text-secondary)]">{u.viewsInRange}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">lượt</div>
                      </td>
                    )}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {u.topPage ? (
                        <span className="text-sm text-[var(--text-secondary)] font-medium">{u.topPage}</span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {formatDateShort(u.firstVisit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {formatDateTime(u.lastVisit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs font-bold text-[var(--text-secondary)] tabular-nums">
                        {u.totalSessions}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedUser(u); }}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--primary-600)] hover:bg-[var(--glass-surface)] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-[var(--glass-surface)] border-t border-[var(--glass-border)] text-xs text-[var(--text-tertiary)]">
            {users.length} người dùng • Click vào hàng để xem chi tiết
          </div>
        </div>
      )}

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          fromDate={fromDate}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
