import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Plus, Search, UserPlus, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { WfTask, TaskPriority, TaskCategory, Department } from '../types';

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  sales: 'Kinh doanh', legal: 'Pháp lý', marketing: 'Marketing',
  site_visit: 'Đi thực địa', customer_care: 'CSKH', finance: 'Tài chính',
  construction: 'Xây dựng', admin: 'Hành chính', other: 'Khác',
};

interface SimpleUser { id: string; name: string; email?: string; role?: string; }

interface Props {
  onClose: () => void;
  onCreated: (task: WfTask) => void;
  defaultDeptId?: string;
}

export function CreateTaskModal({ onClose, onCreated, defaultDeptId }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    deadline: '',
    estimated_hours: '',
    category: '' as TaskCategory | '',
    department_id: defaultDeptId || '',
    project_id: '',
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [userResults, setUserResults] = useState<SimpleUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SimpleUser[]>([]);

  useEffect(() => {
    api.get<{ data: Department[] }>('/api/departments').then(r => setDepartments(r.data || [])).catch(() => {});
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUserResults([]); return; }
    setSearchingUsers(true);
    try {
      const r = await api.get<{ data: SimpleUser[] }>(`/api/users?search=${encodeURIComponent(q)}&pageSize=10`);
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

  const toggleAssignee = (user: SimpleUser) => {
    if (assigneeIds.includes(user.id)) {
      setAssigneeIds(prev => prev.filter(id => id !== user.id));
      setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
    } else {
      setAssigneeIds(prev => [...prev, user.id]);
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  const removeAssignee = (userId: string) => {
    setAssigneeIds(prev => prev.filter(id => id !== userId));
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 5) errs.title = 'Tiêu đề phải có ít nhất 5 ký tự';
    if (form.title.trim().length > 500) errs.title = 'Tiêu đề quá dài (tối đa 500 ký tự)';
    if (form.deadline) {
      const dl = new Date(form.deadline);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (dl < today) errs.deadline = 'Deadline không được là ngày quá khứ';
    }
    if (form.estimated_hours && (isNaN(Number(form.estimated_hours)) || Number(form.estimated_hours) <= 0)) {
      errs.estimated_hours = 'Giờ ước tính phải là số dương';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        priority: form.priority,
        assignee_ids: assigneeIds,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.deadline) payload.deadline = form.deadline;
      if (form.estimated_hours) payload.estimated_hours = parseFloat(form.estimated_hours);
      if (form.category) payload.category = form.category;
      if (form.department_id) payload.department_id = form.department_id;
      if (form.project_id) payload.project_id = form.project_id;

      const task = await api.post<WfTask>('/api/tasks', payload);
      onCreated(task);
      onClose();
    } catch (e: any) {
      setErrors({ submit: e?.message || 'Không thể tạo công việc' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full h-[38px] px-3 text-sm bg-[var(--glass-surface-hover)] border rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors ${errors[field] ? 'border-rose-400' : 'border-[var(--glass-border)] focus:border-indigo-400'}`;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[var(--bg-surface)] rounded-[20px] shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] flex-shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Tạo Công việc mới</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Tiêu đề <span className="text-rose-500">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Nhập tiêu đề công việc (ít nhất 5 ký tự)..."
              className={inputCls('title')}
            />
            {errors.title && <p className="text-xs text-rose-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Mô tả</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Mô tả chi tiết công việc..."
              className="w-full px-3 py-2.5 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none transition-colors"
            />
          </div>

          {/* Priority + Deadline row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Ưu tiên <span className="text-rose-500">*</span></label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))} className={inputCls('priority')}>
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className={inputCls('deadline')} />
              {errors.deadline && <p className="text-xs text-rose-500">{errors.deadline}</p>}
            </div>
          </div>

          {/* Category + Hours row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Danh mục</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as TaskCategory | '' }))} className={inputCls('category')}>
                <option value="">Chưa chọn</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Giờ ước tính</label>
              <input type="number" min="0.5" step="0.5" value={form.estimated_hours} onChange={e => setForm(p => ({ ...p, estimated_hours: e.target.value }))} placeholder="e.g. 2.5" className={inputCls('estimated_hours')} />
              {errors.estimated_hours && <p className="text-xs text-rose-500">{errors.estimated_hours}</p>}
            </div>
          </div>

          {/* Department */}
          {departments.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Phòng ban</label>
              <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))} className={inputCls('department_id')}>
                <option value="">Chưa chọn</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {/* Assignees */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Người thực hiện</label>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-0.5 font-medium">
                    {u.name}
                    <button type="button" onClick={() => removeAssignee(u.id)} className="hover:text-rose-500 transition-colors ml-0.5">
                      <XCircle size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                value={assigneeSearch}
                onChange={e => { setAssigneeSearch(e.target.value); setUserPickerOpen(true); }}
                onFocus={() => setUserPickerOpen(true)}
                placeholder="Tìm tên nhân viên..."
                className="w-full h-[38px] pl-9 pr-3 text-sm bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
              {userPickerOpen && (userResults.length > 0 || searchingUsers) && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-20 overflow-hidden max-h-[200px] overflow-y-auto no-scrollbar">
                  {searchingUsers ? (
                    <div className="flex items-center justify-center p-4"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>
                  ) : (
                    userResults.map(u => (
                      <button key={u.id} type="button" onClick={() => { toggleAssignee(u); setAssigneeSearch(''); setUserPickerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--glass-surface-hover)] transition-colors ${assigneeIds.includes(u.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 flex-shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{u.name}</p>
                          {u.email && <p className="text-[11px] text-[var(--text-tertiary)] truncate">{u.email}</p>}
                        </div>
                        {assigneeIds.includes(u.id) && <span className="ml-auto text-indigo-500 text-xs font-semibold flex-shrink-0">✓</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-600 dark:text-rose-400">{errors.submit}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--glass-border)] flex-shrink-0">
          <button type="button" onClick={onClose} className="h-[38px] px-4 text-sm font-medium border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-colors">
            Hủy
          </button>
          <button onClick={handleSubmit as any} disabled={saving}
            className="h-[38px] px-5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tạo công việc
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
