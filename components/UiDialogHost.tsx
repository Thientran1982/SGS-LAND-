import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { uiDialogStore, UiDialogRequest } from '../utils/uiDialog';

// Renders the dialogs and toasts requested through utils/uiDialog.
// Mounted once near the root of App.tsx.

const isEn = () => {
  try { return (document.documentElement.lang || '').toLowerCase().startsWith('en'); } catch { return false; }
};

const DialogCard: React.FC<{ req: UiDialogRequest }> = ({ req }) => {
  const [value, setValue] = useState(req.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const en = isEn();
  const title = req.title ?? (req.kind === 'prompt' ? (en ? 'Enter information' : 'Nhập thông tin') : (en ? 'Please confirm' : 'Xác nhận thao tác'));
  const okLabel = req.confirmLabel ?? (req.danger ? (en ? 'Delete' : 'Xoá') : (en ? 'Confirm' : 'Đồng ý'));
  const cancelLabel = req.cancelLabel ?? (en ? 'Cancel' : 'Huỷ');

  const cancel = () => uiDialogStore.settle(req.id, req.kind === 'prompt' ? null : false);
  const ok = () => uiDialogStore.settle(req.id, req.kind === 'prompt' ? value : true);

  useEffect(() => {
    (req.kind === 'prompt' ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleId = `ui-dialog-title-${req.id}`;
  const descId = `ui-dialog-desc-${req.id}`;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancel} aria-hidden="true" />
      <div
        role={req.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-2xl animate-enter"
      >
        <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        <p id={descId} className="mt-2 whitespace-pre-line text-sm text-[var(--text-secondary)]">{req.message}</p>
        {req.kind === 'prompt' && (
          <form onSubmit={e => { e.preventDefault(); ok(); }}>
            <input
              ref={inputRef}
              value={value}
              placeholder={req.placeholder}
              onChange={e => setValue(e.target.value)}
              className="mt-3 w-full min-h-[44px] rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)]"
            />
          </form>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="min-h-[44px] rounded-xl border border-[var(--glass-border)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)]"
          >{cancelLabel}</button>
          <button
            ref={confirmRef}
            type="button"
            onClick={ok}
            disabled={req.kind === 'prompt' && !value.trim()}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sgs-primary)] ${req.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[var(--sgs-primary)] hover:opacity-90'}`}
          >{okLabel}</button>
        </div>
      </div>
    </div>
  );
};

const TOAST_STYLE: Record<string, string> = {
  success: 'border-emerald-500/40',
  error: 'border-rose-500/50',
  info: 'border-[var(--glass-border)]',
};

export const UiDialogHost: React.FC = () => {
  const s = useSyncExternalStore(uiDialogStore.subscribe, uiDialogStore.getState, uiDialogStore.getState);
  const top = s.dialogs[0];
  return (
    <>
      {top && <DialogCard key={top.id} req={top} />}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[10001] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite" role="status">
        {s.toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-xl ${TOAST_STYLE[t.kind]}`}>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${t.kind === 'success' ? 'bg-emerald-500' : t.kind === 'error' ? 'bg-rose-500' : 'bg-[var(--sgs-primary)]'}`} aria-hidden="true" />
            <span className="flex-1 whitespace-pre-line">{t.message}</span>
            <button type="button" onClick={() => uiDialogStore.dismissToast(t.id)} className="-m-1 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] rounded" aria-label="Đóng">×</button>
          </div>
        ))}
      </div>
    </>
  );
};

export default UiDialogHost;
