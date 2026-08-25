import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, MessageCircle, RefreshCw, Send, X, LifeBuoy, Clock3 } from 'lucide-react';
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
    escalationReason?: string;
};

type AssistantResponse = {
    response?: string;
    intent?: string;
    sources?: Array<{ tool?: string; source?: string }>;
    dataScope?: 'personal' | 'company';
    freshness?: string;
    status?: 'ok' | 'empty' | 'forbidden';
    escalationReason?: string;
};

type SupportRequest = {
    id: string; trackingCode: string; title: string; status: string; updatedAt: string;
    latestReply?: string | null;
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
    const [support, setSupport] = useState<SupportRequest[]>([]);
    const [supportDraft, setSupportDraft] = useState<{ title: string; description: string } | null>(null);
    const [supportConsent, setSupportConsent] = useState(false);
    const [supportSending, setSupportSending] = useState(false);
    const [togglePosition, setTogglePosition] = useState<{ left: number; top: number } | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef(`guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const togglePositionRef = useRef(togglePosition);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const dragStartRef = useRef({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const movedRef = useRef(false);

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem('sgs_guide_toggle_position');
            if (saved) {
                const position = JSON.parse(saved);
                if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
                    setTogglePosition({ left: position.left, top: position.top });
                }
            }
        } catch {
            // Ignore malformed local position and use the default corner.
        }
    }, []);

    useEffect(() => {
        togglePositionRef.current = togglePosition;
    }, [togglePosition]);

    const handleTogglePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        draggingRef.current = true;
        movedRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleTogglePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!draggingRef.current) return;
        const deltaX = Math.abs(event.clientX - dragStartRef.current.x);
        const deltaY = Math.abs(event.clientY - dragStartRef.current.y);
        if (deltaX > 4 || deltaY > 4) movedRef.current = true;
        const width = event.currentTarget.offsetWidth;
        const height = event.currentTarget.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragOffsetRef.current.x));
        const top = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragOffsetRef.current.y));
        setTogglePosition({ left, top });
    };

    const handleTogglePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (movedRef.current && togglePositionRef.current) {
            window.localStorage.setItem('sgs_guide_toggle_position', JSON.stringify(togglePositionRef.current));
        }
    };

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
        escalation: 'Cần nhân viên xác minh',
        support: 'Tạo yêu cầu hỗ trợ',
        supportTitle: 'Gửi yêu cầu cho nhân viên',
        supportDescription: 'Mô tả ngắn gọn vấn đề (không gửi mật khẩu, OTP, token hoặc thông tin thẻ).',
        supportConsent: 'Tôi đồng ý gửi thông tin này cho nhân viên SGS LAND để xử lý.',
        submitSupport: 'Gửi yêu cầu',
        tracking: 'Mã yêu cầu',
        updated: 'Cập nhật',
        received: 'Đã tiếp nhận',
        supportError: 'Không thể tạo yêu cầu. Vui lòng thử lại.',
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
        escalation: 'Employee verification required',
        support: 'Create support request',
        supportTitle: 'Send to an employee',
        supportDescription: 'Briefly describe the issue (do not send passwords, OTPs, tokens or card details).',
        supportConsent: 'I agree to send this information to an SGS LAND employee for handling.',
        submitSupport: 'Submit request',
        tracking: 'Request code',
        updated: 'Updated',
        received: 'Received',
        supportError: 'Could not create the request. Please try again.',
    };

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open, sending]);

    useEffect(() => {
        if (!open) return;
        api.get<{ data: SupportRequest[] }>('/api/live-chat/support-requests')
            .then(result => setSupport(Array.isArray(result?.data) ? result.data : []))
            .catch(() => { /* Support history is optional; chat remains usable. */ });
    }, [open]);

    const reset = () => {
        sessionIdRef.current = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setMessages([]);
        setError('');
        setInput('');
        setSupportDraft(null);
    };

    const createSupportRequest = async () => {
        if (!supportDraft || !supportConsent || supportSending) return;
        setSupportSending(true);
        try {
            const created = await api.post<SupportRequest>('/api/live-chat/support-requests', {
                ...supportDraft, category: 'GUIDE_ESCALATION', sourceSessionId: sessionIdRef.current, consent: true,
            });
            setSupport(prev => [created, ...prev.filter(item => item.id !== created.id)]);
            setSupportDraft(null);
            setSupportConsent(false);
        } catch {
            setError(copy.supportError);
        } finally { setSupportSending(false); }
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
            const rawResponse = typeof result?.response === 'string' && result.response.trim()
                ? result.response.trim()
                : (isVietnamese ? 'Tôi chưa có đủ dữ liệu để trả lời câu hỏi này.' : 'I do not have enough verified data to answer that.');
            setMessages(prev => [...prev, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: rawResponse,
                sources: Array.isArray(result?.sources) ? result.sources : [],
                dataScope: result?.dataScope,
                freshness: result?.freshness,
                status: result?.status,
                escalationReason: result?.escalationReason,
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
                        {support.length > 0 && (
                            <div className="rounded-xl border border-[var(--sgs-primary)]/20 bg-[var(--sgs-primary)]/5 p-2.5">
                                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]"><Clock3 size={14} /> {copy.support}</div>
                                {support.slice(0, 3).map(item => <div key={item.id} className="border-t border-[var(--glass-border)] py-1.5 text-[11px] text-[var(--text-secondary)]">
                                    <b>{item.trackingCode}</b> · {item.status} · {copy.updated}: {new Date(item.updatedAt).toLocaleString(isVietnamese ? 'vi-VN' : 'en-US')}
                                    {item.latestReply && <div className="mt-1">{item.latestReply}</div>}
                                </div>)}
                            </div>
                        )}
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
                                         {message.escalationReason
                                          ? copy.escalation
                                          : message.sources?.length
                                              ? `${copy.source}: ${message.sources.map(source => source.source || source.tool).filter(Boolean).join(', ')}${message.dataScope ? ` · ${message.dataScope === 'personal' ? (isVietnamese ? 'cá nhân' : 'personal') : (isVietnamese ? 'công ty' : 'company')}` : ''}${message.freshness ? ` · ${new Date(message.freshness).toLocaleString(isVietnamese ? 'vi-VN' : 'en-US')}` : ''}`
                                              : copy.scope}
                                        </div>
                                    )}
                                    {message.role === 'assistant' && message.escalationReason && (
                                        <button type="button" onClick={() => setSupportDraft({ title: message.content.slice(0, 120), description: message.content })} className="mt-2 flex items-center gap-1 rounded-lg border border-[var(--sgs-primary)]/30 px-2 py-1 text-[11px] font-semibold text-[var(--sgs-primary)]">
                                            <LifeBuoy size={13} /> {copy.support}
                                        </button>
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
                        {supportDraft && <div className="rounded-xl border border-[var(--sgs-primary)]/30 bg-[var(--bg-surface)] p-3">
                            <div className="mb-1 text-xs font-bold text-[var(--text-primary)]">{copy.supportTitle}</div>
                            <textarea value={supportDraft.description} onChange={e => setSupportDraft({ ...supportDraft, description: e.target.value })} maxLength={2000} rows={3} className="w-full rounded-lg border border-[var(--glass-border)] bg-transparent p-2 text-xs text-[var(--text-primary)] outline-none" aria-label={copy.supportDescription} />
                            <label className="mt-2 flex gap-2 text-[11px] text-[var(--text-secondary)]"><input type="checkbox" checked={supportConsent} onChange={e => setSupportConsent(e.target.checked)} /> {copy.supportConsent}</label>
                            <button type="button" disabled={!supportConsent || supportSending} onClick={() => void createSupportRequest()} className="mt-2 rounded-lg bg-[var(--sgs-primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">{copy.submitSupport}</button>
                        </div>}
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
                onClick={() => { if (!movedRef.current) setOpen(value => !value); movedRef.current = false; }}
                onPointerDown={handleTogglePointerDown}
                onPointerMove={handleTogglePointerMove}
                onPointerUp={handleTogglePointerUp}
                style={togglePosition ? { left: togglePosition.left, top: togglePosition.top, right: 'auto', bottom: 'auto' } : undefined}
                className="group fixed bottom-4 right-4 sm:right-6 z-[139] flex h-12 w-12 touch-none cursor-grab items-center justify-center gap-0 overflow-hidden rounded-full bg-[var(--sgs-primary)] px-3 text-sm font-bold text-white shadow-lg shadow-[var(--sgs-primary)]/25 transition-[width,transform] duration-200 hover:w-auto hover:scale-[1.02] active:cursor-grabbing focus-visible:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] focus-visible:ring-offset-2"
                aria-label={open ? copy.close : copy.open}
                title={open ? copy.close : copy.open}
            >
                 <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                     {open ? <ChevronDown size={18} /> : <MessageCircle size={18} />}
                 </span>
                 <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-200 group-hover:ml-2 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">{copy.title}</span>
            </button>
        </>
    );
};