import React, { useState, useEffect } from 'react';
import { useTranslation } from '../services/i18n';
import {
  Search, ArrowRight, Zap, BarChart3, Globe2, Users,
  CheckCircle2, Star, Menu, X, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';

// ─── Design tokens — 100% clean, minimal ─────────────────────────────────────
const NAVY    = '#0A0F1E';
const GOLD    = '#C9A84C';
const WHITE   = '#FFFFFF';
const OFF     = '#F7F7F6';   // one off-white for alt sections
const BORDER  = '#E5E5E3';
const TEXT1   = '#0F172A';
const TEXT2   = '#6B7280';

// ─── Static data ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Dự Án',         href: `/${ROUTES.DU_AN}` },
  { label: 'Sàn Giao Dịch', href: `/${ROUTES.SEARCH}` },
  { label: 'Định Giá AI',   href: `/${ROUTES.AI_VALUATION}` },
  { label: 'Dữ Liệu TT',    href: '/market-data' },
  { label: 'CRM Platform',  href: `/${ROUTES.CRM_SOLUTION}` },
];

const EN_NAV: Record<string, string> = {
  'Dự Án': 'Projects', 'Sàn Giao Dịch': 'Exchange',
  'Định Giá AI': 'AI Valuation', 'Dữ Liệu TT': 'Market Data', 'CRM Platform': 'CRM Platform',
};

const PARTNERS = ['Vinhomes', 'Novaland', 'Nam Long', 'Masterise', 'Van Phúc', 'Khang Điền', 'Sơn Kim Land'];

const PROJECTS_DATA = [
  { slug: 'aqua-city',               image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', vi: { name: 'Aqua City',           dev: 'Novaland',  loc: 'Biên Hòa, Đồng Nai', price: 'Từ 2,5 tỷ',  badge: 'Hot',         type: 'Đô Thị Sinh Thái' }, en: { name: 'Aqua City',           dev: 'Novaland',  loc: 'Bien Hoa, Dong Nai', price: 'From 2.5B',  badge: 'Hot',         type: 'Eco Township' } },
  { slug: 'the-global-city',         image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80', vi: { name: 'The Global City',     dev: 'Masterise', loc: 'Thủ Đức, TP.HCM',    price: 'Từ 4,5 tỷ',  badge: 'Cao Cấp',     type: 'Đô Thị Tài Chính' }, en: { name: 'The Global City',     dev: 'Masterise', loc: 'Thu Duc, HCMC',     price: 'From 4.5B',  badge: 'Premium',     type: 'Financial Township' } },
  { slug: 'vinhomes-can-gio',        image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', vi: { name: 'Vinhomes Cần Giờ',   dev: 'Vinhomes',  loc: 'Cần Giờ, TP.HCM',    price: 'Từ 12 tỷ',   badge: 'Mega',        type: 'Đô Thị Biển' },    en: { name: 'Vinhomes Can Gio',    dev: 'Vinhomes',  loc: 'Can Gio, HCMC',     price: 'From 12B',   badge: 'Mega',        type: 'Coastal City' } },
  { slug: 'izumi-city',              image: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80', vi: { name: 'Izumi City',          dev: 'Nam Long',  loc: 'Biên Hòa, Đồng Nai', price: 'Từ 8,4 tỷ',  badge: 'Nhật Bản',    type: 'Chuẩn Nhật Bản' }, en: { name: 'Izumi City',          dev: 'Nam Long',  loc: 'Bien Hoa, Dong Nai', price: 'From 8.4B',  badge: 'Japanese',    type: 'Japanese Standard' } },
  { slug: 'vinhomes-grand-park',     image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80', vi: { name: 'Vinhomes Grand Park', dev: 'Vinhomes',  loc: 'Thủ Đức, TP.HCM',    price: 'Từ 1,8 tỷ',  badge: 'Best Seller', type: 'Đại Đô Thị' },    en: { name: 'Vinhomes Grand Park', dev: 'Vinhomes',  loc: 'Thu Duc, HCMC',     price: 'From 1.8B',  badge: 'Best Seller', type: 'Grand Township' } },
  { slug: 'diamond-sky-van-phuc-city', image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80', vi: { name: 'Diamond Sky',       dev: 'Van Phúc',  loc: 'Thủ Đức, TP.HCM',    price: 'Từ 9,6 tỷ',  badge: 'Cao Cấp',     type: 'Căn Hộ View Sông' }, en: { name: 'Diamond Sky',         dev: 'Van Phuc',  loc: 'Thu Duc, HCMC',     price: 'From 9.6B',  badge: 'Premium',     type: 'River View' } },
];

const TESTIMONIALS_DATA = [
  { name: 'Nguyễn Minh Tuấn', role_vi: 'Nhà đầu tư',   role_en: 'Investor',           content_vi: 'AI định giá của SGS LAND rất chính xác, giúp tôi mua được căn hộ Vinhomes đúng giá thị trường.', content_en: 'SGS LAND AI valuation is very accurate, helping me buy a Vinhomes apartment at market price.' },
  { name: 'Trần Thị Lan Anh', role_vi: 'Môi giới BĐS', role_en: 'Real Estate Agent',  content_vi: 'CRM platform giúp tôi quản lý 200+ khách hàng dễ dàng. Doanh số tăng 40% sau 3 tháng sử dụng.', content_en: 'CRM platform helps me manage 200+ clients easily. Revenue increased 40% after 3 months.' },
  { name: 'Lê Thành Đạt',     role_vi: 'Nhà đầu tư',   role_en: 'Investor',           content_vi: 'Dữ liệu thị trường SGS LAND cực kỳ chi tiết, giúp tôi quyết định đầu tư đúng thời điểm.',      content_en: 'SGS LAND market data is extremely detailed, helping me decide on investments at the right time.' },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const HOME_FAQ_VI = [
  { q: 'SGS LAND là gì? SGS LAND phân phối những dự án nào?', a: 'SGS LAND là đại lý phân phối bất động sản tại TP.HCM, chuyên các dự án lớn: Aqua City Novaland (1.000ha, Biên Hòa, Đồng Nai), The Global City Masterise Homes (117ha, Thủ Đức), Izumi City Nam Long (170ha, Biên Hòa), Vinhomes Cần Giờ (2.870ha), Masterise Homes (Masteri, Lumière, Grand Marina), Vinhomes Grand Park (271ha, Thủ Đức). Tư vấn miễn phí tại sgsland.vn hoặc hotline 0971 132 378.' },
  { q: 'Mua bất động sản qua SGS LAND có mất phí môi giới không?', a: 'Không. SGS LAND không thu phí môi giới từ người mua. Doanh thu của SGS LAND đến từ hoa hồng do chủ đầu tư trả theo hợp đồng phân phối. Khách hàng được tư vấn pháp lý, kiểm tra hợp đồng và hỗ trợ hồ sơ vay vốn hoàn toàn miễn phí.' },
  { q: 'Công cụ định giá AI của SGS LAND hoạt động như thế nào?', a: 'Hệ thống định giá AI (AVM) của SGS LAND phân tích dữ liệu giao dịch thực tế, quy hoạch đô thị, hạ tầng và xu hướng thị trường để cho ra giá ước tính với sai số ±5%. Người dùng nhập địa chỉ, diện tích và loại hình tài sản — hệ thống trả kết quả trong vài giây, không cần đăng nhập.' },
  { q: 'Dự án nào đang mở bán và có thể đặt chỗ ưu tiên qua SGS LAND?', a: 'Tính đến tháng 4/2026: Aqua City Novaland (Biên Hòa, Đồng Nai) đang bàn giao nhiều phân khu, có sổ hồng riêng, giá từ 6,5 tỷ. Izumi City Nam Long mở giai đoạn mới từ 8,4 tỷ. The Global City Masterise đang nhận đặt cọc từ 15 tỷ. Vinhomes Cần Giờ đã mở bán từ 12 tỷ. Liên hệ 0971 132 378 để nhận bảng giá và tiến độ mới nhất.' },
  { q: 'SGS LAND hỗ trợ vay vốn ngân hàng như thế nào?', a: 'SGS LAND kết nối khách hàng với các ngân hàng đối tác: Vietcombank, BIDV, Techcombank, VPBank — hỗ trợ vay tối đa 70% giá trị căn, kỳ hạn 20–25 năm, lãi suất ưu đãi 12–24 tháng đầu. Đội ngũ pháp lý kiểm tra hợp đồng mua bán và hồ sơ vay miễn phí trước khi ký.' },
  { q: 'Bất động sản Đồng Nai có tiềm năng đầu tư không?', a: 'Theo CBRE Vietnam và Savills Vietnam, bất động sản vùng ven TP.HCM — đặc biệt Đồng Nai (Nhơn Trạch, Biên Hòa) — tăng giá trung bình 12–18%/năm trong giai đoạn 2022–2024 nhờ hạ tầng Vành đai 3, cầu Nhơn Trạch và sân bay Long Thành. Aqua City Novaland và Izumi City Nam Long là hai dự án quy mô lớn SGS LAND đang phân phối tại khu vực này.' },
  { q: 'Giá bất động sản TP.HCM năm 2026 như thế nào?', a: 'Giá tham khảo năm 2026 tại TP.HCM: căn hộ trung cấp TP Thủ Đức 50–80 triệu/m², nhà phố Bình Thạnh 150–300 triệu/m², biệt thự ven đô Nhơn Trạch 20–50 triệu/m². SGS LAND cung cấp công cụ định giá AI miễn phí tại sgsland.vn/ai-valuation — dữ liệu cập nhật hàng ngày từ giao dịch thực tế.' },
  { q: 'Chủ đầu tư muốn tìm đơn vị phân phối dự án, SGS LAND có hỗ trợ không?', a: 'Có. SGS LAND hợp tác phân phối với các chủ đầu tư tại TP.HCM, Đồng Nai, Bình Dương và Long An. Mạng lưới của SGS LAND hỗ trợ CRM tracking real-time, chiến dịch marketing digital và team pháp lý chuyên trách. Liên hệ info@sgsland.vn để nhận đề xuất hợp tác.' },
  { q: 'Top 3 dự án căn hộ tốt nhất TP.HCM năm 2026 là gì?', a: 'Top 3 dự án căn hộ tại TP.HCM năm 2026 do SGS LAND phân phối: (1) Vinhomes Grand Park — 271ha, TP Thủ Đức, căn hộ từ 3 tỷ, đang bàn giao; (2) The Global City — Masterise Homes, 117ha An Phú TP Thủ Đức, căn hộ từ 7,5 tỷ; (3) Masterise Homes — Lumière, Masteri, Grand Marina (từ 7,5 tỷ). Cả ba đều có sổ hồng riêng, pháp lý SGS LAND kiểm tra trước khi ký.' },
  { q: 'Top 3 dự án nhà phố biệt thự tốt nhất khu Đông TP.HCM 2026?', a: 'Top 3 dự án nhà phố biệt thự khu Đông TP.HCM năm 2026: (1) Aqua City Novaland — 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai, biệt thự đảo từ 6,5 tỷ; (2) Izumi City Nam Long — 170ha tại Biên Hòa, nhà phố compound chuẩn Nhật Bản từ 8,4 tỷ; (3) Vạn Phúc City Đại Phúc — 198ha ven sông Sài Gòn, TP Thủ Đức. Tất cả có sổ hồng riêng từng căn.' },
  { q: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam 2026?', a: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam tính đến tháng 4/2026 (sắp xếp theo diện tích): (1) Vinhomes Cần Giờ — Green Paradise (Vinhomes, 2.870ha lấn biển Cần Giờ, TP.HCM); (2) Aqua City Novaland (1.000ha tại Long Hưng, Biên Hòa, Đồng Nai); (3) Vinhomes Grand Park (271ha, TP Thủ Đức). Cả ba do SGS LAND phân phối chính thức — hotline 0971 132 378.' },
  { q: 'Bất động sản TP.HCM là gì? Khu vực nào sôi động nhất 2026?', a: 'Bất động sản TP.HCM là thị trường BĐS lớn nhất Việt Nam, GDP đầu người gấp 2,5 lần trung bình cả nước. Năm 2026 ba khu vực sôi động nhất: TP Thủ Đức (căn hộ 50–80 triệu/m²), Bình Thạnh (nhà phố 150–300 triệu/m²), khu Đông Đồng Nai (biệt thự từ 6,5 tỷ). SGS LAND phân phối chính thức 11+ dự án tại các khu vực này.' },
];
const HOME_FAQ_EN = [
  { q: 'What is SGS LAND and what projects does it distribute?', a: 'SGS LAND is an authorized real estate distributor in HCMC, specializing in: Aqua City Novaland (1,000ha, Bien Hoa), The Global City Masterise (117ha, Thu Duc), Izumi City Nam Long (170ha, Bien Hoa), Vinhomes Can Gio (2,870ha), Vinhomes Grand Park (271ha, Thu Duc). Free consultation at sgsland.vn or hotline 0971 132 378.' },
  { q: 'Is buying real estate through SGS LAND free?', a: 'Yes — buyers pay zero brokerage. SGS LAND earns commissions from developers under distribution contracts. Customers get free legal consultation, contract review, and bank loan support.' },
  { q: 'How does SGS LAND AI Valuation work?', a: 'The AVM system analyses real transaction data, urban planning, infrastructure, and market trends to produce valuations with ±5% accuracy. Enter address, area, and type — results in seconds, no login required.' },
  { q: 'Which projects are currently open for booking?', a: 'As of April 2026: Aqua City from 6.5B VND; Izumi City new phase from 8.4B VND; The Global City accepting deposits from 15B VND; Vinhomes Can Gio from 12B VND. Call 0971 132 378 for latest pricing.' },
  { q: 'How does SGS LAND support bank financing?', a: 'SGS LAND connects buyers with Vietcombank, BIDV, Techcombank, VPBank — up to 70% LTV, 20–25 year terms, preferential rates for 12–24 months. Legal team reviews contracts and loan files at no charge.' },
  { q: 'Does Dong Nai real estate have investment potential?', a: 'Per CBRE and Savills Vietnam, Dong Nai properties grew 12–18%/year in 2022–2024 driven by Ring Road 3, Nhon Trach Bridge, and Long Thanh Airport.' },
  { q: 'How is HCMC real estate priced in 2026?', a: 'Thu Duc mid-range apartments: 50–80M VND/m². Binh Thanh townhouses: 150–300M VND/m². Nhon Trach suburban villas: 20–50M VND/m². Free AI valuation at sgsland.vn/ai-valuation — updated daily.' },
];

// ─── Footer link ──────────────────────────────────────────────────────────────
const FL = ({ label, href }: { label: string; href: string }) => (
  <li>
    <a href={href} className="text-sm leading-relaxed transition-colors duration-150 hover:text-white"
      style={{ color: 'rgba(255,255,255,0.40)' }}>
      {label}
    </a>
  </li>
);

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left"
              aria-expanded={isOpen}>
              <span className="font-semibold text-sm sm:text-[15px] leading-snug"
                style={{ color: isOpen ? GOLD : TEXT1 }} role="heading" aria-level={3}>
                {item.q}
              </span>
              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-200"
                style={{
                  background: isOpen ? GOLD : 'transparent',
                  border: `1.5px solid ${isOpen ? GOLD : BORDER}`,
                  color: isOpen ? NAVY : TEXT2,
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <p className="pb-5 text-sm leading-relaxed" style={{ color: TEXT2 }}>
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Landing() {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [search, setSearch]       = useState('');
  const [scrolled, setScrolled]   = useState(false);
  const { language, setLanguage } = useTranslation();
  const vi = language === 'vn';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    window.location.href = q ? `/${ROUTES.SEARCH}?q=${encodeURIComponent(q)}` : `/${ROUTES.SEARCH}`;
  };

  const projects   = PROJECTS_DATA.map(p => ({ ...p, ...(vi ? p.vi : p.en) }));
  const faqItems   = vi ? HOME_FAQ_VI : HOME_FAQ_EN;

  const FEATURES = vi ? [
    { icon: <Zap className="w-5 h-5" />,       title: 'AI Định Giá ±5%',    desc: 'Định giá tự động với sai số ±5%. Kết quả trong 3 giây.',              href: `/${ROUTES.AI_VALUATION}` },
    { icon: <Globe2 className="w-5 h-5" />,    title: 'Sàn Giao Dịch',     desc: 'Hàng nghìn BĐS xác minh pháp lý. Kết nối trực tiếp chủ đầu tư.',    href: `/${ROUTES.SEARCH}` },
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Dữ Liệu Thị Trường', desc: 'Báo cáo giá theo quý từ 50+ dự án lớn TP.HCM & vùng ven.',           href: '/market-data' },
    { icon: <Users className="w-5 h-5" />,     title: 'CRM Đa Kênh',        desc: 'Quản lý khách hàng, tích hợp Zalo/FB/Email. Dùng thử miễn phí 30 ngày.', href: `/${ROUTES.CRM_SOLUTION}` },
  ] : [
    { icon: <Zap className="w-5 h-5" />,       title: 'AI Valuation ±5%',   desc: 'Automated valuation with ±5% accuracy. Results in 3 seconds.',       href: `/${ROUTES.AI_VALUATION}` },
    { icon: <Globe2 className="w-5 h-5" />,    title: 'Exchange',           desc: 'Thousands of verified properties. Connect directly with developers.', href: `/${ROUTES.SEARCH}` },
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Market Data',        desc: 'Quarterly price reports from 50+ major HCMC projects.',               href: '/market-data' },
    { icon: <Users className="w-5 h-5" />,     title: 'Multi-Channel CRM',  desc: 'Client management with Zalo/FB/Email. Free 30-day trial.',            href: `/${ROUTES.CRM_SOLUTION}` },
  ];

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const header = (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? WHITE : 'transparent',
        borderBottom: scrolled ? `1px solid ${BORDER}` : '1px solid transparent',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.07)' : 'none',
      }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2 shrink-0">
            <Logo className="w-[18px] h-[18px]" stroke={scrolled ? NAVY : WHITE} />
            <span className="font-bold text-[15px] tracking-tight transition-colors"
              style={{ color: scrolled ? NAVY : WHITE }}>
              SGS LAND
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="px-3 py-1.5 text-[13.5px] font-medium rounded-md transition-colors duration-150"
                style={{ color: scrolled ? TEXT2 : 'rgba(255,255,255,0.72)' }}
                onMouseEnter={e => (e.currentTarget.style.color = scrolled ? TEXT1 : WHITE)}
                onMouseLeave={e => (e.currentTarget.style.color = scrolled ? TEXT2 : 'rgba(255,255,255,0.72)')}>
                {vi ? l.label : (EN_NAV[l.label] || l.label)}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(vi ? 'en' : 'vn')}
              className="hidden sm:flex h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-wide transition-colors"
              style={{ color: scrolled ? TEXT2 : 'rgba(255,255,255,0.50)', border: `1px solid ${scrolled ? BORDER : 'rgba(255,255,255,0.25)'}` }}>
              {vi ? 'EN' : 'VI'}
            </button>
            <a href={`/${ROUTES.LOGIN}`}
              className="hidden sm:inline-flex items-center h-8 px-4 text-[13px] font-medium rounded-lg transition-colors"
              style={{ color: scrolled ? TEXT1 : WHITE, border: `1px solid ${scrolled ? BORDER : 'rgba(255,255,255,0.30)'}` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.color = GOLD; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = scrolled ? BORDER : 'rgba(255,255,255,0.30)'; (e.currentTarget as HTMLElement).style.color = scrolled ? TEXT1 : WHITE; }}>
              {vi ? 'Đăng nhập' : 'Sign in'}
            </a>
            <a href={`/${ROUTES.AI_VALUATION}`}
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-4 text-[13px] font-bold rounded-lg transition-opacity hover:opacity-90"
              style={{ background: GOLD, color: NAVY }}>
              <Zap className="w-3.5 h-3.5" />
              {vi ? 'Định Giá AI' : 'AI Valuation'}
            </a>
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden w-8 h-8 flex items-center justify-center"
              style={{ color: scrolled ? TEXT1 : WHITE }}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden" style={{ background: WHITE, borderTop: `1px solid ${BORDER}` }}>
          <div className="max-w-7xl mx-auto px-5 py-3 space-y-0.5">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors hover:bg-gray-50"
                style={{ color: TEXT1 }}>
                {vi ? l.label : (EN_NAV[l.label] || l.label)}
              </a>
            ))}
            <div className="pt-3 mt-1 border-t flex gap-2" style={{ borderColor: BORDER }}>
              <a href={`/${ROUTES.LOGIN}`} className="flex-1 text-center py-2.5 text-sm font-medium rounded-lg border" style={{ borderColor: BORDER, color: TEXT1 }}>
                {vi ? 'Đăng nhập' : 'Sign in'}
              </a>
              <a href={`/${ROUTES.AI_VALUATION}`} className="flex-1 text-center py-2.5 text-sm font-bold rounded-lg" style={{ background: GOLD, color: NAVY }}>
                {vi ? 'Định Giá AI' : 'AI Valuation'}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );

  // ── HERO — real estate photo background with gradient overlay ───────────────
  const hero = (
    <section style={{ minHeight: '100svh' }}
      className="relative flex flex-col items-center justify-center text-center pt-16 overflow-hidden">

      {/* Property photo — full bleed background */}
      <img
        src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=90"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ zIndex: 0 }}
      />

      {/* Gradient overlay — dark vignette, bottom-heavy for text readability */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 1,
        background: [
          'linear-gradient(to bottom, rgba(10,15,30,0.60) 0%, rgba(10,15,30,0.72) 50%, rgba(10,15,30,0.88) 100%)',
        ].join(', '),
      }} />

      {/* Subtle gold warmth at center */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 2,
        background: 'radial-gradient(ellipse 55% 40% at 50% 55%, rgba(201,168,76,0.10) 0%, transparent 70%)',
      }} />

      {/* Content — sits above all overlays */}
      <div className="relative w-full max-w-3xl mx-auto px-5 py-24 sm:py-32" style={{ zIndex: 3 }}>

        {/* Eyebrow */}
        <p className="text-xs font-bold uppercase tracking-[0.18em] mb-6"
          style={{ color: GOLD }}>
          {vi ? 'Nền Tảng BĐS Số 1 TP.HCM' : 'Vietnam\'s #1 Real Estate Platform'}
        </p>

        {/* Headline — massive, clean */}
        <h1 className="font-black text-white leading-[1.00] mb-6 tracking-[-0.03em]"
          style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
          {vi ? (
            <>Đầu Tư BĐS<br /><span style={{ color: GOLD }}>Thông Minh Hơn</span></>
          ) : (
            <>Invest in<br /><span style={{ color: GOLD }}>Real Estate Smarter</span></>
          )}
        </h1>

        {/* Subline */}
        <p className="mb-10 leading-relaxed mx-auto"
          style={{ color: 'rgba(255,255,255,0.50)', fontSize: '1.0625rem', maxWidth: '480px' }}>
          {vi
            ? 'SGS LAND phân phối 11+ dự án lớn. Định giá AI độ chính xác ±5%. Tư vấn & vay vốn hoàn toàn miễn phí.'
            : 'SGS LAND distributes 11+ major projects. AI valuation at ±5% accuracy. Free advisory & financing.'}
        </p>

        {/* Search bar — clean, large */}
        <form onSubmit={handleSearch}
          className="flex items-center mx-auto mb-8 rounded-2xl overflow-hidden"
          style={{
            maxWidth: '520px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.30)',
          }}>
          <Search className="shrink-0 ml-4 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={vi ? 'Tìm dự án, khu vực, loại hình...' : 'Search projects, areas, types...'}
            className="flex-1 bg-transparent px-3 py-4 text-sm text-white placeholder-gray-600 focus:outline-none" />
          <button type="submit"
            className="m-1.5 px-5 py-2.5 text-sm font-bold rounded-xl transition-opacity hover:opacity-90 shrink-0"
            style={{ background: GOLD, color: NAVY }}>
            {vi ? 'Tìm' : 'Search'}
          </button>
        </form>

        {/* Two CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          <a href={`/${ROUTES.AI_VALUATION}`}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: GOLD, color: NAVY }}>
            <Zap className="w-4 h-4" />
            {vi ? 'Định Giá AI Miễn Phí' : 'Free AI Valuation'}
          </a>
          <a href={`/${ROUTES.DU_AN}`}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-medium text-white transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.22)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = `${GOLD}60`)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)')}>
            {vi ? 'Xem Dự Án' : 'View Projects'}
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 4 stats — minimal horizontal */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {[
            { n: '11+',  l: vi ? 'Dự Án Lớn' : 'Major Projects' },
            { n: '±5%',  l: vi ? 'Chính Xác AI' : 'AI Accuracy' },
            { n: '2015', l: vi ? 'Năm Thành Lập' : 'Founded' },
            { n: '0đ',   l: vi ? 'Phí Tư Vấn' : 'Advisory Fee' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-xl font-black leading-none mb-1"
                style={{ color: i === 1 ? GOLD : WHITE }}>
                {s.n}
              </div>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── PARTNERS — white strip ─────────────────────────────────────────────────
  const partners = (
    <section style={{ background: WHITE, borderBottom: `1px solid ${BORDER}` }} className="py-6">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#B0ADA6' }}>
            {vi ? 'Đối tác chính thức' : 'Official partners'}
          </span>
          <div className="w-px h-4 hidden sm:block" style={{ background: BORDER }} />
          {PARTNERS.map(p => (
            <span key={p} className="text-sm font-semibold cursor-default transition-colors duration-150 hover:text-gray-900"
              style={{ color: '#AAA69E' }}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );

  // ── FEATURES — white, clean cards ─────────────────────────────────────────
  const features = (
    <section style={{ background: WHITE }} className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="max-w-xl mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: GOLD }}>
            {vi ? 'Công Nghệ Proptech' : 'Proptech Technology'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.025em' }}>
            {vi ? 'Nền Tảng Đầu Tư Toàn Diện' : 'Complete Investment Platform'}
          </h2>
          <p className="leading-relaxed" style={{ color: TEXT2 }}>
            {vi
              ? 'SGS LAND tích hợp AI, dữ liệu thị trường và CRM trong một nền tảng duy nhất.'
              : 'SGS LAND integrates AI, market data and CRM in a single platform.'}
          </p>
        </div>

        {/* 4 cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <a key={i} href={f.href}
              className="group block p-7 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: BORDER, background: WHITE }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(201,168,76,0.12)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${GOLD}15`, color: GOLD }}>
                {f.icon}
              </div>
              <h3 className="font-bold text-[15px] mb-2" style={{ color: TEXT1 }}>{f.title}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: TEXT2 }}>{f.desc}</p>
              <span className="text-sm font-semibold flex items-center gap-1 transition-colors"
                style={{ color: GOLD }}>
                {vi ? 'Khám phá' : 'Explore'}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── PROJECTS — off-white bg, clean grid ───────────────────────────────────
  const projectsSection = (
    <section style={{ background: OFF }} className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: GOLD }}>
              {vi ? '11+ Dự Án Phân Phối' : '11+ Distribution Projects'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.025em' }}>
              {vi ? 'Dự Án Nổi Bật' : 'Featured Projects'}
            </h2>
          </div>
          <a href={`/${ROUTES.DU_AN}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0 transition-opacity hover:opacity-70"
            style={{ color: GOLD }}>
            {vi ? 'Xem tất cả' : 'View all'} <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <a key={i} href={`/${ROUTES.DU_AN}/${p.slug}`}
              className="group block bg-white rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              style={{ borderColor: BORDER, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {/* Image */}
              <div className="aspect-[3/2] overflow-hidden relative">
                <img src={p.image} alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute top-3 left-3 px-2 py-0.5 text-[11px] font-black uppercase rounded"
                  style={{ background: GOLD, color: NAVY }}>
                  {p.badge}
                </span>
              </div>
              {/* Body */}
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  {p.type}
                </p>
                <h3 className="font-bold text-base mb-1" style={{ color: TEXT1 }}>{p.name}</h3>
                <p className="text-sm mb-4" style={{ color: TEXT2 }}>{p.dev} · {p.loc}</p>
                <div className="flex items-center justify-between pt-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="text-sm font-bold" style={{ color: GOLD }}>{p.price}</span>
                  <span className="text-xs font-medium text-white px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: TEXT1 }}>
                    {vi ? 'Chi tiết' : 'Details'} <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── AI CTA — dark navy, centered ──────────────────────────────────────────
  const aiCta = (
    <section style={{ background: NAVY }} className="py-24">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}35` }}>
          <Zap className="w-6 h-6" style={{ color: GOLD }} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
          {vi ? 'Biết Giá Thực Của BĐS Trong 3 Giây' : 'Know Real Property Value in 3 Seconds'}
        </h2>
        <p className="mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '1rem' }}>
          {vi
            ? 'Nhập địa chỉ bất kỳ tại TP.HCM. AI phân tích 50+ yếu tố, cho kết quả với sai số chỉ ±5%.'
            : 'Enter any HCMC address. AI analyses 50+ factors for results with only ±5% margin.'}
        </p>
        <a href={`/${ROUTES.AI_VALUATION}`}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: GOLD, color: NAVY }}>
          <Zap className="w-4 h-4" />
          {vi ? 'Định Giá Miễn Phí Ngay' : 'Free Valuation Now'}
        </a>
      </div>
    </section>
  );

  // ── TESTIMONIALS — white, minimal ─────────────────────────────────────────
  const testimonials = (
    <section style={{ background: WHITE }} className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: GOLD }}>
            {vi ? 'Đánh Giá Khách Hàng' : 'Customer Reviews'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.025em' }}>
            {vi ? 'Khách Hàng Nói Gì?' : 'What Our Clients Say'}
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS_DATA.map((t, i) => (
            <div key={i} className="p-7 rounded-2xl border" style={{ borderColor: BORDER }}>
              <div className="flex gap-0.5 mb-5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-4 h-4" style={{ fill: GOLD, color: GOLD }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: TEXT1 }}>
                "{vi ? t.content_vi : t.content_en}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${GOLD}15`, color: GOLD }}>
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: TEXT1 }}>{t.name}</p>
                  <p className="text-xs" style={{ color: TEXT2 }}>{vi ? t.role_vi : t.role_en}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── FAQ — off-white, clean accordion ─────────────────────────────────────
  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question', name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const faqSection = (
    <section style={{ background: OFF }} className="py-24">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: GOLD }}>
            {vi ? 'Hỏi & Đáp' : 'FAQ'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.025em' }}>
            {vi ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
          </h2>
        </div>
        <FaqAccordion items={faqItems} />
        <p className="text-xs text-center mt-8 leading-relaxed" style={{ color: TEXT2 }}>
          {vi
            ? 'Nội dung biên soạn bởi đội ngũ chuyên gia SGS LAND. Nguồn: CBRE Vietnam, Savills Vietnam.'
            : 'Content compiled by SGS LAND expert team. Sources: CBRE Vietnam, Savills Vietnam.'}
        </p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </section>
  );

  // ── CONTACT CTA — white, simple ───────────────────────────────────────────
  const contactCta = (
    <section style={{ background: WHITE, borderTop: `1px solid ${BORDER}` }} className="py-16">
      <div className="max-w-xl mx-auto px-5 text-center">
        <h2 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.025em' }}>
          {vi ? 'Cần Tư Vấn Miễn Phí?' : 'Need Free Consultation?'}
        </h2>
        <p className="mb-7 text-sm" style={{ color: TEXT2 }}>
          {vi ? 'Chuyên viên SGS LAND hỗ trợ 7 ngày/tuần.' : 'SGS LAND specialists available 7 days/week.'}{' '}
          <strong style={{ color: TEXT1 }}>0971.132.378</strong>
        </p>
        <a href="tel:+84971132378"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: GOLD, color: NAVY }}>
          <Phone className="w-4 h-4" />
          {vi ? 'Gọi Ngay: 0971.132.378' : 'Call: 0971.132.378'}
        </a>
      </div>
    </section>
  );

  // ── FOOTER — dark, organized ──────────────────────────────────────────────
  const footer = (
    <footer style={{ background: '#0F1F3D' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10 mb-12">

          <div className="col-span-2 lg:col-span-2">
            <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2 mb-4">
              <Logo className="w-[17px] h-[17px]" stroke={GOLD} />
              <span className="font-bold text-[15px] tracking-tight" style={{ color: WHITE }}>SGS LAND</span>
            </a>
            <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {vi
                ? 'Nền tảng BĐS tích hợp AI Agent, CRM đa kênh và tự động hóa dành cho doanh nghiệp.'
                : 'Real estate platform with AI Agent, multi-channel CRM and workflow automation for enterprises.'}
            </p>
            <div className="space-y-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <a href="tel:+84971132378" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />0971.132.378</a>
              <a href="mailto:info@sgsland.vn" className="flex items-center gap-2 hover:text-white transition-colors"><Mail className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />info@sgsland.vn</a>
              <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />{vi ? 'TP. Hồ Chí Minh, Việt Nam' : 'Ho Chi Minh City, Vietnam'}</p>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-4 opacity-50">{vi ? 'Sản Phẩm' : 'Products'}</h4>
            <ul className="space-y-2.5">
              <FL label={vi ? 'Sàn Giao Dịch' : 'Exchange'}           href={`/${ROUTES.SEARCH}`} />
              <FL label={vi ? 'Định Giá AI' : 'AI Valuation'}         href={`/${ROUTES.AI_VALUATION}`} />
              <FL label="SGS CRM"                                       href={`/${ROUTES.CRM_SOLUTION}`} />
              <FL label={vi ? 'Ký Gửi BĐS' : 'List Property'}         href={`/${ROUTES.KY_GUI}`} />
              <FL label={vi ? 'Lãi Suất NH' : 'Bank Rates'}           href="/lai-suat-vay-ngan-hang" />
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-4 opacity-50">{vi ? 'Dự Án' : 'Projects'}</h4>
            <ul className="space-y-2.5">
              <FL label="Aqua City"              href={`/${ROUTES.DU_AN}/aqua-city`} />
              <FL label="The Global City"        href={`/${ROUTES.DU_AN}/the-global-city`} />
              <FL label="Izumi City"             href={`/${ROUTES.DU_AN}/izumi-city`} />
              <FL label="Vinhomes Cần Giờ"       href={`/${ROUTES.DU_AN}/vinhomes-can-gio`} />
              <FL label="Vinhomes Grand Park"    href={`/${ROUTES.DU_AN}/vinhomes-grand-park`} />
              <FL label="Diamond Sky"            href={`/${ROUTES.DU_AN}/diamond-sky-van-phuc-city`} />
              <FL label={vi ? 'Xem tất cả →' : 'View all →'} href={`/${ROUTES.DU_AN}`} />
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-4 opacity-50">{vi ? 'Khu Vực' : 'Areas'}</h4>
            <ul className="space-y-2.5">
              <FL label={vi ? 'BĐS Đồng Nai' : 'Dong Nai RE'}         href={`/${ROUTES.BDS_DONG_NAI}`} />
              <FL label={vi ? 'BĐS Long Thành' : 'Long Thanh RE'}     href={`/${ROUTES.BDS_LONG_THANH}`} />
              <FL label={vi ? 'BĐS Thủ Đức' : 'Thu Duc RE'}           href={`/${ROUTES.BDS_THU_DUC}`} />
              <FL label={vi ? 'BĐS Bình Dương' : 'Binh Duong RE'}     href={`/${ROUTES.BDS_BINH_DUONG}`} />
              <FL label={vi ? 'BĐS Quận 7' : 'District 7 RE'}         href={`/${ROUTES.BDS_QUAN_7}`} />
              <FL label={vi ? 'BĐS Bình Chánh' : 'Binh Chanh RE'}     href={`/${ROUTES.BDS_BINH_CHANH}`} />
              <FL label={vi ? 'BĐS Bình Thạnh' : 'Binh Thanh RE'}     href={`/${ROUTES.BDS_BINH_THANH}`} />
              <FL label={vi ? 'BĐS Long An' : 'Long An RE'}           href={`/${ROUTES.BDS_LONG_AN}`} />
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-4 opacity-50">{vi ? 'Về Chúng Tôi' : 'Company'}</h4>
            <ul className="space-y-2.5 mb-6">
              <FL label={vi ? 'Câu Chuyện' : 'Our Story'}  href={`/${ROUTES.ABOUT}`} />
              <FL label={vi ? 'Tuyển Dụng' : 'Careers'}    href={`/${ROUTES.CAREERS}`} />
              <FL label={vi ? 'Tin Tức' : 'News'}           href={`/${ROUTES.NEWS}`} />
              <FL label={vi ? 'Liên Hệ' : 'Contact'}        href={`/${ROUTES.CONTACT}`} />
            </ul>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white mb-4 opacity-50">{vi ? 'Hỗ Trợ' : 'Support'}</h4>
            <ul className="space-y-2.5">
              <FL label={vi ? 'Trợ Giúp' : 'Help Center'}            href={`/${ROUTES.HELP_CENTER}`} />
              <FL label={vi ? 'Bảo Mật' : 'Privacy Policy'}          href={`/${ROUTES.PRIVACY}`} />
              <FL label={vi ? 'Điều Khoản' : 'Terms of Service'}      href={`/${ROUTES.TERMS}`} />
              <FL label={vi ? 'Trạng Thái' : 'System Status'}         href={`/${ROUTES.STATUS_PUBLIC}`} />
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} SGS Land Corp. · <a href="https://sgsland.vn" className="hover:text-white transition-colors">sgsland.vn</a>
          </span>
          <div className="flex items-center gap-2">
            {[
              { href: 'https://www.facebook.com/sgslandvn', label: 'Facebook', d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
              { href: 'https://linkedin.com', label: 'LinkedIn', d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.40)' }}>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d={s.d} /></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans antialiased" style={{ color: TEXT1 }}>
      {header}
      {hero}
      {partners}
      {features}
      {projectsSection}
      {aiCta}
      {testimonials}
      {faqSection}
      {contactCta}
      {footer}
    </div>
  );
}
