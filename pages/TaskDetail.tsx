import React from 'react';
import { TaskDetailContent } from '../components/TaskDetailContent';
import { ROUTES } from '../config/routes';

function getTaskIdFromHash(): string | null {
  const parts = window.location.hash.slice(1).split('/').filter(Boolean);
  if (parts[0] === ROUTES.TASK_DETAIL && parts.length > 1) return parts[1];
  if (parts[0] === ROUTES.TASKS && parts.length > 1) return parts[1];
  return null;
}

export function TaskDetail() {
  const taskId = getTaskIdFromHash();

  if (!taskId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
        Không tìm thấy công việc
      </div>
    );
  }

  return (
    <TaskDetailContent
      taskId={taskId}
      onBack={() => { window.location.hash = `#/${ROUTES.TASKS}`; }}
    />
  );
}
