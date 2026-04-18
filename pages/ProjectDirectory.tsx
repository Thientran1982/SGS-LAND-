import React, { useState, useMemo } from 'react';
import { Logo } from '../components/Logo';
import { motion } from 'motion/react';
import { MapPin, Building2, ArrowRight, Phone, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const HOTLINE_DISPLAY = '+84 971 132 378';
const HOTLINE_TEL = '+84971132378';

function navigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

interface DuAnProject {
    slug: string;
    name: string;
    developer: string;
    location: string;
    province: string;
    scale: string;
    priceRange: string;
    projectType: string;
    typeGroup: string;
    status: string;
    statusColor: 'emerald' | 'indigo' | 'amber';
    img: string;
    description: string;
}

const ALL_PROJECTS: DuAnProject[] = [
    {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        developer: 'Novaland Group',
        location: 'Nhơn Trạch, Đồng Nai',
        province: 'Đồng Nai',
        scale: '1.000 ha',
        priceRange: 'Từ 6,5 tỷ đồng',
        projectType: 'Đại Đô Thị Sinh Thái',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang bàn giao',
        statusColor: 'emerald',
        img: '/images/projects/aqua-city.png',
        description: 'Đại đô thị sinh thái 1.000ha với hơn 100.000m² mặt nước, sân golf 18 lỗ, marina cao cấp. Cách TP.HCM 30 phút qua cầu Nhơn Trạch.',
    },
    {
        slug: 'the-global-city',
        name: 'The Global City',
        developer: 'Masterise Homes',
        location: 'An Phú, TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '117 ha',
        priceRange: 'Nhà phố từ 15 tỷ',
        projectType: 'Đại Đô Thị Thương Mại',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang mở bán',
        statusColor: 'indigo',
        img: '/images/projects/the-global-city.png',
        description: 'Đại đô thị thương mại – dịch vụ 117ha chuẩn Singapore, cạnh Metro số 1 An Phú. TTTM 200.000m², trường quốc tế, bệnh viện 5 sao.',
    },
    {
        slug: 'izumi-city',
        name: 'Izumi City Nam Long',
        developer: 'Nam Long Group',
        location: 'Biên Hòa, Đồng Nai',
        province: 'Đồng Nai',
        scale: '170 ha',
        priceRange: 'Từ 8,4 tỷ đồng',
        projectType: 'Đô Thị Chuẩn Nhật Bản',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang mở bán',
        statusColor: 'indigo',
        img: '/images/projects/izumi-city.png',
        description: 'Đô thị chuẩn Nhật Bản 170ha với siêu thị Fuji Mart, trường học tiêu chuẩn Nhật, kiến trúc zen. Nam Long track record bàn giao tốt.',
    },
    {
        slug: 'vinhomes-grand-park',
        name: 'Vinhomes Grand Park',
        developer: 'Vinhomes',
        location: 'TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '271 ha',
        priceRange: 'Từ 3 tỷ đồng',
        projectType: 'Siêu Đô Thị Tích Hợp',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang bàn giao',
        statusColor: 'emerald',
        img: '/images/projects/vinhomes-grand-park.png',
        description: 'Siêu đô thị 271ha, công viên 36ha, Metro số 1, Vinmec, Vinschool. Hơn 44 tòa căn hộ hiện đại tại TP Thủ Đức.',
    },
    {
        slug: 'vinhomes-central-park',
        name: 'Vinhomes Central Park',
        developer: 'Vinhomes',
        location: 'Bình Thạnh, TP.HCM',
        province: 'TP.HCM',
        scale: '44 tòa cao tầng',
        priceRange: 'Từ 50 triệu/m²',
        projectType: 'Khu Đô Thị Cao Cấp',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/vinhomes-grand-park.png',
        description: 'Vinhomes Central Park Bình Thạnh: Landmark 81, bể bơi vô cực ven sông Sài Gòn. Thị trường thứ cấp sổ hồng đầy đủ.',
    },
    {
        slug: 'masterise-homes',
        name: 'Masterise Homes',
        developer: 'Masterise Group',
        location: 'TP.HCM (Q1, Q2, Bình Thạnh)',
        province: 'TP.HCM',
        scale: 'Hệ sinh thái branded',
        priceRange: 'Từ 7,5 tỷ',
        projectType: 'Branded Residence',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Đang bán',
        statusColor: 'emerald',
        img: '/images/projects/masterise-homes.png',
        description: 'Grand Marina Saigon (JW Marriott, Q1), Masteri Thảo Điền, Lumière Boulevard. Ultra-luxury branded residence chuẩn 5 sao quốc tế.',
    },
    {
        slug: 'manhattan',
        name: 'Grand Manhattan Novaland',
        developer: 'Novaland Group',
        location: 'Nội thành, TP.HCM',
        province: 'TP.HCM',
        scale: 'Căn hộ hạng sang',
        priceRange: 'Từ 120 triệu/m²',
        projectType: 'Căn Hộ Hạng Sang',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/masterise-homes.png',
        description: 'Grand Manhattan Novaland — căn hộ hạng sang biểu tượng của Novaland tại nội thành TP.HCM, tiện ích 5 sao, penthouse và sky villa.',
    },
    {
        slug: 'thu-thiem',
        name: 'Khu Đô Thị Thủ Thiêm',
        developer: 'Nhiều chủ đầu tư',
        location: 'Thủ Thiêm, TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '657 ha',
        priceRange: 'Từ 80 triệu/m²',
        projectType: 'Trung Tâm Tài Chính',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Đang phát triển',
        statusColor: 'amber',
        img: '/images/projects/the-global-city.png',
        description: 'Khu đô thị mới Thủ Thiêm 657ha — trung tâm tài chính tương lai TP.HCM. Empire City, Metropole, The River. Thanh khoản cao, tiềm năng lớn.',
    },
    {
        slug: 'son-kim-land',
        name: 'Sơn Kim Land',
        developer: 'Sơn Kim Group',
        location: 'TP.HCM & Hà Nội',
        province: 'TP.HCM',
        scale: 'Đa dự án',
        priceRange: 'Từ 40 triệu/m²',
        projectType: 'BĐS Thương Mại',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Đang bán',
        statusColor: 'emerald',
        img: '/images/projects/the-global-city.png',
        description: 'Sơn Kim Land: Gem Riverside Q4, Metropole Thủ Thiêm, Seasons Avenue Hà Nội. GEM Center, chuỗi GS25. BĐS thương mại cao cấp.',
    },
    {
        slug: 'nha-pho-trung-tam',
        name: 'Nhà Phố Trung Tâm TP.HCM',
        developer: 'Nhiều chủ sở hữu',
        location: 'Q1, Q3, Bình Thạnh, Phú Nhuận',
        province: 'TP.HCM',
        scale: 'Nhà riêng lẻ',
        priceRange: 'Từ 100 triệu/m²',
        projectType: 'Nhà Phố Mặt Tiền',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/aqua-city.png',
        description: 'Mua bán nhà phố mặt tiền, nhà hẻm và shophouse trung tâm TP.HCM. Định giá AI ±5% miễn phí, kiểm tra pháp lý độc lập trước giao dịch.',
    },
    {
        slug: 'vinhomes-can-gio',
        name: 'Vinhomes Cần Giờ',
        developer: 'Vinhomes',
        location: 'Cần Giờ, TP.HCM',
        province: 'TP.HCM',
        scale: '2.870 ha',
        priceRange: 'Từ 12 tỷ',
        projectType: 'Siêu Đô Thị Lấn Biển',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Sắp mở bán',
        statusColor: 'amber',
        img: '/images/projects/vinhomes-can-gio.png',
        description: 'Siêu đô thị lấn biển 2.870ha lớn nhất TP.HCM, bãi biển nhân tạo, marina, resort 5 sao, sân golf. Dự kiến mở bán 2026.',
    },
];

const PROVINCES = ['Tất cả', 'TP.HCM', 'Đồng Nai'];
const TYPE_GROUPS = ['Tất cả', 'Đô thị tổng hợp', 'Căn hộ cao cấp', 'Biệt thự & nhà phố'];
const STATUSES = ['Tất cả', 'Đang bàn giao', 'Đang mở bán', 'Đang bán', 'Thứ cấp', 'Sắp mở bán', 'Đang phát triển'];

const STATUS_BADGE: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProjectCard = ({ project }: { project: DuAnProject }) => (
    <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.35 }}
        onClick={() => navigate(`/du-an/${project.slug}`)}
        className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] hover:shadow-xl transition-all duration-300 cursor-pointer group hover:-translate-y-1 flex flex-col overflow-hidden"
    >
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-100">
            <img
                src={project.img}
                alt={`${project.name} — ${project.projectType} ${project.location}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap backdrop-blur-sm ${STATUS_BADGE[project.statusColor]}`}>
                {project.status}
            </span>
            <span className="absolute bottom-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {project.province}
            </span>
        </div>
        <div className="p-5 flex flex-col flex-1">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">{project.projectType}</span>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 group-hover:text-indigo-600 transition-colors leading-snug">
                {project.name}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0 text-indigo-400" />
                {project.developer} · {project.location}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 line-clamp-2">{project.description}</p>
            <div className="mt-auto pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
                <span className="text-sm font-extrabold text-indigo-600">{project.priceRange}</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Xem chi tiết <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
            </div>
        </div>
    </motion.article>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectDirectory() {
    const [searchQuery, setSearchQuery] = useState('');
    const [province, setProvince] = useState('Tất cả');
    const [typeGroup, setTypeGroup] = useState('Tất cả');
    const [statusFilter, setStatusFilter] = useState('Tất cả');
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        return ALL_PROJECTS.filter(p => {
            const q = searchQuery.toLowerCase();
            if (q && !p.name.toLowerCase().includes(q) && !p.developer.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q)) return false;
            if (province !== 'Tất cả' && p.province !== province) return false;
            if (typeGroup !== 'Tất cả' && p.typeGroup !== typeGroup) return false;
            if (statusFilter !== 'Tất cả' && p.status !== statusFilter) return false;
            return true;
        });
    }, [searchQuery, province, typeGroup, statusFilter]);

    const hasActiveFilters = province !== 'Tất cả' || typeGroup !== 'Tất cả' || statusFilter !== 'Tất cả';

    return (
        <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">

            {/* ── Sticky nav ── */}
            <nav className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
                    <button onClick={() => navigate('/home')} className="flex items-center gap-2 shrink-0">
                        <Logo className="w-5 h-5 text-[var(--text-primary)]" />
                        <span className="font-extrabold text-sm tracking-tight text-[var(--text-primary)]">SGS LAND</span>
                    </button>
                    <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-indigo-600 transition-colors">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-indigo-600 transition-colors">Định Giá AI</button>
                        <button onClick={() => navigate('/ky-gui-bat-dong-san')} className="hover:text-indigo-600 transition-colors">Ký Gửi</button>
                    </nav>
                    <a
                        href={`tel:${HOTLINE_TEL}`}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shrink-0"
                    >
                        <Phone className="w-3.5 h-3.5" />
                        {HOTLINE_DISPLAY}
                    </a>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white py-16 px-4">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-indigo-600/10 blur-2xl" />
                </div>
                <div className="relative max-w-4xl mx-auto text-center">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">
                        SGS LAND · Đại Lý Phân Phối Chính Thức
                    </p>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
                        Dự Án BĐS<br />
                        <span className="text-indigo-400">SGS LAND Đang Phân Phối</span>
                    </h1>
                    <p className="text-base text-indigo-100/80 max-w-2xl mx-auto mb-8">
                        {ALL_PROJECTS.length} dự án từ Novaland, Masterise Homes, Vinhomes, Nam Long — tại TP.HCM và Đồng Nai. Tư vấn miễn phí, không thu phí người mua.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center text-sm">
                        {['Aqua City 1.000ha', 'The Global City 117ha', 'Izumi City 170ha', 'Vinhomes Cần Giờ 2.870ha'].map(tag => (
                            <span key={tag} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold backdrop-blur-sm">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Filters ── */}
            <section className="sticky top-14 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--glass-border)]">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                            <input
                                type="search"
                                placeholder="Tìm dự án, chủ đầu tư..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-[var(--glass-border)] bg-[var(--bg-app)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            />
                        </div>
                        {/* Filter toggle (mobile) */}
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${hasActiveFilters ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-[var(--glass-border)] text-[var(--text-secondary)] bg-[var(--bg-app)]'}`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Lọc {hasActiveFilters && '•'}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                        {/* Desktop filters */}
                        <div className="hidden sm:flex items-center gap-2 flex-wrap">
                            <FilterSelect label="Khu vực" options={PROVINCES} value={province} onChange={setProvince} />
                            <FilterSelect label="Loại hình" options={TYPE_GROUPS} value={typeGroup} onChange={setTypeGroup} />
                            <FilterSelect label="Trạng thái" options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
                            {hasActiveFilters && (
                                <button
                                    onClick={() => { setProvince('Tất cả'); setTypeGroup('Tất cả'); setStatusFilter('Tất cả'); }}
                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    Xóa lọc
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Mobile filter panel */}
                    {showFilters && (
                        <div className="sm:hidden mt-3 pt-3 border-t border-[var(--glass-border)] flex flex-col gap-2">
                            <FilterSelect label="Khu vực" options={PROVINCES} value={province} onChange={setProvince} />
                            <FilterSelect label="Loại hình" options={TYPE_GROUPS} value={typeGroup} onChange={setTypeGroup} />
                            <FilterSelect label="Trạng thái" options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
                            {hasActiveFilters && (
                                <button
                                    onClick={() => { setProvince('Tất cả'); setTypeGroup('Tất cả'); setStatusFilter('Tất cả'); }}
                                    className="text-xs font-semibold text-indigo-600 text-left"
                                >
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Project grid ── */}
            <main className="max-w-7xl mx-auto px-4 py-10">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-[var(--text-secondary)]">
                        Hiển thị <span className="font-bold text-[var(--text-primary)]">{filtered.length}</span> / {ALL_PROJECTS.length} dự án
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                        <Building2 className="w-3.5 h-3.5" />
                        Cập nhật tháng 4/2026
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-[var(--text-secondary)] mb-4 text-sm">Không tìm thấy dự án phù hợp.</p>
                        <button
                            onClick={() => { setSearchQuery(''); setProvince('Tất cả'); setTypeGroup('Tất cả'); setStatusFilter('Tất cả'); }}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Xem tất cả dự án
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(p => <ProjectCard key={p.slug} project={p} />)}
                    </div>
                )}
            </main>

            {/* ── CTA ── */}
            <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white py-14 px-4 mt-4">
                <div className="max-w-3xl mx-auto text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3">Tư Vấn Miễn Phí · Không Thu Phí Người Mua</p>
                    <h2 className="text-2xl md:text-3xl font-extrabold mb-4">Cần Tư Vấn Dự Án Cụ Thể?</h2>
                    <p className="text-indigo-100/80 text-sm mb-8 max-w-xl mx-auto">
                        Đội ngũ SGS LAND hỗ trợ so sánh dự án, kiểm tra pháp lý, hỗ trợ hồ sơ vay vốn và đặt chỗ ưu tiên — hoàn toàn miễn phí.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href={`tel:${HOTLINE_TEL}`}
                            className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-700 rounded-2xl font-extrabold text-base hover:bg-indigo-50 transition-all shadow-lg"
                        >
                            <Phone className="w-5 h-5" />
                            Gọi {HOTLINE_DISPLAY}
                        </a>
                        <button
                            onClick={() => navigate('/ai-valuation')}
                            className="px-8 py-4 bg-white/10 border border-white/30 text-white rounded-2xl font-semibold text-base hover:bg-white/20 transition-all"
                        >
                            Định Giá AI Miễn Phí
                        </button>
                    </div>
                </div>
            </section>

            {/* ── E-E-A-T disclaimer ── */}
            <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                    Thông tin dự án cập nhật tháng 4/2026. Giá tham khảo, có thể thay đổi theo giai đoạn. SGS LAND là đại lý phân phối, không phải chủ đầu tư. Nguồn: CBRE Vietnam, Savills Vietnam, Bộ Xây Dựng.
                </p>
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-[var(--glass-border)] bg-[var(--bg-surface)] py-8 px-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Logo className="w-5 h-5 text-[var(--text-primary)]" />
                            <span className="font-bold text-[var(--text-primary)]">SGS LAND</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">Đại lý BĐS phân phối chính thức tại TP.HCM</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-indigo-600">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-indigo-600">Định Giá AI</button>
                        <button onClick={() => navigate('/ky-gui-bat-dong-san')} className="hover:text-indigo-600">Ký Gửi BĐS</button>
                        <button onClick={() => navigate('/news')} className="hover:text-indigo-600">Tin Tức</button>
                        <button onClick={() => navigate('/contact')} className="hover:text-indigo-600">Liên Hệ</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FilterSelect({
    label, options, value, onChange
}: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`pr-8 pl-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${value !== 'Tất cả'
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-[var(--glass-border)] text-[var(--text-secondary)] bg-[var(--bg-app)]'
                    }`}
            >
                {options.map(o => (
                    <option key={o} value={o}>{o === 'Tất cả' ? `${label}: Tất cả` : o}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-tertiary)]" />
        </div>
    );
}
