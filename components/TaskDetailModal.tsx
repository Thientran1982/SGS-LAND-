import { uiConfirm, uiNotify } from '../utils/uiDialog';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, AlertTriangle, Edit3, Save, Trash2,
  MessageSquare, Clock, Send, ExternalLink, ChevronLeft
} from 'lucide-react';
import { api } from '../services/api';
import { WfTask, TaskComment, TaskActivityLog, WfTaskStatus, TaskPriority, TaskCategory, Department } from '../types';
import { SelectDropdown } from './task/SelectDropdown';
import { useTranslation } from '../services/i18n';
import { DetailSection, StatusChip } from './detail/DetailLayout';

/**
 * Task detail drawer — uses the shared detail-page template
 * (header strip → main column + context column), same as the customer profile.
 */

const STATUS_TONE: Record<WfTaskStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  todo: 'neutral', in_progress: 'info', review: 'warning', done: 'success', cancelled: 'danger',
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200',
  low: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 border-teal-200',
};
const CATEGORY_KEYS: TaskCategory[] = ['sales', 'legal', 'marketing', 'site_visit', 'customer_care', 'finance', 'construction', 'admin', 'other'];
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
  onOpenFullPage?: (id: string) => void;
}
const AVATAR_SIZE: Record<number, string> = { 5: 'w-5 h-5', 6: 'w-6 h-6', 7: 'w-7 h-7', 8: 'w-8 h-8' };
function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  return (
    <div className={`${AVATAR_SIZE[size] || AVATAR_SIZE[7]} rounded-full bg-[var(--sgs-primary)]/10 dark:bg-[var(--sgs-primary)]/25 flex items-center justify-center text-[11px] font-bold text-sgs-primary dark:text-[var(--sgs-primary)] border border-white dark:border-slate-700 flex-shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}
const INPUT = 'w-full h-[36px] text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-lg px-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/30';

export function TaskDetailModal({ taskId, onClose, onUpdated, onDeleted, onOpenFullPage }: Props) {
  const { t, language } = useTranslation();
  const tr = (key: string, vars?: Record<string, string | number>) => {
    let out = String(t(key) ?? key);
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tr('taskd.just_now');
    if (mins < 60) return tr('taskd.minutes_ago', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return tr('taskd.hours_ago', { n: hrs });
    const days = Math.floor(hrs / 24);
    if (days < 30) return tr('taskd.days_ago', { n: days });
    return new Date(dateStr).toLocaleDateString(locale);
  };
  const statusLabel = (s: WfTaskStatus) => tr(`taskd.status_${s}`);
  const priorityLabel = (p: TaskPriority) => tr(`taskd.priority_${p}`);
  const categoryLabel = (c: TaskCategory) => tr(`taskd.category_${c}`);

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
      setError('load');
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
      uiNotify(e?.message || tr('taskd.save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (newStatus: WfTaskStatus) => {
    if (!task) return;
    setChangingStatus(true);
    try {
      const updated = await api.patch<WfTask>(`/api/tasks/${task.id}/status`, { status: newStatus });
      setTask(updated);
      onUpdated(updated);
      const newAct: TaskActivityLog[] = await api.get<{ data: TaskActivityLog[] }>(`/api/tasks/${task.id}/activity`).then(r => r.data || []);
      setActivity(newAct);
    } catch (e: any) {
      uiNotify(e?.message || tr('taskd.status_error'), 'error');
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
      uiNotify(tr('taskd.comment_error'), 'error');
    } finally {
      setSendingComment(false);
    }
  };
  const handleDelete = async () => {
    if (!task) return;
    if (!(await uiConfirm(tr('taskd.delete_confirm')))) return;
    setDeleting(true);
    try {
      await api.delete(`/api/tasks/${task.id}`);
      onDeleted?.(task.id);
      onClose();
    } catch {
      uiNotify(tr('taskd.delete_error'), 'error');
      setDeleting(false);
    }
  };
  if (!taskId) return null;

  const fieldLabel = 'text-xs font-medium text-[var(--text-tertiary)]';
  const deadlineText = task?.deadline ? new Date(task.deadline).toLocaleDateString(locale) : '—';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-end md:p-3" role="dialog" aria-modal="true" aria-label={task?.title || tr('taskd.title')}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex w-full flex-col overflow-hidden border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl animate-slide-in-right md:rounded-[20px] md:border lg:w-[min(1080px,calc(100vw-1.5rem))]">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-sgs-primary" />
          </div>
        )}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle className="w-10 h-10 text-sgs-accent-text" />
            <p className="text-[var(--text-secondary)]">{tr('taskd.load_error')}</p>
            <button onClick={() => taskId && load(taskId)} className="text-sm text-sgs-primary font-medium">{tr('taskd.retry')}</button>
          </div>
        )}
        {!loading && !error && task && (
          <>
            {/* Header strip */}
            <div className="flex flex-none items-center gap-2 border-b border-[var(--glass-border)] px-3 py-2.5 md:px-5">
              <button type="button" onClick={onClose} aria-label={tr('taskd.close')} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]">
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">{tr('taskd.breadcrumb')}</span>
              <div className="flex-1" />
              {onOpenFullPage && (
                <button onClick={() => { onClose(); onOpenFullPage(task.id); }} title={tr('taskd.open_full')} aria-label={tr('taskd.open_full')}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-sgs-primary">
                  <ExternalLink size={15} />
                </button>
              )}
              {!editing && (
                <>
                  <button onClick={startEdit} className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                    <Edit3 size={13} /> {tr('taskd.edit')}
                  </button>
                  {onDeleted && (
                    <button onClick={handleDelete} disabled={deleting} aria-label={tr('taskd.delete')} className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-900/20">
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </>
              )}
              {editing && (
                <>
                  <button onClick={() => setEditing(false)} className="h-10 rounded-lg border border-[var(--glass-border)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">{tr('taskd.cancel')}</button>
                  <button onClick={saveEdit} disabled={saving} className="flex h-10 items-center gap-1.5 rounded-lg bg-sgs-primary px-3 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {tr('taskd.save')}
                  </button>
                </>
              )}
              <button onClick={onClose} aria-label={tr('taskd.close')} className="hidden h-10 w-10 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] md:flex">
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 gap-8 px-4 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-7">
                {/* Main column */}
                <div className="min-w-0 space-y-7 lg:col-start-1 lg:row-start-1">
                  <div>
                    {editing ? (
                      <input
                        value={editData.title || ''}
                        onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                        aria-label={tr('taskd.title')}
                        className="w-full text-2xl font-bold bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/30"
                      />
                    ) : (
                      <h2 className="text-2xl font-bold leading-tight text-[var(--text-primary)]">{task.title}</h2>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusChip tone={STATUS_TONE[task.status]}>{statusLabel(task.status)}</StatusChip>
                      {task.is_overdue && <StatusChip tone="danger">{tr('taskd.overdue')}</StatusChip>}
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {tr('taskd.created_by', { name: task.created_by_name || tr('taskd.system'), date: new Date(task.created_at).toLocaleDateString(locale) })}
                      </span>
                    </div>
                  </div>

                  <div className="border-l-2 border-[var(--glass-border)] pl-4">
                    <div className={`${fieldLabel} mb-1.5`}>{tr('taskd.description')}</div>
                    {editing ? (
                      <textarea
                        rows={5}
                        value={editData.description || ''}
                        onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                        placeholder={tr('taskd.description_placeholder')}
                        className="w-full text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl p-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/30 resize-none"
                      />
                    ) : (
                      <p className={`text-sm leading-relaxed whitespace-pre-line ${task.description ? 'rounded-lg bg-[var(--sgs-champagne)] px-3 py-2 text-[var(--ui-text)] dark:bg-[var(--glass-surface)] dark:text-[var(--text-primary)]' : 'italic text-[var(--text-tertiary)]'}`}>
                        {task.description || tr('taskd.no_description')}
                      </p>
                    )}
                  </div>

                  {!editing && VALID_TRANSITIONS[task.status].length > 0 && (
                    <div>
                      <div className={`${fieldLabel} mb-2`}>{tr('taskd.move_to')}</div>
                      <div className="flex flex-wrap gap-2">
                        {VALID_TRANSITIONS[task.status].map(s => (
                          <button key={s} onClick={() => changeStatus(s)} disabled={changingStatus}
                            className={`min-h-[40px] rounded-lg border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                              s === 'done' ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)] text-[var(--ui-on-brand)] hover:opacity-90' :
                              s === 'cancelled' ? 'border-rose-300 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20' :
                              'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
                            }`}>
                            {changingStatus ? <Loader2 className="w-3 h-3 animate-spin inline-block" /> : statusLabel(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Context column */}
                <aside className="min-w-0 divide-y divide-[var(--glass-border)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:border-l lg:border-[var(--glass-border)] lg:pl-8" aria-label={tr('taskd.details')}>
                  <DetailSection title={tr('taskd.section_schedule')}>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.priority')}</div>
                        {editing ? (
                          <SelectDropdown
                            value={editData.priority || 'medium'}
                            onChange={val => setEditData(p => ({ ...p, priority: val as TaskPriority }))}
                            height={36}
                            options={[
                              { value: 'low', label: priorityLabel('low'), dot: 'bg-teal-500' },
                              { value: 'medium', label: priorityLabel('medium'), dot: 'bg-amber-500' },
                              { value: 'high', label: priorityLabel('high'), dot: 'bg-orange-500' },
                              { value: 'urgent', label: priorityLabel('urgent'), dot: 'bg-rose-500' },
                            ]}
                          />
                        ) : (
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{priorityLabel(task.priority)}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.deadline')}</div>
                        {editing ? (
                          <input type="date" aria-label={tr('taskd.deadline')} value={editData.deadline?.toString().split('T')[0] || ''} onChange={e => setEditData(p => ({ ...p, deadline: e.target.value }))} className={INPUT} />
                        ) : (
                          <span className={`text-sm ${task.is_overdue ? 'font-semibold text-rose-500' : 'text-[var(--text-primary)]'}`}>
                            {deadlineText}
                            {!task.is_overdue && typeof task.days_until_deadline === 'number' && task.days_until_deadline >= 0 && task.status !== 'done' && (
                              <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{tr('taskd.days_left', { n: task.days_until_deadline })}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.estimated_hours')}</div>
                        {editing ? (
                          <input type="number" min="0.5" step="0.5" aria-label={tr('taskd.estimated_hours')} value={editData.estimated_hours || ''} onChange={e => setEditData(p => ({ ...p, estimated_hours: parseFloat(e.target.value) || undefined }))} className={INPUT} />
                        ) : (
                          <span className="text-sm text-[var(--text-primary)]">
                            {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
                            {task.actual_hours ? <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{tr('taskd.actual_hours', { n: task.actual_hours })}</span> : null}
                          </span>
                        )}
                      </div>
                    </div>
                  </DetailSection>
                  <DetailSection title={tr('taskd.section_scope')}>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.category')}</div>
                        {editing ? (
                          <SelectDropdown
                            value={editData.category || ''}
                            onChange={val => setEditData(p => ({ ...p, category: (val as TaskCategory) || undefined }))}
                            placeholder={tr('taskd.not_set')}
                            height={36}
                            options={[
                              { value: '', label: tr('taskd.not_set') },
                              ...CATEGORY_KEYS.map(k => ({ value: k, label: categoryLabel(k) })),
                            ]}
                          />
                        ) : (
                          <span className="text-sm text-[var(--text-primary)]">{task.category ? categoryLabel(task.category) : '—'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.department')}</div>
                        {editing ? (
                          <SelectDropdown
                            value={editData.department_id || ''}
                            onChange={val => setEditData(p => ({ ...p, department_id: val || undefined }))}
                            placeholder={tr('taskd.not_set')}
                            height={36}
                            options={[
                              { value: '', label: tr('taskd.not_set') },
                              ...departments.map(d => ({ value: d.id, label: d.name })),
                            ]}
                          />
                        ) : (
                          <span className="text-sm text-[var(--text-primary)]">{task.department_name || '—'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className={fieldLabel}>{tr('taskd.project')}</div>
                        <span className="text-sm text-[var(--text-primary)]">{task.project_name || '—'}</span>
                      </div>
                    </div>
                  </DetailSection>
                  <DetailSection title={tr('taskd.assignees')}>
                    {task.assignees?.length > 0 ? (
                      <ul className="space-y-2">
                        {task.assignees.map(a => (
                          <li key={a.id} className="flex items-center gap-2">
                            <Avatar name={a.name} size={6} />
                            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{a.name}</span>
                            {a.is_primary && <span className="text-[10px] font-semibold uppercase text-sgs-primary">{tr('taskd.primary')}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-[var(--text-tertiary)]">{tr('taskd.unassigned')}</p>
                    )}
                  </DetailSection>
                </aside>
                {/* Comments / activity */}
                <section className="min-w-0 rounded-2xl border border-[var(--glass-border)] lg:col-start-1 lg:row-start-2 lg:self-start">
                  <div className="flex gap-4 border-b border-[var(--glass-border)] px-4" role="tablist">
                    {(['comments', 'activity'] as const).map(tab => (
                      <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                        className={`min-h-[44px] border-b-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-[var(--sgs-accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
                        {tab === 'comments' ? tr('taskd.comments', { n: comments.length }) : tr('taskd.activity', { n: activity.length })}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4 p-4">
                    {activeTab === 'comments' && (
                      <>
                        {comments.length === 0 && <p className="py-4 text-center text-sm text-[var(--text-tertiary)]">{tr('taskd.no_comments')}</p>}
                        {comments.map(c => (
                          <div key={c.id} className="flex gap-2.5">
                            <Avatar name={c.user_name} size={7} />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-[var(--text-primary)]">{c.user_name}</span>
                                <span className="text-[11px] text-[var(--text-tertiary)]">{timeAgo(c.created_at)}</span>
                              </div>
                              <p className="whitespace-pre-line rounded-xl bg-[var(--glass-surface-hover)] p-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">{c.content}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2.5 pt-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sgs-champagne dark:bg-sgs-primary/30">
                            <MessageSquare size={13} className="text-sgs-primary" />
                          </div>
                          <div className="flex-1">
                            <textarea
                              ref={commentRef}
                              rows={2}
                              value={newComment}
                              onChange={e => setNewComment(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment(); }}
                              placeholder={tr('taskd.comment_placeholder')}
                              aria-label={tr('taskd.comment_placeholder')}
                              className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)] p-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/30"
                            />
                            <div className="mt-1.5 flex justify-end">
                              <button onClick={sendComment} disabled={!newComment.trim() || sendingComment}
                                className="flex h-9 items-center gap-1.5 rounded-lg bg-sgs-primary px-3 text-xs font-semibold text-white disabled:opacity-50">
                                {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {tr('taskd.send')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {activeTab === 'activity' && (
                      <>
                        {activity.length === 0 && <p className="py-4 text-center text-sm text-[var(--text-tertiary)]">{tr('taskd.no_activity')}</p>}
                        {activity.map(a => (
                          <div key={a.id} className="flex gap-2.5 text-sm">
                            <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--glass-surface-hover)]">
                              <Clock size={12} className="text-[var(--text-tertiary)]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-[var(--text-secondary)]">{a.user_name || tr('taskd.system')}</span>
                              {' '}<span className="text-[var(--text-tertiary)]">{a.detail || a.action}</span>
                              <span className="ml-2 text-[11px] text-[var(--text-tertiary)]">{timeAgo(a.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
