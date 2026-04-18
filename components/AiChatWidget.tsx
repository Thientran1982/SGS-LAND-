/**
 * AiChatWidget — Floating livechat popup
 *
 * Reuses the exact same public API as LiveChat.tsx:
 *   POST /api/public/leads
 *   POST /api/public/livechat/message
 *   POST /api/public/ai/livechat
 *   GET  /api/public/livechat/messages/:leadId
 * Real-time via socket.io (join_livechat_room / receive_message / ai_mode_changed)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bot, Sparkles, User, RefreshCw } from 'lucide-react';
import { useSocket } from '../services/websocket';
import { useTranslation } from '../services/i18n';
import { MessageBubble } from './ChatUI';
import { Interaction, Channel, Direction } from '../types';

// ─── Public API helpers ────────────────────────────────────────────────────────

async function publicCreateLead(name: string, phone: string, source = 'WIDGET') {
    const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, source, stage: 'NEW' })
    });
    if (!res.ok) throw new Error('create_lead_failed');
    return res.json() as Promise<{ id: string; success: boolean }>;
}

async function publicSendMessage(
    leadId: string,
    content: string,
    direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
    metadata?: object
) {
    const res = await fetch('/api/public/livechat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, content, direction, metadata: metadata || {} })
    });
    if (!res.ok) throw new Error('send_failed');
    const data = await res.json();
    return data.message as Interaction;
}

async function publicGetMessages(leadId: string) {
    const res = await fetch(`/api/public/livechat/messages/${leadId}`);
    if (!res.ok) return null;
    return res.json() as Promise<{
        messages: Interaction[];
        lead: { id: string; name: string; assignedTo?: string | null; threadStatus?: string };
    }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SYS_PATTERNS = ['đang bận', 'system busy', 'tạm thời không khả dụng', 'temporarily busy'];

function isSysMsg(msg: Interaction): boolean {
    if ((msg as any).metadata?.isSysMsg) return true;
    if ((msg as any).metadata?.isAgent && msg.direction === 'OUTBOUND') {
        const c = (msg.content || '').toLowerCase();
        return SYS_PATTERNS.some(p => c.includes(p));
    }
    return false;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiChatWidget({ isOpen, onClose }: AiChatWidgetProps) {
    const { t, language } = useTranslation();
    const { socket } = useSocket();

    const [leadId, setLeadId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [startError, setStartError] = useState('');
    const [messages, setMessages] = useState<Interaction[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isHumanMode, setIsHumanMode] = useState(false);
    const [modeNotice, setModeNotice] = useState<'HUMAN_TAKEOVER' | 'AI_ACTIVE' | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const autoReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Restore session from localStorage ──
    useEffect(() => {
        const savedId = localStorage.getItem('widget_lead_id');
        if (!savedId) return;
        publicGetMessages(savedId).then(data => {
            if (data) {
                setLeadId(data.lead.id);
                setIsHumanMode(data.lead.threadStatus === 'HUMAN_TAKEOVER');
                setMessages((data.messages || []).filter(m => !isSysMsg(m)));
            } else {
                localStorage.removeItem('widget_lead_id');
            }
        }).catch(() => localStorage.removeItem('widget_lead_id'));
    }, []);

    // ── Socket: join room & handle events ──
    useEffect(() => {
        if (!leadId) return;
        socket.emit('join_livechat_room', leadId);

        const onMsg = (data: any) => {
            const msg: Interaction = data?.message ?? data;
            if (!msg || msg.leadId !== leadId) return;
            setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
            setIsThinking(false);
        };

        const onMode = (data: any) => {
            if (data?.leadId !== leadId) return;
            const toHuman = data.status === 'HUMAN_TAKEOVER';
            setIsHumanMode(toHuman);
            setModeNotice(toHuman ? 'HUMAN_TAKEOVER' : 'AI_ACTIVE');
            setIsThinking(false);
        };

        socket.on('receive_message', onMsg);
        socket.on('ai_mode_changed', onMode);
        return () => {
            socket.off('receive_message', onMsg);
            socket.off('ai_mode_changed', onMode);
            socket.emit('leave_room', leadId);
        };
    }, [leadId, socket]);

    // ── Scroll to bottom ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    // ── Focus input when opened & chat already started ──
    useEffect(() => {
        if (isOpen && leadId) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, leadId]);

    // ── Start chat ──
    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;
        setStartError('');
        try {
            const created = await publicCreateLead(name.trim(), phone.trim(), 'WIDGET');
            const id = created.id;
            const welcomeMsg = await publicSendMessage(
                id,
                t('livechat.welcome_msg').replace('{name}', name.trim()),
                'OUTBOUND',
                { isAgent: true }
            );
            setLeadId(id);
            setMessages([welcomeMsg]);
            localStorage.setItem('widget_lead_id', id);
        } catch {
            setStartError('Không thể kết nối. Vui lòng thử lại.');
        }
    };

    // ── Send message ──
    const handleSend = useCallback(async () => {
        if (!input.trim() || !leadId) return;
        const content = input.trim();
        setInput('');

        let msg: Interaction | null = null;
        try {
            msg = await publicSendMessage(leadId, content, 'INBOUND');
            msg.direction = Direction.INBOUND;
            setMessages(prev => prev.some(m => m.id === msg!.id) ? prev : [...prev, msg!]);
            socket.emit('send_message', { room: leadId, message: msg });
        } catch {
            const temp: Interaction = {
                id: `temp-${Date.now()}`,
                leadId,
                channel: Channel.WEB,
                direction: Direction.INBOUND,
                type: 'TEXT',
                content,
                timestamp: new Date().toISOString(),
                metadata: {}
            } as any;
            setMessages(prev => [...prev, temp]);
        }

        if (isHumanMode) return;
        setIsThinking(true);
        if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current);
        autoReplyTimer.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/public/ai/livechat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId, message: content, lang: language })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.noReply) return;
                    const aiMsg: Interaction = data.reply;
                    if (aiMsg) {
                        setMessages(prev => prev.find(m => m.id === aiMsg.id) ? prev : [...prev, aiMsg]);
                        socket.emit('send_message', { room: leadId, message: aiMsg });
                    }
                } else {
                    const fallback = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                    if (fallback) setMessages(prev => [...prev, fallback]);
                }
            } catch {
                const fallback = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                if (fallback) setMessages(prev => [...prev, fallback]);
            } finally {
                setIsThinking(false);
            }
        }, 500);
    }, [input, leadId, isHumanMode, language, socket, t]);

    // ── Reset session ──
    const handleReset = () => {
        localStorage.removeItem('widget_lead_id');
        setLeadId(null);
        setMessages([]);
        setName('');
        setPhone('');
        setInput('');
        setIsThinking(false);
        setIsHumanMode(false);
        setModeNotice(null);
    };

    // ── Cleanup timer on unmount ──
    useEffect(() => () => { if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current); }, []);

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="widget"
                    initial={{ opacity: 0, y: 24, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                    className="fixed bottom-24 md:bottom-28 right-4 md:right-6 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-[var(--glass-border)] flex flex-col"
                    style={{
                        height: '520px',
                        maxHeight: 'calc(100dvh - 8rem)',
                        boxShadow: '0 24px 64px rgba(99,102,241,0.18), 0 4px 16px rgba(0,0,0,0.12)'
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        className="shrink-0 flex items-center justify-between px-4 py-3 text-white"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                                {isHumanMode
                                    ? <User className="w-5 h-5" />
                                    : <Bot className="w-5 h-5" />
                                }
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-sm leading-tight">SGS LAND AI</p>
                                <div className="flex items-center gap-1.5 text-white/80 text-xs">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
                                    <span>{isHumanMode ? t('livechat.agent_assisting') : t('livechat.ai_assisting')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {leadId && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    title="Cuộc trò chuyện mới"
                                    className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                aria-label="Đóng chat"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── Body: registration OR chat ── */}
                    {!leadId ? (
                        /* Registration form */
                        <div className="flex-1 overflow-y-auto bg-[var(--bg-surface)] flex flex-col justify-center p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-[var(--text-primary)]">Trợ lý AI bất động sản</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">Tư vấn miễn phí · Phản hồi ngay</p>
                                </div>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                                Để lại tên và số điện thoại để bắt đầu trò chuyện. AI sẽ tư vấn dự án, giá, pháp lý — mọi lúc, mọi nơi.
                            </p>
                            {startError && (
                                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">{startError}</p>
                            )}
                            <form onSubmit={handleStart} className="space-y-3">
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder={t('livechat.name_placeholder')}
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all bg-[var(--bg-app)]"
                                />
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder={t('livechat.phone_placeholder')}
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all bg-[var(--bg-app)]"
                                />
                                <button
                                    type="submit"
                                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                >
                                    {t('livechat.start_chat')}
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* Chat view */
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-[var(--glass-surface)]/50">
                                {modeNotice && (
                                    <div className="flex justify-center py-0.5">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
                                            modeNotice === 'HUMAN_TAKEOVER'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                        }`}>
                                            {modeNotice === 'HUMAN_TAKEOVER'
                                                ? t('livechat.agent_takeover_notice')
                                                : t('livechat.ai_resume_notice')}
                                        </span>
                                    </div>
                                )}
                                {messages.map((msg, idx, arr) => (
                                    <MessageBubble
                                        key={msg.id}
                                        msg={msg}
                                        t={t}
                                        formatTime={(iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        formatDate={(iso: string) => new Date(iso).toLocaleDateString()}
                                        formatCurrency={(v: number) => v.toLocaleString() + 'đ'}
                                        formatDateTime={(iso: string) => new Date(iso).toLocaleString()}
                                        showDate={idx === 0 || new Date(msg.timestamp).getDate() !== new Date(arr[idx - 1].timestamp).getDate()}
                                    />
                                ))}
                                {isThinking && (
                                    <div className="flex justify-start animate-pulse">
                                        <div className="bg-[var(--bg-surface)] border border-indigo-100 text-indigo-600 px-4 py-2.5 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-2 shadow-sm">
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:75ms]" />
                                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                            </div>
                                            {t('livechat.replying')}
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="shrink-0 p-3 bg-[var(--bg-surface)] border-t border-[var(--glass-border)]">
                                <div className="flex items-end gap-2 bg-[var(--glass-surface)] p-2 rounded-xl border border-[var(--glass-border)] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder={t('livechat.input_placeholder')}
                                        rows={1}
                                        className="flex-1 bg-transparent border-none text-[16px] md:text-sm outline-none max-h-24 min-h-[36px] py-1.5 px-2 resize-none placeholder:text-[var(--text-muted)] no-scrollbar"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!input.trim() || isThinking}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                        aria-label="Gửi"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                                    {t('livechat.powered_by')} <span className="font-bold text-[var(--text-tertiary)]">SGS Land AI</span>
                                </p>
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
