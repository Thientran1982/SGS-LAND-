// UX audit 3.3: a single app-wide replacement for window.alert/confirm/prompt.
// Native dialogs block the tab, ignore the theme and cannot be styled or
// translated. These helpers return Promises and are rendered by
// <UiDialogHost/> (mounted once in App.tsx).

export type UiDialogKind = 'confirm' | 'prompt';
export type UiToastKind = 'success' | 'error' | 'info';

export interface UiDialogRequest {
  id: number;
  kind: UiDialogKind;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: boolean | string | null) => void;
}

export interface UiToast {
  id: number;
  kind: UiToastKind;
  message: string;
}

interface UiDialogState {
  dialogs: UiDialogRequest[];
  toasts: UiToast[];
}

let state: UiDialogState = { dialogs: [], toasts: [] };
let seq = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(fn => fn());

export const uiDialogStore = {
  getState: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  settle(id: number, value: boolean | string | null) {
    const req = state.dialogs.find(d => d.id === id);
    state = { ...state, dialogs: state.dialogs.filter(d => d.id !== id) };
    emit();
    req?.resolve(value);
  },
  dismissToast(id: number) {
    state = { ...state, toasts: state.toasts.filter(t => t.id !== id) };
    emit();
  },
};

const DESTRUCTIVE = /(xo[aá]|x[oó]a|g[ỡo]|delete|remove|vĩnh viễn|không thể hoàn tác)/i;

export interface UiConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** Promise-based confirm. Resolves true only when the user confirms. */
export function uiConfirm(message: string, opts: UiConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    const id = ++seq;
    state = {
      ...state,
      dialogs: [...state.dialogs, {
        id, kind: 'confirm', message, ...opts,
        danger: opts.danger ?? DESTRUCTIVE.test(message),
        resolve: v => resolve(v === true),
      }],
    };
    emit();
  });
}

export interface UiPromptOptions extends UiConfirmOptions {
  placeholder?: string;
}

/** Promise-based prompt. Resolves the entered text, or null when cancelled. */
export function uiPrompt(message: string, defaultValue = '', opts: UiPromptOptions = {}): Promise<string | null> {
  return new Promise(resolve => {
    const id = ++seq;
    state = {
      ...state,
      dialogs: [...state.dialogs, {
        id, kind: 'prompt', message, defaultValue, ...opts,
        resolve: v => resolve(typeof v === 'string' ? v : null),
      }],
    };
    emit();
  });
}

/** Non-blocking toast, auto-dismissed. */
export function uiNotify(message: string, kind: UiToastKind = 'info', durationMs = 4500): void {
  const id = ++seq;
  state = { ...state, toasts: [...state.toasts.slice(-3), { id, kind, message }] };
  emit();
  if (typeof window !== 'undefined') {
    window.setTimeout(() => uiDialogStore.dismissToast(id), durationMs);
  }
}
