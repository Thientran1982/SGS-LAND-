/**
 * FloorPlanManagerModal — admin surface for the Sa bàn feature.
 *
 * Lets ADMIN/SUPER_ADMIN/TEAM_LEAD upload SVG site plans per (tower, floor),
 * shows the diff between the uploaded `data-code`s and the project's listings,
 * and lists existing plans with replace/delete actions.
 *
 * Mounted as a portal-style modal from ProjectListingsPanel's admin menu.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { floorPlanApi, FloorPlanSummary, FloorPlanUploadResponse } from '../services/api/floorPlanApi';

export interface FloorPlanManagerModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Notifies parent that plans changed (so it can refresh viewer/badge). */
  onChanged?: () => void;
  t: (k: string) => string;
}

export const FloorPlanManagerModal: React.FC<FloorPlanManagerModalProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
  onChanged,
  t,
}) => {
  const [plans, setPlans] = useState<FloorPlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form
  const [tower, setTower] = useState('');
  const [floor, setFloor] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<FloorPlanUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await floorPlanApi.list(projectId);
      setPlans(list);
    } catch (e: any) {
      setError(e?.message || t('floorplan.load_error') || 'Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    reload();
    setUploadResult(null);
    setFile(null);
    setTower('');
    setFloor('');
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, uploading, onClose]);

  const handleUpload = async () => {
    if (!file) {
      setError(t('floorplan.pick_file') || 'Vui lòng chọn file SVG');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await floorPlanApi.upload(projectId, {
        tower: tower.trim() || 'ALL',
        floor: floor.trim() || 'ALL',
        notes: notes.trim() || undefined,
        file,
      });
      setUploadResult(res);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || t('floorplan.upload_failed') || 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!window.confirm(t('floorplan.confirm_delete') || 'Xoá sa bàn này?')) return;
    setDeletingId(planId);
    try {
      await floorPlanApi.delete(projectId, planId);
      await reload();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || t('common.error_generic'));
    } finally {
      setDeletingId(null);
    }
  };

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.tower.localeCompare(b.tower) || a.floor.localeCompare(b.floor)),
    [plans],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10002] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!uploading) onClose(); }}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)] truncate">
              {t('floorplan.manage_title') || 'Quản lý sa bàn'} — {projectName}
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {t('floorplan.manage_subtitle') || 'Tải file SVG có thuộc tính data-code khớp với mã sản phẩm.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { if (!uploading) onClose(); }}
            disabled={uploading}
            className="text-[var(--text-tertiary)] hover:text-rose-600 text-xl leading-none px-2 disabled:opacity-50"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="overflow-auto p-5 space-y-5">
          {/* Upload form */}
          <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
              {t('floorplan.upload_section') || 'Tải lên sa bàn mới (hoặc thay thế)'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                  {t('inventory.label_tower') || 'Tháp'}
                </label>
                <input
                  type="text"
                  value={tower}
                  onChange={(e) => setTower(e.target.value)}
                  placeholder="A, B1, B2…"
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                  {t('inventory.label_floor') || 'Tầng'}
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="12, 21, ALL…"
                  maxLength={20}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                  {t('common.notes') || 'Ghi chú'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/svg+xml,.svg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[var(--text-secondary)]"
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploading
                  ? (t('common.uploading') || 'Đang tải...')
                  : (t('floorplan.upload_btn') || 'Tải lên SVG')}
              </button>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {t('floorplan.upload_hint') ||
                  'Chỉ chấp nhận file SVG (≤ 2MB). Mỗi tháp+tầng chỉ có 1 sa bàn — tải lại sẽ thay thế.'}
              </p>
            </div>

            {/* Diff result after upload */}
            {uploadResult && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 space-y-2 text-sm">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ {t('floorplan.upload_ok') || 'Đã lưu sa bàn'} · {uploadResult.codes.length} {t('floorplan.codes_found') || 'mã trong SVG'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1">
                      {t('floorplan.unmatched_codes') || 'Mã trong SVG chưa khớp listing'} ({uploadResult.unmatchedCodes.length})
                    </p>
                    {uploadResult.unmatchedCodes.length === 0 ? (
                      <p className="text-xs text-emerald-700">— {t('floorplan.all_matched') || 'tất cả đã khớp'}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                        {uploadResult.unmatchedCodes.map((c) => (
                          <span key={c} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1">
                      {t('floorplan.extra_listings') || 'Listing chưa được vẽ trên sa bàn'} ({uploadResult.extraListings.length})
                    </p>
                    {uploadResult.extraListings.length === 0 ? (
                      <p className="text-xs text-emerald-700">— {t('floorplan.all_drawn') || 'tất cả listing đã có vùng'}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                        {uploadResult.extraListings.slice(0, 50).map((l) => (
                          <span
                            key={l.id}
                            className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            title={`${l.tower || ''} / ${l.floor || ''}`}
                          >
                            {l.code}
                          </span>
                        ))}
                        {uploadResult.extraListings.length > 50 && (
                          <span className="text-[11px] text-[var(--text-tertiary)]">+{uploadResult.extraListings.length - 50}…</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Existing plans */}
          <section>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
              {t('floorplan.existing_section') || 'Sa bàn hiện có'}
            </h3>
            {loading ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('common.loading')}</p>
            ) : sortedPlans.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-3">
                — {t('floorplan.empty') || 'Chưa có sa bàn nào'} —
              </p>
            ) : (
              <ul className="divide-y divide-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl overflow-hidden">
                {sortedPlans.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[var(--bg-surface)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {t('inventory.label_tower')} {p.tower} · {t('inventory.label_floor')} {p.floor}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)]">
                          {p.codeCount} {t('floorplan.codes_short') || 'mã'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {p.svgFilename} · {new Date(p.updatedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2.5 py-1 rounded-lg disabled:opacity-50"
                    >
                      {deletingId === p.id ? '…' : (t('common.delete') || 'Xoá')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FloorPlanManagerModal;
