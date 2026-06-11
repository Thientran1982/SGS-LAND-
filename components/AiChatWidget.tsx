/**
 * AiChatWidget — Floating livechat popup (rewrite v2)
 *
 * 3 cơ chế mới:
 *   1. Lead Capture   — AI reply trigger phrase → inline form (name/phone/note) → capture_lead
 *   2. Smart Escalation — user escalation keywords → block AI → show transfer + lead form
 *   3. Proactive UX   — first open: 5 quick chips; after 3 msgs: action buttons
 *
 * UX: session persistence (sessionStorage 30 msgs), typing dots, online indicator,
 *     phone hotline in header, user avatar.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bot, Sparkles, User, RefreshCw, Phone, Calendar, PhoneCall } from 'lucide-react';
import { useSocket } from '../services/websocket';
import { useTranslation } from '../services/i18n';
import { MessageBubble } from './ChatUI';
import { Interaction, Channel, Direction } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const HOTLINE = '0971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const LEAD_KEY = 'widget_lead_id';
const SESSION_MSGS_KEY = 'widget_msgs_v2';
const MAX_SESSION_MSGS = 30;

const QUICK_REPLY_KEYS = [
    { labelKey: 'livechat.qr_apt',       msgKey: 'livechat.qr_apt_msg'       },
    { labelKey: 'livechat.qr_longthanh', msgKey: 'livechat.qr_longthanh_msg' },
    { labelKey: 'livechat.qr_valuate',   msgKey: 'livechat.qr_valuate_msg'   },
    { labelKey: 'livechat.qr_rate',      msgKey: 'livechat.qr_rate_msg'      },
    { labelKey: 'livechat.qr_legal',     msgKey: 'livechat.qr_legal_msg'     },
];

const ACTION_BUTTON_KEYS = [
    { labelKey: 'livechat.ab_viewing',  action: 'book_viewing'  },
    { labelKey: 'livechat.ab_callback', action: 'callback'      },
    { labelKey: 'livechat.ab_projects', action: 'view_projects' },
];

// Smart Escalation — intercept before AI
const ESCALATION_KEYWORDS = [
    'nói chuyện người thật', 'nói với người thật', 'người thật', 'nhân viên thật',
    'tư vấn viên thật', 'gặp người', 'tư vấn trực tiếp', 'cho tôi gặp',
    'xin nói chuyện', 'sai rồi', 'không đúng rồi', 'chán quá', 'chán rồi',
    'thất vọng', 'không hài lòng', 'muốn gặp người', 'ai đó giúp tôi',
    'không hiểu tôi', 'hiểu sai rồi',
];

// Lead Capture — detect from AI response text
const LEAD_CAPTURE_PATTERNS = [
    /để lại.{0,15}số.{0,10}điện thoại/i,
    /cung cấp.{0,10}(số|sdt|điện thoại)/i,
    /đăng ký.{0,15}tư vấn/i,
    /được.{0,10}gọi lại/i,
    /gọi lại.{0,10}trong.{0,10}(phút|giờ)/i,
    /liên hệ.{0,20}tư vấn viên/i,
    /tư vấn viên.{0,20}(liên hệ|gọi)/i,
    /điền.{0,10}thông tin/i,
    /để lại.{0,10}thông tin/i,
];

function hasLeadCaptureTrigger(text: string): boolean {
    return LEAD_CAPTURE_PATTERNS.some(p => p.test(text));
}
function hasEscalationKeyword(text: string): boolean {
    const lower = text.toLowerCase();
    return ESCALATION_KEYWORDS.some(k => lower.includes(k));
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function publicCreateLead(name: string, phone: string, source = 'WIDGET') {
    const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, source, stage: 'NEW' }),
    });
    if (!res.ok) throw new Error('create_lead_failed');
    return res.json() as Promise<{ id: string; success: boolean }>;
}

async function publicSendMessage(
    leadId: string,
    content: string,
    direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
    metadata?: object,
) {
    const res = await fetch('/api/public/livechat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, content, direction, metadata: metadata || {} }),
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

async function apiCaptureLead(leadId: string | null, data: { name: string; phone: string; notes?: string }) {
    const res = await fetch('/api/public/livechat/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, ...data }),
    });
    if (!res.ok) throw new Error('capture_failed');
    return res.json() as Promise<{ id: string; score: number; success: boolean }>;
}

async function apiEscalateToHuman(leadId: string, reason: string, priority: 'normal' | 'high' | 'urgent' = 'normal') {
    const res = await fetch('/api/public/livechat/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, reason, priority }),
    });
    return res.ok;
}

async function apiBookViewing(leadId: string, dateText: string, notes?: string) {
    const res = await fetch('/api/public/livechat/book-viewing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, dateText, notes }),
    });
    if (!res.ok) throw new Error('book_failed');
    return res.json() as Promise<{ viewingId: string; scheduledAt: string; success: boolean }>;
}

// ─── Session storage helpers ──────────────────────────────────────────────────
function saveSessionMsgs(msgs: Interaction[]) {
    try {
        sessionStorage.setItem(SESSION_MSGS_KEY, JSON.stringify(msgs.slice(-MAX_SESSION_MSGS)));
    } catch { /* quota */ }
}
function loadSessionMsgs(): Interaction[] {
    try {
        const raw = sessionStorage.getItem(SESSION_MSGS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function clearSessionMsgs() {
    try { sessionStorage.removeItem(SESSION_MSGS_KEY); } catch { /* */ }
}

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
    initialQuery?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AiChatWidget({ isOpen, onClose, initialQuery }: AiChatWidgetProps) {
    const { t, language } = useTranslation();
    const { socket } = useSocket();

    // ── Core state ──
    const [leadId, setLeadId] = useState<string | null>(null);
    const [userName, setUserName] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [startError, setStartError] = useState('');
    const [messages, setMessages] = useState<Interaction[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isHumanMode, setIsHumanMode] = useState(false);
    const [modeNotice, setModeNotice] = useState<'HUMAN_TAKEOVER' | 'AI_ACTIVE' | null>(null);

    // ── Mechanism 1: Lead Capture ──
    const [captureMode, setCaptureMode] = useState<'LEAD_CAPTURE' | 'ESCALATION' | null>(null);
    const [captureData, setCaptureData] = useState({ name: '', phone: '', notes: '' });
    const [captureSubmitting, setCaptureSubmitting] = useState(false);
    const [captureSuccess, setCaptureSuccess] = useState(false);

    // ── Mechanism 3: Proactive ──
    const [userMsgCount, setUserMsgCount] = useState(0);
    const [actionBtnsDismissed, setActionBtnsDismissed] = useState(false);
    const [wasEverOpen, setWasEverOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const autoReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Restore session ──
    useEffect(() => {
        const savedId = localStorage.getItem(LEAD_KEY);
        if (!savedId) return;
        const cached = loadSessionMsgs();
        if (cached.length > 0) setMessages(cached.filter(m => !isSysMsg(m)));
        publicGetMessages(savedId).then(data => {
            if (data) {
                setLeadId(data.lead.id);
                setUserName(data.lead.name || '');
                setIsHumanMode(data.lead.threadStatus === 'HUMAN_TAKEOVER');
                const filtered = (data.messages || []).filter(m => !isSysMsg(m));
                setMessages(filtered);
                saveSessionMsgs(filtered);
                setUserMsgCount(filtered.filter(m => m.direction === 'INBOUND').length);
            } else {
                localStorage.removeItem(LEAD_KEY);
                clearSessionMsgs();
            }
        }).catch(() => {
            localStorage.removeItem(LEAD_KEY);
            clearSessionMsgs();
        });
    }, []);

    // ── Mark as ever opened ──
    useEffect(() => {
        if (isOpen && !wasEverOpen) setWasEverOpen(true);
    }, [isOpen, wasEverOpen]);

    // ── Pre-fill input from Hero search query ──
    useEffect(() => {
        if (isOpen && initialQuery && initialQuery.trim()) {
            setInput(initialQuery.trim());
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, initialQuery]);

    // ── Socket: join room & handle events ──
    useEffect(() => {
        if (!leadId) return;
        socket.emit('join_livechat_room', leadId);
        const onMsg = (data: any) => {
            const msg: Interaction = data?.message ?? data;
            if (!msg || msg.leadId !== leadId || isSysMsg(msg)) return;
            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                const next = [...prev, msg];
                saveSessionMsgs(next);
                // Trigger lead capture if AI reply has the pattern
                if (msg.direction === 'OUTBOUND' && hasLeadCaptureTrigger(msg.content || '')) {
                    setCaptureMode(prev2 => prev2 ? prev2 : 'LEAD_CAPTURE');
                }
                return next;
            });
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
    }, [messages, isThinking, captureMode]);

    // ── Focus input ──
    useEffect(() => {
        if (isOpen && leadId) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen, leadId]);

    // ── Start chat (registration form) ──
    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;
        setStartError('');
        try {
            const created = await publicCreateLead(name.trim(), phone.trim(), 'WIDGET');
            const id = created.id;
            const welcome = await publicSendMessage(
                id,
                t('livechat.welcome_msg').replace('{name}', name.trim()),
                'OUTBOUND',
                { isAgent: true },
            );
            setLeadId(id);
            setUserName(name.trim());
            setMessages([welcome]);
            saveSessionMsgs([welcome]);
            localStorage.setItem(LEAD_KEY, id);
        } catch {
            setStartError('Không thể kết nối. Vui lòng thử lại.');
        }
    };

    // ── Send message ──
    const handleSend = useCallback(async (overrideMsg?: string) => {
        const content = (overrideMsg ?? input).trim();
        if (!content || !leadId) return;
        if (!overrideMsg) setInput('');

        // Mechanism 2 — Smart Escalation: intercept before AI
        if (!isHumanMode && hasEscalationKeyword(content)) {
            // Add user message first
            const userMsg: Interaction = {
                id: `temp-esc-${Date.now()}`,
                leadId,
                channel: Channel.WEB,
                direction: Direction.INBOUND,
                type: 'TEXT',
                content,
                timestamp: new Date().toISOString(),
                metadata: {},
            } as any;
            setMessages(prev => {
                const next = [...prev, userMsg];
                saveSessionMsgs(next);
                return next;
            });
            publicSendMessage(leadId, content, 'INBOUND').catch(() => {});
            // Show escalation form instead of sending to AI
            setCaptureMode('ESCALATION');
            return;
        }

        // Normal send
        let msg: Interaction | null = null;
        try {
            msg = await publicSendMessage(leadId, content, 'INBOUND');
            msg.direction = Direction.INBOUND;
            setMessages(prev => {
                const exists = prev.find(m => m.id === msg!.id);
                const next = exists ? prev : [...prev, msg!];
                saveSessionMsgs(next);
                return next;
            });
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
                metadata: {},
            } as any;
            setMessages(prev => {
                const next = [...prev, temp];
                saveSessionMsgs(next);
                return next;
            });
        }

        // Update proactive count
        setUserMsgCount(c => c + 1);

        if (isHumanMode) return;
        setIsThinking(true);
        if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current);
        autoReplyTimer.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/public/ai/livechat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId, message: content, lang: language }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.noReply) return;
                    const aiMsg: Interaction = data.reply;
                    if (aiMsg) {
                        setMessages(prev => {
                            if (prev.find(m => m.id === aiMsg.id)) return prev;
                            const next = [...prev, aiMsg];
                            saveSessionMsgs(next);
                            if (hasLeadCaptureTrigger(aiMsg.content || '')) {
                                setCaptureMode(pm => pm ? pm : 'LEAD_CAPTURE');
                            }
                            return next;
                        });
                        socket.emit('send_message', { room: leadId, message: aiMsg });
                    }
                } else {
                    const fallback = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                    if (fallback) setMessages(prev => { const next = [...prev, fallback]; saveSessionMsgs(next); return next; });
                }
            } catch {
                const fallback = await publicSendMessage(leadId, t('livechat.auto_reply'), 'OUTBOUND', { isAgent: true }).catch(() => null);
                if (fallback) setMessages(prev => { const next = [...prev, fallback]; saveSessionMsgs(next); return next; });
            } finally {
                setIsThinking(false);
            }
        }, 500);
    }, [input, leadId, isHumanMode, language, socket, t]);

    // ── Mechanism 1 & 2: Submit capture form ──
    const handleCaptureSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!captureData.phone.trim()) return;
        setCaptureSubmitting(true);
        try {
            await apiCaptureLead(leadId, {
                name: captureData.name || userName || name,
                phone: captureData.phone,
                notes: captureData.notes || undefined,
            });
            if (captureMode === 'ESCALATION' && leadId) {
                await apiEscalateToHuman(leadId, 'user_requested', 'high');
                const sysMsg = await publicSendMessage(
                    leadId,
                    'Tư vấn viên sẽ liên hệ bạn ngay. Cảm ơn bạn đã kiên nhẫn! 🙏',
                    'OUTBOUND',
                    { isAgent: true },
                ).catch(() => null);
                if (sysMsg) setMessages(prev => { const next = [...prev, sysMsg]; saveSessionMsgs(next); return next; });
            }
            setCaptureSuccess(true);
            setTimeout(() => {
                setCaptureMode(null);
                setCaptureSuccess(false);
                setCaptureData({ name: '', phone: '', notes: '' });
            }, 3000);
        } catch {
            /* silent — show success anyway */
            setCaptureSuccess(true);
            setTimeout(() => { setCaptureMode(null); setCaptureSuccess(false); }, 3000);
        } finally {
            setCaptureSubmitting(false);
        }
    };

    // ── Mechanism 3: Action buttons ──
    const handleActionButton = useCallback(async (action: string) => {
        if (!leadId) return;
        setActionBtnsDismissed(true);
        if (action === 'book_viewing') {
            // Ask for date preference via message
            await handleSend('Tôi muốn đặt lịch xem nhà. Có thể sắp xếp cuối tuần này không?');
        } else if (action === 'callback') {
            setCaptureMode('LEAD_CAPTURE');
            setCaptureData(d => ({ ...d, notes: 'Yêu cầu gọi lại từ widget' }));
        } else if (action === 'view_projects') {
            await handleSend('Cho tôi xem các dự án nổi bật hiện tại');
        }
    }, [leadId, handleSend]);

    // ── Reset session ──
    const handleReset = () => {
        localStorage.removeItem(LEAD_KEY);
        clearSessionMsgs();
        setLeadId(null);
        setMessages([]);
        setName('');
        setPhone('');
        setInput('');
        setIsThinking(false);
        setIsHumanMode(false);
        setModeNotice(null);
        setCaptureMode(null);
        setCaptureSuccess(false);
        setUserMsgCount(0);
        setActionBtnsDismissed(false);
        setUserName('');
    };

    // ── Cleanup timer ──
    useEffect(() => () => { if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current); }, []);

    // ── Derived ──
    const showActionButtons = userMsgCount >= 3 && !actionBtnsDismissed && !captureMode && !isHumanMode;
    const showQuickReplies = leadId && messages.length === 0 && !isThinking;
    const userInitial = (userName || name || '?')[0]?.toUpperCase();

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
                        height: '540px',
                        maxHeight: 'calc(100dvh - 10rem)',
                        boxShadow: '0 24px 64px rgba(27,58,92,0.20), 0 4px 16px rgba(0,0,0,0.12)',
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        className="shrink-0 flex items-center justify-between px-4 py-3 text-white"
                        style={{ background: 'linear-gradient(135deg, var(--sgs-primary-deep) 0%, var(--sgs-primary) 100%)' }}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                                    {isHumanMode ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                                </div>
                                {/* Online indicator */}
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-sm leading-tight">SGS LAND AI</p>
                                <p className="text-white/75 text-xs leading-tight">
                                    {isHumanMode ? t('livechat.agent_assisting') : t('livechat.ai_online')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Hotline call button */}
                            <a
                                href={`tel:${HOTLINE}`}
                                title={`Gọi hotline ${HOTLINE_DISPLAY}`}
                                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                aria-label="Gọi hotline"
                            >
                                <Phone className="w-3.5 h-3.5" />
                            </a>
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

                    {/* ── Body ── */}
                    {!leadId ? (
                        /* Registration form */
                        <div className="flex-1 overflow-y-auto bg-[var(--bg-surface)] flex flex-col justify-center p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div>
                                    <p className="font-bold text-sm text-[var(--text-primary)]">{t('livechat.widget_title')}</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">{t('livechat.widget_subtitle')}</p>
                                </div>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                                {t('livechat.widget_desc')}
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
                                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-sgs-primary/50 focus:border-sgs-primary outline-none transition-all bg-[var(--bg-app)]"
                                    style={{ fontSize: '16px' }}
                                />
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder={t('livechat.phone_placeholder')}
                                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-sgs-primary/50 focus:border-sgs-primary outline-none transition-all bg-[var(--bg-app)]"
                                    style={{ fontSize: '16px' }}
                                />
                                <button
                                    type="submit"
                                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, var(--sgs-primary-deep), var(--sgs-primary))' }}
                                >
                                    {t('livechat.start_chat')}
                                </button>
                            </form>
                            {/* Hotline fallback */}
                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
                                <PhoneCall className="w-3.5 h-3.5 text-sgs-text-muted shrink-0" />
                                <span>{t('livechat.or_call')} <a href={`tel:${HOTLINE}`} className="font-bold text-sgs-primary hover:underline">{HOTLINE_DISPLAY}</a></span>
                            </div>
                        </div>
                    ) : (
                        /* Chat view */
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-[var(--glass-surface)]/50">
                                {/* Mode notice banner */}
                                {modeNotice && (
                                    <div className="flex justify-center py-0.5">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
                                            modeNotice === 'HUMAN_TAKEOVER'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-sgs-champagne/50 text-sgs-primary border-sgs-border'
                                        }`}>
                                            {modeNotice === 'HUMAN_TAKEOVER'
                                                ? t('livechat.agent_takeover_notice')
                                                : t('livechat.ai_resume_notice')}
                                        </span>
                                    </div>
                                )}

                                {/* Mechanism 3 — Proactive: Quick reply chips (first open, no messages) */}
                                {showQuickReplies && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pb-1"
                                    >
                                        <p className="text-xs text-[var(--text-tertiary)] text-center mb-2 font-medium">{t('livechat.quick_replies_title')}</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {QUICK_REPLY_KEYS.map(qr => (
                                                <button
                                                    key={qr.labelKey}
                                                    type="button"
                                                    onClick={() => handleSend(t(qr.msgKey))}
                                                    className="text-xs px-3 py-1.5 rounded-full border border-sgs-border bg-sgs-champagne text-sgs-primary hover:bg-sgs-champagne transition-colors font-medium whitespace-nowrap"
                                                >
                                                    {t(qr.labelKey)}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Message list */}
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

                                {/* Typing dots animation */}
                                {isThinking && (
                                    <div className="flex justify-start">
                                        <div className="flex items-center gap-2 bg-[var(--bg-surface)] border border-sgs-border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                                            <div className="flex gap-1">
                                                {[0, 75, 150].map(delay => (
                                                    <span
                                                        key={delay}
                                                        className="w-2 h-2 bg-sgs-primary rounded-full animate-bounce"
                                                        style={{ animationDelay: `${delay}ms` }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-sgs-primary font-medium">{t('livechat.replying')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Mechanism 1 & 2 — Inline capture/escalation form */}
                                {captureMode && (
                                    <motion.div
                                        key="capture-form"
                                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="rounded-2xl border border-sgs-border bg-[var(--bg-surface)] overflow-hidden shadow-sm"
                                    >
                                        {captureSuccess ? (
                                            <div className="px-4 py-5 text-center">
                                                <div className="w-10 h-10 bg-sgs-champagne rounded-full flex items-center justify-center mx-auto mb-2">
                                                    <svg className="w-5 h-5 text-sgs-verified" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <p className="font-bold text-sm text-[var(--text-primary)] mb-1">Đã ghi nhận!</p>
                                                <p className="text-xs text-[var(--text-secondary)]">Tư vấn viên sẽ gọi lại cho bạn trong <strong>15 phút</strong> ⚡</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="px-4 py-3 bg-sgs-champagne border-b border-sgs-border flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-sm text-sgs-primary">
                                                            {captureMode === 'ESCALATION'
                                                                ? t('livechat.escalation_title')
                                                                : t('livechat.callback_title')}
                                                        </p>
                                                        <p className="text-xs text-sgs-primary mt-0.5">
                                                            {captureMode === 'ESCALATION'
                                                                ? t('livechat.escalation_desc')
                                                                : t('livechat.callback_desc')}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setCaptureMode(null); setCaptureData({ name: '', phone: '', notes: '' }); }}
                                                        className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-sgs-text-muted hover:text-sgs-primary"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <form onSubmit={handleCaptureSubmit} className="p-4 space-y-2.5">
                                                    {!userName && (
                                                        <input
                                                            type="text"
                                                            value={captureData.name}
                                                            onChange={e => setCaptureData(d => ({ ...d, name: e.target.value }))}
                                                            placeholder={t('livechat.name_placeholder')}
                                                            className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-sgs-primary/50 outline-none bg-[var(--bg-app)]"
                                                            style={{ fontSize: '16px' }}
                                                        />
                                                    )}
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={captureData.phone}
                                                        onChange={e => setCaptureData(d => ({ ...d, phone: e.target.value }))}
                                                        placeholder={t('livechat.phone_required')}
                                                        className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-sgs-primary/50 outline-none bg-[var(--bg-app)]"
                                                        style={{ fontSize: '16px' }}
                                                    />
                                                    <textarea
                                                        value={captureData.notes}
                                                        onChange={e => setCaptureData(d => ({ ...d, notes: e.target.value }))}
                                                        placeholder={t('livechat.notes_placeholder')}
                                                        rows={2}
                                                        className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-sgs-primary/50 outline-none resize-none bg-[var(--bg-app)] no-scrollbar"
                                                        style={{ fontSize: '16px' }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={captureSubmitting || !captureData.phone.trim()}
                                                        className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                                                        style={{ background: 'linear-gradient(135deg, var(--sgs-primary-deep), var(--sgs-primary))' }}
                                                    >
                                                        {captureSubmitting ? t('livechat.sending') : (
                                                            captureMode === 'ESCALATION' ? t('livechat.connect_agent') : t('livechat.send_callback')
                                                        )}
                                                    </button>
                                                </form>
                                            </>
                                        )}
                                    </motion.div>
                                )}

                                {/* Mechanism 3 — Proactive action buttons (after 3 messages) */}
                                {showActionButtons && (
                                    <motion.div
                                        key="action-btns"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pt-1"
                                    >
                                        <p className="text-xs text-[var(--text-tertiary)] text-center mb-2 font-medium">{t('livechat.next_steps')}</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {ACTION_BUTTON_KEYS.map(btn => (
                                                <button
                                                    key={btn.action}
                                                    type="button"
                                                    onClick={() => handleActionButton(btn.action)}
                                                    className="text-xs px-3 py-1.5 rounded-full border border-sgs-border bg-sgs-champagne text-sgs-primary hover:bg-sgs-champagne transition-colors font-medium whitespace-nowrap"
                                                >
                                                    {t(btn.labelKey)}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setActionBtnsDismissed(true)}
                                                className="text-xs px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
                                            >
                                                {t('livechat.skip')}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input area */}
                            <div className="shrink-0 p-3 bg-[var(--bg-surface)] border-t border-[var(--glass-border)]">
                                {/* User avatar + input row */}
                                <div className="flex items-end gap-2">
                                    {/* User avatar */}
                                    <div
                                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm mb-1"
                                        style={{ background: 'linear-gradient(135deg, var(--sgs-hero-deep), var(--sgs-primary-deep))' }}
                                    >
                                        {userInitial}
                                    </div>
                                    <div className="flex-1 flex items-end gap-2 bg-[var(--glass-surface)] p-2 rounded-xl border border-[var(--glass-border)] focus-within:border-sgs-primary focus-within:ring-2 focus-within:ring-sgs-primary/15 transition-all">
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
                                            onClick={() => handleSend()}
                                            disabled={!input.trim() || isThinking}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-all active:scale-95"
                                            style={{ background: 'linear-gradient(135deg, var(--sgs-primary-deep), var(--sgs-primary))' }}
                                            aria-label="Gửi"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                                    {t('livechat.powered_by')} <span className="font-bold text-[var(--text-tertiary)]">SGS Land AI</span>
                                    {' · '}
                                    <a href={`tel:${HOTLINE}`} className="text-sgs-text-muted hover:text-sgs-primary font-bold transition-colors">{HOTLINE_DISPLAY}</a>
                                </p>
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
