
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/dbApi';
import { aiService } from '../services/aiService';
import { InboxThread, Interaction, LeadId, User, Channel, Direction, ThreadStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { MessageBubble } from '../components/ChatUI';
import { smartMatch } from '../utils/textUtils';
import { resolveContent } from '../utils/i18nUtils';
import { getSEOOverrides } from '../utils/seo';
import { ConfirmModal } from '../components/ConfirmModal';
import { useSocket } from '../services/websocket';
import { motion, AnimatePresence } from 'motion/react';

const CONFIG = {
    TOAST_DURATION: 3000
};

const ICONS = {
    SEARCH: <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    SEND: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    ATTACH: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>,
    MAGIC: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    ZALO: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM8.5 8h7L10 16h5.5v1.5h-7L14 9.5H8.5V8z"/></svg>,
    FACEBOOK: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    WEB: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>,
    EMAIL: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    SMS: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    ROBOT_OFF: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    ROBOT_ON: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    ALERT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    FILTER: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M10 18h4" /></svg>,
    UNREAD: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/></svg>,
    CHECK: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
    CHEVRON: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>,
};

/* ── Colour tokens for InboxDropdown — must be static strings for Tailwind ── */
const DD_COLORS: Record<string, { open: string; item: string; check: string }> = {
    indigo:  { open: 'bg-indigo-50 border-indigo-400 text-indigo-700',   item: 'bg-indigo-50 text-indigo-700',   check: 'text-indigo-600'  },
    blue:    { open: 'bg-blue-50 border-blue-400 text-blue-700',         item: 'bg-blue-50 text-blue-700',       check: 'text-blue-600'    },
    emerald: { open: 'bg-emerald-50 border-emerald-400 text-emerald-700',item: 'bg-emerald-50 text-emerald-700', check: 'text-emerald-600' },
    amber:   { open: 'bg-amber-50 border-amber-400 text-amber-700',      item: 'bg-amber-50 text-amber-700',     check: 'text-amber-600'   },
};

/* ── Reusable animated dropdown for inbox filters ────────────────────────── */
type DropdownOption<T extends string> = { value: T; label: string; icon?: React.ReactNode; color?: string };

function InboxDropdown<T extends string>({
    value, onChange, options, className = '', defaultColor = 'indigo'
}: {
    value: T;
    onChange: (v: T) => void;
    options: DropdownOption<T>[];
    className?: string;
    defaultColor?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);
    const triggerKey = selected?.color ?? defaultColor;
    const triggerTokens = DD_COLORS[triggerKey] ?? DD_COLORS.indigo;

    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    return (
        <div ref={ref} className={`relative flex-1 min-w-0 ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className={`w-full flex items-center justify-between gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[38px] outline-none transition-all border ${
                    open ? triggerTokens.open : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                }`}
            >
                <span className="flex items-center gap-1.5 truncate min-w-0">
                    {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
                    <span className="truncate">{selected?.label ?? '—'}</span>
                </span>
                <span className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                    {ICONS.CHEVRON}
                </span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.13, ease: 'easeOut' }}
                        className="absolute z-[60] top-full left-0 mt-1.5 w-full min-w-[140px] bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-xl overflow-hidden"
                    >
                        <div className="py-1">
                            {options.map(opt => {
                                const isActive = value === opt.value;
                                const tokens = DD_COLORS[opt.color ?? defaultColor] ?? DD_COLORS.indigo;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => { onChange(opt.value); setOpen(false); }}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold transition-colors text-left ${
                                            isActive ? tokens.item : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface)]'
                                        }`}
                                    >
                                        {opt.icon && <span className="shrink-0 opacity-80">{opt.icon}</span>}
                                        <span className="flex-1">{opt.label}</span>
                                        {isActive && <span className={`${tokens.check} shrink-0`}>{ICONS.CHECK}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export const Inbox: React.FC = () => {
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    
    const [selectedLeadId, setSelectedLeadId] = useState<LeadId | null>(null);
    const [input, setInput] = useState('');
    const [channel, setChannel] = useState<Channel>(Channel.ZALO);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [channelFilter, setChannelFilter] = useState<'ALL' | Channel>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD'>('ALL');
    const [threadToDelete, setThreadToDelete] = useState<LeadId | null>(null);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    // Initialize from SEO overrides (admin-set in SEO Manager) → short friendly default
    const [widgetTitle, setWidgetTitle] = useState(() => {
        const ov = getSEOOverrides();
        return ov['livechat']?.title || 'SGS Land Live Chat';
    });
    const [widgetDesc, setWidgetDesc] = useState(() => {
        const ov = getSEOOverrides();
        return ov['livechat']?.description || 'Chúng tôi sẵn sàng hỗ trợ bạn 24/7';
    });
    
    // --- SUPERVISOR STATE ---
    const [autoResponseMap, setAutoResponseMap] = useState<Record<string, boolean>>({}); // Toggle per thread
    const autoResponseMapRef = useRef<Record<string, boolean>>({});
    
    useEffect(() => {
        autoResponseMapRef.current = autoResponseMap;
    }, [autoResponseMap]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const assignDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSendingRef = useRef(false);
    const { t, formatTime, formatCurrency, formatDate, formatDateTime, language } = useTranslation();

    const channelLabel = useCallback((ch: string): string => {
        const map: Record<string, string> = {
            ZALO: t('inbox.channel_zalo'),
            FACEBOOK: t('inbox.channel_facebook'),
            EMAIL: t('inbox.channel_email'),
            SMS: t('inbox.channel_sms'),
            WEB: t('inbox.channel_web'),
        };
        return map[ch] ?? ch;
    }, [t]);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), CONFIG.TOAST_DURATION);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
                setIsAssignOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // --- DATA LOADING WITH REACT QUERY ---
    const { data: threads = [], isLoading: loadingThreads } = useQuery({
        queryKey: ['inboxThreads'],
        queryFn: async () => {
            const data = await db.getInboxThreads();
            return data || [];
        },
        staleTime: 30_000,
    });

    // Sync autoResponseMap when new threads arrive — only initialise entries that
    // don't exist yet so user-toggled values are never overwritten
    useEffect(() => {
        if (!threads.length) return;
        const currentMap = autoResponseMapRef.current;
        const additions: Record<string, boolean> = {};
        threads.forEach(t => {
            if (currentMap[t.lead.id] === undefined) {
                additions[t.lead.id] = t.status !== ThreadStatus.HUMAN_TAKEOVER;
            }
        });
        if (Object.keys(additions).length > 0) {
            setAutoResponseMap(prev => ({ ...additions, ...prev }));
        }
    }, [threads]);

    const { data: messages = [] } = useQuery({
        queryKey: ['interactions', selectedLeadId],
        queryFn: async () => {
            if (!selectedLeadId) return [];
            const msgs = await db.getInteractions(selectedLeadId);
            return (msgs || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        },
        enabled: !!selectedLeadId,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    // Scroll to bottom whenever messages load or change
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(scrollToBottom, 100);
        }
    }, [messages]);

    const { data: users = [] } = useQuery({
        queryKey: ['tenantMembers'],
        queryFn: async () => {
            const res = await db.getMembers();
            return res.data || [];
        },
        staleTime: 60_000,
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            return await db.getCurrentUser();
        },
        staleTime: 60_000,
    });

    // --- WEBSOCKET INTEGRATION ---
    useEffect(() => {
        if (selectedLeadId) {
            socket.emit("join_room", selectedLeadId);
            
            // Mark thread as read — update in-place (no refetch)
            db.markThreadAsRead(selectedLeadId).then(() => {
                queryClient.setQueryData<InboxThread[]>(['inboxThreads'], (old = []) =>
                    old.map(th => th.lead.id === selectedLeadId ? { ...th, unreadCount: 0 } : th)
                );
            });
        }

        // Helper: build a minimal lastMessage shape from a raw message payload
        const buildLastMsg = (leadId: string, msg: any) => ({
            id: msg.id || `thread-${leadId}-${Date.now()}`,
            content: msg.content || '',
            channel: msg.channel || 'INTERNAL',
            direction: msg.direction || 'INBOUND',
            timestamp: msg.timestamp || new Date().toISOString(),
            type: msg.type || 'TEXT',
            status: msg.status || 'SENT',
            leadId,
            metadata: msg.metadata || {},
        });

        // Helper: update a single thread in the sidebar list, keeping sort order
        const patchThread = (
            leadId: string,
            patch: (th: InboxThread) => InboxThread
        ) => {
            queryClient.setQueryData<InboxThread[]>(['inboxThreads'], (old = []) => {
                if (!old.some(th => th.lead.id === leadId)) {
                    // Unknown lead — schedule a background refetch only
                    queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
                    return old;
                }
                return old
                    .map(th => th.lead.id === leadId ? patch(th) : th)
                    .sort((a, b) =>
                        new Date(b.lastMessage?.timestamp || 0).getTime() -
                        new Date(a.lastMessage?.timestamp || 0).getTime()
                    );
            });
        };

        const handleNewMessage = (data: any) => {
            const msg = data.message;
            const leadId = data.room as string;

            // Append to interactions cache (avoids interaction-list refetch)
            if (msg) {
                queryClient.setQueryData<any[]>(['interactions', leadId], (old) => {
                    if (!old) return old;
                    if (old.some((m: any) => m.id === msg.id)) return old;
                    return [...old, msg];
                });
            }

            // Update thread sidebar in-place
            if (msg && leadId) {
                patchThread(leadId, (th) => ({
                    ...th,
                    lastMessage: buildLastMsg(leadId, msg) as any,
                    lastChannel: msg.channel || th.lastChannel,
                    unreadCount:
                        msg.direction === 'INBOUND' && leadId !== selectedLeadId
                            ? th.unreadCount + 1
                            : th.unreadCount,
                }));
            }

            if (msg?.direction === 'INBOUND' && leadId !== selectedLeadId) {
                notify(t('inbox.new_message'), 'success');
            }
        };

        // Server already persisted the score and emits it via socket — no extra DB write needed
        const handleLeadScored = (data: { leadId: string, score: any }) => {
            queryClient.setQueryData<InboxThread[]>(['inboxThreads'], (old = []) =>
                old.map(th =>
                    th.lead.id === data.leadId
                        ? { ...th, lead: { ...th.lead, score: data.score } }
                        : th
                )
            );
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        };

        // Server webhook already persisted the message — no extra client DB call needed
        const handleNewInboundMessage = (data: { leadId: string, message: any }) => {
            const { leadId, message: msg } = data;

            // Append to interactions cache (if the chat pane is open for this lead)
            if (msg) {
                queryClient.setQueryData<any[]>(['interactions', leadId], (old) => {
                    if (!old) return old;
                    if (old.some((m: any) => m.id === msg.id)) return old;
                    return [...old, msg];
                });
            }

            // Update thread sidebar in-place
            patchThread(leadId, (th) => ({
                ...th,
                lastMessage: msg ? buildLastMsg(leadId, msg) as any : th.lastMessage,
                lastChannel: msg?.channel || th.lastChannel,
                unreadCount: leadId !== selectedLeadId ? th.unreadCount + 1 : th.unreadCount,
            }));

            if (leadId !== selectedLeadId) {
                notify(t('inbox.new_message'), 'success');
            }
        };

        const handleEscalateToHuman = (data: { leadId: string }) => {
            const { leadId } = data;
            setAutoResponseMap(prev => ({ ...prev, [leadId]: false }));
            notify(t('inbox.escalated_to_human') || 'Đã chuyển sang hỗ trợ thủ công', 'error');
            db.updateThreadAiMode(leadId, 'HUMAN_TAKEOVER').catch(() => {});
        };

        socket.on("receive_message", handleNewMessage);
        socket.on("lead_scored", handleLeadScored);
        socket.on("new_inbound_message", handleNewInboundMessage);
        socket.on("escalate_to_human", handleEscalateToHuman);

        return () => {
            socket.off("receive_message", handleNewMessage);
            socket.off("lead_scored", handleLeadScored);
            socket.off("new_inbound_message", handleNewInboundMessage);
            socket.off("escalate_to_human", handleEscalateToHuman);
        };
    }, [selectedLeadId, socket, queryClient, notify, t]);

    // --- AI & SEND LOGIC ---
    const appendInteraction = (leadId: string, msg: any) => {
        queryClient.setQueryData<any[]>(['interactions', leadId], (old) => {
            const list = old || [];
            if (list.some((m: any) => m.id === msg.id)) return list;
            return [...list, msg];
        });
    };

    const handleSend = async () => {
        if (!input.trim() || !selectedLeadId || isSendingRef.current) return;
        
        const currentLead = threads.find(t => t.lead.id === selectedLeadId)?.lead;
        if (!currentLead) return;

        isSendingRef.current = true;
        const isSimulation = input.startsWith('/');
        const cleanInput = isSimulation ? input.substring(1).trim() : input;

        try {
            if (isSimulation) {
                const customerMsg = await db.sendInteraction(selectedLeadId, cleanInput, channel);
                customerMsg.direction = Direction.INBOUND;
                
                appendInteraction(selectedLeadId, customerMsg);
                socket.emit("send_message", { room: selectedLeadId, message: customerMsg });
                
                setInput('');
                scrollToBottom();

                if (autoResponseMap[selectedLeadId]) {
                    setIsThinking(true);
                    setStreamingMessage('');
                    
                    const newHistory = [...messages, customerMsg];
                    const aiResult = await aiService.processMessage(currentLead, cleanInput, newHistory, language, (chunk) => {
                        setIsThinking(false);
                        setStreamingMessage(prev => prev + chunk);
                        scrollToBottom();
                    });
                    
                    // RACE CONDITION CHECK:
                    // If the human agent turned off AI or sent a message while AI was thinking, discard the AI response.
                    if (!autoResponseMapRef.current[selectedLeadId]) {
                        setIsThinking(false);
                        setStreamingMessage('');
                        return;
                    }
                    
                    const aiMsg = await db.sendInteraction(selectedLeadId, aiResult.content, Channel.ZALO, {
                        metadata: {
                            isAi: true,
                            isAgent: true,
                            trace: aiResult.steps,
                            artifact: aiResult.artifact,
                            aiConfidence: aiResult.confidence,
                            aiSentiment: aiResult.sentiment,
                        },
                    });

                    appendInteraction(selectedLeadId, aiMsg);
                    socket.emit("send_message", { room: selectedLeadId, message: aiMsg });
                    
                    setIsThinking(false);
                    setStreamingMessage('');
                    scrollToBottom();
                }
            } else {
                // Human Takeover: Turn off AI if it was on
                if (autoResponseMapRef.current[selectedLeadId]) {
                    setAutoResponseMap(prev => ({ ...prev, [selectedLeadId]: false }));
                    notify(t('inbox.manual_enabled'), "success");
                    db.updateThreadAiMode(selectedLeadId, 'HUMAN_TAKEOVER').catch(() => {});
                }

                const agentMsg = await db.sendInteraction(selectedLeadId, input, channel);
                appendInteraction(selectedLeadId, agentMsg);
                socket.emit("send_message", { room: selectedLeadId, message: agentMsg });
                
                setInput('');
                scrollToBottom();
            }

            queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
        } catch (e) {
            notify(t('common.error'), 'error');
            setIsThinking(false);
        } finally {
            isSendingRef.current = false;
        }
    };

    // --- TOGGLE AI MODE ---
    const toggleAiMode = async (e: React.MouseEvent, leadId: LeadId) => {
        e.stopPropagation();
        const newState = !autoResponseMap[leadId];
        setAutoResponseMap(prev => ({ ...prev, [leadId]: newState }));
        notify(newState ? t('inbox.ai_activated') : t('inbox.manual_enabled'), "success");
        try {
            await db.updateThreadAiMode(leadId, newState ? 'AI_ACTIVE' : 'HUMAN_TAKEOVER');
        } catch {
            // Revert on failure
            setAutoResponseMap(prev => ({ ...prev, [leadId]: !newState }));
            notify(t('inbox.ai_mode_save_error') || 'Không thể lưu cài đặt AI', 'error');
        }
    };

    // --- FILE UPLOAD LOGIC ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLeadId) return;

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Check file size (e.g., max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            notify(t('inbox.file_size_error'), 'error');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const isImage = file.type.startsWith('image/');
                
                // Turn off AI if human sends file
                if (autoResponseMapRef.current[selectedLeadId]) {
                    setAutoResponseMap(prev => ({ ...prev, [selectedLeadId]: false }));
                    notify(t('inbox.manual_enabled'), "success");
                }

                const agentMsg = await db.sendInteraction(selectedLeadId, base64String, channel, {
                    type: isImage ? 'IMAGE' : 'FILE',
                    metadata: {
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type
                    }
                });

                queryClient.setQueryData(['interactions', selectedLeadId], (old: any) => [...(old || []), agentMsg]);
                socket.emit("send_message", { room: selectedLeadId, message: agentMsg });
                scrollToBottom();
                queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
            };
            reader.readAsDataURL(file);
        } catch (error) {
            notify(t('common.error'), 'error');
        }
    };

    // --- DELETE LOGIC ---
    const requestDelete = (e: React.MouseEvent, id: LeadId) => {
        e.stopPropagation();
        setThreadToDelete(id);
    };

    const handleAssign = async (leadId: LeadId, userId: string) => {
        try {
            await db.updateLead(leadId, { assignedTo: userId as any });
            queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
            notify(t('inbox.assign_success'), 'success');
        } catch (e) {
            notify(t('common.error'), 'error');
        }
    };

    const confirmDelete = async () => {
        if (!threadToDelete) return;
        try {
            await db.deleteConversation(threadToDelete);
            queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
            if (selectedLeadId === threadToDelete) {
                setSelectedLeadId(null);
            }
            notify(t('common.success'), 'success');
        } catch (e) {
            notify(t('common.error'), 'error');
        } finally {
            setThreadToDelete(null);
        }
    };

    const filteredThreads = useMemo(() =>
        (threads || []).filter(th => {
            if (!smartMatch((th.lead.name || '') + (th.lead.phone || ''), debouncedSearch)) return false;
            if (channelFilter !== 'ALL' && th.lastChannel !== channelFilter) return false;
            if (statusFilter === 'UNREAD' && th.unreadCount === 0) return false;
            return true;
        }),
    [threads, debouncedSearch, channelFilter, statusFilter]);

    const selectedThread = threads.find(t => t.lead.id === selectedLeadId);
    const isAiActiveForSelected = selectedLeadId ? autoResponseMap[selectedLeadId] : false;

    return (
        <>
        {/* Full-bleed on mobile, padded on sm+ — fills the flex-1 parent from Layout */}
        <div className="h-full sm:p-4 md:p-6">
        <div className="flex h-full bg-[var(--bg-surface)] sm:rounded-[24px] sm:border border-[var(--glass-border)] sm:shadow-sm overflow-hidden animate-enter relative">

            {/* Sidebar List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-[var(--glass-border)] flex flex-col ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="px-4 sm:px-5 pt-4 pb-2.5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] z-10 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-[var(--text-primary)]">{t('menu.inbox')}</h2>
                        <button 
                            onClick={() => setIsWidgetModalOpen(true)}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            <span className="hidden sm:inline">{t('inbox.live_chat_widget')}</span>
                        </button>
                    </div>
                    <div className="relative">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)]">
                            {ICONS.SEARCH}
                        </div>
                        <input 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl pl-9 pr-9 py-2.5 min-h-[44px] text-sm outline-none focus:border-indigo-500 transition-all"
                            placeholder={t('common.search')}
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] transition-colors p-1 rounded-full hover:bg-[var(--glass-surface-hover)] flex items-center justify-center"
                                    title={t('common.clear_search')}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Filter row — Mobile: two compact dropdowns | Desktop: chip pills */}

                    {/* ── MOBILE dropdown row ── */}
                    <div className="flex md:hidden gap-2">
                        <InboxDropdown<'ALL' | 'UNREAD'>
                            value={statusFilter}
                            onChange={setStatusFilter}
                            defaultColor="indigo"
                            options={[
                                { value: 'ALL',    label: t('inbox.filter_all'),    icon: ICONS.FILTER,  color: 'indigo' },
                                { value: 'UNREAD', label: t('inbox.filter_unread'), icon: ICONS.UNREAD,  color: 'amber'  },
                            ]}
                        />
                        <InboxDropdown<'ALL' | Channel>
                            value={channelFilter}
                            onChange={setChannelFilter}
                            defaultColor="indigo"
                            options={[
                                { value: 'ALL',          label: t('inbox.filter_all'),    icon: ICONS.FILTER,   color: 'indigo'  },
                                { value: Channel.WEB,    label: t('inbox.channel_web'),   icon: ICONS.WEB,      color: 'indigo'  },
                                { value: Channel.ZALO,   label: 'Zalo',                   icon: ICONS.ZALO,     color: 'blue'    },
                                { value: Channel.FACEBOOK,label: 'Facebook',              icon: ICONS.FACEBOOK, color: 'blue'    },
                                { value: Channel.EMAIL,  label: 'Email',                  icon: ICONS.EMAIL,    color: 'indigo'  },
                                { value: Channel.SMS,    label: 'SMS',                    icon: ICONS.SMS,      color: 'emerald' },
                            ]}
                        />
                    </div>

                    {/* ── DESKTOP chip pills ── */}
                    <div className="hidden md:flex md:flex-wrap gap-1.5">
                        {([
                            { key: 'ALL'   as const, label: t('inbox.filter_all')    },
                            { key: 'UNREAD'as const, label: t('inbox.filter_unread') },
                        ]).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all whitespace-nowrap shrink-0 min-h-[24px] ${
                                    statusFilter === key
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-[var(--glass-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                        <div className="w-px bg-[var(--glass-border)] self-stretch mx-0.5" />
                        {([
                            { key: 'ALL'            as const, label: t('inbox.filter_all')  },
                            { key: Channel.WEB               , label: t('inbox.channel_web') },
                            { key: Channel.ZALO              , label: 'Zalo'                 },
                            { key: Channel.FACEBOOK          , label: 'Facebook'             },
                            { key: Channel.EMAIL             , label: 'Email'                },
                            { key: Channel.SMS               , label: 'SMS'                  },
                        ]).map(({ key, label }) => {
                            const active = channelFilter === key;
                            const colorMap: Record<string, { on: string; off: string }> = {
                                ZALO:     { on: 'bg-blue-600 text-white border-blue-600',     off: 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-blue-300 hover:text-blue-600' },
                                FACEBOOK: { on: 'bg-[#1877F2] text-white border-[#1877F2]',  off: 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-blue-400 hover:text-[#1877F2]' },
                                EMAIL:    { on: 'bg-indigo-600 text-white border-indigo-600', off: 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600' },
                                SMS:      { on: 'bg-emerald-600 text-white border-emerald-600',off:'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-emerald-300 hover:text-emerald-600' },
                                WEB:      { on: 'bg-violet-600 text-white border-violet-600', off: 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-violet-300 hover:text-violet-600' },
                                ALL:      { on: 'bg-indigo-600 text-white border-indigo-600', off: 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-600' },
                            };
                            const c = colorMap[key] ?? colorMap['ALL'];
                            return (
                                <button
                                    key={key}
                                    onClick={() => setChannelFilter(key)}
                                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all whitespace-nowrap shrink-0 min-h-[24px] bg-[var(--glass-surface)] ${active ? c.on + ' shadow-sm' : c.off}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {loadingThreads && threads.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)] text-xs italic">{t('common.loading')}</div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)] text-xs italic">{t('inbox.empty')}</div>
                    ) : (
                        filteredThreads.map(thread => {
                            const isAiEnabled = autoResponseMap[thread.lead.id];
                            return (
                                <div
                                    key={thread.lead.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedLeadId(thread.lead.id)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLeadId(thread.lead.id); } }}
                                    aria-label={thread.lead.name}
                                    aria-pressed={selectedLeadId === thread.lead.id}
                                    className={`p-4 border-b border-slate-50 hover:bg-[var(--glass-surface)] cursor-pointer transition-colors group relative ${selectedLeadId === thread.lead.id ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <div className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1">
                                            <span className="truncate">{thread.lead.name}</span>
                                            {/* AI Status Indicator */}
                                            {isAiEnabled ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title={t('inbox.ai_agent_active')}></span>
                                            ) : (
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" title={t('inbox.human_control')}></span>
                                            )}
                                        </div>
                                        {thread.lastMessage && <div className="text-xs2 text-[var(--text-secondary)] whitespace-nowrap shrink-0 mt-0.5">{formatTime(thread.lastMessage.timestamp)}</div>}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 gap-2">
                                        <div className={`text-xs truncate min-w-0 flex-1 flex items-center gap-1.5 ${thread.unreadCount > 0 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                            {/* Channel badge */}
                                            {thread.lastChannel && thread.lastChannel !== 'INTERNAL' && (() => {
                                                const ch = thread.lastChannel;
                                                const styles: Record<string, string> = {
                                                    ZALO: 'bg-blue-100 text-blue-700',
                                                    FACEBOOK: 'bg-[#1877F2]/10 text-[#1877F2]',
                                                    EMAIL: 'bg-indigo-50 text-indigo-600',
                                                    SMS: 'bg-emerald-50 text-emerald-600',
                                                    WEB: 'bg-violet-50 text-violet-600',
                                                };
                                                const badgeLabels: Record<string, string> = {
                                                    ZALO: t('inbox.channel_badge_zalo'),
                                                    FACEBOOK: t('inbox.channel_badge_facebook'),
                                                    EMAIL: t('inbox.channel_badge_email'),
                                                    SMS: t('inbox.channel_badge_sms'),
                                                    WEB: t('inbox.channel_badge_web'),
                                                };
                                                return (
                                                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded shrink-0 ${styles[ch] || 'bg-slate-100 text-slate-500'}`}
                                                          title={channelLabel(ch)}>
                                                        {badgeLabels[ch] ?? channelLabel(ch).charAt(0).toUpperCase()}
                                                    </span>
                                                );
                                            })()}
                                            <span className="truncate">
                                                {(() => {
                                                    const lm = thread.lastMessage;
                                                    if (!lm) return t('inbox.empty');
                                                    if (lm.type === 'IMAGE') return t('inbox.msg_image');
                                                    if (lm.type === 'FILE') return t('inbox.msg_file');
                                                    if (lm.type === 'AUDIO') return t('inbox.msg_audio');
                                                    return resolveContent(lm.content, t) || t('inbox.empty');
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {thread.lead.assignedTo && (
                                                <div className="text-2xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[60px]" title={thread.lead.assignedToName || users.find((u: any) => u.id === thread.lead.assignedTo)?.name || t('inbox.unassigned')}>
                                                    {(thread.lead.assignedToName || users.find((u: any) => u.id === thread.lead.assignedTo)?.name || '')?.split(' ').pop() || ''}
                                                </div>
                                            )}
                                            {thread.unreadCount > 0 && (
                                                <div className="bg-rose-500 text-white text-xs2 font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">{thread.unreadCount}</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Hover Delete Button */}
                                    {(currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD') && (
                                        <button 
                                            onClick={(e) => requestDelete(e, thread.lead.id)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-surface)] shadow-sm border border-[var(--glass-border)] rounded-full text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title={t('inbox.menu_delete')}
                                        >
                                            {ICONS.TRASH}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Area */}
            {selectedThread ? (
                <div className={`flex-1 flex flex-col bg-[var(--bg-surface)] h-full relative min-w-0 ${selectedLeadId ? 'flex' : 'hidden md:flex'}`}>
                    {/* Header */}
                    <div className="px-4 py-2.5 md:px-5 md:py-3 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-surface)]/95 backdrop-blur-md z-20 shadow-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Back button — mobile only */}
                            <button onClick={() => setSelectedLeadId(null)} aria-label={t('common.back')} className="md:hidden text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] p-1.5 min-h-[44px] min-w-[44px] rounded-full transition-colors shrink-0 -ml-1 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                                {ICONS.BACK}
                            </button>
                            {/* Avatar */}
                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center font-bold text-indigo-600 border border-indigo-200 shrink-0 text-sm">
                                {selectedThread.lead.name.charAt(0).toUpperCase()}
                            </div>
                            {/* Name + status */}
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{selectedThread.lead.name}</span>
                                    <span className="text-2xs px-1.5 py-0.5 rounded-md uppercase font-bold border text-emerald-600 bg-emerald-50 border-emerald-100 shrink-0 hidden sm:inline">
                                        {selectedThread.lead.score?.score || 0}đ
                                    </span>
                                </div>
                                <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAiActiveForSelected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                                    <span className="truncate">{isAiActiveForSelected ? t('inbox.ai_agent_active') : t('inbox.human_control')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Assign Dropdown */}
                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD') && (
                                <div className="relative" ref={assignDropdownRef}>
                                    <button
                                        onClick={() => setIsAssignOpen(!isAssignOpen)}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-secondary)] rounded-lg px-2 py-1.5 min-h-[36px] hover:bg-[var(--glass-surface-hover)] transition-colors"
                                        title={t('inbox.assign_to')}
                                    >
                                        {/* Mobile: icon only — Desktop/tablet: text only */}
                                        <svg className="w-3.5 h-3.5 shrink-0 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        <span className="hidden md:inline truncate max-w-[80px] lg:max-w-[120px]">
                                            {selectedThread.lead.assignedTo 
                                                ? (selectedThread.lead.assignedToName || users.find((u: any) => u.id === selectedThread.lead.assignedTo)?.name || t('inbox.unassigned'))
                                                : t('inbox.unassigned')}
                                        </span>
                                        <svg className={`w-3 h-3 transition-transform text-[var(--text-tertiary)] ${isAssignOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    
                                    {isAssignOpen && (
                                        <div className="absolute right-0 mt-1 w-48 bg-[var(--bg-surface)] border border-[var(--glass-border)] shadow-xl rounded-xl z-50 overflow-hidden animate-enter">
                                            <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                                                <div className="px-3 py-2 text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--glass-surface)]/50">
                                                    {t('inbox.assign_to')}
                                                </div>
                                                {users.map((u: any) => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => {
                                                            handleAssign(selectedThread.lead.id, u.id);
                                                            setIsAssignOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2 ${selectedThread.lead.assignedTo === u.id ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-[var(--text-secondary)]'}`}
                                                    >
                                                        <span className="truncate min-w-0 flex-1">{u.name}</span>
                                                        {selectedThread.lead.assignedTo === u.id && (
                                                            <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI Toggle */}
                            <button 
                                onClick={(e) => toggleAiMode(e, selectedThread.lead.id)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition-all ${
                                    isAiActiveForSelected
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                title={t('inbox.toggle_ai')}
                            >
                                {/* Mobile: icon only — Desktop/tablet: text only */}
                                <span className="md:hidden">{isAiActiveForSelected ? ICONS.ROBOT_ON : ICONS.ROBOT_OFF}</span>
                                <span className="hidden md:inline">{isAiActiveForSelected ? t('inbox.auto_pilot') : t('inbox.manual')}</span>
                            </button>

                            {/* Delete */}
                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD') && (
                                <button
                                    onClick={(e) => requestDelete(e, selectedThread.lead.id)}
                                    aria-label={t('inbox.menu_delete')}
                                    className="p-1.5 min-h-[36px] min-w-[36px] text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    {ICONS.TRASH}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 bg-[var(--glass-surface)] space-y-3 sm:space-y-4 no-scrollbar scroll-smooth">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-60">
                                <div className="text-4xl mb-2">💬</div>
                                <div className="text-sm">{t('inbox.empty_messages')}</div>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <MessageBubble 
                                key={msg.id} 
                                msg={msg} 
                                t={t} 
                                formatTime={formatTime} 
                                formatCurrency={formatCurrency} 
                                formatDate={formatDate}
                                formatDateTime={formatDateTime}
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
                                    {t('inbox.ai_replying')}
                                </div>
                            </div>
                        )}
                        {streamingMessage && (
                            <MessageBubble 
                                msg={{
                                    id: 'streaming',
                                    direction: Direction.OUTBOUND,
                                    type: 'TEXT',
                                    content: streamingMessage,
                                    timestamp: new Date().toISOString(),
                                    status: 'PENDING',
                                    metadata: { isAgent: true }
                                }}
                                t={t}
                                formatTime={formatTime}
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                                formatDateTime={formatDateTime}
                                showDate={false}
                            />
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Bar */}
                    <div className="px-4 pt-2.5 sm:px-5 sm:pt-3 pb-safe bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--glass-border)] z-30">
                        {/* Channel selector row + supervisor badge */}
                        <div className="flex items-center justify-between gap-2 mb-2.5 min-w-0">

                            {/* ── Channel tabs (mobile + desktop) ── */}
                            <div className="flex flex-nowrap w-fit bg-[var(--glass-surface)] p-0.5 rounded-xl border border-[var(--glass-border)] overflow-x-auto no-scrollbar">
                                {([
                                    { ch: Channel.ZALO,  activeClass: 'bg-blue-600 text-white shadow-sm',     inactiveClass: 'text-blue-400 hover:text-blue-600' },
                                    { ch: Channel.EMAIL, activeClass: 'bg-indigo-600 text-white shadow-sm',   inactiveClass: 'text-indigo-400 hover:text-indigo-600' },
                                    { ch: Channel.SMS,   activeClass: 'bg-emerald-600 text-white shadow-sm', inactiveClass: 'text-emerald-500 hover:text-emerald-700' },
                                ] as const).map(({ ch, activeClass, inactiveClass }) => (
                                    <button
                                        key={ch}
                                        onClick={() => setChannel(ch)}
                                        className={`flex-none px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center whitespace-nowrap ${channel === ch ? activeClass : inactiveClass}`}
                                    >
                                        {channelLabel(ch)}
                                    </button>
                                ))}
                            </div>

                            {/* Supervisor mode badge */}
                            {!isAiActiveForSelected && (
                                <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 shrink-0">
                                    {ICONS.ALERT}
                                    <span className="hidden sm:inline">{t('inbox.supervisor_takeover_active')}</span>
                                    <span className="sm:hidden">Manual</span>
                                </div>
                            )}
                        </div>

                        {/* Text input row */}
                        <div className="flex items-end gap-1.5 bg-[var(--bg-surface)] p-1 pl-2.5 rounded-xl border border-[var(--glass-border)] focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all shadow-sm">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden" 
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                aria-label={t('inbox.attach')}
                                className="p-1.5 min-h-[36px] min-w-[36px] text-[var(--text-tertiary)] hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50 shrink-0 self-end mb-0.5 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                                {ICONS.ATTACH}
                            </button>
                            
                            <textarea 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if(e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                className="flex-1 min-w-0 bg-transparent border-none text-[16px] md:text-sm outline-none max-h-32 min-h-[36px] py-2 resize-none placeholder:text-[var(--text-muted)] leading-relaxed focus:ring-0 no-scrollbar"
                                placeholder={isAiActiveForSelected ? t('inbox.type_simulate') : t('inbox.reply_supervisor')}
                                rows={1}
                            />
                            
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isThinking}
                                aria-label={t('inbox.send')}
                                className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 shrink-0 self-end mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                            >
                                {ICONS.SEND}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center text-[var(--text-secondary)] bg-[var(--glass-surface)]/50">
                    <div className="text-center p-8">
                        <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-[var(--glass-border)]">
                            <div className="text-4xl opacity-50">📬</div>
                        </div>
                        <h3 className="font-bold text-[var(--text-secondary)] mb-1">{t('inbox.supervisor_cockpit')}</h3>
                        <p className="text-sm">{t('inbox.select')}</p>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal 
                isOpen={!!threadToDelete}
                title={t('common.delete')}
                message={t('inbox.delete_confirm_msg')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmDelete}
                onCancel={() => setThreadToDelete(null)}
                variant="danger"
            />

            {/* Widget Settings Modal */}
            {createPortal(
            <AnimatePresence>
                {isWidgetModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto no-scrollbar">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col my-auto shrink-0 overflow-hidden"
                        >
                            <div className="p-4 md:p-6 border-b border-[var(--glass-border)] flex justify-between items-start md:items-center bg-[var(--glass-surface)]/50 shrink-0">
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        {t('inbox.live_chat_widget')}
                                    </h2>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inbox.widget_subtitle')}</p>
                                </div>
                                <button onClick={() => setIsWidgetModalOpen(false)} aria-label={t('common.close')} className="p-2 min-h-[44px] min-w-[44px] text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] rounded-xl transition-colors shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-4 md:p-6 overflow-y-auto no-scrollbar">
                                <div className="space-y-6">
                                    {/* Widget Customization */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--glass-surface)] rounded-xl p-4 border border-[var(--glass-border)]">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">{t('inbox.widget_title_label')}</label>
                                            <input
                                                value={widgetTitle}
                                                onChange={e => setWidgetTitle(e.target.value)}
                                                placeholder={t('inbox.widget_title_placeholder')}
                                                className="w-full bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">{t('inbox.widget_desc_label')}</label>
                                            <input
                                                value={widgetDesc}
                                                onChange={e => setWidgetDesc(e.target.value)}
                                                placeholder={t('inbox.widget_desc_placeholder')}
                                                className="w-full bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Link */}
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">{t('inbox.widget_link_label')}</label>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                value={`${window.location.origin}/#/livechat?title=${encodeURIComponent(widgetTitle)}&desc=${encodeURIComponent(widgetDesc)}${currentUser?.id ? `&agent=${currentUser.id}` : ''}`}
                                                className="flex-1 min-w-0 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-sm text-[var(--text-secondary)] font-mono"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/#/livechat?title=${encodeURIComponent(widgetTitle)}&desc=${encodeURIComponent(widgetDesc)}${currentUser?.id ? `&agent=${currentUser.id}` : ''}`).catch(() => {});
                                                    notify(t('inbox.widget_link_copied'), 'success');
                                                }}
                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-sm whitespace-nowrap shrink-0"
                                            >
                                                {t('inbox.widget_copy')}
                                            </button>
                                        </div>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-2">{t('inbox.widget_link_desc')}</p>
                                    </div>

                                    {/* Embed Code */}
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">{t('inbox.widget_embed_label')}</label>
                                        <div className="relative">
                                            <textarea
                                                readOnly
                                                rows={6}
                                                value={`<script>\n  window.SGSLAND_CHAT_URL = "${window.location.origin}/#/livechat${currentUser?.id ? `?agent=${currentUser.id}` : ''}";\n  window.SGSLAND_CHAT_TITLE = "${widgetTitle}";\n  window.SGSLAND_CHAT_DESC = "${widgetDesc}";\n</script>\n<script src="${window.location.origin}/widget.js" async></script>`}
                                                className="w-full bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono resize-none leading-relaxed no-scrollbar"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`<script>\n  window.SGSLAND_CHAT_URL = "${window.location.origin}/#/livechat${currentUser?.id ? `?agent=${currentUser.id}` : ''}";\n  window.SGSLAND_CHAT_TITLE = "${widgetTitle}";\n  window.SGSLAND_CHAT_DESC = "${widgetDesc}";\n</script>\n<script src="${window.location.origin}/widget.js" async></script>`).catch(() => {});
                                                    notify(t('inbox.widget_embed_copied'), 'success');
                                                }}
                                                aria-label={t('inbox.widget_copy')}
                                                className="absolute top-2 right-2 p-2 bg-[var(--bg-surface)]/10 hover:bg-[var(--bg-surface)]/20 text-white rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-2">{t('inbox.widget_embed_desc')}</p>
                                    </div>

                                    {/* QR Code */}
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">{t('inbox.widget_qr_label')}</label>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-[var(--glass-surface)] p-4 rounded-xl border border-[var(--glass-border)]">
                                            <div className="bg-[var(--bg-surface)] p-2 rounded-xl shadow-sm border border-[var(--glass-border)] shrink-0 mx-auto sm:mx-0">
                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/livechat?title=${encodeURIComponent(widgetTitle)}&desc=${encodeURIComponent(widgetDesc)}${currentUser?.id ? `&agent=${currentUser.id}` : ''}`)}`} alt={t('inbox.widget_qr_label')} className="w-32 h-32" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            </div>
                                            <div className="text-center sm:text-left">
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('inbox.widget_qr_title')}</h4>
                                                <p className="text-xs text-[var(--text-tertiary)] mb-4 leading-relaxed">{t('inbox.widget_qr_desc')}</p>
                                                <a
                                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/#/livechat?title=${encodeURIComponent(widgetTitle)}&desc=${encodeURIComponent(widgetDesc)}${currentUser?.id ? `&agent=${currentUser.id}` : ''}`)}`}
                                                    download="livechat-qr.png"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label={t('inbox.widget_qr_download')}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-[var(--glass-surface)] transition-colors text-sm"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                    {t('inbox.widget_qr_download')}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>,
            document.body
            )}
        </div>
        </div>
        {createPortal(
            toast ? (
                <div role="status" aria-live="polite" aria-atomic="true" className={`fixed bottom-6 right-6 z-[100] px-4 md:px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border max-w-[90vw] md:max-w-md ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm break-words">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
