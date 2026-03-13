
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../services/dbApi';
import { ConnectorConfig, SyncJob, ConnectorType, SyncStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { connectorService } from '../services/connectorService';

const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    SYNC: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

const ConnectorModal = ({ isOpen, onClose, onSave, t }: any) => {
    const [form, setForm] = useState<Partial<ConnectorConfig>>({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });

    if (!isOpen) return null;

    const handleConfigChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{t('data.modal_title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">{ICONS.CLOSE}</button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('data.type')}</label>
                        <Dropdown 
                            value={form.type || ConnectorType.GOOGLE_SHEETS}
                            onChange={(v) => setForm({...form, type: v as ConnectorType})}
                            options={Object.values(ConnectorType).map(v => ({ value: v, label: t(`data.type_${v}`) }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('data.name')}</label>
                        <input className="w-full border rounded-xl px-4 py-2 text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    
                    {/* Dynamic Config Fields */}
                    {form.type === ConnectorType.GOOGLE_SHEETS && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('data.spreadsheet_id')}</label>
                            <input className="w-full border rounded-xl px-4 py-2 text-sm font-mono" value={form.config?.spreadsheetId || ''} onChange={e => handleConfigChange('spreadsheetId', e.target.value)} />
                            <p className="text-[10px] text-slate-400 mt-1">{t('data.hint_gsheet')}</p>
                        </div>
                    )}
                    {form.type === ConnectorType.WEBHOOK_EXPORT && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('data.target_url')}</label>
                            <input className="w-full border rounded-xl px-4 py-2 text-sm font-mono" value={form.config?.targetUrl || ''} onChange={e => handleConfigChange('targetUrl', e.target.value)} />
                        </div>
                    )}
                    {(form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE) && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('data.api_key')}</label>
                            <input type="password" className="w-full border rounded-xl px-4 py-2 text-sm font-mono" value={form.config?.apiKey || ''} onChange={e => handleConfigChange('apiKey', e.target.value)} />
                        </div>
                    )}

                    <button onClick={() => onSave(form)} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl mt-4 hover:bg-slate-800 shadow-lg">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};

export const DataPlatform: React.FC = () => {
    const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDateTime } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [c, j] = await Promise.all([
                db.getConnectorConfigs(),
                db.getSyncJobs()
            ]);
            setConnectors(c || []);
            setJobs(j || []);
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreate = async (data: Partial<ConnectorConfig>) => {
        try {
            // Validate first
            await connectorService.validateConnection(data.type!, data.config, t);
            await db.createConnectorConfig(data);
            notify(t('data.create_success'), 'success');
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    const handleDeleteConnector = async (id: string) => {
        if (!confirm(t('data.confirm_delete'))) return;
        try {
            await db.deleteConnectorConfig(id);
            setConnectors(prev => (prev || []).filter(c => c.id !== id));
            notify(t('data.delete_success'), 'success');
        } catch (e: any) { notify(e.message, 'error'); }
    };

    const handleSync = async (id: string) => {
        notify(t('data.sync_started'), 'success');
        try {
            await connectorService.runSync(id);
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="flex justify-end">
                <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                    {ICONS.ADD} {t('data.btn_new')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Connectors List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 px-2">{t('data.active_connectors')}</h3>
                    {connectors.length === 0 && <div className="p-8 text-center text-slate-400 bg-white rounded-[24px] border border-slate-100 border-dashed">{t('data.empty_connectors')}</div>}
                    {connectors.map(c => (
                        <div key={c.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    <h4 className="font-bold text-slate-800">{c.name}</h4>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                    <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">{t(`data.type_${c.type}`)}</span>
                                    <span>• {t('data.last_sync')}: {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : t('data.never')}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleSync(c.id)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100" title={t('data.sync_now')}>{ICONS.SYNC}</button>
                                <button onClick={() => handleDeleteConnector(c.id)} className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100" title={t('common.delete')}>{ICONS.TRASH}</button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Job History */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 mb-4">{t('data.sync_history')}</h3>
                    <div className="space-y-0 divide-y divide-slate-50">
                        {jobs.slice(0, 5).map(job => (
                            <div key={job.id} className="py-3 flex justify-between items-center text-xs">
                                <div>
                                    <div className="font-bold text-slate-700">{connectors.find(c => c.id === job.connectorId)?.name || t('data.unknown')}</div>
                                    <div className="text-slate-400 font-mono mt-0.5">{formatDateTime(job.startedAt)}</div>
                                </div>
                                <div className="text-right">
                                    <span className={`font-bold px-2 py-0.5 rounded uppercase ${
                                        job.status === SyncStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600' : 
                                        job.status === SyncStatus.FAILED ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                        {t(`data.status_${job.status.toLowerCase()}`)}
                                    </span>
                                    <div className="mt-1 text-slate-500">{job.recordsProcessed} {t('table.records')}</div>
                                </div>
                            </div>
                        ))}
                        {jobs.length === 0 && <div className="text-center text-slate-400 italic py-4">{t('data.empty_jobs')}</div>}
                    </div>
                </div>
            </div>

            <ConnectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} t={t} />
        </div>
    );
};
