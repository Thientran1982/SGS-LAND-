import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Plus, ListTodo, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  CheckSquare, Square, CheckCircle, AlertCircle, ChevronDown, Download,
  AlertTriangle
} from 'lucide-react';
import { taskApi, TaskListParams } from '../services/taskApi';
import { WfTask, WfTaskStatus, TaskPriority } from '../types';
import { TaskDetailContent } from '../components/TaskDetailContent';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TaskFilterBar, TaskFilters, EMPTY_FILTERS } from '../components/task/TaskFilterBar';
import { StatusBadge, PriorityBadge, DeadlineTag, AvatarStack, TaskSkeleton } from '../components/task/Badges';
import { STATUS_LABELS, PRIORITY_LABELS, ALL_STATUSES, exportTasksToCSV } from '../utils/taskUtils';
import { ROUTES } from '../config/routes';

type SortKey = 'priority' | 'deadline' | 'created_at' | 'updated_at';
type SortDir = 'asc' | 'desc';
const LIMIT = 20;
type Toast = { id: number; msg: string; type: 'success' | 'error' };

function serializeFilters(f: TaskFilters, sort: SortKey, dir: SortDir, page: number): string {
  const qs = new URLSearchParams();
  if (f.search) qs.set('q', f.search);
  if (f.statusFilter.length) qs.set('status', f.statusFilter.join(','));
  if (f.priorityFilter.length) qs.set('priority', f.priorityFilter.join(','));
  if (f.departmentId) qs.set('dept', f.departmentId);
  if (f.projectId) qs.set('proj', f.projectId);
  if (f.assigneeId) qs.set('uid', f.assigneeId);
  if (f.deadlineFrom) qs.set('dfrom', f.deadlineFrom);
  if (f.deadlineTo) qs.set('dto', f.deadlineTo);
  if (sort !== 'created_at') qs.set('sort', sort);
  if (dir !== 'desc') qs.set('dir', dir);
  if (page > 1) qs.set('page', String(page));
  return qs.toString();
}

function deserializeFilters(): { filters: TaskFilters; sort: SortKey; dir: SortDir; page: number } {
  try {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return { filters: EMPTY_FILTERS, sort: 'created_at', dir: 'desc', page: 1 };
    const qs = new URLSearchParams(hash.slice(qIdx + 1));
    return {
      filters: {
        search: qs.get('q') || '',
        statusFilter: qs.get('status')?.split(',').filter(Boolean) as WfTaskStatus[] || [],
        priorityFilter: qs.get('priority')?.split(',').filter(Boolean) as TaskPriority[] || [],
        departmentId: qs.get('dept') || '',
        projectId: qs.get('proj') || '',
        assigneeId: qs.get('uid') || '',
        assigneeName: '',
        deadlineFrom: qs.get('dfrom') || '',
        deadlineTo: qs.get('dto') || '',
      },
      sort: (qs.get('sort') as SortKey) || 'created_at',
      dir: (qs.get('dir') as SortDir) || 'desc',
      page: parseInt(qs.get('page') || '1') || 1,
    };
  } catch {
    return { filters: EMPTY_FILTERS, sort: 'created_at', dir: 'desc', page: 1 };
  }
}

function getTaskIdFromHash(): string | null {
  const parts = window.location.hash.slice(1).split('?')[0].split('/').filter(Boolean);
  return parts[0] === ROUTES.TASKS && parts.length > 1 ? parts[1] : null;
}

function TaskList() {
  const init = useMemo(() => deserializeFilters(), []);
  const [filters, setFilters] = useState<TaskFilters>(init.filters);
  const [sortKey, setSortKey] = useState<SortKey>(init.sort);
  const [sortDir, setSortDir] = useState<SortDir>(init.dir);
  const [page, setPage] = useState(init.page);

  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [showCreate, setShowCreate] = useState(false);
  const fetchRef = useRef(0);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const qs = serializeFilters(filters, sortKey, sortDir, page);
    const newHash = `#/${ROUTES.TASKS}${qs ? '?' + qs : ''}`;
    window.history.replaceState(null, '', newHash);
  }, [filters, sortKey, sortDir, page]);

  const loadTasks = useCallback(async (f: TaskFilters, sk: SortKey, sd: SortDir, pg: number) => {
    const token = ++fetchRef.current;
    setLoading(true);
    setError(null);
    const params: TaskListParams = { page: pg, limit: LIMIT, sort_by: sk, sort_dir: sd };
    if (f.search) params.search = f.search;
    if (f.statusFilter.length) params.status = f.statusFilter.join(',');
    if (f.priorityFilter.length) params.priority = f.priorityFilter.join(',');
    if (f.departmentId) params.department_id = f.departmentId;
    if (f.projectId) params.project_id = f.projectId;
    if (f.assigneeId) params.assignee_id = f.assigneeId;
    if (f.deadlineFrom) params.deadline_from = f.deadlineFrom;
    if (f.deadlineTo) params.deadline_to = f.deadlineTo;
    try {
      const r = await taskApi.list(params);
      if (fetchRef.current !== token) return;
      setTasks(r.data || []);
      setTotal(r.pagination?.total || 0);
    } catch {
      if (fetchRef.current !== token) return;
      setError('Không thể tải công việc');
    } finally {
      if (fetchRef.current === token) setLoading(false);
    }
  }, []);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const prevFilters = useRef<{ f: TaskFilters; sk: SortKey; sd: SortDir; pg: number } | null>(null);

  useEffect(() => {
    const sig = JSON.stringify({ filters, sortKey, sortDir, page });
    const prevSig = prevFilters.current ? JSON.stringify(prevFilters.current) : null;
    if (sig === prevSig) return;
    prevFilters.current = { f: filters, sk: sortKey, sd: sortDir, pg: page };

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadTasks(filters, sortKey, sortDir, page);
    }, 250);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [filters, sortKey, sortDir, page, loadTasks]);

  const openTask = useCallback((id: string) => {
    window.location.hash = `#/${ROUTES.TASKS}/${id}`;
  }, []);

  const handleFiltersChange = useCallback((f: TaskFilters) => {
    setFilters(f); setPage(1); setSelectedIds(new Set());
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-indigo-500" /> : <ArrowDown size={12} className="text-indigo-500" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(tasks.length > 0 && selectedIds.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)));
  };

  const runBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      if (bulkAction === 'delete') {
        if (!window.confirm(`Xóa ${ids.length} công việc đã chọn?`)) { setBulkLoading(false); return; }
        await taskApi.bulkDelete(ids);
        setTasks(prev => prev.filter(t => !selectedIds.has(t.id)));
        setTotal(prev => Math.max(0, prev - ids.length));
        showToast(`Đã xóa ${ids.length} công việc`);
      } else if (bulkAction === 'export') {
        exportTasksToCSV(tasks.filter(t => selectedIds.has(t.id)));
        showToast(`Đã xuất ${ids.length} công việc`);
      } else {
        const status = bulkAction as WfTaskStatus;
        await taskApi.bulkUpdateStatus(ids, status);
        setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status } : t));
        showToast(`Đã cập nhật ${ids.length} công việc`);
      }
      setSelectedIds(new Set());
      setBulkAction('');
    } catch (err) {
      showToast((err as { message?: string })?.message || 'Thao tác thất bại', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const quickChangeStatus = async (task: WfTask, newStatus: WfTaskStatus) => {
    try {
      const updated = await taskApi.changeStatus(task.id, newStatus);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: updated.status } : t));
      showToast(`Đã đổi sang "${STATUS_LABELS[newStatus]}"`);
    } catch {
      showToast('Không thể đổi trạng thái', 'error');
    }
  };

  const quickChangePriority = async (task: WfTask, newPriority: TaskPriority) => {
    try {
      const updated = await taskApi.update(task.id, { priority: newPriority });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: updated.priority } : t));
    } catch {
      showToast('Không thể đổi ưu tiên', 'error');
    }
  };

  const hasFilters = !!(filters.search || filters.statusFilter.length || filters.priorityFilter.length ||
    filters.departmentId || filters.projectId || filters.assigneeId ||
    filters.deadlineFrom || filters.deadlineTo);
  const totalPages = Math.ceil(total / LIMIT);
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;

  const handleTaskCreated = useCallback((task: WfTask) => {
    setTasks(prev => [task, ...prev]);
    setTotal(prev => prev + 1);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-[var(--glass-border)] flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListTodo className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <h1 className="text-base font-bold text-[var(--text-primary)] truncate">Danh sách Công việc</h1>
          <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0 bg-[var(--glass-surface-hover)] px-2 py-0.5 rounded-full">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportTasksToCSV(tasks)} title="Xuất CSV"
            className="h-[34px] w-[34px] flex items-center justify-center border border-[var(--glass-border)] rounded-xl text-[var(--text-tertiary)] hover:text-indigo-600 hover:border-indigo-300 transition-colors">
            <Download size={15} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="h-[34px] px-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0">
            <Plus size={15} /> Thêm
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] flex-shrink-0">
        <TaskFilterBar
          filters={filters}
          onChange={handleFiltersChange}
          showStatus
          showPriority
          showDepartment
          showProject
          showAssignee
          showDeadlineRange
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex-shrink-0">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{selectedIds.size} đã chọn</span>
          <div className="flex gap-2 ml-auto">
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className="h-[28px] px-2 text-xs bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-[var(--text-secondary)] focus:outline-none">
              <option value="">Chọn thao tác...</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>→ {STATUS_LABELS[s]}</option>
              ))}
              <option value="export">📥 Xuất CSV</option>
              <option value="delete">🗑 Xóa</option>
            </select>
            <button onClick={runBulkAction} disabled={!bulkAction || bulkLoading}
              className="h-[28px] px-3 text-xs bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {bulkLoading ? <Loader2 size={11} className="animate-spin" /> : null} Áp dụng
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setBulkAction(''); }}
              className="h-[28px] px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">✕</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {loading ? (
          <TaskSkeleton rows={8} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => loadTasks(filters, sortKey, sortDir, page)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <ListTodo className="w-10 h-10 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">{hasFilters ? 'Không tìm thấy công việc phù hợp' : 'Chưa có công việc nào'}</p>
            {!hasFilters && (
              <button onClick={() => setShowCreate(true)} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1">
                <Plus size={14} /> Tạo công việc đầu tiên
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--glass-border)] z-10">
              <tr className="text-left text-[var(--text-tertiary)]">
                <th className="pl-4 md:pl-6 pr-2 py-3 w-8">
                  <button onClick={toggleSelectAll} className="text-[var(--text-tertiary)] hover:text-indigo-500 transition-colors">
                    {allSelected ? <CheckSquare size={15} className="text-indigo-500" /> : <Square size={15} />}
                  </button>
                </th>
                <th className="px-2 py-3 font-medium text-xs">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                    Tiêu đề <SortIcon col="created_at" />
                  </button>
                </th>
                <th className="px-3 py-3 font-medium text-xs hidden sm:table-cell">Trạng thái</th>
                <th className="px-3 py-3 font-medium text-xs hidden md:table-cell">
                  <button onClick={() => handleSort('priority')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                    Ưu tiên <SortIcon col="priority" />
                  </button>
                </th>
                <th className="px-3 py-3 font-medium text-xs hidden lg:table-cell">
                  <button onClick={() => handleSort('deadline')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                    Deadline <SortIcon col="deadline" />
                  </button>
                </th>
                <th className="px-3 py-3 font-medium text-xs hidden xl:table-cell">Người thực hiện</th>
                <th className="px-3 py-3 w-8 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-[var(--glass-surface-hover)] transition-colors group">
                  <td className="pl-4 md:pl-6 pr-2 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelect(task.id); }}>
                    <button className="text-[var(--text-tertiary)] hover:text-indigo-500 transition-colors">
                      {selectedIds.has(task.id) ? <CheckSquare size={15} className="text-indigo-500" /> : <Square size={15} />}
                    </button>
                  </td>
                  <td className="px-2 py-3 cursor-pointer" onClick={() => openTask(task.id)}>
                    <div className="font-medium text-[var(--text-primary)] line-clamp-1 group-hover:text-indigo-600 transition-colors">{task.title}</div>
                    {task.project_name && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{task.project_name}</div>}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative group/status inline-block">
                      <button className="flex items-center gap-1">
                        <StatusBadge status={task.status} />
                        <ChevronDown size={10} className="opacity-50" />
                      </button>
                      <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-20 py-1 hidden group-hover/status:block min-w-[130px]">
                        {ALL_STATUSES.filter(s => s !== task.status).map(s => (
                          <button key={s} onClick={() => quickChangeStatus(task, s)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]">
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative group/priority inline-block">
                      <button className="flex items-center gap-1">
                        <PriorityBadge priority={task.priority} variant="dot" />
                        <ChevronDown size={10} className="opacity-50" />
                      </button>
                      <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-20 py-1 hidden group-hover/priority:block min-w-[110px]">
                        {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).filter(p => p !== task.priority).map(p => (
                          <button key={p} onClick={() => quickChangePriority(task, p)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]">
                            {PRIORITY_LABELS[p]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    <DeadlineTag
                      deadline={task.deadline?.toString()}
                      isOverdue={task.is_overdue}
                      daysUntilDeadline={task.days_until_deadline}
                    />
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    <AvatarStack assignees={task.assignees || []} />
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    <ChevronRight size={14} className="text-[var(--text-tertiary)] group-hover:text-indigo-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-[var(--glass-border)] flex-shrink-0">
          <span className="text-xs text-[var(--text-tertiary)]">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="h-[30px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40 transition-colors">←</button>
            <span className="h-[30px] px-3 text-xs flex items-center text-[var(--text-primary)] font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="h-[30px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40 transition-colors">→</button>
          </div>
        </div>
      )}

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={handleTaskCreated} />}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white animate-enter ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
            {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Tasks() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const taskId = useMemo(() => getTaskIdFromHash(), [hash]);

  if (taskId) {
    return (
      <TaskDetailContent
        taskId={taskId}
        onBack={() => { window.location.hash = `#/${ROUTES.TASKS}`; }}
      />
    );
  }

  return <TaskList />;
}
