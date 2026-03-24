import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { WfTask, WfTaskStatus } from '../types';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CreateTaskModal } from '../components/CreateTaskModal';

interface Props { onNavigate?: (route: string) => void; }

const COLUMNS: { id: WfTaskStatus; label: string; color: string; headerColor: string; dot: string }[] = [
  { id: 'todo',        label: 'Chờ xử lý',      color: 'bg-slate-50 dark:bg-slate-800/30',    headerColor: 'bg-slate-100 dark:bg-slate-800/60',    dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'Đang thực hiện',  color: 'bg-indigo-50/60 dark:bg-indigo-900/10', headerColor: 'bg-indigo-100/80 dark:bg-indigo-900/30', dot: 'bg-indigo-500' },
  { id: 'review',      label: 'Chờ duyệt',       color: 'bg-amber-50/60 dark:bg-amber-900/10',  headerColor: 'bg-amber-100/80 dark:bg-amber-900/30',  dot: 'bg-amber-500' },
  { id: 'done',        label: 'Hoàn thành',       color: 'bg-emerald-50/60 dark:bg-emerald-900/10', headerColor: 'bg-emerald-100/80 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
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
const _kanbanNavFallback = (r: string) => { window.location.hash = `#/${r}`; };
export function TaskKanban({ onNavigate: _onNav }: Props) {
  const onNavigate = _onNav ?? _kanbanNavFallback;
  const [tasks, setTasks] = useState<WfTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<WfTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
    } catch (e: any) {
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
      console.error('Status change failed:', e?.message);
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

  const kanbanCols = COLUMNS.filter(c => c.id !== 'done' || tasks.some(t => t.status === 'done'));
  const allCols = COLUMNS;
  const tasksByStatus = allCols.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
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
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-[var(--glass-border)] flex-shrink-0 gap-3">
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)]">Kanban Board</h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {tasks.length} công việc · {tasks.filter(t => t.is_overdue).length} quá hạn
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
    </div>
  );
}
