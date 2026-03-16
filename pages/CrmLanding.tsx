
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { ArrowLeft, Check, Rocket, BrainCircuit, Zap, BarChart3 } from 'lucide-react';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <ArrowLeft className="w-5 h-5" />,
    CHECK: <Check className="w-5 h-5 text-indigo-600" strokeWidth={3} />,
    ROCKET: <Rocket className="w-6 h-6 text-white" />,
    // Professional Icons to replace Emojis
    AI_BRAIN: <BrainCircuit className="w-6 h-6 text-indigo-600" />,
    AUTOMATION: <Zap className="w-6 h-6 text-emerald-600" />,
    REPORT: <BarChart3 className="w-6 h-6 text-rose-600" />
};

const SCREENSHOT_URL = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop";

export const CrmLanding: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    return (
        <div className="min-h-screen bg-[var(--bg-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/90 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} {t('common.go_back')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-8 h-8 text-indigo-600" />
                        <span className="font-bold text-xl tracking-tight">SGS CRM</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* Hero */}
            <section className="pt-24 pb-32 px-6 text-center max-w-5xl mx-auto animate-enter">
                <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-8">
                    Dành cho Doanh Nghiệp BĐS
                </span>
                <h1 className="text-5xl md:text-7xl font-black text-[var(--text-primary)] mb-8 leading-tight tracking-tight">
                    Tăng Tốc Doanh Số <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Với CRM Tự Động Hóa</span>
                </h1>
                <p className="text-xl text-[var(--text-tertiary)] mb-12 max-w-3xl mx-auto leading-relaxed">
                    Hệ thống quản lý khách hàng toàn diện, tích hợp tổng đài, email marketing và AI Chatbot. Giúp đội ngũ sale của bạn chốt đơn nhanh hơn 30%.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={handleLogin} className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl text-lg shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-transform hover:-translate-y-1 flex items-center justify-center gap-2">
                        {ICONS.ROCKET} {currentUser ? t('menu.dashboard') : 'Dùng Thử Miễn Phí'}
                    </button>
                    <button className="px-8 py-4 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--glass-border)] font-bold rounded-2xl text-lg hover:bg-[var(--glass-surface)] transition-colors">
                        Xem Demo
                    </button>
                </div>
            </section>

            {/* Mock UI */}
            <section className="px-4 md:px-6 mb-24 max-w-[1440px] mx-auto">
                <div className="rounded-[32px] overflow-hidden shadow-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] relative group">
                    <div className="absolute top-0 left-0 right-0 h-12 bg-[var(--bg-surface)] border-b border-[var(--glass-border)] flex items-center px-4 gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                        </div>
                        <div className="ml-4 w-64 h-6 bg-[var(--glass-surface-hover)] rounded-lg"></div>
                    </div>
                    <img src={SCREENSHOT_URL} alt="Dashboard UI" className="w-full mt-12 object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-[var(--glass-surface)] border-y border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                {ICONS.AI_BRAIN}
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Phân Hạng Khách Hàng AI</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed text-sm">
                                Tự động chấm điểm tiềm năng khách hàng dựa trên 50+ điểm dữ liệu hành vi. Giúp đội ngũ Sales tập trung vào 20% khách hàng có khả năng chốt đơn cao nhất.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
                                {ICONS.AUTOMATION}
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Chuỗi Tự Động Hóa</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed text-sm">
                                Thiết lập quy trình chăm sóc đa kênh (Omnichannel) tự động. Từ SMS, Zalo đến Email marketing, đảm bảo không bỏ lỡ bất kỳ điểm chạm nào.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100 shadow-sm">
                                {ICONS.REPORT}
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Báo Cáo Thời Gian Thực</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed text-sm">
                                Hệ thống Business Intelligence (BI) cập nhật theo thời gian thực. Theo dõi sát sao hiệu suất Sales và tỷ lệ chuyển đổi phễu trên một dashboard duy nhất.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Simple */}
            <section className="py-24 px-6 max-w-4xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-12">Bảng Giá Đơn Giản</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] border border-[var(--glass-border)] shadow-sm hover:shadow-xl transition-all">
                        <h3 className="text-lg font-bold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Cơ Bản</h3>
                        <div className="text-4xl font-black text-[var(--text-primary)] mb-6">499k <span className="text-lg font-medium text-slate-400">/ tháng</span></div>
                        <ul className="space-y-3 mb-8">
                            <li className="flex gap-3 text-[var(--text-secondary)]"><span className="text-emerald-500">{ICONS.CHECK}</span> 5 Tài khoản nhân viên</li>
                            <li className="flex gap-3 text-[var(--text-secondary)]"><span className="text-emerald-500">{ICONS.CHECK}</span> 2,000 Khách hàng</li>
                            <li className="flex gap-3 text-[var(--text-secondary)]"><span className="text-emerald-500">{ICONS.CHECK}</span> Email Marketing cơ bản</li>
                        </ul>
                        <button onClick={handleLogin} className="w-full py-3 bg-[var(--glass-surface-hover)] hover:bg-slate-200 text-[var(--text-primary)] font-bold rounded-xl transition-colors">{currentUser ? t('menu.dashboard') : 'Đăng Ký Ngay'}</button>
                    </div>
                    <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl relative overflow-hidden transform hover:-translate-y-2 transition-all">
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs2 font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Phổ Biến</div>
                        <h3 className="text-lg font-bold text-indigo-300 uppercase tracking-wide mb-2">Doanh Nghiệp</h3>
                        <div className="text-4xl font-black text-white mb-6">1,999k <span className="text-lg font-medium text-[var(--text-tertiary)]">/ tháng</span></div>
                        <ul className="space-y-3 mb-8">
                            <li className="flex gap-3 text-slate-300"><span className="text-emerald-400">{ICONS.CHECK}</span> 20 Tài khoản nhân viên</li>
                            <li className="flex gap-3 text-slate-300"><span className="text-emerald-400">{ICONS.CHECK}</span> Không giới hạn khách hàng</li>
                            <li className="flex gap-3 text-slate-300"><span className="text-emerald-400">{ICONS.CHECK}</span> AI Lead Scoring & Automation</li>
                        </ul>
                        <button onClick={handleLogin} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg">{currentUser ? t('menu.dashboard') : 'Dùng Thử Miễn Phí'}</button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default CrmLanding;
