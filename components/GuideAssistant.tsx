import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bot,
    ChevronDown,
    Clock3,
    LifeBuoy,
    ListTodo,
    Maximize2,
    Mic,
    MicOff,
    Minimize2,
    Paperclip,
    Plus,
    RefreshCw,
    Send,
    ShieldCheck,
    X,
} from 'lucide-react';
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
    approval?: {
        id: string;
        title?: string;
        status?: string;
    };
};

type AssistantResponse = {
    response?: string;
    intent?: string;
    sources?: Array<{ tool?: string; source?: string }>;
    dataScope?: 'personal' | 'company';
    freshness?: string;
    status?: 'ok' | 'empty' | 'forbidden';
    escalationReason?: string;
    approval?: {
        id?: string;
        title?: string;
        status?: string;
    };
};

type SupportRequest = {
    id: string;
    trackingCode: string;
    title: string;
    status: string;
    updatedAt: string;
    latestReply?: string | null;
};

type PendingApprovalRequest = {
    id: string;
    actionType?: string;
    title?: string;
    summary?: string;
    status: string;
    leadName?: string;
};

type Conversation = {
    id: string;
    sessionId: string;
    messages: ChatMessage[];
    updatedAt: number;
};

type SupportDraft = { title: string; description: string };

type SpeechResultEvent = {
    results: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    onresult: ((event: SpeechResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type GuideAssistantProps = {
    open: boolean;
    onClose: () => void;
    onOpenApprovals?: () => void;
    canApprove?: boolean;
    activeRoute?: string;
    currentTitle?: string;
};

const MAX_HISTORY = 12;
const MAX_RECENT_CONVERSATIONS = 8;

const createConversation = (): Conversation => {
    const id = `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id,
        sessionId: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        messages: [],
        updatedAt: Date.now(),
    };
};

export const GuideAssistant: React.FC<GuideAssistantProps> = ({
    open,
    onClose,
    onOpenApprovals,
    canApprove = false,
    activeRoute,
    currentTitle,
}) => {
    const { t, formatDateTime } = useTranslation();
    const [input, setInput] = useState('');
    const [sendingConversationIds, setSendingConversationIds] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [approvingApprovalId, setApprovingApprovalId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>(() => [createConversation()]);
    const [activeConversationId, setActiveConversationId] = useState('');
    const [support, setSupport] = useState<SupportRequest[]>([]);
    const [supportDraft, setSupportDraft] = useState<SupportDraft | null>(null);
    const [supportConsent, setSupportConsent] = useState(false);
    const [supportSending, setSupportSending] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRequest[]>([]);
    const [approvalQueueCount, setApprovalQueueCount] = useState(0);
    const [approvalQueueLoading, setApprovalQueueLoading] = useState(false);
    const [approvalQueueUnavailable, setApprovalQueueUnavailable] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [voiceNotice, setVoiceNotice] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [failedMessage, setFailedMessage] = useState('');

    const activeConversation = useMemo(
        () => conversations.find(conversation => conversation.id === activeConversationId) ?? conversations[0],
        [activeConversationId, conversations],
    );
    const messages = activeConversation?.messages ?? [];
    const sending = Boolean(activeConversation && sendingConversationIds.includes(activeConversation.id));
    const isSupportDraftOpen = supportDraft !== null;
    const todoCount = canApprove ? Math.max(approvalQueueCount, pendingApprovals.length) : 0;
    const hasUncertainApproval = pendingApprovals.some(approval => approval.status.toUpperCase() === 'UNKNOWN');

    useEffect(() => {
        if (!activeConversationId && conversations[0]) setActiveConversationId(conversations[0].id);
    }, [activeConversationId, conversations]);

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, open, sending]);

    useEffect(() => {
        if (open && isSupportDraftOpen) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [open, isSupportDraftOpen]);

    useEffect(() => {
        if (!open) return;
        api.get<{ data: SupportRequest[] }>('/api/live-chat/support-requests')
            .then(result => setSupport(Array.isArray(result?.data) ? result.data : []))
            .catch(() => { /* Support history is optional; chat remains usable. */ });
    }, [open]);

    useEffect(() => {
        if (!open || !canApprove || hasUncertainApproval) return;
        let isCurrent = true;
        setApprovalQueueLoading(true);
        setApprovalQueueUnavailable(false);
        api.get<{ items?: PendingApprovalRequest[]; pendingCount?: number }>('/api/approval-requests')
            .then(result => {
                if (!isCurrent) return;
                const items = Array.isArray(result?.items) ? result.items : [];
                setPendingApprovals(items);
                setApprovalQueueCount(
                    typeof result?.pendingCount === 'number' && Number.isFinite(result.pendingCount)
                        ? Math.max(0, result.pendingCount)
                        : items.length,
                );
            })
            .catch(() => {
                if (!isCurrent) return;
                setPendingApprovals([]);
                setApprovalQueueCount(0);
                setApprovalQueueUnavailable(true);
            })
            .finally(() => {
                if (isCurrent) setApprovalQueueLoading(false);
            });
        return () => { isCurrent = false; };
    }, [open, canApprove, hasUncertainApproval]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (open) return;
        recognitionRef.current?.stop();
        setIsListening(false);
        setVoiceNotice('');
    }, [open]);

    useEffect(() => () => {
        recognitionRef.current?.stop();
    }, []);

    const updateConversationMessages = (conversationId: string, updater: (current: ChatMessage[]) => ChatMessage[]) => {
        setConversations(previous => previous.map(conversation => conversation.id === conversationId
            ? { ...conversation, messages: updater(conversation.messages), updatedAt: Date.now() }
            : conversation));
    };

    const selectConversation = (conversationId: string) => {
        setActiveConversationId(conversationId);
        setInput('');
        setError('');
        setFailedMessage('');
        setSupportDraft(null);
        setSupportConsent(false);
        setVoiceNotice('');
    };

    const startConversation = () => {
        const conversation = createConversation();
        setConversations(previous => [conversation, ...previous].slice(0, MAX_RECENT_CONVERSATIONS));
        setActiveConversationId(conversation.id);
        setInput('');
        setError('');
        setFailedMessage('');
        setSupportDraft(null);
        setSupportConsent(false);
        setVoiceNotice('');
    };

    const reset = () => {
        if (!activeConversation) return;
        const resetConversation: Conversation = {
            ...activeConversation,
            sessionId: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            messages: [],
            updatedAt: Date.now(),
        };
        setConversations(previous => [resetConversation, ...previous.filter(item => item.id !== resetConversation.id)]);
        setError('');
        setInput('');
        setFailedMessage('');
        setSupportDraft(null);
        setSupportConsent(false);
        setVoiceNotice('');
    };

    const createSupportRequest = async () => {
        if (!supportDraft || !supportConsent || supportSending || !activeConversation) return;
        setSupportSending(true);
        try {
            const created = await api.post<SupportRequest>('/api/live-chat/support-requests', {
                ...supportDraft,
                category: 'GUIDE_ESCALATION',
                sourceSessionId: activeConversation.sessionId,
                consent: true,
            });
            setSupport(previous => [created, ...previous.filter(item => item.id !== created.id)]);
            setSupportDraft(null);
            setSupportConsent(false);
        } catch {
            setError(t('guide.support_error'));
        } finally {
            setSupportSending(false);
        }
    };

    const send = async (value = input, isRetry = false) => {
        const message = value.trim();
        if (!message || sending || !activeConversation) return;
        const conversationId = activeConversation.id;
        const conversationSessionId = activeConversation.sessionId;
        const conversationMessages = activeConversation.messages;
        const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: message };
        const historyMessages = isRetry
            && conversationMessages[conversationMessages.length - 1]?.role === 'user'
            && conversationMessages[conversationMessages.length - 1]?.content === message
            ? conversationMessages.slice(0, -1)
            : conversationMessages;
        const history = historyMessages.slice(-MAX_HISTORY).map(item => ({ role: item.role, content: item.content }));
        if (!isRetry) updateConversationMessages(conversationId, current => [...current, userMessage]);
        setInput('');
        setError('');
        setFailedMessage('');
        setVoiceNotice('');
        setSendingConversationIds(previous => previous.includes(conversationId) ? previous : [...previous, conversationId]);
        try {
            const result = await api.post<AssistantResponse>('/api/live-chat/chat', {
                message,
                sessionId: conversationSessionId,
                context: {
                    mode: 'platform_guide',
                    language: 'vn',
                    history,
                },
            });
            const rawResponse = typeof result?.response === 'string' && result.response.trim()
                ? result.response.trim()
                : t('guide.response_unavailable');
            const approval = result?.approval && typeof result.approval.id === 'string' && result.approval.id.trim()
                ? {
                    id: result.approval.id,
                    title: typeof result.approval.title === 'string' ? result.approval.title : undefined,
                    status: typeof result.approval.status === 'string' ? result.approval.status : undefined,
                }
                : undefined;
            updateConversationMessages(conversationId, current => [...current, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: rawResponse,
                sources: Array.isArray(result?.sources) ? result.sources : [],
                dataScope: result?.dataScope,
                freshness: result?.freshness,
                status: result?.status,
                escalationReason: result?.escalationReason,
                approval,
            }]);
        } catch {
            setError(t('guide.connection_error'));
            setFailedMessage(message);
        } finally {
            setSendingConversationIds(previous => previous.filter(id => id !== conversationId));
        }
    };

    const approveRequest = async (approvalId: string) => {
        if (!canApprove || !activeConversation || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(approvalId)) return;
        const conversationId = activeConversation.id;
        const isQueueItem = pendingApprovals.some(approval => approval.id === approvalId);
        setApprovingApprovalId(approvalId);
        setError('');
        try {
            await api.post(`/api/approval-requests/${encodeURIComponent(approvalId)}/approve`, {});
            updateConversationMessages(conversationId, current => current.map(message => message.approval?.id === approvalId
                ? { ...message, approval: { ...message.approval, status: 'APPROVED' } }
                : message));
            if (isQueueItem) {
                setPendingApprovals(previous => previous.filter(approval => approval.id !== approvalId));
                setApprovalQueueCount(previous => Math.max(0, previous - 1));
            }
        } catch {
            // An approval may have committed before its response was lost. Never
            // retry a high-impact action blindly; send the user to verify its status.
            updateConversationMessages(conversationId, current => current.map(message => message.approval?.id === approvalId
                ? { ...message, approval: { ...message.approval, status: 'UNKNOWN' } }
                : message));
            setPendingApprovals(previous => previous.map(approval => approval.id === approvalId
                ? { ...approval, status: 'UNKNOWN' }
                : approval));
            setError(t('guide.approval_uncertain'));
        } finally {
            setApprovingApprovalId(null);
        }
    };

    const toggleVoiceInput = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            setVoiceNotice('');
            return;
        }
        const speechWindow = window as Window & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
        };
        const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
        if (!Recognition) {
            setVoiceNotice(t('guide.voice_unsupported'));
            return;
        }
        try {
            const recognition = new Recognition();
            recognition.lang = 'vi-VN';
            recognition.interimResults = false;
            recognition.onresult = event => {
                const transcript = Array.from(event.results)
                    .map(result => result[0]?.transcript?.trim() ?? '')
                    .filter(Boolean)
                    .join(' ');
                if (transcript) setInput(previous => previous ? `${previous} ${transcript}` : transcript);
            };
            recognition.onerror = () => {
                setIsListening(false);
                setVoiceNotice(t('guide.voice_error'));
            };
            recognition.onend = () => {
                setIsListening(false);
                setVoiceNotice(previous => previous === t('guide.voice_listening') ? '' : previous);
            };
            recognitionRef.current = recognition;
            recognition.start();
            setIsListening(true);
            setVoiceNotice(t('guide.voice_listening'));
        } catch {
            setIsListening(false);
            setVoiceNotice(t('guide.voice_error'));
        }
    };

    const conversationLabel = (conversation: Conversation) => {
        const firstUserMessage = conversation.messages.find(message => message.role === 'user')?.content;
        if (!firstUserMessage) return t('guide.conversation_untitled');
        return firstUserMessage.length > 48 ? `${firstUserMessage.slice(0, 48)}…` : firstUserMessage;
    };

    const sourceLine = (message: ChatMessage) => {
        const parts = [t('guide.source_checked')];
        const sourceNames = message.sources
            ?.map(source => source.source || source.tool)
            .filter((source): source is string => Boolean(source));
        if (sourceNames?.length) parts.push(`${t('guide.source_label')}: ${sourceNames.join(', ')}`);
        if (message.dataScope) {
            parts.push(`${t('guide.scope_label')}: ${t(message.dataScope === 'personal' ? 'guide.scope_personal' : 'guide.scope_company')}`);
        }
        if (message.freshness) parts.push(`${t('guide.freshness_label')}: ${formatDateTime(message.freshness)}`);
        if (message.status) parts.push(t(`guide.response_status_${message.status}`));
        if (message.escalationReason) parts.push(t('guide.escalation_required'));
        return parts.join(' · ');
    };

    if (!open) return null;

    return (
        <>
            <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={onClose}
                className="fixed inset-0 z-[139] bg-[var(--sgs-hero-deep)]/25 backdrop-blur-[2px] lg:hidden"
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-label={t('guide.panel_title')}
                data-active-route={activeRoute}
                className={`sgs-guide-panel fixed z-[140] flex min-h-0 flex-col overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-[var(--ui-shadow-md)] transition-[width,transform,opacity] duration-200 motion-reduce:transition-none
                    bottom-0 left-0 right-0 h-[min(88dvh,780px)] rounded-t-[1.35rem]
                    md:bottom-0 md:left-auto md:top-0 md:h-[100dvh] md:w-[min(460px,94vw)] md:rounded-none
                    lg:bottom-4 lg:right-4 lg:top-4 lg:h-auto lg:w-[380px] lg:rounded-2xl
                    ${expanded ? 'h-[min(94dvh,860px)] md:w-[min(600px,96vw)] lg:w-[min(560px,calc(100vw_-_3rem))]' : ''}`}
            >
                <div className="shrink-0 border-b border-[var(--glass-border)] bg-[var(--sgs-hero-deep)] px-4 pb-3 pt-2 text-[var(--sgs-champagne)] sm:px-5 sm:pt-4">
                    <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--sgs-champagne)]/50 md:hidden" />
                    <header className="flex min-h-11 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--sgs-champagne)]/20 bg-[var(--sgs-champagne)]/10">
                            <Bot size={19} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sgs-on-dark-muted)]">
                                {t('guide.brand')}
                            </p>
                            <h2 className="truncate text-[15px] font-semibold leading-5">{t('guide.title')}</h2>
                        </div>
                        <button
                            type="button"
                            onClick={reset}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--sgs-on-dark-muted)] transition-colors hover:bg-[var(--sgs-champagne)]/10 hover:text-[var(--sgs-champagne)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                            title={t('guide.reset')}
                            aria-label={t('guide.reset')}
                        >
                            <RefreshCw size={17} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setExpanded(value => !value)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--sgs-on-dark-muted)] transition-colors hover:bg-[var(--sgs-champagne)]/10 hover:text-[var(--sgs-champagne)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                            title={t(expanded ? 'guide.collapse' : 'guide.expand')}
                            aria-label={t(expanded ? 'guide.collapse' : 'guide.expand')}
                            aria-pressed={expanded}
                        >
                            {expanded ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--sgs-on-dark-muted)] transition-colors hover:bg-[var(--sgs-champagne)]/10 hover:text-[var(--sgs-champagne)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                            title={t('guide.close')}
                            aria-label={t('guide.close')}
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </header>
                    <div className="mt-3 flex items-center gap-2">
                        <label className="relative min-w-0 flex-1">
                            <span className="sr-only">{t('guide.conversation_selector')}</span>
                            <select
                                value={activeConversation?.id ?? ''}
                                onChange={event => selectConversation(event.target.value)}
                                aria-label={t('guide.conversation_selector')}
                                className="h-11 w-full appearance-none rounded-xl border border-[var(--sgs-champagne)]/20 bg-[var(--sgs-champagne)]/10 py-2 pl-3 pr-9 text-xs font-medium text-[var(--sgs-champagne)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                            >
                                {conversations.map(conversation => (
                                    <option key={conversation.id} value={conversation.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                                        {conversationLabel(conversation)}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sgs-on-dark-muted)]" />
                        </label>
                        <button
                            type="button"
                            onClick={startConversation}
                            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--sgs-champagne)]/20 bg-[var(--sgs-champagne)]/10 px-3 text-xs font-semibold text-[var(--sgs-champagne)] transition-colors hover:bg-[var(--sgs-champagne)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                            aria-label={t('guide.new_conversation')}
                            title={t('guide.new_conversation')}
                        >
                            <Plus size={16} aria-hidden="true" />
                            <span className="hidden sm:inline">{t('guide.new_conversation')}</span>
                        </button>
                    </div>
                    {currentTitle && (
                        <p className="mt-2 truncate text-[11px] text-[var(--sgs-on-dark-muted)]">
                            {t('guide.context_label')}: {currentTitle}
                        </p>
                    )}
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                    <section
                        aria-label={t('guide.todos_title')}
                        className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3.5"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sgs-champagne)] text-[var(--sgs-primary-deep)]">
                                <ListTodo size={18} aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('guide.todos_title')}</h3>
                                    <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]">
                                        {approvalQueueLoading ? '…' : `0/${todoCount}`}
                                    </span>
                                </div>
                                {approvalQueueLoading && (
                                    <p role="status" className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('guide.approvals_loading')}</p>
                                )}
                                {!approvalQueueLoading && approvalQueueUnavailable && (
                                    <p role="status" className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('guide.approvals_unavailable')}</p>
                                )}
                                {!approvalQueueLoading && !approvalQueueUnavailable && pendingApprovals.length === 0 && (
                                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('guide.todos_empty')}</p>
                                )}
                            </div>
                        </div>
                        {canApprove && pendingApprovals.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-[var(--glass-border)] pt-3">
                                {pendingApprovals.slice(0, 3).map(approval => {
                                    const status = approval.status.toUpperCase();
                                    const canAct = ['PENDING', 'AWAITING_APPROVAL'].includes(status);
                                    const title = approval.title || approval.summary || approval.leadName || approval.actionType || t('guide.approval_action');
                                    return (
                                        <article key={approval.id} className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="min-w-0 text-xs font-semibold leading-5 text-[var(--text-primary)]">{title}</p>
                                                <span className="shrink-0 rounded-full bg-[var(--sgs-champagne)]/70 px-2 py-1 text-[10px] font-semibold text-[var(--sgs-primary-deep)]">
                                                    {status === 'UNKNOWN' ? t('guide.approval_uncertain') : t('guide.approval_pending')}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!onOpenApprovals}
                                                    onClick={onOpenApprovals}
                                                    className="min-h-11 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--sgs-primary-deep)] hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:opacity-50"
                                                >
                                                    {t('guide.view_draft')}
                                                </button>
                                                {canAct && (
                                                    <button
                                                        type="button"
                                                        disabled={approvingApprovalId === approval.id}
                                                        onClick={() => void approveRequest(approval.id)}
                                                        className="min-h-11 rounded-lg bg-[var(--sgs-primary-deep)] px-3 text-xs font-semibold text-[var(--ui-text-inverse)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:cursor-wait disabled:opacity-60"
                                                    >
                                                        {approvingApprovalId === approval.id ? t('guide.approving') : t('guide.approve_send')}
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {support.length > 0 && (
                        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3.5">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                                <Clock3 size={15} aria-hidden="true" className="text-[var(--sgs-primary)]" />
                                {t('guide.support_history')}
                            </div>
                            <div className="divide-y divide-[var(--glass-border)]">
                                {support.slice(0, 3).map(item => (
                                    <div key={item.id} className="py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                                        <div className="flex flex-wrap items-center gap-x-1.5">
                                            <span className="font-semibold text-[var(--text-primary)]">{item.trackingCode}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{item.status}</span>
                                            <span className="text-[var(--text-tertiary)]">
                                                {t('guide.updated_label')}: {formatDateTime(item.updatedAt)}
                                            </span>
                                        </div>
                                        {item.latestReply && <p className="mt-1">{item.latestReply}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {messages.length === 0 && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--sgs-champagne)]/70 text-[var(--sgs-primary-deep)]">
                                    <Bot size={15} aria-hidden="true" />
                                </div>
                                <div className="max-w-[calc(100%_-_2.5rem)] rounded-2xl rounded-tl-sm border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3.5 py-3 text-sm leading-6 text-[var(--text-secondary)]">
                                    {t('guide.welcome')}
                                </div>
                            </div>
                            <div className="space-y-2 pl-9">
                                {[
                                    'guide.suggestion_dashboard',
                                    'guide.suggestion_leads',
                                    'guide.suggestion_create_lead',
                                ].map(key => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => void send(t(key))}
                                        className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs font-medium leading-5 text-[var(--text-secondary)] transition-colors hover:border-[var(--sgs-primary)]/35 hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                                    >
                                        {t(key)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {messages.map(message => message.role === 'user' ? (
                            <div key={message.id} className="flex justify-end">
                                <div className="max-w-[86%] rounded-2xl rounded-br-sm border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3.5 py-2.5 text-sm leading-6 text-[var(--text-primary)]">
                                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                                </div>
                            </div>
                        ) : (
                            <article key={message.id} className="min-w-0">
                                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium leading-4 text-[var(--text-tertiary)]">
                                    <ShieldCheck size={13} aria-hidden="true" className="shrink-0 text-[var(--sgs-primary)]" />
                                    <span>{sourceLine(message)}</span>
                                </div>
                                <div className="pl-5 text-sm leading-6 text-[var(--text-primary)]">
                                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                                    {message.approval && (
                                        <section className="mt-3 rounded-xl border border-[var(--sgs-accent)]/40 bg-[var(--sgs-champagne)]/45 p-3">
                                            <div className="flex items-start gap-2.5">
                                                <ShieldCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--sgs-primary-deep)]" />
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t('guide.approval_title')}</h4>
                                                    {message.approval.title && (
                                                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{message.approval.title}</p>
                                                    )}
                                                    {message.approval.status && (
                                                        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                                            {t('guide.approval_status')}: {message.approval.status.toUpperCase() === 'APPROVED'
                                                                ? t('guide.approval_approved')
                                                                : message.approval.status === 'UNKNOWN'
                                                                    ? t('guide.approval_uncertain')
                                                                    : message.approval.status}
                                                        </p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={!onOpenApprovals}
                                                        onClick={onOpenApprovals}
                                                        className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--sgs-primary-deep)] transition-colors hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {t('guide.view_draft')}
                                                    </button>
                                                    {canApprove
                                                        && (!message.approval.status || ['PENDING', 'AWAITING_APPROVAL'].includes(message.approval.status.toUpperCase()))
                                                        && (
                                                            <button
                                                                type="button"
                                                                disabled={approvingApprovalId === message.approval.id}
                                                                onClick={() => void approveRequest(message.approval!.id)}
                                                                className="ml-2 mt-2 inline-flex min-h-11 items-center rounded-lg bg-[var(--sgs-primary-deep)] px-3 text-xs font-semibold text-[var(--ui-text-inverse)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:cursor-wait disabled:opacity-60"
                                                            >
                                                                {approvingApprovalId === message.approval.id
                                                                    ? t('guide.approving')
                                                                    : t('guide.approve_send')}
                                                            </button>
                                                        )}
                                                </div>
                                            </div>
                                        </section>
                                    )}
                                    {message.escalationReason && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSupportDraft({ title: message.content.slice(0, 120), description: message.content });
                                                setSupportConsent(false);
                                            }}
                                            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 text-xs font-semibold text-[var(--sgs-primary-deep)] transition-colors hover:border-[var(--sgs-primary)]/40 hover:bg-[var(--sgs-champagne)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                                        >
                                            <LifeBuoy size={15} aria-hidden="true" />
                                            {t('guide.create_support')}
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>

                    {sending && (
                        <div className="flex items-center gap-2 pl-5 text-xs text-[var(--text-tertiary)]" role="status" aria-live="polite">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--sgs-accent)] motion-reduce:animate-none" />
                            {t('guide.sending')}
                        </div>
                    )}
                    {error && (
                        <div role="alert" className="rounded-xl border border-[var(--ui-danger)]/25 bg-[var(--ui-danger)]/5 px-3 py-2.5 text-xs text-[var(--ui-danger)]">
                            <p>{error}</p>
                            {failedMessage && (
                                <button
                                    type="button"
                                    onClick={() => void send(failedMessage, true)}
                                    disabled={sending}
                                    className="mt-2 min-h-11 rounded-lg px-2 text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:opacity-50"
                                >
                                    {t('guide.retry')}
                                </button>
                            )}
                        </div>
                    )}
                    {supportDraft && (
                        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3.5">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                                <LifeBuoy size={15} aria-hidden="true" className="text-[var(--sgs-primary)]" />
                                {t('guide.support_form_title')}
                            </div>
                            <label className="block">
                                <span className="sr-only">{t('guide.support_description')}</span>
                                <textarea
                                    value={supportDraft.description}
                                    onChange={event => setSupportDraft({ ...supportDraft, description: event.target.value })}
                                    maxLength={2000}
                                    rows={3}
                                    className="min-h-24 w-full resize-y rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 text-sm leading-5 text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                                    aria-label={t('guide.support_description')}
                                />
                            </label>
                            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2.5 text-xs leading-5 text-[var(--text-secondary)]">
                                <input
                                    type="checkbox"
                                    checked={supportConsent}
                                    onChange={event => setSupportConsent(event.target.checked)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--sgs-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                                />
                                <span>{t('guide.support_consent')}</span>
                            </label>
                            <div className="mt-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={!supportConsent || supportSending}
                                    onClick={() => void createSupportRequest()}
                                    className="min-h-11 rounded-xl bg-[var(--sgs-primary-deep)] px-4 text-xs font-semibold text-[var(--ui-text-inverse)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {supportSending ? t('guide.sending') : t('guide.submit_support')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSupportDraft(null); setSupportConsent(false); }}
                                    className="min-h-11 rounded-xl px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                                >
                                    {t('guide.cancel')}
                                </button>
                            </div>
                        </section>
                    )}
                    <div ref={endRef} />
                </div>

                <form
                    onSubmit={event => { event.preventDefault(); void send(); }}
                    className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-4"
                >
                    <div className="flex items-end gap-1.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-1.5 transition-colors focus-within:border-[var(--sgs-primary)]/50 focus-within:ring-2 focus-within:ring-[var(--sgs-primary)]/10">
                        <button
                            type="button"
                            disabled
                            aria-label={t('guide.attach')}
                            aria-describedby="guide-attach-help"
                            title={t('guide.attach_unavailable')}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-tertiary)] opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                        >
                            <Paperclip size={17} aria-hidden="true" />
                        </button>
                        <span id="guide-attach-help" className="sr-only">{t('guide.attach_unavailable')}</span>
                        <textarea
                            value={input}
                            onChange={event => setInput(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void send();
                                }
                            }}
                            placeholder={t('guide.placeholder')}
                            rows={1}
                            maxLength={600}
                            className="max-h-24 min-h-11 min-w-0 flex-1 resize-y bg-transparent px-1 py-3 text-base leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] sm:text-sm"
                            aria-label={t('guide.placeholder')}
                        />
                        <button
                            type="button"
                            onClick={toggleVoiceInput}
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] ${isListening ? 'bg-[var(--sgs-champagne)] text-[var(--sgs-primary-deep)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'}`}
                            aria-label={t(isListening ? 'guide.voice_stop' : 'guide.voice_start')}
                            title={t(isListening ? 'guide.voice_stop' : 'guide.voice_start')}
                            aria-pressed={isListening}
                        >
                            {isListening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
                        </button>
                        <button
                            type="submit"
                            disabled={!input.trim() || sending}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--sgs-primary-deep)] text-[var(--ui-text-inverse)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={t('guide.send')}
                        >
                            <Send size={17} aria-hidden="true" />
                        </button>
                    </div>
                    {voiceNotice && (
                        <p className="px-2 pt-1.5 text-[11px] text-[var(--text-tertiary)]" role="status" aria-live="polite">
                            {voiceNotice}
                        </p>
                    )}
                </form>
            </section>
        </>
    );
};