import React, { useState } from 'react';
import { useTranslation } from '../services/i18n';
import { motion } from 'motion/react';
import { Wand2, CheckCheck, MessageSquare, Loader2, Sparkles } from 'lucide-react';

export const SmartVietnameseEditor: React.FC = () => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);

    const processText = async (prompt: string, actionName: string) => {
        if (!text.trim()) return;
        setIsProcessing(true);
        setActiveAction(actionName);
        try {
            const response = await fetch('/api/ai/generate-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    prompt: `${prompt}\n\nVăn bản gốc:\n"""\n${text}\n"""`,
                    model: 'gemini-3-flash-preview',
                    temperature: 0.2
                })
            });
            if (response.status === 401 || response.status === 403) {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('sgs_session_token');
                    window.location.href = '/login';
                }
                throw new Error('Authentication required');
            }
            if (!response.ok) throw new Error('Failed to process text');
            const data = await response.json();
            if (data.text) {
                setText(data.text.trim());
            }
        } catch (error) {
            console.error('Error processing text:', error);
            // In a real app, we'd show a toast here
        } finally {
            setIsProcessing(false);
            setActiveAction(null);
        }
    };

    const handleRestoreDiacritics = () => {
        processText(
            t('editor.prompt_diacritics') || 'Bạn là một chuyên gia ngôn ngữ tiếng Việt. Hãy thêm dấu tiếng Việt chuẩn xác cho đoạn văn bản không dấu sau đây. Chỉ trả về văn bản đã được thêm dấu, không giải thích gì thêm. Giữ nguyên định dạng dòng.',
            'diacritics'
        );
    };

    const handleFixGrammar = () => {
        processText(
            t('editor.prompt_grammar') || 'Bạn là một biên tập viên chuyên nghiệp. Hãy sửa các lỗi chính tả, lỗi ngữ pháp tiếng Việt trong đoạn văn bản sau. Làm cho câu văn trôi chảy hơn nhưng giữ nguyên ý nghĩa gốc. Chỉ trả về văn bản đã sửa, không giải thích.',
            'grammar'
        );
    };

    const handleChangeTone = (tone: 'formal' | 'friendly' | 'persuasive') => {
        const tonePrompts = {
            formal: t('editor.prompt_formal') || 'Viết lại đoạn văn bản sau theo phong cách trang trọng, chuyên nghiệp, lịch sự (phù hợp cho email B2B, hợp đồng). Chỉ trả về văn bản đã viết lại.',
            friendly: t('editor.prompt_friendly') || 'Viết lại đoạn văn bản sau theo phong cách thân thiện, gần gũi, tự nhiên (phù hợp cho chat với khách hàng B2C). Chỉ trả về văn bản đã viết lại.',
            persuasive: t('editor.prompt_persuasive') || 'Viết lại đoạn văn bản sau theo phong cách thuyết phục, hấp dẫn, mang tính chốt sale cao (phù hợp cho quảng cáo bất động sản). Chỉ trả về văn bản đã viết lại.'
        };
        processText(tonePrompts[tone], `tone-${tone}`);
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-[var(--bg-surface)] dark:bg-slate-900 rounded-2xl shadow-sm border border-[var(--glass-border)] dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-[var(--glass-border)] dark:border-slate-800 bg-[var(--glass-surface)]/50 dark:bg-slate-900/50 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <span className="font-semibold text-[var(--text-secondary)] dark:text-slate-200 text-sm">Smart VN Editor</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleRestoreDiacritics}
                        disabled={isProcessing || !text.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] dark:bg-slate-800 border border-[var(--glass-border)] dark:border-slate-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] dark:text-slate-300"
                    >
                        {isProcessing && activeAction === 'diacritics' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        {t('editor.btn_diacritics') || 'Thêm dấu tự động'}
                    </button>
                    
                    <button
                        onClick={handleFixGrammar}
                        disabled={isProcessing || !text.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] dark:bg-slate-800 border border-[var(--glass-border)] dark:border-slate-700 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] dark:text-slate-300"
                    >
                        {isProcessing && activeAction === 'grammar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                        {t('editor.btn_grammar') || 'Sửa ngữ pháp'}
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>

                    <div className="flex bg-[var(--glass-surface-hover)] dark:bg-slate-800 p-0.5 rounded-lg border border-[var(--glass-border)] dark:border-slate-700">
                        <button
                            onClick={() => handleChangeTone('formal')}
                            disabled={isProcessing || !text.trim()}
                            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-[var(--bg-surface)] dark:hover:bg-slate-700 hover:shadow-sm transition-all disabled:opacity-50 text-[var(--text-secondary)] dark:text-slate-300"
                        >
                            {t('editor.tone_formal') || 'Trang trọng'}
                        </button>
                        <button
                            onClick={() => handleChangeTone('friendly')}
                            disabled={isProcessing || !text.trim()}
                            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-[var(--bg-surface)] dark:hover:bg-slate-700 hover:shadow-sm transition-all disabled:opacity-50 text-[var(--text-secondary)] dark:text-slate-300"
                        >
                            {t('editor.tone_friendly') || 'Thân thiện'}
                        </button>
                        <button
                            onClick={() => handleChangeTone('persuasive')}
                            disabled={isProcessing || !text.trim()}
                            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-[var(--bg-surface)] dark:hover:bg-slate-700 hover:shadow-sm transition-all disabled:opacity-50 text-[var(--text-secondary)] dark:text-slate-300"
                        >
                            {t('editor.tone_persuasive') || 'Thuyết phục'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('editor.placeholder') || "Nhập văn bản tiếng Việt (có thể gõ không dấu: 'toi muon mua can ho 3 phong ngu')..."}
                    className="w-full h-64 p-6 bg-transparent border-none resize-none focus:ring-0 text-[var(--text-secondary)] dark:text-slate-200 placeholder:text-[var(--text-muted)] dark:placeholder:text-[var(--text-secondary)] text-base leading-relaxed"
                    spellCheck={false}
                />
                
                {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-[var(--bg-surface)]/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center"
                    >
                        <div className="bg-[var(--bg-surface)] dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-[var(--glass-border)] dark:border-slate-700 flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('editor.processing') || 'Đang xử lý ngôn ngữ...'}
                        </div>
                    </motion.div>
                )}
            </div>
            
            <div className="px-4 py-3 border-t border-[var(--glass-border)] dark:border-slate-800 bg-[var(--glass-surface)]/50 dark:bg-slate-900/50 flex justify-between items-center text-xs text-[var(--text-tertiary)]">
                <span>{text.length} {t('editor.chars') || 'ký tự'} | {text.split(/\s+/).filter(w => w.length > 0).length} {t('editor.words') || 'từ'}</span>
                <span className="flex items-center gap-1">
                    Powered by <span className="font-semibold text-[var(--text-secondary)] dark:text-slate-300">Gemini 3.1</span>
                </span>
            </div>
        </div>
    );
};
