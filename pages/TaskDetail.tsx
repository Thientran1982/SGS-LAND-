import React from 'react';
import { TaskDetailContent } from '../components/TaskDetailContent';
import { ROUTES } from '../config/routes';
import { SeoHead } from '../components/SeoHead';
function getTaskIdFromPath(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === ROUTES.TASK_DETAIL && parts.length > 1) return parts[1];
  if (parts[0] === ROUTES.TASKS && parts.length > 1) return parts[1];
  return null;
}
export function TaskDetail() {
  const taskId = getTaskIdFromPath();
  if (!taskId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
        Không tìm thấy công việc
      </div>
    );
  }
  return (
  <>
  <SeoHead title="Chi Tiết Công Việc | SGS LAND" description="Xem và quản lý chi tiết công việc và nhiệm vụ trên SGS LAND." canonicalPath="/tasks" />
    <TaskDetailContent
      taskId={taskId}
      onBack={() => { window.location.hash = `#/${ROUTES.TASKS}`; }}
    />
  </>
  );
}