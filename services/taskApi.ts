import { api } from './api';
import {
  WfTask, WfTaskStatus, TaskComment, TaskActivityLog, TaskAssignee, Department, WorkloadStats,
} from '../types';

export interface TaskListParams {
  page?: number;
  limit?: number;
  sort_by?: 'priority' | 'deadline' | 'created_at' | 'updated_at';
  sort_dir?: 'asc' | 'desc';
  search?: string;
  status?: string;
  priority?: string;
  project_id?: string;
  department_id?: string;
  assignee_id?: string;
  deadline_from?: string;
  deadline_to?: string;
  is_overdue?: boolean;
}

export interface TaskListResult {
  data: WfTask[];
  pagination: { total: number; page: number; limit: number };
  filters_applied?: Record<string, unknown>;
}

export interface ActivityResult {
  data: TaskActivityLog[];
  pagination: { total: number; page: number; limit: number };
}

export const taskApi = {
  list(params: TaskListParams = {}): Promise<TaskListResult> {
    const q = new URLSearchParams();
    if (params.page)          q.set('page', String(params.page));
    if (params.limit)         q.set('limit', String(params.limit));
    if (params.sort_by)       q.set('sort_by', params.sort_by);
    if (params.sort_dir)      q.set('sort_dir', params.sort_dir);
    if (params.search)        q.set('search', params.search);
    if (params.status)        q.set('status', params.status);
    if (params.priority)      q.set('priority', params.priority);
    if (params.project_id)    q.set('project_id', params.project_id);
    if (params.department_id) q.set('department_id', params.department_id);
    if (params.assignee_id)   q.set('assignee_id', params.assignee_id);
    if (params.deadline_from) q.set('deadline_from', params.deadline_from);
    if (params.deadline_to)   q.set('deadline_to', params.deadline_to);
    if (params.is_overdue !== undefined) q.set('is_overdue', String(params.is_overdue));
    return api.get<TaskListResult>(`/api/tasks?${q.toString()}`);
  },

  get(id: string): Promise<WfTask> {
    return api.get<WfTask>(`/api/tasks/${id}`);
  },

  create(data: Partial<WfTask> & { title: string }): Promise<WfTask> {
    return api.post<WfTask>('/api/tasks', data);
  },

  update(id: string, data: Partial<WfTask>): Promise<WfTask> {
    return api.patch<WfTask>(`/api/tasks/${id}`, data);
  },

  delete(id: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/api/tasks/${id}`);
  },

  changeStatus(id: string, status: WfTaskStatus, extra?: {
    actual_hours?: number;
    completion_note?: string;
  }): Promise<WfTask> {
    return api.patch<WfTask>(`/api/tasks/${id}/status`, { status, ...extra });
  },

  assign(id: string, userIds: string[], primaryUserId?: string, dueNote?: string): Promise<{ assignees: TaskAssignee[] }> {
    return api.post<{ assignees: TaskAssignee[] }>(`/api/tasks/${id}/assign`, {
      user_ids: userIds,
      ...(primaryUserId ? { primary_user_id: primaryUserId } : {}),
      ...(dueNote ? { due_note: dueNote } : {}),
    });
  },

  unassign(id: string, userId: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/api/tasks/${id}/assign/${userId}`);
  },

  getComments(id: string): Promise<{ data: TaskComment[] }> {
    return api.get<{ data: TaskComment[] }>(`/api/tasks/${id}/comments`);
  },

  createComment(id: string, content: string): Promise<TaskComment> {
    return api.post<TaskComment>(`/api/tasks/${id}/comments`, { content });
  },

  updateComment(taskId: string, commentId: string, content: string): Promise<TaskComment> {
    return api.patch<TaskComment>(`/api/tasks/${taskId}/comments/${commentId}`, { content });
  },

  deleteComment(taskId: string, commentId: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/api/tasks/${taskId}/comments/${commentId}`);
  },

  getActivity(id: string, limit = 20, page = 1): Promise<ActivityResult> {
    return api.get<ActivityResult>(`/api/tasks/${id}/activity?limit=${limit}&page=${page}`);
  },

  bulkUpdateStatus(ids: string[], status: WfTaskStatus): Promise<{ updated: number }> {
    return api.post<{ updated: number }>('/api/tasks/bulk/status', { ids, status });
  },

  bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return api.post<{ deleted: number }>('/api/tasks/bulk/delete', { ids });
  },

  getDepartments(): Promise<{ data: Department[] }> {
    return api.get<{ data: Department[] }>('/api/departments');
  },

  getUserWorkload(userId: string): Promise<WorkloadStats> {
    return api.get<WorkloadStats>(`/api/users/${userId}/workload`);
  },

  searchUsers(search: string, pageSize = 6): Promise<{ data: { id: string; name: string; email?: string }[] }> {
    return api.get<{ data: { id: string; name: string; email?: string }[] }>('/api/users', { search, pageSize });
  },
};
