
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, ArrowRight, CheckCircle2, Star, ChevronRight, Zap, BarChart3, Globe2, Users } from 'lucide-react';

// ─── Static project data ───────────────────────────────────────────────────
const PROJECTS = [
  { slug: 'aqua-city', name: 'Aqua City', dev: 'Novaland', loc: 'Biên Hòa, Đồng Nai', scale: '1.000 ha', price: 'Từ 2,5 tỷ', badge: 'Hot', img: 'https://sgsland.vn/aqua-city.jpg', type: 'Đô Thị Sinh Thái' },
  { slug: 'the-global-city', name: 'The Global City', dev: 'Masterise', loc: 'Thủ Đức, TP.HCM', scale: '117 ha', price: 'Từ 4,5 tỷ', badge: 'Cao Cấp', img: 'https://sgsland.vn/global-city.jpg', type: 'Đô Thị Tài Chính' },
  { slug: 'vinhomes-can-gio', name: 'Vinhomes Cần Giờ', dev: 'Vinhomes', loc: 'Cần Giờ, TP.HCM', scale: '2.870 ha', price: 'Từ 12 tỷ', badge: 'Siêu Dự Án', img: 'https://sgsland.vn/vinhomes-can-gio.jpg', type: 'Đô Thị Biển' },
  { slug: 'izumi-city', name: 'Izumi City', dev: 'Nam Long', loc: 'Biên Hòa, Đồng Nai', scale: '170 ha', price: 'Từ 8,4 tỷ', badge: 'Nhật Bản', img: 'https://sgsland.vn/izumi-city.jpg', type: 'Đô Thị Chuẩn Nhật' },
  { slug: 'vinhomes-grand-park', name: 'Vinhomes Grand Park', dev: 'Vinhomes', loc: 'Thủ Đức, TP.HCM', scale: '271 ha', price: 'Từ 1,8 tỷ', badge: 'Best Seller', img: 'https://sgsland.vn/vinhomes-grand-park.jpg', type: 'Đại Đô Thị' },
  { slug: 'diamond-sky-van-phuc-city', name: 'Diamond Sky', dev: 'Tập đoàn Van Phúc', loc: 'TP Thủ Đức, TP.HCM', scale: '198 ha', price: 'Từ 9,6 tỷ', badge: 'Cao Cấp', img: 'https://sgsland.vn/diamond-sky.jpg', type: 'Căn Hộ View Sông' },
];

const FEATURES = [
  { icon: <Zap className="w-6 h-6" />, title: 'AI Định Giá ±5%', desc: 'Định giá tự động bất kỳ BĐS nào tại TP.HCM với sai số chỉ ±5%. Kết quả trong 3 giây.', color: 'indigo', href: '/ai-valuation' },
  { icon: <Globe2 className="w-6 h-6" />, title: 'Sàn Giao Dịch', desc: 'Hàng nghìn căn hộ, đất nền, nhà phố được xác minh pháp lý. Kết nối trực tiếp với chủ đầu tư.', color: 'violet', href: '/marketplace' },
  { icon: <BarChart3 className="w-6 h-6" />, title: 'Dữ Liệu Thị Trường', desc: 'Báo cáo biến động giá theo quý, xu hướng đầu tư từ 50+ dự án lớn tại TP.HCM.', color: 'blue', href: '/market-data' },
  { icon: <Users className="w-6 h-6" />, title: 'CRM Đa Kênh', desc: 'Quản lý khách hàng, tích hợp Zalo/Facebook/Email. Dùng thử miễn phí 30 ngày.', color: 'sky', href: '/crm-platform' },
];

const STATS = [
  { value: '11+', label: 'Dự Án Lớn', sub: 'Vinhomes, Novaland, Nam Long...' },
  { value: '±5%', label: 'Chính Xác AI', sub: 'Sai số định giá tự động' },
  { value: '3+', label: 'Tỉnh Thành', sub: 'TP.HCM, Đồng Nai, Bình Dương' },
  { value: '1/7', label: 'Hỗ Trợ', sub: 'Pháp lý & vay vốn miễn phí' },
];

const PARTNERS = ['Vinhomes', 'Novaland', 'Nam Long', 'Masterise', 'Van Phúc'];

const TESTIMONIALS = [
  { name: 'Nguyễn Minh Tuấn', role: 'Nhà đầu tư', content: 'AI định giá của SGS LAND rất chính xác, giúp tôi mua được căn hộ Vinhomes đúng giá thị trường.', rating: 5 },
  { name: 'Trần Thị Lan Anh', role: 'Môi giới BĐS', content: 'CRM platform giúp tôi quản lý 200+ khách hàng dễ dàng. Doanh số tăng 40% sau 3 tháng sử dụng.', rating: 5 },
  { name: 'Lê Thành Đạt', role: 'Nhà đầu tư', content: 'Dữ liệu thị trường SGS LAND cực kỳ chi tiết, giúp tôi quyết định đầu tư đúng thời điểm.', rating: 5 },
];

// ─── Component ────────────────────────────────────────────────────────────
export default function Landing() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const router = { push: (url: string) => { if (typeof window !== 'undefined') window.location.href = url; } };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/marketplace?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        {/* Background mesh */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-violet-500 rounded-full blur-[100px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px'}} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-400/30 rounded-full px-4 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-indigo-300 text-sm font-medium">Nền Tảng Proptech #1 TP.HCM</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
                Tìm Kiếm &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  Đầu Tư BĐS
                </span>
                {' '}Thông Minh
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-lg">
                SGS LAND phân phối <strong className="text-white">11+ dự án lớn</strong> tại TP.HCM — Aqua City, The Global City, Vinhomes Cần Giờ. 
                Định giá AI sai số <strong className="text-indigo-400">±5%</strong>. Tư vấn & vay vốn miễn phí.
              </p>

              {/* Search bar */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-lg">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm dự án, khu vực, loại hình..."
                    className="w-full pl-10 pr-4 py-3.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/15 transition-all"
                  />
                </div>
                <button type="submit" className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm whitespace-nowrap">
                  Tìm kiếm
                </button>
              </form>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3 mb-8">
                <a href="/ai-valuation" className="inline-flex items-center gap-2 px-5 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-sm">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  Định Giá AI Miễn Phí
                </a>
                <a href="/du-an" className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/15 transition-colors text-sm">
                  Xem Dự Án
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-4 text-slate-400 text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đối tác Vinhomes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pháp lý minh bạch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tư vấn 0đ</span>
                </div>
              </div>
            </div>

            {/* Right: Stats cards */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {STATS.map((s, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                  <div className="text-sm font-semibold text-indigo-300 mb-1">{s.label}</div>
                  <div className="text-xs text-slate-400">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PARTNERS STRIP ────────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Đối tác chính thức</span>
            {PARTNERS.map(p => (
              <span key={p} className="text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors cursor-default">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1 mb-4">
              <span className="text-indigo-600 text-xs font-semibold uppercase tracking-wider">Nền Tảng Công Nghệ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Công Cụ Proptech Hàng Đầu</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">SGS LAND tích hợp AI, dữ liệu thị trường và CRM trong một nền tảng duy nhất.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <a key={i} href={f.href} className="group p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all bg-white">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-${f.color}-50 text-${f.color}-600 group-hover:bg-${f.color}-100 transition-colors`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{f.desc}</p>
                <div className="flex items-center gap-1 text-indigo-600 text-sm font-medium">
                  <span>Khám phá</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROJECTS ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1 mb-3">
                <span className="text-indigo-600 text-xs font-semibold uppercase tracking-wider">11+ Dự Án Lớn</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Dự Án SGS LAND Phân Phối</h2>
              <p className="text-gray-500 mt-2">Chỉ phân phối dự án uy tín, pháp lý hoàn chỉnh</p>
            </div>
            <a href="/du-an" className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:text-indigo-700 transition-colors shrink-0">
              Xem tất cả dự án
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROJECTS.map((p, i) => (
              <a key={i} href={`/du-an/${p.slug}`} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all">
                {/* Image placeholder */}
                <div className="aspect-[4/3] bg-gradient-to-br from-indigo-100 to-violet-100 relative overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-0">
                    <span className="text-3xl font-black text-indigo-200">{p.name[0]}</span>
                  </div>
                  {/* Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">{p.badge}</span>
                  </div>
                </div>
                {/* Content */}
                <div className="p-5">
                  <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-1">{p.type}</div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                  <div className="text-sm text-gray-500 mb-3">{p.dev} · {p.loc}</div>
                  <div className="flex items-center justify-between">
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

      {/* ── STATS BANNER ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center text-white">
            {[
              { n: '11+', label: 'Dự Án Đang Phân Phối' },
              { n: '±5%', label: 'Độ Chính Xác AI Định Giá' },
              { n: '247+', label: 'Đánh Giá 5 Sao' },
              { n: '2015', label: 'Năm Thành Lập' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-4xl font-black mb-1">{s.n}</div>
                <div className="text-indigo-200 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI VALUATION CTA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500 rounded-full blur-[60px]" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 rounded-full px-4 py-1.5 mb-5">
                <Zap className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-indigo-300 text-sm font-medium">AI Định Giá Bất Động Sản</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Biết Giá Thực Của BĐS<br />Trong 3 Giây
              </h2>
              <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                Nhập địa chỉ bất kỳ tại TP.HCM. AI phân tích 50+ yếu tố cho kết quả định giá với sai số chỉ ±5%.
              </p>
              <a href="/ai-valuation" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors text-base">
                <Zap className="w-5 h-5 text-indigo-600" />
                Định Giá Miễn Phí Ngay
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Khách Hàng Nói Gì?</h2>
            <p className="text-gray-500">Đánh giá thực từ nhà đầu tư và môi giới BĐS</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all">
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

      {/* ── CONTACT CTA ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Cần Tư Vấn BĐS Miễn Phí?</h2>
          <p className="text-gray-500 mb-8">Chuyên viên SGS LAND hỗ trợ 7 ngày/tuần. Hotline: 0971.132.378</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:+84971132378" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
              Gọi Ngay: 0971.132.378
            </a>
            <a href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:border-indigo-200 hover:text-indigo-600 transition-colors">
              Xem Sàn Giao Dịch
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
