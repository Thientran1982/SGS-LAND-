import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, AlertTriangle, Edit3, Save, Trash2,
  MessageSquare, Clock, User2, Calendar, Flag, Tag,
  ChevronDown, Send, CheckCircle2, RotateCcw, Ban
} from 'lucide-react';
import { api } from '../services/api';
import { WfTask, TaskComment, TaskActivityLog, WfTaskStatus, TaskPriority, TaskCategory, Department } from '../types';

const STATUS_LABELS: Record<WfTaskStatus, string> = {
  todo: 'Chờ xử lý', in_progress: 'Đang làm', review: 'Chờ duyệt',
  done: 'Hoàn thành', cancelled: 'Đã hủy',
};
const STATUS_COLORS: Record<WfTaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300',
  review: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400',
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

interface Props {
  taskId: string | null;
  onClose: () => void;
  onUpdated: (task: WfTask) => void;
  onDeleted?: (id: string) => void;
}

function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  return (
    <div className={`${sizeClass} rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-white dark:border-slate-700 flex-shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
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

export function TaskDetailModal({ taskId, onClose, onUpdated, onDeleted }: Props) {
  const [task, setTask] = useState<WfTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<WfTask>>({});
  const [saving, setSaving] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [deleting, setDeleting] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [taskRes, commentsRes, activityRes] = await Promise.all([
        api.get<WfTask>(`/api/tasks/${id}`),
        api.get<{ data: TaskComment[] }>(`/api/tasks/${id}/comments`),
        api.get<{ data: TaskActivityLog[] }>(`/api/tasks/${id}/activity`),
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
    if (!taskId) return;
    load(taskId);
    api.get<{ data: Department[] }>('/api/departments').then(r => setDepartments(r.data || [])).catch(() => {});
  }, [taskId, load]);

  useEffect(() => {
    if (!taskId) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [taskId, onClose]);

  const startEdit = () => {
    if (!task) return;
    setEditData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      deadline: task.deadline?.toString().split('T')[0],
      estimated_hours: task.estimated_hours,
      category: task.category,
      department_id: task.department_id,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}`, editData);
      setTask(updated);
      onUpdated(updated);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || 'Không thể lưu');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus: WfTaskStatus) => {
    if (!task) return;
    setStatusMenuOpen(false);
    setChangingStatus(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}/status`, { status: newStatus });
      setTask(updated);
      onUpdated(updated);
      const newAct: TaskActivityLog[] = await api.get<{ data: TaskActivityLog[] }>(`/api/tasks/${task.id}/activity`).then(r => r.data || []);
      setActivity(newAct);
    } catch (e: any) {
      alert(e?.message || 'Không thể đổi trạng thái');
    } finally {
      setChangingStatus(false);
    }
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

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/tasks/${task.id}`);
      onDeleted?.(task.id);
      onClose();
    } catch {
      alert('Không thể xóa công việc');
      setDeleting(false);
    }
  };

  if (!taskId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-[var(--bg-surface)] shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border-l border-[var(--glass-border)]">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => taskId && load(taskId)} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">Thử lại</button>
          </div>
        )}
        {!loading && !error && task && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] flex-shrink-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                {task.is_overdue && <span className="text-xs text-rose-500 font-semibold flex-shrink-0">⚠ Quá hạn</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!editing && (
                  <>
                    <button onClick={startEdit} className="h-[32px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] flex items-center gap-1.5 transition-colors">
                      <Edit3 size={13} /> Sửa
                    </button>
                    {onDeleted && (
                      <button onClick={handleDelete} disabled={deleting} className="h-[32px] px-2.5 text-xs font-medium border border-rose-200 dark:border-rose-800 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={() => setEditing(false)} className="h-[32px] px-3 text-xs font-medium border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-colors">
                      Hủy
                    </button>
                    <button onClick={saveEdit} disabled={saving} className="h-[32px] px-3 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Lưu
                    </button>
                  </>
                )}
                <button onClick={onClose} className="h-[32px] w-[32px] flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="p-5 space-y-5">
                {/* Title */}
                {editing ? (
                  <input
                    value={editData.title || ''}
                    onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                    className="w-full text-xl font-bold bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                ) : (
                  <h2 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{task.title}</h2>
                )}

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1"><Flag size={11} /> Ưu tiên</label>
                    {editing ? (
                      <select value={editData.priority || 'medium'} onChange={e => setEditData(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                        className="w-full h-[34px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
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
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1"><Calendar size={11} /> Deadline</label>
                    {editing ? (
                      <input type="date" value={editData.deadline?.toString().split('T')[0] || ''} onChange={e => setEditData(p => ({ ...p, deadline: e.target.value }))}
                        className="w-full h-[34px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    ) : (
                      <span className={`text-sm ${task.is_overdue ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                        {task.deadline ? task.deadline.toString().split('T')[0] : '—'}
                      </span>
                    )}
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1"><Tag size={11} /> Danh mục</label>
                    {editing ? (
                      <select value={editData.category || ''} onChange={e => setEditData(p => ({ ...p, category: e.target.value as TaskCategory || undefined }))}
                        className="w-full h-[34px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                        <option value="">Chưa chọn</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)]">{task.category ? CATEGORY_LABELS[task.category] : '—'}</span>
                    )}
                  </div>

                  {/* Estimated hours */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1"><Clock size={11} /> Giờ ước tính</label>
                    {editing ? (
                      <input type="number" min="0.5" step="0.5" value={editData.estimated_hours || ''} onChange={e => setEditData(p => ({ ...p, estimated_hours: parseFloat(e.target.value) || undefined }))}
                        className="w-full h-[34px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)]">{task.estimated_hours ? `${task.estimated_hours}h` : '—'}</span>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1"><User2 size={11} /> Phòng ban</label>
                    {editing ? (
                      <select value={editData.department_id || ''} onChange={e => setEditData(p => ({ ...p, department_id: e.target.value || undefined }))}
                        className="w-full h-[34px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                        <option value="">Chưa chọn</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)]">{task.department_name || '—'}</span>
                    )}
                  </div>

                  {/* Project */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-tertiary)]">Dự án</label>
                    <span className="text-sm text-[var(--text-secondary)]">{task.project_name || '—'}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-tertiary)]">Mô tả</label>
                  {editing ? (
                    <textarea
                      rows={4}
                      value={editData.description || ''}
                      onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                      placeholder="Thêm mô tả công việc..."
                      className="w-full text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl p-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                      {task.description || <span className="text-[var(--text-tertiary)] italic">Chưa có mô tả</span>}
                    </p>
                  )}
                </div>

                {/* Status change (not in edit mode) */}
                {!editing && VALID_TRANSITIONS[task.status].length > 0 && (
                  <div className="relative">
                    <label className="text-xs font-medium text-[var(--text-tertiary)] block mb-1.5">Chuyển trạng thái</label>
                    <div className="flex flex-wrap gap-2">
                      {VALID_TRANSITIONS[task.status].map(s => (
                        <button key={s} onClick={() => changeStatus(s)} disabled={changingStatus}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                            s === 'done' ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' :
                            s === 'cancelled' ? 'border-rose-300 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20' :
                            'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
                          }`}>
                          {changingStatus ? <Loader2 className="w-3 h-3 animate-spin inline-block" /> : STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignees */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-tertiary)]">Người thực hiện</label>
                  {task.assignees?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.assignees.map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 bg-[var(--glass-surface-hover)] rounded-lg px-2 py-1">
                          <Avatar name={a.name} size={5} />
                          <span className="text-xs text-[var(--text-secondary)] font-medium">{a.name}</span>
                          {a.is_primary && <span className="text-[9px] text-indigo-500 font-semibold uppercase">Chính</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)] italic">Chưa giao việc</p>
                  )}
                </div>

                {/* Created info */}
                <div className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--glass-border)]">
                  Tạo bởi <span className="font-medium text-[var(--text-secondary)]">{task.created_by_name || 'Hệ thống'}</span>
                  {' '}· {new Date(task.created_at).toLocaleDateString('vi-VN')}
                  {task.actual_hours && <> · Thực tế: <span className="font-medium">{task.actual_hours}h</span></>}
                </div>
              </div>

              {/* Comments / Activity Tabs */}
              <div className="border-t border-[var(--glass-border)]">
                <div className="flex px-5 pt-1 gap-4 border-b border-[var(--glass-border)]">
                  {(['comments', 'activity'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`text-sm font-medium py-3 border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
                      {tab === 'comments' ? `Bình luận (${comments.length})` : `Hoạt động (${activity.length})`}
                    </button>
                  ))}
                </div>

                <div className="p-5 space-y-4">
                  {activeTab === 'comments' && (
                    <>
                      {comments.length === 0 && (
                        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có bình luận</p>
                      )}
                      {comments.map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar name={c.user_name} size={7} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">{c.user_name}</span>
                              <span className="text-[11px] text-[var(--text-tertiary)]">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--glass-surface-hover)] rounded-xl p-2.5">{c.content}</p>
                          </div>
                        </div>
                      ))}

                      {/* New comment */}
                      <div className="flex gap-2.5 pt-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <MessageSquare size={13} className="text-indigo-500" />
                        </div>
                        <div className="flex-1">
                          <textarea
                            ref={commentRef}
                            rows={2}
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment(); }}
                            placeholder="Thêm bình luận... (Ctrl+Enter để gửi)"
                            className="w-full text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl p-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                          />
                          <div className="flex justify-end mt-1.5">
                            <button onClick={sendComment} disabled={!newComment.trim() || sendingComment}
                              className="h-[30px] px-3 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                              {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Gửi
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'activity' && (
                    <>
                      {activity.length === 0 && (
                        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có hoạt động</p>
                      )}
                      {activity.map(a => (
                        <div key={a.id} className="flex gap-2.5 text-sm">
                          <div className="w-6 h-6 rounded-full bg-[var(--glass-surface-hover)] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock size={12} className="text-[var(--text-tertiary)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-[var(--text-secondary)]">{a.user_name || 'Hệ thống'}</span>
                            {' '}<span className="text-[var(--text-tertiary)]">{a.detail || a.action}</span>
                            <span className="text-[11px] text-[var(--text-tertiary)] ml-2">{timeAgo(a.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
