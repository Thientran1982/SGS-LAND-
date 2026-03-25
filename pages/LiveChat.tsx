import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../services/i18n';
import { useSocket } from '../services/websocket';
import { Interaction, Channel, Direction } from '../types';
import { MessageBubble } from '../components/ChatUI';
import { motion } from 'motion/react';

// ---------------------------------------------------------------------------
// Public API helpers — no JWT required, all routes are rate-limited
// ---------------------------------------------------------------------------

async function publicCreateLead(name: string, phone: string) {
    const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, source: 'WEB', stage: 'NEW' })
    });
    if (!res.ok) throw new Error('create_lead_failed');
    return res.json() as Promise<{ id: string; success: boolean }>;
}

async function publicSendMessage(leadId: string, content: string, direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND', metadata?: object) {
    const res = await fetch('/api/public/livechat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, content, direction, metadata: metadata || {} })
    });
    if (!res.ok) throw new Error('send_failed');
    const data = await res.json();
    return data.message as Interaction;
}

async function publicGetMessages(leadId: string): Promise<{ messages: Interaction[]; lead: { id: string; name: string } } | null> {
    const res = await fetch(`/api/public/livechat/messages/${leadId}`);
    if (!res.ok) return null;
    return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Parse query params from hash-based URL (e.g. /#/livechat?title=...&desc=...)
function getHashQueryParams(): URLSearchParams {
    const hash = window.location.hash; // "#/livechat?title=...&desc=..."
    const qIndex = hash.indexOf('?');
    return new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '');
}

export default function LiveChat() {
    const { t, language } = useTranslation();
    const { socket } = useSocket();
    const [leadId, setLeadId] = useState<string | null>(null);
    const [leadName, setLeadName] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [messages, setMessages] = useState<Interaction[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [startError, setStartError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Resolve title/desc from URL params > window globals (embed) > default translations
    const [chatParams, setChatParams] = useState(() => getHashQueryParams());
    useEffect(() => {
        const handler = () => setChatParams(getHashQueryParams());
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, []);
    const w = window as any;
    const chatTitle = chatParams.get('title') || w.SGSLAND_CHAT_TITLE || t('livechat.title');
    const chatDesc  = chatParams.get('desc')  || w.SGSLAND_CHAT_DESC  || t('livechat.subtitle');

    // Load lead from localStorage if exists
    useEffect(() => {
        const savedId = localStorage.getItem('livechat_lead_id');
        if (!savedId) return;
        publicGetMessages(savedId).then(data => {
            if (data) {
                setLeadId(data.lead.id);
                setLeadName(data.lead.name);
                setMessages(data.messages || []);
            } else {
                localStorage.removeItem('livechat_lead_id');
            }
        }).catch(() => {
            localStorage.removeItem('livechat_lead_id');
        });
    }, []);

    useEffect(() => {
        if (!leadId) return;
        socket.emit('join_room', leadId);

        const handleNewMessage = (data: any) => {
            const msg: Interaction = data?.message ?? data;
            if (!msg || msg.leadId !== leadId) return;
            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setIsThinking(false);
        };

        socket.on('receive_message', handleNewMessage);
        return () => {
            socket.off('receive_message', handleNewMessage);
            socket.emit('leave_room', leadId);
        };
    }, [leadId, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleStartChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;
        setStartError('');

        try {
            const created = await publicCreateLead(name.trim(), phone.trim());
            const id = created.id;

            // Send welcome message as outbound (agent) — no auth needed
            const welcomeContent = t('livechat.welcome_msg').replace('{name}', name.trim());
            const welcomeMsg = await publicSendMessage(id, welcomeContent, 'OUTBOUND', { isAgent: true });

            setLeadId(id);
            setLeadName(name.trim());
            setMessages([welcomeMsg]);
            localStorage.setItem('livechat_lead_id', id);

            socket.emit('lead_created', { id, name: name.trim(), phone: phone.trim() });
            socket.emit('send_message', { room: id, message: welcomeMsg });
        } catch (_err) {
            setStartError(t('auth.error_generic'));
        }
    };

    const autoReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSend = async () => {
        if (!input.trim() || !leadId) return;

        const content = input.trim();
        setInput('');

        // 1. Save customer inbound message
        let msg: Interaction | null = null;
        try {
            msg = await publicSendMessage(leadId, content, 'INBOUND');
            msg.direction = Direction.INBOUND;
            setMessages(prev => [...prev, msg!]);
            socket.emit('send_message', { room: leadId, message: msg });
        } catch {
            // If save failed, show message locally anyway
            const tempMsg: Interaction = {
                id: `temp-${Date.now()}`,
                leadId,
                channel: Channel.WEB,
                direction: Direction.INBOUND,
                type: 'TEXT',
                content,
                timestamp: new Date().toISOString(),
                metadata: {}
            } as any;
            setMessages(prev => [...prev, tempMsg]);
        }

        // 2. Call AI reply
        setIsThinking(true);
        if (autoReplyTimerRef.current) clearTimeout(autoReplyTimerRef.current);

        autoReplyTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/public/ai/livechat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId, message: content, lang: language })
                });

                if (res.ok) {
                    const data = await res.json();
                    const aiMsg: Interaction = data.reply;
                    setMessages(prev => {
                        if (prev.find(m => m.id === aiMsg.id)) return prev;
                        return [...prev, aiMsg];
                    });
                    socket.emit('send_message', { room: leadId, message: aiMsg });
                } else {
                    // Fallback canned reply
                    const fallbackMsg = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                    if (fallbackMsg) setMessages(prev => [...prev, fallbackMsg]);
                }
            } catch {
                const fallbackMsg = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                if (fallbackMsg) setMessages(prev => [...prev, fallbackMsg]);
            } finally {
                setIsThinking(false);
            }
        }, 500);
    };

    useEffect(() => {
        return () => {
            if (autoReplyTimerRef.current) clearTimeout(autoReplyTimerRef.current);
        };
    }, []);

    const handleEndChat = () => {
        localStorage.removeItem('livechat_lead_id');
        setLeadId(null);
        setLeadName('');
        setMessages([]);
        setName('');
        setPhone('');
    };

    if (!leadId) {
        return (
            <div className="min-h-full w-full bg-[var(--glass-surface)] flex flex-col p-4 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto no-scrollbar">
                <div className="flex-1 min-h-[2rem]"></div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-surface)] p-6 md:p-8 rounded-2xl shadow-xl max-w-md w-full border border-[var(--glass-border)] mx-auto shrink-0">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-200">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 leading-tight py-1">{chatTitle}</h1>
                    <p className="text-[var(--text-tertiary)] mb-6 text-sm">{chatDesc}</p>

                    {startError && (
                        <div className="mb-4 text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3" role="alert">
                            {startError}
                        </div>
                    )}

                    <form onSubmit={handleStartChat} className="space-y-4">
                        <div>
                            <label htmlFor="lc-name" className="block text-sm font-bold text-[var(--text-secondary)] mb-1">{t('livechat.name_label')}</label>
                            <input id="lc-name" type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder={t('livechat.name_placeholder')} />
                        </div>
                        <div>
                            <label htmlFor="lc-phone" className="block text-sm font-bold text-[var(--text-secondary)] mb-1">{t('livechat.phone_label')}</label>
                            <input id="lc-phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder={t('livechat.phone_placeholder')} />
                        </div>
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200 mt-2">
                            {t('livechat.start_chat')}
                        </button>
                    </form>
                </motion.div>
                <div className="flex-1 min-h-[2rem]"></div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-[var(--glass-surface)] flex flex-col max-w-2xl mx-auto shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between shadow-md z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--bg-surface)]/20 rounded-full flex items-center justify-center backdrop-blur shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg leading-tight truncate py-0.5">{t('livechat.support_online')}</h2>
                        <div className="flex items-center gap-1.5 text-indigo-100 text-xs">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0"></span>
                            <span className="truncate">{t('livechat.we_are_online')}</span>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleEndChat}
                    className="text-indigo-200 hover:text-white transition-colors text-xs font-bold bg-indigo-700/50 px-3 py-1.5 rounded-lg shrink-0 ml-2"
                >
                    {t('livechat.end_chat')}
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-[var(--glass-surface)]/50">
                {messages.map((msg, idx) => (
                    <MessageBubble
                        key={msg.id}
                        msg={msg}
                        t={t}
                        formatTime={(iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        formatDate={(iso: string) => new Date(iso).toLocaleDateString()}
                        formatCurrency={(v: number) => v.toLocaleString() + 'đ'}
                        formatDateTime={(iso: string) => new Date(iso).toLocaleString()}
                        showDate={idx === 0 || new Date(msg.timestamp).getDate() !== new Date(messages[idx-1].timestamp).getDate()}
                    />
                ))}
                {isThinking && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-[var(--bg-surface)] border border-indigo-100 text-indigo-600 px-4 py-3 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-2 shadow-sm">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                            {t('livechat.replying')}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[var(--bg-surface)] border-t border-[var(--glass-border)] shrink-0">
                <div className="flex items-end gap-2 bg-[var(--glass-surface)] p-2 rounded-2xl border border-[var(--glass-border)] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="flex-1 bg-transparent border-none text-sm outline-none max-h-32 min-h-[40px] py-2 px-2 resize-none placeholder:text-[var(--text-muted)] no-scrollbar"
                        placeholder={t('livechat.input_placeholder')}
                        rows={1}
                        aria-label={t('livechat.input_placeholder')}
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-slate-300 transition-colors"
                        aria-label={t('livechat.replying')}
                    >
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div className="text-center mt-3 text-xs2 text-slate-400 font-medium">
                    {t('livechat.powered_by')} <span className="font-bold text-[var(--text-tertiary)]">SGS Land AI</span>
                </div>
            </div>
        </div>
    );
}
