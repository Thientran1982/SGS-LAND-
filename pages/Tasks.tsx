import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, AlertTriangle, Plus, Search, X,
  Filter, ListTodo, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { WfTask, WfTaskStatus, TaskPriority } from '../types';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { ROUTES } from '../config/routes';

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

function getTaskIdFromHash(): string | null {
  const hash = window.location.hash.slice(1);
  const parts = hash.split('/').filter(Boolean);
  return parts[0] === 'tasks' && parts.length > 1 ? parts[1] : null;
}

export function Tasks() {
  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WfTaskStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([]);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const LIMIT = 20;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(getTaskIdFromHash);
  const [showCreate, setShowCreate] = useState(false);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadTasks = useCallback(async (
    s: string, st: WfTaskStatus[], pr: TaskPriority[], pg: number,
    sk: SortKey, sd: SortDir
  ) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('limit', String(LIMIT));
    params.set('page', String(pg));
    params.set('sort_by', sk);
    params.set('sort_dir', sd);
    if (s) params.set('search', s);
    if (st.length) params.set('status', st.join(','));
    if (pr.length) params.set('priority', pr.join(','));

    try {
      const r = await api.get<{ data: WfTask[]; pagination: { total: number } }>(`/api/tasks?${params.toString()}`);
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
      setPage(1);
      loadTasks(search, statusFilter, priorityFilter, 1, sortKey, sortDir);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, priorityFilter, loadTasks, sortKey, sortDir]);

  useEffect(() => {
    loadTasks(search, statusFilter, priorityFilter, page, sortKey, sortDir);
  }, [page]);

  useEffect(() => {
    const handler = () => {
      const id = getTaskIdFromHash();
      setSelectedTaskId(id);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const openTask = useCallback((id: string) => {
    setSelectedTaskId(id);
    window.location.hash = `#/tasks/${id}`;
  }, []);

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
    window.location.hash = `#/${ROUTES.TASKS}`;
  }, []);

  const openFullPage = useCallback((id: string) => {
    window.location.hash = `#/${ROUTES.TASK_DETAIL}/${id}`;
  }, []);

  const toggleStatus = (s: WfTaskStatus) => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const togglePriority = (p: TaskPriority) => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const clearFilters = () => { setStatusFilter([]); setPriorityFilter([]); setSearch(''); setPage(1); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-indigo-500" /> : <ArrowDown size={12} className="text-indigo-500" />;
  };

  const hasFilters = statusFilter.length > 0 || priorityFilter.length > 0 || search.length > 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleTaskUpdated = useCallback((updated: WfTask) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

  const handleTaskDeleted = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    closeTask();
    setTotal(prev => Math.max(0, prev - 1));
  }, [closeTask]);

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
          <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0 bg-[var(--glass-surface-hover)] px-2 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="h-[34px] px-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0">
          <Plus size={15} /> Thêm
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] flex-shrink-0 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm tiêu đề, mô tả..."
            className="w-full h-[38px] pl-9 pr-4 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          {STATUSES.map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${statusFilter.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
          <div className="w-px h-4 bg-[var(--glass-border)] mx-0.5" />
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => togglePriority(p)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${priorityFilter.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs px-2 py-1 text-rose-500 hover:text-rose-600 flex items-center gap-1 ml-1 font-medium">
              <X size={12} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

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
            <button onClick={() => loadTasks(search, statusFilter, priorityFilter, page, sortKey, sortDir)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
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
                <th className="px-4 md:px-6 py-3 font-medium text-xs">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                    Tiêu đề <SortIcon col="created_at" />
                  </button>
                </th>
                <th className="px-3 py-3 font-medium text-xs hidden sm:table-cell text-[var(--text-tertiary)]">
                  Trạng thái
                </th>
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
                <th className="px-3 py-3 w-10 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {tasks.map(task => (
                <tr key={task.id}
                  onClick={() => openTask(task.id)}
                  className="hover:bg-[var(--glass-surface-hover)] transition-colors cursor-pointer group">
                  <td className="px-4 md:px-6 py-3">
                    <div className="font-medium text-[var(--text-primary)] line-clamp-1 group-hover:text-indigo-600 transition-colors">{task.title}</div>
                    {task.project_name && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{task.project_name}</div>}
                    <div className="flex items-center gap-1.5 mt-1 sm:hidden flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                        <span className="text-xs text-[var(--text-tertiary)]">{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                      {task.is_overdue && <span className="text-xs text-rose-500 font-semibold">⚠ Quá hạn</span>}
                    </div>
                  </td>

                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                  </td>

                  <td className="px-3 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                      <span className="text-xs text-[var(--text-secondary)]">{PRIORITY_LABELS[task.priority]}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3 hidden lg:table-cell">
                    {task.deadline ? (
                      <span className={`text-xs ${task.is_overdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                        {task.is_overdue ? '⚠ ' : ''}{task.deadline.toString().split('T')[0]}
                      </span>
                    ) : <span className="text-[var(--text-tertiary)] text-xs">—</span>}
                  </td>

                  <td className="px-3 py-3 hidden xl:table-cell">
                    <div className="flex items-center gap-1">
                      {task.assignees?.slice(0, 3).map(a => (
                        <div key={a.id} title={a.name}
                          className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-white dark:border-slate-700 flex-shrink-0">
                          {a.name?.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {(task.assignees?.length || 0) > 3 && (
                        <span className="text-xs text-[var(--text-tertiary)]">+{task.assignees.length - 3}</span>
                      )}
                      {(task.assignees?.length || 0) === 0 && (
                        <span className="text-xs text-[var(--text-tertiary)]">Chưa giao</span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); openFullPage(task.id); }}
                        title="Mở trang chi tiết"
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                        <ExternalLink size={12} />
                      </button>
                      <ChevronRight size={14} className="text-[var(--text-tertiary)] group-hover:text-indigo-500 transition-colors" />
                    </div>
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
              className="h-[30px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40 transition-colors">
              ←
            </button>
            <span className="h-[30px] px-3 text-xs flex items-center text-[var(--text-primary)] font-medium">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="h-[30px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40 transition-colors">
              →
            </button>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={closeTask}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        onOpenFullPage={openFullPage}
      />

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
