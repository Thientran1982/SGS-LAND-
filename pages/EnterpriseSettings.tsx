
import React, { useEffect, useState, useCallback, memo } from 'react';
import { db } from '../services/dbApi';
import { EnterpriseConfig, AuditLog, User, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { copyToClipboard } from '../utils/clipboard';

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const CONSTANTS = {
    MOCK_REDIRECT_URI: 'https://api.sgs.vn/auth/callback',
    TOAST_DURATION: 3000,
    MASK: '••••••••••••••••'
};

// -----------------------------------------------------------------------------
// HELPER COMPONENTS
// -----------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; subtitle: string; action?: React.ReactNode }> = memo(({ title, subtitle, action }) => (
    <div className="flex justify-between items-start gap-4 mb-6 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-800 break-words">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        {action && <div className="shrink-0 mt-1">{action}</div>}
    </div>
));

const StatusBadge: React.FC<{ active: boolean; label: string }> = memo(({ active, label }) => (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
        {label}
    </span>
));

// -----------------------------------------------------------------------------
// PANELS (Optimized & Localized)
// -----------------------------------------------------------------------------

const ZaloPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t, formatDate } = useTranslation();
    const [connecting, setConnecting] = useState(false);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await db.connectZaloOA();
            notify(t('ent.zalo_success'), 'success');
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); } 
        finally { setConnecting(false); }
    };

    const handleDisconnect = async () => {
        try { await db.disconnectZaloOA(); notify(t('common.success'), 'success'); onRefresh(); } 
        catch (e: any) { notify(e.message, 'error'); }
    };

    const copyWebhook = async () => {
        if (config.zalo.webhookUrl) {
            await copyToClipboard(config.zalo.webhookUrl);
            notify(t('common.copied'), 'success');
        }
    };

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader title={t('ent.zalo_title')} subtitle={t('ent.zalo_subtitle')} action={<StatusBadge active={!!config.zalo?.enabled} label={config.zalo?.enabled ? t('ent.zalo_status_connected') : t('ent.zalo_status_disconnected')} />} />
            
            {config.zalo?.enabled ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                    <div className="p-6 md:p-8 flex-1">
                        <div className="flex items-center gap-5 mb-6">
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20 shrink-0">Z</div>
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold text-slate-800 break-words">{config.zalo.oaName}</h3>
                                <div className="inline-flex items-center gap-2 mt-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-500 font-mono border border-slate-200">ID: {config.zalo.oaId}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('ent.zalo_role')}</div>
                                <div className="flex flex-wrap gap-1">
                                    <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600">{t('ent.zalo_perm_msg')}</span>
                                    <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600">{t('ent.zalo_perm_user')}</span>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('ent.zalo_connected_at')}</div>
                                <div className="text-xs font-bold text-slate-700">{config.zalo.connectedAt ? formatDate(config.zalo.connectedAt) : '-'}</div>
                            </div>
                        </div>
                        <button onClick={handleDisconnect} className="text-rose-600 text-sm font-bold hover:underline decoration-2 underline-offset-4">{t('ent.zalo_disconnect_btn')}</button>
                    </div>
                    <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 md:p-8 w-full md:w-[320px] flex flex-col justify-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">{t('ent.zalo_webhook')}</label>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 mb-4 group cursor-pointer hover:border-blue-400 transition-colors" onClick={copyWebhook}>
                            <code className="text-[10px] font-mono text-slate-600 flex-1 truncate">{config.zalo.webhookUrl}</code>
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-400 group-hover:text-blue-500 shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-500 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <span className="font-bold text-blue-600 block mb-1">{t('common.tips')}:</span> {t('ent.zalo_tips')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">{t('ent.zalo_guide')}</p>
                    <button onClick={handleConnect} disabled={connecting} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 mx-auto">
                        {connecting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} {t('ent.zalo_connect_btn')}
                    </button>
                </div>
            )}
        </div>
    );
});

const FacebookPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [connecting, setConnecting] = useState(false);
    const [pageUrl, setPageUrl] = useState('');

    const handleConnect = async () => {
        if (!pageUrl) {
            notify(t('ent.facebook_empty_url') || 'Please enter a Facebook Page URL', 'error');
            return;
        }
        setConnecting(true);
        try { 
            await db.connectFacebookPage(pageUrl); 
            notify(t('ent.facebook_success'), 'success'); 
            setPageUrl('');
            onRefresh(); 
        } 
        catch (e: any) { notify(e.message, 'error'); } 
        finally { setConnecting(false); }
    };

    const handleDisconnect = async (id: string) => {
        try { await db.disconnectFacebookPage(id); notify(t('common.success'), 'success'); onRefresh(); } 
        catch (e: any) { notify(e.message, 'error'); }
    };

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader title={t('ent.facebook_title')} subtitle={t('ent.facebook_subtitle')} />
            
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                        className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" 
                        placeholder="https://facebook.com/your-page-name" 
                        value={pageUrl} 
                        onChange={e => setPageUrl(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleConnect()} 
                    />
                    <button onClick={handleConnect} disabled={connecting} className="px-6 py-3 sm:py-0 bg-[#1877F2] text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                        {connecting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} {t('ent.facebook_connect_btn')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.facebookPages?.map(page => (
                    <div key={page.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shrink-0">F</div>
                            <div className="min-w-0">
                                <div className="font-bold text-slate-800 text-sm truncate">{page.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">ID: {page.id}</div>
                            </div>
                        </div>
                        <button onClick={() => handleDisconnect(page.id)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                ))}
                {(!config.facebookPages || config.facebookPages.length === 0) && <div className="col-span-full text-center py-10 text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">{t('ent.facebook_empty')}</div>}
            </div>
        </div>
    );
});

const EmailPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [form, setForm] = useState(config.email);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try { await db.saveEmailConfig(form); notify(t('common.success'), 'success'); onRefresh(); } 
        catch (e: any) { notify(e.message, 'error'); } 
        finally { setSaving(false); }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try { await db.testSmtpConnection(); notify('SMTP connection successful!', 'success'); }
        catch (e: any) { notify(e.message || 'SMTP connection failed', 'error'); }
        finally { setTesting(false); }
    };

    const handleSendTestEmail = async () => {
        setSendingTest(true);
        try { await db.sendTestEmail(); notify('Test email sent!', 'success'); }
        catch (e: any) { notify(e.message || 'Failed to send test email', 'error'); }
        finally { setSendingTest(false); }
    };

    return (
        <div className="animate-enter max-w-2xl">
            <SectionHeader title={t('ent.email_title')} subtitle={t('ent.email_subtitle')} action={
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${form.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>{form.enabled ? t('common.active') : t('common.disabled')}</span>
                    <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} className="toggle accent-emerald-500 w-5 h-5 cursor-pointer" />
                </div>
            } />
            <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 transition-opacity ${!form.enabled ? 'opacity-50' : 'opacity-100'}`}>
                <div className={!form.enabled ? 'pointer-events-none' : ''}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.email_host')}</label><input className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.host} onChange={e => setForm({...form, host: e.target.value.trim()})} placeholder="smtp.example.com" /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.email_port')}</label><input type="number" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value)})} placeholder="587" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.email_user')}</label><input className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.user} onChange={e => setForm({...form, user: e.target.value.trim()})} placeholder="user@example.com" /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.email_pass')}</label><input type="password" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} placeholder={CONSTANTS.MASK} /></div>
                    </div>
                </div>
                <div className="pt-2 flex flex-col gap-3">
                    <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-70 shadow-lg shadow-indigo-500/20">{saving ? t('auth.processing') : t('ent.email_save')}</button>
                    {form.enabled && (
                        <div className="flex gap-3">
                            <button onClick={handleTestConnection} disabled={testing || !form.host} className="flex-1 py-2.5 border-2 border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                                {testing && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>}
                                {testing ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button onClick={handleSendTestEmail} disabled={sendingTest || !form.host} className="flex-1 py-2.5 border-2 border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                                {sendingTest && <div className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>}
                                {sendingTest ? 'Sending...' : 'Send Test Email'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const SSOPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [sso, setSso] = useState(config.sso);
    const [saving, setSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    const handleSave = async () => {
        if (!sso.issuerUrl || !sso.clientId) { notify(t('ent.sso_save_error'), 'error'); return; }
        setSaving(true);
        try {
            await db.saveSSOConfig(sso);
            notify(t('common.success'), 'success');
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="animate-enter max-w-3xl">
            <SectionHeader title={t('ent.sso_title')} subtitle={t('ent.sso_subtitle')} action={
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${sso.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>{sso.enabled ? t('common.active') : t('common.disabled')}</span>
                    <input type="checkbox" checked={sso.enabled} onChange={e => setSso({...sso, enabled: e.target.checked})} className="toggle accent-emerald-500 w-5 h-5 cursor-pointer" />
                </div>
            } />
            <div className={`bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm space-y-6 transition-opacity ${!sso.enabled ? 'opacity-50' : 'opacity-100'}`}>
                <div className={!sso.enabled ? 'pointer-events-none' : ''}>
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.sso_issuer')}</label>
                        <input placeholder="https://dev-123.okta.com" className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.issuerUrl || ''} onChange={e => setSso({...sso, issuerUrl: e.target.value.trim()})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.sso_client_id')}</label>
                            <input className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.clientId || ''} onChange={e => setSso({...sso, clientId: e.target.value.trim()})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('ent.sso_client_secret')}</label>
                            <div className="relative">
                                <input type={showSecret ? "text" : "password"} className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.clientSecret || ''} onChange={e => setSso({...sso, clientSecret: e.target.value})} placeholder={CONSTANTS.MASK} />
                                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-3 text-[10px] font-bold text-indigo-600 hover:underline">{showSecret ? t('ent.sso_hide') : t('ent.sso_show')}</button>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold uppercase shrink-0">{t('ent.redirect_uri')}</span>
                        <code className="text-[10px] md:text-xs font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 break-all">{CONSTANTS.MOCK_REDIRECT_URI}</code>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-70 shadow-lg">{saving ? t('auth.processing') : t('ent.sso_save')}</button>
            </div>
        </div>
    );
});

const DomainPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [newDomain, setNewDomain] = useState('');
    const [verifying, setVerifying] = useState<string | null>(null);

    const handleAdd = async () => {
        const domain = newDomain.trim();
        if (!domain.includes('.') || domain.length < 4) { notify(t('ent.domain_invalid'), 'error'); return; }
        try { await db.addDomain(domain); setNewDomain(''); onRefresh(); notify(t('common.success'), 'success'); }
        catch (e: any) { notify(e.message, 'error'); }
    };

    const handleVerify = async (domain: string) => {
        setVerifying(domain);
        try { await db.verifyDomain(domain); notify(t('ent.domain_verified_success'), 'success'); onRefresh(); }
        catch (e: any) { notify(e.message, 'error'); }
        finally { setVerifying(null); }
    };

    const handleRemove = async (domain: string) => {
        try { await db.removeDomain(domain); onRefresh(); } catch (e: any) { notify(e.message, 'error'); }
    };

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader title={t('ent.domain_title')} subtitle={t('ent.domain_subtitle')} />
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder={t('ent.domain_placeholder')} value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    <button onClick={handleAdd} className="px-6 py-3 sm:py-0 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors">{t('ent.domain_add')}</button>
                </div>
            </div>
            <div className="space-y-4">
                {config.domains?.map(d => (
                    <div key={d.domain} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm group">
                        <div className="flex justify-between items-start mb-4 gap-4">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-slate-800 break-all">{d.domain}</h3>
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1 border ${d.verified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.verified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    {d.verified ? t('ent.domain_verified') : t('ent.domain_pending')}
                                </div>
                            </div>
                            <button onClick={() => handleRemove(d.domain)} className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        {!d.verified && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t('ent.domain_dns_config')}</div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white p-2 rounded border border-slate-200 text-slate-600 gap-3">
                                    <span className="font-mono break-all px-1">TXT @ {d.verificationTxtRecord}</span>
                                    <button onClick={() => handleVerify(d.domain)} disabled={verifying === d.domain} className="text-indigo-600 font-bold hover:underline sm:ml-4 disabled:opacity-50 whitespace-nowrap self-end sm:self-auto">{verifying === d.domain ? t('ent.domain_checking') : t('ent.domain_verify')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {(!config.domains || config.domains.length === 0) && <div className="text-center text-slate-400 italic py-10">{t('ent.domain_empty')}</div>}
            </div>
        </div>
    );
});

const AuditPanel = memo(() => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t, formatDateTime } = useTranslation();
    
    useEffect(() => {
        db.getAuditLogs()
            .then(data => { setLogs(data || []); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, []);

    if (loading) return <div className="p-10 text-center animate-pulse">{t('common.loading')}</div>;
    if (error) return <div className="p-10 text-center text-rose-500">{error}</div>;

    return (
        <div className="animate-enter">
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-xs min-w-[600px]">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_time')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_actor')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_action')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_details')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs?.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-400 font-mono whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                                    <td className="p-4 font-bold text-slate-700 whitespace-nowrap">{log.actorId}</td>
                                    <td className="p-4 whitespace-nowrap"><span className="px-2 py-1 bg-slate-100 rounded border border-slate-200 font-bold text-slate-600">{log.action}</span></td>
                                    <td className="p-4 text-slate-600 max-w-[200px] truncate" title={log.details}>{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const EnterpriseSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('ZALO');
    const [config, setConfig] = useState<EnterpriseConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), CONSTANTS.TOAST_DURATION);
    }, []);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const me = await db.getCurrentUser();
            setCurrentUser(me);
            
            if (me?.role !== UserRole.ADMIN) {
                setLoading(false);
                return;
            }

            const data = await db.getEnterpriseConfig();
            setConfig(data);
        } catch (e) {
            console.error("Failed to load config", e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, t]);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    if (!loading && currentUser && currentUser.role !== UserRole.ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">{t('common.access_denied') || "Access Denied"}</h2>
                <p className="text-slate-500 max-w-md">
                    {t('ent.no_permission') || "You do not have permission to view this page. Only administrators can manage enterprise settings."}
                </p>
            </div>
        );
    }

    if (loading || !config) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    const TABS = [
        { id: 'ZALO', label: t('ent.tab_zalo') },
        { id: 'FACEBOOK', label: t('ent.tab_social') },
        { id: 'EMAIL', label: t('ent.tab_email') },
        { id: 'SSO', label: t('ent.tab_sso') },
        { id: 'DOMAINS', label: t('ent.tab_domain') },
        { id: 'AUDIT', label: t('ent.tab_audit') },
    ];

    const handleTabWheel = (e: React.WheelEvent) => {
        if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
    };

    return (
        <div className="space-y-6 pb-20 relative animate-enter">
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${
                    toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'
                }`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm gap-4 w-full overflow-hidden">
                <div className="shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">{t('ent.title')}</h2>
                    <p className="text-sm text-slate-500 mt-1">{t('ent.subtitle')}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500">{t('ent.tenant_label')}:</span>
                        <span className="font-mono font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">{config.tenantId}</span>
                    </div>
                </div>
                
                {/* Mobile Dropdown */}
                <div className="w-full lg:hidden">
                    <Dropdown 
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as string)}
                        options={TABS.map(tab => ({ value: tab.id, label: tab.label }))}
                        className="w-full"
                    />
                </div>

                {/* Desktop Tabs */}
                <div className="hidden lg:flex w-full lg:w-auto lg:max-w-3xl bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar min-w-0" onWheel={handleTabWheel}>
                    {TABS.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'ZALO' && <ZaloPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'FACEBOOK' && <FacebookPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'EMAIL' && <EmailPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'SSO' && <SSOPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'DOMAINS' && <DomainPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'AUDIT' && <AuditPanel />}
            </div>
        </div>
    );
};
