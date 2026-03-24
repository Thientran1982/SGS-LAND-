import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Loader2, AlertTriangle, RefreshCw, Search, X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { WfTask, WfTaskStatus, TaskPriority } from '../types';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CreateTaskModal } from '../components/CreateTaskModal';

const PRIORITY_LABELS_FULL: Record<TaskPriority, string> = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
type Toast = { id: number; msg: string; type: 'success' | 'error' };

const COLUMNS: { id: WfTaskStatus; label: string; color: string; headerColor: string; dot: string }[] = [
  { id: 'todo',        label: 'Chờ xử lý',      color: 'bg-slate-50 dark:bg-slate-800/30',       headerColor: 'bg-slate-100 dark:bg-slate-800/60',       dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'Đang thực hiện',  color: 'bg-indigo-50/60 dark:bg-indigo-900/10',  headerColor: 'bg-indigo-100/80 dark:bg-indigo-900/30',  dot: 'bg-indigo-500' },
  { id: 'review',      label: 'Chờ duyệt',       color: 'bg-amber-50/60 dark:bg-amber-900/10',    headerColor: 'bg-amber-100/80 dark:bg-amber-900/30',    dot: 'bg-amber-500' },
  { id: 'done',        label: 'Hoàn thành',       color: 'bg-emerald-50/60 dark:bg-emerald-900/10', headerColor: 'bg-emerald-100/80 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
  { id: 'cancelled',   label: 'Đã hủy',           color: 'bg-rose-50/40 dark:bg-rose-900/10',      headerColor: 'bg-rose-100/80 dark:bg-rose-900/30',      dot: 'bg-rose-400' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
  high:   'text-orange-600 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  low:    'text-teal-600 bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',
};
const PRIORITY_LABELS: Record<string, string> = { urgent: 'Khẩn', high: 'Cao', medium: 'TB', low: 'Thấp' };

// ─── Draggable Task Card ──────────────────────────────────────────────────────
function TaskCard({
  task, overlay = false, onClick,
}: { task: WfTask; overlay?: boolean; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  const style = overlay ? undefined : {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const urgencyBorder = task.is_overdue
    ? 'border-rose-300 dark:border-rose-800'
    : task.urgency_level === 'critical'
    ? 'border-amber-300 dark:border-amber-800'
    : 'border-[var(--glass-border)]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onClick={onClick}
      className={`bg-[var(--bg-surface)] rounded-xl border ${urgencyBorder} p-3 shadow-sm hover:shadow-md transition-shadow group select-none ${overlay ? 'shadow-xl rotate-1 scale-105' : ''}`}
    >
      {/* Priority + category */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.is_overdue && <span className="text-[10px] text-rose-500 font-semibold">⚠ Quá hạn</span>}
        {!task.is_overdue && task.urgency_level === 'critical' && <span className="text-[10px] text-amber-500 font-semibold">Sắp hết hạn</span>}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug mb-2.5">{task.title}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {task.assignees?.slice(0, 3).map(a => (
            <div key={a.id} title={a.name}
              className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[9px] font-bold text-indigo-600 border border-white dark:border-slate-700 flex-shrink-0">
              {a.name?.charAt(0).toUpperCase()}
            </div>
          ))}
          {(task.assignees?.length || 0) > 3 && (
            <span className="text-[10px] text-[var(--text-tertiary)]">+{task.assignees.length - 3}</span>
          )}
          {(task.assignees?.length || 0) === 0 && (
            <span className="text-[10px] text-[var(--text-tertiary)]">Chưa giao</span>
          )}
        </div>
        {task.deadline && (
          <span className={`text-[10px] ${task.is_overdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-tertiary)]'}`}>
            {task.deadline.toString().split('T')[0]}
          </span>
        )}
      </div>

      {task.comment_count != null && task.comment_count > 0 && (
        <div className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">💬 {task.comment_count}</div>
      )}
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────
function KanbanColumn({
  col, tasks, onCardClick,
}: { col: typeof COLUMNS[0]; tasks: WfTask[]; onCardClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className={`flex flex-col rounded-2xl border transition-colors ${col.color} ${isOver ? 'border-indigo-400 dark:border-indigo-500 shadow-md' : 'border-[var(--glass-border)]'}`}
      style={{ width: '272px', minWidth: '272px' }}>
      {/* Header */}
      <div className={`px-3 py-2.5 flex items-center justify-between ${col.headerColor} rounded-t-2xl`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="font-semibold text-sm text-[var(--text-primary)]">{col.label}</span>
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-surface)]/70 rounded-full w-6 h-6 flex items-center justify-center">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-2.5 space-y-2 no-scrollbar min-h-[120px] transition-colors ${isOver ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
        {tasks.length === 0 ? (
          <p className={`text-center text-xs py-8 transition-colors ${isOver ? 'text-indigo-400' : 'text-[var(--text-tertiary)]'}`}>
            {isOver ? 'Thả vào đây' : 'Không có công việc'}
          </p>
        ) : (
          tasks.map(t => (
            <TaskCard key={t.id} task={t} onClick={() => onCardClick(t.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Kanban Page ─────────────────────────────────────────────────────────
export function TaskKanban() {
  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<WfTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadTasks = useCallback(() => {
    setLoading(true);
    api.get<{ data: WfTask[] }>('/api/tasks?limit=200&sort_by=created_at')
      .then(r => setTasks(r.data || []))
      .catch(() => setError('Không thể tải công việc'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as WfTaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
    } catch (err) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
      showToast((err as { message?: string })?.message || 'Không thể đổi trạng thái. Đã hoàn tác.', 'error');
    }
  };

  const handleTaskUpdated = useCallback((updated: WfTask) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

  const handleTaskDeleted = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelectedTaskId(null);
  }, []);

  const handleTaskCreated = useCallback((task: WfTask) => {
    setTasks(prev => [task, ...prev]);
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter.length > 0 && !priorityFilter.includes(t.priority)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.assignees?.some(a => a.name.toLowerCase().includes(q)))) return false;
    }
    return true;
  });

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTasks.filter(t => t.status === col.id);
    return acc;
  }, {} as Record<WfTaskStatus, WfTask[]>);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-[var(--text-secondary)]">{error}</p>
      <button onClick={loadTasks} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden animate-enter">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] flex-shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">Kanban Board</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {filteredTasks.length}{tasks.length !== filteredTasks.length ? `/${tasks.length}` : ''} công việc
              {tasks.filter(t => t.is_overdue).length > 0 && (
                <span className="text-rose-500 ml-1">· ⚠ {tasks.filter(t => t.is_overdue).length} quá hạn</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadTasks} className="h-[32px] w-[32px] flex items-center justify-center border border-[var(--glass-border)] rounded-xl text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="h-[34px] px-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus size={15} /> Thêm
            </button>
          </div>
        </div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tiêu đề, người thực hiện..."
              className="w-full h-[32px] pl-8 pr-7 text-xs bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X size={12} />
              </button>
            )}
          </div>
          {ALL_PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex-shrink-0 ${priorityFilter.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {PRIORITY_LABELS_FULL[p]}
            </button>
          ))}
          {(search || priorityFilter.length > 0) && (
            <button onClick={() => { setSearch(''); setPriorityFilter([]); }}
              className="text-xs px-2 py-1 text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium flex-shrink-0">
              <X size={11} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-5">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={tasksByStatus[col.id] || []}
                onCardClick={id => setSelectedTaskId(id)}
              />
            ))}
          </div>

          {createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeTask ? <TaskCard task={activeTask} overlay /> : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {/* Toast Notifications */}
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
