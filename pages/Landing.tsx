import React, { useState, useEffect } from 'react';
import { useTranslation } from '../services/i18n';
import {
  Search, ArrowRight, Zap, BarChart3, Globe2, Users,
  CheckCircle2, Star, Menu, X, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';

// ─── Design tokens ───────────────────────────────────────────────────────────
const NAVY   = '#0A0F1E';
const GOLD   = '#C9A84C';
const GOLD_L = '#E2BF72';       // light gold for gradients
const CREAM  = '#F8F7F3';       // warm off-white sections
const BORDER = '#EDEAE0';       // warm border
const TEXT1  = '#0F172A';       // primary text
const TEXT2  = '#64748B';       // secondary text

// ─── Static data ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Dự Án',         href: `/${ROUTES.DU_AN}` },
  { label: 'Sàn Giao Dịch', href: `/${ROUTES.SEARCH}` },
  { label: 'Định Giá AI',   href: `/${ROUTES.AI_VALUATION}` },
  { label: 'Dữ Liệu TT',    href: '/market-data' },
  { label: 'CRM Platform',  href: `/${ROUTES.CRM_SOLUTION}` },
];

const PARTNERS = ['Vinhomes', 'Novaland', 'Nam Long', 'Masterise', 'Van Phúc', 'Khang Điền', 'Sơn Kim Land'];

const PROJECTS_VI = [
  { slug: 'aqua-city',               image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', name: 'Aqua City',           dev: 'Novaland',  loc: 'Biên Hòa, Đồng Nai', scale: '1.000 ha', price: 'Từ 2,5 tỷ',  badge: 'Hot',         type: 'Đô Thị Sinh Thái' },
  { slug: 'the-global-city',         image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80', name: 'The Global City',     dev: 'Masterise', loc: 'Thủ Đức, TP.HCM',    scale: '117 ha',   price: 'Từ 4,5 tỷ',  badge: 'Cao Cấp',     type: 'Đô Thị Tài Chính' },
  { slug: 'vinhomes-can-gio',        image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', name: 'Vinhomes Cần Giờ',   dev: 'Vinhomes',  loc: 'Cần Giờ, TP.HCM',    scale: '2.870 ha', price: 'Từ 12 tỷ',   badge: 'Siêu Dự Án',  type: 'Đô Thị Biển' },
  { slug: 'izumi-city',              image: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80', name: 'Izumi City',          dev: 'Nam Long',  loc: 'Biên Hòa, Đồng Nai', scale: '170 ha',   price: 'Từ 8,4 tỷ',  badge: 'Nhật Bản',    type: 'Đô Thị Chuẩn Nhật' },
  { slug: 'vinhomes-grand-park',     image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80', name: 'Vinhomes Grand Park', dev: 'Vinhomes',  loc: 'Thủ Đức, TP.HCM',    scale: '271 ha',   price: 'Từ 1,8 tỷ',  badge: 'Best Seller', type: 'Đại Đô Thị' },
  { slug: 'diamond-sky-van-phuc-city', image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80', name: 'Diamond Sky',       dev: 'Van Phúc',  loc: 'TP Thủ Đức, TP.HCM', scale: '198 ha',   price: 'Từ 9,6 tỷ',  badge: 'Cao Cấp',     type: 'Căn Hộ View Sông' },
];

const TESTIMONIALS_VI = [
  { name: 'Nguyễn Minh Tuấn', role: 'Nhà đầu tư',   content: 'AI định giá của SGS LAND rất chính xác, giúp tôi mua được căn hộ Vinhomes đúng giá thị trường.', rating: 5 },
  { name: 'Trần Thị Lan Anh', role: 'Môi giới BĐS', content: 'CRM platform giúp tôi quản lý 200+ khách hàng dễ dàng. Doanh số tăng 40% sau 3 tháng sử dụng.',  rating: 5 },
  { name: 'Lê Thành Đạt',     role: 'Nhà đầu tư',   content: 'Dữ liệu thị trường SGS LAND cực kỳ chi tiết, giúp tôi quyết định đầu tư đúng thời điểm.',       rating: 5 },
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

// ─── Footer link ──────────────────────────────────────────────────────────────
const FL = ({ label, href }: { label: string; href: string }) => (
  <li>
    <a href={href} className="text-slate-400 hover:text-amber-400 transition-colors duration-200 text-sm leading-relaxed inline-flex items-center gap-1 group">
      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all duration-200 text-amber-400 shrink-0" />
      {label}
    </a>
  </li>
);

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-2xl overflow-hidden transition-all duration-200"
            style={{
              background: isOpen ? `${GOLD}12` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isOpen ? `${GOLD}45` : 'rgba(255,255,255,0.09)'}`,
            }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left" aria-expanded={isOpen}>
              <span className="font-semibold text-sm sm:text-base leading-snug transition-colors"
                style={{ color: isOpen ? GOLD_L : 'rgba(255,255,255,0.88)' }} role="heading" aria-level={3}>
                {item.q}
              </span>
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-all duration-300"
                style={{ background: isOpen ? GOLD : 'rgba(255,255,255,0.10)', color: isOpen ? NAVY : 'rgba(255,255,255,0.5)', transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <p className="px-6 pb-5 text-sm sm:text-base leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.60)', borderTop: `1px solid ${GOLD}20` }}>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch]     = useState('');
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage } = useTranslation();
  const lang = language === 'vn' ? 'vi' : 'en';

  const FEATURES = lang === 'vi' ? [
    { icon: <Zap className="w-6 h-6" />,       title: 'AI Định Giá ±5%',    desc: 'Định giá tự động bất kỳ BĐS nào tại TP.HCM với sai số chỉ ±5%. Kết quả trong 3 giây.',             href: `/${ROUTES.AI_VALUATION}` },
    { icon: <Globe2 className="w-6 h-6" />,    title: 'Sàn Giao Dịch',     desc: 'Hàng nghìn căn hộ, đất nền, nhà phố được xác minh pháp lý. Kết nối trực tiếp với chủ đầu tư.',  href: `/${ROUTES.SEARCH}` },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Dữ Liệu Thị Trường', desc: 'Báo cáo biến động giá theo quý, xu hướng đầu tư từ 50+ dự án lớn tại TP.HCM.',               href: '/market-data' },
    { icon: <Users className="w-6 h-6" />,     title: 'CRM Đa Kênh',        desc: 'Quản lý khách hàng, tích hợp Zalo/Facebook/Email. Dùng thử miễn phí 30 ngày.',                  href: `/${ROUTES.CRM_SOLUTION}` },
  ] : [
    { icon: <Zap className="w-6 h-6" />,       title: 'AI Valuation ±5%',   desc: 'Automatically value any HCMC property with ±5% accuracy. Results in 3 seconds.',              href: `/${ROUTES.AI_VALUATION}` },
    { icon: <Globe2 className="w-6 h-6" />,    title: 'Exchange',           desc: 'Thousands of verified apartments, land plots, and houses. Connect with developers directly.',  href: `/${ROUTES.SEARCH}` },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Market Data',        desc: 'Quarterly price trend reports, investment outlook from 50+ major HCMC projects.',             href: '/market-data' },
    { icon: <Users className="w-6 h-6" />,     title: 'Multi-Channel CRM',  desc: 'Customer management with Zalo/Facebook/Email integration. Free 30-day trial.',               href: `/${ROUTES.CRM_SOLUTION}` },
  ];

  const STATS = lang === 'vi' ? [
    { value: '11+',  label: 'Dự Án Lớn',   sub: 'Vinhomes · Novaland · Nam Long' },
    { value: '±5%',  label: 'Chính Xác AI', sub: 'Sai số định giá tự động' },
    { value: '3+',   label: 'Tỉnh Thành',  sub: 'TP.HCM · Đồng Nai · Bình Dương' },
    { value: '1/7',  label: 'Hỗ Trợ',      sub: 'Pháp lý & vay vốn miễn phí' },
  ] : [
    { value: '11+',  label: 'Major Projects',  sub: 'Vinhomes · Novaland · Nam Long' },
    { value: '±5%',  label: 'AI Accuracy',     sub: 'Automated valuation margin' },
    { value: '3+',   label: 'Provinces',       sub: 'HCMC · Dong Nai · Binh Duong' },
    { value: '1/7',  label: 'Support',         sub: 'Free legal & financing' },
  ];

  const PROJECTS     = lang === 'vi' ? PROJECTS_VI : [
    { slug: 'aqua-city',               image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', name: 'Aqua City',           dev: 'Novaland',  loc: 'Bien Hoa, Dong Nai', scale: '1,000 ha', price: 'From 2.5B',  badge: 'Hot',         type: 'Eco Township' },
    { slug: 'the-global-city',         image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80', name: 'The Global City',     dev: 'Masterise', loc: 'Thu Duc, HCMC',     scale: '117 ha',   price: 'From 4.5B',  badge: 'Premium',     type: 'Financial Township' },
    { slug: 'vinhomes-can-gio',        image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', name: 'Vinhomes Can Gio',    dev: 'Vinhomes',  loc: 'Can Gio, HCMC',     scale: '2,870 ha', price: 'From 12B',   badge: 'Mega',        type: 'Coastal Township' },
    { slug: 'izumi-city',              image: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80', name: 'Izumi City',          dev: 'Nam Long',  loc: 'Bien Hoa, Dong Nai', scale: '170 ha',   price: 'From 8.4B',  badge: 'Japanese',    type: 'Japanese Standard' },
    { slug: 'vinhomes-grand-park',     image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80', name: 'Vinhomes Grand Park', dev: 'Vinhomes',  loc: 'Thu Duc, HCMC',     scale: '271 ha',   price: 'From 1.8B',  badge: 'Best Seller', type: 'Grand Township' },
    { slug: 'diamond-sky-van-phuc-city', image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80', name: 'Diamond Sky',       dev: 'Van Phuc',  loc: 'TP Thu Duc, HCMC',  scale: '198 ha',   price: 'From 9.6B',  badge: 'Premium',     type: 'River View Condo' },
  ];
  const TESTIMONIALS = lang === 'vi' ? TESTIMONIALS_VI : [
    { name: 'Nguyen Minh Tuan', role: 'Investor',           content: 'SGS LAND AI valuation is very accurate, helping me buy a Vinhomes apartment at market price.', rating: 5 },
    { name: 'Tran Thi Lan Anh', role: 'Real Estate Agent',  content: 'CRM platform helps me manage 200+ clients easily. Revenue increased 40% after 3 months.',      rating: 5 },
    { name: 'Le Thanh Dat',     role: 'Investor',           content: 'SGS LAND market data is extremely detailed, helping me decide on investments at the right time.', rating: 5 },
  ];
  const HOME_FAQ = lang === 'vi' ? HOME_FAQ_VI : [
    { q: 'What is SGS LAND and what projects does it distribute?', a: 'SGS LAND is an authorized real estate distributor in HCMC, specializing in major projects: Aqua City Novaland (1,000ha, Bien Hoa), The Global City Masterise (117ha, Thu Duc), Izumi City Nam Long (170ha, Bien Hoa), Vinhomes Can Gio (2,870ha), Vinhomes Grand Park (271ha, Thu Duc). Free consultation at sgsland.vn or hotline 0971 132 378.' },
    { q: 'Is buying real estate through SGS LAND free?', a: 'Yes — buyers pay zero brokerage. SGS LAND earns commissions from developers under distribution contracts. Customers get free legal consultation, contract review, and loan support.' },
    { q: 'How does SGS LAND AI Valuation work?', a: 'The AI Valuation (AVM) system analyses real transaction data, urban planning, infrastructure, and market trends to produce valuations with ±5% accuracy. Enter address, area, and property type — results in seconds, no login required.' },
    { q: 'Which projects are currently open for booking through SGS LAND?', a: 'As of April 2026: Aqua City Novaland from 6.5B VND; Izumi City Nam Long new phase from 8.4B VND; The Global City Masterise accepting deposits from 15B VND; Vinhomes Can Gio from 12B VND. Call 0971 132 378 for the latest price list.' },
    { q: 'How does SGS LAND support bank financing?', a: 'SGS LAND connects buyers with Vietcombank, BIDV, Techcombank, and VPBank — up to 70% LTV, 20–25 year terms, preferential rates for the first 12–24 months. Legal team reviews contracts and loan files at no charge.' },
    { q: 'Does Dong Nai real estate have investment potential?', a: 'Per CBRE Vietnam and Savills Vietnam, Dong Nai suburban properties grew 12–18%/year in 2022–2024 driven by Ring Road 3, Nhon Trach Bridge, and Long Thanh Airport. Aqua City and Izumi City are SGS LAND key projects there.' },
    { q: 'How is HCMC real estate priced in 2026?', a: 'HCMC mid-range apartments in Thu Duc average 50–80M VND/m². Townhouses in Binh Thanh run 150–300M VND/m². Suburban villas in Nhon Trach start at 20–50M VND/m². SGS LAND provides free AI valuation at sgsland.vn/ai-valuation — updated daily.' },
  ];

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

  const EN_NAV: Record<string, string> = {
    'Dự Án': 'Projects', 'Sàn Giao Dịch': 'Exchange',
    'Định Giá AI': 'AI Valuation', 'Dữ Liệu TT': 'Market Data', 'CRM Platform': 'CRM Platform',
  };

  // ── ANNOUNCEMENT BAR ─────────────────────────────────────────────────────────
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const announcement = announcementVisible ? (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 px-4 py-2.5 text-xs font-semibold"
      style={{ background: `linear-gradient(90deg, ${NAVY} 0%, #0D1535 50%, ${NAVY} 100%)`, borderBottom: `1px solid ${GOLD}30` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: GOLD }} />
      <span className="text-slate-200">
        {lang === 'vi'
          ? <><strong style={{ color: GOLD }}>Aqua City</strong> mở bán đợt mới · Biệt thự đảo từ <strong className="text-white">6,5 tỷ</strong> · Pháp lý đầy đủ, sổ hồng riêng</>
          : <><strong style={{ color: GOLD }}>Aqua City</strong> new phase open · Island villas from <strong className="text-white">6.5B VND</strong> · Full legal, separate pink book</>}
      </span>
      <a href={`/${ROUTES.DU_AN}/aqua-city`}
        className="shrink-0 flex items-center gap-1 font-bold underline-offset-2 hover:underline transition-all"
        style={{ color: GOLD }}>
        {lang === 'vi' ? 'Xem ngay' : 'View now'} <ArrowRight className="w-3 h-3" />
      </a>
      <button onClick={() => setAnnouncementVisible(false)}
        className="absolute right-4 p-1 text-slate-500 hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  const announcementH = announcementVisible ? 40 : 0;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const header = (
    <header className="fixed left-0 right-0 z-50 transition-all duration-300"
      style={{
        top: `${announcementH}px`,
        background: scrolled ? 'rgba(8,12,24,0.97)' : 'rgba(8,12,24,0.75)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderBottom: `1px solid ${scrolled ? `rgba(201,168,76,0.18)` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: scrolled ? `0 4px 32px rgba(0,0,0,0.60), 0 1px 0 ${GOLD}15` : 'none',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px]">
          {/* Logo */}
          <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all group-hover:scale-105"
              style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}40` }}>
              <Logo className="w-4 h-4" stroke={GOLD} />
            </div>
            <span className="font-black text-base tracking-[-0.02em]">
              <span style={{ color: GOLD }}>SGS</span>
              <span className="text-white"> LAND</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center">
            {NAV_LINKS.map((l, i) => (
              <React.Fragment key={l.href}>
                {i > 0 && <span className="w-px h-3 mx-0.5" style={{ background: 'rgba(255,255,255,0.10)' }} />}
                <a href={l.href}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  {lang === 'vi' ? l.label : (EN_NAV[l.label] || l.label)}
                </a>
              </React.Fragment>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(lang === 'vi' ? 'en' : 'vn')}
              className="hidden sm:flex h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.50)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}40`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}>
              {lang === 'vi' ? 'EN' : 'VI'}
            </button>
            <a href={`/${ROUTES.LOGIN}`}
              className="hidden sm:inline-flex items-center h-8 px-4 text-[13px] font-semibold rounded-lg transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.14)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}45`; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {lang === 'vi' ? 'Đăng nhập' : 'Sign in'}
            </a>
            <a href={`/${ROUTES.AI_VALUATION}`}
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-4 text-[13px] font-bold rounded-lg transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY, boxShadow: `0 2px 12px ${GOLD}35` }}>
              <Zap className="w-3.5 h-3.5" />
              {lang === 'vi' ? 'Định Giá AI' : 'AI Valuation'}
            </a>
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.60)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.60)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden" style={{ background: 'rgba(6,9,18,0.99)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-0.5">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.65)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                {lang === 'vi' ? l.label : (EN_NAV[l.label] || l.label)}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-white/06 flex gap-2">
              <a href={`/${ROUTES.LOGIN}`} className="flex-1 text-center py-2.5 text-sm font-semibold text-white rounded-lg border border-white/12">
                {lang === 'vi' ? 'Đăng nhập' : 'Sign in'}
              </a>
              <a href={`/${ROUTES.AI_VALUATION}`}
                className="flex-1 text-center py-2.5 text-sm font-bold rounded-lg"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY }}>
                {lang === 'vi' ? 'Định Giá AI' : 'AI Valuation'}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );

  // ── HERO ─────────────────────────────────────────────────────────────────────
  const hero = (
    <section className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(150deg, #050810 0%, #0A0F1E 45%, #080D1C 100%)',
        paddingTop: `${announcementH + 60}px`,
        minHeight: '100svh',
      }}>

      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gold ambient — center-right */}
        <div className="absolute top-0 right-0 w-[900px] h-[900px]"
          style={{ background: `radial-gradient(circle at 70% 40%, ${GOLD}14 0%, transparent 60%)` }} />
        {/* Blue depth — top-left */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px]"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)' }} />
        {/* Fine grid */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        {/* Vignette */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(5,8,16,0.55) 100%)' }} />
        {/* Gold top border */}
        <div className="absolute top-0 inset-x-0 h-[1px]"
          style={{ background: `linear-gradient(90deg, transparent, ${GOLD}80 35%, ${GOLD} 50%, ${GOLD}80 65%, transparent)` }} />
      </div>

      {/* ── Content ── */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_520px] gap-8 xl:gap-14 items-center py-16 lg:py-20 xl:py-24">

          {/* ── LEFT: Copy ── */}
          <div className="order-2 lg:order-1">

            {/* Social proof bar */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4" style={{ fill: GOLD, color: GOLD }} />
                ))}
              </div>
              <span className="text-sm font-semibold text-white">4.9</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>·</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.50)' }}>
                {lang === 'vi' ? '247 đánh giá · Đối tác CBRE Vietnam' : '247 reviews · CBRE Vietnam Partner'}
              </span>
            </div>

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ background: `${GOLD}16`, border: `1px solid ${GOLD}40`, color: GOLD }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: GOLD }} />
              {lang === 'vi' ? 'Proptech #1 TP. Hồ Chí Minh' : '#1 Proptech Platform · Ho Chi Minh City'}
            </div>

            {/* Headline */}
            <h1 className="font-black leading-[0.95] mb-6 text-white"
              style={{ fontSize: 'clamp(2.8rem, 6.5vw, 5.2rem)', letterSpacing: '-0.04em' }}>
              {lang === 'vi' ? (
                <>
                  Tìm &{' '}
                  <span style={{
                    background: `linear-gradient(135deg, #F0D080 0%, ${GOLD} 40%, #C08020 100%)`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>Đầu Tư</span>
                  <br />BĐS Thông Minh
                </>
              ) : (
                <>
                  Find &{' '}
                  <span style={{
                    background: `linear-gradient(135deg, #F0D080 0%, ${GOLD} 40%, #C08020 100%)`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>Invest</span>
                  <br />Intelligently
                </>
              )}
            </h1>

            {/* Sub */}
            <p className="leading-relaxed mb-8 max-w-[500px]"
              style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)', color: 'rgba(255,255,255,0.55)' }}>
              {lang === 'vi'
                ? <>SGS LAND phân phối <strong className="text-white font-semibold">11+ dự án lớn</strong> tại TP.HCM. Định giá AI độ chính xác <strong style={{ color: GOLD }}>±5%</strong>. Tư vấn pháp lý & hỗ trợ vay vốn hoàn toàn miễn phí.</>
                : <>SGS LAND distributes <strong className="text-white font-semibold">11+ major projects</strong> in HCMC. AI valuation at <strong style={{ color: GOLD }}>±5%</strong> accuracy. Free legal advisory & bank financing support.</>}
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex mb-7 rounded-[14px] overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.13)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)',
                maxWidth: '500px',
              }}>
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'vi' ? 'Tìm dự án, khu vực, loại hình...' : 'Search projects, areas, types...'}
                  className="w-full bg-transparent pl-11 pr-3 py-[14px] text-sm text-white placeholder-slate-600 focus:outline-none" />
              </div>
              <button type="submit"
                className="m-1.5 px-5 text-sm font-bold rounded-[10px] transition-all duration-200 hover:brightness-110 shrink-0"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY }}>
                {lang === 'vi' ? 'Tìm' : 'Search'}
              </button>
            </form>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <a href={`/${ROUTES.AI_VALUATION}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY, boxShadow: `0 4px 20px ${GOLD}45` }}>
                <Zap className="w-4 h-4" />
                {lang === 'vi' ? 'Định Giá AI Miễn Phí' : 'Free AI Valuation'}
              </a>
              <a href={`/${ROUTES.DU_AN}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}35`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; }}>
                {lang === 'vi' ? 'Xem Dự Án' : 'View Projects'}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { text: lang === 'vi' ? 'Đối tác Vinhomes' : 'Vinhomes Partner' },
                { text: lang === 'vi' ? 'Pháp lý 2 lớp' : '2-Layer Legal' },
                { text: lang === 'vi' ? 'Tư vấn miễn phí' : 'Free Advisory' },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {b.text}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Featured property visual ── */}
          <div className="order-1 lg:order-2 relative">
            {/* Main image card */}
            <div className="relative rounded-3xl overflow-hidden"
              style={{
                aspectRatio: '4/5',
                boxShadow: `0 32px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.06), 0 -1px 0 ${GOLD}20`,
              }}>
              <img
                src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=85"
                alt="Aqua City — Novaland"
                className="w-full h-full object-cover"
                style={{ transform: 'scale(1.03)' }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(5,8,16,0.85) 0%, rgba(5,8,16,0.20) 40%, transparent 70%)' }} />

              {/* Bottom info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                      {lang === 'vi' ? 'Đô Thị Sinh Thái' : 'Eco Township'}
                    </div>
                    <div className="text-xl font-black text-white leading-tight tracking-tight">Aqua City</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Novaland · Biên Hòa, Đồng Nai</div>
                  </div>
                  <a href={`/${ROUTES.DU_AN}/aqua-city`}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 shrink-0"
                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY }}>
                    {lang === 'vi' ? 'Xem' : 'View'} <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Badge top-left */}
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY }}>
                HOT
              </div>
            </div>

            {/* Floating glass card — price */}
            <div className="absolute -bottom-5 -left-5 rounded-2xl px-4 py-3.5 hidden sm:block"
              style={{
                background: 'rgba(10,15,30,0.90)',
                border: `1px solid rgba(201,168,76,0.30)`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.50)',
              }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {lang === 'vi' ? 'Giá từ' : 'From'}
              </div>
              <div className="text-lg font-black" style={{ color: GOLD }}>2,5 tỷ VND</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {lang === 'vi' ? '1.000 ha · Sổ hồng riêng' : '1,000 ha · Separate title'}
              </div>
            </div>

            {/* Floating glass card — AI valuation */}
            <div className="absolute -top-4 -right-4 rounded-2xl px-4 py-3.5 hidden sm:block"
              style={{
                background: 'rgba(10,15,30,0.90)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}22` }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: GOLD }} />
                </div>
                <span className="text-[11px] font-bold text-white">{lang === 'vi' ? 'AI Định Giá' : 'AI Valuation'}</span>
              </div>
              <div className="text-xl font-black" style={{ color: GOLD }}>±5%</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {lang === 'vi' ? 'Chính xác · 3 giây' : 'Accurate · 3 seconds'}
              </div>
            </div>

            {/* Decorative dots */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 opacity-20 pointer-events-none hidden lg:block"
              style={{ backgroundImage: `radial-gradient(${GOLD} 1.5px, transparent 1.5px)`, backgroundSize: '8px 8px' }} />
          </div>
        </div>

        {/* ── Stats bar (below the split) ── */}
        <div className="pb-12 lg:pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATS.map((s, i) => (
              <div key={i} className="rounded-2xl px-5 py-4 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: i % 2 === 1 ? `linear-gradient(135deg, ${GOLD}16 0%, ${GOLD}07 100%)` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i % 2 === 1 ? `${GOLD}30` : 'rgba(255,255,255,0.07)'}`,
                }}>
                <div className="text-2xl sm:text-3xl font-black mb-0.5 tracking-[-0.02em]"
                  style={{ color: i % 2 === 1 ? GOLD : 'white' }}>
                  {s.value}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-0.5" style={{ color: `${GOLD}90` }}>{s.label}</div>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-20 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(5,8,16,0.5))' }} />
    </section>
  );

  // ── PARTNERS ─────────────────────────────────────────────────────────────────
  const partners = (
    <section className="py-5 border-b" style={{ background: '#FAFAF8', borderColor: BORDER }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#A9A08A' }}>
            {lang === 'vi' ? 'Đối tác chính thức' : 'Official partners'}
          </span>
          {PARTNERS.map(p => (
            <span key={p} className="text-sm font-semibold transition-colors cursor-default"
              style={{ color: '#8C836E' }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
              onMouseLeave={e => (e.currentTarget.style.color = '#8C836E')}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );

  // ── FEATURES ─────────────────────────────────────────────────────────────────
  const features = (
    <section className="py-24" style={{ background: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.14em] px-4 py-1.5 rounded-full mb-4"
            style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}35` }}>
            {lang === 'vi' ? 'Nền Tảng Công Nghệ' : 'Technology Platform'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3" style={{ color: TEXT1, letterSpacing: '-0.02em' }}>
            {lang === 'vi' ? 'Công Cụ Proptech Hàng Đầu' : 'Leading Proptech Tools'}
          </h2>
          <p className="max-w-xl mx-auto leading-relaxed" style={{ color: TEXT2 }}>
            {lang === 'vi'
              ? 'SGS LAND tích hợp AI, dữ liệu thị trường và CRM trong một nền tảng duy nhất.'
              : 'SGS LAND integrates AI, market data, and CRM in a single platform.'}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <a key={i} href={f.href}
              className="group relative bg-white rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
              style={{
                border: `1px solid ${BORDER}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(201,168,76,0.18), 0 2px 8px rgba(0,0,0,0.08)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}50`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = BORDER;
              }}>
              {/* Gold top accent line */}
              <div className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L})` }} />
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${GOLD}18`, color: GOLD }}>
                {f.icon}
              </div>
              <h3 className="font-bold mb-2.5 transition-colors duration-200 group-hover:text-amber-700"
                style={{ color: TEXT1, fontSize: '0.95rem' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: TEXT2 }}>{f.desc}</p>
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: GOLD }}>
                <span>{lang === 'vi' ? 'Khám phá' : 'Explore'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── PROJECTS ──────────────────────────────────────────────────────────────────
  const projects = (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-[0.14em] px-4 py-1.5 rounded-full mb-3"
              style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}30` }}>
              {lang === 'vi' ? '11+ Dự Án Lớn' : '11+ Major Projects'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.02em' }}>
              {lang === 'vi' ? 'Dự Án SGS LAND Phân Phối' : 'SGS LAND Distribution Projects'}
            </h2>
            <p className="mt-2 text-sm" style={{ color: TEXT2 }}>
              {lang === 'vi' ? 'Chỉ phân phối dự án uy tín, pháp lý hoàn chỉnh' : 'Only reputable projects with complete legal documentation'}
            </p>
          </div>
          <a href={`/${ROUTES.DU_AN}`}
            className="inline-flex items-center gap-2 text-sm font-semibold shrink-0 transition-colors"
            style={{ color: GOLD }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#B8892E')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}>
            {lang === 'vi' ? 'Xem tất cả dự án' : 'View all projects'} <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROJECTS.map((p, i) => (
            <a key={i} href={`/${ROUTES.DU_AN}/${p.slug}`}
              className="group bg-white rounded-3xl overflow-hidden transition-all duration-400 hover:-translate-y-1"
              style={{
                border: `1px solid ${BORDER}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}40`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = BORDER;
              }}>
              {/* Image */}
              <div className="aspect-[3/2] relative overflow-hidden">
                <img src={p.image} alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
                <span className="absolute top-3.5 left-3.5 px-2.5 py-1 text-xs font-bold rounded-full"
                  style={{ background: GOLD, color: NAVY }}>
                  {p.badge}
                </span>
              </div>
              {/* Info */}
              <div className="p-5">
                <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>{p.type}</div>
                <h3 className="font-bold text-lg mb-1 transition-colors duration-200" style={{ color: TEXT1 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = TEXT1)}>
                  {p.name}
                </h3>
                <p className="text-sm mb-4" style={{ color: TEXT2 }}>{p.dev} · {p.loc}</p>
                <div className="flex items-center justify-between pt-3.5"
                  style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: '#A9A49A' }}>{lang === 'vi' ? 'Quy mô' : 'Scale'}</div>
                    <div className="text-sm font-semibold" style={{ color: TEXT1 }}>{p.scale}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs mb-0.5" style={{ color: '#A9A49A' }}>{lang === 'vi' ? 'Giá từ' : 'From'}</div>
                    <div className="text-sm font-bold" style={{ color: GOLD }}>{p.price}</div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ── STATS BANNER ──────────────────────────────────────────────────────────────
  const statsBanner = (
    <section className="py-16" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0C1830 100%)` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { n: '11+',   label: lang === 'vi' ? 'Dự Án Đang Phân Phối' : 'Active Projects' },
            { n: '±5%',   label: lang === 'vi' ? 'Độ Chính Xác AI Định Giá' : 'AI Valuation Accuracy' },
            { n: '247+',  label: lang === 'vi' ? 'Đánh Giá 5 Sao' : '5-Star Reviews' },
            { n: '2015',  label: lang === 'vi' ? 'Năm Thành Lập' : 'Year Founded' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-4xl sm:text-5xl font-black mb-2 tracking-tight"
                style={{ color: i % 2 === 1 ? GOLD : 'white' }}>
                {s.n}
              </div>
              <div className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── AI CTA ────────────────────────────────────────────────────────────────────
  const aiCta = (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #0C1830 100%)`,
            border: `1px solid ${GOLD}25`,
            boxShadow: `0 32px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}>
          {/* Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${GOLD}20 0%, transparent 70%)`, filter: 'blur(60px)', transform: 'translate(30%, -30%)' }} />
          <div className="relative px-8 py-14 sm:py-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-widest"
              style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40`, color: GOLD }}>
              <Zap className="w-3.5 h-3.5" />
              {lang === 'vi' ? 'AI Định Giá Bất Động Sản' : 'AI Real Estate Valuation'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {lang === 'vi' ? <>Biết Giá Thực Của BĐS<br />Trong 3 Giây</> : <>Know Real Estate's True Value<br />In 3 Seconds</>}
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
              {lang === 'vi'
                ? 'Nhập địa chỉ bất kỳ tại TP.HCM. AI phân tích 50+ yếu tố cho kết quả định giá với sai số chỉ ±5%.'
                : 'Enter any HCMC address. AI analyses 50+ factors for valuation results with only ±5% margin of error.'}
            </p>
            <a href={`/${ROUTES.AI_VALUATION}`}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-bold rounded-xl transition-all duration-200 hover:brightness-110"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY, boxShadow: `0 4px 24px ${GOLD}40` }}>
              <Zap className="w-5 h-5" />
              {lang === 'vi' ? 'Định Giá Miễn Phí Ngay' : 'Free Valuation Now'}
            </a>
          </div>
        </div>
      </div>
    </section>
  );

  // ── TESTIMONIALS ──────────────────────────────────────────────────────────────
  const testimonials = (
    <section className="py-24" style={{ background: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={{ color: TEXT1, letterSpacing: '-0.02em' }}>
            {lang === 'vi' ? 'Khách Hàng Nói Gì?' : 'What Our Clients Say'}
          </h2>
          <p style={{ color: TEXT2 }}>
            {lang === 'vi' ? 'Đánh giá thực từ nhà đầu tư và môi giới BĐS' : 'Real reviews from investors and real estate brokers'}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 transition-all duration-300"
              style={{
                border: `1px solid ${BORDER}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
              <div className="flex gap-0.5 mb-5">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4" style={{ fill: GOLD, color: GOLD }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6 italic" style={{ color: '#555' }}>"{t.content}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: `${GOLD}18`, color: GOLD }}>
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: TEXT1 }}>{t.name}</div>
                  <div className="text-xs" style={{ color: TEXT2 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map(item => ({
      '@type': 'Question', name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const faqSection = (
    <section className="py-24" style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #080D1C 100%)` }}>
      <div className="h-px mb-16 mx-auto max-w-5xl"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}45, transparent)` }} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-xs font-bold uppercase tracking-widest"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}35`, color: GOLD }}>
            {lang === 'vi' ? 'Hỏi & Đáp' : 'FAQ'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            {lang === 'vi' ? <>Câu Hỏi <span style={{ color: GOLD }}>Thường Gặp</span></> : <>Frequently <span style={{ color: GOLD }}>Asked Questions</span></>}
          </h2>
          <p className="max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {lang === 'vi'
              ? 'Giải đáp thắc mắc về bất động sản TP.HCM, các dự án lớn và dịch vụ của SGS LAND.'
              : 'Answers to common questions about HCMC real estate, major projects and SGS LAND services.'}
          </p>
        </div>
        <FaqAccordion items={HOME_FAQ} />
        <p className="text-xs text-center mt-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.30)' }}>
          {lang === 'vi'
            ? 'Nội dung được biên soạn bởi đội ngũ chuyên gia SGS LAND. Cập nhật lần cuối:'
            : 'Content compiled by SGS LAND expert team. Last updated:'}{' '}
          <time dateTime="2026-04-18">04/2026</time>.{' '}
          {lang === 'vi' ? 'Nguồn: CBRE Vietnam, Savills Vietnam, Bộ Xây Dựng.' : 'Sources: CBRE Vietnam, Savills Vietnam, Ministry of Construction.'}
        </p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </section>
  );

  // ── CONTACT CTA ───────────────────────────────────────────────────────────────
  const contactCta = (
    <section className="py-16 bg-white" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-black mb-3 tracking-tight" style={{ color: TEXT1, letterSpacing: '-0.02em' }}>
          {lang === 'vi' ? 'Cần Tư Vấn BĐS Miễn Phí?' : 'Need Free Real Estate Consultation?'}
        </h2>
        <p className="mb-8" style={{ color: TEXT2 }}>
          {lang === 'vi' ? 'Chuyên viên SGS LAND hỗ trợ 7 ngày/tuần. Hotline:' : 'SGS LAND specialists available 7 days/week. Hotline:'}{' '}
          <strong style={{ color: TEXT1 }}>0971.132.378</strong>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="tel:+84971132378"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8892E 100%)`, color: NAVY }}>
            <Phone className="w-4 h-4" />
            {lang === 'vi' ? 'Gọi Ngay: 0971.132.378' : 'Call: 0971.132.378'}
          </a>
          <a href={`/${ROUTES.SEARCH}`}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors"
            style={{ border: `1px solid ${BORDER}`, color: TEXT2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}50`; (e.currentTarget as HTMLElement).style.color = GOLD; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT2; }}>
            {lang === 'vi' ? 'Xem Sàn Giao Dịch' : 'View Exchange'}
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );

  // ── FOOTER ────────────────────────────────────────────────────────────────────
  const footer = (
    <footer style={{ background: '#04080F' }} className="text-sm">
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}50, transparent)` }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">

          <div className="col-span-2 lg:col-span-2">
            <a href={`/${ROUTES.LANDING}`} className="flex items-center gap-2 mb-4 group w-fit">
              <Logo className="w-5 h-5 transition-transform group-hover:scale-110" stroke={GOLD} />
              <span className="font-bold text-base tracking-tight" style={{ color: GOLD }}>SGS LAND</span>
            </a>
            <p className="text-slate-500 leading-relaxed text-sm mb-6 max-w-xs">
              {lang === 'vi'
                ? 'Hệ điều hành Bất động sản tích hợp AI Agent, CRM đa kênh và Tự động hóa quy trình dành cho doanh nghiệp.'
                : 'Real estate platform integrating AI Agent, multi-channel CRM and workflow automation for enterprises.'}
            </p>
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li><a href="tel:+84971132378" className="flex items-center gap-2 hover:text-amber-400 transition-colors"><Phone className="w-3.5 h-3.5 shrink-0" stroke={GOLD} />0971.132.378</a></li>
              <li><a href="mailto:info@sgsland.vn" className="flex items-center gap-2 hover:text-amber-400 transition-colors"><Mail className="w-3.5 h-3.5 shrink-0" stroke={GOLD} />info@sgsland.vn</a></li>
              <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" stroke={GOLD} /><span>{lang === 'vi' ? 'TP. Hồ Chí Minh, Việt Nam' : 'Ho Chi Minh City, Vietnam'}</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Sản Phẩm' : 'Products'}</h4>
            <ul className="space-y-2.5">
              <FL label={lang === 'vi' ? 'Sàn Giao Dịch' : 'Exchange'}         href={`/${ROUTES.SEARCH}`} />
              <FL label={lang === 'vi' ? 'Định Giá AI' : 'AI Valuation'}       href={`/${ROUTES.AI_VALUATION}`} />
              <FL label="SGS CRM"                                               href={`/${ROUTES.CRM_SOLUTION}`} />
              <FL label={lang === 'vi' ? 'Ký Gửi BĐS' : 'List Property'}       href={`/${ROUTES.KY_GUI}`} />
              <FL label={lang === 'vi' ? 'Lãi Suất Ngân Hàng' : 'Bank Rates'}  href="/lai-suat-vay-ngan-hang" />
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Dự Án' : 'Projects'}</h4>
            <ul className="space-y-2.5">
              <FL label="Aqua City"           href={`/${ROUTES.DU_AN}/aqua-city`} />
              <FL label="The Global City"     href={`/${ROUTES.DU_AN}/the-global-city`} />
              <FL label="Izumi City"          href={`/${ROUTES.DU_AN}/izumi-city`} />
              <FL label="Vinhomes Cần Giờ"    href={`/${ROUTES.DU_AN}/vinhomes-can-gio`} />
              <FL label="Diamond Sky"         href={`/${ROUTES.DU_AN}/diamond-sky-van-phuc-city`} />
              <FL label="Vinhomes Grand Park" href={`/${ROUTES.DU_AN}/vinhomes-grand-park`} />
              <FL label="Vinhomes Central Park" href={`/${ROUTES.DU_AN}/vinhomes-central-park`} />
              <FL label="Sơn Kim Land"        href={`/${ROUTES.DU_AN}/son-kim-land`} />
              <FL label={lang === 'vi' ? 'Xem tất cả →' : 'View all →'} href={`/${ROUTES.DU_AN}`} />
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Khu Vực Nổi Bật' : 'Featured Areas'}</h4>
            <ul className="space-y-2.5">
              <FL label={lang === 'vi' ? 'BĐS Đồng Nai' : 'Dong Nai RE'}        href={`/${ROUTES.BDS_DONG_NAI}`} />
              <FL label={lang === 'vi' ? 'BĐS Long Thành' : 'Long Thanh RE'}     href={`/${ROUTES.BDS_LONG_THANH}`} />
              <FL label={lang === 'vi' ? 'BĐS Thủ Đức' : 'Thu Duc RE'}          href={`/${ROUTES.BDS_THU_DUC}`} />
              <FL label={lang === 'vi' ? 'BĐS Bình Dương' : 'Binh Duong RE'}     href={`/${ROUTES.BDS_BINH_DUONG}`} />
              <FL label={lang === 'vi' ? 'BĐS Quận 7' : 'District 7 RE'}         href={`/${ROUTES.BDS_QUAN_7}`} />
              <FL label={lang === 'vi' ? 'BĐS Phú Nhuận' : 'Phu Nhuan RE'}       href={`/${ROUTES.BDS_PHU_NHUAN}`} />
              <FL label={lang === 'vi' ? 'BĐS Bình Chánh' : 'Binh Chanh RE'}     href={`/${ROUTES.BDS_BINH_CHANH}`} />
              <FL label={lang === 'vi' ? 'BĐS Bình Thạnh' : 'Binh Thanh RE'}     href={`/${ROUTES.BDS_BINH_THANH}`} />
              <FL label={lang === 'vi' ? 'BĐS Long An' : 'Long An RE'}           href={`/${ROUTES.BDS_LONG_AN}`} />
              <FL label={lang === 'vi' ? 'Đầu Tư BĐS' : 'RE Investment'}         href="/dau-tu-bat-dong-san" />
              <FL label={lang === 'vi' ? 'Pháp Lý Nhà Đất' : 'Property Legal'}   href="/phap-ly-nha-dat" />
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Về Chúng Tôi' : 'About Us'}</h4>
            <ul className="space-y-2.5 mb-6">
              <FL label={lang === 'vi' ? 'Câu Chuyện' : 'Our Story'} href={`/${ROUTES.ABOUT}`} />
              <FL label={lang === 'vi' ? 'Tuyển Dụng' : 'Careers'}   href={`/${ROUTES.CAREERS}`} />
              <FL label={lang === 'vi' ? 'Tin Tức' : 'News'}          href={`/${ROUTES.NEWS}`} />
              <FL label={lang === 'vi' ? 'Liên Hệ' : 'Contact'}       href={`/${ROUTES.CONTACT}`} />
            </ul>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Hỗ Trợ' : 'Support'}</h4>
            <ul className="space-y-2.5 mb-6">
              <FL label={lang === 'vi' ? 'Trung Tâm Trợ Giúp' : 'Help Center'}   href={`/${ROUTES.HELP_CENTER}`} />
              <FL label={lang === 'vi' ? 'Hướng Dẫn Sử Dụng' : 'User Guide'}     href={`/${ROUTES.USER_GUIDE}`} />
              <FL label={lang === 'vi' ? 'Tài Liệu API' : 'API Documentation'}    href={`/${ROUTES.API_DOCS}`} />
              <FL label={lang === 'vi' ? 'Trạng Thái Hệ Thống' : 'System Status'} href={`/${ROUTES.STATUS_PUBLIC}`} />
            </ul>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-xs">{lang === 'vi' ? 'Pháp Lý' : 'Legal'}</h4>
            <ul className="space-y-2.5">
              <FL label={lang === 'vi' ? 'Chính Sách Bảo Mật' : 'Privacy Policy'}   href={`/${ROUTES.PRIVACY}`} />
              <FL label={lang === 'vi' ? 'Điều Khoản Sử Dụng' : 'Terms of Service'} href={`/${ROUTES.TERMS}`} />
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-slate-600 text-xs">
            © {new Date().getFullYear()} {lang === 'vi' ? 'SGS Land Corp. Bản quyền được bảo hộ.' : 'SGS Land Corp. All rights reserved.'}{' '}
            · <a href="https://sgsland.vn" className="hover:text-amber-400 transition-colors">sgsland.vn</a>
          </span>
          <div className="flex items-center gap-3">
            {[
              { href: 'https://www.facebook.com/sgslandvn', label: 'Facebook', icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> },
              { href: 'https://linkedin.com', label: 'LinkedIn', icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
              { href: 'https://zalo.me/sgsland', label: 'Zalo', icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.11-1.35A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1.5 14.5H8a.5.5 0 010-1h3.5V14H8.5a.5.5 0 010-1h3a1 1 0 011 1v1.5a1 1 0 01-1 1zm2-4H8a.5.5 0 010-1h7.5a.5.5 0 010 1zm0-2.5H8a.5.5 0 010-1h7.5a.5.5 0 010 1z" /></svg> },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-amber-700 transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans antialiased bg-white text-gray-900">
      {announcement}
      {header}
      {hero}
      {partners}
      {features}
      {projects}
      {statsBanner}
      {aiCta}
      {testimonials}
      {faqSection}
      {contactCta}
      {footer}
    </div>
  );
}
