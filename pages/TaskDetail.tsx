import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, AlertTriangle, ArrowLeft, Edit3, Save, X,
  Flag, Calendar, Tag, Clock, User2, MessageSquare, Activity,
  Send, CheckCircle2, Ban, RotateCcw, Plus, Search, Trash2,
  Star, XCircle, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import {
  WfTask, WfTaskStatus, TaskPriority, TaskCategory,
  TaskComment, TaskActivityLog, TaskAssignee, Department, WorkloadStats
} from '../types';
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
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200',
  low: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 border-teal-200',
};
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  sales: 'Kinh doanh', legal: 'Pháp lý', marketing: 'Marketing',
  site_visit: 'Đi thực địa', customer_care: 'CSKH', finance: 'Tài chính',
  construction: 'Xây dựng', admin: 'Hành chính', other: 'Khác',
};
const VALID_TRANSITIONS: Record<WfTaskStatus, WfTaskStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['review', 'todo', 'cancelled'],
  review: ['done', 'in_progress'],
  done: [],
  cancelled: ['todo'],
};

function getTaskIdFromHash(): string | null {
  const hash = window.location.hash.slice(1);
  const parts = hash.split('/').filter(Boolean);
  return parts[0] === ROUTES.TASK_DETAIL && parts.length > 1 ? parts[1] : null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  return (
    <div style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-white dark:border-slate-700 flex-shrink-0">
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

function WorkloadBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-rose-500' : score >= 50 ? 'text-amber-500' : 'text-emerald-500';
  const label = score >= 80 ? 'Quá tải' : score >= 50 ? 'Bận' : 'Ổn';
  return <span className={`text-[10px] font-semibold ${color}`}>{label} ({score}%)</span>;
}

interface SimpleUser { id: string; name: string; email?: string; }

export function TaskDetail() {
  const [taskId, setTaskId] = useState<string | null>(getTaskIdFromHash);
  const [task, setTask] = useState<WfTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  const [editingMeta, setEditingMeta] = useState(false);
  const [editMeta, setEditMeta] = useState<Partial<WfTask>>({});
  const [savingMeta, setSavingMeta] = useState(false);

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ status: WfTaskStatus } | null>(null);
  const [actualHours, setActualHours] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelNoteError, setCancelNoteError] = useState('');

  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [userResults, setUserResults] = useState<SimpleUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [workloads, setWorkloads] = useState<Record<string, WorkloadStats>>({});
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [removingAssigneeId, setRemovingAssigneeId] = useState<string | null>(null);

  const commentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const userPickerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [taskRes, commentsRes, activityRes] = await Promise.all([
        api.get<WfTask>(`/api/tasks/${id}`),
        api.get<{ data: TaskComment[] }>(`/api/tasks/${id}/comments`),
        api.get<{ data: TaskActivityLog[] }>(`/api/tasks/${id}/activity?limit=50`),
      ]);
      setTask(taskRes);
      setComments(commentsRes.data || []);
      setActivity(activityRes.data || []);
    } catch {
      setError('Không thể tải chi tiết công việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get<{ data: Department[] }>('/api/departments').then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      const id = getTaskIdFromHash();
      setTaskId(id);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    if (taskId) load(taskId);
  }, [taskId, load]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const goBack = () => {
    window.location.hash = `#/${ROUTES.TASKS}`;
  };

  const saveTitle = async () => {
    if (!task || !editTitle.trim() || editTitle.trim() === task.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}`, { title: editTitle.trim() });
      setTask(updated);
      setEditingTitle(false);
    } catch {
      alert('Không thể lưu tiêu đề');
    } finally {
      setSavingTitle(false);
    }
  };

  const saveDesc = async () => {
    if (!task) { setEditingDesc(false); return; }
    setSavingDesc(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}`, { description: editDesc.trim() || null });
      setTask(updated);
      setEditingDesc(false);
    } catch {
      alert('Không thể lưu mô tả');
    } finally {
      setSavingDesc(false);
    }
  };

  const saveMeta = async () => {
    if (!task) return;
    setSavingMeta(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}`, editMeta);
      setTask(updated);
      setEditingMeta(false);
    } catch {
      alert('Không thể lưu thông tin');
    } finally {
      setSavingMeta(false);
    }
  };

  const initiateStatusChange = (status: WfTaskStatus) => {
    if (status === 'done' || status === 'cancelled') {
      setStatusConfirm({ status });
    } else {
      changeStatus(status);
    }
  };

  const changeStatus = async (newStatus: WfTaskStatus, extraData?: Record<string, unknown>) => {
    if (!task) return;
    setChangingStatus(true);
    setStatusConfirm(null);
    try {
      const body: Record<string, unknown> = { status: newStatus, ...extraData };
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}/status`, body);
      setTask(updated);
      const newAct = await api.get<{ data: TaskActivityLog[] }>(`/api/tasks/${task.id}/activity?limit=50`);
      setActivity(newAct.data || []);
      setActualHours('');
      setCompletionNote('');
      setCancelNote('');
      setCancelNoteError('');
    } catch (e: any) {
      alert(e?.message || 'Không thể đổi trạng thái');
    } finally {
      setChangingStatus(false);
    }
  };

  const confirmStatusChange = () => {
    if (!statusConfirm) return;
    if (statusConfirm.status === 'cancelled' && !cancelNote.trim()) {
      setCancelNoteError('Lý do hủy là bắt buộc');
      return;
    }
    const extraData: Record<string, unknown> = {};
    if (statusConfirm.status === 'done') {
      if (actualHours) extraData.actual_hours = parseFloat(actualHours);
      if (completionNote) extraData.completion_note = completionNote;
    }
    if (statusConfirm.status === 'cancelled') {
      extraData.completion_note = cancelNote.trim();
    }
    changeStatus(statusConfirm.status, extraData);
  };

  const sendComment = async () => {
    if (!task || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const comment = await api.post<TaskComment>(`/api/tasks/${task.id}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch {
      alert('Không thể gửi bình luận');
    } finally {
      setSendingComment(false);
    }
  };

  const saveComment = async (commentId: string) => {
    if (!task || !editCommentText.trim()) return;
    try {
      const updated = await api.patch<TaskComment>(`/api/tasks/${task.id}/comments/${commentId}`, { content: editCommentText.trim() });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: updated.content } : c));
      setEditingCommentId(null);
    } catch {
      alert('Không thể cập nhật bình luận');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!task || !confirm('Xóa bình luận này?')) return;
    setDeletingCommentId(commentId);
    try {
      await api.delete(`/api/tasks/${task.id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      alert('Không thể xóa bình luận');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUserResults([]); return; }
    setSearchingUsers(true);
    try {
      const r = await api.get<{ data: SimpleUser[] }>(`/api/users?search=${encodeURIComponent(q)}&pageSize=8`);
      setUserResults(r.data || []);
    } catch {
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(assigneeSearch), 300);
    return () => clearTimeout(t);
  }, [assigneeSearch, searchUsers]);

  const fetchWorkload = async (userId: string) => {
    if (workloads[userId]) return;
    try {
      const w = await api.get<WorkloadStats>(`/api/users/${userId}/workload`);
      setWorkloads(prev => ({ ...prev, [userId]: w }));
    } catch {}
  };

  const addAssignee = async (user: SimpleUser) => {
    if (!task) return;
    const alreadyAssigned = task.assignees?.some(a => a.id === user.id);
    if (alreadyAssigned) return;
    setAddingAssignee(true);
    try {
      const res = await api.post<{ assignees: TaskAssignee[] }>(`/api/tasks/${task.id}/assign`, {
        user_ids: [user.id],
      });
      setTask(prev => prev ? { ...prev, assignees: res.assignees || [] } : prev);
      setAssigneeSearch('');
      setUserResults([]);
      setUserPickerOpen(false);
    } catch (e: any) {
      alert(e?.message || 'Không thể giao việc');
    } finally {
      setAddingAssignee(false);
    }
  };

  const removeAssignee = async (userId: string) => {
    if (!task || !confirm('Hủy giao việc cho nhân viên này?')) return;
    setRemovingAssigneeId(userId);
    try {
      await api.delete(`/api/tasks/${task.id}/assign/${userId}`);
      setTask(prev => prev ? { ...prev, assignees: prev.assignees?.filter(a => a.id !== userId) || [] } : prev);
    } catch (e: any) {
      alert(e?.message || 'Không thể hủy giao việc');
    } finally {
      setRemovingAssigneeId(null);
    }
  };

  if (!taskId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 animate-enter">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <p className="text-[var(--text-secondary)]">Không tìm thấy công việc</p>
        <button onClick={goBack} className="flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium">
          <ArrowLeft size={14} /> Quay lại danh sách
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center animate-enter">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 animate-enter">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-[var(--text-secondary)]">{error || 'Không tìm thấy công việc'}</p>
        <div className="flex gap-3">
          <button onClick={() => taskId && load(taskId)} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
          <button onClick={goBack} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-1">
            <ArrowLeft size={13} /> Danh sách
          </button>
        </div>
      </div>
    );
  }

  const transitions = VALID_TRANSITIONS[task.status];

  return (
    <div className="h-full flex flex-col overflow-hidden animate-enter">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 border-b border-[var(--glass-border)] flex-shrink-0">
        <button onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={15} /> Công việc
        </button>
        <span className="text-[var(--text-tertiary)]">/</span>
        <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-xs">{task.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
          {task.is_overdue && <span className="text-xs text-rose-500 font-semibold">⚠ Quá hạn</span>}
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left column — 70% */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 space-y-6 min-w-0">

          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="flex gap-2 items-start">
                <input
                  ref={titleRef}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  autoFocus
                  className="flex-1 text-2xl font-bold bg-[var(--glass-surface-hover)] border border-indigo-400 rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <div className="flex gap-1.5 mt-1 flex-shrink-0">
                  <button onClick={saveTitle} disabled={savingTitle}
                    className="h-9 px-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50">
                    {savingTitle ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  </button>
                  <button onClick={() => setEditingTitle(false)}
                    className="h-9 px-3 border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 cursor-pointer" onClick={() => { setEditTitle(task.title); setEditingTitle(true); }}>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight flex-1">{task.title}</h1>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 rounded-lg text-[var(--text-tertiary)] hover:text-indigo-500 hover:bg-[var(--glass-surface-hover)] flex-shrink-0">
                  <Edit3 size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="bg-[var(--glass-surface-hover)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Thông tin</h3>
              {!editingMeta ? (
                <button onClick={() => { setEditMeta({ priority: task.priority, deadline: task.deadline?.toString().split('T')[0], estimated_hours: task.estimated_hours, category: task.category, department_id: task.department_id }); setEditingMeta(true); }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1">
                  <Edit3 size={11} /> Sửa
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingMeta(false)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">Hủy</button>
                  <button onClick={saveMeta} disabled={savingMeta} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">
                    {savingMeta ? <Loader2 size={10} className="animate-spin" /> : <Save size={11} />} Lưu
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Priority */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><Flag size={10} /> Ưu tiên</label>
                {editingMeta ? (
                  <select value={editMeta.priority || 'medium'} onChange={e => setEditMeta(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="w-full h-[32px] text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none">
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                ) : (
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-md border font-medium ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                )}
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><Calendar size={10} /> Deadline</label>
                {editingMeta ? (
                  <input type="date" value={editMeta.deadline?.toString().split('T')[0] || ''} onChange={e => setEditMeta(p => ({ ...p, deadline: e.target.value }))}
                    className="w-full h-[32px] text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none" />
                ) : (
                  <span className={`text-sm ${task.is_overdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                    {task.deadline ? task.deadline.toString().split('T')[0] : '—'}
                  </span>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><Tag size={10} /> Danh mục</label>
                {editingMeta ? (
                  <select value={editMeta.category || ''} onChange={e => setEditMeta(p => ({ ...p, category: e.target.value as TaskCategory || undefined }))}
                    className="w-full h-[32px] text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none">
                    <option value="">Chưa chọn</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">{task.category ? CATEGORY_LABELS[task.category] : '—'}</span>
                )}
              </div>

              {/* Hours */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><Clock size={10} /> Giờ ước tính</label>
                {editingMeta ? (
                  <input type="number" min="0.5" step="0.5" value={editMeta.estimated_hours || ''} onChange={e => setEditMeta(p => ({ ...p, estimated_hours: parseFloat(e.target.value) || undefined }))}
                    className="w-full h-[32px] text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none" />
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">{task.estimated_hours ? `${task.estimated_hours}h` : '—'}</span>
                )}
              </div>

              {/* Department */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><User2 size={10} /> Phòng ban</label>
                {editingMeta ? (
                  <select value={editMeta.department_id || ''} onChange={e => setEditMeta(p => ({ ...p, department_id: e.target.value || undefined }))}
                    className="w-full h-[32px] text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none">
                    <option value="">Chưa chọn</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">{task.department_name || '—'}</span>
                )}
              </div>

              {/* Project */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Dự án</label>
                <span className="text-sm text-[var(--text-secondary)]">{task.project_name || '—'}</span>
              </div>
            </div>

            {task.actual_hours && (
              <div className="mt-3 pt-3 border-t border-[var(--glass-border)] flex gap-4 text-xs text-[var(--text-tertiary)]">
                <span>Thực tế: <strong className="text-[var(--text-secondary)]">{task.actual_hours}h</strong></span>
                {task.completion_note && <span>Ghi chú: <em className="text-[var(--text-secondary)]">{task.completion_note}</em></span>}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Mô tả</h3>
              {!editingDesc && (
                <button onClick={() => { setEditDesc(task.description || ''); setEditingDesc(true); }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1">
                  <Edit3 size={11} /> {task.description ? 'Sửa' : 'Thêm mô tả'}
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  autoFocus
                  placeholder="Nhập mô tả công việc..."
                  className="w-full text-sm bg-[var(--glass-surface-hover)] border border-indigo-400 rounded-xl p-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingDesc(false)} className="h-8 px-3 text-xs border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">Hủy</button>
                  <button onClick={saveDesc} disabled={savingDesc} className="h-8 px-3 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50">
                    {savingDesc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Lưu
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                {task.description || <span className="text-[var(--text-tertiary)] italic">Chưa có mô tả. Nhấn "Thêm mô tả" để viết.</span>}
              </p>
            )}
          </div>

          {/* Status Workflow */}
          {transitions.length > 0 && (
            <div className="bg-[var(--glass-surface-hover)] rounded-2xl p-4 border border-[var(--glass-border)]">
              <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">Chuyển trạng thái</h3>
              <div className="flex flex-wrap gap-2">
                {transitions.map(s => (
                  <button key={s} onClick={() => initiateStatusChange(s)} disabled={changingStatus}
                    className={`text-sm px-4 py-2 rounded-xl border font-medium transition-all disabled:opacity-50 flex items-center gap-2 ${
                      s === 'done' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300' :
                      s === 'cancelled' ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-700 dark:text-rose-400' :
                      'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:border-indigo-300 hover:text-indigo-600'
                    }`}>
                    {changingStatus ? <Loader2 size={14} className="animate-spin" /> :
                      s === 'done' ? <CheckCircle2 size={14} /> :
                      s === 'cancelled' ? <Ban size={14} /> :
                      s === 'todo' ? <RotateCcw size={14} /> : null}
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignees */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Người thực hiện</h3>

            {task.assignees?.length > 0 && (
              <div className="space-y-2 mb-3">
                {task.assignees.map(a => (
                  <div key={a.id}
                    onMouseEnter={() => fetchWorkload(a.id)}
                    className="flex items-center gap-3 bg-[var(--glass-surface-hover)] rounded-xl px-3 py-2 border border-[var(--glass-border)] group">
                    <Avatar name={a.name} size={8} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{a.name}</span>
                        {a.is_primary && (
                          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5 flex-shrink-0">
                            <Star size={9} /> Chính
                          </span>
                        )}
                      </div>
                      {workloads[a.id] && <WorkloadBadge score={workloads[a.id].workload_score} />}
                      {a.due_note && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{a.due_note}</p>}
                    </div>
                    <button
                      onClick={() => removeAssignee(a.id)}
                      disabled={removingAssigneeId === a.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex-shrink-0">
                      {removingAssigneeId === a.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add assignee */}
            <div className="relative" ref={userPickerRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <input
                  value={assigneeSearch}
                  onChange={e => { setAssigneeSearch(e.target.value); setUserPickerOpen(true); }}
                  onFocus={() => setUserPickerOpen(true)}
                  placeholder="Tìm và thêm nhân viên..."
                  className="w-full h-[36px] pl-9 pr-3 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              {userPickerOpen && (userResults.length > 0 || searchingUsers) && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-20 overflow-hidden">
                  {searchingUsers ? (
                    <div className="flex items-center justify-center p-4"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>
                  ) : userResults.map(u => {
                    const alreadyAssigned = task.assignees?.some(a => a.id === u.id);
                    return (
                      <button key={u.id} type="button"
                        disabled={alreadyAssigned || addingAssignee}
                        onClick={() => addAssignee(u)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${alreadyAssigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--glass-surface-hover)]'}`}>
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 flex-shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{u.name}</p>
                          {u.email && <p className="text-[11px] text-[var(--text-tertiary)] truncate">{u.email}</p>}
                        </div>
                        {alreadyAssigned ? (
                          <span className="text-xs text-emerald-500 font-semibold flex-shrink-0">✓ Đã giao</span>
                        ) : (
                          <span className="text-xs text-indigo-500 font-medium flex-shrink-0 flex items-center gap-0.5">
                            <Plus size={11} /> Thêm
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MessageSquare size={15} className="text-[var(--text-tertiary)]" />
              Bình luận
              {comments.length > 0 && <span className="text-xs text-[var(--text-tertiary)] font-normal">({comments.length})</span>}
            </h3>

            <div className="space-y-4 mb-4">
              {comments.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có bình luận nào</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3 group">
                  <Avatar name={c.user_name} size={8} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{c.user_name}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{timeAgo(c.created_at)}</span>
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}
                          className="text-xs text-[var(--text-tertiary)] hover:text-indigo-500 p-1 rounded">
                          <Edit3 size={11} />
                        </button>
                        <button onClick={() => deleteComment(c.id)} disabled={deletingCommentId === c.id}
                          className="text-xs text-[var(--text-tertiary)] hover:text-rose-500 p-1 rounded">
                          {deletingCommentId === c.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          rows={2}
                          value={editCommentText}
                          onChange={e => setEditCommentText(e.target.value)}
                          className="w-full text-sm bg-[var(--glass-surface-hover)] border border-indigo-400 rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingCommentId(null)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">Hủy</button>
                          <button onClick={() => saveComment(c.id)} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold">Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--glass-surface-hover)] rounded-xl p-3">{c.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* New comment */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={14} className="text-indigo-500" />
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  ref={commentRef}
                  rows={2}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment(); }}
                  placeholder="Thêm bình luận... (Ctrl+Enter để gửi)"
                  className="w-full text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl p-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                />
                <div className="flex justify-end">
                  <button onClick={sendComment} disabled={sendingComment || !newComment.trim()}
                    className="h-8 px-4 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Gửi
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Created info */}
          <div className="text-xs text-[var(--text-tertiary)] border-t border-[var(--glass-border)] pt-4">
            Tạo bởi <span className="font-medium text-[var(--text-secondary)]">{task.created_by_name || 'Hệ thống'}</span>
            {' '}· {new Date(task.created_at).toLocaleDateString('vi-VN')}
            {' '}· Cập nhật: {new Date(task.updated_at).toLocaleDateString('vi-VN')}
          </div>
        </div>

        {/* Right column — 30% */}
        <div className="w-72 xl:w-80 border-l border-[var(--glass-border)] overflow-y-auto no-scrollbar p-4 flex-shrink-0">
          <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-4 flex items-center gap-2">
            <Activity size={12} /> Lịch sử hoạt động
          </h3>

          {activity.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-6">Chưa có hoạt động</p>
          )}

          <div className="space-y-3">
            {activity.map((log, i) => (
              <div key={log.id} className="flex gap-2.5">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  </div>
                  {i < activity.length - 1 && <div className="w-px flex-1 bg-[var(--glass-border)] mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {log.user_name && <span className="font-semibold text-[var(--text-primary)]">{log.user_name} </span>}
                    {log.detail || log.action}
                  </p>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{timeAgo(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Status Confirm Popup */}
      {statusConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStatusConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--glass-border)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">
                {statusConfirm.status === 'done' ? 'Hoàn thành công việc' : 'Hủy công việc'}
              </h3>
              <button onClick={() => setStatusConfirm(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)]">
                <X size={14} />
              </button>
            </div>

            {statusConfirm.status === 'done' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">Giờ thực tế (tùy chọn)</label>
                  <input type="number" min="0.5" step="0.5" value={actualHours} onChange={e => setActualHours(e.target.value)}
                    placeholder="Số giờ thực tế..."
                    className="w-full h-[36px] px-3 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">Ghi chú hoàn thành (tùy chọn)</label>
                  <textarea rows={2} value={completionNote} onChange={e => setCompletionNote(e.target.value)}
                    placeholder="Ghi chú kết quả..."
                    className="w-full px-3 py-2 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
                </div>
              </div>
            )}

            {statusConfirm.status === 'cancelled' && (
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Lý do hủy <span className="text-rose-500">*</span>
                </label>
                <textarea rows={2} value={cancelNote} onChange={e => { setCancelNote(e.target.value); setCancelNoteError(''); }}
                  placeholder="Nhập lý do hủy công việc (bắt buộc)..."
                  className={`w-full px-3 py-2 text-sm bg-[var(--glass-surface-hover)] border rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none ${cancelNoteError ? 'border-rose-400' : 'border-[var(--glass-border)]'}`} />
                {cancelNoteError && <p className="text-xs text-rose-500 mt-1">{cancelNoteError}</p>}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setStatusConfirm(null)} className="h-9 px-4 text-sm border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">Hủy bỏ</button>
              <button onClick={confirmStatusChange}
                className={`h-9 px-4 text-sm font-semibold rounded-xl text-white flex items-center gap-1.5 transition-colors ${
                  statusConfirm.status === 'done' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}>
                {statusConfirm.status === 'done' ? <><CheckCircle2 size={14} /> Xác nhận hoàn thành</> : <><Ban size={14} /> Xác nhận hủy</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
