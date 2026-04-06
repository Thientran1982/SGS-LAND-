
import React, { useState, useEffect, useRef } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    DASHBOARD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    LEADS: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    AI: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
    INVENTORY: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    INBOX: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    CONTRACT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    SEQUENCE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    REPORT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    TASK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    KNOWLEDGE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    SETTING: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
    ARROW_RIGHT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    QUICKSTART: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    TIP: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    WARNING: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    MENU: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

type SectionId =
    | 'quickstart'
    | 'dashboard'
    | 'leads'
    | 'ai-valuation'
    | 'inventory'
    | 'inbox'
    | 'contracts'
    | 'sequences'
    | 'reports'
    | 'tasks'
    | 'knowledge'
    | 'settings';

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'quickstart',   label: 'Bắt đầu nhanh',        icon: ICONS.QUICKSTART, color: 'emerald' },
    { id: 'dashboard',    label: 'Tổng quan Dashboard',   icon: ICONS.DASHBOARD,  color: 'blue'    },
    { id: 'leads',        label: 'Quản lý Lead & CRM',    icon: ICONS.LEADS,      color: 'violet'  },
    { id: 'ai-valuation', label: 'Định giá AI (AVM)',     icon: ICONS.AI,         color: 'cyan'    },
    { id: 'inventory',    label: 'Kho hàng BĐS',          icon: ICONS.INVENTORY,  color: 'amber'   },
    { id: 'inbox',        label: 'Hộp thư đa kênh',       icon: ICONS.INBOX,      color: 'pink'    },
    { id: 'contracts',    label: 'Hợp đồng & Đề xuất',   icon: ICONS.CONTRACT,   color: 'orange'  },
    { id: 'sequences',    label: 'Chiến dịch tự động',    icon: ICONS.SEQUENCE,   color: 'rose'    },
    { id: 'reports',      label: 'Báo cáo & Phân tích',   icon: ICONS.REPORT,     color: 'teal'    },
    { id: 'tasks',        label: 'Quản lý Công việc',     icon: ICONS.TASK,       color: 'indigo'  },
    { id: 'knowledge',    label: 'Cơ sở Tri thức',        icon: ICONS.KNOWLEDGE,  color: 'lime'    },
    { id: 'settings',     label: 'Cài đặt & Hồ sơ',      icon: ICONS.SETTING,    color: 'slate'   },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'       },
    violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'       },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30'   },
    pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30'       },
    orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30'       },
    teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30'       },
    indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    lime:    { bg: 'bg-lime-500/10',    border: 'border-lime-500/30',    text: 'text-lime-400',    badge: 'bg-lime-500/20 text-lime-300 border-lime-500/30'       },
    slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   text: 'text-slate-400',   badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30'   },
};

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mt-5">
            <span className="text-emerald-400 mt-0.5 shrink-0">{ICONS.TIP}</span>
            <p className="text-sm text-slate-300 leading-relaxed">{children}</p>
        </div>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mt-5">
            <span className="text-amber-400 mt-0.5 shrink-0">{ICONS.WARNING}</span>
            <p className="text-sm text-slate-300 leading-relaxed">{children}</p>
        </div>
    );
}

function StepList({ steps }: { steps: { title: string; desc: string }[] }) {
    return (
        <ol className="space-y-4 mt-5">
            {steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div>
                        <p className="font-semibold text-white text-sm">{s.title}</p>
                        <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function FeatureGrid({ items }: { items: { icon: string; title: string; desc: string }[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {items.map((it, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="text-2xl shrink-0">{it.icon}</span>
                    <div>
                        <p className="font-semibold text-white text-sm">{it.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{it.desc}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function SectionHeader({ id, color, icon, label, badge }: { id: string; color: string; icon: React.ReactNode; label: string; badge?: string }) {
    const c = COLOR_MAP[color];
    return (
        <div className="flex items-start gap-4 mb-6">
            <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0 ${c.text}`}>
                {icon}
            </div>
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white">{label}</h2>
                    {badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{badge}</span>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Nhấn mục trên thanh bên để điều hướng nhanh</p>
            </div>
        </div>
    );
}

const SECTIONS: Record<SectionId, React.ReactNode> = {
    'quickstart': (
        <section id="quickstart">
            <SectionHeader id="quickstart" color="emerald" icon={ICONS.QUICKSTART} label="Bắt đầu nhanh — 5 bước đầu tiên" badge="Mới dùng" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Chào mừng bạn đến với <strong className="text-white">SGS LAND</strong> — nền tảng CRM & quản lý bất động sản thế hệ mới tích hợp AI. Hướng dẫn này sẽ giúp bạn nắm vững toàn bộ tính năng trong thời gian ngắn nhất.
            </p>
            <StepList steps={[
                { title: 'Tạo tài khoản & xác minh email', desc: 'Vào trang Đăng ký, điền họ tên, email công ty và mật khẩu. Kiểm tra hộp thư và nhấn đường link xác minh trong vòng 30 phút. Sau khi xác minh, tài khoản được kích hoạt ngay.' },
                { title: 'Hoàn thiện hồ sơ cá nhân', desc: 'Vào Hồ sơ → cập nhật ảnh đại diện, số điện thoại, chức vụ và chi nhánh làm việc. Thông tin đầy đủ giúp lead nhận diện môi giới nhanh hơn qua các kênh omnichannel.' },
                { title: 'Nhập lead đầu tiên vào hệ thống', desc: 'Vào Quản lý Lead → nhấn "+ Thêm Lead" → điền tên, số điện thoại, nhu cầu và nguồn lead. Hệ thống AI tự động chấm điểm lead (0–100) dựa trên 12 tiêu chí.' },
                { title: 'Thêm bất động sản vào kho hàng', desc: 'Vào Kho hàng → nhấn "+ Đăng BĐS" → chọn loại, nhập địa chỉ, diện tích, giá. Sử dụng tính năng Định giá AI để tham chiếu giá thị trường trước khi đăng.' },
                { title: 'Kết nối kênh Zalo / Facebook Messenger', desc: 'Vào Cài đặt → Kênh liên lạc → kết nối Zalo OA hoặc Facebook Page. Sau đó toàn bộ tin nhắn từ khách hàng sẽ tập trung vào Hộp thư đa kênh.' },
            ]} />
            <div className="mt-8 p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Điều hướng nhanh sau khi thiết lập</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                        ['/#/dashboard', '📊 Dashboard'],
                        ['/#/leads', '👥 Quản lý Lead'],
                        ['/#/ai-valuation', '🤖 Định giá AI'],
                        ['/#/inventory', '🏠 Kho hàng'],
                        ['/#/inbox', '💬 Hộp thư'],
                        ['/#/reports', '📈 Báo cáo'],
                    ].map(([href, label]) => (
                        <a key={href} href={href} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all">
                            <span>{label}</span>
                        </a>
                    ))}
                </div>
            </div>
            <Tip>Hoàn thành 5 bước trên trong vòng 15 phút — sau đó hệ thống AI sẽ bắt đầu gợi ý hành động dựa trên dữ liệu thực của bạn.</Tip>
        </section>
    ),

    'dashboard': (
        <section id="dashboard">
            <SectionHeader id="dashboard" color="blue" icon={ICONS.DASHBOARD} label="Tổng quan Dashboard" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Dashboard là màn hình trung tâm, hiển thị toàn bộ chỉ số kinh doanh theo thời gian thực. Mọi thay đổi từ lead, hợp đồng, inbox đều phản ánh ngay lập tức qua WebSocket.
            </p>
            <FeatureGrid items={[
                { icon: '📊', title: 'KPI Tổng quan', desc: 'Tổng lead, lead mới hôm nay, tỷ lệ chuyển đổi, doanh số tháng, hoa hồng dự kiến — cập nhật real-time.' },
                { icon: '🔥', title: 'Pipeline Funnel', desc: 'Biểu đồ pipeline theo 6 giai đoạn: Mới → Liên hệ → Tư vấn → Xem nhà → Đàm phán → Chốt. Kéo thả trực tiếp.' },
                { icon: '📅', title: 'Hoạt động hôm nay', desc: 'Danh sách cuộc hẹn, follow-up đến hạn, lead chưa phản hồi quá 24 giờ — cảnh báo ưu tiên cao.' },
                { icon: '🤖', title: 'Gợi ý AI', desc: 'AI phân tích điểm lead và đề xuất hành động tiếp theo: "Gọi điện cho Nguyễn Văn A", "Gửi báo giá cho Trần Thị B".' },
                { icon: '📰', title: 'Tin tức thị trường', desc: 'Tin tức BĐS mới nhất từ các nguồn uy tín (CafeF, BatDongSan.com.vn), lọc theo khu vực bạn theo dõi.' },
                { icon: '👥', title: 'Bảng xếp hạng nhóm', desc: 'So sánh hiệu suất theo team, chi nhánh — hiển thị ai đang dẫn đầu trong tuần/tháng.' },
            ]} />
            <Note>Dashboard hiển thị dữ liệu tương ứng với quyền truy cập. Admin thấy toàn công ty; nhân viên chỉ thấy dữ liệu của mình và team.</Note>
        </section>
    ),

    'leads': (
        <section id="leads">
            <SectionHeader id="leads" color="violet" icon={ICONS.LEADS} label="Quản lý Lead & CRM Pipeline" badge="Tính năng cốt lõi" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Module Lead là trái tim của SGS LAND CRM — nơi quản lý toàn bộ vòng đời khách hàng từ khi tiếp nhận đến khi chốt hợp đồng.
            </p>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Pipeline 6 giai đoạn</h3>
            <div className="flex flex-wrap gap-2">
                {['🆕 Mới', '📞 Liên hệ', '💡 Tư vấn', '🏠 Xem nhà', '🤝 Đàm phán', '✅ Đã chốt'].map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                        {s}
                        {i < 5 && <span className="text-slate-600 ml-1">→</span>}
                    </div>
                ))}
            </div>
            <FeatureGrid items={[
                { icon: '🎯', title: 'Chấm điểm AI (Lead Scoring)', desc: '12 tiêu chí: hành vi, ngân sách, khu vực mong muốn, thời gian phản hồi… AI chấm 0–100 điểm, tự động xếp loại Hot/Warm/Cold.' },
                { icon: '🔄', title: 'Tự động phân công (Auto-assign)', desc: 'Cài Routing Rules → lead mới tự động phân về đúng nhân viên theo khu vực, loại BĐS, ngân sách, vòng xoay công bằng.' },
                { icon: '📋', title: 'Lịch sử tương tác đầy đủ', desc: 'Mọi cuộc gọi, tin nhắn Zalo, email, comment đều ghi lại vào timeline lead. Không bỏ sót bất kỳ thông tin nào.' },
                { icon: '🏷️', title: 'Tag & lọc nâng cao', desc: 'Gắn tag tùy chỉnh, lọc theo 20+ tiêu chí: nguồn lead, khu vực, ngân sách, điểm AI, ngày tạo, nhân viên phụ trách.' },
                { icon: '📎', title: 'Đính kèm tài liệu', desc: 'Upload CCCD, sao kê ngân hàng, yêu cầu khách hàng trực tiếp vào hồ sơ lead. Mã hóa AES-256.' },
                { icon: '📊', title: 'Báo cáo lead chi tiết', desc: 'Tỷ lệ chuyển đổi theo từng giai đoạn, nguồn lead hiệu quả nhất, thời gian trung bình chốt deal.' },
            ]} />
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Thêm lead mới</h3>
            <StepList steps={[
                { title: 'Nhấn "+ Thêm Lead"', desc: 'Góc phải trên trang Lead. Hoặc nhập nhanh từ Hộp thư khi nhận tin nhắn mới từ khách.' },
                { title: 'Điền thông tin cơ bản', desc: 'Họ tên (bắt buộc), số điện thoại, email, nguồn (Zalo/Facebook/Giới thiệu/Sàn giao dịch…).' },
                { title: 'Khai báo nhu cầu', desc: 'Loại BĐS muốn mua/thuê, khu vực ưu tiên, ngân sách, thời gian cần BĐS.' },
                { title: 'Hệ thống tự động chấm điểm', desc: 'AI phân tích và trả điểm trong 2–5 giây. Bạn có thể điều chỉnh thủ công nếu cần.' },
            ]} />
            <Tip>Lead có điểm từ 70 trở lên được đánh dấu 🔥 Hot — ưu tiên liên hệ trong 2 giờ đầu để tối đa tỷ lệ chuyển đổi.</Tip>
        </section>
    ),

    'ai-valuation': (
        <section id="ai-valuation">
            <SectionHeader id="ai-valuation" color="cyan" icon={ICONS.AI} label="Định giá AI (AVM — Automated Valuation Model)" badge="Sai số ±5–12%" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Công cụ định giá bất động sản bằng AI tích hợp Google Gemini + 7 hệ số AVM chuyên ngành. Độ chính xác tỷ lệ thuận với lượng thông tin cung cấp.
            </p>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">3 bước định giá</h3>
            <StepList steps={[
                { title: 'Bước 1 — Nhập địa chỉ', desc: 'Nhập đầy đủ: số nhà + tên đường + phường/xã + quận/huyện + tỉnh/thành phố. Địa chỉ càng chi tiết, AI phân tích càng chính xác.' },
                { title: 'Bước 2 — Nhập thông số BĐS', desc: 'Diện tích (m²), loại BĐS (căn hộ/nhà phố/biệt thự/đất nền/kho xưởng), số tầng, hướng, mặt tiền, pháp lý (Sổ Hồng/Sổ Đỏ), nội thất, năm xây dựng.' },
                { title: 'Bước 3 — Xem kết quả định giá', desc: 'AI trả về: giá ước tính trung vị, khoảng dao động (thấp–cao), giá/m², hệ số điều chỉnh, phân tích vị trí, nguồn dữ liệu tham chiếu.' },
            ]} />
            <h3 className="text-sm font-bold text-white mt-6 mb-3">7 hệ số AVM điều chỉnh</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {[
                    ['Ksl — Hệ số vị trí đường', 'Đường lớn/nhỏ, mặt tiền, hẻm'],
                    ['Kdir — Hướng phong thủy', 'Đông Nam, Nam, Bắc...'],
                    ['Kmf — Mặt tiền', 'Chiều rộng mặt tiền thực tế'],
                    ['Klegal — Pháp lý', 'Sổ Hồng > Hợp đồng > Chờ'],
                    ['Kfurn — Nội thất', 'Cao cấp > Đầy đủ > Cơ bản'],
                    ['Kfloor — Tầng (căn hộ)', 'Tầng trung/cao > tầng thấp'],
                    ['Kage — Tuổi công trình', 'Mới xây > cũ nhiều năm'],
                ].map(([name, desc]) => (
                    <div key={name} className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
                        <span className="font-mono text-cyan-400 text-xs font-bold shrink-0 mt-0.5">{name}</span>
                        <span className="text-slate-400 text-xs">{desc}</span>
                    </div>
                ))}
            </div>
            <Tip>Khách hàng chưa đăng nhập được 1 lượt định giá miễn phí/ngày. Đăng ký tài khoản để định giá không giới hạn và lưu lịch sử.</Tip>
            <Note>Kết quả AVM là tham chiếu — không thay thế thẩm định pháp lý chính thức từ tổ chức thẩm định giá có chứng chỉ.</Note>
        </section>
    ),

    'inventory': (
        <section id="inventory">
            <SectionHeader id="inventory" color="amber" icon={ICONS.INVENTORY} label="Kho hàng Bất động sản" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Quản lý toàn bộ danh mục BĐS của môi giới và công ty — từ nhà phố, căn hộ đến đất nền, kho xưởng. Đồng bộ tự động lên trang Marketplace công khai.
            </p>
            <FeatureGrid items={[
                { icon: '🏠', title: 'Đa loại BĐS', desc: 'Căn hộ, nhà phố, biệt thự, đất nền, kho xưởng, shophouse, penthouse, nhà phố thương mại.' },
                { icon: '📸', title: 'Quản lý ảnh & media', desc: 'Upload tối đa 50 ảnh/BĐS, video tour 360°, sắp xếp thứ tự ảnh, watermark thương hiệu tự động.' },
                { icon: '🔍', title: 'Tìm kiếm & lọc', desc: 'Lọc theo loại, khu vực, giá, diện tích, tình trạng (đang bán/cho thuê/đã giao), nhân viên phụ trách.' },
                { icon: '🤖', title: 'Gợi ý khớp lead', desc: 'AI tự động gợi ý BĐS phù hợp với từng lead dựa trên tiêu chí tìm kiếm, ngân sách và khu vực ưu tiên.' },
                { icon: '📊', title: 'Thống kê lượt xem', desc: 'Theo dõi lượt xem từng BĐS trên Marketplace, số lần yêu thích, số lần yêu cầu xem nhà.' },
                { icon: '🔗', title: 'Chia sẻ nhanh', desc: 'Tạo link chia sẻ BĐS cá nhân hóa (kèm logo môi giới), đăng thẳng lên Zalo, Facebook chỉ 1 click.' },
            ]} />
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Trạng thái BĐS</h3>
            <div className="flex flex-wrap gap-2 mt-2">
                {[
                    { label: 'Đang bán', color: 'emerald' },
                    { label: 'Đang cho thuê', color: 'blue' },
                    { label: 'Chờ duyệt', color: 'amber' },
                    { label: 'Đã bán', color: 'slate' },
                    { label: 'Tạm dừng', color: 'orange' },
                ].map(({ label, color }) => (
                    <span key={label} className={`px-3 py-1 rounded-full text-xs font-semibold border ${COLOR_MAP[color].badge}`}>{label}</span>
                ))}
            </div>
        </section>
    ),

    'inbox': (
        <section id="inbox">
            <SectionHeader id="inbox" color="pink" icon={ICONS.INBOX} label="Hộp thư đa kênh (Omnichannel Inbox)" badge="Zalo · Facebook · Email" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Tập trung tất cả tin nhắn từ Zalo OA, Facebook Messenger, và email vào một hộp thư duy nhất. Không bỏ sót khách hàng dù đến từ kênh nào.
            </p>
            <FeatureGrid items={[
                { icon: '💬', title: 'Hợp nhất 3 kênh', desc: 'Zalo OA, Facebook Messenger, Email — tất cả hiển thị trong cùng 1 giao diện. Trả lời đúng kênh chỉ bằng 1 cửa sổ.' },
                { icon: '⚡', title: 'Trả lời nhanh AI', desc: 'AI gợi ý câu trả lời phù hợp dựa trên lịch sử chat, thông tin BĐS liên quan và kịch bản sales đã cài.' },
                { icon: '👤', title: 'Gắn vào lead tự động', desc: 'Tin nhắn từ số điện thoại/email đã có trong hệ thống tự động gắn vào hồ sơ lead tương ứng.' },
                { icon: '📋', title: 'Template tin nhắn', desc: 'Tạo sẵn kho template (giới thiệu BĐS, lịch xem nhà, xác nhận đặt cọc…) — chèn vào chat 1 click.' },
                { icon: '🔔', title: 'Thông báo real-time', desc: 'Nhận thông báo trình duyệt ngay khi có tin nhắn mới. Hiển thị badge đếm tin chưa đọc trên icon inbox.' },
                { icon: '🏷️', title: 'Phân loại & ưu tiên', desc: 'Gắn nhãn (Nóng/Cần theo dõi/Chờ tài liệu), lọc theo kênh, nhân viên, trạng thái xử lý.' },
            ]} />
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Kết nối kênh</h3>
            <StepList steps={[
                { title: 'Kết nối Zalo OA', desc: 'Vào Cài đặt → Kênh liên lạc → Zalo → Nhập Zalo OA ID và Access Token. Yêu cầu tài khoản Zalo Official Account đã được duyệt.' },
                { title: 'Kết nối Facebook Page', desc: 'Vào Cài đặt → Kênh liên lạc → Facebook → Đăng nhập Facebook Business và cấp quyền cho SGS LAND App.' },
                { title: 'Cài webhook', desc: 'Hệ thống tự động tạo webhook URL. Copy và dán vào cấu hình Zalo/Facebook Developer để bắt đầu nhận tin nhắn.' },
            ]} />
        </section>
    ),

    'contracts': (
        <section id="contracts">
            <SectionHeader id="contracts" color="orange" icon={ICONS.CONTRACT} label="Hợp đồng & Đề xuất" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Tạo, gửi và theo dõi hợp đồng môi giới, đề xuất tài chính và phiếu đặt cọc. Tất cả có link chia sẻ công khai cho khách hàng ký điện tử.
            </p>
            <FeatureGrid items={[
                { icon: '📄', title: 'Hợp đồng môi giới', desc: 'Tạo hợp đồng từ template, điền thông tin BĐS và khách hàng tự động, xuất PDF chuyên nghiệp.' },
                { icon: '💰', title: 'Đề xuất tài chính', desc: 'Trình bày phương án thanh toán, lịch trả góp ngân hàng, hoa hồng môi giới — dạng tài liệu đẹp gửi cho khách.' },
                { icon: '🔗', title: 'Link chia sẻ công khai', desc: 'Mỗi hợp đồng/đề xuất có URL riêng, khách hàng xem qua trình duyệt, không cần tài khoản.' },
                { icon: '✅', title: 'Luồng phê duyệt', desc: 'Hợp đồng cần qua duyệt cấp trên trước khi gửi khách. Theo dõi trạng thái: Nháp → Chờ duyệt → Đã duyệt → Đã gửi.' },
                { icon: '📊', title: 'Theo dõi trạng thái', desc: 'Biết khách đã mở link, đã đọc trang nào, đã ký hay chưa — thông báo ngay khi có hành động.' },
                { icon: '🗂️', title: 'Lưu trữ & tìm kiếm', desc: 'Toàn bộ hợp đồng lưu trên hệ thống, tìm kiếm theo tên khách/BĐS/ngày ký, xuất báo cáo Excel.' },
            ]} />
            <Note>Hoa hồng môi giới mặc định 2% giá trị BĐS — có thể điều chỉnh trong Cài đặt → Hoa hồng theo từng loại giao dịch.</Note>
        </section>
    ),

    'sequences': (
        <section id="sequences">
            <SectionHeader id="sequences" color="rose" icon={ICONS.SEQUENCE} label="Chiến dịch tự động (Sequences)" badge="Email · Zalo · Nhắc việc" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Tự động hóa quy trình chăm sóc khách hàng — gửi email, tin Zalo, và tạo nhắc việc theo lịch trình định sẵn mà không cần thao tác thủ công.
            </p>
            <FeatureGrid items={[
                { icon: '📧', title: 'Email tự động', desc: 'Gửi email chào mừng, giới thiệu BĐS mới, nhắc xem nhà, chúc mừng sinh nhật — theo trigger hoặc lịch trình.' },
                { icon: '📱', title: 'Tin Zalo OA tự động', desc: 'Gửi tin Zalo theo template ZNS (Zalo Notification Service) khi lead đổi trạng thái, hợp đồng sắp hết hạn.' },
                { icon: '⏰', title: 'Tạo nhắc việc tự động', desc: 'Tự tạo task "Gọi điện sau 3 ngày", "Gửi báo giá sau 1 tuần" cho nhân viên phụ trách lead.' },
                { icon: '🎯', title: 'Trigger đa điều kiện', desc: 'Kích hoạt khi lead được tạo, khi lead đổi giai đoạn, khi BĐS mới phù hợp nhu cầu, khi không phản hồi sau X ngày.' },
                { icon: '📊', title: 'Báo cáo hiệu quả', desc: 'Tỷ lệ mở email, tỷ lệ click, số lead phản hồi sau campaign — so sánh giữa các sequence.' },
                { icon: '⏸️', title: 'Tạm dừng thông minh', desc: 'Tự động dừng sequence khi khách đã phản hồi, tránh spam. Khởi động lại khi khách im lặng trở lại.' },
            ]} />
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Tạo sequence đầu tiên</h3>
            <StepList steps={[
                { title: 'Vào Sequences → "+ Tạo sequence mới"', desc: 'Đặt tên, chọn mục tiêu (Nuture lead mới / Tái kích hoạt lead nguội / Giới thiệu BĐS mới).' },
                { title: 'Cài trigger kích hoạt', desc: 'Chọn điều kiện để sequence chạy: "Lead mới được tạo" / "Lead đổi sang giai đoạn Tư vấn"...' },
                { title: 'Thêm các bước (Steps)', desc: 'Thêm email, tin Zalo, hoặc nhắc việc. Đặt khoảng thời gian giữa các bước (Ngay lập tức / Sau 1 ngày / Sau 3 ngày...).' },
                { title: 'Kích hoạt sequence', desc: 'Nhấn "Kích hoạt" — sequence sẽ tự động chạy với mọi lead thỏa điều kiện trigger từ thời điểm đó.' },
            ]} />
        </section>
    ),

    'reports': (
        <section id="reports">
            <SectionHeader id="reports" color="teal" icon={ICONS.REPORT} label="Báo cáo & Phân tích" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Bộ báo cáo toàn diện giúp nhà quản lý ra quyết định dựa trên dữ liệu thực — không phụ thuộc vào báo cáo thủ công từ nhân viên.
            </p>
            <FeatureGrid items={[
                { icon: '📈', title: 'Báo cáo doanh số', desc: 'Doanh số theo ngày/tuần/tháng/quý, so sánh kỳ trước, biểu đồ xu hướng, breakdown theo nhân viên và chi nhánh.' },
                { icon: '🎯', title: 'Báo cáo lead & conversion', desc: 'Tổng lead vào, tỷ lệ chuyển đổi từng giai đoạn pipeline, nguồn lead hiệu quả nhất, thời gian trung bình từ lead đến chốt.' },
                { icon: '👥', title: 'Hiệu suất nhân viên', desc: 'So sánh số lead, số cuộc hẹn, số chốt, hoa hồng giữa các nhân viên — bảng xếp hạng realtime.' },
                { icon: '🏠', title: 'Báo cáo kho hàng', desc: 'BĐS bán nhanh nhất, BĐS tồn kho lâu nhất, phân tích theo loại BĐS, khu vực, phân khúc giá.' },
                { icon: '📱', title: 'Báo cáo kênh liên lạc', desc: 'Tỷ lệ phản hồi theo kênh (Zalo vs Facebook vs Email), thời điểm khách hàng hoạt động nhiều nhất.' },
                { icon: '📊', title: 'Xuất Excel/PDF', desc: 'Xuất mọi báo cáo ra Excel hoặc PDF với 1 click. Lên lịch gửi báo cáo tự động qua email hàng tuần.' },
            ]} />
            <Tip>Đặt lịch gửi báo cáo tự động trong Cài đặt → Báo cáo → để nhận báo cáo tổng hợp vào sáng thứ Hai mỗi tuần.</Tip>
        </section>
    ),

    'tasks': (
        <section id="tasks">
            <SectionHeader id="tasks" color="indigo" icon={ICONS.TASK} label="Quản lý Công việc (Task Management)" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Hệ thống quản lý công việc tích hợp Kanban Board, phân công nhiệm vụ, theo dõi tiến độ và báo cáo hiệu suất đội nhóm.
            </p>
            <FeatureGrid items={[
                { icon: '📋', title: 'Kanban Board', desc: 'Kéo thả task qua các cột: Việc cần làm → Đang xử lý → Chờ phản hồi → Hoàn thành. Cập nhật real-time qua WebSocket.' },
                { icon: '👤', title: 'Phân công nhân viên', desc: 'Giao task cho cá nhân hoặc cả nhóm, đặt deadline, mức độ ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp).' },
                { icon: '🔗', title: 'Gắn vào Lead/BĐS', desc: 'Task "Gọi điện cho khách A" gắn trực tiếp vào hồ sơ lead, "Chụp ảnh BĐS" gắn vào kho hàng.' },
                { icon: '📅', title: 'Nhắc nhở tự động', desc: 'Cảnh báo task sắp đến hạn qua thông báo trình duyệt và email 30 phút, 1 giờ, 1 ngày trước.' },
                { icon: '💬', title: 'Bình luận & phản hồi', desc: 'Để lại comment, đính kèm ảnh/tài liệu vào task, tag đồng nghiệp bằng @mention.' },
                { icon: '📊', title: 'Báo cáo hiệu suất', desc: 'Số task hoàn thành đúng hạn vs trễ hạn, workload theo nhân viên, bottleneck trong team.' },
            ]} />
        </section>
    ),

    'knowledge': (
        <section id="knowledge">
            <SectionHeader id="knowledge" color="lime" icon={ICONS.KNOWLEDGE} label="Cơ sở Tri thức (Knowledge Base)" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Thư viện nội bộ lưu trữ quy trình bán hàng, kịch bản xử lý từ chối, thông tin dự án, pháp lý — AI sử dụng kho tri thức này để trả lời câu hỏi tự động.
            </p>
            <FeatureGrid items={[
                { icon: '📚', title: 'Bài viết & Quy trình', desc: 'Viết và lưu quy trình bán hàng, kịch bản tư vấn, hướng dẫn pháp lý — format rich text với tiêu đề, hình ảnh, bảng biểu.' },
                { icon: '🤖', title: 'AI truy xuất tự động', desc: 'Khi có câu hỏi phức tạp từ khách hàng trên Inbox, AI tìm và trả lời dựa trên nội dung trong Knowledge Base.' },
                { icon: '🏷️', title: 'Phân loại theo danh mục', desc: 'Phân loại: Pháp lý BĐS / Thông tin dự án / Quy trình nội bộ / Chính sách công ty / FAQ khách hàng.' },
                { icon: '🔍', title: 'Tìm kiếm toàn văn', desc: 'Tìm kiếm ngay kết quả trong toàn bộ nội dung — hỗ trợ tiếng Việt có dấu và không dấu.' },
                { icon: '🔒', title: 'Phân quyền nội dung', desc: 'Bài viết có thể đặt chế độ: Public (mọi nhân viên thấy) / Private (chỉ Admin) / Team (chỉ nhóm cụ thể).' },
                { icon: '📊', title: 'Thống kê truy cập', desc: 'Bài viết nào được xem nhiều nhất, nhân viên nào sử dụng nhiều, tỷ lệ AI trả lời đúng từ knowledge.' },
            ]} />
            <Tip>Càng thêm nhiều bài viết chất lượng vào Knowledge Base, AI trả lời tự động trong Inbox càng chính xác. Nên upload ngay kịch bản xử lý từ chối và FAQ phổ biến.</Tip>
        </section>
    ),

    'settings': (
        <section id="settings">
            <SectionHeader id="settings" color="slate" icon={ICONS.SETTING} label="Cài đặt & Hồ sơ" />
            <p className="text-slate-400 text-sm leading-relaxed">
                Tùy chỉnh tài khoản cá nhân, cấu hình hệ thống, phân quyền nhân viên và thiết lập tích hợp bên thứ ba.
            </p>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Hồ sơ cá nhân</h3>
            <div className="space-y-2">
                {[
                    'Ảnh đại diện, họ tên hiển thị, số điện thoại công việc',
                    'Chữ ký email cá nhân (HTML đầy đủ)',
                    'Múi giờ và ngôn ngữ giao diện (Tiếng Việt / English)',
                    'Thay đổi mật khẩu và bật xác thực 2 bước (2FA)',
                    'Quản lý thiết bị đang đăng nhập và phiên làm việc',
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-slate-400">
                        <span className="text-emerald-500 shrink-0">{ICONS.CHECK}</span>
                        {item}
                    </div>
                ))}
            </div>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">Cài đặt dành cho Admin</h3>
            <FeatureGrid items={[
                { icon: '👥', title: 'Quản lý nhân viên', desc: 'Thêm/xóa nhân viên, phân quyền (Admin/Manager/Agent), đặt quota lead hàng tháng.' },
                { icon: '🌿', title: 'Cấu hình chi nhánh', desc: 'Tạo và quản lý nhiều chi nhánh, phân công nhân viên theo chi nhánh, báo cáo tách biệt.' },
                { icon: '🎨', title: 'Thương hiệu doanh nghiệp', desc: 'Upload logo, đặt màu chủ đạo, tùy chỉnh tên miền hiển thị trên link chia sẻ và email.' },
                { icon: '💳', title: 'Gói dịch vụ & Thanh toán', desc: 'Xem gói hiện tại, nâng cấp lên Enterprise, lịch sử hóa đơn, thêm phương thức thanh toán.' },
                { icon: '🔐', title: 'Bảo mật & Tuân thủ', desc: 'Cài chính sách mật khẩu, xem nhật ký truy cập (Audit Log), xuất dữ liệu GDPR.' },
                { icon: '🔗', title: 'Tích hợp bên thứ ba', desc: 'Kết nối Zalo OA, Facebook Page, Brevo Email, webhook tùy chỉnh, API key cho developer.' },
            ]} />
            <Note>Thay đổi cài đặt phân quyền có hiệu lực ngay lập tức. Hành động xóa nhân viên sẽ chuyển lead của họ về Admin để tái phân công.</Note>
        </section>
    ),
};

export function UserGuide() {
    const [active, setActive] = useState<SectionId>('quickstart');
    const [mobileOpen, setMobileOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const nav = (id: SectionId) => {
        setActive(id);
        setMobileOpen(false);
        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const item = NAV_ITEMS.find(n => n.id === active)!;
    const c = COLOR_MAP[item.color];

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            {/* TOP BAR */}
            <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 md:px-6 h-14 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { window.location.hash = `#/${ROUTES.LANDING}`; }}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Quay lại"
                    >
                        {ICONS.BACK}
                    </button>
                    <div className="h-5 w-px bg-slate-700" />
                    <Logo size="sm" />
                    <div className="h-5 w-px bg-slate-700 hidden md:block" />
                    <span className="text-sm font-semibold text-slate-300 hidden md:block">Hướng dẫn sử dụng</span>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={`/#/${ROUTES.HELP_CENTER}`}
                        className="text-xs text-slate-400 hover:text-white transition-colors hidden md:block"
                    >
                        Trung tâm hỗ trợ →
                    </a>
                    <button
                        className="md:hidden text-slate-400 hover:text-white p-1.5"
                        onClick={() => setMobileOpen(o => !o)}
                    >
                        {mobileOpen ? ICONS.CLOSE : ICONS.MENU}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR — desktop */}
                <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-slate-800 overflow-y-auto py-4 px-3 gap-1 sticky top-14 h-[calc(100vh-3.5rem)]">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Nội dung</p>
                    {NAV_ITEMS.map(n => {
                        const isActive = active === n.id;
                        const nc = COLOR_MAP[n.color];
                        return (
                            <button
                                key={n.id}
                                onClick={() => nav(n.id)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left w-full ${
                                    isActive
                                        ? `${nc.bg} ${nc.text} border ${nc.border}`
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <span className={isActive ? nc.text : 'text-slate-500'}>{n.icon}</span>
                                {n.label}
                            </button>
                        );
                    })}

                    <div className="mt-auto pt-4 border-t border-slate-800 mx-2">
                        <a
                            href="mailto:info@sgsland.vn"
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            info@sgsland.vn
                        </a>
                        <p className="text-[10px] text-slate-700 mt-2">SGS LAND v2.0 · 2026</p>
                    </div>
                </aside>

                {/* SIDEBAR — mobile overlay */}
                {mobileOpen && (
                    <div className="md:hidden fixed inset-0 z-50 bg-black/70" onClick={() => setMobileOpen(false)}>
                        <div className="w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col py-4 px-3 gap-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Nội dung</p>
                            {NAV_ITEMS.map(n => {
                                const isActive = active === n.id;
                                const nc = COLOR_MAP[n.color];
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => nav(n.id)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left w-full ${
                                            isActive
                                                ? `${nc.bg} ${nc.text} border ${nc.border}`
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <span className={isActive ? nc.text : 'text-slate-500'}>{n.icon}</span>
                                        {n.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* MAIN CONTENT */}
                <main ref={contentRef} className="flex-1 overflow-y-auto">
                    {/* Hero bar */}
                    <div className={`border-b border-slate-800 px-6 md:px-10 py-5 ${c.bg} bg-opacity-30`}>
                        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className={c.text}>{item.icon}</span>
                                <div>
                                    <h1 className="text-base font-bold text-white">{item.label}</h1>
                                    <p className="text-[11px] text-slate-500">
                                        {NAV_ITEMS.findIndex(n => n.id === active) + 1} / {NAV_ITEMS.length} chủ đề
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {NAV_ITEMS.findIndex(n => n.id === active) > 0 && (
                                    <button
                                        onClick={() => nav(NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) - 1].id)}
                                        className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        Trước
                                    </button>
                                )}
                                {NAV_ITEMS.findIndex(n => n.id === active) < NAV_ITEMS.length - 1 && (
                                    <button
                                        onClick={() => nav(NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) + 1].id)}
                                        className="text-xs text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-1 font-medium"
                                    >
                                        Tiếp
                                        {ICONS.ARROW_RIGHT}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section body */}
                    <div className="px-6 md:px-10 py-8 max-w-3xl mx-auto">
                        {SECTIONS[active]}

                        {/* Bottom nav */}
                        <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-800">
                            {NAV_ITEMS.findIndex(n => n.id === active) > 0 ? (
                                <button
                                    onClick={() => nav(NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) - 1].id)}
                                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    {NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) - 1].label}
                                </button>
                            ) : <span />}
                            {NAV_ITEMS.findIndex(n => n.id === active) < NAV_ITEMS.length - 1 ? (
                                <button
                                    onClick={() => nav(NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) + 1].id)}
                                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                                >
                                    {NAV_ITEMS[NAV_ITEMS.findIndex(n => n.id === active) + 1].label}
                                    {ICONS.ARROW_RIGHT}
                                </button>
                            ) : (
                                <button
                                    onClick={() => { window.location.hash = `#/${ROUTES.DASHBOARD}`; }}
                                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                                >
                                    Bắt đầu sử dụng →
                                </button>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default UserGuide;
