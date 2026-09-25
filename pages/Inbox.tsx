import { uiPrompt } from '../utils/uiDialog';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/dbApi';
import { api } from '../services/api/apiClient';
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
import { SeoHead } from '../components/SeoHead';
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
    WEBHOOK: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    VOICE: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    CHECK: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
    CHEVRON: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>,
};
/* ── Colour tokens for InboxDropdown — must be static strings for Tailwind ── */
const DD_COLORS: Record<string, { open: string; item: string; check: string }> = {
    indigo:  { open: 'bg-[var(--sgs-primary)]/10 border-[var(--sgs-primary)] text-[var(--sgs-primary)]',   item: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',   check: 'text-sgs-primary'  },
    blue:    { open: 'bg-blue-50 border-blue-400 text-blue-700',         item: 'bg-blue-50 text-blue-700',       check: 'text-blue-600'    },
    emerald: { open: 'bg-emerald-50 border-emerald-400 text-[var(--sgs-primary)]',item: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]', check: 'text-[var(--sgs-primary)]' },
    amber:   { open: 'bg-amber-50 border-amber-400 text-amber-700',      item: 'bg-[var(--glass-surface)] text-[var(--text-secondary)]',     check: 'text-[var(--text-secondary)]'   },
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
                className={`w-full flex items-center justify-between gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[38px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] transition-all border ${
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
    const [sharingProduct, setSharingProduct] = useState(false);
    const [channel, setChannel] = useState<Channel>(Channel.ZALO);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [channelFilter, setChannelFilter] = useState<'ALL' | Channel>('ALL');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
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
    const [shortLink, setShortLink] = useState<string | null>(null);
    const [isGeneratingShortLink, setIsGeneratingShortLink] = useState(false);
    const [linkChannel, setLinkChannel] = useState<'LINK' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK'>('LINK');
    const [qrChannel, setQrChannel] = useState<'QR' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK'>('QR');
    const [embedChannel, setEmbedChannel] = useState<'EMBED' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK'>('EMBED');
    const [widgetTab, setWidgetTab] = useState<'EMBED' | 'LINK' | 'QR'>('EMBED');    
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
    const [csatScore, setCsatScore] = useState<number | null>(null);
    const [csatReason, setCsatReason] = useState('');
    const [csatConsent, setCsatConsent] = useState(false);
    const [csatSubmitting, setCsatSubmitting] = useState(false);
    const [csatRecordedScore, setCsatRecordedScore] = useState<number | null>(null);
    const { t, formatTime, formatCurrency, formatDate, formatDateTime, language } = useTranslation();
    const channelLabel = useCallback((ch: string): string => {
        const map: Record<string, string> = {
            ZALO: t('inbox.channel_zalo'),
            FACEBOOK: t('inbox.channel_facebook'),
            EMAIL: t('inbox.channel_email'),
            SMS: t('inbox.channel_sms'),
            WEB: t('inbox.channel_web'),
            WEBHOOK: 'Webhook',
            VOICE: t('inbox.channel_voice'),
            TIKTOK: 'TikTok',
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
    // Generate short link when widget modal opens or params change
    const generateShortLink = useCallback(async (title: string, desc: string, agentId?: string, channel: string = 'LINK') => {
        setIsGeneratingShortLink(true);
        setShortLink(null);
        const origin = window.location.origin;
        const fullUrl = `${origin}/livechat?title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}${agentId ? `&agent=${agentId}` : ''}&source=${channel}&lang=${language}`;
        try {
            const res = await fetch('/api/links/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                body: JSON.stringify({ url: fullUrl }),
            });
            if (res.ok) {
                const data = await res.json();
                setShortLink(data.shortUrl);
            } else {
                setShortLink(fullUrl);
            }
        } catch {
            setShortLink(fullUrl);
        } finally {
            setIsGeneratingShortLink(false);
        }
    }, [language]);
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
    const buildLiveChatUrl = useCallback((channel: string) => {
        const params = new URLSearchParams({
            title: widgetTitle,
            desc: widgetDesc,
            source: channel,
            lang: language,
        });
        if (currentUser?.id) params.set('agent', currentUser.id);
        return `${window.location.origin}/livechat?${params.toString()}`;
    }, [widgetTitle, widgetDesc, currentUser?.id, language]);
    // Auto-generate short link when widget modal opens (debounced on title/desc/channel changes)
    useEffect(() => {
        if (!isWidgetModalOpen) return;
        const timer = setTimeout(() => {
            generateShortLink(widgetTitle, widgetDesc, currentUser?.id, linkChannel);
        }, 600);
        return () => clearTimeout(timer);
    }, [isWidgetModalOpen, widgetTitle, widgetDesc, currentUser?.id, linkChannel, generateShortLink]);
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
            // NOTE: Do NOT append to interactions cache here — handleNewMessage
            // (via receive_message) already does it for the active chat pane.
            // This handler is responsible ONLY for updating the sidebar.
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
        // Sync AI mode changes triggered by other agents or by the server
        const handleAiModeChanged = (data: { leadId: string; status: string }) => {
            if (!data?.leadId) return;
            setAutoResponseMap(prev => ({ ...prev, [data.leadId]: data.status === 'AI_ACTIVE' }));
        };
        socket.on("receive_message", handleNewMessage);
        socket.on("lead_scored", handleLeadScored);
        socket.on("new_inbound_message", handleNewInboundMessage);
        socket.on("escalate_to_human", handleEscalateToHuman);
        socket.on("ai_mode_changed", handleAiModeChanged);
        return () => {
            socket.off("receive_message", handleNewMessage);
            socket.off("lead_scored", handleLeadScored);
            socket.off("new_inbound_message", handleNewInboundMessage);
            socket.off("escalate_to_human", handleEscalateToHuman);
            socket.off("ai_mode_changed", handleAiModeChanged);
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
    const handleAiFeedback = useCallback(async (msg: any, rating: -1 | 1, correction?: string): Promise<boolean> => {
        try {
            await aiService.submitFeedback({
                interactionId: msg.id,
                leadId: selectedLeadId || undefined,
                rating,
                correction,
                agentNode: msg.metadata?.agentNode || 'writer',
                intent: msg.metadata?.intent,
                userMessage: msg.metadata?.userMessage,
                aiResponse: msg.content?.slice(0, 500),
                metadata: {
                    source: 'inbox_agent_message',
                    agent: msg.metadata?.agentNode || 'writer',
                    runId: msg.metadata?.runId,
                    traceId: msg.metadata?.traceId,
                    interactionId: msg.id,
                },
            });
            return true;
        } catch (error: any) {
            // A retry after refresh can hit the idempotency constraint. Treat
            // that as already recorded so the message does not invite a
            // second submission forever.
            return error?.status === 409;
        }
    }, [selectedLeadId]);
    const handleRequestCsat = async () => {
        if (!selectedLeadId || !csatChannel || hasCsatRequest || csatSubmitting) return;
        setCsatSubmitting(true);
        try {
            const prompt = 'Cảm ơn bạn đã trao đổi với SGS LAND. Bạn vui lòng đánh giá chất lượng hỗ trợ hôm nay từ 1 đến 5 (1 = chưa hài lòng, 5 = rất hài lòng).';
            const message = await db.sendInteraction(selectedLeadId, prompt, csatDeliveryChannel || csatChannel || 'WEB', {
                metadata: {
                    isAgent: true,
                    csatRequest: true,
                    csatRequestKey: `support_csat:conversation:${selectedLeadId}`,
                },
            });
            appendInteraction(selectedLeadId, message);
            socket.emit('send_message', { room: selectedLeadId, message });
            notify('Đã gửi lời mời đánh giá CSAT', 'success');
        } catch {
            notify('Không thể gửi lời mời đánh giá CSAT', 'error');
        } finally {
            setCsatSubmitting(false);
        }
    };
    const handleRecordCsat = async () => {
        if (!selectedLeadId || !csatChannel || !csatScore || !csatConsent || csatSubmitting) return;
        setCsatSubmitting(true);
        try {
            await api.post<any>('/api/ai/signals/csat', {
                subjectId: selectedLeadId,
                score: csatScore,
                channel: csatDeliveryChannel,
                consent: true,
                reason: csatScore <= 2 ? csatReason.trim() : undefined,
            });
            setCsatRecordedScore(csatScore);
            setCsatScore(null);
            setCsatReason('');
            setCsatConsent(false);
            notify('Đã ghi nhận đánh giá CSAT', 'success');
        } catch (error: any) {
            notify(error?.message || 'Không thể ghi nhận CSAT', 'error');
        } finally {
            setCsatSubmitting(false);
        }
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
                            runId: aiResult.runId,
                            traceId: aiResult.traceId,
                            agentNode: 'writer',
                            artifact: aiResult.artifact,
                            aiConfidence: aiResult.confidence,
                            aiSentiment: aiResult.sentiment,
                            intent: aiResult.intent,
                            userMessage: cleanInput?.slice(0, 300),
                        },
                    });
                    // Clear streaming bubble BEFORE appending committed msg to avoid
                    // a render where both the streamed bubble and the final msg are visible
                    setIsThinking(false);
                    setStreamingMessage('');
                    appendInteraction(selectedLeadId, aiMsg);
                    socket.emit("send_message", { room: selectedLeadId, message: aiMsg });
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
    const handleShareProduct = async () => {
        if (!selectedLeadId || sharingProduct) return;
        if (!threads.find(t => t.lead.id === selectedLeadId)?.lead?.socialIds?.zalo) {
            notify('Khách hàng chưa liên kết tài khoản Zalo.', 'error');
            return;
        }
        const code = (await uiPrompt('Nhập mã sản phẩm cần gửi qua Zalo:'));
        if (!code?.trim()) return;
        setSharingProduct(true);
        try {
            const result = await db.getListings(1, 5, { search: code.trim() });
            const listing = (result.data || []).find((item: any) =>
                String(item.code || '').toUpperCase() === code.trim().toUpperCase(),
            );
            if (!listing) {
                notify('Không tìm thấy sản phẩm theo mã này.', 'error');
                return;
            }
            const deliveryKey = `inbox-product:${selectedLeadId}:${listing.id}:${Date.now()}`;
            const message = await db.sendInteraction(selectedLeadId, '', Channel.ZALO, {
                metadata: {
                    productShare: {
                        productId: listing.id,
                        productCode: listing.code,
                        deliveryKey,
                        language: language === 'en' ? 'en' : 'vi',
                    },
                },
            });
            appendInteraction(selectedLeadId, message);
            socket.emit("send_message", { room: selectedLeadId, message });
            notify(
                message.status === 'SENT'
                    ? 'Đã gửi đầy đủ thông tin và hình ảnh sản phẩm qua Zalo.'
                    : (message.metadata?.deliveryError || 'Gửi sản phẩm cần được kiểm tra lại.'),
                message.status === 'SENT' ? 'success' : 'error',
            );
            queryClient.invalidateQueries({ queryKey: ['inboxThreads'] });
        } catch {
            notify('Không thể gửi sản phẩm qua Zalo.', 'error');
        } finally {
            setSharingProduct(false);
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
    const csatChannel = useMemo(() => {
        const eligible = new Set(['WEB', 'WEB_CHAT', 'ZALO', 'FACEBOOK', 'MESSENGER']);
        const latest = [...messages].reverse().find(message => eligible.has(String(message.channel || '').toUpperCase()));
        const channel = String(latest?.channel || selectedThread?.lastChannel || '').toUpperCase();
        return eligible.has(channel) ? channel : null;
    }, [messages, selectedThread?.lastChannel]);
    const csatDeliveryChannel = csatChannel === 'WEB_CHAT'
        ? 'WEB'
        : csatChannel === 'MESSENGER'
            ? 'FACEBOOK'
            : csatChannel;
    const hasCsatRequest = useMemo(
        () => messages.some(message => message.metadata?.csatRequest === true),
        [messages],
    );
    useEffect(() => {
        setCsatScore(null);
        setCsatReason('');
        setCsatConsent(false);
        setCsatRecordedScore(null);
    }, [selectedLeadId]);
    const isAiActiveForSelected = selectedLeadId ? autoResponseMap[selectedLeadId] : false;
    // When in manual mode, hide system-generated AI busy/error messages — they are
    // noise for the human agent and confuse the conversation history.
    const AI_SYS_PATTERNS = ['đang bận', 'system busy', 'tạm thời không khả dụng', 'temporarily busy'];
    const visibleMessages = useMemo(() => {
        if (isAiActiveForSelected) return messages;
        return messages.filter(msg => {
            if (msg.metadata?.isSysMsg) return false;
            // Backward-compat: detect old DB messages without the flag by content
            if (msg.metadata?.isAgent && msg.direction === 'OUTBOUND') {
                const c = (msg.content || '').toLowerCase();
                if (AI_SYS_PATTERNS.some(p => c.includes(p))) return false;
            }
            return true;
        });
    }, [messages, isAiActiveForSelected]);
    const inboxUnreadTotal = threads.reduce((sum, th) => sum + (th.unreadCount || 0), 0);
    const canDeleteThreads = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(currentUser?.role ?? '');
    // One traffic-source selector drives the link, embed and QR variants.
    const selectWidgetSource = (src: 'DEFAULT' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK') => {
        setLinkChannel(src === 'DEFAULT' ? 'LINK' : src);
        setEmbedChannel(src === 'DEFAULT' ? 'EMBED' : src);
        setQrChannel(src === 'DEFAULT' ? 'QR' : src);
    };
    const widgetEmbedCode = `<script>\n  window.SGSLAND_CHAT_URL = "${buildLiveChatUrl(embedChannel)}";\n</script>\n<script src="${window.location.origin}/widget.js" async></script>`;
    return (
        <>
          <SeoHead title="Hộp Thư | SGS LAND" description="Quản lý tin nhắn, thông báo và giao tiếp với khách hàng trên nền tảng SGS LAND." canonicalPath="/inbox" />
        {/* Full-bleed on mobile, padded on sm+ — fills the flex-1 parent from Layout */}
        <div className="h-full sm:p-3 lg:p-4">
        <div className="flex h-full bg-[var(--bg-surface)] sm:rounded-2xl sm:border border-[var(--glass-border)] sm:shadow-sm overflow-hidden animate-enter relative">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 lg:w-[340px] shrink-0 border-r border-[var(--glass-border)] flex flex-col bg-[var(--bg-surface)] ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="px-3 sm:px-4 pt-3 pb-2.5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] z-10 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        <div role="tablist" aria-label={t('inbox.filter_status')} className="flex flex-1 min-w-0 p-0.5 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                            {(['ALL', 'UNREAD'] as const).map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    role="tab"
                                    aria-selected={statusFilter === v}
                                    onClick={() => setStatusFilter(v)}
                                    className={`flex-1 min-h-[36px] px-2 rounded-[10px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${statusFilter === v ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {v === 'ALL' ? t('inbox.filter_all') : t('inbox.filter_unread')}
                                    {v === 'UNREAD' && inboxUnreadTotal > 0 && (
                                        <span className="min-w-[18px] px-1 rounded-full bg-[var(--sgs-primary)] text-white text-2xs font-bold leading-[18px] text-center">{inboxUnreadTotal > 99 ? '99+' : inboxUnreadTotal}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsWidgetModalOpen(true)}
                            title={t('inbox.live_chat_widget')}
                            className="shrink-0 min-h-[40px] px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--sgs-primary)] hover:text-[var(--sgs-primary)] transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            <span>{t('inbox.embed_short')}</span>
                        </button>
                    </div>
                    <div className="relative">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)]">
                            {ICONS.SEARCH}
                        </div>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl pl-9 pr-10 py-2 min-h-[40px] text-sm outline-none focus:border-sgs-primary focus:bg-[var(--bg-surface)] transition-all"
                            placeholder={t('inbox.search_placeholder')}
                            aria-label={t('inbox.search_placeholder')}
                        />
                        {search && (
                            <div className="absolute right-1.5 inset-y-0 flex items-center">
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-[var(--glass-surface-hover)] flex items-center justify-center"
                                    title={t('common.clear_search')}
                                    aria-label={t('common.clear_search')}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Channel filter chips (was a hidden popover) */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5" role="group" aria-label={t('inbox.filter_channel')}>
                        {(['ALL', Channel.WEB, Channel.ZALO, Channel.FACEBOOK, Channel.EMAIL, Channel.SMS] as const).map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setChannelFilter(v as 'ALL' | Channel)}
                                aria-pressed={channelFilter === v}
                                className={`shrink-0 min-h-[32px] px-3 rounded-full text-xs font-medium border transition-colors ${channelFilter === v ? 'bg-[var(--sgs-primary)] border-[var(--sgs-primary)] text-white' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)]'}`}
                            >
                                {v === 'ALL' ? t('inbox.filter_all') : channelLabel(v)}
                            </button>
                        ))}
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
                                    className={`flex gap-3 px-3 sm:px-4 py-3 border-b border-[var(--glass-border)] hover:bg-[var(--glass-surface)] cursor-pointer transition-colors group relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full ${selectedLeadId === thread.lead.id ? 'bg-[var(--sgs-primary)]/5 before:bg-[var(--sgs-accent)]' : 'before:bg-transparent'}`}
                                >
                                    <div className="relative shrink-0 mt-0.5">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${thread.unreadCount > 0 ? 'bg-[var(--sgs-primary)] text-white' : 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]'}`}>
                                            {(thread.lead.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span
                                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center"
                                            title={isAiEnabled ? t('inbox.ai_agent_active') : t('inbox.human_control')}
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full ${isAiEnabled ? 'bg-sgs-verified' : 'bg-[var(--text-tertiary)]'}`} />
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <div className={`text-sm text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1 ${thread.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
                                            <span className="truncate">{thread.lead.name}</span>
                                                                                    </div>
                                        {thread.lastMessage && <div className={`text-xs2 whitespace-nowrap shrink-0 mt-0.5 transition-opacity ${thread.unreadCount > 0 ? 'text-[var(--sgs-primary)] font-semibold' : 'text-[var(--text-tertiary)]'} ${canDeleteThreads ? 'group-hover:opacity-0' : ''}`}>{formatTime(thread.lastMessage.timestamp)}</div>}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 gap-2">
                                        <div className={`text-xs truncate min-w-0 flex-1 flex items-center gap-1.5 ${thread.unreadCount > 0 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                            {/* Follow-up badge — shown when last outbound was an AI follow-up */}
                                            {thread.lastMessage?.direction === 'OUTBOUND' && thread.lastMessage?.metadata?.isFollowUp && (
                                                <span
                                                    className="text-2xs font-bold px-1.5 py-0.5 rounded shrink-0 bg-amber-50 text-sgs-accent-text border border-[var(--glass-border)]"
                                                    title={`Follow-up tự động ngày ${thread.lastMessage.metadata.followUpDay ?? ''}`}
                                                >
                                                    ⏰ {thread.lastMessage.metadata.followUpDay ? `D${thread.lastMessage.metadata.followUpDay}` : 'FU'}
                                                </span>
                                            )}
                                            {/* Channel badge */}
                                            {thread.lastChannel && thread.lastChannel !== 'INTERNAL' && (() => {
                                                const ch = thread.lastChannel;
                                                const styles: Record<string, string> = {
                                                    ZALO: "bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]",
                                                    FACEBOOK: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',
                                                    EMAIL:   'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',
                                                    SMS: "bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]",
                                                    WEB:     'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',
                                                    WEBHOOK: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',
                                                    VOICE: "bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]",
                                                };
                                                const badgeLabels: Record<string, string> = {
                                                    ZALO:    t('inbox.channel_badge_zalo'),
                                                    FACEBOOK:t('inbox.channel_badge_facebook'),
                                                    EMAIL:   t('inbox.channel_badge_email'),
                                                    SMS:     t('inbox.channel_badge_sms'),
                                                    WEB:     t('inbox.channel_badge_web'),
                                                    WEBHOOK: 'Hook',
                                                    VOICE:   'Tel',
                                                };
                                                return (
                                                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded shrink-0 ${styles[ch] || 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]'}`}
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
                                                <div className="text-2xs font-bold text-[var(--text-secondary)] bg-[var(--glass-surface)] px-1.5 py-0.5 rounded truncate max-w-[60px]" title={thread.lead.assignedToName || users.find((u: any) => u.id === thread.lead.assignedTo)?.name || t('inbox.unassigned')}>
                                                    {(thread.lead.assignedToName || users.find((u: any) => u.id === thread.lead.assignedTo)?.name || '')?.split(' ').pop() || ''}
                                                </div>
                                            )}
                                            {thread.unreadCount > 0 && (
                                                <div className="bg-[var(--sgs-primary)] text-white text-xs2 font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</div>
                                            )}
                                        </div>
                                    </div>                                    
                                    </div>
                                    {/* Hover Delete Button */}
                                    {(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(currentUser?.role ?? '')) && (
                                        <button 
                                            onClick={(e) => requestDelete(e, thread.lead.id)}
                                            className="absolute right-2 top-2 p-1.5 bg-[var(--bg-surface)] shadow-sm border border-[var(--glass-border)] rounded-full text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all z-10"
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
            {selectedThread ? (<>
                <div className={`flex-1 flex flex-col bg-[var(--bg-surface)] h-full relative min-w-0 ${selectedLeadId ? 'flex' : 'hidden md:flex'}`}>
                    {/* Header */}
                    <div className="px-3 py-2 md:px-5 md:py-2.5 min-h-[60px] border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-surface)] z-20 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Back button — mobile only */}
                            <button onClick={() => setSelectedLeadId(null)} aria-label={t('common.back')} className="md:hidden text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] p-1.5 min-h-[44px] min-w-[44px] rounded-full transition-colors shrink-0 -ml-1 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary">
                                {ICONS.BACK}
                            </button>
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-[var(--sgs-primary)] text-white flex items-center justify-center font-bold shrink-0 text-sm min-[1440px]:hidden">
                                {selectedThread.lead.name.charAt(0).toUpperCase()}
                            </div>
                            {/* Name + status */}
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{selectedThread.lead.name}</span>
                                    {(selectedThread.lead.score?.score || 0) > 0 && (
                                        <span className="ui-badge ui-badge-info shrink-0 hidden sm:inline-flex">{t('inbox.score_points', { n: selectedThread.lead.score?.score })}</span>
                                    )}
                                </div>
                                <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAiActiveForSelected ? 'bg-sgs-verified' : 'bg-[var(--sgs-accent)]'}`}></span>
                                    <span className="truncate">{isAiActiveForSelected ? t('inbox.ai_agent_active') : t('inbox.human_control')}</span>
                                </div>
                            </div>
                        </div>                        
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Assign Dropdown */}
                            {(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(currentUser?.role ?? '')) && (
                                <div className="relative" ref={assignDropdownRef}>
                                    <button
                                        onClick={() => setIsAssignOpen(!isAssignOpen)}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-secondary)] rounded-lg px-2.5 py-1.5 min-h-[40px] min-w-[40px] justify-center hover:bg-[var(--glass-surface-hover)] transition-colors"
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
                                                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--sgs-primary)]/10 transition-colors flex items-center justify-between gap-2 ${selectedThread.lead.assignedTo === u.id ? 'text-[var(--sgs-primary)] font-bold bg-[var(--sgs-primary)]/10' : 'text-[var(--text-secondary)]'}`}
                                                    >
                                                        <span className="truncate min-w-0 flex-1">{u.name}</span>
                                                        {selectedThread.lead.assignedTo === u.id && (
                                                            <svg className="w-4 h-4 text-sgs-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
                                aria-pressed={isAiActiveForSelected}
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[40px] min-w-[40px] rounded-lg text-xs font-bold border transition-all ${
                                    isAiActiveForSelected
                                    ? 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--glass-border)] hover:bg-[var(--sgs-primary)]/20'
                                    : 'bg-[var(--glass-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]'
                                }`}
                                title={t('inbox.toggle_ai')}
                            >
                                {/* Mobile: icon only — Desktop/tablet: text only */}
                                <span className="md:hidden">{isAiActiveForSelected ? ICONS.ROBOT_ON : ICONS.ROBOT_OFF}</span>
                                <span className="hidden md:inline">{isAiActiveForSelected ? t('inbox.auto_pilot') : t('inbox.manual')}</span>
                            </button>
                            {/* Delete */}
                            {(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(currentUser?.role ?? '')) && (
                                <button
                                    onClick={(e) => requestDelete(e, selectedThread.lead.id)}
                                    aria-label={t('inbox.menu_delete')}
                                    className="p-1.5 min-h-[40px] min-w-[40px] text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    {ICONS.TRASH}
                                </button>
                            )}
                        </div>
                    </div>
                    {csatChannel && (
                        <div className="border-b border-[var(--glass-border)] bg-[var(--glass-surface)]/60 px-3 py-2 sm:px-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[var(--text-primary)]">{t('inbox.csat_title')}</div>
                                    <div className="text-[11px] text-[var(--text-secondary)]">
                                        {t('inbox.csat_hint', { channel: csatChannel === 'WEB_CHAT' ? 'Web' : channelLabel(csatChannel) })}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleRequestCsat()}
                                    disabled={hasCsatRequest || csatSubmitting}
                                    className="min-h-[36px] rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--sgs-primary)] transition-colors hover:bg-[var(--sgs-primary)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {hasCsatRequest ? t('inbox.csat_sent') : csatSubmitting ? t('inbox.status_sending') : t('inbox.csat_send')}
                                </button>
                            </div>
                            {hasCsatRequest && !csatRecordedScore && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] text-[var(--text-secondary)]">{t('inbox.csat_score_label')}</span>
                                    {[1, 2, 3, 4, 5].map(score => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => {
                                                 setCsatScore(score);
                                                 if (score > 2) setCsatReason('');
                                             }}
                                            aria-pressed={csatScore === score}
                                            className={`min-h-[32px] min-w-[32px] rounded-lg border px-2 text-xs font-bold transition-colors ${csatScore === score ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)] text-white' : 'border-[var(--glass-border)] bg-[var(--glass-surface)] text-[var(--text-primary)] hover:border-[var(--sgs-primary)]'}`}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                    {csatScore !== null && csatScore <= 2 && (
                                        <label className="basis-full text-[11px] text-[var(--text-secondary)]">
                                            {t('inbox.csat_reason_label')}
                                            <textarea
                                                value={csatReason}
                                                onChange={event => setCsatReason(event.target.value.slice(0, 500))}
                                                maxLength={500}
                                                rows={2}
                                                placeholder={t('inbox.csat_reason_placeholder')}
                                                aria-label={t('inbox.csat_reason_label')}
                                                className="mt-1 block w-full resize-y rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--sgs-primary)]"
                                            />
                                            <span className="mt-1 block text-right text-[10px]">{csatReason.length}/500</span>
                                        </label>
                                    )}
                                    <label className="flex basis-full items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                        <input
                                            type="checkbox"
                                            checked={csatConsent}
                                            onChange={event => setCsatConsent(event.target.checked)}
                                            className="accent-[var(--sgs-primary)]"
                                        />
                                        {t('inbox.csat_consent')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => void handleRecordCsat()}
                                        disabled={!csatScore || !csatConsent || csatSubmitting}
                                        className="rounded-lg bg-[var(--sgs-primary)] px-3 py-1.5 text-xs font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {t('inbox.csat_record')}
                                    </button>
                                </div>
                            )}
                            {csatRecordedScore && (
                                <div className="mt-2 text-[11px] font-semibold text-emerald-700">
                                    {t('inbox.csat_recorded', { score: csatRecordedScore })}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 bg-[var(--glass-surface)] space-y-3 no-scrollbar scroll-smooth">
                        {visibleMessages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-60">
                                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h8M8 14h5m-9 6l2.6-2.6A2 2 0 018 17h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" /></svg>
                                <div className="text-sm">{t('inbox.empty_messages')}</div>
                            </div>
                        )}
                        {visibleMessages.map((msg, idx) => (
                            <MessageBubble 
                                key={msg.id} 
                                msg={msg} 
                                t={t} 
                                formatTime={formatTime} 
                                formatCurrency={formatCurrency} 
                                formatDate={formatDate}
                                formatDateTime={formatDateTime}
                                showDate={idx === 0 || new Date(msg.timestamp).getDate() !== new Date(visibleMessages[idx-1].timestamp).getDate()}
                                onAiFeedback={handleAiFeedback}
                            />
                        ))}
                        {isThinking && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-[var(--bg-surface)] border border-sgs-border text-sgs-primary px-4 py-3 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-2 shadow-sm">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-[var(--sgs-primary)] rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-[var(--sgs-primary)] rounded-full animate-bounce delay-75"></span>
                                        <span className="w-1.5 h-1.5 bg-[var(--sgs-primary)] rounded-full animate-bounce delay-150"></span>
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
                    <div className="px-3 pt-2.5 sm:px-5 sm:pt-3 pb-3 sm:pb-4 pb-safe bg-[var(--bg-surface)] border-t border-[var(--glass-border)] z-30">
                        {!isAiActiveForSelected && (
                            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-sgs-accent-text">
                                {ICONS.ALERT}
                                <span className="truncate">{t('inbox.supervisor_takeover_active')}</span>
                            </div>
                        )}
                        {/* Text input row */}
                        <div className="flex items-end gap-1 bg-[var(--bg-surface)] p-1.5 rounded-2xl border border-[var(--glass-border)] focus-within:border-[var(--sgs-primary)] focus-within:ring-2 focus-within:ring-[var(--sgs-primary)]/20 transition-all shadow-sm">
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
                                className="p-1.5 min-h-[40px] min-w-[40px] text-[var(--text-tertiary)] hover:text-[var(--sgs-primary)] transition-colors rounded-lg hover:bg-[var(--glass-surface-hover)] shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary"
                            >
                                {ICONS.ATTACH}
                            </button>                            
                            {channel === Channel.ZALO && !isAiActiveForSelected && (
                                <button
                                    type="button"
                                    onClick={() => void handleShareProduct()}
                                    disabled={sharingProduct}
                                    aria-label={t('inbox.share_product_zalo')}
                                    title={t('inbox.share_product_zalo_hint')}
                                    className="p-1.5 min-h-[40px] min-w-[40px] text-[var(--text-tertiary)] hover:text-[var(--sgs-primary)] transition-colors rounded-lg hover:bg-[var(--glass-surface-hover)] shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary disabled:opacity-50"
                                >
                                    {sharingProduct ? <span className="text-xs">…</span> : ICONS.ZALO}
                                </button>
                            )}
                            <textarea 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if(e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                className="flex-1 min-w-0 bg-transparent border-none text-[16px] md:text-sm outline-none max-h-32 min-h-[40px] py-2 px-1 resize-none placeholder:text-[var(--text-muted)] leading-relaxed focus:ring-0 no-scrollbar flex items-center"
                                placeholder={isAiActiveForSelected ? t('inbox.type_simulate') : t('inbox.reply_supervisor')}
                                rows={1}
                            />                            
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isThinking}
                                aria-label={t('inbox.send')}
                                className="w-10 h-10 flex items-center justify-center bg-sgs-primary text-white rounded-xl shadow-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary focus-visible:ring-offset-1"
                            >
                                {ICONS.SEND}
                            </button>
                        </div>
                    </div>
                </div>
                {/* Customer context (xl+) */}
                <aside className="hidden min-[1440px]:flex w-[300px] shrink-0 flex-col border-l border-[var(--glass-border)] bg-[var(--bg-surface)] overflow-y-auto no-scrollbar" aria-label={t('inbox.context_title')}>
                    <div className="p-5 flex flex-col items-center text-center border-b border-[var(--glass-border)]">
                        <div className="w-14 h-14 rounded-full bg-[var(--sgs-primary)] text-white flex items-center justify-center text-lg font-bold">
                            {(selectedThread.lead.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="mt-3 font-semibold text-[var(--text-primary)] truncate max-w-full">{selectedThread.lead.name}</div>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                            {selectedThread.lastChannel && selectedThread.lastChannel !== 'INTERNAL' && (
                                <span className="ui-badge ui-badge-info">{channelLabel(selectedThread.lastChannel)}</span>
                            )}
                            <span className={isAiActiveForSelected ? 'ui-badge ui-badge-success' : 'ui-badge ui-badge-warning'}>
                                {isAiActiveForSelected ? t('inbox.auto_pilot') : t('inbox.manual')}
                            </span>
                        </div>
                        {selectedThread.lead.phone && (
                            <a href={`tel:${selectedThread.lead.phone}`} className="mt-4 w-full min-h-[40px] rounded-xl bg-[var(--sgs-primary)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>
                                {t('leads.call')}
                            </a>
                        )}
                    </div>
                    <div className="p-5">
                        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-3">{t('inbox.context_title')}</div>
                        <dl className="space-y-3 text-sm">
                            {([
                                [t('leads.phone'), selectedThread.lead.phone],
                                [t('leads.email'), selectedThread.lead.email],
                                [t('leads.stage'), selectedThread.lead.stage ? t(`stage.${selectedThread.lead.stage}`) : ''],
                                [t('leads.source'), selectedThread.lead.source],
                                [t('leads.score'), (selectedThread.lead.score?.score || 0) > 0 ? t('inbox.score_points', { n: selectedThread.lead.score?.score }) : t('leads.not_scored')],
                                [t('inbox.assign_to'), selectedThread.lead.assignedToName || users.find((u: any) => u.id === selectedThread.lead.assignedTo)?.name || t('inbox.unassigned')],
                            ] as [string, any][]).map(([label, value]) => (
                                <div key={label} className="flex items-start justify-between gap-3">
                                    <dt className="text-[var(--text-tertiary)] shrink-0">{label}</dt>
                                    <dd className="text-[var(--text-primary)] font-medium text-right min-w-0 break-words">{value || '—'}</dd>
                                </div>
                            ))}
                        </dl>
                        {Array.isArray(selectedThread.lead.tags) && selectedThread.lead.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {selectedThread.lead.tags.slice(0, 8).map((tag: string) => (
                                    <span key={tag} className="ui-badge ui-badge-neutral">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center text-[var(--text-secondary)] bg-[var(--glass-surface)]">
                    <div className="text-center p-8 max-w-xs">
                        <div className="w-16 h-16 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-[var(--glass-border)] text-[var(--sgs-primary)]">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 6l2.6-2.6A2 2 0 018 17h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" /></svg>
                        </div>
                        <h3 className="font-semibold text-[var(--text-primary)] mb-1">{t('inbox.supervisor_cockpit')}</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">{t('inbox.select')}</p>
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
                    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 bg-sgs-primary-deep/50 backdrop-blur-sm overflow-y-auto no-scrollbar">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col my-auto shrink-0 overflow-hidden max-h-[calc(100dvh-2rem)]"
                        >
                            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] flex justify-between items-start md:items-center gap-3 bg-[var(--bg-surface)] shrink-0">
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-sgs-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        {t('inbox.live_chat_widget')}
                                    </h2>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inbox.widget_subtitle')}</p>
                                </div>
                                <button onClick={() => setIsWidgetModalOpen(false)} aria-label={t('common.close')} className="p-2 min-h-[44px] min-w-[44px] text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] rounded-xl transition-colors shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sgs-primary">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>                            
                            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                              <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="p-4 md:p-6 space-y-6 min-w-0">
                                    {/* Step 1: appearance */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[var(--sgs-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                                            {t('inbox.widget_step_customize')}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="block">
                                                <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('inbox.widget_title_label')}</span>
                                                <input
                                                    value={widgetTitle}
                                                    onChange={e => setWidgetTitle(e.target.value)}
                                                    placeholder={t('inbox.widget_title_placeholder')}
                                                    className="w-full bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl px-3 py-2 min-h-[40px] text-sm text-[var(--text-primary)] outline-none focus:border-sgs-primary transition-all"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('inbox.widget_desc_label')}</span>
                                                <input
                                                    value={widgetDesc}
                                                    onChange={e => setWidgetDesc(e.target.value)}
                                                    placeholder={t('inbox.widget_desc_placeholder')}
                                                    className="w-full bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl px-3 py-2 min-h-[40px] text-sm text-[var(--text-primary)] outline-none focus:border-sgs-primary transition-all"
                                                />
                                            </label>
                                        </div>
                                    </section>
                                    {/* Step 2: traffic source (one selector drives link, embed and QR) */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[var(--sgs-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                                            {t('inbox.widget_step_source')}
                                        </h3>
                                        <p className="text-xs text-[var(--text-tertiary)] mb-3 ml-8">{t('inbox.widget_source_desc')}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {([
                                                { key: 'DEFAULT' as const, label: t('inbox.widget_source_default') },
                                                { key: 'ZALO' as const, label: 'Zalo' },
                                                { key: 'FACEBOOK' as const, label: 'Facebook' },
                                                { key: 'TIKTOK' as const, label: 'TikTok' },
                                                { key: 'SMS' as const, label: 'SMS' },
                                            ]).map(({ key, label }) => {
                                                const active = (embedChannel === 'EMBED' ? 'DEFAULT' : embedChannel) === key;
                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => selectWidgetSource(key)}
                                                        className={`min-h-[36px] px-3.5 text-xs font-semibold rounded-full transition-colors border ${active ? 'bg-[var(--sgs-primary)] text-white border-[var(--sgs-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--sgs-primary)] hover:text-[var(--text-primary)]'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                    {/* Step 3: get the code */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[var(--sgs-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                                            {t('inbox.widget_step_share')}
                                        </h3>
                                        <div role="tablist" aria-label={t('inbox.widget_step_share')} className="flex p-0.5 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] mb-3">
                                            {([
                                                { key: 'EMBED' as const, label: t('inbox.widget_embed_label') },
                                                { key: 'LINK' as const, label: t('inbox.widget_link_label') },
                                                { key: 'QR' as const, label: t('inbox.widget_qr_label') },
                                            ]).map(({ key, label }) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={widgetTab === key}
                                                    onClick={() => setWidgetTab(key)}
                                                    className={`flex-1 min-h-[36px] px-2 rounded-[10px] text-xs font-semibold transition-colors ${widgetTab === key ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {widgetTab === 'EMBED' && (
                                            <div>
                                                <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
                                                    <div className="flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5 bg-[var(--glass-surface)] border-b border-[var(--glass-border)]">
                                                        <span className="text-xs font-semibold text-[var(--text-secondary)]">HTML</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(widgetEmbedCode).catch(() => {});
                                                                notify(t('inbox.widget_embed_copied'), 'success');
                                                            }}
                                                            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-[var(--sgs-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                            {t('inbox.widget_copy_code')}
                                                        </button>
                                                    </div>
                                                    <pre className="m-0 max-h-56 overflow-auto no-scrollbar bg-[var(--sgs-primary-deep)] text-[var(--sgs-champagne)] text-xs leading-relaxed font-mono p-4 whitespace-pre-wrap break-all select-all"><code>{widgetEmbedCode}</code></pre>
                                                </div>
                                                <ol className="mt-3 space-y-1 text-xs text-[var(--text-secondary)] list-decimal pl-5">
                                                    <li>{t('inbox.widget_embed_step1')}</li>
                                                    <li>{t('inbox.widget_embed_desc')}</li>
                                                    <li>{t('inbox.widget_embed_step3')}</li>
                                                </ol>
                                            </div>
                                        )}
                                        {widgetTab === 'LINK' && (
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-xs text-[var(--text-tertiary)]">{t('inbox.widget_link_desc')}</span>
                                                    {shortLink && !isGeneratingShortLink && (
                                                        <span className="ui-badge ui-badge-success shrink-0">{t('inbox.widget_short_valid')}</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {isGeneratingShortLink ? (
                                                        <div className="flex-1 min-w-0 flex items-center gap-2 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl px-3 min-h-[40px]">
                                                            <svg className="w-4 h-4 animate-spin text-sgs-primary shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                            <span className="text-sm text-[var(--text-tertiary)] truncate">{t('inbox.widget_short_generating')}</span>
                                                        </div>
                                                    ) : (
                                                        <input
                                                            readOnly
                                                            value={shortLink || buildLiveChatUrl(linkChannel)}
                                                            onFocus={e => e.currentTarget.select()}
                                                            aria-label={t('inbox.widget_link_label')}
                                                            className="flex-1 min-w-0 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl px-3 min-h-[40px] text-sm text-[var(--text-primary)] font-mono"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const link = shortLink || buildLiveChatUrl(linkChannel);
                                                            navigator.clipboard.writeText(link).catch(() => {});
                                                            notify(t('inbox.widget_link_copied'), 'success');
                                                        }}
                                                        disabled={isGeneratingShortLink}
                                                        className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] bg-[var(--sgs-primary)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm whitespace-nowrap shrink-0 disabled:opacity-40"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                        <span className="hidden sm:inline">{t('inbox.widget_copy')}</span>
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => generateShortLink(widgetTitle, widgetDesc, currentUser?.id, linkChannel)}
                                                        disabled={isGeneratingShortLink}
                                                        className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-sgs-primary hover:bg-[var(--glass-surface-hover)] rounded-lg transition-colors disabled:opacity-40"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        {t('inbox.widget_refresh_link')}
                                                    </button>
                                                    <a
                                                        href={shortLink || buildLiveChatUrl(linkChannel)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-sgs-primary hover:bg-[var(--glass-surface-hover)] rounded-lg transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        {t('inbox.widget_open_link')}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                        {widgetTab === 'QR' && (
                                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
                                                <div className="bg-white p-2 rounded-xl shadow-sm border border-[var(--glass-border)] shrink-0">
                                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(buildLiveChatUrl(qrChannel))}`} alt={t('inbox.widget_qr_label')} className="w-32 h-32" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                </div>
                                                <div className="text-center sm:text-left min-w-0">
                                                    <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-1">{t('inbox.widget_qr_title')}</h4>
                                                    <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{t('inbox.widget_qr_desc')}</p>
                                                    <a
                                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(buildLiveChatUrl(qrChannel))}`}
                                                        download="livechat-qr.png"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 px-3.5 min-h-[40px] bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] font-semibold rounded-xl hover:border-[var(--sgs-primary)] transition-colors text-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                        {t('inbox.widget_qr_download')}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </div>
                                {/* Live preview */}
                                <aside className="hidden lg:flex flex-col gap-3 border-l border-[var(--glass-border)] bg-[var(--glass-surface)] p-5">
                                    <div className="text-xs font-semibold text-[var(--text-secondary)]">{t('inbox.widget_preview')}</div>
                                    <div className="rounded-2xl overflow-hidden border border-[var(--glass-border)] shadow-lg bg-[var(--bg-surface)]">
                                        <div className="bg-[var(--sgs-primary)] text-white px-4 py-3">
                                            <div className="text-sm font-semibold truncate">{widgetTitle || t('inbox.widget_title_placeholder')}</div>
                                            <div className="text-xs text-white/75 line-clamp-2 mt-0.5">{widgetDesc || t('inbox.widget_desc_placeholder')}</div>
                                        </div>
                                        <div className="p-3 space-y-2 bg-[var(--glass-surface)] min-h-[150px]">
                                            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--bg-surface)] border border-[var(--glass-border)] px-3 py-2 text-xs text-[var(--text-primary)]">{t('inbox.widget_preview_greeting')}</div>
                                            <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-[var(--sgs-primary)] text-white px-3 py-2 text-xs">{t('inbox.widget_preview_question')}</div>
                                        </div>
                                        <div className="border-t border-[var(--glass-border)] px-3 py-2.5 text-xs text-[var(--text-muted)]">{t('inbox.placeholder')}</div>
                                    </div>
                                    <div className="self-end w-12 h-12 rounded-full bg-[var(--sgs-primary)] text-white flex items-center justify-center shadow-lg" aria-hidden="true">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6l2.6-2.6A2 2 0 018 17h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" /></svg>
                                    </div>
                                    <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{t('inbox.widget_preview_hint')}</p>
                                </aside>
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