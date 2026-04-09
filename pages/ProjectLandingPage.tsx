import React, { useState } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';

interface ProjectConfig {
    slug: string;
    name: string;
    developer: string;
    location: string;
    locationSlug: string;
    heroDescription: string;
    details: { label: string; value: string }[];
    amenities: { title: string; items: string[] }[];
    faqs: { q: string; a: string }[];
    relatedProjects: { name: string; slug: string }[];
    priceRange: string;
    projectType: string;
    scale: string;
}

const PROJECT_CONFIG: Record<string, ProjectConfig> = {
    'aqua-city': {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        developer: 'Novaland Group',
        location: 'Nhơn Trạch, Đồng Nai',
        locationSlug: 'bat-dong-san-dong-nai',
        heroDescription:
            'Aqua City là đại đô thị sinh thái quy mô 1.000ha do Novaland phát triển tại Nhơn Trạch, Đồng Nai. Với vị trí cách trung tâm TP.HCM chỉ 30 phút qua cầu Nhơn Trạch, Aqua City đang trở thành lựa chọn hàng đầu cho cư dân TP.HCM tìm kiếm không gian sống xanh, tiện nghi và đầu tư dài hạn. SGS LAND hỗ trợ tư vấn và giao dịch Aqua City chuyên nghiệp.',
        priceRange: 'Từ 3 tỷ — 50 tỷ đồng',
        projectType: 'Đại Đô Thị Sinh Thái',
        scale: '1.000 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Novaland Group' },
            { label: 'Quy mô', value: '1.000 ha' },
            { label: 'Vị trí', value: 'Nhơn Trạch, Đồng Nai' },
            { label: 'Khoảng cách TP.HCM', value: '~30 phút (cầu Nhơn Trạch)' },
            { label: 'Loại hình', value: 'Căn hộ, Nhà phố, Biệt thự, Shophouse' },
            { label: 'Mức giá tham khảo', value: 'Từ 3 tỷ — 50+ tỷ đồng' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng' },
            { label: 'Tiến độ', value: 'Đang bàn giao nhiều phân khu' },
        ],
        amenities: [
            {
                title: 'Tiện ích đẳng cấp',
                items: [
                    'Hơn 100.000m² mặt nước (sông, hồ, kênh)',
                    'Trung tâm thương mại Nova Mall',
                    'Bệnh viện đa khoa 500 giường',
                    'Trường học liên cấp quốc tế',
                    'Sân golf 18 lỗ ven sông',
                    'Marina & bến thuyền cao cấp',
                    'Chuỗi resort & spa 5 sao',
                    'Công viên chủ đề, khu vui chơi trẻ em',
                ],
            },
            {
                title: 'Kết nối hạ tầng',
                items: [
                    'Cầu Nhơn Trạch (đang hoàn thiện) — rút ngắn 15 phút vào TP.HCM',
                    'Cao tốc Bến Lức – Long Thành kết nối trực tiếp',
                    'Sân bay Long Thành chỉ 20 phút',
                    'Tuyến Metro số 1 kết nối về tương lai',
                    'Bến phà Bình Khánh — kết nối Cần Giờ, TP.HCM',
                ],
            },
        ],
        faqs: [
            {
                q: 'Aqua City Novaland có đáng mua không?',
                a: 'Aqua City là dự án đại đô thị sinh thái quy mô nhất của Novaland, với hơn 100.000m² mặt nước, tiện ích 5 sao và vị trí đắc địa kế cận TP.HCM. Sau giai đoạn tái cơ cấu của Novaland, dự án đã trở lại hoạt động bình thường với nhiều phân khu đang bàn giao. Đây là lựa chọn phù hợp cho người mua ở thực và đầu tư dài hạn.',
            },
            {
                q: 'Giá căn hộ Aqua City hiện nay là bao nhiêu?',
                a: 'Giá căn hộ Aqua City tham khảo: căn hộ 1-2 phòng ngủ từ 3-5 tỷ; nhà phố liền kề từ 6-12 tỷ; biệt thự đơn lập từ 15-50 tỷ. Giá thực tế phụ thuộc vào phân khu, tầng, view và thời điểm giao dịch. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.',
            },
            {
                q: 'Aqua City cách TP.HCM bao xa?',
                a: 'Aqua City tọa lạc tại Nhơn Trạch, Đồng Nai, cách trung tâm TP.HCM khoảng 35-40km. Khi cầu Nhơn Trạch hoàn thành và đưa vào sử dụng, thời gian di chuyển đến quận 2 (TP Thủ Đức) chỉ còn khoảng 20-25 phút. Hiện tại qua phà Bình Khánh mất khoảng 45-60 phút.',
            },
            {
                q: 'Pháp lý Aqua City có an toàn không?',
                a: 'Aqua City được cấp sổ hồng riêng (sổ đỏ) cho từng căn, đây là một điểm cộng lớn so với nhiều dự án khác. Sau giai đoạn tái cơ cấu tài chính, Novaland đã hoàn thành nghĩa vụ pháp lý và tiếp tục bàn giao nhiều phân khu. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí trước khi giao dịch.',
            },
            {
                q: 'Mua Aqua City để đầu tư hay ở thực tốt hơn?',
                a: 'Aqua City phù hợp cho cả hai mục đích. Để ở thực: hưởng trọn tiện ích 5 sao, không khí trong lành và không gian sống xanh vượt trội so với nội thành. Để đầu tư: tiềm năng tăng giá từ cầu Nhơn Trạch + sân bay Long Thành, sinh lời cho thuê từ cư dân và chuyên gia nước ngoài làm việc tại khu vực.',
            },
        ],
        relatedProjects: [
            { name: 'Dự Án Manhattan', slug: 'manhattan' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
    },
    'manhattan': {
        slug: 'manhattan',
        name: 'Dự Án Manhattan',
        developer: 'Becamex IDC & Đối Tác',
        location: 'Bình Dương',
        locationSlug: 'marketplace',
        heroDescription:
            'Dự án Manhattan Bình Dương là tổ hợp căn hộ cao cấp hướng đến tiêu chuẩn quốc tế tại trung tâm tỉnh lỵ Bình Dương — thủ phủ công nghiệp và kinh tế năng động nhất Đông Nam Bộ. Với thiết kế sang trọng, hạ tầng kỹ thuật đồng bộ và vị trí kết nối chiến lược, Manhattan là lựa chọn lý tưởng cho chuyên gia, nhà quản lý và nhà đầu tư.',
        priceRange: 'Từ 35 triệu/m²',
        projectType: 'Căn Hộ Cao Cấp',
        scale: 'Đang cập nhật',
        details: [
            { label: 'Chủ đầu tư', value: 'Becamex IDC & Đối Tác' },
            { label: 'Vị trí', value: 'Bình Dương (trung tâm)' },
            { label: 'Loại hình', value: 'Căn hộ cao cấp 1-3 phòng ngủ' },
            { label: 'Mức giá tham khảo', value: 'Từ 35 triệu/m²' },
            { label: 'Kết nối TP.HCM', value: 'Cao tốc TP.HCM – Thủ Dầu Một' },
            { label: 'Tiêu chuẩn', value: 'Quốc tế' },
            { label: 'Pháp lý', value: 'Sổ hồng 50 năm có gia hạn' },
            { label: 'Mục tiêu cư dân', value: 'Chuyên gia, nhà quản lý KCN' },
        ],
        amenities: [
            {
                title: 'Tiện ích nội khu',
                items: [
                    'Hồ bơi tràn view toàn cảnh',
                    'Phòng gym & spa hiện đại',
                    'Sky lounge và rooftop garden',
                    'Hệ thống an ninh 24/7 đa lớp',
                    'Khu vui chơi trẻ em',
                    'Bãi xe thông minh',
                    'Siêu thị tiện lợi trong tòa nhà',
                    'Phòng họp & co-working space',
                ],
            },
            {
                title: 'Kết nối hạ tầng Bình Dương',
                items: [
                    'Cao tốc TP.HCM – Thủ Dầu Một – Chơn Thành',
                    'Đại lộ Bình Dương (mở rộng 8 làn)',
                    'Metro Bến Thành – Suối Tiên – Bình Dương (quy hoạch)',
                    'Gần WTC Bình Dương, trung tâm thương mại AEON',
                    'Bệnh viện, trường học quốc tế trong bán kính 2km',
                ],
            },
        ],
        faqs: [
            {
                q: 'Dự án Manhattan Bình Dương có ưu điểm gì nổi bật?',
                a: 'Manhattan Bình Dương nổi bật với ba điểm: (1) Vị trí trung tâm Bình Dương — tỉnh có tốc độ phát triển kinh tế và đô thị thuộc top 3 cả nước; (2) Thiết kế chuẩn quốc tế, phù hợp với nhu cầu của hàng nghìn chuyên gia nước ngoài đang làm việc tại các KCN Bình Dương; (3) Giá cạnh tranh hơn so với mặt bằng căn hộ cao cấp TP.HCM cùng phân khúc.',
            },
            {
                q: 'Giá căn hộ Manhattan Bình Dương từ bao nhiêu?',
                a: 'Giá tham khảo từ 35 triệu/m², căn hộ 1 phòng ngủ từ khoảng 2-3 tỷ, 2 phòng ngủ từ 3-5 tỷ, 3 phòng ngủ từ 5-8 tỷ. Chính sách thanh toán linh hoạt theo tiến độ và hỗ trợ vay ngân hàng tối đa 70% giá trị. Liên hệ SGS LAND để được báo giá chính xác theo thời điểm.',
            },
            {
                q: 'Manhattan Bình Dương cách TP.HCM bao xa?',
                a: 'Dự án nằm tại trung tâm Bình Dương, cách TP.HCM khoảng 25-35km. Di chuyển qua cao tốc TP.HCM – Thủ Dầu Một chỉ mất 30-40 phút. Khi tuyến metro Bến Thành – Suối Tiên mở rộng lên Bình Dương (theo quy hoạch), kết nối sẽ càng thuận tiện hơn.',
            },
            {
                q: 'Có thể cho thuê căn hộ Manhattan không?',
                a: 'Bình Dương là tỉnh có nhu cầu thuê nhà ở cao nhất cả nước do lực lượng chuyên gia và quản lý KCN lớn. Căn hộ cao cấp tại Manhattan phù hợp cho thuê với giá 10-25 triệu/tháng tùy diện tích, tỷ suất lợi nhuận cho thuê ước tính 5-7%/năm.',
            },
            {
                q: 'Pháp lý Manhattan Bình Dương có rõ ràng không?',
                a: 'Dự án được cấp sổ hồng 50 năm có gia hạn theo quy định pháp luật hiện hành. Becamex IDC là chủ đầu tư uy tín với hàng chục năm kinh nghiệm phát triển đô thị tại Bình Dương. SGS LAND cung cấp dịch vụ kiểm tra pháp lý độc lập miễn phí trước giao dịch.',
            },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
    },
};

function navigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function ProjectLandingPage() {
    const parts = window.location.pathname.replace(/^\//, '').split('/');
    const projectSlug = parts[1] || '';
    const cfg = PROJECT_CONFIG[projectSlug];

    if (!cfg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
                <div className="text-center">
                    <p className="text-[var(--text-secondary)] mb-4">Dự án không tìm thấy.</p>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="px-6 py-2.5 bg-[var(--primary-600)] text-white rounded-xl font-bold text-sm"
                    >
                        Xem Tất Cả Dự Án
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
            {/* ── Nav ── */}
            <header className="sticky top-0 z-50 bg-[var(--bg-surface)]/95 backdrop-blur border-b border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2 font-bold text-[var(--primary-600)] text-lg"
                        aria-label="SGS LAND - Trang chủ"
                    >
                        <Logo className="w-6 h-6" />
                        SGS LAND
                    </button>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/bat-dong-san-dong-nai')} className="hover:text-[var(--primary-600)] transition-colors">BĐS Đồng Nai</button>
                        <button onClick={() => navigate('/bat-dong-san-long-thanh')} className="hover:text-[var(--primary-600)] transition-colors">BĐS Long Thành</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)] transition-colors">Định Giá AI</button>
                    </nav>
                    <button
                        onClick={() => navigate('/contact')}
                        className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
                    >
                        Tư Vấn Ngay
                    </button>
                </div>
            </header>

            {/* ── Hero ── */}
            <section className="bg-gradient-to-br from-[var(--primary-600)]/10 via-[var(--bg-surface)] to-[var(--bg-app)] pt-12 pb-10 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumb */}
                    <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/home')} className="hover:text-[var(--primary-600)] transition-colors">Trang Chủ</button>
                        <span>/</span>
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Dự Án BĐS</button>
                        <span>/</span>
                        <span className="text-[var(--text-primary)] font-medium">{cfg.name}</span>
                    </nav>

                    <div className="flex flex-wrap items-start gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--primary-600)]/10 text-[var(--primary-600)] border border-[var(--primary-600)]/20">
                            {cfg.projectType}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {cfg.priceRange}
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                        {cfg.name}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-3xl leading-relaxed mb-3">
                        <strong className="text-[var(--text-primary)]">{cfg.location}</strong> — {cfg.developer}
                    </p>
                    <p className="text-[var(--text-secondary)] text-sm md:text-base max-w-3xl leading-relaxed mb-8">
                        {cfg.heroDescription}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-7 py-3 bg-[var(--primary-600)] text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-md"
                        >
                            Đăng Ký Nhận Bảng Giá
                        </button>
                        <button
                            onClick={() => navigate('/ai-valuation')}
                            className="px-7 py-3 bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-2xl font-semibold hover:border-[var(--primary-600)]/40 transition-all"
                        >
                            Định Giá AI Miễn Phí
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Project Details ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">Thông Tin Dự Án {cfg.name}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cfg.details.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-2xl p-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)] mt-2 flex-shrink-0" />
                                <div>
                                    <span className="text-xs text-[var(--text-secondary)] block">{d.label}</span>
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{d.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Amenities ── */}
            <section className="py-12 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Tiện Ích & Hạ Tầng</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">Hệ sinh thái tiện ích toàn diện tại dự án {cfg.name}.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {cfg.amenities.map((group, gi) => (
                            <div key={gi} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6">
                                <h3 className="font-bold text-[var(--text-primary)] mb-4 text-base">{group.title}</h3>
                                <ul className="space-y-2.5">
                                    {group.items.map((item, ii) => (
                                        <li key={ii} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Câu Hỏi Thường Gặp — {cfg.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">Giải đáp các thắc mắc phổ biến về dự án {cfg.name}.</p>
                    <FAQAccordion items={cfg.faqs} />
                </div>
            </section>

            {/* ── Internal Links ── */}
            <section className="py-10 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Dự Án & Khu Vực Liên Quan</h2>
                    <div className="flex flex-wrap gap-3">
                        {cfg.relatedProjects.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(
                                    p.slug.startsWith('bat-dong-san') ? `/${p.slug}` : `/du-an/${p.slug}`
                                )}
                                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium hover:border-[var(--primary-600)]/40 hover:text-[var(--primary-600)] transition-all"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-14 px-4 bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-600)]/80 text-white">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">Quan Tâm Đến {cfg.name}?</h2>
                    <p className="mb-8 opacity-90">Chuyên gia SGS LAND cung cấp tư vấn độc lập, không phụ thuộc chủ đầu tư — bao gồm kiểm tra pháp lý, phân tích giá và hỗ trợ đàm phán miễn phí.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-3.5 bg-white text-[var(--primary-600)] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            Nhận Tư Vấn Miễn Phí
                        </button>
                        <button
                            onClick={() => navigate('/ai-valuation')}
                            className="px-8 py-3.5 bg-white/10 border border-white/30 text-white rounded-2xl font-semibold hover:bg-white/20 transition-all"
                        >
                            Định Giá AI Ngay
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="bg-[var(--bg-surface)] border-t border-[var(--glass-border)] py-8 px-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Logo className="w-5 h-5 text-[var(--text-primary)]" />
                            <p className="font-bold text-[var(--text-primary)]">SGS LAND</p>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">Nền tảng BĐS AI hàng đầu Việt Nam</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)]">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)]">Định Giá AI</button>
                        <button onClick={() => navigate('/ky-gui-bat-dong-san')} className="hover:text-[var(--primary-600)]">Ký Gửi BĐS</button>
                        <button onClick={() => navigate('/news')} className="hover:text-[var(--primary-600)]">Tin Tức</button>
                        <button onClick={() => navigate('/contact')} className="hover:text-[var(--primary-600)]">Liên Hệ</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FAQAccordion({ items }: { items: { q: string; a: string }[] }) {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--bg-app)]">
                    <button
                        onClick={() => setOpen(open === i ? null : i)}
                        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 font-semibold text-sm text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors"
                        aria-expanded={open === i}
                    >
                        <span>{item.q}</span>
                        <svg
                            className={`w-5 h-5 flex-shrink-0 text-[var(--primary-600)] transition-transform ${open === i ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {open === i && (
                        <div className="px-5 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--glass-border)]">
                            <p className="pt-4">{item.a}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
