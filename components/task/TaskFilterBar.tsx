import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react';
import { WfTaskStatus, TaskPriority, Department } from '../../types';
import { STATUS_LABELS, PRIORITY_LABELS, ALL_STATUSES, ALL_PRIORITIES } from '../../utils/taskUtils';
import { api } from '../../services/api';

interface SimpleUser { id: string; name: string; }
interface SimpleProject { id: string; name: string; }

export interface TaskFilters {
  search: string;
  statusFilter: WfTaskStatus[];
  priorityFilter: TaskPriority[];
  departmentId: string;
  projectId: string;
  assigneeId: string;
  assigneeName: string;
  deadlineFrom: string;
  deadlineTo: string;
}

export const EMPTY_FILTERS: TaskFilters = {
  search: '', statusFilter: [], priorityFilter: [],
  departmentId: '', projectId: '', assigneeId: '', assigneeName: '',
  deadlineFrom: '', deadlineTo: '',
};

interface Props {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  showStatus?: boolean;
  showPriority?: boolean;
  showDepartment?: boolean;
  showProject?: boolean;
  showAssignee?: boolean;
  showDeadlineRange?: boolean;
  compact?: boolean;
}

export function TaskFilterBar({
  filters,
  onChange,
  showStatus = true,
  showPriority = true,
  showDepartment = true,
  showProject = false,
  showAssignee = false,
  showDeadlineRange = false,
  compact = false,
}: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [assigneeResults, setAssigneeResults] = useState<SimpleUser[]>([]);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [searchingAssignee, setSearchingAssignee] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const assigneePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDepartment) {
      api.get<{ data: Department[] }>('/api/departments').then(r => setDepartments(r.data || [])).catch(() => {});
    }
    if (showProject) {
      api.get<{ data: SimpleProject[] }>('/api/projects?limit=100').then(r => setProjects(r.data || [])).catch(() => {});
    }
  }, [showDepartment, showProject]);

  const searchAssignees = useCallback(async (q: string) => {
    if (!q.trim()) { setAssigneeResults([]); return; }
    setSearchingAssignee(true);
    try {
      const r = await api.get<{ data: SimpleUser[] }>(`/api/users?search=${encodeURIComponent(q)}&pageSize=6`);
      setAssigneeResults(r.data || []);
    } catch {
      setAssigneeResults([]);
    } finally {
      setSearchingAssignee(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchAssignees(filters.assigneeName), 350);
    return () => clearTimeout(t);
  }, [filters.assigneeName, searchAssignees]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target as Node)) {
        setAssigneePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  const toggleStatus = (s: WfTaskStatus) =>
    set({ statusFilter: filters.statusFilter.includes(s) ? filters.statusFilter.filter(x => x !== s) : [...filters.statusFilter, s] });
  const togglePriority = (p: TaskPriority) =>
    set({ priorityFilter: filters.priorityFilter.includes(p) ? filters.priorityFilter.filter(x => x !== p) : [...filters.priorityFilter, p] });

  const hasFilters = filters.search || filters.statusFilter.length || filters.priorityFilter.length ||
    filters.departmentId || filters.projectId || filters.assigneeId ||
    filters.deadlineFrom || filters.deadlineTo;

  const advancedFilterCount = [filters.departmentId, filters.projectId, filters.assigneeId, filters.deadlineFrom || filters.deadlineTo].filter(Boolean).length;

  return (
    <div className="space-y-2.5">
      {/* Search row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text" value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Tìm kiếm..."
            className="w-full h-[36px] pl-9 pr-8 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          {filters.search && (
            <button onClick={() => set({ search: '' })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <X size={14} />
            </button>
          )}
        </div>
        {(showDepartment || showProject || showAssignee || showDeadlineRange) && (
          <button onClick={() => setShowAdvanced(v => !v)}
            className={`h-[36px] px-3 text-sm border rounded-xl flex items-center gap-1.5 transition-colors flex-shrink-0 ${showAdvanced || advancedFilterCount > 0 ? 'border-indigo-400 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
            <SlidersHorizontal size={14} />
            {!compact && 'Lọc nâng cao'}
            {advancedFilterCount > 0 && <span className="bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{advancedFilterCount}</span>}
          </button>
        )}
      </div>

      {/* Status + priority chips */}
      {(showStatus || showPriority) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          {showStatus && ALL_STATUSES.map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex-shrink-0 ${filters.statusFilter.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
          {showStatus && showPriority && <div className="w-px h-4 bg-[var(--glass-border)] mx-0.5" />}
          {showPriority && ALL_PRIORITIES.map(p => (
            <button key={p} onClick={() => togglePriority(p)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex-shrink-0 ${filters.priorityFilter.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600'}`}>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          {hasFilters && (
            <button onClick={() => onChange(EMPTY_FILTERS)}
              className="text-xs px-2 py-1 text-rose-500 hover:text-rose-600 flex items-center gap-1 ml-1 font-medium flex-shrink-0">
              <X size={12} /> Xóa lọc
            </button>
          )}
        </div>
      )}

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-2 items-center p-3 bg-[var(--glass-surface-hover)] rounded-xl border border-[var(--glass-border)]">
          {showDepartment && departments.length > 0 && (
            <select value={filters.departmentId} onChange={e => set({ departmentId: e.target.value })}
              className="h-[32px] px-2 text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] focus:outline-none min-w-[130px]">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {showProject && projects.length > 0 && (
            <select value={filters.projectId} onChange={e => set({ projectId: e.target.value })}
              className="h-[32px] px-2 text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] focus:outline-none min-w-[130px]">
              <option value="">Tất cả dự án</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {showAssignee && (
            <div className="relative" ref={assigneePickerRef}>
              <input
                value={filters.assigneeName}
                onChange={e => { set({ assigneeName: e.target.value, assigneeId: '' }); setAssigneePickerOpen(true); }}
                onFocus={() => setAssigneePickerOpen(true)}
                placeholder="Lọc theo người thực hiện..."
                className={`h-[32px] pl-2 pr-6 text-xs bg-[var(--bg-surface)] border rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none min-w-[160px] ${filters.assigneeId ? 'border-indigo-400 text-indigo-600' : 'border-[var(--glass-border)]'}`}
              />
              {filters.assigneeName && (
                <button onClick={() => set({ assigneeId: '', assigneeName: '' })} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                  <X size={11} />
                </button>
              )}
              {assigneePickerOpen && (assigneeResults.length > 0 || searchingAssignee) && (
                <div className="absolute top-full mt-1 left-0 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl z-30 py-1 min-w-[180px]">
                  {searchingAssignee ? (
                    <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">Đang tìm...</div>
                  ) : assigneeResults.map(u => (
                    <button key={u.id} type="button"
                      onClick={() => { set({ assigneeId: u.id, assigneeName: u.name }); setAssigneePickerOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--glass-surface-hover)] text-[var(--text-primary)]">
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showDeadlineRange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-tertiary)]">Deadline:</span>
              <input type="date" value={filters.deadlineFrom} onChange={e => set({ deadlineFrom: e.target.value })}
                className="h-[32px] px-2 text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:outline-none" />
              <span className="text-xs text-[var(--text-tertiary)]">→</span>
              <input type="date" value={filters.deadlineTo} onChange={e => set({ deadlineTo: e.target.value })}
                className="h-[32px] px-2 text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:outline-none" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
