
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { copyToClipboard } from '../utils/clipboard';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    COPY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    CHECK: <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
};

const CodeBlock = ({ code, language = 'bash' }: { code: string, language?: string }) => {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = async () => {
        await copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-[#1e1e1e] rounded-xl overflow-hidden border border-white/10 my-4 shadow-lg group">
            <div className="flex justify-between items-center px-4 py-2 bg-[var(--bg-surface)]/5 border-b border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase">{language}</span>
                <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                    {copied ? ICONS.CHECK : ICONS.COPY}
                    {copied ? t('api.copied') : t('api.copy')}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-blue-100 leading-relaxed no-scrollbar">
                <code>{code}</code>
            </pre>
        </div>
    );
};

export const ApiDocs: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const [activeSection, setActiveSection] = useState('intro');

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] h-[100dvh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)] shrink-0">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} {t('common.go_back')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">SGS API</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex max-w-[1440px] mx-auto w-full">
                {/* Sidebar */}
                <div className="w-64 border-r border-[var(--glass-border)] bg-[var(--bg-surface)] hidden md:block overflow-y-auto py-8 px-6 no-scrollbar">
                    <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4">Mục Lục</h3>
                    <ul className="space-y-1">
                        {['intro', 'auth', 'endpoints', 'errors'].map(sec => (
                            <li key={sec}>
                                <button 
                                    onClick={() => setActiveSection(sec)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === sec ? 'bg-indigo-50 text-indigo-700' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface)]'}`}
                                >
                                    {t(`api.${sec}`)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 scroll-smooth no-scrollbar">
                    <div className="max-w-3xl">
                        <div className="mb-12">
                            <h1 className="text-4xl font-black text-[var(--text-primary)] mb-4">{t('api.title')}</h1>
                            <p className="text-lg text-[var(--text-tertiary)] leading-relaxed">{t('api.subtitle')}</p>
                        </div>

                        <section id="auth" className="mb-16">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('api.auth')}</h2>
                            <p className="text-[var(--text-secondary)] mb-4">SGS Land API sử dụng API key để xác thực yêu cầu. Bạn có thể xem và quản lý key trong phần Cài đặt Doanh nghiệp.</p>
                            <CodeBlock code={`Authorization: Bearer sgs_live_...`} language="http" />
                        </section>

                        <section id="endpoints" className="mb-16">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Endpoint Khách Hàng</h2>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs font-mono">GET</span>
                                <code className="text-sm font-mono text-[var(--text-secondary)]">/v1/leads</code>
                            </div>
                            <p className="text-[var(--text-secondary)] mb-4">Trả về danh sách khách hàng tiềm năng liên kết với tài khoản của bạn.</p>
                            
                            <CodeBlock code={`curl https://api.sgs.vn/v1/leads \\
  -H "Authorization: Bearer sgs_live_..." \\
  -H "Content-Type: application/json"`} />

                            <h3 className="font-bold text-[var(--text-primary)] mt-6 mb-2">Phản hồi mẫu</h3>
                            <CodeBlock code={`{
  "data": [
    {
      "id": "lead_123",
      "name": "Nguyen Van A",
      "status": "NEW",
      "score": 85
    }
  ],
  "meta": {
    "total": 1,
    "page": 1
  }
}`} language="json" />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};
