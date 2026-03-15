
import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { db } from '../services/dbApi';
import { systemService } from '../services/systemService';
import { chaosService } from '../services/chaosService';
import { SystemHealth, ChaosConfig, LogEntry, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';

const ICONS = {
    REFRESH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    DOWNLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" /></svg>,
    UPLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    PLAY: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
    PAUSE: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

const LogViewer = memo(({ logs, isPaused, togglePause, onClear, t }: { logs: LogEntry[], isPaused: boolean, togglePause: () => void, onClear: () => void, t: any }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isNearBottom);
    };

    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [logs, autoScroll]);

    return (
        <div className="bg-[#0f1117] rounded-3xl shadow-xl overflow-hidden flex flex-col h-[600px] border border-slate-800 animate-enter ring-1 ring-white/10">
            <div className="flex justify-between items-center p-3 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-mono text-slate-300 font-bold">LIVE LOGS</span>
                    <span className="text-[10px] bg-white/10 px-1.5 rounded text-slate-400 font-mono">{logs.length}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={togglePause} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title={isPaused ? "Resume" : "Pause"}>
                        {isPaused ? ICONS.PLAY : ICONS.PAUSE}
                    </button>
                    <button onClick={onClear} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-rose-400 transition-colors" title="Clear">
                        {ICONS.TRASH}
                    </button>
                </div>
            </div>
            
            <div 
                ref={containerRef} 
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px] leading-relaxed no-scrollbar"
            >
                {logs?.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <div className="animate-pulse mb-2 text-2xl">_</div>
                        <div>{t('system.logs_waiting')}</div>
                    </div>
                )}
                {logs?.map((log) => (
                    <div key={log.id} className="flex gap-3 hover:bg-white/5 p-1 rounded-md transition-colors group break-all">
                        <span className="text-slate-500 shrink-0 select-none w-16">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`shrink-0 font-bold w-12 ${log.level === 'ERROR' ? 'text-rose-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {log.level}
                        </span>
                        <span className="text-slate-400 group-hover:text-slate-200">
                            <span className="text-indigo-400 font-bold mr-2">[{log.source}]</span>
                            {log.message}
                            {log.context && (
                                <span className="text-slate-600 ml-2">{JSON.stringify(log.context)}</span>
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
});

const HealthHero = memo(({ health, theme, onBackup, onRestore, isRestoring, t }: { health: SystemHealth, theme: any, onBackup: () => void, onRestore: () => void, isRestoring: boolean, t: any }) => {
    const statusColor = health.status === 'HEALTHY' ? 'text-emerald-500' : health.status === 'DEGRADED' ? 'text-amber-500' : 'text-rose-500';
    const borderColor = health.status === 'HEALTHY' ? 'border-emerald-500' : health.status === 'DEGRADED' ? 'border-amber-500' : 'border-rose-500';
    const primaryColor = theme?.colors?.primary || '#4F46E5';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-enter">
            <div className={`bg-white p-8 rounded-[32px] border-2 ${borderColor} shadow-lg relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-current to-transparent opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none" style={{ color: primaryColor }}></div>
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">{t('system.overview')}</h3>
                    <div className={`text-3xl md:text-4xl font-black ${statusColor} mb-2`}>
                        {t(`system.status.${health.status}`)}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-500 mt-4">
                        <span className="bg-slate-100 px-2 py-1 rounded">v{health.version}</span>
                        <span className="bg-slate-100 px-2 py-1 rounded">UPTIME: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</span>
                        <span className="bg-slate-100 px-2 py-1 rounded">{health.environment}</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t('system.dr_title')}</h3>
                    <div className="flex gap-4">
                        <button onClick={onBackup} className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-xs hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                            {ICONS.DOWNLOAD} {t('system.btn_backup')}
                        </button>
                        <button onClick={onRestore} disabled={isRestoring} className="flex-1 bg-white/10 text-white border border-white/20 py-3 rounded-xl font-bold text-xs hover:bg-white/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {isRestoring ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : ICONS.UPLOAD}
                            {t('system.btn_restore')}
                        </button>
                    </div>
                </div>
                <div className="mt-6 text-[10px] text-slate-500 font-mono">
                    BACKUP: FULL SNAPSHOT • JSON FORMAT
                </div>
            </div>
        </div>
    );
});

const ChaosPanel = memo(({ config, onChange, t }: { config: ChaosConfig, onChange: (c: Partial<ChaosConfig>) => void, t: any }) => (
    <div className={`p-6 rounded-[24px] border-2 transition-all ${config.enabled ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-start mb-6">
            <div>
                <h3 className={`font-bold ${config.enabled ? 'text-rose-700' : 'text-slate-800'}`}>{t('system.chaos_title')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('system.chaos_desc')}</p>
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.enabled ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                    {config.enabled ? t('system.armed') : t('system.safe_mode')}
                </span>
                <button 
                    onClick={() => onChange({ enabled: !config.enabled })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${config.enabled ? 'bg-rose-500' : 'bg-slate-300'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${config.enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
            </div>
        </div>

        <div className={`grid grid-cols-2 gap-6 transition-opacity duration-300 ${config.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('system.latency')} (ms)</label>
                <input 
                    type="range" min="0" max="2000" step="100" 
                    value={config.latencyMs} 
                    onChange={e => onChange({ latencyMs: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="text-right text-xs font-mono font-bold text-slate-700 mt-1">{config.latencyMs}ms</div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('system.error_rate')} (%)</label>
                <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={config.errorRate} 
                    onChange={e => onChange({ errorRate: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="text-right text-xs font-mono font-bold text-slate-700 mt-1">{(config.errorRate * 100).toFixed(0)}%</div>
            </div>
        </div>
    </div>
));

export const SystemStatus: React.FC = () => {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [chaosConfig, setChaosConfig] = useState<ChaosConfig>(chaosService.getConfig());
    const [isPaused, setIsPaused] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
    const { chartTheme } = useTheme();

    useEffect(() => {
        const init = async () => {
            const user = await db.getCurrentUser();
            setIsAdmin(user?.role === UserRole.ADMIN);
            
            const h = await systemService.checkHealth();
            setHealth(h);
        };
        init();

        const interval = setInterval(async () => {
            if (!document.hidden) {
                const h = await systemService.checkHealth();
                setHealth(h);
                if (!isPaused) {
                    setLogs(systemService.getRecentLogs());
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);

    const notify = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const updateChaos = (newConfig: Partial<ChaosConfig>) => {
        chaosService.configure(newConfig);
        setChaosConfig(chaosService.getConfig());
    };

    const handleBackup = async () => {
        try {
            await systemService.downloadBackup();
            notify(t('system.alert.backup_success'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    const handleRestore = () => {
        if (confirm(t('system.alert.restore_confirm'))) {
            fileInputRef.current?.click();
        }
    };
    
    const handleClearLogs = () => {
        if(confirm("Clear local logs?")) {
            systemService.clearLogs(); 
            setLogs([]);
            notify("Logs cleared", 'success');
        }
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsRestoring(true);
        try {
            await systemService.processRestoreFile(file);
            notify(t('system.alert.restore_success'), 'success');
            // Wait a moment before reloading to show success message
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            notify(`${t('system.alert.restore_fail')} ${error.message}`, 'error');
            setIsRestoring(false); // Only reset if failed, success triggers reload
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const runbooks = [
        { id: 1, title: t('system.runbook.sop1_title'), code: 'SOP-001', variant: 'warning', action: () => {
            if(confirm(t('system.alert.failover_confirm'))) notify(t('system.alert.failover_triggered'), 'success');
        }},
        { id: 2, title: t('system.runbook.sop2_title'), code: 'SOP-002', variant: 'neutral', action: () => notify('AI Engine Restarted', 'success') },
        { id: 3, title: t('system.runbook.sop3_title'), code: 'SOP-003', variant: 'danger', action: () => notify('Emergency Shutdown Sequence Initiated', 'error') },
    ];

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${
                    toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'
                }`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('system.title')}</h2>
                    <p className="text-sm text-slate-500">{t('system.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t('system.auto_refresh')}</span>
                </div>
            </div>

            {health && <HealthHero health={health} theme={chartTheme} onBackup={handleBackup} onRestore={handleRestore} isRestoring={isRestoring} t={t} />}

            {isAdmin && <ChaosPanel config={chaosConfig} onChange={updateChaos} t={t} />}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* LOGS - Takes 2/3 width on large screens */}
                <div className="xl:col-span-2">
                    <LogViewer 
                        logs={logs} 
                        isPaused={isPaused} 
                        togglePause={() => setIsPaused(!isPaused)} 
                        onClear={handleClearLogs} 
                        t={t} 
                    />
                </div>

                {/* INFO & RUNBOOKS */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 animate-enter">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">{t('system.config_title')}</h3>
                        <div className="space-y-2">
                            {health?.config?.map((conf) => (
                                <div key={conf.key} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        <span className="font-mono text-slate-600 text-[10px] truncate" title={conf.key}>{conf.key}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${conf.status === 'OK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {conf.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 animate-enter">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">{t('system.runbook_title')}</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {runbooks.map((book) => (
                                <button key={book.id} onClick={book.action} className={`p-4 rounded-xl text-left transition-all border group relative overflow-hidden ${book.variant === 'neutral' ? 'bg-slate-50 border-slate-100 hover:border-slate-300' : book.variant === 'warning' ? 'bg-amber-50 border-amber-100 hover:border-amber-300' : 'bg-rose-50 border-rose-100 hover:border-rose-300'}`}>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div>
                                            <div className={`text-[9px] font-bold uppercase mb-1 ${book.variant === 'danger' ? 'text-rose-600' : book.variant === 'warning' ? 'text-amber-600' : 'text-slate-500'}`}>{book.code}</div>
                                            <div className="font-bold text-slate-800 text-xs group-hover:underline decoration-2 underline-offset-2">{book.title}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onFileSelected} />
        </div>
    );
};
