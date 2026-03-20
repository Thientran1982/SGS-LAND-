
import React, { memo, useState, useMemo, useRef } from 'react';
import { Interaction, AgentArtifact, GroundingMetadata, AgentTraceStep, BookingDraftData, LoanScheduleData, Channel, Direction } from '../types';
import Markdown from 'react-markdown';
import { useTranslation } from '../services/i18n';

// Icons
const CHAT_ICONS = {
    LOAN: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.659c0 3.074-1.8 5.529-4.29 6.226 1.01.83 1.87 1.96 2.42 3.26M9 15.409C10.45 14.83 11.4 13.513 11.4 12c0-1.572-1.201-2.849-2.73-2.951"/></svg>,
    CALENDAR: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    LOCATION: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    PLAY: <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>,
    PAUSE: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>,
    FILE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    DOWNLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    SOURCE: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    LINK: <svg className="w-2.5 h-2.5 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    AGENT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    // HUMAN AGENT ICON (Tie/Professional)
    SUPERVISOR: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, 
    // CUSTOMER ICON (User)
    CUSTOMER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    CPU: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    AI_SPARK: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>,
    CHECK_SMALL: <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
};

// Components

export const ThinkingProcess = memo(({ steps, t }: { steps?: AgentTraceStep[], t: any }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!steps || steps.length === 0) return null;

    return (
        <div className="mb-3 w-full max-w-full flex justify-end">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs2 font-bold text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 transition-colors uppercase tracking-wider px-3 py-1.5 rounded-lg border border-indigo-100 group w-fit max-w-full"
            >
                <div className={`w-2 h-2 rounded-full shadow-sm transition-all duration-500 shrink-0 ${isExpanded ? 'bg-indigo-500' : 'bg-indigo-400 animate-pulse'}`}></div>
                <span className="flex-1 text-left flex items-center gap-1 truncate">
                    <span className="shrink-0">{CHAT_ICONS.CPU}</span>
                    <span className="truncate">{t('inbox.thinking_process')} ({steps.length})</span>
                </span>
                <svg className={`w-3 h-3 transition-transform duration-300 text-indigo-400 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {isExpanded && (
                <div className="mt-2 pl-2 space-y-2 animate-enter py-1 w-full">
                    {steps.map((step, idx) => {
                        const isRouter = step.node === 'ROUTER';
                        return (
                            <div key={idx} className="relative group pl-3 border-l border-indigo-100 w-full">
                                <div className="flex items-start gap-2 w-full">
                                    <div className={`mt-0.5 w-3 h-3 rounded-full flex items-center justify-center shrink-0 border ${isRouter ? 'bg-[var(--glass-surface-hover)] border-[var(--glass-border)] text-[var(--text-tertiary)]' : 'bg-[var(--bg-surface)] border-indigo-200 text-indigo-600'}`}>
                                        {step.status === 'DONE' ? CHAT_ICONS.CHECK_SMALL : <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <span className={`text-xs2 font-bold uppercase tracking-tight ${isRouter ? 'text-[var(--text-tertiary)]' : 'text-indigo-600'}`}>
                                                {step.node.replace('_AGENT', '')}
                                            </span>
                                            <span className="text-2xs font-mono text-[var(--text-secondary)]">
                                                {new Date(step.timestamp).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})}
                                            </span>
                                        </div>
                                        {step.output && (
                                            <div className="text-xs2 text-[var(--text-tertiary)] font-mono leading-relaxed bg-[var(--glass-surface)]/50 p-2 rounded border border-[var(--glass-border)] break-words whitespace-pre-wrap overflow-x-auto no-scrollbar">
                                                {typeof step.output === 'object' ? JSON.stringify(step.output) : String(step.output)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

export const LoanScheduleWidget = memo(({ data, t, formatCurrency }: { data: LoanScheduleData, t: any, formatCurrency: any }) => (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm my-2 max-w-sm w-full">
        <div className="bg-[var(--glass-surface)] px-4 py-3 border-b border-[var(--glass-border)] flex justify-between items-center gap-2">
            <h4 className="font-bold text-[var(--text-secondary)] text-xs flex items-center gap-2 min-w-0 flex-1">
                <span className="shrink-0">{CHAT_ICONS.LOAN}</span>
                <span className="truncate">{t('inbox.loan_title')}</span>
            </h4>
            <span className="text-xs2 font-bold text-[var(--text-tertiary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--glass-border)] shrink-0">
                {t('inbox.loan_rate', { rate: data.input.rate })}
            </span>
        </div>
        <div className="p-4">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <div className="text-xs2 text-[var(--text-secondary)] uppercase font-bold">{t('inbox.loan_monthly')}</div>
                    <div className="text-xl font-extrabold text-indigo-600">{formatCurrency(data.monthlyPayment)}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs2 text-[var(--text-secondary)] uppercase font-bold">{t('inbox.loan_total_interest')}</div>
                    <div className="text-sm font-bold text-[var(--text-secondary)]">{formatCurrency(data.totalInterest)}</div>
                </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden text-xs2 overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[250px]">
                    <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] font-bold">
                        <tr>
                            <th className="px-2 py-1.5">{t('inbox.loan_col_month')}</th>
                            <th className="px-2 py-1.5 text-right">{t('inbox.loan_col_principal')}</th>
                            <th className="px-2 py-1.5 text-right">{t('inbox.loan_col_interest')}</th>
                            <th className="px-2 py-1.5 text-right">{t('inbox.loan_col_balance')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {data.schedule.slice(0, 3).map((row) => (
                            <tr key={row.month}>
                                <td className="px-2 py-1.5 font-bold text-[var(--text-secondary)]">{row.month}</td>
                                <td className="px-2 py-1.5 text-right text-[var(--text-tertiary)]">{formatCurrency(row.principal)}</td>
                                <td className="px-2 py-1.5 text-right text-[var(--text-tertiary)]">{formatCurrency(row.interest)}</td>
                                <td className="px-2 py-1.5 text-right text-[var(--text-tertiary)]">{formatCurrency(row.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="bg-[var(--glass-surface)] px-2 py-1.5 text-center text-[var(--text-secondary)] italic border-t border-[var(--glass-border)]">
                    ... ({data.input.months} {t('inbox.months')})
                </div>
            </div>
        </div>
    </div>
));

export const BookingWidget = memo(({ data, t, formatDateTime }: { data: BookingDraftData, t: any, formatDateTime: any }) => (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm my-2 max-w-sm w-full">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2 min-w-0">
            <div className="text-indigo-600 shrink-0">{CHAT_ICONS.CALENDAR}</div>
            <h4 className="font-bold text-indigo-900 text-xs truncate">{t('inbox.booking_title')}</h4>
        </div>
        <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="text-[var(--text-secondary)] mt-0.5">{CHAT_ICONS.CALENDAR}</div>
                <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{formatDateTime(data.time)}</div>
                    <div className="text-xs2 text-[var(--text-tertiary)] uppercase font-bold tracking-wide">{t('inbox.time')}</div>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <div className="text-[var(--text-secondary)] mt-0.5">{CHAT_ICONS.LOCATION}</div>
                <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{data.location}</div>
                    <div className="text-xs2 text-[var(--text-tertiary)] uppercase font-bold tracking-wide">{t('inbox.location')}</div>
                </div>
            </div>
            <button type="button" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-colors shadow-sm">
                {t('inbox.booking_confirm')}
            </button>
        </div>
    </div>
));

export const GroundingPill = memo(({ sources, t }: { sources: GroundingMetadata, t: any }) => {
    if (!sources.groundingChunks || sources.groundingChunks.length === 0) return null;

    return (
        <div className="mt-2 flex flex-wrap gap-2 justify-end max-w-full">
            <div className="flex items-center gap-1.5 text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-wider shrink-0">
                {CHAT_ICONS.SOURCE} {t('inbox.grounding_sources')}
            </div>
            {sources.groundingChunks.map((chunk, i) => {
                const url = chunk.web?.uri || chunk.maps?.uri;
                const title = chunk.web?.title || chunk.maps?.title || 'Source';
                if (!url) return null;
                return (
                    <a 
                        key={i} 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 bg-[var(--glass-surface)] hover:bg-[var(--bg-surface)] border border-[var(--glass-border)] hover:border-indigo-300 rounded-full px-2.5 py-1 text-xs2 text-[var(--text-secondary)] transition-all max-w-full truncate group"
                    >
                        <span className="shrink-0">{CHAT_ICONS.LINK}</span>
                        <span className="truncate group-hover:text-indigo-600">{title}</span>
                    </a>
                );
            })}
        </div>
    );
});

export const AudioBubble = memo(({ duration }: { duration: number }) => {
    const { t } = useTranslation();
    const bars = useMemo(() => Array.from({ length: 12 }, () => Math.random() * 16 + 4), []);
    return (
        <div className="flex items-center gap-2 md:gap-3 min-w-[120px] w-full">
            <button aria-label={t('inbox.play_audio')} className="w-8 h-8 rounded-full bg-[var(--glass-surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-indigo-100 hover:text-indigo-600 transition-colors shrink-0">
                {CHAT_ICONS.PLAY}
            </button>
            <div className="flex-1 h-8 flex items-center gap-0.5 opacity-50 overflow-hidden">
                {bars.map((h, i) => (
                    <div key={i} className="w-1 bg-current rounded-full shrink-0" style={{ height: `${h}px` }}></div>
                ))}
            </div>
            <span className="text-xs2 font-mono opacity-70 shrink-0">
                {duration > 0 ? `0:${String(duration).padStart(2, '0')}` : '0:15'}
            </span>
        </div>
    );
});

export const FileBubble = memo(({ name, size, url }: { name: string, size?: number, url?: string }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2 md:gap-3 p-1 w-full">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                {CHAT_ICONS.FILE}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{name}</div>
                <div className="text-xs2 opacity-70">{size ? `${(size / 1024).toFixed(1)} KB` : 'Unknown size'}</div>
            </div>
            {url && (
                <a href={url} download={name} aria-label={t('inbox.download_file')} className="p-1.5 md:p-2 hover:bg-black/5 rounded-full transition-colors ml-1 md:ml-2 shrink-0">
                    {CHAT_ICONS.DOWNLOAD}
                </a>
            )}
        </div>
    );
});

export const MessageBubble = memo(({ msg, t, formatTime, formatCurrency, formatDate, formatDateTime, showDate }: any) => {
    // DIRECTION LOGIC:
    // OUTBOUND = Agent/System/AI -> RIGHT Side
    // INBOUND = Customer -> LEFT Side
    const isOutbound = msg.direction === Direction.OUTBOUND;
    const isAgent = msg.metadata?.isAgent; // True if generated by AI
    const artifact = msg.metadata?.artifact as AgentArtifact | undefined;
    const trace = msg.metadata?.trace as AgentTraceStep[] | undefined;
    const grounding = msg.metadata?.groundingMetadata as GroundingMetadata | undefined;

    return (
        <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} animate-enter`}>
            {showDate && (
                <div className="w-full text-center my-4">
                    <span className="text-xs2 font-bold text-[var(--text-secondary)] bg-[var(--glass-surface)] px-3 py-1 rounded-full border border-[var(--glass-border)]">
                        {formatDate(msg.timestamp)}
                    </span>
                </div>
            )}
            
            <div className={`flex gap-2 max-w-[85%] md:max-w-[75%] ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar Column */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border overflow-hidden
                    ${isOutbound 
                        ? (isAgent ? 'bg-gradient-to-br from-indigo-500 to-purple-500 border-transparent text-white' : 'bg-slate-900 border-slate-800 text-white') 
                        : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                    }`}
                >
                    {isOutbound ? (
                        isAgent ? CHAT_ICONS.AGENT : CHAT_ICONS.SUPERVISOR
                    ) : (
                        CHAT_ICONS.CUSTOMER
                    )}
                </div>

                <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                    {/* Trace Visualization (Only for AI Messages) */}
                    {isAgent && trace && <ThinkingProcess steps={trace} t={t} />}

                    <div className={`
                        relative px-4 py-3 rounded-2xl text-sm shadow-sm border w-fit max-w-full
                        ${isOutbound 
                            ? 'bg-indigo-600 text-white border-indigo-600 rounded-tr-none' 
                            : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--glass-border)] rounded-tl-none'
                        }
                    `}>
                        {/* Content */}
                        {msg.type === 'AUDIO' ? (
                            <AudioBubble duration={msg.metadata?.duration || 0} />
                        ) : msg.type === 'FILE' ? (
                            <FileBubble name={msg.metadata?.fileName || 'File'} size={msg.metadata?.fileSize} url={msg.content} />
                        ) : msg.type === 'IMAGE' ? (
                            <div className="max-w-xs md:max-w-sm rounded-lg overflow-hidden border border-current/10">
                                <img src={msg.content} alt={msg.metadata?.fileName || 'Attached Image'} className="w-full h-auto object-cover" loading="lazy" />
                            </div>
                        ) : (
                            <div className="markdown-body text-sm leading-relaxed break-words">
                                <Markdown>{msg.content}</Markdown>
                            </div>
                        )}

                        {/* Artifact Rendering (Usually only for AI/Outbound) */}
                        {artifact && (
                            <div className="mt-3 pt-3 border-t border-dashed border-current/20 max-w-full overflow-hidden">
                                {artifact.type === 'LOAN_SCHEDULE' && <LoanScheduleWidget data={artifact.data} t={t} formatCurrency={formatCurrency} />}
                                {artifact.type === 'BOOKING_DRAFT' && <BookingWidget data={artifact.data} t={t} formatDateTime={formatDateTime} />}
                            </div>
                        )}
                    </div>

                    {/* Metadata & Grounding */}
                    <div className="mt-1 flex flex-col gap-1 w-full">
                        <div className={`flex items-center gap-2 text-xs2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[var(--text-secondary)] font-mono">{formatTime(msg.timestamp)}</span>
                            {isOutbound && (
                                <span className={`font-bold ${msg.status === 'READ' ? 'text-indigo-500' : 'text-[var(--text-secondary)]'}`}>
                                    {msg.status === 'PENDING' ? t('inbox.status_sending') : msg.status === 'READ' ? t('inbox.status_read') : t('inbox.status_received')}
                                </span>
                            )}
                        </div>
                        
                        {/* Grounding Sources (Usually AI) */}
                        {grounding && <GroundingPill sources={grounding} t={t} />}
                    </div>
                </div>
            </div>
        </div>
    );
});

MessageBubble.displayName = 'MessageBubble';
