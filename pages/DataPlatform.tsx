
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ConnectorConfig, SyncJob, ConnectorType, SyncStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { connectorService } from '../services/connectorService';
import { ConfirmModal } from '../components/ConfirmModal';

const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    SYNC: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    DB: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    PLUG: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
};

const CONNECTOR_ICONS: Record<string, string> = {
    GOOGLE_SHEETS: '📊',
    HUBSPOT: '🟠',
    ZOHO_CRM: '🟢',
    SALESFORCE: '☁️',
    WEBHOOK_EXPORT: '🔗',
};

const ConnectorModal = ({ isOpen, onClose, onSave, t }: any) => {
    const [form, setForm] = useState<Partial<ConnectorConfig>>({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });

    useEffect(() => {
        if (isOpen) setForm({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfigChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-[24px] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-[var(--glass-border)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('data.modal_title')}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('data.modal_subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors">{ICONS.CLOSE}</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.type')}</label>
                        <Dropdown
                            value={form.type || ConnectorType.GOOGLE_SHEETS}
                            onChange={(v) => setForm({ ...form, type: v as ConnectorType, config: {} })}
                            options={Object.values(ConnectorType).map(v => ({
                                value: v,
                                label: `${CONNECTOR_ICONS[v] || '🔌'} ${t(`data.type_${v}`)}`
                            }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.name')}</label>
                        <input
                            className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                            placeholder={t('data.name_placeholder')}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>

                    {form.type === ConnectorType.GOOGLE_SHEETS && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.spreadsheet_id')}</label>
                            <input
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                                placeholder={t('data.spreadsheet_placeholder')}
                                value={String(form.config?.spreadsheetId || '')}
                                onChange={e => handleConfigChange('spreadsheetId', e.target.value)}
                            />
                            <p className="text-xs text-[var(--text-secondary)] mt-1.5 flex items-center gap-1">
                                <span>💡</span> {t('data.hint_gsheet')}
                            </p>
                        </div>
                    )}
                    {form.type === ConnectorType.WEBHOOK_EXPORT && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.target_url')}</label>
                            <input
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                                placeholder={t('data.webhook_placeholder')}
                                value={String(form.config?.targetUrl || '')}
                                onChange={e => handleConfigChange('targetUrl', e.target.value)}
                            />
                        </div>
                    )}
                    {(form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE || form.type === ConnectorType.ZOHO_CRM) && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.api_key')}</label>
                            <input
                                type="password"
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                                placeholder={t('data.api_key_placeholder')}
                                value={String(form.config?.apiKey || '')}
                                onChange={e => handleConfigChange('apiKey', e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6">
                    <button
                        onClick={() => onSave(form)}
                        disabled={
                            !form.name?.trim() ||
                            (form.type === ConnectorType.GOOGLE_SHEETS && !String(form.config?.spreadsheetId || '').trim()) ||
                            ((form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE || form.type === ConnectorType.ZOHO_CRM) && !String(form.config?.apiKey || '').trim()) ||
                            (form.type === ConnectorType.WEBHOOK_EXPORT && !String(form.config?.targetUrl || '').trim())
                        }
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const StatusBadge = ({ status, t }: { status: SyncStatus; t: any }) => {
    const styles: Record<string, string> = {
        [SyncStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        [SyncStatus.FAILED]: 'bg-rose-50 text-rose-700 border-rose-200',
        [SyncStatus.RUNNING]: 'bg-blue-50 text-blue-700 border-blue-200',
        [SyncStatus.QUEUED]: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
            {t(`data.status_${status.toLowerCase()}`)}
        </span>
    );
};

export const DataPlatform: React.FC = () => {
    const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { t, formatDateTime } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [c, j] = await Promise.all([db.getConnectorConfigs(), db.getSyncJobs()]);
            setConnectors(c || []);
            setJobs(j || []);
        } catch {
            // silent — UI stays with empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreate = async (data: Partial<ConnectorConfig>) => {
        try {
            await connectorService.validateConnection(data.type!, data.config, t);
            await db.createConnectorConfig(data);
            notify(t('data.create_success'), 'success');
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    const handleDeleteConnector = async () => {
        if (!deleteConfirmId) return;
        try {
            await db.deleteConnectorConfig(deleteConfirmId);
            setConnectors(prev => prev.filter(c => c.id !== deleteConfirmId));
            notify(t('data.delete_success'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleSync = async (id: string) => {
        setSyncingId(id);
        notify(t('data.sync_started'), 'success');
        try {
            await connectorService.runSync(id);
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setSyncingId(null);
        }
    };

    const activeCount = connectors.filter(c => c.status === 'ACTIVE').length;
    const lastJob = jobs[0];

    if (loading) {
        return (
            <div className="p-4 sm:p-6 space-y-6 animate-enter">
                <div className="h-20 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-64 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                    <div className="h-64 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="p-4 sm:p-6 space-y-6 pb-20 animate-enter relative">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('data.title')}</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{t('data.subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="shrink-0 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 text-sm"
                >
                    {ICONS.ADD}
                    {t('data.btn_new')}
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_connections')}</p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">{connectors.length}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{activeCount} {t('data.stat_active_count')}</p>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_syncs')}</p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">{jobs.length}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {jobs.filter(j => j.status === SyncStatus.COMPLETED).length} {t('data.stat_success_count')}
                    </p>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm col-span-2 sm:col-span-1">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_last_sync')}</p>
                    <div className="mt-2">
                        {lastJob ? (
                            <>
                                <StatusBadge status={lastJob.status} t={t} />
                                <p className="text-xs text-[var(--text-secondary)] mt-1.5 flex items-center gap-1">
                                    {ICONS.CLOCK} {formatDateTime(lastJob.startedAt)}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('data.never')}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Connectors Panel */}
                <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col max-h-[520px]">
                    <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0">
                        <h3 className="font-bold text-[var(--text-primary)]">{t('data.active_connectors')}</h3>
                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--glass-surface)] px-2 py-0.5 rounded-full font-mono">{connectors.length}</span>
                    </div>

                    {connectors.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center gap-3 flex-1 justify-center">
                            <div className="w-14 h-14 bg-[var(--glass-surface)] rounded-2xl flex items-center justify-center text-[var(--text-tertiary)]">
                                {ICONS.PLUG}
                            </div>
                            <div>
                                <p className="font-bold text-[var(--text-primary)] text-sm">{t('data.empty_connectors')}</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">{t('data.empty_connectors_hint')}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="mt-1 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1.5"
                            >
                                {ICONS.ADD} {t('data.btn_new')}
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-y-auto no-scrollbar overscroll-contain p-4 space-y-3">
                            {connectors.map(c => (
                                <div key={c.id} className="bg-[var(--glass-surface)] p-4 rounded-[18px] border border-[var(--glass-border)] flex justify-between items-center group hover:bg-[var(--glass-surface-hover)] transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-lg shrink-0 shadow-sm">
                                            {CONNECTOR_ICONS[c.type] || '🔌'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm truncate">{c.name}</h4>
                                            </div>
                                            <div className="text-xs text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[10px]">{t(`data.type_${c.type}`)}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    {ICONS.CLOCK}
                                                    {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : t('data.never')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                                        <button
                                            onClick={() => handleSync(c.id)}
                                            disabled={syncingId === c.id}
                                            className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                            title={t('data.sync_now')}
                                        >
                                            <span className={syncingId === c.id ? 'animate-spin inline-block' : ''}>{ICONS.SYNC}</span>
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmId(c.id)}
                                            className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                                            title={t('common.delete')}
                                        >
                                            {ICONS.TRASH}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Job History Panel */}
                <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col max-h-[520px]">
                    <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0">
                        <h3 className="font-bold text-[var(--text-primary)]">{t('data.sync_history')}</h3>
                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--glass-surface)] px-2 py-0.5 rounded-full font-mono">{jobs.length}</span>
                    </div>

                    {jobs.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)] flex flex-col items-center justify-center flex-1">
                            <p className="text-2xl mb-2">📋</p>
                            <p className="text-sm font-medium">{t('data.empty_jobs')}</p>
                            <p className="text-xs mt-1 text-[var(--text-tertiary)]">{t('data.empty_jobs_hint')}</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto no-scrollbar overscroll-contain divide-y divide-[var(--glass-border)]">
                            {jobs.map(job => {
                                const connector = connectors.find(c => c.id === job.connectorId);
                                return (
                                    <div key={job.id} className="px-6 py-3.5 flex justify-between items-center hover:bg-[var(--glass-surface)] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-base shrink-0">
                                                {connector ? CONNECTOR_ICONS[connector.type] || '🔌' : '❓'}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                                    {connector?.name || t('data.unknown')}
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 flex items-center gap-1">
                                                    {ICONS.CLOCK} {formatDateTime(job.startedAt)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <StatusBadge status={job.status} t={t} />
                                            {job.recordsProcessed > 0 && (
                                                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                                    {job.recordsProcessed} {t('table.records')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ConnectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} t={t} />
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title={t('common.delete')}
                message={t('data.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDeleteConnector}
                onCancel={() => setDeleteConfirmId(null)}
                variant="danger"
            />
        </div>
        {createPortal(
            toast ? (
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-900/95 border-emerald-700 text-white' : 'bg-rose-900/95 border-rose-700 text-white'}`}
                >
                    <span className="text-sm">{toast.type === 'success' ? '✓' : '✕'}</span>
                    <span className="font-semibold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
