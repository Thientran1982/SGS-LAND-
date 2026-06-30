// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Task Management Module
// =======================================================

// =============================================================================
// 20. TASK MANAGEMENT MODULE
// =============================================================================
export type WfTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory =
    | 'sales' | 'legal' | 'marketing' | 'site_visit'
    | 'customer_care' | 'finance' | 'construction' | 'admin' | 'other';
export interface Department {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    created_at: ISOString;
    task_count?: number;
}
export interface TaskAssignee {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
    is_primary: boolean;
    assigned_at?: ISOString;
    due_note?: string;
}
export interface WfTask {
    id: string;
    tenant_id: string;
    title: string;
    description?: string;
    project_id?: string;
    project_name?: string;
    department_id?: string;
    department_name?: string;
    category?: TaskCategory;
    status: WfTaskStatus;
    priority: TaskPriority;
    deadline?: string;
    estimated_hours?: number;
    actual_hours?: number;
    completion_note?: string;
    created_by?: string;
    created_by_name?: string;
    created_at: ISOString;
    updated_at: ISOString;
    assignees: TaskAssignee[];
    comment_count?: number;
    is_overdue: boolean;
    days_until_deadline: number | null;
    urgency_level: 'normal' | 'warning' | 'critical' | 'overdue';
}
export interface TaskComment {
    id: string;
    tenant_id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    user_avatar?: string;
    content: string;
    created_at: ISOString;
    updated_at: ISOString;
}
export interface TaskActivityLog {
    id: string;
    tenant_id: string;
    task_id: string;
    user_id?: string;
    user_name?: string;
    user_avatar?: string;
    action: string;
    old_value?: Record<string, unknown>;
    new_value?: Record<string, unknown>;
    detail?: string;
    created_at: ISOString;
}
export interface WorkloadStats {
    user_id: string;
    name: string;
    department?: string;
    active_tasks: number;
    overdue_tasks: number;
    workload_score: number;
    completed_this_week?: number;
    completed_this_month?: number;
}
export interface TaskDashboardStats {
    overview: {
        total_tasks: number;
        todo: number;
        in_progress: number;
        review: number;
        done: number;
        cancelled: number;
        overdue_count: number;
        due_today_count: number;
        due_this_week_count: number;
    };
    completion_rate_today: number;
    completion_rate_week: number;
    by_priority: Record<TaskPriority, number>;
    by_category: Partial<Record<TaskCategory, number>>;
    by_project: Array<{
        project_id: string;
        name: string;
        total: number;
        done: number;
        overdue: number;
    }>;
    top_overdue_tasks: WfTask[];
    upcoming_deadlines: WfTask[];
    workload_by_user: WorkloadStats[];
}
export interface TaskListParams {
    status?: WfTaskStatus | WfTaskStatus[];
    priority?: TaskPriority | TaskPriority[];
    project_id?: string;
    department_id?: string;
    category?: TaskCategory;
    assignee_id?: string;
    created_by?: string;
    is_overdue?: boolean;
    deadline_from?: string;
    deadline_to?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort_by?: 'deadline' | 'priority' | 'created_at' | 'updated_at';
    sort_dir?: 'asc' | 'desc';
}