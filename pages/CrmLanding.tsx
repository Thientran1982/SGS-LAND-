import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { SeoHead } from '../components/SeoHead';
import { useTranslation } from '../services/i18n';
import { ArrowLeft, Check, Rocket, BrainCircuit, Zap, BarChart3 } from 'lucide-react';
import { db } from '../services/dbApi';
import { User } from '../types';

// SGS LAND brand tokens — consistent with Landing.tsx
const GOLD       = '#C9A84C';
const GOLD_DARK  = '#B8860B';
const NAVY       = '#1C2B4A';
const WHITE      = '#FFFFFF';
const CREAM      = '#F9F8F5';
const BORDER     = '#E5E3DF';
const TEXT1      = '#1A2332';
const TEXT2      = '#6B7280';

const ICONS = {
    BACK:       <ArrowLeft className="w-5 h-5" />,
    CHECK:      <Check className="w-5 h-5" strokeWidth={3} style={{ color: GOLD }} />,
    CHECK_LIGHT:<Check className="w-5 h-5" strokeWidth={3} style={{ color: GOLD }} />,
    ROCKET:     <Rocket className="w-6 h-6" style={{ color: WHITE }} />,
    AI_BRAIN:   <BrainCircuit className="w-6 h-6" style={{ color: GOLD }} />,
    AUTOMATION: <Zap className="w-6 h-6" style={{ color: GOLD_DARK }} />,
    REPORT:     <BarChart3 className="w-6 h-6" style={{ color: NAVY }} />,
};

const SCREENSHOT_URL = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop";

export const CrmLanding: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);
    const handleHome  = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    return (
        <div className="min-h-screen font-sans antialiased pb-20 overflow-y-auto h-[100dvh] no-scrollbar"
            style={{ background: WHITE, color: TEXT1 }}>
            <SeoHead
                title="CRM Bất Động Sản AI | Quản Lý Sàn Giao Dịch - SGS LAND"
                description="CRM BĐS tích hợp AI cho sàn giao dịch & môi giới: phân loại lead tự động, đa kênh Zalo/Facebook/Email, dashboard realtime, từ 990K/tháng. Dùng thử miễn phí 14 ngày."
                canonicalPath="/crm-platform"
                structuredData={[
                    {
                        '@type': 'SoftwareApplication',
                        name: 'SGS LAND CRM Bất Động Sản',
                        applicationCategory: 'BusinessApplication',
                        applicationSubCategory: 'CRM',
                        operatingSystem: 'Web, iOS, Android',
                        description: 'Phần mềm CRM chuyên ngành bất động sản tích hợp AI: phân loại lead tự động, đa kênh, AI assistant, kho hàng realtime.',
                        offers: [
                            { '@type': 'Offer', name: 'Starter', price: '990000', priceCurrency: 'VND', priceSpecification: { '@type': 'UnitPriceSpecification', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } } },
                            { '@type': 'Offer', name: 'Pro', price: '2990000', priceCurrency: 'VND', priceSpecification: { '@type': 'UnitPriceSpecification', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } } },
                        ],
                        aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '247', bestRating: '5', worstRating: '1' },
                        review: [
                            { '@type': 'Review', author: { '@type': 'Person', name: 'Trịnh Quang Hùng' }, datePublished: '2026-03-18', reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' }, reviewBody: 'CRM BĐS tốt nhất tôi từng dùng. Kết nối Zalo OA và Facebook Lead Ads tự động. Quản lý 300+ lead/tháng dễ dàng.' },
                            { '@type': 'Review', author: { '@type': 'Person', name: 'Lương Thị Thu' }, datePublished: '2026-02-10', reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' }, reviewBody: 'AI phân loại lead theo nhu cầu mua/thuê/đầu tư giúp team ưu tiên đúng khách. Tỷ lệ chuyển đổi tăng 35% sau 2 tháng.' },
                            { '@type': 'Review', author: { '@type': 'Person', name: 'Bùi Văn Đức' }, datePublished: '2026-01-22', reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' }, reviewBody: 'Dashboard realtime giúp quản lý sàn nắm tình trạng từng giao dịch. Hỗ trợ tiếng Việt hoàn toàn, giá hợp lý.' },
                        ],
                        provider: { '@type': 'Organization', name: 'SGS LAND', url: 'https://sgsland.vn' },
                    },
                    {
                        '@type': 'FAQPage',
                        mainEntity: [
                            { '@type': 'Question', name: 'CRM SGS LAND có gì khác biệt với CRM thông thường?', acceptedAnswer: { '@type': 'Answer', text: 'CRM SGS LAND chuyên dụng cho ngành BĐS Việt Nam: tích hợp AI phân loại lead theo phân khúc, kênh, ngân sách; kết nối Zalo OA/Facebook/Email tự động; bảng giá dự án realtime; pháp lý kiểm duyệt 2 lớp.' } },
                            { '@type': 'Question', name: 'Có dùng thử miễn phí không?', acceptedAnswer: { '@type': 'Answer', text: 'Có, dùng thử đầy đủ tính năng 14 ngày, không cần thẻ tín dụng. Đăng ký tại sgsland.vn/crm-platform.' } },
                            { '@type': 'Question', name: 'Giá cụ thể bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Gói Starter 990.000 VND/tháng (5 user, 1.000 lead), gói Pro 2.990.000 VND/tháng (20 user, không giới hạn lead, AI advanced).' } },
                        ],
                    },
                ]}
            />

            {/* ── Header ── */}
            <div className="sticky top-0 z-50 border-b"
                style={{ background: WHITE, borderColor: BORDER }}>
                <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome}
                        className="flex items-center gap-1.5 text-sm font-medium transition-colors min-h-[44px] shrink-0"
                        style={{ color: TEXT2 }}
                        onMouseEnter={e => (e.currentTarget.style.color = TEXT1)}
                        onMouseLeave={e => (e.currentTarget.style.color = TEXT2)}>
                        {ICONS.BACK}
                        <span className="hidden sm:inline">{t('common.go_back')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-[17px] h-[17px] shrink-0" stroke={NAVY} />
                        <span className="font-bold text-[15px] tracking-tight hidden sm:inline" style={{ color: NAVY }}>SGS CRM</span>
                    </div>
                    <button onClick={handleLogin}
                        className="px-5 py-2 font-bold rounded-xl transition-opacity hover:opacity-90 text-sm min-h-[44px] shrink-0"
                        style={{ background: GOLD, color: WHITE }}>
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* ── Hero ── */}
            <section className="pt-20 pb-24 px-5 text-center max-w-4xl mx-auto animate-enter">
                {/* Badge */}
                <span className="inline-block py-1.5 px-4 rounded-full text-[11px] font-bold uppercase tracking-widest mb-8"
                    style={{ background: '#FDF6E3', border: '1px solid #E8D4A0', color: GOLD_DARK }}>
                    {t('crm.hero_badge')}
                </span>
                <h1 className="font-bold leading-tight mb-6 tracking-tight"
                    style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: TEXT1 }}>
                    {t('crm.hero_title')} <br />
                    <span style={{ color: GOLD }}>{t('crm.hero_title_highlight')}</span>
                </h1>
                <p className="text-base mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: TEXT2 }}>
                    {t('crm.hero_desc')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={handleLogin}
                        className="px-8 py-3.5 font-bold rounded-xl text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{ background: GOLD, color: WHITE, boxShadow: '0 4px 20px rgba(201,168,76,0.30)' }}>
                        {ICONS.ROCKET} {currentUser ? t('menu.dashboard') : t('crm.free_trial')}
                    </button>
                    <button onClick={() => window.location.hash = `#/${ROUTES.CONTACT}`}
                        className="px-8 py-3.5 font-bold rounded-xl text-base border transition-colors"
                        style={{ background: WHITE, color: TEXT1, borderColor: BORDER }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                        {t('crm.view_demo')}
                    </button>
                </div>
            </section>

            {/* ── Mock UI screenshot ── */}
            <section className="px-5 sm:px-8 mb-20 max-w-7xl mx-auto">
                <div className="rounded-2xl overflow-hidden border relative group"
                    style={{ borderColor: BORDER, boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
                    <div className="absolute top-0 left-0 right-0 h-10 border-b flex items-center px-4 gap-2"
                        style={{ background: CREAM, borderColor: BORDER }}>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-rose-400" />
                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                        </div>
                    </div>
                    <img src={SCREENSHOT_URL} alt="Dashboard UI"
                        className="w-full mt-10 object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                </div>
            </section>

            {/* ── Features ── */}
            <section className="py-20 border-y" style={{ background: CREAM, borderColor: BORDER }}>
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <div className="text-center mb-12">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: GOLD }}>
                            Tính Năng Nổi Bật
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight" style={{ color: TEXT1 }}>
                            CRM chuyên ngành BĐS
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: '#FDF6E3', border: '1px solid #E8D4A0' }}>
                                {ICONS.AI_BRAIN}
                            </div>
                            <h3 className="font-semibold text-base" style={{ color: TEXT1 }}>{t('crm.feat1_title')}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>{t('crm.feat1_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: '#FDF6E3', border: '1px solid #E8D4A0' }}>
                                {ICONS.AUTOMATION}
                            </div>
                            <h3 className="font-semibold text-base" style={{ color: TEXT1 }}>{t('crm.feat2_title')}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>{t('crm.feat2_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: '#FDF6E3', border: '1px solid #E8D4A0' }}>
                                {ICONS.REPORT}
                            </div>
                            <h3 className="font-semibold text-base" style={{ color: TEXT1 }}>{t('crm.feat3_title')}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>{t('crm.feat3_desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Pricing ── */}
            <section className="py-20 px-5 max-w-4xl mx-auto text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: GOLD }}>
                    Bảng Giá
                </p>
                <h2 className="text-3xl font-bold mb-12 tracking-tight" style={{ color: TEXT1 }}>
                    {t('crm.pricing_title')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    {/* Starter */}
                    <div className="p-8 rounded-2xl border transition-shadow hover:shadow-lg"
                        style={{ background: WHITE, borderColor: BORDER }}>
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: TEXT2 }}>
                            {t('crm.plan_basic')}
                        </h3>
                        <div className="text-4xl font-bold mb-6" style={{ color: TEXT1 }}>
                            {t('crm.plan_basic_price')}
                            <span className="text-base font-medium ml-1" style={{ color: TEXT2 }}>{t('crm.plan_basic_period')}</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            {[t('crm.plan_basic_f1'), t('crm.plan_basic_f2'), t('crm.plan_basic_f3')].map((f, i) => (
                                <li key={i} className="flex gap-3 text-sm" style={{ color: TEXT1 }}>
                                    <span className="mt-0.5 shrink-0">{ICONS.CHECK}</span>{f}
                                </li>
                            ))}
                        </ul>
                        <button onClick={handleLogin}
                            className="w-full py-3 rounded-xl font-semibold text-sm border transition-colors"
                            style={{ background: WHITE, color: TEXT1, borderColor: BORDER }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                            {currentUser ? t('menu.dashboard') : t('crm.plan_basic_cta')}
                        </button>
                    </div>

                    {/* Pro — brand navy dark card */}
                    <div className="p-8 rounded-2xl relative overflow-hidden transition-transform hover:-translate-y-1"
                        style={{ background: NAVY, color: WHITE, boxShadow: '0 12px 40px rgba(28,43,74,0.25)' }}>
                        <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl"
                            style={{ background: GOLD, color: WHITE }}>
                            {t('crm.plan_pro_badge')}
                        </div>
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: GOLD }}>
                            {t('crm.plan_pro')}
                        </h3>
                        <div className="text-4xl font-bold text-white mb-6">
                            {t('crm.plan_pro_price')}
                            <span className="text-base font-medium ml-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('crm.plan_pro_period')}</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            {[t('crm.plan_pro_f1'), t('crm.plan_pro_f2'), t('crm.plan_pro_f3')].map((f, i) => (
                                <li key={i} className="flex gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                    <span className="mt-0.5 shrink-0">{ICONS.CHECK_LIGHT}</span>{f}
                                </li>
                            ))}
                        </ul>
                        <button onClick={handleLogin}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
                            style={{ background: GOLD, color: WHITE }}>
                            {currentUser ? t('menu.dashboard') : t('crm.plan_pro_cta')}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};
