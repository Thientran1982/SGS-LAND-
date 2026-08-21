import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import { api } from '../services/api/apiClient';
import { useTranslation } from '../services/i18n';

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Array<{ tool?: string; source?: string }>;
    dataScope?: 'personal' | 'company';
    freshness?: string;
    status?: 'ok' | 'empty' | 'forbidden';
};

type AssistantResponse = {
    response?: string;
    sources?: Array<{ tool?: string; source?: string }>;
    dataScope?: 'personal' | 'company';
    freshness?: string;
    status?: 'ok' | 'empty' | 'forbidden';
};

const MAX_HISTORY = 12;

export const GuideAssistant: React.FC = () => {
    const { language } = useTranslation();
    const isVietnamese = language === 'vn';
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const endRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef(`guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const copy = isVietnamese ? {
        title: 'Trợ lý hướng dẫn',
        subtitle: 'Hỏi về cách dùng và dữ liệu bạn được phép xem',
        placeholder: 'Bạn muốn hỏi điều gì?',
        welcome: 'Xin chào! Tôi có thể hướng dẫn cách dùng SGS LAND hoặc tra cứu số liệu trong phạm vi quyền của bạn.',
        suggestion1: 'Tôi có thể làm gì trên Dashboard?',
        suggestion2: 'Tóm tắt các lead hiện tại',
        suggestion3: 'Làm thế nào để tạo một lead?',
        empty: 'Chưa có cuộc trò chuyện',
        reset: 'Bắt đầu lại',
        close: 'Đóng trợ lý',
        open: 'Mở trợ lý hướng dẫn',
        sending: 'Đang tra cứu...',
        error: 'Không thể kết nối trợ lý. Vui lòng thử lại.',
        source: 'Nguồn',
        scope: 'Dữ liệu theo quyền truy cập của bạn',
    } : {
        title: 'Guide assistant',
        subtitle: 'Ask about workflows and data you can access',
        placeholder: 'What would you like to ask?',
        welcome: 'Hello! I can guide you through SGS LAND or look up metrics within your access scope.',
        suggestion1: 'What can I do on the Dashboard?',
        suggestion2: 'Summarize the current leads',
        suggestion3: 'How do I create a lead?',
        empty: 'No conversation yet',
        reset: 'Start over',
        close: 'Close assistant',
        open: 'Open guide assistant',
        sending: 'Looking it up...',
        error: 'The assistant could not connect. Please try again.',
        source: 'Source',
        scope: 'Data is limited to your access scope',
    };

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open, sending]);

    const reset = () => {
        sessionIdRef.current = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setMessages([]);
        setError('');
        setInput('');
    };

    const send = async (value = input) => {
        const message = value.trim();
        if (!message || sending) return;
        const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: message };
        const history = messages.slice(-MAX_HISTORY).map(item => ({ role: item.role, content: item.content }));
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setError('');
        setSending(true);
        try {
            const result = await api.post<AssistantResponse>('/api/live-chat/chat', {
                message,
                sessionId: sessionIdRef.current,
                context: {
                    mode: 'platform_guide',
                    language,
                    history,
                },
            });
            const response = typeof result?.response === 'string' && result.response.trim()
                ? result.response.trim()
                : (isVietnamese ? 'Tôi chưa có đủ dữ liệu để trả lời câu hỏi này.' : 'I do not have enough verified data to answer that.');
            setMessages(prev => [...prev, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: response,
                sources: Array.isArray(result?.sources) ? result.sources : [],
                dataScope: result?.dataScope,
                freshness: result?.freshness,
                status: result?.status,
            }]);
        } catch {
            setError(copy.error);
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {open && (
                <section
                    className="fixed bottom-20 right-4 sm:right-6 sm:bottom-24 z-[140] w-[min(calc(100vw-2rem),390px)] h-[min(650px,calc(100dvh-7rem))] flex flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
                    aria-label={copy.title}
                >
                    <header className="flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sgs-primary)]/12 text-[var(--sgs-primary)]">
                            <Bot size={21} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-sm font-bold text-[var(--text-primary)]">{copy.title}</h2>
                            <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-tertiary)]">{copy.subtitle}</p>
                        </div>
                        <button type="button" onClick={reset} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)]" title={copy.reset} aria-label={copy.reset}>
                            <RefreshCw size={16} />
                        </button>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)]" title={copy.close} aria-label={copy.close}>
                            <X size={17} />
                        </button>
                    </header>

                    <div className="flex-1 space-y-3 overflow-y-auto p-3">
                        {messages.length === 0 && (
                            <div className="space-y-3">
                                <div className="rounded-2xl rounded-tl-sm bg-[var(--glass-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--text-secondary)]">
                                    {copy.welcome}
                                </div>
                                <div className="space-y-2">
                                    {[copy.suggestion1, copy.suggestion2, copy.suggestion3].map(item => (
                                        <button key={item} type="button" onClick={() => send(item)} className="block w-full rounded-xl border border-[var(--glass-border)] px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--sgs-primary)]/40 hover:bg-[var(--sgs-primary)]/5">
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map(message => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-sm bg-[var(--sgs-primary)] text-white' : 'rounded-bl-sm bg-[var(--glass-surface)] text-[var(--text-secondary)]'}`}>
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                    {message.role === 'assistant' && (
                                        <div className="mt-2 border-t border-[var(--glass-border)]/70 pt-1.5 text-[10px] text-[var(--text-tertiary)]">
                                     {message.sources?.length
                                         ? `${copy.source}: ${message.sources.map(source => source.source || source.tool).filter(Boolean).join(', ')}${message.dataScope ? ` · ${message.dataScope === 'personal' ? (isVietnamese ? 'cá nhân' : 'personal') : (isVietnamese ? 'công ty' : 'company')}` : ''}${message.freshness ? ` · ${new Date(message.freshness).toLocaleString(isVietnamese ? 'vi-VN' : 'en-US')}` : ''}`
                                         : copy.scope}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl rounded-bl-sm bg-[var(--glass-surface)] px-3 py-2.5 text-xs text-[var(--text-tertiary)]">
                                    <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--sgs-primary)]" />
                                    {copy.sending}
                                </div>
                            </div>
                        )}
                        {error && <div className="rounded-xl border border-[var(--ui-danger)]/25 bg-[var(--ui-danger)]/5 px-3 py-2 text-xs text-[var(--ui-danger)]">{error}</div>}
                        <div ref={endRef} />
                    </div>

                    <form onSubmit={event => { event.preventDefault(); void send(); }} className="border-t border-[var(--glass-border)] bg-[var(--glass-surface)] p-3">
                        <div className="flex items-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] focus-within:border-[var(--sgs-primary)]">
                        <textarea
                            value={input}
                            onChange={event => setInput(event.target.value)}
                            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }}
                            placeholder={copy.placeholder}
                            rows={1}
                            maxLength={600}
                            className="min-h-10 max-h-24 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] sm:text-sm"
                            aria-label={copy.placeholder}
                        />
                        <button type="submit" disabled={!input.trim() || sending} className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sgs-primary)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label={copy.placeholder}>
                            <Send size={17} />
                        </button>
                        </div>
                    </form>
                </section>
            )}
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="group fixed bottom-4 right-4 sm:right-6 z-[139] flex h-12 w-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--sgs-primary)] px-3 text-sm font-bold text-white shadow-lg shadow-[var(--sgs-primary)]/25 transition-[width,transform] duration-200 hover:w-auto hover:scale-[1.02] focus-visible:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] focus-visible:ring-offset-2"
                aria-label={open ? copy.close : copy.open}
                title={open ? copy.close : copy.open}
            >
                {open ? <ChevronDown size={18} /> : <MessageCircle size={18} />}
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">{copy.title}</span>
            </button>
        </>
    );
};