import React from 'react';
import { WfTaskStatus, TaskPriority, TaskAssignee } from '../../types';
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT,
  formatDeadlineRelative,
} from '../../utils/taskUtils';

export function StatusBadge({
  status,
  size = 'sm',
}: { status: WfTaskStatus; size?: 'xs' | 'sm' }) {
  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`${sizeClass} rounded-lg font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({
  priority,
  variant = 'badge',
}: { priority: TaskPriority; variant?: 'badge' | 'dot' }) {
  if (variant === 'dot') {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[priority]}`} />
        <span className="text-xs text-[var(--text-secondary)]">{PRIORITY_LABELS[priority]}</span>
      </div>
    );
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${PRIORITY_COLORS[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DeadlineTag({
  deadline,
  isOverdue,
  daysUntilDeadline,
  short = false,
}: {
  deadline: string | null | undefined;
  isOverdue: boolean;
  daysUntilDeadline: number | null;
  short?: boolean;
}) {
  if (!deadline) return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
  const rel = formatDeadlineRelative(deadline, isOverdue, daysUntilDeadline);
  const dateStr = deadline.toString().split('T')[0];
  return (
    <div>
      {!short && (
        <span className={`text-xs ${isOverdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
          {isOverdue ? '⚠ ' : ''}{dateStr}
        </span>
      )}
      {rel && (
        <div className={`text-[10px] ${short ? 'text-xs' : 'mt-0.5'} font-medium ${isOverdue ? 'text-rose-400' : 'text-[var(--text-tertiary)]'}`}>
          {rel}
        </div>
      )}
    </div>
  );
}

const AVATAR_SIZE_PX: Record<number, number> = { 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 };

export function AvatarStack({
  assignees,
  max = 3,
  size = 6,
}: {
  assignees: TaskAssignee[];
  max?: number;
  size?: number;
}) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-xs text-[var(--text-tertiary)]">Chưa giao</span>;
  }
  const px = AVATAR_SIZE_PX[size] ?? 24;
  const visible = assignees.slice(0, max);
  const rest = assignees.length - max;
  return (
    <div className="flex items-center gap-0.5">
      {visible.map(a => (
        <div
          key={a.id}
          title={a.name}
          style={{ width: px, height: px }}
          className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-white dark:border-slate-700 flex-shrink-0"
        >
          {a.name?.charAt(0).toUpperCase()}
        </div>
      ))}
      {rest > 0 && (
        <span className="text-[10px] text-[var(--text-tertiary)] ml-0.5">+{rest}</span>
      )}
    </div>
  );
}

export function TaskSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-0 divide-y divide-[var(--glass-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5">
          <div className="w-4 h-4 bg-[var(--glass-surface-hover)] rounded" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3.5 bg-[var(--glass-surface-hover)] rounded-full w-3/4" />
            <div className="h-2.5 bg-[var(--glass-surface-hover)] rounded-full w-1/3" />
          </div>
          <div className="hidden sm:block h-5 w-16 bg-[var(--glass-surface-hover)] rounded-lg" />
          <div className="hidden md:block h-5 w-14 bg-[var(--glass-surface-hover)] rounded-lg" />
          <div className="hidden lg:block h-4 w-20 bg-[var(--glass-surface-hover)] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-[var(--glass-border)]">
        <div className="h-7 bg-[var(--glass-surface-hover)] rounded-xl w-2/3" />
      </div>
      <div className="flex-1 flex p-6 gap-6">
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-[var(--glass-surface-hover)] rounded-xl w-full" />
          <div className="h-32 bg-[var(--glass-surface-hover)] rounded-2xl w-full" />
          <div className="h-24 bg-[var(--glass-surface-hover)] rounded-2xl w-full" />
          <div className="space-y-2">
            <div className="h-4 bg-[var(--glass-surface-hover)] rounded w-full" />
            <div className="h-4 bg-[var(--glass-surface-hover)] rounded w-5/6" />
            <div className="h-4 bg-[var(--glass-surface-hover)] rounded w-4/6" />
          </div>
        </div>
        <div className="w-72 border-l border-[var(--glass-border)] pl-4 space-y-3">
          <div className="h-4 bg-[var(--glass-surface-hover)] rounded w-3/4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--glass-surface-hover)] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--glass-surface-hover)] rounded w-full" />
                <div className="h-2.5 bg-[var(--glass-surface-hover)] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
