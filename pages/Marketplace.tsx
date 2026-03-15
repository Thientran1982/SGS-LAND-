import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/dbApi';
import { AppManifest, InstalledApp } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    INSTALL: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, // Lightning bolt for Connect
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    SEARCH: <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    CONFIG: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

export const Marketplace: React.FC = () => {
    const [apps, setApps] = useState<AppManifest[]>([]);
    const [installed, setInstalled] = useState<InstalledApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'BROWSE' | 'INSTALLED'>('BROWSE');
    const [category, setCategory] = useState('ALL');
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { t } = useTranslation();

    const loadData = async () => {
        // Only show full loading on initial load
        if (apps.length === 0) setLoading(true);
        try {
            const [allApps, myApps] = await Promise.all([
                db.getMarketplaceApps(),
                db.getInstalledApps()
            ]);
            setApps(allApps || []);
            setInstalled(myApps || []);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const notify = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleInstall = async (appId: string) => {
        if (!confirm(t('market.modal_install_msg'))) return;
        setProcessingId(appId);
        try {
            await db.installApp(appId);
            notify(t('market.install_success'), 'success');
            // Optimistic update or reload
            await loadData();
        } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e);
            notify(message, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleUninstall = async (appId: string) => {
        if (!confirm(t('market.modal_uninstall_msg'))) return;
        setProcessingId(appId);
        try {
            await db.uninstallApp(appId); 
            notify(t('market.uninstall_success'), 'success');
            setInstalled(prev => (prev || []).filter(a => a.appId !== appId));
        } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e);
            notify(message, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleConfigure = () => {
        notify(t('market.config_toast'), 'success');
    };

    const filteredApps = useMemo(() => {
        const safeApps = apps || [];
        const safeInstalled = installed || [];
        
        let list = activeTab === 'BROWSE' ? safeApps : safeApps.filter(a => safeInstalled.some(i => i.appId === a.id));
        
        if (category !== 'ALL') {
            list = list.filter(a => a.category === category);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
        }
        return list;
    }, [apps, installed, category, search, activeTab]);

    // Use Array.from<string> to ensure correct type inference
    const categories: string[] = ['ALL', ...Array.from<string>(new Set((apps || []).map(a => a.category)))];

    // Helper to translate category keys
    const getCatLabel = (cat: string) => {
        if (cat === 'ALL') return t('market.category_all');
        const key = `market.cat_${cat.toLowerCase()}`;
        const label = t(key);
        return label !== key ? label : cat; // Fallback to key if translation missing
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' : 'bg-rose-900/90 text-rose-100 border-rose-500'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('market.title')}</h2>
                    <p className="text-sm text-slate-500">{t('market.subtitle')}</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('BROWSE')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'BROWSE' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t('market.tab_browse')}</button>
                    <button onClick={() => setActiveTab('INSTALLED')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'INSTALLED' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t('market.tab_installed')}</button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar Categories */}
                <div className="w-full md:w-64 space-y-2 shrink-0">
                    <div className="relative mb-6 group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input 
                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400"
                            placeholder={t('common.search')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearch('')}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${category === cat ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                        >
                            {getCatLabel(cat)}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredApps.map(app => {
                        const isInstalled = (installed || []).some(i => i.appId === app.id);
                        const isProcessing = processingId === app.id;

                        return (
                            <div key={app.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-lg transition-all group flex flex-col h-full relative overflow-hidden">
                                {isProcessing && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-14 h-14 rounded-2xl shadow-sm bg-slate-50 flex items-center justify-center p-2 border border-slate-100">
                                        <img src={app.icon} className="w-full h-full object-contain" alt="" />
                                    </div>
                                    {isInstalled && <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-100">{t('market.installed_badge')}</span>}
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-1">{app.name}</h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">{getCatLabel(app.category)}</div>
                                <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1 leading-relaxed">{app.description}</p>
                                
                                <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
                                    <div className="flex flex-col">
                                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{app.developer}</span>
                                         <span className="text-[10px] font-mono text-slate-300">v{app.version}</span>
                                    </div>
                                    
                                    {isInstalled ? (
                                        <div className="flex gap-2">
                                            <button onClick={handleConfigure} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5">
                                                {ICONS.CONFIG} {t('market.btn_config')}
                                            </button>
                                            <button onClick={() => handleUninstall(app.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" title={t('market.btn_uninstall')}>
                                                {ICONS.TRASH}
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleInstall(app.id)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-lg active:scale-95 flex items-center gap-2">
                                            {ICONS.INSTALL} {t('market.btn_install')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredApps.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-400 italic">
                            {t('common.no_results')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};