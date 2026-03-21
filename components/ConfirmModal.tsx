
import React, { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    processing?: boolean;
    variant?: 'danger' | 'warning' | 'info' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = memo(({ 
    isOpen, 
    title, 
    message, 
    confirmLabel, 
    cancelLabel, 
    onConfirm, 
    onCancel, 
    processing = false,
    variant = 'danger'
}) => {
    // Escape key + body scroll lock
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !processing) onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, processing, onCancel]);

    if (!isOpen) return null;

    const btnColor = variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700';

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={!processing ? onCancel : undefined}
            />
            
            {/* Modal */}
            <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up">
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-rose-50 text-rose-500' : variant === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    
                    <h3 id="confirm-modal-title" className="text-lg font-bold text-[var(--text-primary)] mb-2">{title}</h3>
                    <p className="text-sm text-[var(--text-tertiary)] mb-6 leading-relaxed">{message}</p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onCancel} 
                            disabled={processing}
                            className="flex-1 py-2.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-70"
                        >
                            {cancelLabel}
                        </button>
                        <button 
                            onClick={onConfirm} 
                            disabled={processing} 
                            className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none active:scale-95 ${btnColor}`}
                        >
                            {processing && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
});
