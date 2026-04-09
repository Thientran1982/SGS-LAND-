import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { useTranslation } from '../services/i18n';

interface LocationConfig {
    slug: string;
    name: string;
    province: string;
    searchQuery: string;
    heroDescription: string;
    stats: { label: string; value: string }[];
    highlights: { title: string; desc: string }[];
    faqs: { q: string; a: string }[];
    relatedLocations: { name: string; slug: string }[];
    relatedProjects: { name: string; slug: string }[];
}

const LOCATION_CONFIG: Record<string, LocationConfig> = {
    'bat-dong-san-dong-nai': {
        slug: 'bat-dong-san-dong-nai',
        name: 'Đồng Nai',
        province: 'Đồng Nai',
        searchQuery: 'Đồng Nai',
        heroDescription:
            'Bất động sản Đồng Nai đang trở thành tâm điểm đầu tư của cả nước nhờ hạ tầng phát triển mạnh mẽ, dự án sân bay Long Thành và làn sóng di dời khu công nghiệp từ TP.HCM. SGS LAND cung cấp kho hàng cập nhật realtime với đầy đủ thông tin pháp lý, giá thị trường và hỗ trợ giao dịch chuyên nghiệp.',
        stats: [
            { label: 'Dự án nổi bật', value: '50+' },
            { label: 'Tin đăng BĐS', value: '2.000+' },
            { label: 'Tăng giá trung bình/năm', value: '12-18%' },
            { label: 'Chuyên gia tư vấn', value: '200+' },
        ],
        highlights: [
            {
                title: 'Khu vực Long Thành – Nhơn Trạch',
                desc: 'Hưởng lợi trực tiếp từ sân bay quốc tế Long Thành dự kiến hoàn thành giai đoạn 1 năm 2026. Đất nền, căn hộ và nhà phố ghi nhận mức tăng giá ấn tượng 20-30%/năm.',
            },
            {
                title: 'Khu vực Biên Hòa',
                desc: 'Trung tâm kinh tế của Đồng Nai với hạ tầng giao thông kết nối trực tiếp TP.HCM qua cao tốc và vành đai. Căn hộ chung cư và nhà phố liền kề giá từ 35-80 triệu/m².',
            },
            {
                title: 'Khu đô thị – dự án lớn',
                desc: 'Aqua City (Novaland), Izumi City (Nam Long), Waterpoint… tạo nên hệ sinh thái đô thị hoàn chỉnh, thu hút cư dân và nhà đầu tư từ TP.HCM và các tỉnh lân cận.',
            },
            {
                title: 'Pháp lý minh bạch',
                desc: 'Đồng Nai đẩy mạnh số hóa thủ tục đất đai, rút ngắn thời gian cấp sổ. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí cho mọi giao dịch.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Đồng Nai có nên đầu tư không?',
                a: 'Đồng Nai là một trong những thị trường BĐS tiềm năng nhất miền Nam nhờ ba động lực chính: sân bay Long Thành (hoàn thành 2026), các tuyến cao tốc kết nối TP.HCM và làn sóng di dời khu công nghiệp. Giá đất nhiều khu vực tăng 15-25%/năm, đặc biệt tại Long Thành, Nhơn Trạch và Biên Hòa.',
            },
            {
                q: 'Giá đất Đồng Nai hiện nay là bao nhiêu?',
                a: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 15-50 triệu/m². Giá cập nhật theo thị trường và có thể thay đổi theo giai đoạn dự án.',
            },
            {
                q: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?',
                a: 'Sân bay quốc tế Long Thành (diện tích 5.000ha, công suất 25 triệu hành khách/giai đoạn 1) đã và đang kéo theo làn sóng đầu tư hạ tầng, khu đô thị và công nghiệp. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.',
            },
            {
                q: 'Những dự án BĐS nào nổi bật tại Đồng Nai?',
                a: 'Các dự án lớn đáng chú ý: Aqua City (Novaland, 1.000ha tại Nhơn Trạch), Izumi City (Nam Long, 170ha tại Biên Hòa), Waterpoint (Nam Long, Long An giáp ranh), HUD Nhơn Trạch (chung cư giá vừa), Gem Sky World (Long Thành). SGS LAND có thông tin cập nhật và hỗ trợ tư vấn tất cả dự án.',
            },
            {
                q: 'Mua đất Đồng Nai cần lưu ý gì về pháp lý?',
                a: 'Kiểm tra quy hoạch sử dụng đất (tránh mua đất quy hoạch lộ, đất nông nghiệp chưa chuyển mục đích), xác nhận chủ sở hữu qua sổ đỏ chính chủ, tránh đất chung sổ phân lô chưa tách thửa. SGS LAND cung cấp dịch vụ kiểm tra pháp lý miễn phí và đồng hành cùng công chứng để bảo vệ quyền lợi người mua.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
            { name: 'BĐS TP.HCM', slug: 'marketplace' },
            { name: 'BĐS Bình Dương', slug: 'marketplace' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Dự Án Manhattan', slug: 'manhattan' },
        ],
    },
    'bat-dong-san-long-thanh': {
        slug: 'bat-dong-san-long-thanh',
        name: 'Long Thành',
        province: 'Đồng Nai',
        searchQuery: 'Long Thành',
        heroDescription:
            'Bất động sản Long Thành, Đồng Nai đang ở giai đoạn tăng trưởng mạnh nhất nhờ dự án sân bay quốc tế Long Thành — công trình trọng điểm quốc gia. Đất nền, căn hộ và bất động sản thương mại Long Thành ghi nhận mức tăng giá vượt trội, thu hút dòng tiền đầu tư lớn từ cả nước. SGS LAND hỗ trợ tư vấn và giao dịch chuyên nghiệp.',
        stats: [
            { label: 'Khoảng cách từ TP.HCM', value: '40km' },
            { label: 'Công suất sân bay (GĐ1)', value: '25 triệu HK/năm' },
            { label: 'Tăng giá đất 3 năm gần nhất', value: '35-60%' },
            { label: 'Dự án đang mở bán', value: '20+' },
        ],
        highlights: [
            {
                title: 'Hưởng lợi trực tiếp từ sân bay Long Thành',
                desc: 'Sân bay quốc tế Long Thành có tổng diện tích 5.000ha, vốn đầu tư hơn 16 tỷ USD, giai đoạn 1 dự kiến hoàn thành và khai thác năm 2026. BĐS trong bán kính 10km là đích ngắm của các nhà đầu tư chiến lược.',
            },
            {
                title: 'Hạ tầng giao thông đồng bộ',
                desc: 'Cao tốc Bến Lức - Long Thành, đường Vành đai 3, 4 TP.HCM và quốc lộ 51 cải tạo rút ngắn thời gian di chuyển xuống 30-40 phút từ trung tâm TP.HCM. Kết nối thuận lợi với Bà Rịa-Vũng Tàu và các tỉnh miền Đông.',
            },
            {
                title: 'Đất nền và nhà phố giá tiềm năng',
                desc: 'Đất nền phân lô đã có sổ đỏ từ 8-25 triệu/m², nhà phố liền kề 4-8 tỷ, biệt thự dự án từ 10 tỷ. Tiềm năng tăng giá còn lớn khi sân bay đi vào hoạt động.',
            },
            {
                title: 'Khu công nghiệp và thương mại',
                desc: 'Long Thành là cửa ngõ logistics quan trọng với hàng chục khu công nghiệp, kéo theo nhu cầu nhà ở, văn phòng và mặt bằng thương mại từ chuyên gia, công nhân và doanh nghiệp.',
            },
        ],
        faqs: [
            {
                q: 'Có nên mua đất Long Thành năm 2025-2026 không?',
                a: 'Long Thành là một trong các thị trường BĐS được khuyến nghị đầu tư mạnh trong giai đoạn 2024-2027. Với sân bay Long Thành hoàn thành giai đoạn 1 năm 2026, cơ sở hạ tầng đồng bộ và dòng vốn FDI đổ vào khu công nghiệp, giá BĐS được dự báo tiếp tục tăng 15-25%/năm.',
            },
            {
                q: 'Giá đất nền Long Thành hiện nay khoảng bao nhiêu?',
                a: 'Đất nền thổ cư mặt tiền đường lớn: 20-35 triệu/m². Đất phân lô dự án sổ sẵn: 10-25 triệu/m². Đất vườn nông nghiệp có thể chuyển đổi: 3-8 triệu/m². Giá biến động theo khoảng cách tới sân bay và loại pháp lý.',
            },
            {
                q: 'Sân bay Long Thành khai thác vào năm nào?',
                a: 'Theo tiến độ chính thức, sân bay Long Thành giai đoạn 1 dự kiến hoàn thành vào cuối năm 2026, khai thác thương mại đầu năm 2027 với công suất 25 triệu hành khách/năm. Tổng vốn đầu tư giai đoạn 1 khoảng 109.000 tỷ đồng.',
            },
            {
                q: 'Mua BĐS Long Thành qua SGS LAND có những lợi ích gì?',
                a: 'SGS LAND cung cấp: kho hàng BĐS Long Thành đã xác minh pháp lý, so sánh giá thị trường realtime bằng AI, hỗ trợ đàm phán và pháp lý miễn phí, kết nối ngân hàng vay vốn lãi suất ưu đãi. Đội ngũ 200+ chuyên gia am hiểu thị trường Long Thành sẵn sàng tư vấn.',
            },
            {
                q: 'Rủi ro khi đầu tư đất Long Thành là gì?',
                a: 'Rủi ro cần lưu ý: đất quy hoạch đường hoặc sân bay chưa giải toả, đất không có sổ đỏ hoặc đang tranh chấp, dự án ma chưa đủ điều kiện mở bán, bong bóng giá do thông tin thổi phồng. SGS LAND kiểm tra pháp lý độc lập trước mỗi giao dịch để bảo vệ người mua.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS TP.HCM', slug: 'marketplace' },
            { name: 'Toàn Bộ Dự Án', slug: 'du-an/aqua-city' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Gem Sky World', slug: 'marketplace' },
        ],
    },
};

function navigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function LocalLandingPage() {
    const { t } = useTranslation();
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const slug = window.location.pathname.replace(/^\//, '').split('/')[0];
    const cfg = LOCATION_CONFIG[slug];

    useEffect(() => {
        if (!cfg) return;
        setLoading(true);
        fetch(`/api/public/listings?search=${encodeURIComponent(cfg.searchQuery)}&limit=6`)
            .then(r => r.json())
            .then(d => setListings(Array.isArray(d?.listings) ? d.listings : []))
            .catch(() => setListings([]))
            .finally(() => setLoading(false));
    }, [cfg?.searchQuery]);

    if (!cfg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
                <p className="text-[var(--text-secondary)]">Trang không tìm thấy.</p>
            </div>
        );
    }

    const fmtPrice = (p: number) => {
        if (p >= 1e9) return `${(p / 1e9).toFixed(1)} tỷ`;
        if (p >= 1e6) return `${Math.round(p / 1e6)} triệu`;
        return p.toLocaleString('vi-VN');
    };

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
                        <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M8 22l8-14 8 14H8z" fill="white" opacity=".9"/></svg>
                        SGS LAND
                    </button>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/bat-dong-san-dong-nai')} className="hover:text-[var(--primary-600)] transition-colors">Đồng Nai</button>
                        <button onClick={() => navigate('/bat-dong-san-long-thanh')} className="hover:text-[var(--primary-600)] transition-colors">Long Thành</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)] transition-colors">Định Giá AI</button>
                    </nav>
                    <button
                        onClick={() => navigate('/contact')}
                        className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
                    >
                        Tư Vấn Miễn Phí
                    </button>
                </div>
            </header>

            {/* ── Hero ── */}
            <section className="bg-gradient-to-br from-[var(--primary-600)]/10 via-[var(--bg-surface)] to-[var(--bg-app)] pt-12 pb-10 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumb */}
                    <nav aria-label="breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/home')} className="hover:text-[var(--primary-600)] transition-colors">Trang Chủ</button>
                        <span>/</span>
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Mua Bán BĐS</button>
                        <span>/</span>
                        <span className="text-[var(--text-primary)] font-medium">Bất Động Sản {cfg.name}</span>
                    </nav>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                        Bất Động Sản {cfg.name}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-3xl leading-relaxed mb-8">
                        {cfg.heroDescription}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cfg.stats.map((s, i) => (
                            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 text-center shadow-sm">
                                <div className="text-xl md:text-2xl font-bold text-[var(--primary-600)]">{s.value}</div>
                                <div className="text-xs text-[var(--text-secondary)] mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Highlights ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
                        Tại Sao Nên Đầu Tư Bất Động Sản {cfg.name}?
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-8">Những lý do hàng đầu khiến {cfg.name} là thị trường được nhà đầu tư lựa chọn.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cfg.highlights.map((h, i) => (
                            <div key={i} className="bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-2xl p-5 flex gap-4 hover:border-[var(--primary-600)]/30 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-[var(--primary-600)]/10 flex-shrink-0 flex items-center justify-center text-[var(--primary-600)] font-bold text-lg">
                                    {i + 1}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">{h.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{h.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Listings ── */}
            <section className="py-12 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Bất Động Sản {cfg.name} Đang Bán</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Cập nhật realtime từ kho hàng đã xác minh pháp lý</p>
                        </div>
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="text-sm font-semibold text-[var(--primary-600)] hover:underline hidden md:block"
                        >
                            Xem tất cả →
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-52 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : listings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {listings.slice(0, 6).map((l: any) => (
                                <button
                                    key={l.id}
                                    onClick={() => navigate(`/listing/${l.id}`)}
                                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden text-left hover:border-[var(--primary-600)]/40 hover:shadow-md transition-all"
                                >
                                    <div className="h-36 bg-[var(--glass-surface-hover)] flex items-center justify-center">
                                        {(l.images && l.images[0]) ? (
                                            <img src={l.images[0]} alt={l.title || 'BĐS'} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <svg className="w-10 h-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-xs text-[var(--primary-600)] font-semibold mb-1 uppercase tracking-wide">
                                            {l.transaction === 'RENT' ? 'Cho Thuê' : 'Bán'} · {l.type || 'BĐS'}
                                        </p>
                                        <p className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2 mb-2">{l.title || 'Bất động sản ' + cfg.name}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[var(--primary-600)] font-bold text-sm">
                                                {l.price ? fmtPrice(Number(l.price)) : 'Liên hệ'}
                                            </span>
                                            {l.area && <span className="text-xs text-[var(--text-secondary)]">{l.area}m²</span>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[var(--text-secondary)]">
                            <p className="mb-4">Chưa có tin đăng trong khu vực này.</p>
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="px-8 py-3 bg-[var(--primary-600)] text-white rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md"
                        >
                            Xem Toàn Bộ BĐS {cfg.name}
                        </button>
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Câu Hỏi Thường Gặp — BĐS {cfg.name}</h2>
                    <p className="text-[var(--text-secondary)] mb-8 text-sm">Giải đáp các thắc mắc phổ biến về thị trường bất động sản {cfg.name}.</p>
                    <FAQAccordion items={cfg.faqs} />
                </div>
            </section>

            {/* ── Internal Links ── */}
            <section className="py-10 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Khu Vực & Dự Án Liên Quan</h2>
                    <div className="flex flex-wrap gap-3">
                        {cfg.relatedLocations.map((l, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(`/${l.slug}`)}
                                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium hover:border-[var(--primary-600)]/40 hover:text-[var(--primary-600)] transition-all"
                            >
                                {l.name}
                            </button>
                        ))}
                        {cfg.relatedProjects.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(`/du-an/${p.slug}`)}
                                className="px-4 py-2 bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20 rounded-xl text-sm font-medium text-[var(--primary-600)] hover:bg-[var(--primary-600)]/20 transition-all"
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
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">Tư Vấn BĐS {cfg.name} Miễn Phí</h2>
                    <p className="mb-8 opacity-90">Đội ngũ chuyên gia SGS LAND với 200+ chuyên gia am hiểu thị trường {cfg.province} sẵn sàng hỗ trợ bạn tìm kiếm, đàm phán và hoàn tất giao dịch.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-3.5 bg-white text-[var(--primary-600)] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            Nhận Tư Vấn Ngay
                        </button>
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="px-8 py-3.5 bg-white/10 border border-white/30 text-white rounded-2xl font-semibold hover:bg-white/20 transition-all"
                        >
                            Tìm BĐS {cfg.name}
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="bg-[var(--bg-surface)] border-t border-[var(--glass-border)] py-8 px-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="font-bold text-[var(--text-primary)]">SGS LAND</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Nền tảng BĐS AI hàng đầu Việt Nam</p>
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
                <div
                    key={i}
                    className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--bg-app)]"
                >
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
