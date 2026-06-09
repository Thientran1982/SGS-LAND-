import React, { useState, useEffect } from 'react';
import {
  Search, ArrowRight, Zap, BarChart3, Globe2, Users,
  CheckCircle2, Star, Menu, X, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';

// ─── Static data ────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Dự Án',           href: `/${ROUTES.DU_AN}` },
  { label: 'Sàn Giao Dịch',   href: `/${ROUTES.SEARCH}` },
  { label: 'Định Giá AI',     href: `/${ROUTES.AI_VALUATION}` },
  { label: 'Dữ Liệu TT',      href: '/market-data' },
  { label: 'CRM Platform',    href: `/${ROUTES.CRM_SOLUTION}` },
];

const STATS = [
  { value: '11+',  label: 'Dự Án Lớn',    sub: 'Vinhomes, Novaland, Nam Long...' },
  { value: '±5%',  label: 'Chính Xác AI', sub: 'Sai số định giá tự động' },
  { value: '3+',   label: 'Tỉnh Thành',   sub: 'TP.HCM, Đồng Nai, Bình Dương' },
  { value: '1/7',  label: 'Hỗ Trợ',       sub: 'Pháp lý & vay vốn miễn phí' },
];

const PARTNERS = ['Vinhomes', 'Novaland', 'Nam Long', 'Masterise', 'Van Phúc', 'Khang Điền', 'Sơn Kim Land'];

const FEATURES = [
  { icon: <Zap className="w-6 h-6" />,       title: 'AI Định Giá ±5%',     desc: 'Định giá tự động bất kỳ BĐS nào tại TP.HCM với sai số chỉ ±5%. Kết quả trong 3 giây.',                        href: `/${ROUTES.AI_VALUATION}`,  color: '#6366f1' },
  { icon: <Globe2 className="w-6 h-6" />,    title: 'Sàn Giao Dịch',       desc: 'Hàng nghìn căn hộ, đất nền, nhà phố được xác minh pháp lý. Kết nối trực tiếp với chủ đầu tư.',            href: `/${ROUTES.SEARCH}`,        color: '#8b5cf6' },
  { icon: <BarChart3 className="w-6 h-6" />, title: 'Dữ Liệu Thị Trường',  desc: 'Báo cáo biến động giá theo quý, xu hướng đầu tư từ 50+ dự án lớn tại TP.HCM.',                             href: '/market-data',             color: '#3b82f6' },
  { icon: <Users className="w-6 h-6" />,     title: 'CRM Đa Kênh',         desc: 'Quản lý khách hàng, tích hợp Zalo/Facebook/Email. Dùng thử miễn phí 30 ngày.',                               href: `/${ROUTES.CRM_SOLUTION}`,  color: '#0ea5e9' },
];

const PROJECTS = [
  { slug: 'aqua-city',                 name: 'Aqua City',            dev: 'Novaland',    loc: 'Biên Hòa, Đồng Nai',     scale: '1.000 ha',   price: 'Từ 2,5 tỷ',  badge: 'Hot',        gradient: 'from-emerald-800 to-teal-600',     type: 'Đô Thị Sinh Thái' },
  { slug: 'the-global-city',           name: 'The Global City',      dev: 'Masterise',   loc: 'Thủ Đức, TP.HCM',        scale: '117 ha',     price: 'Từ 4,5 tỷ',  badge: 'Cao Cấp',    gradient: 'from-blue-900 to-indigo-700',      type: 'Đô Thị Tài Chính' },
  { slug: 'vinhomes-can-gio',          name: 'Vinhomes Cần Giờ',     dev: 'Vinhomes',    loc: 'Cần Giờ, TP.HCM',        scale: '2.870 ha',   price: 'Từ 12 tỷ',   badge: 'Siêu Dự Án', gradient: 'from-cyan-900 to-blue-700',        type: 'Đô Thị Biển' },
  { slug: 'izumi-city',                name: 'Izumi City',           dev: 'Nam Long',    loc: 'Biên Hòa, Đồng Nai',     scale: '170 ha',     price: 'Từ 8,4 tỷ',  badge: 'Nhật Bản',   gradient: 'from-rose-900 to-pink-700',        type: 'Đô Thị Chuẩn Nhật' },
  { slug: 'vinhomes-grand-park',       name: 'Vinhomes Grand Park',  dev: 'Vinhomes',    loc: 'Thủ Đức, TP.HCM',        scale: '271 ha',     price: 'Từ 1,8 tỷ',  badge: 'Best Seller', gradient: 'from-violet-900 to-purple-700',   type: 'Đại Đô Thị' },
  { slug: 'diamond-sky-van-phuc-city', name: 'Diamond Sky',          dev: 'Van Phúc',    loc: 'TP Thủ Đức, TP.HCM',     scale: '198 ha',     price: 'Từ 9,6 tỷ',  badge: 'Cao Cấp',    gradient: 'from-amber-900 to-orange-700',     type: 'Căn Hộ View Sông' },
];

const TESTIMONIALS = [
  { name: 'Nguyễn Minh Tuấn',  role: 'Nhà đầu tư',   content: 'AI định giá của SGS LAND rất chính xác, giúp tôi mua được căn hộ Vinhomes đúng giá thị trường.', rating: 5 },
  { name: 'Trần Thị Lan Anh',  role: 'Môi giới BĐS', content: 'CRM platform giúp tôi quản lý 200+ khách hàng dễ dàng. Doanh số tăng 40% sau 3 tháng sử dụng.', rating: 5 },
  { name: 'Lê Thành Đạt',      role: 'Nhà đầu tư',   content: 'Dữ liệu thị trường SGS LAND cực kỳ chi tiết, giúp tôi quyết định đầu tư đúng thời điểm.',       rating: 5 },
];

const GOLD = '#D4A843';
const NAVY = '#0A0F1E';

// ─── Footer link helper ──────────────────────────────────────────────────────
const FL = ({ label, href }: { label: string; href: string }) => (
  <li>
    <a
      href={href}
      className="text-slate-400 hover:text-amber-400 transition-colors duration-200 text-sm leading-relaxed inline-flex items-center gap-1 group"
    >
      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all duration-200 text-amber-400 shrink-0" />
      {label}
    </a>
  </li>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    window.location.href = q ? `/${ROUTES.SEARCH}?q=${encodeURIComponent(q)}` : `/${ROUTES.SEARCH}`;
  };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const header = (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(10,15,30,0.92)'
          : 'rgba(10,15,30,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: scrolled ? `1px solid rgba(212,168,67,0.15)` : '1px solid rgba(255,255,255,0.06)',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2.5 shrink-0 group">
            <Logo className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" style={{ color: GOLD } as React.CSSProperties} />
            <span className="font-bold text-lg tracking-tight text-white">
              SGS <span style={{ color: GOLD }}>LAND</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/8 transition-all duration-200"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <a
              href={`/${ROUTES.LOGIN}`}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg border transition-all duration-200 hover:bg-white/10"
              style={{ borderColor: `${GOLD}60` }}
            >
              Đăng nhập
            </a>
            <a
              href={`/${ROUTES.CRM_SOLUTION}`}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 hover:brightness-110 shadow-lg"
              style={{ background: GOLD, color: NAVY }}
            >
              Dùng thử miễn phí
            </a>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t py-3 pb-4 space-y-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="block px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2 px-1">
              <a href={`/${ROUTES.LOGIN}`} className="block text-center py-2.5 text-sm font-semibold text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                Đăng nhập
              </a>
              <a href={`/${ROUTES.CRM_SOLUTION}`} className="block text-center py-2.5 text-sm font-bold rounded-lg hover:brightness-110 transition-all" style={{ background: GOLD, color: NAVY }}>
                Dùng thử miễn phí
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );

  // ── HERO ───────────────────────────────────────────────────────────────────
  const hero = (
    <section
      className="relative min-h-screen flex items-center overflow-hidden pt-16"
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d1535 55%, #0f1840 100%)` }}
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: '#6366f1', filter: 'blur(140px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15" style={{ background: '#D4A843', filter: 'blur(120px)' }} />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
        {/* Gold line accent top */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}60, transparent)` }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: Copy */}
          <div>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-7 text-sm font-medium"
              style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}45`, color: GOLD }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GOLD }} />
              Nền Tảng Proptech #1 TP.HCM
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-5">
              Tìm Kiếm &{' '}
              <span
                className="inline-block"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #f0c040)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                Đầu Tư BĐS
              </span>
              {' '}Thông Minh
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-xl">
              SGS LAND phân phối <strong className="text-white font-semibold">11+ dự án lớn</strong> tại TP.HCM —
              Aqua City, The Global City, Vinhomes Cần Giờ.
              Định giá AI sai số <strong style={{ color: GOLD }}>±5%</strong>. Tư vấn & vay vốn miễn phí.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-7 max-w-xl">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm dự án, khu vực, loại hình..."
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    focusRingColor: GOLD,
                  }}
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3.5 font-bold rounded-xl transition-all duration-200 hover:brightness-110 text-sm whitespace-nowrap shadow-lg"
                style={{ background: GOLD, color: NAVY }}
              >
                Tìm kiếm
              </button>
            </form>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-9">
              <a
                href={`/${ROUTES.AI_VALUATION}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:opacity-90 shadow-lg"
                style={{ background: '#ffffff', color: NAVY }}
              >
                <Zap className="w-4 h-4" style={{ color: GOLD }} />
                Định Giá AI Miễn Phí
              </a>
              <a
                href={`/${ROUTES.DU_AN}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm text-white transition-all duration-200 hover:bg-white/15"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                Xem Dự Án
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
              {[
                { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, text: 'Đối tác Vinhomes' },
                { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, text: 'Pháp lý minh bạch' },
                { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, text: 'Tư vấn 0đ' },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1.5">
                  {b.icon}
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Stats cards */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300"
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : `${GOLD}10`,
                  border: `1px solid ${i % 2 === 1 ? `${GOLD}30` : 'rgba(255,255,255,0.09)'}`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-4xl font-black text-white mb-1 tracking-tight" style={i % 2 === 1 ? { color: GOLD } : {}}>{s.value}</div>
                <div className="text-sm font-bold mb-1" style={{ color: GOLD }}>{s.label}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.02) 100%)' }} />
    </section>
  );

  // ── PARTNERS STRIP ─────────────────────────────────────────────────────────
  const partners = (
    <section className="border-y border-gray-100 bg-gray-50 py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest shrink-0">Đối tác chính thức</span>
          {PARTNERS.map(p => (
            <span key={p} className="text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors cursor-default">{p}</span>
          ))}
        </div>
      </div>
    </section>
  );

  // ── FEATURES ───────────────────────────────────────────────────────────────
  const features = (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1 mb-4">
            <span className="text-indigo-600 text-xs font-bold uppercase tracking-widest">Nền Tảng Công Nghệ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Công Cụ Proptech Hàng Đầu</h2>
          <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">SGS LAND tích hợp AI, dữ liệu thị trường và CRM trong một nền tảng duy nhất.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <a
              key={i}
              href={f.href}
              className="group p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 bg-white hover:-translate-y-1"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300"
                style={{ background: `${f.color}15`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{f.desc}</p>
              <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: f.color }}>
                <span>Khám phá</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── PROJECTS ───────────────────────────────────────────────────────────────
  const projects = (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1 mb-3">
              <span className="text-indigo-600 text-xs font-bold uppercase tracking-widest">11+ Dự Án Lớn</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Dự Án SGS LAND Phân Phối</h2>
            <p className="text-gray-500 mt-2">Chỉ phân phối dự án uy tín, pháp lý hoàn chỉnh</p>
          </div>
          <a href={`/${ROUTES.DU_AN}`} className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:text-indigo-700 transition-colors shrink-0">
            Xem tất cả dự án <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROJECTS.map((p, i) => (
            <a
              key={i}
              href={`/${ROUTES.DU_AN}/${p.slug}`}
              className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className={`aspect-[4/3] bg-gradient-to-br ${p.gradient} relative overflow-hidden`}>
                <div className="absolute inset-0 flex items-end p-5">
                  <span className="text-white/20 text-5xl font-black tracking-tighter leading-none">{p.name.split(' ')[0]}</span>
                </div>
                {/* Badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full border border-white/30">{p.badge}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">{p.type}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                <div className="text-sm text-gray-500 mb-4">{p.dev} · {p.loc}</div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Quy mô</div>
                    <div className="text-sm font-semibold text-gray-700">{p.scale}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 mb-0.5">Giá từ</div>
                    <div className="text-sm font-bold text-indigo-600">{p.price}</div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── STATS BANNER ───────────────────────────────────────────────────────────
  const statsBanner = (
    <section className="py-16" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d1535 100%)` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { n: '11+',  label: 'Dự Án Đang Phân Phối' },
            { n: '±5%',  label: 'Độ Chính Xác AI Định Giá' },
            { n: '247+', label: 'Đánh Giá 5 Sao' },
            { n: '2015', label: 'Năm Thành Lập' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-4xl font-black mb-1" style={{ color: i % 2 === 0 ? 'white' : GOLD }}>{s.n}</div>
              <div className="text-sm text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── AI CTA ─────────────────────────────────────────────────────────────────
  const aiCta = (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d1535 100%)`, border: `1px solid ${GOLD}25` }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-15" style={{ background: GOLD, filter: 'blur(80px)' }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: '#6366f1', filter: 'blur(60px)' }} />
          </div>
          <div className="relative">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5 text-sm font-medium"
              style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40`, color: GOLD }}
            >
              <Zap className="w-3.5 h-3.5" />
              AI Định Giá Bất Động Sản
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Biết Giá Thực Của BĐS<br />Trong 3 Giây
            </h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto leading-relaxed">
              Nhập địa chỉ bất kỳ tại TP.HCM. AI phân tích 50+ yếu tố cho kết quả định giá với sai số chỉ ±5%.
            </p>
            <a
              href={`/${ROUTES.AI_VALUATION}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 font-bold rounded-xl transition-all duration-200 hover:brightness-110 text-base shadow-lg"
              style={{ background: GOLD, color: NAVY }}
            >
              <Zap className="w-5 h-5" />
              Định Giá Miễn Phí Ngay
            </a>
          </div>
        </div>
      </div>
    </section>
  );

  // ── TESTIMONIALS ───────────────────────────────────────────────────────────
  const testimonials = (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Khách Hàng Nói Gì?</h2>
          <p className="text-gray-500">Đánh giá thực từ nhà đầu tư và môi giới BĐS</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-indigo-100 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex gap-0.5 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5 italic">"{t.content}"</p>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                <div className="text-gray-400 text-xs">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── CONTACT CTA ────────────────────────────────────────────────────────────
  const contactCta = (
    <section className="py-16 bg-white border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Cần Tư Vấn BĐS Miễn Phí?</h2>
        <p className="text-gray-500 mb-8">Chuyên viên SGS LAND hỗ trợ 7 ngày/tuần. Hotline: 0971.132.378</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="tel:+84971132378"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white transition-all duration-200 hover:brightness-110"
            style={{ background: GOLD, color: NAVY }}
          >
            <Phone className="w-4 h-4" />
            Gọi Ngay: 0971.132.378
          </a>
          <a
            href={`/${ROUTES.SEARCH}`}
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:border-indigo-200 hover:text-indigo-600 transition-colors"
          >
            Xem Sàn Giao Dịch
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  const footer = (
    <footer style={{ background: '#04080F' }} className="text-sm">
      {/* Top gold line */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}50, transparent)` }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">

          {/* Brand col — spans 2 on lg */}
          <div className="col-span-2 lg:col-span-2">
            <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2 mb-4 group w-fit">
              <Logo className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" style={{ color: GOLD } as React.CSSProperties} />
              <span className="font-bold text-base tracking-tight text-white">
                SGS <span style={{ color: GOLD }}>LAND</span>
              </span>
            </a>
            <p className="text-slate-500 leading-relaxed text-sm mb-6 max-w-xs">
              Hệ điều hành Bất động sản tích hợp AI Agent, CRM đa kênh và Tự động hóa quy trình dành cho doanh nghiệp.
            </p>
            {/* Contact */}
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li>
                <a href="tel:+84971132378" className="flex items-center gap-2 hover:text-amber-400 transition-colors">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
                  0971.132.378
                </a>
              </li>
              <li>
                <a href="mailto:info@sgsland.vn" className="flex items-center gap-2 hover:text-amber-400 transition-colors">
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
                  info@sgsland.vn
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                <span>TP. Hồ Chí Minh, Việt Nam</span>
              </li>
            </ul>
          </div>

          {/* Sản Phẩm */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Sản Phẩm</h4>
            <ul className="space-y-2.5">
              <FL label="Sàn Giao Dịch"         href={`/${ROUTES.SEARCH}`} />
              <FL label="Định Giá AI"            href={`/${ROUTES.AI_VALUATION}`} />
              <FL label="SGS CRM"               href={`/${ROUTES.CRM_SOLUTION}`} />
              <FL label="Ký Gửi BĐS"            href={`/${ROUTES.KY_GUI}`} />
              <FL label="Lãi Suất Ngân Hàng"    href="/lai-suat-vay-ngan-hang" />
            </ul>
          </div>

          {/* Dự Án */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Dự Án</h4>
            <ul className="space-y-2.5">
              <FL label="Aqua City"             href={`/${ROUTES.DU_AN}/aqua-city`} />
              <FL label="The Global City"       href={`/${ROUTES.DU_AN}/the-global-city`} />
              <FL label="Izumi City"            href={`/${ROUTES.DU_AN}/izumi-city`} />
              <FL label="Vinhomes Cần Giờ"      href={`/${ROUTES.DU_AN}/vinhomes-can-gio`} />
              <FL label="Diamond Sky"           href={`/${ROUTES.DU_AN}/diamond-sky-van-phuc-city`} />
              <FL label="Vinhomes Grand Park"   href={`/${ROUTES.DU_AN}/vinhomes-grand-park`} />
              <FL label="Vinhomes Central Park" href={`/${ROUTES.DU_AN}/vinhomes-central-park`} />
              <FL label="Sơn Kim Land"          href={`/${ROUTES.DU_AN}/son-kim-land`} />
              <FL label="Xem tất cả →"         href={`/${ROUTES.DU_AN}`} />
            </ul>
          </div>

          {/* Khu Vực */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Khu Vực Nổi Bật</h4>
            <ul className="space-y-2.5">
              <FL label="BĐS Đồng Nai"          href={`/${ROUTES.BDS_DONG_NAI}`} />
              <FL label="BĐS Long Thành"        href={`/${ROUTES.BDS_LONG_THANH}`} />
              <FL label="BĐS Thủ Đức"           href={`/${ROUTES.BDS_THU_DUC}`} />
              <FL label="BĐS Bình Dương"        href={`/${ROUTES.BDS_BINH_DUONG}`} />
              <FL label="BĐS Quận 7"            href={`/${ROUTES.BDS_QUAN_7}`} />
              <FL label="BĐS Phú Nhuận"         href={`/${ROUTES.BDS_PHU_NHUAN}`} />
              <FL label="BĐS Bình Chánh"        href={`/${ROUTES.BDS_BINH_CHANH}`} />
              <FL label="BĐS Bình Thạnh"        href={`/${ROUTES.BDS_BINH_THANH}`} />
              <FL label="BĐS Long An"           href={`/${ROUTES.BDS_LONG_AN}`} />
              <FL label="Đầu Tư BĐS"           href="/dau-tu-bat-dong-san" />
              <FL label="Pháp Lý Nhà Đất"      href="/phap-ly-nha-dat" />
            </ul>
          </div>

          {/* Công Ty + Hỗ Trợ + Pháp Lý */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Về Chúng Tôi</h4>
            <ul className="space-y-2.5 mb-6">
              <FL label="Câu Chuyện"           href={`/${ROUTES.ABOUT}`} />
              <FL label="Tuyển Dụng"           href={`/${ROUTES.CAREERS}`} />
              <FL label="Tin Tức"              href={`/${ROUTES.NEWS}`} />
              <FL label="Liên Hệ"             href={`/${ROUTES.CONTACT}`} />
            </ul>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Hỗ Trợ</h4>
            <ul className="space-y-2.5 mb-6">
              <FL label="Trung Tâm Trợ Giúp"  href={`/${ROUTES.HELP_CENTER}`} />
              <FL label="Hướng Dẫn Sử Dụng"   href={`/${ROUTES.USER_GUIDE}`} />
              <FL label="Tài Liệu API"         href={`/${ROUTES.API_DOCS}`} />
              <FL label="Trạng Thái Hệ Thống" href={`/${ROUTES.STATUS_PUBLIC}`} />
            </ul>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">Pháp Lý</h4>
            <ul className="space-y-2.5">
              <FL label="Chính Sách Bảo Mật"  href={`/${ROUTES.PRIVACY}`} />
              <FL label="Điều Khoản Sử Dụng"  href={`/${ROUTES.TERMS}`} />
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}
        >
          <span className="text-slate-600 text-xs">
            © {new Date().getFullYear()} SGS Land Corp. Bản quyền được bảo hộ. · <a href="https://sgsland.vn" className="hover:text-amber-400 transition-colors">sgsland.vn</a>
          </span>
          {/* Social icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/sgslandvn"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-blue-600 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Facebook"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-blue-700 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="LinkedIn"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://zalo.me/sgsland"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Zalo"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.11-1.35A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1.5 14.5H8a.5.5 0 010-1h3.5V14H8.5a.5.5 0 010-1h3a1 1 0 011 1v1.5a1 1 0 01-1 1zm2-4H8a.5.5 0 010-1h7.5a.5.5 0 010 1zm0-2.5H8a.5.5 0 010-1h7.5a.5.5 0 010 1z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white font-sans">
      {header}
      {hero}
      {partners}
      {features}
      {projects}
      {statsBanner}
      {aiCta}
      {testimonials}
      {contactCta}
      {footer}
    </div>
  );
}
