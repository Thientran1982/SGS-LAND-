import React, { useState } from 'react';
import { 
  Search, ArrowRight, CheckCircle2, Star, Zap, 
  BarChart3, Globe2, Users, MapPin, Phone, 
  Facebook, Youtube, MessageCircle 
} from 'lucide-react';

const PROJECTS = [
  { slug: 'aqua-city', name: 'Aqua City', dev: 'Novaland', loc: 'Biên Hòa, Đồng Nai', scale: '1.000 ha', price: 'Từ 2,5 tỷ', badge: 'Hot', type: 'Đô Thị Sinh Thái', gradient: 'from-[#0A0F1E] to-[#1a365d]' },
  { slug: 'the-global-city', name: 'The Global City', dev: 'Masterise', loc: 'Thủ Đức, TP.HCM', scale: '117 ha', price: 'Từ 4,5 tỷ', badge: 'Cao Cấp', type: 'Đô Thị Tài Chính', gradient: 'from-[#1e1b4b] to-[#312e81]' },
  { slug: 'vinhomes-can-gio', name: 'Vinhomes Cần Giờ', dev: 'Vinhomes', loc: 'Cần Giờ, TP.HCM', scale: '2.870 ha', price: 'Từ 12 tỷ', badge: 'Siêu Dự Án', type: 'Đô Thị Biển', gradient: 'from-[#0f172a] to-[#0369a1]' },
  { slug: 'izumi-city', name: 'Izumi City', dev: 'Nam Long', loc: 'Biên Hòa, Đồng Nai', scale: '170 ha', price: 'Từ 8,4 tỷ', badge: 'Nhật Bản', type: 'Đô Thị Chuẩn Nhật', gradient: 'from-[#27272a] to-[#450a0a]' },
  { slug: 'vinhomes-grand-park', name: 'Vinhomes Grand Park', dev: 'Vinhomes', loc: 'Thủ Đức, TP.HCM', scale: '271 ha', price: 'Từ 1,8 tỷ', badge: 'Best Seller', type: 'Đại Đô Thị', gradient: 'from-[#171717] to-[#4c1d95]' },
  { slug: 'diamond-sky-van-phuc-city', name: 'Diamond Sky', dev: 'Van Phúc', loc: 'TP Thủ Đức, TP.HCM', scale: '198 ha', price: 'Từ 9,6 tỷ', badge: 'Cao Cấp', type: 'Căn Hộ View Sông', gradient: 'from-[#0A0F1E] to-[#b45309]' },
];

const FEATURES = [
  { icon: <Zap className="w-6 h-6" />, title: 'AI Định Giá ±5%', desc: 'Định giá tự động bất kỳ BĐS nào tại TP.HCM với sai số chỉ ±5%. Kết quả trong 3 giây.', href: '/ai-valuation' },
  { icon: <Globe2 className="w-6 h-6" />, title: 'Sàn Giao Dịch', desc: 'Hàng nghìn căn hộ, đất nền, nhà phố được xác minh pháp lý. Kết nối trực tiếp với chủ đầu tư.', href: '/marketplace' },
  { icon: <BarChart3 className="w-6 h-6" />, title: 'Dữ Liệu Thị Trường', desc: 'Báo cáo biến động giá theo quý, xu hướng đầu tư từ 50+ dự án lớn tại TP.HCM.', href: '/market-data' },
  { icon: <Users className="w-6 h-6" />, title: 'CRM Đa Kênh', desc: 'Quản lý khách hàng, tích hợp Zalo/Facebook/Email. Dùng thử miễn phí 30 ngày.', href: '/crm-platform' },
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

export function LandingRedesign() {
  const [search, setSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      window.location.href = `/marketplace?q=${encodeURIComponent(search)}`;
    }
  };

  return (
    <div className="min-h-screen text-slate-800 antialiased" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .font-playfair { font-family: 'Playfair Display', serif; }
        .text-gold { color: #D4A843; }
        .bg-gold { background-color: #D4A843; }
        .border-gold { border-color: #D4A843; }
        .bg-navy { background-color: #060B18; }
        .bg-navy-light { background-color: #0A0F1E; }
        
        .hero-pattern {
          background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}} />

      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 bg-[#060B18]/80 backdrop-blur-md border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="font-playfair font-bold text-2xl tracking-widest text-gold uppercase">SGS LAND</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {['Dự Án', 'Sàn Giao Dịch', 'AI Định Giá', 'Dữ Liệu Thị Trường', 'CRM Platform'].map(link => (
              <a key={link} href="#" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
                {link}
              </a>
            ))}
          </nav>
          <a href="#" className="hidden sm:inline-flex px-5 py-2.5 border border-[#D4A843] text-[#D4A843] rounded hover:bg-[#D4A843] hover:text-[#060B18] transition-all text-sm font-bold tracking-wide">
            Dùng thử miễn phí
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 bg-navy hero-pattern overflow-hidden min-h-[90vh] flex items-center">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#D4A843]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#D4A843]/30 rounded-full bg-[#D4A843]/10 mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse shadow-[0_0_8px_#D4A843]" />
                <span className="text-[#D4A843] text-sm font-semibold tracking-wide uppercase">Nền Tảng Proptech #1 TP.HCM</span>
              </div>

              <h1 className="font-playfair text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                Tìm Kiếm &<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4A843] to-[#F3D37A]">
                  Đầu Tư BĐS
                </span>
                <br />Thông Minh
              </h1>

              <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
                SGS LAND phân phối <span className="text-white font-medium">11+ dự án lớn</span> tại TP.HCM — Aqua City, The Global City, Vinhomes Cần Giờ. Định giá AI sai số <span className="text-gold font-medium">±5%</span>. Tư vấn & vay vốn miễn phí.
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="relative max-w-xl mb-8 group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4A843]/20 to-transparent rounded-xl blur transition-opacity opacity-0 group-focus-within:opacity-100" />
                <div className="relative flex items-center bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-2 focus-within:border-[#D4A843]/50 transition-colors">
                  <Search className="w-5 h-5 text-slate-400 ml-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm dự án, khu vực, loại hình..."
                    className="flex-1 bg-transparent border-none px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
                  />
                  <button type="submit" className="px-6 py-2.5 bg-[#D4A843] text-[#060B18] font-bold rounded-lg hover:bg-[#F3D37A] transition-colors">
                    Tìm kiếm
                  </button>
                </div>
              </form>

              {/* Actions & Trust */}
              <div className="flex flex-wrap items-center gap-4 mb-10">
                <a href="/ai-valuation" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111827] border border-white/10 text-white font-medium rounded-xl hover:border-[#D4A843]/50 transition-all group">
                  <Zap className="w-4 h-4 text-gold group-hover:text-[#F3D37A]" />
                  Định Giá AI Miễn Phí
                </a>
                <a href="/du-an" className="inline-flex items-center gap-2 px-6 py-3 text-slate-300 font-medium hover:text-white transition-colors group">
                  Xem Dự Án
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-gold" />
                </a>
              </div>

              <div className="flex items-center gap-6 text-sm text-slate-400 border-t border-white/10 pt-6 max-w-xl">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Đối tác Vinhomes</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Pháp lý minh bạch</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Tư vấn 0đ</span>
              </div>
            </div>

            {/* Right Content - Stats Grid */}
            <div className="hidden lg:grid lg:col-span-5 grid-cols-2 gap-4">
              {STATS.map((stat, i) => (
                <div key={i} className="bg-navy-light/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-[#D4A843]/30 transition-colors group">
                  <div className="font-playfair text-4xl font-bold text-white mb-2 group-hover:text-gold transition-colors">{stat.value}</div>
                  <div className="font-semibold text-gold text-sm uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className="text-slate-400 text-xs leading-relaxed">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS STRIP */}
      <section className="bg-navy-light border-y border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đối tác chính thức</span>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              {PARTNERS.map(p => (
                <span key={p} className="font-playfair text-xl md:text-2xl font-bold text-slate-400 hover:text-white transition-colors cursor-default">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-24 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-slate-900 mb-6">Công Cụ Proptech Hàng Đầu</h2>
            <p className="text-lg text-slate-600">SGS LAND tích hợp AI, dữ liệu thị trường và CRM trong một nền tảng duy nhất, mang lại lợi thế vượt trội cho nhà đầu tư.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <a key={i} href={f.href} className="group block bg-white rounded-2xl p-8 border-l-4 border-l-[#D4A843] border border-y-slate-100 border-r-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="w-14 h-14 bg-navy-light rounded-xl flex items-center justify-center text-gold mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="font-bold text-xl text-slate-900 mb-3 font-playfair">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{f.desc}</p>
                <span className="inline-flex items-center text-gold font-bold text-sm">
                  Khám phá <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <span className="text-gold font-bold uppercase tracking-wider text-sm mb-3 block">Danh mục đầu tư</span>
              <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Dự Án SGS LAND Phân Phối</h2>
              <p className="text-slate-600 text-lg">Chỉ phân phối dự án uy tín, pháp lý hoàn chỉnh từ các chủ đầu tư hàng đầu Việt Nam.</p>
            </div>
            <a href="/du-an" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-900 text-slate-900 font-bold rounded-xl hover:bg-slate-900 hover:text-white transition-colors">
              Xem tất cả dự án <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PROJECTS.map((p, i) => (
              <a key={i} href={`/du-an/${p.slug}`} className="group block rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 hover:shadow-2xl hover:shadow-navy/10 transition-all duration-300">
                <div className={`aspect-[4/3] bg-gradient-to-br ${p.gradient} relative overflow-hidden flex flex-col justify-between p-6`}>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  
                  {/* Fake architecture lines for texture */}
                  <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '30px 30px'}} />
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-3 py-1 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-md shadow-lg">
                      {p.badge}
                    </span>
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="font-playfair text-3xl font-bold text-white mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">{p.name}</h3>
                    <div className="text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">{p.type}</div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <MapPin className="w-4 h-4" />
                    {p.loc}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-100 mb-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Chủ đầu tư</div>
                      <div className="font-medium text-slate-900">{p.dev}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">Quy mô</div>
                      <div className="font-medium text-slate-900">{p.scale}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-sm">Giá rumor</span>
                    <span className="font-playfair font-bold text-xl text-slate-900">{p.price}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section className="py-20 bg-navy relative overflow-hidden border-y border-[#D4A843]/20">
        <div className="absolute inset-0 bg-[#D4A843]/5 hero-pattern" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 divide-x divide-white/10">
            {[
              { n: '11+', label: 'Dự Án Đang Phân Phối' },
              { n: '±5%', label: 'Độ Chính Xác AI Định Giá' },
              { n: '247+', label: 'Đánh Giá 5 Sao' },
              { n: '2015', label: 'Năm Thành Lập' },
            ].map((s, i) => (
              <div key={i} className="text-center px-4">
                <div className="font-playfair text-4xl md:text-5xl font-black text-gold mb-3 drop-shadow-[0_0_15px_rgba(212,168,67,0.3)]">{s.n}</div>
                <div className="text-slate-300 font-medium text-sm md:text-base tracking-wide uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI VALUATION CTA */}
      <section className="py-24 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-navy-light p-10 md:p-16 border border-[#D4A843]/30 relative overflow-hidden shadow-2xl shadow-navy/20 text-center">
            {/* Background elements */}
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="w-64 h-64 text-gold" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-[#D4A843]/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 mb-8 text-gold">
                <Zap className="w-8 h-8" />
              </div>
              <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                Biết Giá Thực Của BĐS Trong 3 Giây
              </h2>
              <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
                Nhập địa chỉ bất kỳ tại TP.HCM. AI phân tích 50+ yếu tố cho kết quả định giá với sai số chỉ <span className="text-gold font-bold">±5%</span>.
              </p>
              <a href="/ai-valuation" className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-[#F3D37A] transition-all text-lg shadow-[0_0_20px_rgba(212,168,67,0.4)] hover:shadow-[0_0_30px_rgba(212,168,67,0.6)] hover:-translate-y-1">
                Định Giá Miễn Phí Ngay
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-gold font-bold uppercase tracking-wider text-sm mb-3 block">Uy tín tạo nên thương hiệu</span>
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-slate-900">Khách Hàng Nói Gì?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-gold/30 transition-all duration-300">
                <div className="flex gap-1 mb-6">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-slate-600 leading-relaxed mb-8 italic text-lg">"{t.content}"</p>
                <div className="border-t border-slate-100 pt-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-playfair font-bold text-xl">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="text-sm text-gold font-medium uppercase tracking-wide">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-slate-900 mb-6">Cần Tư Vấn BĐS Miễn Phí?</h2>
          <p className="text-lg text-slate-600 mb-10">Chuyên viên SGS LAND hỗ trợ 7 ngày/tuần. Hotline: <span className="font-bold text-navy">0971.132.378</span></p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="tel:+84971132378" className="inline-flex items-center gap-2 px-8 py-4 bg-navy text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg">
              <Phone className="w-5 h-5 text-gold" />
              Gọi Ngay: 0971.132.378
            </a>
            <a href="/marketplace" className="inline-flex items-center gap-2 px-8 py-4 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:border-navy hover:text-navy transition-colors">
              Xem Sàn Giao Dịch
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#04080F] pt-20 pb-10 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="font-playfair font-bold text-3xl tracking-widest text-gold uppercase mb-6">SGS LAND</div>
              <p className="text-slate-400 leading-relaxed mb-8 max-w-sm">
                Nền Tảng Proptech #1 TP.HCM. Giải pháp công nghệ toàn diện cho tìm kiếm, định giá và giao dịch bất động sản cao cấp.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-gold hover:text-navy hover:border-gold transition-all">
                  <MessageCircle className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-gold hover:text-navy hover:border-gold transition-all">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-gold hover:text-navy hover:border-gold transition-all">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-bold mb-6 tracking-wide">Sản Phẩm</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><a href="#" className="hover:text-gold transition-colors">AI Định Giá</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Dữ Liệu Thị Trường</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Sàn Giao Dịch</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">CRM Platform</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 tracking-wide">Dự Án</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><a href="#" className="hover:text-gold transition-colors">Aqua City</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">The Global City</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Vinhomes Cần Giờ</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Tất cả dự án</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 tracking-wide">Pháp Lý & Hỗ Trợ</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><a href="#" className="hover:text-gold transition-colors">Trung tâm trợ giúp</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Điều khoản sử dụng</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Liên hệ tư vấn</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div>&copy; 2025 SGS LAND. Bảo lưu mọi quyền.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-gold transition-colors">Chính sách bảo mật</a>
              <a href="#" className="hover:text-gold transition-colors">Điều khoản sử dụng</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
