import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, AlertTriangle, Plus, Search, X,
  Filter, ListTodo, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  CheckSquare, Square, Trash2, CheckCircle, AlertCircle,
  ChevronDown
} from 'lucide-react';
import { taskApi, TaskListParams } from '../services/taskApi';
import { WfTask, WfTaskStatus, TaskPriority, Department } from '../types';
import { TaskDetailContent } from '../components/TaskDetailContent';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { ROUTES } from '../config/routes';
import { api } from '../services/api';

const STATUS_LABELS: Record<WfTaskStatus, string> = {
  todo: 'Chờ xử lý', in_progress: 'Đang làm', review: 'Chờ duyệt',
  done: 'Hoàn thành', cancelled: 'Đã hủy',
};
const STATUS_COLORS: Record<WfTaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
};
const PRIORITY_LABELS: Record<TaskPriority, string> = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-rose-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-teal-500',
};
const STATUSES: WfTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
type SortKey = 'priority' | 'deadline' | 'created_at' | 'updated_at';
type SortDir = 'asc' | 'desc';
const LIMIT = 20;

type Toast = { id: number; msg: string; type: 'success' | 'error' };

function readHashFilters(): Partial<FilterState> {
  try {
    const hash = window.location.hash;
    const parts = hash.slice(1).split('/').filter(Boolean);
    if (parts[0] !== ROUTES.TASKS) return {};
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return {};
    const qs = new URLSearchParams(hash.slice(qIdx + 1));
    return {
      search: qs.get('q') || '',
      statusFilter: qs.get('status')?.split(',').filter(Boolean) as WfTaskStatus[] || [],
      priorityFilter: qs.get('priority')?.split(',').filter(Boolean) as TaskPriority[] || [],
      departmentId: qs.get('dept') || '',
      sortKey: (qs.get('sort') as SortKey) || 'created_at',
      sortDir: (qs.get('dir') as SortDir) || 'desc',
      page: parseInt(qs.get('page') || '1') || 1,
    };
  } catch {
    return {};
  }
}

function writeHashFilters(f: FilterState) {
  const qs = new URLSearchParams();
  if (f.search) qs.set('q', f.search);
  if (f.statusFilter.length) qs.set('status', f.statusFilter.join(','));
  if (f.priorityFilter.length) qs.set('priority', f.priorityFilter.join(','));
  if (f.departmentId) qs.set('dept', f.departmentId);
  if (f.sortKey !== 'created_at') qs.set('sort', f.sortKey);
  if (f.sortDir !== 'desc') qs.set('dir', f.sortDir);
  if (f.page > 1) qs.set('page', String(f.page));
  const qString = qs.toString();
  const newHash = `#/${ROUTES.TASKS}${qString ? '?' + qString : ''}`;
  window.history.replaceState(null, '', newHash);
}

interface FilterState {
  search: string;
  statusFilter: WfTaskStatus[];
  priorityFilter: TaskPriority[];
  departmentId: string;
  sortKey: SortKey;
  sortDir: SortDir;
  page: number;
}

function getTaskIdFromHash(): string | null {
  const parts = window.location.hash.slice(1).split('?')[0].split('/').filter(Boolean);
  return parts[0] === ROUTES.TASKS && parts.length > 1 ? parts[1] : null;
}

function TaskList() {
  const initialFilters = useMemo(() => {
    const saved = readHashFilters();
    return {
      search: saved.search || '',
      statusFilter: saved.statusFilter || [],
      priorityFilter: saved.priorityFilter || [],
      departmentId: saved.departmentId || '',
      sortKey: saved.sortKey || ('created_at' as SortKey),
      sortDir: saved.sortDir || ('desc' as SortDir),
      page: saved.page || 1,
    };
  }, []);

  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [search, setSearch] = useState(initialFilters.search);
  const [statusFilter, setStatusFilter] = useState<WfTaskStatus[]>(initialFilters.statusFilter);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>(initialFilters.priorityFilter);
  const [departmentId, setDepartmentId] = useState(initialFilters.departmentId);
  const [page, setPage] = useState(initialFilters.page);
  const [sortKey, setSortKey] = useState<SortKey>(initialFilters.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialFilters.sortDir);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [showCreate, setShowCreate] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    api.get<{ data: Department[] }>('/api/departments').then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  const filters: FilterState = useMemo(() => ({ search, statusFilter, priorityFilter, departmentId, sortKey, sortDir, page }), [search, statusFilter, priorityFilter, departmentId, sortKey, sortDir, page]);

  useEffect(() => {
    writeHashFilters(filters);
  }, [filters]);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadTasks = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError(null);
    const params: TaskListParams = {
      page: f.page, limit: LIMIT,
      sort_by: f.sortKey, sort_dir: f.sortDir,
    };
    if (f.search) params.search = f.search;
    if (f.statusFilter.length) params.status = f.statusFilter.join(',');
    if (f.priorityFilter.length) params.priority = f.priorityFilter.join(',');
    if (f.departmentId) params.department_id = f.departmentId;
    try {
      const r = await taskApi.list(params);
      setTasks(r.data || []);
      setTotal(r.pagination?.total || 0);
    } catch {
      setError('Không thể tải công việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadTasks(filters);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [filters]);

  const openTask = useCallback((id: string) => {
    window.location.hash = `#/${ROUTES.TASKS}/${id}`;
  }, []);

  const toggleStatus = (s: WfTaskStatus) =>
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const togglePriority = (p: TaskPriority) =>
    setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const clearFilters = () => {
    setStatusFilter([]); setPriorityFilter([]); setSearch('');
    setDepartmentId(''); setPage(1);
  };

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
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
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
      } else {
        const status = bulkAction as WfTaskStatus;
        await taskApi.bulkUpdateStatus(ids, status);
        setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status } : t));
        showToast(`Đã cập nhật trạng thái cho ${ids.length} công việc`);
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

  const hasFilters = statusFilter.length > 0 || priorityFilter.length > 0 || search.length > 0 || departmentId;
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
        <button onClick={() => setShowCreate(true)}
          className="h-[34px] px-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0">
          <Plus size={15} /> Thêm
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] flex-shrink-0 space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm kiếm tiêu đề, mô tả..."
              className="w-full h-[36px] pl-9 pr-4 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            )}
          </div>
          {departments.length > 0 && (
            <select value={departmentId} onChange={e => { setDepartmentId(e.target.value); setPage(1); }}
              className="h-[36px] px-3 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-[140px]">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          {STATUSES.map(s => (
            <button key={s} onClick={() => { toggleStatus(s); setPage(1); }}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex-shrink-0 ${statusFilter.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
          <div className="w-px h-4 bg-[var(--glass-border)] mx-0.5" />
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => { togglePriority(p); setPage(1); }}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex-shrink-0 ${priorityFilter.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs px-2 py-1 text-rose-500 hover:text-rose-600 flex items-center gap-1 ml-1 font-medium flex-shrink-0">
              <X size={12} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex-shrink-0">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{selectedIds.size} đã chọn</span>
          <div className="flex gap-2 ml-auto">
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className="h-[28px] px-2 text-xs bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-[var(--text-secondary)] focus:outline-none">
              <option value="">Chọn thao tác...</option>
              <option value="todo">→ Chờ xử lý</option>
              <option value="in_progress">→ Đang làm</option>
              <option value="review">→ Chờ duyệt</option>
              <option value="done">→ Hoàn thành</option>
              <option value="cancelled">→ Đã hủy</option>
              <option value="delete">🗑 Xóa</option>
            </select>
            <button onClick={runBulkAction} disabled={!bulkAction || bulkLoading}
              className="h-[28px] px-3 text-xs bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {bulkLoading ? <Loader2 size={11} className="animate-spin" /> : null} Áp dụng
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setBulkAction(''); }}
              className="h-[28px] px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => loadTasks(filters)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <ListTodo className="w-10 h-10 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {hasFilters ? 'Không tìm thấy công việc phù hợp' : 'Chưa có công việc nào'}
            </p>
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
                      <button
                        className={`text-xs px-2 py-0.5 rounded-lg font-medium cursor-pointer flex items-center gap-1 ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                        <ChevronDown size={10} className="opacity-60" />
                      </button>
                      <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-20 py-1 hidden group-hover/status:block min-w-[130px]">
                        {STATUSES.filter(s => s !== task.status).map(s => (
                          <button key={s} onClick={() => quickChangeStatus(task, s)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]">
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                      <span className="text-xs text-[var(--text-secondary)]">{PRIORITY_LABELS[task.priority]}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    {task.deadline ? (
                      <span className={`text-xs ${task.is_overdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                        {task.is_overdue ? '⚠ ' : ''}{task.deadline.toString().split('T')[0]}
                      </span>
                    ) : <span className="text-[var(--text-tertiary)] text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell cursor-pointer" onClick={() => openTask(task.id)}>
                    <div className="flex items-center gap-1">
                      {task.assignees?.slice(0, 3).map(a => (
                        <div key={a.id} title={a.name}
                          className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-white dark:border-slate-700 flex-shrink-0">
                          {a.name?.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {(task.assignees?.length || 0) > 3 && <span className="text-xs text-[var(--text-tertiary)]">+{task.assignees.length - 3}</span>}
                      {(task.assignees?.length || 0) === 0 && <span className="text-xs text-[var(--text-tertiary)]">Chưa giao</span>}
                    </div>
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

  const taskId = useMemo(() => {
    const parts = hash.slice(1).split('?')[0].split('/').filter(Boolean);
    return parts[0] === ROUTES.TASKS && parts.length > 1 ? parts[1] : null;
  }, [hash]);

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
