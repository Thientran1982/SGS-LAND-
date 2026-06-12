import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { SeoHead } from '../components/SeoHead';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
const ASSETS = {
    OFFICE: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop",
    CEO: "https://ui-avatars.com/api/?name=Tran+Minh+Tuan&background=0D8ABC&color=fff&size=512",
    CTO: "https://ui-avatars.com/api/?name=Nguyen+Hoang+Nam&background=10B981&color=fff&size=512",
    COO: "https://ui-avatars.com/api/?name=Le+Thi+Hoa&background=F59E0B&color=fff&size=512"
};
const ICONS = {
    MISSION: <svg className="w-8 h-8 text-sgs-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    VISION: <svg className="w-8 h-8 text-sgs-verified" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    VALUES: <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
};
export const AboutUs: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);
    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const leaders = [
        { name: "Trần Minh Thiện", role: "Founder & CEO", img: ASSETS.CEO, bio: t('about.ceo_bio') },
        { name: "Nguyễn Hoàng Nam", role: "CTO", img: ASSETS.CTO, bio: t('about.cto_bio') },
        { name: "Lê Thị Hoa", role: "COO", img: ASSETS.COO, bio: t('about.coo_bio') }
    ];
    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            <SeoHead
                title="Về SGS LAND | Đội Ngũ & Sứ Mệnh Nền Tảng BĐS AI Việt Nam"
                description="SGS LAND thành lập 2024 tại TP.HCM, đội ngũ 50+ chuyên gia BĐS, công nghệ AI định giá sai số ±5%. Sứ mệnh: minh bạch hóa thị trường BĐS Việt qua dữ liệu và AI."
                canonicalPath="/about-us"
                structuredData={[
                    {
                        '@type': 'AboutPage',
                        name: 'Về SGS LAND',
                        description: 'Giới thiệu công ty, đội ngũ lãnh đạo và sứ mệnh của nền tảng bất động sản AI SGS LAND.',
                        inLanguage: 'vi-VN',
                        publisher: {
                            '@type': 'Organization',
                            name: 'SGS LAND',
                            legalName: 'Công ty Cổ phần SGS Land',
                            taxID: '0312960439',
                            url: 'https://sgsland.vn',
                            foundingDate: '2024',
                            founder: { '@type': 'Person', name: 'Trần Minh Thiện', jobTitle: 'Founder & CEO' },
                            numberOfEmployees: { '@type': 'QuantitativeValue', value: '200+' },
                            address: { '@type': 'PostalAddress', addressLocality: 'Hồ Chí Minh', addressCountry: 'VN' },
                            sameAs: [
                                'https://www.linkedin.com/company/sgsland',
                                'https://www.facebook.com/sgsland',
                            ],
                        },
                    },
                    {
                        '@type': 'Person',
                        '@id': 'https://sgsland.vn/about-us#tran-minh-thien',
                        name: 'Trần Minh Thiện',
                        jobTitle: 'Founder & CEO',
                        description: '10+ năm phân phối BĐS sơ cấp TP.HCM – Đông Nam Bộ, đại lý F1 Novaland 2017, Vinhomes 2019, Masterise 2021.',
                        worksFor: { '@id': 'https://sgsland.vn/#organization' },
                        sameAs: ['https://www.linkedin.com/in/tran-minh-thien-sgsland'],
                        image: 'https://sgsland.vn/images/team/tran-minh-thien.jpg',
                    },
                    {
                        '@type': 'Person',
                        '@id': 'https://sgsland.vn/about-us#nguyen-hoang-nam',
                        name: 'Nguyễn Hoàng Nam',
                        jobTitle: 'CTO',
                        description: '10+ năm fintech & proptech, kiến trúc LangGraph CRM đa kênh.',
                        worksFor: { '@id': 'https://sgsland.vn/#organization' },
                    },
                    {
                        '@type': 'Person',
                        '@id': 'https://sgsland.vn/about-us#le-thi-hoa',
                        name: 'Lê Thị Hoa',
                        jobTitle: 'COO',
                        description: '15+ năm kinh nghiệm BĐS, chuyên vận hành phân phối dự án quy mô lớn.',
                        hasCredential: {
                            '@type': 'EducationalOccupationalCredential',
                            name: 'Chứng chỉ Môi giới Bất động sản',
                            credentialCategory: 'certificate',
                            recognizedBy: { '@type': 'Organization', name: 'Bộ Xây Dựng Việt Nam' },
                        },
                        worksFor: { '@id': 'https://sgsland.vn/#organization' },
                    },
                    {
                        '@type': 'FAQPage',
                        mainEntity: [
                            { '@type': 'Question', name: 'Ai là người sáng lập SGS LAND?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND được sáng lập năm 2024 bởi ông Trần Minh Thiện (Founder & CEO), cùng ông Nguyễn Hoàng Nam (CTO) và bà Lê Thị Hoa (COO). Đội ngũ sáng lập có hơn 5 năm kinh nghiệm phân phối bất động sản tại TP.HCM và miền Đông Nam Bộ.' } },
                            { '@type': 'Question', name: 'Pháp nhân và mã số thuế của SGS LAND là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Pháp nhân: Công ty Cổ phần SGS Land, mã số thuế 0312960439, trụ sở tại TP. Hồ Chí Minh, Việt Nam. Đăng ký kinh doanh hợp pháp với 4 ngành cốt lõi: tư vấn bất động sản, phân phối dự án, công nghệ phần mềm và đào tạo môi giới.' } },
                            { '@type': 'Question', name: 'SGS LAND quy mô bao nhiêu nhân sự và môi giới?', acceptedAnswer: { '@type': 'Answer', text: '200+ nhân sự nội bộ tại trụ sở TP.HCM, mạng lưới 15.000+ môi giới hợp tác trên toàn quốc. Quản lý 45.000+ sản phẩm BĐS và xử lý hơn 2 tỷ USD tổng giá trị giao dịch tích lũy đến 04/2026.' } },
                            { '@type': 'Question', name: 'SGS LAND là đại lý phân phối chính thức của những chủ đầu tư nào?', acceptedAnswer: { '@type': 'Answer', text: 'Đại lý phân phối uỷ quyền chính thức của Novaland (Aqua City), Vinhomes (Grand Park, Cần Giờ), Masterise Homes (The Global City, Lumière), Nam Long (Izumi City), Sơn Kim Land và Đại Quang Minh (Sala Thủ Thiêm). Tất cả đều có hợp đồng phân phối uỷ quyền chính chủ.' } },
                            { '@type': 'Question', name: 'Tầm nhìn và sứ mệnh của SGS LAND là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Sứ mệnh: minh bạch hóa thị trường bất động sản Việt Nam thông qua dữ liệu và AI. Tầm nhìn: trở thành hệ điều hành bất động sản số 1 Đông Nam Á vào 2030. Giá trị cốt lõi: minh bạch, độc lập với chủ đầu tư, kiểm duyệt 2 lớp, ưu tiên người mua thật.' } },
                        ],
                    },
                ]}
            />
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-sgs-primary transition-colors min-h-[44px] shrink-0">
                        {ICONS.BACK} <span className="hidden sm:inline">{t('about.home')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-sgs-primary shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">SGS LAND</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-sgs-primary-deep text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? t('about.dashboard') : t('about.login')}
                    </button>
                </div>
            </div>
            {/* Hero */}
            <section className="relative py-24 bg-sgs-primary-deep text-white overflow-hidden">
                <div className="absolute inset-0 opacity-40">
                    <img src={ASSETS.OFFICE} className="w-full h-full object-cover" alt="Office" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-sgs-primary-deep via-slate-900/80 to-transparent"></div>
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center animate-enter">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-sgs-on-dark-muted text-xs font-bold uppercase tracking-widest mb-6">
                        {t('about.hero_badge')}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                        {t('about.hero_title')} <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">{t('about.hero_title_highlight')}</span>
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        {t('about.hero_desc')}
                    </p>
                </div>
            </section>
            {/* Mission & Vision */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 -mt-24 relative z-20">
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-sgs-champagne rounded-2xl flex items-center justify-center mb-6">{ICONS.MISSION}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.mission_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.mission_desc')}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-sgs-champagne rounded-2xl flex items-center justify-center mb-6">{ICONS.VISION}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.vision_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.vision_desc')}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.VALUES}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.values_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.values_desc')}</p>
                    </div>
                </div>
            </section>
            {/* Stats */}
            <section className="py-16 bg-[var(--bg-surface)] border-y border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div className="text-4xl font-black text-sgs-primary mb-2">5+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_years')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-sgs-verified mb-2">15k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_agents')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-sgs-accent-text mb-2">45k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_listings')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-rose-500 mb-2">$2B+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_txn')}</div>
                    </div>
                </div>
            </section>
            {/* Leadership */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">{t('about.team_title')}</h2>
                        <p className="text-[var(--text-tertiary)] max-w-2xl mx-auto">{t('about.team_desc')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {leaders.map((leader, i) => (
                            <div key={i} className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] text-center group hover:border-sgs-border transition-colors">
                                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-6 border-4 border-slate-50 shadow-lg group-hover:scale-105 transition-transform">
                                    <img src={leader.img} className="w-full h-full object-cover" alt={leader.name} />
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">{leader.name}</h3>
                                <div className="text-xs font-bold text-sgs-primary uppercase tracking-wider mb-4">{leader.role}</div>
                                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{leader.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            {/* Footer CTA */}
            <section className="py-24 bg-sgs-primary-deep text-center px-6">
                <h2 className="text-3xl font-bold text-white mb-6">{t('about.cta_title')}</h2>
                <button
                    onClick={() => {
                        if (currentUser) {
                            window.location.hash = `#/${ROUTES.DASHBOARD}`;
                        } else {
                            window.location.hash = `#/${ROUTES.CONTACT}`;
                        }
                    }}
                    className="px-8 py-4 bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                >
                    {currentUser ? t('about.cta_dashboard') : t('about.cta_contact')}
                </button>
            </section>
        </div>
    );
};