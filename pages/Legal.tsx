
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../services/i18n';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';

// -----------------------------------------------------------------------------
//  CONTENT DATA (Professional Legal Text)
// -----------------------------------------------------------------------------

const LEGAL_CONTENT = {
    vn: {
        privacy: [
            {
                heading: "1. Tổng Quan & Cam Kết",
                content: "SGS LAND ('Chúng tôi') cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của người dùng tuân thủ theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Chính sách này mô tả cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin của bạn khi sử dụng Hệ điều hành Bất động sản SGS LAND."
            },
            {
                heading: "2. Dữ Liệu Được Thu Thập",
                content: "Để vận hành các tính năng AI và CRM, chúng tôi thu thập:\n- Dữ liệu định danh: Tên, Số điện thoại, Email, CCCD (đối với môi giới xác thực).\n- Dữ liệu hành vi: Lịch sử tìm kiếm, tương tác tin đăng, và dữ liệu vị trí.\n- Dữ liệu tài chính: Lịch sử giao dịch, thông tin thanh toán (được mã hóa qua cổng thanh toán).\n- Dữ liệu thiết bị: IP, User-Agent, Cookies."
            },
            {
                heading: "3. Mục Đích Sử Dụng Dữ Liệu",
                content: "Dữ liệu của bạn được sử dụng để:\n- Cung cấp dịch vụ Định giá AI và khớp nối nhu cầu tự động.\n- Huấn luyện mô hình máy học (Machine Learning) nhằm cải thiện độ chính xác (Dữ liệu được ẩn danh).\n- Ngăn chặn gian lận và đảm bảo an toàn hệ thống.\n- Gửi thông báo quan trọng về tài khoản và giao dịch."
            },
            {
                heading: "4. Chia Sẻ Dữ Liệu",
                content: "Chúng tôi KHÔNG bán dữ liệu cá nhân. Dữ liệu chỉ được chia sẻ trong các trường hợp:\n- Có sự đồng ý rõ ràng của bạn (VD: Gửi thông tin liên hệ cho môi giới).\n- Theo yêu cầu của cơ quan nhà nước có thẩm quyền.\n- Với các đối tác cung cấp dịch vụ hạ tầng (Cloud, SMS, Email) dưới các cam kết bảo mật nghiêm ngặt."
            },
            {
                heading: "5. Quyền Của Người Dùng",
                content: "Bạn có quyền yêu cầu truy cập, chỉnh sửa, hoặc xóa dữ liệu cá nhân của mình khỏi hệ thống của chúng tôi bất kỳ lúc nào bằng cách liên hệ bộ phận DPO (Data Protection Officer) tại legal@sgsland.vn."
            }
        ],
        terms: [
            {
                heading: "1. Chấp Thuận Điều Khoản",
                content: "Bằng việc truy cập hoặc sử dụng SGS LAND, bạn đồng ý tuân thủ các Điều khoản dịch vụ này. Nếu bạn không đồng ý, vui lòng ngừng sử dụng dịch vụ ngay lập tức."
            },
            {
                heading: "2. Tuyên Bố Miễn Trừ Trách Nhiệm Về AI",
                content: "SGS LAND sử dụng Trí tuệ nhân tạo (AI) để cung cấp các ước tính giá, dự báo thị trường và tư vấn tự động.\n- Các kết quả từ AI (bao gồm AVM - Mô hình định giá tự động) chỉ mang tính chất THAM KHẢO.\n- Chúng tôi KHÔNG chịu trách nhiệm pháp lý cho bất kỳ quyết định đầu tư, mua bán nào dựa hoàn toàn vào các chỉ số này.\n- Người dùng cần tham vấn ý kiến chuyên gia pháp lý và thẩm định giá thực tế trước khi giao dịch."
            },
            {
                heading: "3. Tài Khoản & Bảo Mật",
                content: "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập. Mọi hoạt động diễn ra dưới tài khoản của bạn được coi là do bạn thực hiện. SGS LAND có quyền khóa tài khoản nếu phát hiện hành vi gian lận, spam, hoặc vi phạm tiêu chuẩn cộng đồng."
            },
            {
                heading: "4. Sở Hữu Trí Tuệ",
                content: "Toàn bộ giao diện, mã nguồn, thuật toán, dữ liệu thị trường và thương hiệu SGS LAND đều thuộc sở hữu độc quyền của SGS Land Corp. Nghiêm cấm sao chép, cào dữ liệu (scraping) hoặc sử dụng cho mục đích thương mại mà không có sự cho phép bằng văn bản."
            },
            {
                heading: "5. Luật Áp Dụng",
                content: "Các điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh sẽ được giải quyết tại Tòa án có thẩm quyền tại TP. Hồ Chí Minh."
            }
        ]
    },
    en: {
        privacy: [
            {
                heading: "1. Overview & Commitment",
                content: "SGS LAND ('We') are committed to protecting your privacy and personal data in compliance with Decree 13/2023/ND-CP on personal data protection. This policy outlines how we collect, use, store, and protect your information."
            },
            {
                heading: "2. Data Collected",
                content: "To operate AI and CRM features, we collect:\n- Identity Data: Name, Phone, Email, ID Card (for verified agents).\n- Behavioral Data: Search history, listing interactions, location data.\n- Financial Data: Transaction history, payment info (encrypted via payment gateways).\n- Device Data: IP, User-Agent, Cookies."
            },
            {
                heading: "3. Purpose of Data Use",
                content: "Your data is used to:\n- Provide AI Valuation and automated matching services.\n- Train Machine Learning models to improve accuracy (Data is anonymized).\n- Prevent fraud and ensure system security.\n- Send important account and transaction notifications."
            },
            {
                heading: "4. Data Sharing",
                content: "We do NOT sell personal data. Data is shared only when:\n- We have your explicit consent (e.g., sending contact info to an agent).\n- Required by competent state authorities.\n- With infrastructure partners (Cloud, SMS, Email) under strict non-disclosure agreements."
            },
            {
                heading: "5. User Rights",
                content: "You have the right to request access, correction, or deletion of your personal data from our system at any time by contacting our DPO (Data Protection Officer) at legal@sgsland.vn."
            }
        ],
        terms: [
            {
                heading: "1. Acceptance of Terms",
                content: "By accessing or using SGS LAND, you agree to comply with these Terms of Service. If you do not agree, please stop using the service immediately."
            },
            {
                heading: "2. AI Disclaimer",
                content: "SGS LAND uses Artificial Intelligence (AI) to provide price estimates, market forecasts, and automated advice.\n- AI results (including AVM - Automated Valuation Models) are for REFERENCE ONLY.\n- We are NOT liable for any investment or trading decisions based solely on these metrics.\n- Users should consult legal experts and actual appraisers before transacting."
            },
            {
                heading: "3. Account & Security",
                content: "You are responsible for maintaining the confidentiality of your login credentials. All activities under your account are deemed to be performed by you. SGS LAND reserves the right to suspend accounts involved in fraud, spam, or violation of community standards."
            },
            {
                heading: "4. Intellectual Property",
                content: "All interfaces, source code, algorithms, market data, and the SGS LAND brand are the exclusive property of SGS Land Corp. Copying, scraping data, or using it for commercial purposes without written permission is strictly prohibited."
            },
            {
                heading: "5. Governing Law",
                content: "These terms are governed by and construed in accordance with the laws of the Socialist Republic of Vietnam. Any disputes shall be resolved at the competent court in Ho Chi Minh City."
            }
        ]
    }
};

// -----------------------------------------------------------------------------
//  LAYOUT COMPONENT
// -----------------------------------------------------------------------------

const LegalLayout: React.FC<{ title: string; children: React.ReactNode; lastUpdated: string }> = ({ title, children, lastUpdated }) => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors min-h-[44px] shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="hidden sm:inline">{t('legal.back_home')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">{t('legal.header')}</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 animate-enter">
                <div className="text-center mb-16">
                    <h1 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">{title}</h1>
                    <p className="text-[var(--text-tertiary)] font-mono text-sm uppercase tracking-widest">{t('legal.last_updated')}: {lastUpdated}</p>
                </div>

                <div className="bg-[var(--bg-surface)] p-8 md:p-16 rounded-[32px] border border-[var(--glass-border)] shadow-sm">
                    <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline prose-li:text-[var(--text-secondary)]">
                        {children}
                    </div>
                </div>
                
                <div className="mt-8 text-center text-xs text-slate-400">
                    SGS Land Corp • Business Reg: 031xxxxxxx • TP. Ho Chi Minh, Vietnam
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
//  PAGES
// -----------------------------------------------------------------------------

export const PrivacyPolicy: React.FC = () => {
    const { t, language } = useTranslation();
    const content = language === 'vn' ? LEGAL_CONTENT.vn.privacy : LEGAL_CONTENT.en.privacy;

    return (
        <LegalLayout title={t('legal.privacy_title')} lastUpdated="01/01/2024">
            {content.map((section, idx) => (
                <div key={idx} className="mb-8">
                    <h3>{section.heading}</h3>
                    {section.content.split('\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                    ))}
                </div>
            ))}
        </LegalLayout>
    );
};

export const TermsOfService: React.FC = () => {
    const { t, language } = useTranslation();
    const content = language === 'vn' ? LEGAL_CONTENT.vn.terms : LEGAL_CONTENT.en.terms;

    return (
        <LegalLayout title={t('legal.terms_title')} lastUpdated="01/01/2024">
            {content.map((section, idx) => (
                <div key={idx} className="mb-8">
                    <h3>{section.heading}</h3>
                    {section.content.split('\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                    ))}
                </div>
            ))}
        </LegalLayout>
    );
};

export const CookieSettings: React.FC = () => {
    const { t } = useTranslation();
    const [prefs, setPref] = useState({ essential: true, analytics: true, marketing: false });
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <LegalLayout title={t('legal.cookies_title')} lastUpdated="01/01/2024">
            <p className="lead">{t('legal.cookie_desc')}</p>
            
            <div className="my-8 space-y-4 not-prose">
                <div className="bg-[var(--glass-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center opacity-70">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_essential')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_essential_desc')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-bold">{t('common.enabled')}</span>
                        <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_analytics')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_analytics_desc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={prefs.analytics} onChange={e => setPref({...prefs, analytics: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_marketing')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_marketing_desc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={prefs.marketing} onChange={e => setPref({...prefs, marketing: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            <button 
                onClick={handleSave} 
                className={`px-8 py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 ${saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-indigo-600'}`}
            >
                {saved ? t('legal.saved_changes') : t('legal.save_pref')}
            </button>

            <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                <h3 className="mb-4">{t('legal.cookie_about_title')}</h3>
                <p>{t('legal.cookie_about_desc')}</p>
            </div>
        </LegalLayout>
    );
};
