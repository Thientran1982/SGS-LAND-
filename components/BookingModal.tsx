
import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, time: string, note: string, name: string, phone: string) => void;
    t: (key: string) => string;
}

const ICONS = {
    CALENDAR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
};

export const BookingModal: React.FC<BookingModalProps> = memo(({ isOpen, onClose, onConfirm, t }) => {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('09:00');
    const [note, setNote] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setDate(tomorrow.toISOString().split('T')[0]);
            setTime('09:00');
            setNote('');
            setName('');
            setPhone('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!name || !phone) {
            alert(t('common.error') || 'Vui lòng nhập đầy đủ thông tin');
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm(date, time, note, name, phone);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
            <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">{ICONS.CALENDAR}</div>
                    {t('detail.book_viewing')}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('leads.name') || 'Họ và tên'}</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            disabled={isSubmitting}
                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-all font-medium text-[var(--text-secondary)] disabled:opacity-50" 
                            placeholder={t('common.placeholder_fullname')}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('leads.phone') || 'Số điện thoại'}</label>
                        <input 
                            type="tel" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            disabled={isSubmitting}
                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-all font-medium text-[var(--text-secondary)] disabled:opacity-50" 
                            placeholder="0912345678"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('common.date')} & {t('common.time')}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                disabled={isSubmitting}
                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-all font-medium text-[var(--text-secondary)] disabled:opacity-50" 
                            />
                            <input 
                                type="time" 
                                value={time} 
                                onChange={e => setTime(e.target.value)} 
                                disabled={isSubmitting}
                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-all font-medium text-[var(--text-secondary)] disabled:opacity-50" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('leads.notes')}</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-all h-24 resize-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
                            placeholder={t('leads.placeholder_notes')}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : ICONS.CHECK}
                        {isSubmitting ? 'Đang xử lý...' : t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
});
