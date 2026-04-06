import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, AlertTriangle, RefreshCw, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { WfTask, WfTaskStatus } from '../types';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TaskFilterBar, TaskFilters, EMPTY_FILTERS } from '../components/task/TaskFilterBar';
import { PriorityBadge, AvatarStack } from '../components/task/Badges';
import { CATEGORY_LABELS_SHORT, STATUS_LABELS, formatDeadlineRelative, isValidTransition } from '../utils/taskUtils';

type Toast = { id: number; msg: string; type: 'success' | 'error' };

const COLUMNS: { id: WfTaskStatus; label: string; color: string; headerColor: string; dot: string }[] = [
  { id: 'todo',        label: 'Chờ xử lý',      color: 'bg-slate-50 dark:bg-slate-800/30',       headerColor: 'bg-slate-100 dark:bg-slate-800/60',       dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'Đang thực hiện',  color: 'bg-indigo-50/60 dark:bg-indigo-900/10',  headerColor: 'bg-indigo-100/80 dark:bg-indigo-900/30',  dot: 'bg-indigo-500' },
  { id: 'review',      label: 'Chờ duyệt',       color: 'bg-amber-50/60 dark:bg-amber-900/10',    headerColor: 'bg-amber-100/80 dark:bg-amber-900/30',    dot: 'bg-amber-500' },
  { id: 'done',        label: 'Hoàn thành',       color: 'bg-emerald-50/60 dark:bg-emerald-900/10', headerColor: 'bg-emerald-100/80 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
  { id: 'cancelled',   label: 'Đã hủy',           color: 'bg-rose-50/40 dark:bg-rose-900/10',      headerColor: 'bg-rose-100/80 dark:bg-rose-900/30',      dot: 'bg-rose-400' },
];

function TaskCard({ task, overlay = false, onClick }: { task: WfTask; overlay?: boolean; onClick?: () => void }) {
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

  const rel = formatDeadlineRelative(task.deadline?.toString(), task.is_overdue, task.days_until_deadline);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onClick={onClick}
      data-task-card="true"
      className={`bg-[var(--bg-surface)] rounded-xl border ${urgencyBorder} p-3 shadow-sm hover:shadow-md transition-shadow select-none ${overlay ? 'shadow-xl rotate-1 scale-105' : ''}`}
    >
      <div className="flex items-center justify-between mb-2 gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} variant="badge" />
          {task.category && CATEGORY_LABELS_SHORT[task.category] && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-[var(--glass-border)] text-[var(--text-tertiary)] font-medium">
              {CATEGORY_LABELS_SHORT[task.category]}
            </span>
          )}
        </div>
        {task.is_overdue && <span className="text-[10px] text-rose-500 font-semibold">⚠ Quá hạn</span>}
        {!task.is_overdue && task.urgency_level === 'critical' && <span className="text-[10px] text-amber-500 font-semibold">Sắp hết hạn</span>}
      </div>

      <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug mb-2.5">{task.title}</p>

      <div className="flex items-center justify-between">
        <AvatarStack assignees={task.assignees || []} max={3} size={5} />
        {rel && (
          <span className={`text-[10px] font-medium ${task.is_overdue ? 'text-rose-500' : task.urgency_level === 'critical' ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
            {rel}
          </span>
        )}
      </div>

      <div className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">
        💬 {task.comment_count ?? 0}
      </div>
    </div>
  );
}

function KanbanColumn({ col, tasks, onCardClick }: { col: typeof COLUMNS[0]; tasks: WfTask[]; onCardClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className={`flex flex-col rounded-2xl border transition-colors ${col.color} ${isOver ? 'border-indigo-400 dark:border-indigo-500 shadow-md' : 'border-[var(--glass-border)]'}`}
      style={{ width: '272px', minWidth: '272px' }}>
      <div className={`px-3 py-2.5 flex items-center justify-between ${col.headerColor} rounded-t-2xl`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="font-semibold text-sm text-[var(--text-primary)]">{col.label}</span>
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-surface)]/70 rounded-full w-6 h-6 flex items-center justify-center">
          {tasks.length}
        </span>
      </div>
      <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-2.5 space-y-2 no-scrollbar min-h-[120px] transition-colors ${isOver ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
        {tasks.length === 0 ? (
          <p className={`text-center text-xs py-8 transition-colors ${isOver ? 'text-indigo-400' : 'text-[var(--text-tertiary)]'}`}>
            {isOver ? 'Thả vào đây' : 'Không có công việc'}
          </p>
        ) : tasks.map(t => (
          <TaskCard key={t.id} task={t} onClick={() => onCardClick(t.id)} />
        ))}
      </div>
    </div>
  );
}

export function TaskKanban() {
  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<WfTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragScrolling = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return;
      let target = e.target as HTMLElement | null;
      while (target && target !== el) {
        const oy = getComputedStyle(target).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && target.scrollHeight > target.clientHeight) return;
        target = target.parentElement;
      }
      if (e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scrollBoard = useCallback((delta: number) => {
    if (boardRef.current) {
      boardRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }, []);

  const onBoardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-card]')) return;
    dragScrolling.current = true;
    dragStartX.current = e.clientX;
    dragScrollLeft.current = boardRef.current?.scrollLeft ?? 0;
    e.currentTarget.style.cursor = 'grabbing';
    e.currentTarget.style.userSelect = 'none';
  }, []);

  const onBoardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragScrolling.current || !boardRef.current) return;
    const dx = e.clientX - dragStartX.current;
    boardRef.current.scrollLeft = dragScrollLeft.current - dx;
  }, []);

  const onBoardMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    dragScrolling.current = false;
    e.currentTarget.style.cursor = '';
    e.currentTarget.style.userSelect = '';
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
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
    setActiveTask(tasks.find(t => t.id === event.active.id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as WfTaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (!isValidTransition(task.status, newStatus)) {
      showToast(`Không thể chuyển từ "${task.status}" sang "${newStatus}"`, 'error');
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
      showToast(`Đã chuyển sang "${STATUS_LABELS[newStatus]}"`);
    } catch (err) {
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
    if (filters.priorityFilter.length > 0 && !filters.priorityFilter.includes(t.priority)) return false;
    if (filters.departmentId && t.department_id !== filters.departmentId) return false;
    if (filters.projectId && t.project_id !== filters.projectId) return false;
    if (filters.assigneeId && !(t.assignees?.some(a => a.id === filters.assigneeId))) return false;
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.assignees?.some(a => a.name.toLowerCase().includes(q)))) return false;
    }
    return true;
  });

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTasks.filter(t => t.status === col.id);
    return acc;
  }, {} as Record<WfTaskStatus, WfTask[]>);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          {COLUMNS.map((col, i) => (
            <div key={col.id} className={`w-[272px] rounded-2xl border border-[var(--glass-border)] overflow-hidden animate-pulse`} style={{ animationDelay: `${i * 100}ms` }}>
              <div className={`h-10 ${col.headerColor}`} />
              <div className="p-2.5 space-y-2">
                {Array.from({ length: i % 2 === 0 ? 3 : 2 }).map((_, j) => (
                  <div key={j} className="h-20 bg-[var(--glass-surface-hover)] rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
            <div className="flex items-center gap-1 border border-[var(--glass-border)] rounded-xl overflow-hidden">
              <button onClick={() => scrollBoard(-292)} title="Cuộn trái" className="h-[32px] w-[32px] flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronLeft size={16} />
              </button>
              <div className="w-px h-4 bg-[var(--glass-border)]" />
              <button onClick={() => scrollBoard(292)} title="Cuộn phải" className="h-[32px] w-[32px] flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <button onClick={loadTasks} className="h-[32px] w-[32px] flex items-center justify-center border border-[var(--glass-border)] rounded-xl text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="h-[34px] px-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus size={15} /> Thêm
            </button>
          </div>
        </div>
        <TaskFilterBar
          filters={filters}
          onChange={setFilters}
          showStatus={false}
          showPriority
          showDepartment
          showProject
          showAssignee
          compact
        />
      </div>

      <div
        ref={boardRef}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
        className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-5 min-w-0 cursor-grab"
      >
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full" style={{ minWidth: `${COLUMNS.length * 280}px`, width: 'max-content' }}>
            {COLUMNS.map(col => (
              <KanbanColumn key={col.id} col={col} tasks={tasksByStatus[col.id] || []} onCardClick={id => setSelectedTaskId(id)} />
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

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        onOpenFullPage={id => { setSelectedTaskId(null); window.location.hash = `#/tasks/${id}`; }}
      />
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={handleTaskCreated} />}

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
