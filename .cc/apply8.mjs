// Inbox redesign: thread list, conversation panel, customer context, live-chat embed modal.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
function patch(file, steps) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const next = fn(src);
    if (next === null || next === src) { report.push(`FAIL ${file}: ${name}`); return; }
    src = next;
  }
  if (!DRY) fs.writeFileSync(file, src);
  report.push(`OK   ${file} (${steps.length} steps)`);
}
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, () => b) : null);
const all = (a, b) => (s) => (s.includes(a) ? s.split(a).join(b) : null);
// Replace [start, end) where end is the first occurrence of endMarker after start.
const span = (start, endMarker, repl) => (s) => {
  const i = s.indexOf(start); if (i < 0) return null;
  const j = s.indexOf(endMarker, i + start.length); if (j < 0) return null;
  return s.slice(0, i) + repl + s.slice(j);
};

// ------------------------------------------------------------------ Inbox.tsx
const SIDEBAR_HEADER = `<div className="px-3 sm:px-4 pt-3 pb-2.5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] z-10 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        <div role="tablist" aria-label={t('inbox.filter_status')} className="flex flex-1 min-w-0 p-0.5 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                            {(['ALL', 'UNREAD'] as const).map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    role="tab"
                                    aria-selected={statusFilter === v}
                                    onClick={() => setStatusFilter(v)}
                                    className={\`flex-1 min-h-[36px] px-2 rounded-[10px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors \${statusFilter === v ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}\`}
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
                                className={\`shrink-0 min-h-[32px] px-3 rounded-full text-xs font-medium border transition-colors \${channelFilter === v ? 'bg-[var(--sgs-primary)] border-[var(--sgs-primary)] text-white' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)]'}\`}
                            >
                                {v === 'ALL' ? t('inbox.filter_all') : channelLabel(v)}
                            </button>
                        ))}
                    </div>
                </div>
`;

const THREAD_AVATAR = `
                                    <div className="relative shrink-0 mt-0.5">
                                        <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold \${thread.unreadCount > 0 ? 'bg-[var(--sgs-primary)] text-white' : 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]'}\`}>
                                            {(thread.lead.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span
                                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center"
                                            title={isAiEnabled ? t('inbox.ai_agent_active') : t('inbox.human_control')}
                                        >
                                            <span className={\`w-2.5 h-2.5 rounded-full \${isAiEnabled ? 'bg-sgs-verified' : 'bg-[var(--text-tertiary)]'}\`} />
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">`;

const EMPTY_PANE = `<div className="hidden md:flex flex-1 items-center justify-center text-[var(--text-secondary)] bg-[var(--glass-surface)]">
                    <div className="text-center p-8 max-w-xs">
                        <div className="w-16 h-16 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-[var(--glass-border)] text-[var(--sgs-primary)]">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 6l2.6-2.6A2 2 0 018 17h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" /></svg>
                        </div>
                        <h3 className="font-semibold text-[var(--text-primary)] mb-1">{t('inbox.supervisor_cockpit')}</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">{t('inbox.select')}</p>
                    </div>
                </div>
            )}
            `;

const CONTEXT_ASIDE = `
                {/* Customer context (xl+) */}
                <aside className="hidden xl:flex w-[300px] shrink-0 flex-col border-l border-[var(--glass-border)] bg-[var(--bg-surface)] overflow-y-auto no-scrollbar" aria-label={t('inbox.context_title')}>
                    <div className="p-5 flex flex-col items-center text-center border-b border-[var(--glass-border)]">
                        <div className="w-14 h-14 rounded-full bg-[var(--sgs-primary)] text-white flex items-center justify-center text-lg font-bold">
                            {(selectedThread.lead.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="mt-3 font-semibold text-[var(--text-primary)] truncate max-w-full">{selectedThread.lead.name}</div>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                            {selectedThread.lastChannel && selectedThread.lastChannel !== 'INTERNAL' && (
                                <span className="ui-badge-info">{channelLabel(selectedThread.lastChannel)}</span>
                            )}
                            <span className={isAiActiveForSelected ? 'ui-badge-success' : 'ui-badge-warning'}>
                                {isAiActiveForSelected ? t('inbox.auto_pilot') : t('inbox.manual')}
                            </span>
                        </div>
                        {selectedThread.lead.phone && (
                            <a href={\`tel:\${selectedThread.lead.phone}\`} className="mt-4 w-full min-h-[40px] rounded-xl bg-[var(--sgs-primary)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
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
                                [t('leads.stage'), selectedThread.lead.stage ? t(\`stage.\${selectedThread.lead.stage}\`) : ''],
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
                                {selectedThread.lead.tags.slice(0, 8).map(tag => (
                                    <span key={tag} className="ui-badge-neutral">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </>`;

const COMPOSER_TOP = `{!isAiActiveForSelected && (
                            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-sgs-accent-text">
                                {ICONS.ALERT}
                                <span className="truncate">{t('inbox.supervisor_takeover_active')}</span>
                            </div>
                        )}
`;

const I = (n) => ' '.repeat(n);
const COPY_ICON = `<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
const MODAL_BODY = `<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
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
                                                        className={\`min-h-[36px] px-3.5 text-xs font-semibold rounded-full transition-colors border \${active ? 'bg-[var(--sgs-primary)] text-white border-[var(--sgs-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--sgs-primary)] hover:text-[var(--text-primary)]'}\`}
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
                                                    className={\`flex-1 min-h-[36px] px-2 rounded-[10px] text-xs font-semibold transition-colors \${widgetTab === key ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}\`}
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
                                                            ${COPY_ICON}
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
                                                        <span className="ui-badge-success shrink-0">{t('inbox.widget_short_valid')}</span>
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
                                                        ${COPY_ICON}
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
                                                    <img src={\`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=\${encodeURIComponent(buildLiveChatUrl(qrChannel))}\`} alt={t('inbox.widget_qr_label')} className="w-32 h-32" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                </div>
                                                <div className="text-center sm:text-left min-w-0">
                                                    <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-1">{t('inbox.widget_qr_title')}</h4>
                                                    <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{t('inbox.widget_qr_desc')}</p>
                                                    <a
                                                        href={\`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=\${encodeURIComponent(buildLiveChatUrl(qrChannel))}\`}
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
                        `;

patch('pages/Inbox.tsx', [
  ['widget tab state', lit(
    "const [embedChannel, setEmbedChannel] = useState<'EMBED' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK'>('EMBED');",
    "const [embedChannel, setEmbedChannel] = useState<'EMBED' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK'>('EMBED');\n    const [widgetTab, setWidgetTab] = useState<'EMBED' | 'LINK' | 'QR'>('EMBED');")],
  ['derived values before render', lit(
    "    }, [messages, isAiActiveForSelected]);\n    return (\n",
    `    }, [messages, isAiActiveForSelected]);
    const inboxUnreadTotal = threads.reduce((sum, th) => sum + (th.unreadCount || 0), 0);
    const canDeleteThreads = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(currentUser?.role ?? '');
    // One traffic-source selector drives the link, embed and QR variants.
    const selectWidgetSource = (src: 'DEFAULT' | 'ZALO' | 'FACEBOOK' | 'SMS' | 'TIKTOK') => {
        setLinkChannel(src === 'DEFAULT' ? 'LINK' : src);
        setEmbedChannel(src === 'DEFAULT' ? 'EMBED' : src);
        setQrChannel(src === 'DEFAULT' ? 'QR' : src);
    };
    const widgetEmbedCode = \`<script>\\n  window.SGSLAND_CHAT_URL = "\${buildLiveChatUrl(embedChannel)}";\\n</script>\\n<script src="\${window.location.origin}/widget.js" async></script>\`;
    return (
`)],
  ['page frame', lit('<div className="h-full sm:p-4 md:p-6">\n        <div className="flex h-full bg-[var(--bg-surface)] sm:rounded-[24px] sm:border',
    '<div className="h-full sm:p-3 lg:p-4">\n        <div className="flex h-full bg-[var(--bg-surface)] sm:rounded-2xl sm:border')],
  ['sidebar width', lit("<div className={`w-full md:w-80 lg:w-96 border-r border-[var(--glass-border)] flex flex-col ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>",
    "<div className={`w-full md:w-80 lg:w-[340px] shrink-0 border-r border-[var(--glass-border)] flex flex-col bg-[var(--bg-surface)] ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>")],
  ['sidebar header', span('<div className="px-4 sm:px-5 pt-4 pb-2.5 border-b border-[var(--glass-border)]',
    '                <div className="flex-1 overflow-y-auto no-scrollbar">\n                    {loadingThreads', SIDEBAR_HEADER)],
  ['thread row class', lit("className={`p-4 border-b border-slate-50 hover:bg-[var(--glass-surface)] cursor-pointer transition-colors group relative ${selectedLeadId === thread.lead.id ? 'bg-[var(--sgs-primary)]/10' : ''}`}\n                                >",
    "className={`flex gap-3 px-3 sm:px-4 py-3 border-b border-[var(--glass-border)] hover:bg-[var(--glass-surface)] cursor-pointer transition-colors group relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full ${selectedLeadId === thread.lead.id ? 'bg-[var(--sgs-primary)]/5 before:bg-[var(--sgs-accent)]' : 'before:bg-transparent'}`}\n                                >" + THREAD_AVATAR)],
  ['remove name dot', span('{/* AI Status Indicator */}', '                                        </div>\n                                        {thread.lastMessage && <div', '')],
  ['name weight', lit('<div className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1">\n                                            <span className="truncate">{thread.lead.name}</span>',
    "<div className={`text-sm text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1 ${thread.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>\n                                            <span className=\"truncate\">{thread.lead.name}</span>")],
  ['time hides for delete', lit('<div className="text-xs2 text-[var(--text-secondary)] whitespace-nowrap shrink-0 mt-0.5">{formatTime(thread.lastMessage.timestamp)}</div>',
    "<div className={`text-xs2 whitespace-nowrap shrink-0 mt-0.5 transition-opacity ${thread.unreadCount > 0 ? 'text-[var(--sgs-primary)] font-semibold' : 'text-[var(--text-tertiary)]'} ${canDeleteThreads ? 'group-hover:opacity-0' : ''}`}>{formatTime(thread.lastMessage.timestamp)}</div>")],
  ['unread badge', lit('<div className="bg-rose-500 text-white text-xs2 font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">{thread.unreadCount}</div>',
    '<div className="bg-[var(--sgs-primary)] text-white text-xs2 font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{thread.unreadCount > 99 ? \'99+\' : thread.unreadCount}</div>')],
  ['close content column', lit('{/* Hover Delete Button */}', '</div>\n                                    {/* Hover Delete Button */}')],
  ['delete button pos', lit('className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-surface)] shadow-sm',
    'className="absolute right-2 top-2 p-1.5 bg-[var(--bg-surface)] shadow-sm')],
  ['fragment open', lit("{selectedThread ? (\n                <div className={`flex-1 flex flex-col bg-[var(--bg-surface)] h-full relative min-w-0 ${selectedLeadId ? 'flex' : 'hidden md:flex'}`}>",
    "{selectedThread ? (<>\n                <div className={`flex-1 flex flex-col bg-[var(--bg-surface)] h-full relative min-w-0 ${selectedLeadId ? 'flex' : 'hidden md:flex'}`}>")],
  ['aside + fragment close', lit('                </div>\n            ) : (\n                <div className="hidden md:flex flex-1 items-center',
    '                </div>' + CONTEXT_ASIDE + '\n            ) : (\n                <div className="hidden md:flex flex-1 items-center')],
  ['empty pane', span('<div className="hidden md:flex flex-1 items-center justify-center text-[var(--text-secondary)] bg-[var(--glass-surface)]/50">',
    '{/* Confirm Delete Modal */}', EMPTY_PANE)],
  ['header padding', lit('<div className="px-4 py-2.5 md:px-5 md:py-3 border-b border-[var(--glass-border)] flex justify-between items-center bg-transparent z-20 gap-2">',
    '<div className="px-3 py-2 md:px-5 md:py-2.5 min-h-[60px] border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-surface)] z-20 gap-2">')],
  ['header avatar', lit('<div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-[var(--sgs-primary)]/10 to-[var(--sgs-primary)] flex items-center justify-center font-bold text-sgs-primary border border-sgs-border shrink-0 text-sm">',
    '<div className="w-9 h-9 rounded-full bg-[var(--sgs-primary)] text-white flex items-center justify-center font-bold shrink-0 text-sm xl:hidden">')],
  ['score badge', span('<span className="text-2xs px-1.5 py-0.5 rounded-md uppercase font-bold border', '\n                                </div>\n                                <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">',
    "{(selectedThread.lead.score?.score || 0) > 0 && (\n                                        <span className=\"ui-badge-info shrink-0 hidden sm:inline-flex\">{t('inbox.score_points', { n: selectedThread.lead.score?.score })}</span>\n                                    )}")],
  ['status dot color', lit("${isAiActiveForSelected ? 'bg-[var(--sgs-primary)] animate-pulse' : 'bg-[var(--text-tertiary)]'}", "${isAiActiveForSelected ? 'bg-sgs-verified' : 'bg-[var(--sgs-accent)]'}")],
  ['assign btn height', lit('rounded-lg px-2 py-1.5 min-h-[36px] hover:bg-[var(--glass-surface-hover)] transition-colors"\n                                        title={t(\'inbox.assign_to\')}',
    'rounded-lg px-2.5 py-1.5 min-h-[40px] min-w-[40px] justify-center hover:bg-[var(--glass-surface-hover)] transition-colors"\n                                        title={t(\'inbox.assign_to\')}')],
  ['ai toggle height', lit('className={`flex items-center gap-1.5 px-2 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition-all ${',
    'aria-pressed={isAiActiveForSelected}\n                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[40px] min-w-[40px] rounded-lg text-xs font-bold border transition-all ${')],
  ['delete btn size', lit('className="p-1.5 min-h-[36px] min-w-[36px] text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg',
    'className="p-1.5 min-h-[40px] min-w-[40px] text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg')],
  // CSAT strip: compact + i18n
  ['csat pad', lit('<div className="border-b border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 py-3 sm:px-5">', '<div className="border-b border-[var(--glass-border)] bg-[var(--glass-surface)]/60 px-3 py-2 sm:px-5">')],
  ['csat title', lit('<div className="text-xs font-bold text-[var(--text-primary)]">Đánh giá CSAT</div>', "<div className=\"text-xs font-semibold text-[var(--text-primary)]\">{t('inbox.csat_title')}</div>")],
  ['csat hint', lit("Chỉ gửi sau khi kết thúc trao đổi · kênh {csatChannel === 'WEB_CHAT' ? 'WEB' : csatChannel}", "{t('inbox.csat_hint', { channel: csatChannel === 'WEB_CHAT' ? 'Web' : channelLabel(csatChannel) })}")],
  ['csat btn', lit("{hasCsatRequest ? 'Đã gửi lời mời' : csatSubmitting ? 'Đang gửi…' : 'Gửi lời mời đánh giá'}", "{hasCsatRequest ? t('inbox.csat_sent') : csatSubmitting ? t('inbox.status_sending') : t('inbox.csat_send')}")],
  ['csat btn size', lit('className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--sgs-primary)]', 'className="min-h-[36px] rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--sgs-primary)]')],
  ['csat score label', lit('<span className="text-[11px] text-[var(--text-secondary)]">Điểm khách cung cấp:</span>', "<span className=\"text-[11px] text-[var(--text-secondary)]\">{t('inbox.csat_score_label')}</span>")],
  ['csat reason', lit('Lý do chưa hài lòng (không bắt buộc)', "{t('inbox.csat_reason_label')}")],
  ['csat reason ph', lit('placeholder="Điều gì khiến trải nghiệm chưa tốt?"\n                                                aria-label="Lý do CSAT thấp"', "placeholder={t('inbox.csat_reason_placeholder')}\n                                                aria-label={t('inbox.csat_reason_label')}")],
  ['csat consent', lit('Khách đã đồng ý ghi nhận đánh giá này', "{t('inbox.csat_consent')}")],
  ['csat record', lit('                                        Ghi nhận CSAT\n', "                                        {t('inbox.csat_record')}\n")],
  ['csat recorded', lit('Đã ghi nhận CSAT {csatRecordedScore}/5 cho hội thoại này.', "{t('inbox.csat_recorded', { score: csatRecordedScore })}")],
  // Composer
  ['composer top row', span('          {/* The tag an kenh da an', '                        {/* Text input row */}', '                        ' + COMPOSER_TOP)],
  ['composer box', lit('<div className="flex items-center gap-1.5 bg-[var(--bg-surface)] p-1 pl-2.5 rounded-xl border border-[var(--glass-border)] focus-within:border-[var(--sgs-primary)] focus-within:ring-4 focus-within:ring-[var(--sgs-primary)]/50 transition-all shadow-sm">',
    '<div className="flex items-end gap-1 bg-[var(--bg-surface)] p-1.5 rounded-2xl border border-[var(--glass-border)] focus-within:border-[var(--sgs-primary)] focus-within:ring-2 focus-within:ring-[var(--sgs-primary)]/20 transition-all shadow-sm">')],
  ['composer bottom pad', lit('<div className="px-4 pt-2.5 sm:px-5 sm:pt-3 pb-safe bg-transparent border-t border-[var(--glass-border)] z-30">',
    '<div className="px-3 pt-2.5 sm:px-5 sm:pt-3 pb-3 sm:pb-4 pb-safe bg-[var(--bg-surface)] border-t border-[var(--glass-border)] z-30">')],
  ['attach size', all('className="p-1.5 min-h-[36px] min-w-[36px] text-[var(--text-tertiary)] hover:text-[var(--sgs-primary)] transition-colors rounded-lg',
    'className="p-1.5 min-h-[40px] min-w-[40px] text-[var(--text-tertiary)] hover:text-[var(--sgs-primary)] transition-colors rounded-lg')],
  ['zalo share i18n', lit('aria-label="Gửi đầy đủ sản phẩm qua Zalo"\n                                    title="Gửi đầy đủ thông tin và hình ảnh sản phẩm qua Zalo"',
    "aria-label={t('inbox.share_product_zalo')}\n                                    title={t('inbox.share_product_zalo_hint')}")],
  ['textarea', lit('className="flex-1 min-w-0 bg-transparent border-none text-[16px] md:text-sm outline-none max-h-32 min-h-[36px] py-1.5 resize-none',
    'className="flex-1 min-w-0 bg-transparent border-none text-[16px] md:text-sm outline-none max-h-32 min-h-[40px] py-2 px-1 resize-none')],
  ['send btn', lit('className="p-2 bg-sgs-primary text-white rounded-lg shadow-sm hover:shadow-md hover:bg-sgs-primary transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 shrink-0 self-end mb-0.5',
    'className="w-10 h-10 flex items-center justify-center bg-sgs-primary text-white rounded-xl shadow-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 shrink-0')],
  ['messages area', lit('<div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 bg-[var(--glass-surface)] space-y-3 sm:space-y-4 no-scrollbar scroll-smooth">',
    '<div className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 bg-[var(--glass-surface)] space-y-3 no-scrollbar scroll-smooth">')],
  ['empty messages emoji', lit('<div className="text-4xl mb-2">💬</div>', '<svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h8M8 14h5m-9 6l2.6-2.6A2 2 0 018 17h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" /></svg>')],
  // Modal
  ['modal width', lit('className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col my-auto shrink-0 overflow-hidden"',
    'className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col my-auto shrink-0 overflow-hidden max-h-[calc(100dvh-2rem)]"')],
  ['modal header', lit('<div className="p-4 md:p-6 border-b border-[var(--glass-border)] flex justify-between items-start md:items-center bg-[var(--glass-surface)]/50 shrink-0">',
    '<div className="px-4 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] flex justify-between items-start md:items-center gap-3 bg-[var(--bg-surface)] shrink-0">')],
  ['modal body', span('<div className="p-4 md:p-6 overflow-y-auto no-scrollbar">', '</motion.div>', MODAL_BODY)],
]);

// ------------------------------------------------------------------ ChatUI.tsx
patch('components/ChatUI.tsx', [
  ['feedback hook', lit("const AiFeedbackButtons = memo(({ msg, onFeedback }: { msg: any; onFeedback?: (rating: -1 | 1, correction?: string) => Promise<boolean> }) => {\n",
    "const AiFeedbackButtons = memo(({ msg, onFeedback }: { msg: any; onFeedback?: (rating: -1 | 1, correction?: string) => Promise<boolean> }) => {\n    const { t } = useTranslation();\n")],
  ['feedback done', lit("{feedbackState === 1 ? '✓ Hữu ích' : '✓ Đã ghi nhận'}", "{feedbackState === 1 ? t('inbox.feedback_helpful_done') : t('inbox.feedback_recorded')}")],
  ['up aria', lit('aria-label="Đánh giá câu trả lời hữu ích"', "aria-label={t('inbox.feedback_up')}")],
  ['up title', lit('title="Phản hồi tốt"', "title={t('inbox.feedback_up')}")],
  ['down aria', lit('aria-label="Đánh giá câu trả lời cần cải thiện"', "aria-label={t('inbox.feedback_down')}")],
  ['down title', lit('title="Cần cải thiện"', "title={t('inbox.feedback_down')}")],
  // Buttons render below the bubble on a light surface: white/60 was invisible.
  ['up color', lit('className="p-1 rounded-md hover:bg-sgs-verified/20 text-white/60 hover:text-sgs-verified transition-colors"', 'className="p-1.5 rounded-md hover:bg-sgs-verified/15 text-[var(--text-tertiary)] hover:text-sgs-verified transition-colors"')],
  ['down color', lit('className="p-1 rounded-md hover:bg-sgs-accent/20 text-white/60 hover:text-sgs-accent-text transition-colors"', 'className="p-1.5 rounded-md hover:bg-sgs-accent/15 text-[var(--text-tertiary)] hover:text-sgs-accent-text transition-colors"')],
  ['correction box', lit('placeholder="Câu trả lời đúng nên là gì? (tùy chọn)"\n                        className="w-full text-xs bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/50 resize-none"',
    "placeholder={t('inbox.feedback_correction_placeholder')}\n                        className=\"w-full text-xs bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--sgs-primary)] resize-none\"")],
  ['correction cancel', lit('className="text-xs2 px-2 py-1 text-white/50 hover:text-white/80 transition-colors"\n                        >\n                            Hủy',
    "className=\"text-xs2 px-2.5 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors\"\n                        >\n                            {t('common.cancel')}")],
  ['correction send', lit('className="text-xs2 px-2.5 py-1 bg-sgs-accent/30 hover:bg-sgs-accent/50 text-amber-200 rounded-md font-medium transition-colors"\n                        >\n                            Gửi góp ý',
    "className=\"text-xs2 px-2.5 py-1.5 bg-[var(--sgs-primary)] hover:opacity-90 text-white rounded-md font-medium transition-opacity\"\n                        >\n                            {t('inbox.feedback_send')}")],
  ['unknown size', lit("'Unknown size'", "t('inbox.file_size_unknown')")],
  // Date divider: hairline with centred label
  ['date divider', lit('<div className="w-full text-center my-4">\n                    <span className="text-xs2 font-bold text-[var(--text-secondary)] bg-[var(--glass-surface)] px-3 py-1 rounded-full border border-[var(--glass-border)]">',
    '<div className="w-full flex items-center gap-3 my-3" role="separator">\n                    <span className="h-px flex-1 bg-[var(--glass-border)]" />\n                    <span className="text-xs2 font-semibold text-[var(--text-tertiary)] bg-[var(--bg-surface)] px-2.5 py-0.5 rounded-full border border-[var(--glass-border)]">')],
  ['date divider close', lit("{formatDate(msg.timestamp)}\n                    </span>\n", "{formatDate(msg.timestamp)}\n                    </span>\n                    <span className=\"h-px flex-1 bg-[var(--glass-border)]\" />\n")],
  ['row align', lit("<div className={`flex gap-2 max-w-[82%] md:max-w-[74%] ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>",
    "<div className={`flex items-end gap-2 max-w-[86%] md:max-w-[72%] ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>")],
  ['avatar', lit("<div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border overflow-hidden\n                    ${isOutbound \n                        ? (isAgent ? 'bg-[var(--cw-navy,#0B1D26)] border-transparent text-white' : 'bg-slate-900 border-slate-800 text-white') ",
    "<div className={`w-7 h-7 mb-5 rounded-full flex items-center justify-center shrink-0 border overflow-hidden\n                    ${isOutbound \n                        ? (isAgent ? 'bg-[var(--sgs-primary)] border-transparent text-[var(--sgs-champagne)]' : 'bg-sgs-champagne border-transparent text-[var(--sgs-primary)]') ")],
  ['sender label', lit("{isAgent && trace && <ThinkingProcess steps={trace} t={t} />}",
    "{isOutbound && (\n                        <span className=\"text-2xs font-semibold text-[var(--text-tertiary)] mb-1 px-1\">{isAgent ? t('inbox.sender_ai') : t('inbox.sender_staff')}</span>\n                    )}\n                    {isAgent && trace && <ThinkingProcess steps={trace} t={t} />}")],
  ['bubble colors', lit("? 'bg-[var(--cw-navy,#0B1D26)] text-white border-[var(--cw-navy,#0B1D26)] rounded-tr-none' \n                            : 'bg-[var(--cw-paper,#FFFFFF)] text-[var(--cw-ink,#26221C)] border-[var(--cw-line,#EAE4D4)] rounded-tl-none'",
    "? (isAgent ? 'bg-[var(--sgs-primary)] text-white border-[var(--sgs-primary)] rounded-br-md' : 'bg-sgs-champagne text-[var(--sgs-primary-deep,#10263D)] border-transparent rounded-br-md')\n                            : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--glass-border)] rounded-bl-md'")],
  ['bubble pad', lit('relative px-4 py-3 rounded-2xl text-sm shadow-sm border w-fit max-w-full', 'relative px-3.5 py-2.5 rounded-2xl text-sm shadow-sm border w-fit max-w-full')],
  ['time font', lit('<span className="text-[var(--cw-ink-dim,#8A8474)] font-mono cw-mono">{formatTime(msg.timestamp)}</span>', '<span className="text-[var(--text-tertiary)]">{formatTime(msg.timestamp)}</span>')],
  ['status weight', lit("<span className={`font-bold ${msg.status === 'READ' ? 'text-sgs-primary' : 'text-[var(--text-secondary)]'}`}>",
    "<span className={`font-medium ${msg.status === 'READ' ? 'text-sgs-primary' : 'text-[var(--text-tertiary)]'}`}>")],
  ['delivery error', lit("{'Đã lưu · Chưa gửi ra kênh'}", "{t('inbox.status_not_delivered')}")],
  ['thinking case', lit('className="flex items-center gap-2 text-xs2 font-bold text-sgs-primary bg-[var(--sgs-primary)]/10 hover:bg-sgs-champagne transition-colors uppercase tracking-wider px-3 py-1.5',
    'className="flex items-center gap-2 text-xs2 font-semibold text-sgs-primary bg-[var(--sgs-primary)]/10 hover:bg-sgs-champagne transition-colors px-3 py-1.5')],
]);

// ------------------------------------------------------------------ server.ts: short link host
patch('server.ts', [
  ['short link origin', lit("    const origin = `${req.protocol}://${req.get('host')}`;\n    res.json({ shortUrl: `${origin}/c/${code}`, code, ttlDays: 30 });",
    "    // Behind the dev proxy req.host is the internal port (localhost:5001); prefer the browser's\n    // Origin header when it matches the (already validated) livechat URL being shortened.\n    const reqOrigin = req.get('origin');\n    let origin = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('x-forwarded-host') || req.get('host')}`;\n    try { if (reqOrigin && new URL(url).origin === reqOrigin) origin = reqOrigin; } catch { /* keep fallback */ }\n    res.json({ shortUrl: `${origin}/c/${code}`, code, ttlDays: 30 });")],
]);

// ------------------------------------------------------------------ locales
const UPDATE = {
  'inbox.loan_title': ['Bảng tính vay ngân hàng', 'Bank loan calculator'],
  'inbox.loan_rate': null,
  'inbox.agent_badge': ['Trợ lý Minh', 'Minh assistant'],
  'inbox.supervisor_cockpit': ['Bảng điều khiển giám sát', 'Supervisor cockpit'],
  'inbox.reply_supervisor': ['Trả lời với tư cách giám sát viên...', 'Reply as supervisor...'],
  'inbox.ai_agent_active': ['Trợ lý Minh đang trả lời', 'Minh is replying'],
  'inbox.human_control': ['Nhân viên đang xử lý', 'Handled by staff'],
  'inbox.auto_pilot': ['Tự động', 'Auto'],
  'inbox.manual': ['Thủ công', 'Manual'],
  'inbox.supervisor_takeover_active': ['Bạn đang trả lời thay trợ lý Minh', 'You are replying instead of Minh'],
  'inbox.ai_activated': ['Đã bật trợ lý Minh', 'Minh assistant turned on'],
  'inbox.manual_enabled': ['Đã chuyển sang trả lời thủ công', 'Switched to manual replies'],
  'inbox.live_chat_widget': ['Mã nhúng live chat', 'Live chat widget'],
  'inbox.toggle_ai': ['Bật/tắt trợ lý Minh tự động trả lời', 'Toggle Minh auto-replies'],
  'inbox.ai_replying': ['Trợ lý Minh đang trả lời...', 'Minh is replying...'],
  'inbox.empty': ['Chưa có hội thoại', 'No conversations'],
  'inbox.select': ['Chọn một hội thoại ở danh sách bên trái để xem và trả lời', 'Pick a conversation on the left to read and reply'],
  'inbox.widget_embed_label': ['Mã nhúng website', 'Website embed'],
  'inbox.widget_link_label': ['Đường dẫn', 'Direct link'],
  'inbox.widget_link_desc': ['Dán vào bài đăng quảng cáo hoặc gửi trực tiếp cho khách.', 'Paste into ads or send it straight to customers.'],
  'inbox.widget_link_copied': ['Đã sao chép đường dẫn', 'Link copied'],
  'inbox.widget_embed_desc': ['Dán vào trước thẻ </body> trên mọi trang của website.', 'Paste it before the </body> tag on every page of your site.'],
  'inbox.widget_embed_copied': ['Đã sao chép mã nhúng', 'Embed code copied'],
  'inbox.widget_qr_title': ['In mã QR này', 'Print this QR code'],
  'inbox.widget_qr_desc': ['Khách quét bằng camera điện thoại để mở khung chat ngay trên trình duyệt, không cần cài ứng dụng.', 'Customers scan it with their phone camera to open the chat in the browser, no app needed.'],
  'inbox.widget_title_placeholder': ['VD: SGS Land hỗ trợ', 'E.g. SGS Land support'],
  'inbox.widget_desc_label': ['Lời chào', 'Greeting'],
  'inbox.widget_title_label': ['Tiêu đề khung chat', 'Chat title'],
  'inbox.widget_short_generating': ['Đang tạo đường dẫn rút gọn...', 'Generating short link...'],
  'inbox.widget_refresh_link': ['Tạo lại đường dẫn', 'Regenerate link'],
  'inbox.widget_open_link': ['Mở thử', 'Open link'],
  'inbox.widget_subtitle': ['Đặt khung chat lên website, bài quảng cáo hoặc ấn phẩm in', 'Put the chat on your website, ads or printed material'],
  'inbox.attach': ['Đính kèm tệp', 'Attach file'],
  'inbox.msg_file': ['Tệp đính kèm', 'File attachment'],
  'inbox.msg_audio': ['Tin nhắn thoại', 'Voice message'],
  'inbox.new_message': ['Tin nhắn mới', 'New message'],
  'inbox.file_size_error': ['Tệp không được vượt quá 5MB', 'File size must be less than 5MB'],
  'inbox.booking_confirm': ['Xác nhận ngay', 'Confirm now'],
  'inbox.thinking_process': ['Quá trình suy luận', 'Reasoning steps'],
};
delete UPDATE['inbox.loan_rate'];
const NEW = {
  'inbox.embed_short': ['Mã nhúng', 'Embed'],
  'inbox.search_placeholder': ['Tìm theo tên khách hoặc nội dung', 'Search by name or message'],
  'inbox.filter_status': ['Lọc theo trạng thái', 'Filter by status'],
  'inbox.filter_channel': ['Lọc theo kênh', 'Filter by channel'],
  'inbox.score_points': ['{n} điểm', '{n} pts'],
  'inbox.context_title': ['Thông tin khách hàng', 'Customer details'],
  'inbox.sender_ai': ['Trợ lý Minh', 'Minh assistant'],
  'inbox.sender_staff': ['Nhân viên', 'Staff'],
  'inbox.status_not_delivered': ['Đã lưu, chưa gửi ra kênh', 'Saved, not delivered to channel'],
  'inbox.file_size_unknown': ['Không rõ dung lượng', 'Unknown size'],
  'inbox.feedback_up': ['Câu trả lời hữu ích', 'Helpful answer'],
  'inbox.feedback_down': ['Câu trả lời cần cải thiện', 'Needs improvement'],
  'inbox.feedback_helpful_done': ['✓ Hữu ích', '✓ Helpful'],
  'inbox.feedback_recorded': ['✓ Đã ghi nhận', '✓ Noted'],
  'inbox.feedback_correction_placeholder': ['Câu trả lời đúng nên là gì? (không bắt buộc)', 'What should the answer be? (optional)'],
  'inbox.feedback_send': ['Gửi góp ý', 'Send feedback'],
  'inbox.share_product_zalo': ['Gửi sản phẩm qua Zalo', 'Send listing via Zalo'],
  'inbox.share_product_zalo_hint': ['Gửi đầy đủ thông tin và hình ảnh sản phẩm qua Zalo', 'Send the full listing details and photos via Zalo'],
  'inbox.csat_title': ['Đánh giá CSAT', 'CSAT survey'],
  'inbox.csat_hint': ['Chỉ gửi khi đã kết thúc trao đổi · kênh {channel}', 'Send only after the conversation ends · {channel}'],
  'inbox.csat_send': ['Gửi lời mời đánh giá', 'Send survey'],
  'inbox.csat_sent': ['Đã gửi lời mời', 'Survey sent'],
  'inbox.csat_score_label': ['Điểm khách chấm:', 'Customer score:'],
  'inbox.csat_reason_label': ['Lý do chưa hài lòng (không bắt buộc)', 'Reason for low score (optional)'],
  'inbox.csat_reason_placeholder': ['Điều gì khiến trải nghiệm chưa tốt?', 'What made the experience poor?'],
  'inbox.csat_consent': ['Khách đã đồng ý ghi nhận đánh giá này', 'Customer agreed to record this rating'],
  'inbox.csat_record': ['Ghi nhận CSAT', 'Record CSAT'],
  'inbox.csat_recorded': ['Đã ghi nhận CSAT {score}/5 cho hội thoại này.', 'CSAT {score}/5 recorded for this conversation.'],
  'inbox.widget_step_customize': ['Tùy chỉnh khung chat', 'Customise the chat'],
  'inbox.widget_step_source': ['Chọn nguồn khách', 'Pick the traffic source'],
  'inbox.widget_source_desc': ['Mỗi nguồn có mã riêng để báo cáo biết khách đến từ đâu.', 'Each source gets its own code so reports show where customers came from.'],
  'inbox.widget_source_default': ['Website', 'Website'],
  'inbox.widget_step_share': ['Lấy mã và chia sẻ', 'Get the code and share'],
  'inbox.widget_copy_code': ['Sao chép mã', 'Copy code'],
  'inbox.widget_embed_step1': ['Bấm "Sao chép mã".', 'Click "Copy code".'],
  'inbox.widget_embed_step3': ['Tải lại trang: nút chat sẽ hiện ở góc phải bên dưới.', 'Reload the page: the chat button appears bottom right.'],
  'inbox.widget_preview': ['Xem trước', 'Preview'],
  'inbox.widget_preview_greeting': ['Xin chào! Em có thể giúp gì cho anh/chị?', 'Hi! How can we help you today?'],
  'inbox.widget_preview_question': ['Dự án này giá bao nhiêu?', 'How much is this project?'],
  'inbox.widget_preview_hint': ['Khung chat dùng màu thương hiệu SGS Land và tự đổi ngôn ngữ theo trình duyệt của khách.', 'The chat uses SGS Land brand colours and follows the visitor\'s language.'],
};
{
  const f = 'config/locales.ts';
  let src = fs.readFileSync(f, 'utf8');
  const enStart = src.search(/^\s*en\s*:\s*\{/m);
  let upd = 0; const miss = [];
  for (const [k, [vn, en]] of Object.entries(UPDATE)) {
    const re = new RegExp(`^(\\s*)"${k.replace(/\./g, '\\.')}"\\s*:\\s*"(?:[^"\\\\]|\\\\.)*",?`, 'gm');
    const m = [...src.matchAll(re)];
    const vnM = m.find(x => x.index < enStart), enM = m.find(x => x.index > enStart);
    if (!vnM || !enM) { miss.push(k); continue; }
    // replace EN first (later offset) so VN index stays valid
    src = src.slice(0, enM.index) + `${enM[1]}${JSON.stringify(k)}: ${JSON.stringify(en)},` + src.slice(enM.index + enM[0].length);
    src = src.slice(0, vnM.index) + `${vnM[1]}${JSON.stringify(k)}: ${JSON.stringify(vn)},` + src.slice(vnM.index + vnM[0].length);
    upd++;
  }
  const anchors = [...src.matchAll(/^(\s*)"detail\.history"\s*:.*$/gm)];
  if (anchors.length !== 2 || enStart < 0) report.push(`FAIL ${f}: anchors ${anchors.length} enStart ${enStart}`);
  else {
    const [a, b] = anchors;
    const ins = (i, indent, block) => Object.entries(NEW).filter(([k]) => !block.includes(`"${k}"`)).map(([k, v]) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(v[i])},`).join('\n');
    const enIns = ins(1, b[1], src.slice(a.index + a[0].length));
    const vnIns = ins(0, a[1], src.slice(0, b.index));
    const bEnd = b.index + b[0].length; src = src.slice(0, bEnd) + (enIns ? '\n' + enIns : '') + src.slice(bEnd);
    const aEnd = a.index + a[0].length; src = src.slice(0, aEnd) + (vnIns ? '\n' + vnIns : '') + src.slice(aEnd);
    if (!DRY) fs.writeFileSync(f, src);
    report.push(`OK   ${f} (updated ${upd}${miss.length ? ', MISSING ' + miss.join(',') : ''}; +${vnIns ? vnIns.split('\n').length : 0} VN / +${enIns ? enIns.split('\n').length : 0} EN keys)`);
  }
}
console.log(report.join('\n'));
