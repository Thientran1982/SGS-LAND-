import React, { useState, useEffect, useRef } from "react";
import { AiChatWidget } from "../components/AiChatWidget";
import {
  Eye, Sparkles, ArrowRight, Phone, Mail, MapPin, Shield, ChevronDown,
  CheckCircle, Star, Bot, Search, TrendingUp, Users, Award,
  ChevronRight, BarChart3, Landmark, Clock, Heart, Building2,
  Sun, Moon, Globe, User, Menu, X,
} from "lucide-react";
import { SeoHead } from '../components/SeoHead';
import { type FeaturedProject, FEATURED_PROJECTS as PROJECTS } from '../shared/featuredProjects';
// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════
type Lang = "vi" | "en";
type Theme = "light" | "dark";

interface Props {
  featuredListings: any[];
  stats: { totalListings: number; totalProjects: number; totalBrokers: number };
}
// ═══════════════════════════════════════════════════════════════
//  STATIC DATA
// ═══════════════════════════════════════════════════════════════

const STATS_DATA = [
  { num: 45000, suffix: "+",        prefix: "",   vi: "BĐS quản lý",        en: "Properties"       },
  { num: 15000, suffix: "+",        prefix: "",   vi: "Môi giới đối tác",   en: "Partner Agents"   },
  { num: 1,     suffix: " tỷ USD+", prefix: "",   vi: "Giá trị giao dịch",  en: "Transaction Value"},
  { num: 48,    suffix: "/5",       prefix: "4.", vi: "Đánh giá khách hàng",en: "Customer Rating"  },
  { num: 5,     suffix: "%",        prefix: "±",  vi: "Sai số định giá AI", en: "AI Valuation MAPE"},
];
const TICKER_ITEMS: { vi: string; en: string }[] = [
  { vi: "Căn hộ Vinhomes Grand Park 2PN — 3,2 tỷ — Đã công chứng 10/06/2026",       en: "Vinhomes Grand Park 2BR Apt — 3.2B VND — Notarized 10/06/2026"         },
  { vi: "Nhà phố Aqua City 5×20m — 5,5 tỷ — Sổ hồng trao tay 08/06/2026",          en: "Aqua City Townhouse 5×20m — 5.5B VND — Title transferred 08/06/2026"  },
  { vi: "Nhà phố Vinhomes Hóc Môn 4×16m — 5,8 tỷ — Sổ hồng trao tay 05/06/2026",  en: "Vinhomes Hoc Mon Townhouse 4×16m — 5.8B VND — Title transferred 05/06/2026" },
  { vi: "Biệt thự The Global City — 35 tỷ — Đặt cọc thành công 03/06/2026",        en: "The Global City Villa — 35B VND — Deposit secured 03/06/2026"          },
  { vi: "Nhà phố Izumi City 4PN — 7,8 tỷ — Chốt hôm nay 01/06/2026",              en: "Izumi City Townhouse 4BR — 7.8B VND — Closed today 01/06/2026"         },
  { vi: "Shophouse Masteri Cosmo Central — 19,4 tỷ — Sang tên 29/05/2026",         en: "Masteri Cosmo Central Shophouse — 19.4B VND — Transferred 29/05/2026"  },
  { vi: "Nhà phố Vinhomes Cần Giờ 4PN — 8,5 tỷ — Nhận đặt cọc 27/05/2026",        en: "Vinhomes Can Gio 4BR Apt — 8.5B VND — Deposit accepted 27/05/2026"     },
];
const PLACEHOLDERS: { vi: string; en: string }[] = [
  { vi: "Mua căn hộ 2PN gần Metro…",       en: "2BR apartment near Metro…"        },
  { vi: "Tìm nhà phố có sổ hồng…",         en: "Townhouse with freehold title…"   },
  { vi: "Căn hộ Masteri pháp lý sạch…",    en: "Legal-clean Masteri apartment…"   },
  { vi: "Vay mua nhà lãi suất thấp…",      en: "Low-rate mortgage for a home…"    },
];
const QUICK_CHIPS: { vi: string; en: string }[] = [
  { vi: "Biệt thự Aqua City có sổ hồng", en: "Aqua City villa with freehold title" },
  { vi: "Căn hộ pháp lý sạch Tp.HCM",   en: "Legal-clean apartment in HCMC"       },
  { vi: "Vay 70% lãi suất thấp",         en: "70% mortgage, low interest rate"     },
];
const FAQ_ITEMS = [
  {
    q: "Tại sao nên mua bất động sản qua SGS LAND?",
    a: "SGS LAND là đại lý F1 uỷ quyền chính thức của Novaland, Masterise Homes, Nam Long, Vạn Phúc và Vinhomes — đảm bảo giá gốc, không phát sinh phí môi giới cho người mua, pháp lý minh bạch 2 lớp độc lập.",
    q_en: "Why buy real estate through SGS LAND?",
    a_en: "SGS LAND is the officially authorized F1 agent of Novaland, Masterise Homes, Nam Long, Van Phuc and Vinhomes — guaranteeing original prices, zero broker fees for buyers, and transparent 2-layer independent legal verification.",
  },
  {
    q: "Công nghệ định giá AI của SGS LAND chính xác bao nhiêu?",
    a: "Công nghệ SGS-AVM v2.1 sử dụng 9 hệ số định giá chuẩn TĐGVN/IVS, MAPE ±4.8%, dựa trên hơn 2.400 giao dịch công chứng thực tế. Kết quả tức thì, minh bạch từng yếu tố ảnh hưởng.",
    q_en: "How accurate is SGS LAND's AI valuation technology?",
    a_en: "SGS-AVM v2.1 uses 9 valuation factors compliant with TĐGVN/IVS standards, MAPE ±4.8%, based on 2,400+ real notarized transactions. Instant results with full transparency on each contributing factor.",
  },
  {
    q: "Quy trình kiểm tra pháp lý tại SGS LAND như thế nào?",
    a: "2 lớp độc lập: AI sơ thẩm kiểm tra quy hoạch 1/2000, sổ hồng, tranh chấp tài sản; Chuyên viên pháp lý xác nhận thực địa theo Luật Đất Đai 2024 và Luật Kinh doanh BĐS 2023.",
    q_en: "How does SGS LAND's legal verification process work?",
    a_en: "2 independent layers: AI first check covers zoning 1/2000, land title, and dispute records; Legal specialists then perform on-site verification under Land Law 2024 and Real Estate Business Law 2023.",
  },
  {
    q: "Người mua có phải trả phí dịch vụ không?",
    a: "Hoàn toàn miễn phí. Định giá AI, tư vấn pháp lý, hỗ trợ vay vốn — tất cả đều không mất phí với người mua và thuê. Người bán và chủ đầu tư chi trả hoa hồng dịch vụ cho SGS LAND.",
    q_en: "Do buyers pay any service fees?",
    a_en: "Completely free. AI valuation, legal advice, mortgage support — all at no cost to buyers and renters. Sellers and developers pay the commission to SGS LAND.",
  },
  {
    q: "SGS LAND hỗ trợ vay ngân hàng như thế nào?",
    a: "Đối tác với 12+ ngân hàng lớn (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, lãi suất từ 7–8,5%/năm. Đội tư vấn tài chính đồng hành từ hồ sơ đến giải ngân.",
    q_en: "How does SGS LAND help with bank financing?",
    a_en: "Partners with 12+ major banks (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, interest rates from 7–8.5%/year. Our financial advisory team guides you from application to disbursement.",
  },
  {
    q: "Những dự án nào đang phân phối tại SGS LAND?",
    a: "Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Cần Giờ, Masteri Cosmo Central, Diamond Sky, Vinhomes Hóc Môn — cập nhật liên tục.",
    q_en: "Which projects does SGS LAND currently distribute?",
    a_en: "Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Can Gio, Masteri Cosmo Central, Diamond Sky, Vinhomes Hoc Mon — continuously updated.",
  },
  {
    q: "Giá nhà phố tại TP.HCM hiện nay là bao nhiêu?",
    a: "Giá nhà phố tại TP.HCM dao động rất lớn theo khu vực: Quận 1 và trung tâm 150-400 triệu/m2, Thủ Đức (quận 9, 2) 40-80 triệu/m2, Bình Thạnh và Phú Nhuận 80-150 triệu/m2. Nhà phố liền kề trong dự án như Aqua City, The Global City giá 5-15 tỷ/căn. Shophouse mặt tiền trục chính cao hơn 20-40%. Bạn có thể sử dụng công cụ Định Giá AI miễn phí của SGS LAND để tra cứu giá chính xác theo địa chỉ cụ thể.",
    q_en: "What is the current price of townhouses in Ho Chi Minh City?",
    a_en: "Townhouse prices in HCMC vary significantly: District 1 150-400M/sqm, Thu Duc 40-80M/sqm. Use SGS LAND free AI valuation for precise pricing.",
  },
  {
    q: "Nên mua căn hộ hay nhà phố để đầu tư?",
    a: "Mỗi loại có ưu nhược điểm riêng: Căn hộ dễ cho thuê, thanh khoản cao, phù hợp đầu tư tài chính; nhà phố có biên độ tăng giá tốt hơn dài hạn, dòng tiền cho thuê cao hơn, nhưng vốn đầu tư lớn hơn. Nếu ngân sách 4-6 tỷ, căn hộ tại các dự án lớn như Vinhomes, Masterise phù hợp hơn. Ngân sách 5-15 tỷ, nhà phố liền kề tại Long Thành, Aqua City có tiềm năng tăng giá 3-5 năm. Tư vấn chuyên gia SGS LAND để phân tích phù hợp ngân sách bạn.",
    q_en: "Should I invest in apartments or townhouses?",
    a_en: "Apartments offer higher liquidity and easier rental management. Townhouses have better long-term appreciation. Choose based on your budget and investment horizon. SGS LAND experts can analyze options for your specific budget.",
  },
  {
    q: "Vay mua nhà cần chuẩn bị những gì?",
    a: "Để vay mua nhà thành công, bạn cần chuẩn bị: (1) Vốn tự có tối thiểu 20-30% giá trị BĐS; (2) Thu nhập ổn định, có xác nhận thu nhập 6-12 tháng gần nhất; (3) Lịch sử tín dụng tốt (không nợ xấu); (4) Hồ sơ BĐS đầy đủ pháp lý (sổ đỏ/sổ hồng, hợp đồng mua bán công chứng); (5) CMND/CCCD, hộ khẩu, giấy đăng ký kết hôn. SGS LAND hỗ trợ tư vấn vay vốn miễn phí với 12+ ngân hàng đối tác, lãi suất ưu đãi 7-8.5%/năm.",
    q_en: "What do I need to prepare to get a mortgage?",
    a_en: "You need: 20-30% down payment, stable income proof, good credit history, complete legal documentation, and personal ID. SGS LAND provides free mortgage consultation with 12+ partner banks.",
  },
  {
    q: "Sổ hồng và sổ đỏ khác nhau như thế nào?",
    a: "Sổ hồng (Giấy chứng nhận quyền sử dụng đất và quyền sở hữu nhà ở) cấp cho nhà ở, căn hộ chung cư, nhà phố. Sổ đỏ (Giấy chứng nhận quyền sử dụng đất) cấp cho đất trống, đất nông nghiệp. Từ năm 2009, cả hai được gộp thành một loại giấy chứng nhận thống nhất màu hồng đỏ. Khi mua BĐS, quan trọng nhất là BĐS phải có giấy chứng nhận hợp lệ, không tranh chấp, và tình trạng pháp lý rõ ràng. SGS LAND kiểm tra pháp lý 2 lớp miễn phí cho mọi giao dịch.",
    q_en: "What is the difference between Pink Book and Red Book in Vietnam?",
    a_en: "Pink Book covers residential property; Red Book covers land use rights. Since 2009 they are merged into one unified certificate. SGS LAND provides free 2-layer legal verification for all transactions.",
  },
  {
    q: "BĐS Long Thành có đáng đầu tư không?",
    a: "Long Thành là điểm nóng đầu tư BĐS 2026-2030 nhờ: (1) Sân bay quốc tế Long Thành giai đoạn 1 hoàn thành 2026, dự kiến 25 triệu hành khách/năm; (2) Hạ tầng cao tốc kết nối TP.HCM đã hoàn thiện; (3) Quỹ đất còn lớn, giá hiện 8-25 triệu/m2 còn thấp so với tiềm năng; (4) Novaland Aqua City, Gem Sky World và nhiều dự án lớn đang phát triển mạnh. Rủi ro: pháp lý chưa hoàn chỉnh một số dự án nhỏ, cần kiểm tra kỹ. SGS LAND tư vấn chuyên sâu BĐS Long Thành.",
    q_en: "Is investing in Long Thanh real estate worthwhile?",
    a_en: "Long Thanh is a top investment hotspot for 2026-2030, driven by the new international airport completing Phase 1 in 2026 and strong infrastructure development. SGS LAND provides specialized Long Thanh investment consultation.",
  },
  {
    q: "Thủ Đức có còn là khu vực đáng đầu tư không?",
    a: "TP. Thủ Đức vẫn là khu vực hàng đầu TP.HCM về tiềm năng đầu tư BĐS nhờ: (1) Là trung tâm đổi mới sáng tạo, đại học công nghệ, khu công nghệ cao; (2) Vinhomes Grand Park với 280 ha và 80.000 dân đang tạo hệ sinh thái đô thị hoàn chỉnh; (3) Hạ tầng giao thông metro line 1 và đường vành đai đang phát triển; (4) Giá căn hộ còn 35-70 triệu/m2, thấp hơn quận trung tâm 50-60%. Khu vực An Phú, Thảo Điền, Bình An là hot spot nhất. Tư vấn đầu tư Thủ Đức miễn phí với SGS LAND.",
    q_en: "Is Thu Duc City still a good investment area?",
    a_en: "Thu Duc City remains HCMC's top investment area with its tech innovation hub, Vinhomes Grand Park mega-project, and planned Metro Line 1. Apartment prices at 35-70M/sqm still offer upside potential. Free Thu Duc investment consultation available at SGS LAND.",
  },
  {
    q: "Mua nhà lần đầu cần lưu ý gì?",
    a: "Người mua nhà lần đầu cần chú ý 5 điểm quan trọng: (1) Pháp lý rõ ràng — kiểm tra sổ hồng/đỏ, không tranh chấp, quy hoạch 1/2000; (2) Định giá đúng — dùng công cụ AI hoặc tham khảo 3-5 BĐS tương đương; (3) Khả năng tài chính — đừng vay quá 40% thu nhập hàng tháng cho khoản trả nợ; (4) Tính thanh khoản — chọn khu vực có nhu cầu cao, gần tiện ích; (5) Uy tín chủ đầu tư — kiểm tra tiến độ dự án và lịch sử giao nhà. SGS LAND hỗ trợ kiểm tra pháp lý và định giá miễn phí cho người mua nhà lần đầu.",
    q_en: "What should first-time home buyers know?",
    a_en: "Key points for first-time buyers: verify legal documents, get proper valuation, keep mortgage payments under 40% of income, choose high-liquidity areas, and verify developer track record. SGS LAND offers free legal and valuation checks for first-time buyers.",
  },
  {
    q: "SGS LAND phục vụ khu vực nào?",
    a: "SGS LAND hiện phục vụ toàn bộ thị trường BĐS khu vực Đông Nam Bộ bao gồm: TP.HCM (tất cả 22 quận/huyện và TP Thủ Đức), Đồng Nai (Long Thành, Nhơn Trạch, Biên Hòa), Bình Dương (Thuận An, Dĩ An, Thủ Dầu Một, Bến Cát), Long An (Cần Giuộc, Bến Lức), và Bà Rịa - Vũng Tàu. Công cụ Định Giá AI phủ sóng hơn 45.000+ giao dịch thực tế trong vùng. Ngoài vùng phủ sóng chính, chúng tôi vẫn tư vấn theo yêu cầu.",
    q_en: "Which areas does SGS LAND serve?",
    a_en: "SGS LAND covers all of Southeast Vietnam: Ho Chi Minh City (22 districts + Thu Duc City), Dong Nai (Long Thanh, Nhon Trach, Bien Hoa), Binh Duong, Long An, and Ba Ria-Vung Tau — covering 45,000+ real transactions in the region.",
  },
  {
    q: "Làm thế nào để biết giá BĐS trong khu vực đang tăng hay giảm?",
    a: "Để theo dõi xu hướng giá BĐS khu vực, bạn có thể: (1) Dùng công cụ Định Giá AI SGS LAND so sánh lịch sử giá 24 tháng; (2) Theo dõi chỉ số giao dịch thực tế (không phải giá rao bán) từ cơ sở dữ liệu 45.000+ giao dịch công chứng; (3) Xem xét các yếu tố vĩ mô: lãi suất, tín dụng BĐS, chính sách nhà ở; (4) Chú ý hạ tầng mới: cao tốc, metro, khu công nghiệp kéo theo giá tăng; (5) Tham khảo báo cáo thị trường SGS LAND cập nhật hàng quý. Đăng ký nhận báo cáo thị trường miễn phí tại sgsland.vn.",
    q_en: "How do I know if real estate prices in my area are rising or falling?",
    a_en: "Monitor price trends using SGS LAND's AI valuation with 24-month history, track actual transaction data from 45,000+ notarized deals, and monitor infrastructure developments that drive price appreciation. Subscribe to SGS LAND quarterly market reports at sgsland.vn.",
  },
];
const FILTER_TABS = [
  { id: "all", vi: "Tất cả", en: "All" },
  { id: "apt", vi: "Căn hộ", en: "Apartments" },
  { id: "villa", vi: "Biệt thự", en: "Villas" },
  { id: "townhouse", vi: "Nhà phố", en: "Townhouses" },
];
const BADGE_STYLES: Record<string, React.CSSProperties> = {
  sale: { background: "rgba(30,127,92,0.12)", color: "var(--sgs-verified)", border: "1px solid rgba(30,127,92,0.25)" },
  open: { background: "rgba(27,58,92,0.10)",  color: "var(--sgs-text-heading, var(--sgs-primary))", border: "1px solid rgba(27,58,92,0.2)"  },
  soon: { background: "rgba(200,150,62,0.12)",color: "var(--sgs-accent-text)", border: "1px solid rgba(200,150,62,0.3)" },
};
// ═══════════════════════════════════════════════════════════════
//  HOOKS
// ═══════════════════════════════════════════════════════════════
function useInView(threshold = 0.25) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}
function useCountUp(target: number, duration = 1800, active = false) {
  const [count, setCount] = useState(target);
  useEffect(() => {
    if (!active) return;
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setCount(target);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, active]);
  return count;
}
// ═══════════════════════════════════════════════════════════════
//  SHARED: Section Heading
// ═══════════════════════════════════════════════════════════════
function SectionHeading({ title, subtitle, center = false }: {
  title: React.ReactNode; subtitle?: string; center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <h2
        className="text-2xl sm:text-3xl font-semibold leading-tight"
        style={{
          fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
          color: "var(--sgs-primary, var(--sgs-primary))",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      <div
        className={center ? "mx-auto" : ""}
        style={{ width: "48px", height: "3px", background: "var(--sgs-accent)", borderRadius: "2px", marginTop: "10px", marginBottom: subtitle ? "12px" : 0 }}
      />
      {subtitle && (
        <p className="text-base mt-2" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — HERO
// ═══════════════════════════════════════════════════════════════
function HeroSection({ onSearch, lang, isCrm }: { onSearch: (q: string) => void; lang: Lang; isCrm?: boolean }) {
  const [query, setQuery]           = useState("");
  const [phIdx, setPhIdx]           = useState(0);
  const [visible, setVisible]       = useState(false);
  // null = before mount (SSR-safe); true = mobile ≤639px; false = desktop
  const [isMobile, setIsMobile]     = useState<boolean | null>(null);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const id = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const placeholderText = (isMobile === null || isMobile)
    ? (lang === "vi" ? "Mô tả nhu cầu BĐS..." : "Describe your property needs...")
    : PLACEHOLDERS[phIdx][lang];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query || PLACEHOLDERS[phIdx][lang]);
  };
  const chip = (text: string) => {
    setQuery(text);
    document.getElementById("sgs-search")?.focus();
  };
  return (
    <section
      className="relative flex flex-col justify-center overflow-hidden"
      style={{
        minHeight: "88vh",
        paddingTop: isCrm ? "24px" : "80px",
        background: "linear-gradient(175deg, var(--sgs-hero-deep) 0%, var(--sgs-primary-deep) 45%, var(--sgs-primary) 80%, rgba(200,150,62,0.18) 100%)",
      }}
    >
      {/* City silhouette */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none" style={{ height: "180px" }}>
        <svg viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", opacity: 0.10 }}>
          <path d="M0,180 L0,120 L40,120 L40,90 L60,90 L60,120 L80,120 L80,70 L100,70 L100,55 L120,55 L120,70 L140,70 L140,120 L160,120 L160,80 L180,80 L180,45 L190,45 L190,25 L200,25 L200,45 L210,45 L210,80 L240,80 L240,100 L260,100 L260,60 L280,60 L280,35 L300,35 L300,18 L310,18 L310,8 L320,8 L320,18 L330,18 L330,35 L360,35 L360,60 L380,60 L380,95 L400,95 L400,70 L420,70 L420,45 L440,45 L440,70 L460,70 L460,95 L480,95 L480,120 L500,120 L500,90 L520,90 L520,62 L540,62 L540,90 L560,90 L560,115 L580,115 L580,78 L600,78 L600,52 L620,52 L620,35 L640,35 L640,52 L660,52 L660,78 L680,78 L680,108 L720,108 L720,135 L760,135 L760,108 L780,108 L780,80 L800,80 L800,62 L820,62 L820,80 L840,80 L840,108 L860,108 L860,80 L880,80 L880,52 L900,52 L900,35 L920,35 L920,52 L940,52 L940,80 L960,80 L960,108 L1000,108 L1000,80 L1020,80 L1020,62 L1040,62 L1040,45 L1060,45 L1060,62 L1080,62 L1080,80 L1100,80 L1100,108 L1120,108 L1120,70 L1140,70 L1140,45 L1160,45 L1160,25 L1180,25 L1180,45 L1200,45 L1200,70 L1240,70 L1240,98 L1260,98 L1260,70 L1280,70 L1280,90 L1300,90 L1300,118 L1320,118 L1320,98 L1340,98 L1340,120 L1360,120 L1360,100 L1400,100 L1400,120 L1440,120 L1440,180 Z"
            fill="var(--sgs-accent)"/>
        </svg>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: "rgba(200,150,62,0.15)", border: "1px solid rgba(200,150,62,0.4)", color: "#D4A855" }}
        >
          <Award className="w-3.5 h-3.5" />
          {lang === "vi" ? "Đại lý uỷ quyền — Novaland · Masterise · Nam Long · Vinhomes" : "Authorized Agent — Novaland · Masterise · Nam Long · Vinhomes"}
        </div>
        {/* Kinetic headline */}
        <h1
          id="seo-h1"
          className="mb-5"
          style={{
            fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
            fontWeight: 600,
            fontSize: "clamp(2rem, 5vw, 3.8rem)",
            lineHeight: 1.15,
            color: "#FFFFFF",
            letterSpacing: "-0.02em",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.75s ease, transform 0.75s ease",
          }}
        >
          {lang === "vi" ? (
            <>
              Tìm kiếm, mua &amp;{" "}
              <span
                className="italic"
                style={{ color: "#D4A855", display: "inline-block", position: "relative" }}
              >
                đầu tư
                <span
                  style={{
                    position: "absolute", bottom: "-2px", left: 0, height: "2.5px",
                    background: "#D4A855", borderRadius: "2px",
                    animation: "underline-draw 0.55s ease 0.85s forwards",
                    width: 0,
                  }}
                />
              </span>{" "}
              Bất Động Sản 
            </>
          ) : (
            <>
              Search, Buy &amp;{" "}
              <span className="italic" style={{ color: "#D4A855" }}>invest</span>{" "}
              Real Estate
            </>
          )}
        </h1>

        <p
          className="text-base sm:text-lg max-w-lg mb-10"
          style={{
            color: "rgba(220,232,244,0.78)",
            fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.75s ease 0.18s",
          }}
        >
          {lang === "vi"
           ? "Mua đúng giá. Pháp lý rõ ràng. 15.000+ môi giới và 45.000+ bất động sản chờ bạn tại TP.HCM – Đồng Nai – Bình Dương - Long An."
            : "Buy at the right price. Clear legal stactus. 15.000 agents and 45,000+ properties waiting for you across HCMC - Dong Nai - Binh Duong - Long An."}
        </p>
        {/* ── 2026 AI Search Panel ── */}
        <div style={{ marginBottom: "-52px", maxWidth: "720px", position: "relative", zIndex: 20 }}>
          {/* Ambient glow behind the card */}
          <div
            aria-hidden
            style={{
              position: "absolute", inset: "-2px", borderRadius: "20px", zIndex: -1,
              background: "linear-gradient(135deg, rgba(200,150,62,0.55) 0%, rgba(100,160,220,0.35) 50%, rgba(200,150,62,0.55) 100%)",
              backgroundSize: "300% 300%",
              animation: "aurora-border 6s ease infinite",
              filter: "blur(8px)",
              opacity: 0.7,
            }}
          />
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.10)",
            }}
          >
            {/* Top bar — AI status */}
            <div
              className="flex items-center px-4 sm:px-5 pt-4 pb-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <span style={{
                    display: "block", width: 7, height: 7, borderRadius: "50%",
                    background: "#4ADE80",
                    boxShadow: "0 0 5px 1px rgba(74,222,128,0.45)",
                    animation: "pulse-dot 2s ease-in-out infinite",
                  }} />
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em",
                  color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
                  fontFamily: "var(--font-be-vietnam, sans-serif)",
                }}>
                  {lang === "vi" ? "AI · Đang lắng nghe" : "AI · Listening"}
                </span>
              </div>
            </div>

            {/* Search input row */}
            <form onSubmit={submit} className="px-3 sm:px-4 py-3 sm:py-4">
              <div
                className="flex items-center rounded-xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                  transition: "border-color 0.25s, box-shadow 0.25s",
                }}
                onFocusCapture={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.border = "1.5px solid rgba(200,150,62,0.7)";
                  el.style.boxShadow = "0 0 0 3px rgba(200,150,62,0.12)";
                }}
                onBlurCapture={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.border = "1.5px solid rgba(255,255,255,0.12)";
                  el.style.boxShadow = "none";
                }}
              >
                {/* Sparkle icon */}
                <span className="pl-4 pr-1 flex-shrink-0" style={{ color: "rgba(200,150,62,0.7)", lineHeight: 1 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.5 9L20 10.5L13.5 12L12 19L10.5 12L4 10.5L10.5 9L12 2Z" fill="currentColor" opacity="0.9"/>
                    <path d="M19 2L19.8 5.2L23 6L19.8 6.8L19 10L18.2 6.8L15 6L18.2 5.2L19 2Z" fill="currentColor" opacity="0.6"/>
                  </svg>
                </span>
                <input
                  id="sgs-search"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={placeholderText}
                  className="flex-1 py-3 px-2 text-[16px] md:text-sm outline-none bg-transparent"
                  style={{
                    color: "rgba(255,255,255,0.92)",
                    caretColor: "#D4A855",
                    fontFamily: "var(--font-be-vietnam, sans-serif)",
                  }}
                />
                {/* Inline submit */}
                <button
                  type="submit"
                  className="flex-shrink-0 m-1.5 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: "linear-gradient(135deg, #D4A855 0%, #C8963C 100%)",
                    color: "#0A1C33",
                    letterSpacing: "0.02em",
                    boxShadow: "0 2px 12px rgba(200,150,62,0.35)",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(200,150,62,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(200,150,62,0.35)"; }}
                >
                  {lang === "vi" ? "Hỏi ngay" : "Ask AI"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </form>

            {/* Quick chips */}
            <div
              className="px-3 sm:px-4 pb-4 flex flex-wrap gap-2"
            >
              {QUICK_CHIPS.map((c, i) => (
                <button
                  key={c.vi}
                  onClick={() => chip(c[lang])}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.70)",
                    fontFamily: "var(--font-be-vietnam, sans-serif)",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(200,150,62,0.15)";
                    e.currentTarget.style.border = "1px solid rgba(200,150,62,0.45)";
                    e.currentTarget.style.color = "#D4A855";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                  }}
                >
                  {c[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — STATS BAR
// ═══════════════════════════════════════════════════════════════
function StatItem({ num, suffix, prefix, label }: { num: number; suffix: string; prefix: string; label: string }) {
  const { ref, inView } = useInView(0.3);
  const count = useCountUp(num, 1800, inView);
  const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("vi-VN") : String(n));
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="text-center px-2 py-1">
      <div
        className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums"
        style={{
          fontFamily: "var(--font-ibm-plex-mono, var(--font-jetbrains-mono), monospace)",
          color: "var(--sgs-primary, var(--sgs-primary))",
        }}
      >
        {prefix}{fmt(count)}{suffix}
      </div>
      <div className="text-xs sm:text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{label}</div>
    </div>
  );
}
function StatsBar({ lang }: { lang: Lang }) {
  return (
    <section
      className="relative z-10"
      style={{
        background: "var(--sgs-surface, #FFFFFF)",
        borderBottom: "1px solid rgba(27,58,92,0.08)",
        paddingTop: "76px",
        paddingBottom: "28px",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 divide-x divide-slate-100">
          {STATS_DATA.map(s => (
            <StatItem
              key={s.vi}
              num={s.num} suffix={s.suffix} prefix={s.prefix}
              label={lang === "vi" ? s.vi : s.en}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 3 — LEGAL TICKER
// ═══════════════════════════════════════════════════════════════
function LegalTicker({ lang }: { lang: Lang }) {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--sgs-primary-deep)",
        borderTop: "1px solid rgba(200,150,62,0.15)",
        borderBottom: "1px solid rgba(200,150,62,0.15)",
        padding: "12px 0",
        isolation: "isolate",
      }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker-scroll 20s linear infinite" }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-sm px-8"
            data-ticker={lang}
            style={{
              color: "#B9C6D4",
              fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
            }}
          >
            <span style={{ color: "var(--sgs-accent)", fontSize: "8px" }}>●</span>
            <span style={{ color: "var(--sgs-verified)", fontWeight: 600 }}>✓</span>
            {item[lang]}
          </span>
        ))}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — PROJECTS
// ═══════════════════════════════════════════════════════════════
function ProjectCard({ proj, lang }: { proj: FeaturedProject; lang: Lang }) {
  return (
    <a
      href={proj.landingHref ?? `/du-an/${proj.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--sgs-surface, #FFFFFF)",
        border: "1px solid rgba(27,58,92,0.08)",
        boxShadow: "0 1px 4px rgba(22,32,43,0.06)",
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 28px rgba(22,32,43,0.12)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(22,32,43,0.06)")}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16/9", background: "linear-gradient(135deg, var(--sgs-primary-deep), var(--sgs-primary))" }}
      >
        <img           src={proj.img} alt={proj.name}  loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span
          className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={BADGE_STYLES[proj.badgeType]}
        >
          {lang === "vi" ? proj.badge : proj.badge_en}
        </span>
        {proj.legal && (
          <span
            className="absolute top-3 right-3 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(30,127,92,0.9)", color: "#FFFFFF", backdropFilter: "blur(4px)" }}
          >
            <CheckCircle className="w-3 h-3" /> {lang === "vi" ? "Pháp lý ✓" : "Legal ✓"}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-medium mb-1" style={{ color: "var(--sgs-accent-text)" }}>{lang === "vi" ? proj.type : proj.type_en}</span>
        <h3
          className="font-semibold text-sm mb-1 leading-snug"
          style={{ color: "var(--sgs-text, var(--sgs-text))", fontFamily: "var(--font-be-vietnam, sans-serif)" }}
        >
          {proj.name}
        </h3>
        <div className="flex items-center gap-1 text-xs mb-3" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          <MapPin className="w-3 h-3 shrink-0" />{proj.dev} · {proj.loc}
        </div>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="text-[11px] mb-0.5" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{lang === "vi" ? `Quy mô ${proj.scale}` : `Scale: ${proj.scale}`}</div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--sgs-accent-text, var(--sgs-accent-text))", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {lang === "vi" ? `Từ ${proj.priceFrom}` : `From ${proj.priceFrom}`}
            </div>
          </div>
          <div
            className="flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-1"
            style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}
          >
            {lang === "vi" ? "Xem" : "View"} <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </a>
  );
}
function ProjectsSection({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? PROJECTS : PROJECTS.filter(p => p.category === filter);

  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <SectionHeading
            title={lang === "vi" ? "Dự án nổi bật" : "Featured Projects"}
            subtitle={lang === "vi" ? "Đại lý phân phối F1 uỷ quyền chính thức" : "Official F1 authorized distributor"}
          />
          <a
            href="/du-an"
            className="flex items-center gap-1 text-sm font-semibold shrink-0 mb-2"
            style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}
          >
            {lang === "vi" ? "Xem tất cả" : "View all"} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: filter === tab.id ? "var(--sgs-primary)" : "var(--sgs-surface, #FFFFFF)",
                color: filter === tab.id ? "#FFFFFF" : "var(--sgs-primary)",
                border: filter === tab.id ? "1px solid var(--sgs-primary)" : "1px solid rgba(27,58,92,0.18)",
              }}
            >
              {lang === "vi" ? tab.vi : tab.en}
            </button>
          ))}
        </div>
        {/* 1-col mobile / 2-col tablet / 3-col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => <ProjectCard key={p.slug} proj={p} lang={lang} />)}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 5 — VALUATION PROMO
// ═══════════════════════════════════════════════════════════════
// ============================================================
// SECTION - HOT LISTINGS (Sản phẩm được xem nhiều nhất)
// ============================================================
function HotListingsSection({ lang }: { lang: Lang }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/listings?pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const data = Array.isArray(d?.data) ? d.data : [];
        const sorted = data
          .filter((x: any) => (x?.viewCount || 0) > 0)
          .sort((a: any, b: any) => (b?.viewCount || 0) - (a?.viewCount || 0))
          .slice(0, 6);
        setItems(sorted);
      })
      .catch(() => setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const fmtPrice = (p: number) => {
    if (!p) return lang === "vi" ? "Liên hệ" : "Contact";
    if (p >= 1e9) {
      const v = p / 1e9;
      const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
      return `${s} tỷ`;
    }
    if (p >= 1e6) return `${Math.round(p / 1e6).toLocaleString("vi-VN")} triệu`;
    return p.toLocaleString("vi-VN");
  };
  const fmtViews = (v: number) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v));

  const statusLabel = (s: string) => {
    const m: Record<string, [string, string]> = {
      AVAILABLE: ["ĐANG BÁN", "For Sale"],
      OPENING: ["MỎ BÁN", "Opening"],
      BOOKING: ["ĐẶT CHỖ", "Booking"],
      HOLD: ["GIỮ CHỖ", "On Hold"],
      SOLD: ["ĐÃ BÁN", "Sold"],
    };
    return (m[s] || [s, s])[lang === "vi" ? 0 : 1];
  };

  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }} data-section="hot-listings">
      <div className="max-w-6xl mx-auto px-5">
        <SectionHeading
          title={lang === "vi" ? "Sản phẩm được xem nhiều nhất" : "Most Viewed Listings"}
          subtitle={lang === "vi" ? "Những BĐS được quan tâm nhiều nhất trên sàn giao dịch SGS LAND" : "The most-viewed properties on the SGS LAND exchange"}
        />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: "var(--sgs-surface, #fff)", border: "1px solid var(--sgs-border)" }}>
                <div className="aspect-[4/3]" style={{ background: "var(--sgs-border)" }} />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 rounded-full" style={{ background: "var(--sgs-border)" }} />
                  <div className="h-3 w-1/2 rounded-full" style={{ background: "var(--sgs-border)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? null : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {items.map((it, idx) => {
              const img = (Array.isArray(it.images) && it.images[0]) || "/placeholder.jpg";
              const loc = it.location || it.address || (lang === "vi" ? "Đang cập nhật" : "Updating");
              return (
                <a
                  key={it.id || idx}
                  href={`#/listing/${it.id}`}
                  className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{ background: "var(--sgs-surface, #fff)", border: "1px solid var(--sgs-border)", boxShadow: "0 1px 2px rgba(10,31,68,0.04)", textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(10,31,68,0.12)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 2px rgba(10,31,68,0.04)"; }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={img} alt={it.title || "Listing"} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(212,168,85,0.95)", color: "#0A1F44", backdropFilter: "blur(4px)" }}>
                      {idx === 0 ? <Award className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      {idx === 0 ? (lang === "vi" ? "XEM NHIỀU NHẤT" : "TOP VIEWED") : `#${idx + 1}`}
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(10,31,68,0.82)", color: "#fff", backdropFilter: "blur(4px)" }}>
                      <Eye className="w-3.5 h-3.5" />{fmtViews(it.viewCount || 0)}
                    </div>
                    <div className="absolute bottom-3 left-3 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.92)", color: "var(--sgs-text, #1e293b)" }}>
                      {statusLabel(it.status)}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-bold leading-snug line-clamp-2 mb-2" style={{ color: "var(--sgs-text-heading, var(--sgs-text))", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                      {it.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs mb-3" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-1">{loc}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mb-4" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
                      {it.area ? <span>{it.area} m²</span> : null}
                      {it.bedrooms ? <span>{""}{it.bedrooms} PN</span> : null}
                    </div>
                    <div className="mt-auto flex items-end justify-between">
                      <div className="text-lg font-bold tabular-nums" style={{ color: "var(--sgs-accent-text, var(--sgs-primary))", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}>
                        {fmtPrice(it.price)}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-1" style={{ color: "var(--sgs-primary)" }}>
                        {lang === "vi" ? "Xem chi tiết" : "View details"}<ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ValuationSection({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-surface, #FFFFFF)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div>
            <SectionHeading
              title={lang === "vi" ? "Định giá AI ±5% — Chính xác tức thì" : "AI Valuation ±5% — Instant Accuracy"}
              subtitle={lang === "vi"
                ? "SGS-AVM v2.1 · 9 hệ số · 2.400+ giao dịch thực · Chuẩn TĐGVN/IVS"
                : "SGS-AVM v2.1 · 9 factors · 2,400+ real transactions · TĐGVN/IVS standard"}
            />
            <ul className="space-y-3 my-7">
              {(lang === "vi" ? [
                "Kết quả tức thì dưới 30 giây",
                "Phân tích 9 yếu tố: vị trí, pháp lý, tiện ích, thị trường",
                "Báo cáo PDF chuyên nghiệp kèm so sánh thị trường",
                "Hoàn toàn miễn phí cho người dùng cá nhân",
              ] : [
                "Results in under 30 seconds",
                "9 factors: location, legal, amenities, market conditions",
                "Professional PDF report with market comparison",
                "Completely free for individual users",
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--sgs-verified)" }} />
                  <span className="text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/ai-valuation"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-accent)")}
            >
              <Sparkles className="w-4 h-4" />
              {lang === "vi" ? "Định giá ngay — Miễn phí" : "Valuate for Free"}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          {/* Mock valuation UI */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(145deg, #F8F9FB, #EDF1F7)",
              border: "1px solid rgba(27,58,92,0.1)",
              boxShadow: "0 4px 24px rgba(27,58,92,0.08)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}>{lang === "vi" ? "Kết quả định giá AI" : "AI Valuation Result"}</span>
              <span
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(30,127,92,0.1)", color: "var(--sgs-verified)" }}
              >
                <CheckCircle className="w-3 h-3" /> ±4.8%
              </span>
            </div>
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.7)" }}>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}>Vinhomes Grand Park 2PN · 65m²</p>
              <p className="text-xs" style={{ color: "var(--sgs-text-muted)" }}>{lang === "vi" ? "TP Thủ Đức · Tầng 15 · Hướng Đông Nam" : "Thu Duc City · Floor 15 · SE Facing"}</p>
            </div>
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2" style={{ color: "var(--sgs-text-muted)" }}>
                <span>2,85 tỷ</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "var(--sgs-accent-text)", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  3,18 tỷ ★
                </span>
                <span>3,45 tỷ</span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: "var(--sgs-border)" }}>
                <div
                  className="absolute top-0 left-[22%] right-[22%] h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, rgba(200,150,62,0.25), var(--sgs-accent), rgba(200,150,62,0.25))" }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
                  style={{ left: "calc(50% - 8px)", background: "var(--sgs-accent)", boxShadow: "0 2px 6px rgba(200,150,62,0.5)" }}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              {(lang === "vi" ? [
                { label: "Vị trí & Kết nối",        score: 88 },
                { label: "Pháp lý",                 score: 95 },
                { label: "Tiện ích nội khu",         score: 82 },
                { label: "Thanh khoản thị trường",   score: 79 },
              ] : [
                { label: "Location & Connectivity", score: 88 },
                { label: "Legal",                   score: 95 },
                { label: "Amenities",               score: 82 },
                { label: "Market Liquidity",        score: 79 },
              ]).map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-xs shrink-0 w-36" style={{ color: "var(--sgs-text-muted)" }}>{f.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--sgs-border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${f.score}%`, background: f.score > 85 ? "var(--sgs-verified)" : "var(--sgs-accent)" }}
                    />
                  </div>
                  <span
                    className="text-xs w-7 text-right font-medium"
                    style={{ color: "var(--sgs-text-heading, var(--sgs-primary))", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 6 — BENTO "WHY SGS LAND"
// ═══════════════════════════════════════════════════════════════
function BentoSection({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <SectionHeading
            title={lang === "vi" ? "Tại sao chọn SGS LAND?" : "Why SGS LAND?"}
            subtitle={lang === "vi"
              ? "Nền tảng proptech tin dùng bởi 15.000+ môi giới và doanh nghiệp BĐS"
              : "Trusted by 15,000+ agents and real estate companies"}
          />
        </div>
        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Big card — spans 2 cols × 2 rows */}
          <div
            className="sm:col-span-2 lg:row-span-2 rounded-2xl p-7 flex flex-col"
            style={{
              background: "linear-gradient(145deg, var(--sgs-primary-deep), var(--sgs-primary))",
              border: "1px solid rgba(200,150,62,0.2)",
              minHeight: "260px",
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(200,150,62,0.15)" }}>
              <Sparkles className="w-6 h-6" style={{ color: "#D4A855" }} />
            </div>
            <h3 className="text-xl font-semibold mb-2"
              style={{ color: "#FFFFFF", fontFamily: "var(--font-noto-serif, serif)" }}>
              {lang === "vi" ? "Định giá AI ±5%" : "AI Valuation ±5%"}
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--sgs-on-dark-muted)" }}>
              {lang === "vi"
                ? "SGS-AVM v2.1 — 9 hệ số TĐGVN/IVS. Phân tích realtime từ 2.400+ giao dịch công chứng thực tế."
                : "SGS-AVM v2.1 — 9 TĐGVN/IVS factors. Real-time analysis from 2,400+ notarized transactions."}
            </p>
            {/* Sparkline */}
            <div className="mt-auto">
              <svg viewBox="0 0 200 44" className="w-full" style={{ height: "44px" }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(200,150,62,0.25)" />
                    <stop offset="100%" stopColor="rgba(200,150,62,0)" />
                  </linearGradient>
                </defs>
                <polyline points="0,38 28,32 60,27 90,18 120,24 150,14 178,9 200,6"
                  fill="none" stroke="rgba(200,150,62,0.7)" strokeWidth="1.5" strokeLinejoin="round"/>
                <polygon points="0,38 28,32 60,27 90,18 120,24 150,14 178,9 200,6 200,44 0,44"
                  fill="url(#sparkFill)" />
                <circle cx="200" cy="6" r="3" fill="#D4A855" />
              </svg>
              <p className="text-[11px]" style={{ color: "var(--sgs-on-dark-muted)" }}>{lang === "vi" ? "Thị trường BĐS Đông Nam Bộ Q2/2026" : "SE Vietnam Real Estate Market Q2/2026"}</p>
            </div>
          </div>
          {/* Legal */}
          <div
            className="sm:col-span-2 rounded-2xl p-6 flex items-start gap-4"
            style={{
              background: "var(--sgs-surface, #FFFFFF)",
              border: "1px solid rgba(27,58,92,0.09)",
              boxShadow: "0 1px 3px rgba(22,32,43,0.06)",
            }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(30,127,92,0.1)" }}>
              <Shield className="w-5 h-5" style={{ color: "var(--sgs-verified)" }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1.5"
                style={{ color: "var(--sgs-text-heading, var(--sgs-primary))", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                {lang === "vi" ? "Pháp lý 2 lớp độc lập" : "Independent 2-Layer Legal Check"}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "var(--sgs-text-muted)" }}>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--sgs-verified)" }} />
                  {lang === "vi" ? "AI: Quy hoạch 1/2000 + sổ đỏ" : "AI: Zoning 1/2000 + Title deed"}
                </span>
                <span style={{ color: "#CBD5E1" }}>→</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--sgs-verified)" }} />
                  {lang === "vi" ? "Chuyên viên: Xác nhận thực địa" : "Expert: On-site verification"}
                </span>
              </div>
            </div>
          </div>
          {/* Free for buyers */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--sgs-champagne)", border: "1px solid rgba(200,150,62,0.2)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(200,150,62,0.15)" }}>
              <Heart className="w-5 h-5" style={{ color: "var(--sgs-accent-text)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}>
              {lang === "vi" ? "Miễn phí 100%" : "100% Free"}
            </h3>
            <p className="text-sm" style={{ color: "var(--sgs-text-muted)" }}>
              {lang === "vi" ? "với người mua & thuê" : "for buyers & renters"}
            </p>
          </div>
          {/* Bank loans */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--sgs-surface, #FFFFFF)",
              border: "1px solid rgba(27,58,92,0.09)",
              boxShadow: "0 1px 3px rgba(22,32,43,0.06)",
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(27,58,92,0.07)" }}>
              <Landmark className="w-5 h-5" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}>
              {lang === "vi" ? "Vay ưu đãi 12+ NH" : "12+ Bank Partners"}
            </h3>
            <p
              className="text-sm tabular-nums"
              style={{
                color: "var(--sgs-text-muted)",
                fontFamily: "var(--font-ibm-plex-mono, monospace)",
              }}
            >
              LTV 70–80% · 6–8,5%/năm
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 7 — TRUST BLOCK
// ═══════════════════════════════════════════════════════════════
const PARTNERS = ["Novaland", "Masterise Homes", "Nam Long Group", "Vinhomes"];
function TrustBlock({ lang }: { lang: Lang }) {
  return (
    <section className="py-20" style={{ background: "var(--sgs-surface, #FFFFFF)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title={lang === "vi" ? "Đối tác phân phối F1" : "F1 Distribution Partners"}
          subtitle={lang === "vi" ? "Uỷ quyền chính thức từ chủ đầu tư" : "Officially authorized by developers"}
        />
        {/* Partner logos */}
        <div className="flex flex-wrap items-center gap-4 mt-8 mb-12">
          {PARTNERS.map(p => (
            <div
              key={p}
              className="flex items-center justify-center px-6 py-3 rounded-xl transition-all"
              style={{
                background: "var(--sgs-subtle-bg, #F8F9FB)", border: "1px solid rgba(27,58,92,0.1)",
                opacity: 0.72, minWidth: "130px",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.72")}
            >
              <span className="font-bold text-sm" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))", fontFamily: "var(--font-be-vietnam, sans-serif)" }}>
                {p}
              </span>
            </div>
          ))}
        </div>
        {/* Testimonial card */}
        <div
          className="rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start"
          style={{ background: "var(--sgs-subtle-bg, #F8F9FB)", border: "1px solid rgba(27,58,92,0.08)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: "var(--sgs-primary)", color: "#FFFFFF" }}
          >
            NH
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: "var(--sgs-accent)" }} />
                ))}
              </div>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(30,127,92,0.1)", color: "var(--sgs-verified)" }}
              >
                {lang === "vi" ? "Giao dịch đã xác minh" : "Verified Transaction"}
              </span>
            </div>
            <blockquote className="text-sm leading-relaxed mb-3" style={{ color: "var(--sgs-text, var(--sgs-text))" }}>
              {lang === "vi"
                ? '"Mua biệt thự Aqua City qua SGS LAND tháng 6/2026. Đội tư vấn giải thích rõ chính sách thanh toán, hỗ trợ vay ngân hàng MB và kiểm tra pháp lý miễn phí. Quá trình từ đặt cọc đến ký hợp đồng chỉ 5 ngày làm việc."'
                : '"Purchased an Aqua City villa through SGS LAND in July 2026. The advisory team clearly explained payment policies, assisted with MB financing, and handled free legal checks. From deposit to contract signing took just 5 business days."'}
            </blockquote>
            <p className="text-sm font-semibold" style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}>{lang === "vi" ? "Anh Nguyễn Văn Hải" : "Mr. Nguyen Van Hai"}</p>
            <p className="text-xs" style={{ color: "var(--sgs-text-muted)" }}>{lang === "vi" ? "Khách hàng mua Aqua City · TP.HCM, tháng 6/2026" : "Aqua City buyer · HCMC, June 2026"}</p>
          </div>
        </div>
        {/* Micro-trust bar */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8"
          style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
        >
          {[
            { icon: <Award className="w-5 h-5" />,    label: lang === "vi" ? "GPKD số 0312960439 · TP.HCM"  : "Business Reg. 0312960439 · HCMC" },
            { icon: <Building2 className="w-5 h-5" />, label: lang === "vi" ? "Thành lập từ năm 2019"         : "Established since 2019"           },
            { icon: <Clock className="w-5 h-5" />,    label: lang === "vi" ? "Hotline phản hồi < 15 phút"    : "Hotline response < 15 minutes"    },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, var(--sgs-primary))" }}>
                {item.icon}
              </div>
              <span className="text-sm" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 8 — FAQ
// ═══════════════════════════════════════════════════════════════
function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        border: `1.5px solid ${open ? "rgba(200,150,62,0.35)" : "rgba(27,58,92,0.1)"}`,
        background: open ? "rgba(245,234,213,0.25)" : "var(--sgs-surface, #FFFFFF)",
      }}
    >
      <button
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span
          className="font-medium text-sm leading-relaxed"
          style={{ color: "var(--sgs-text, var(--sgs-text))", fontFamily: "var(--font-be-vietnam, sans-serif)" }}
        >
          {q}
        </span>
        <ChevronDown
          className="w-4 h-4 shrink-0 mt-0.5 transition-transform duration-200"
          style={{ color: open ? "var(--sgs-accent)" : "var(--sgs-text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>
      <div style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--sgs-text-muted, #5C6B7A)" }}>
          {a}
        </p>
      </div>
    </div>
  );
}
function FAQSection({ lang }: { lang: Lang }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const half = Math.ceil(FAQ_ITEMS.length / 2);
  return (
    <section className="py-20" style={{ background: "var(--sgs-bg, #FAFAF8)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <SectionHeading
            title={lang === "vi" ? "Câu hỏi thường gặp" : "Frequently Asked Questions"}
            subtitle={lang === "vi"
              ? "Giải đáp thắc mắc về mua bán BĐS cùng SGS LAND"
              : "Answers about buying & selling real estate with SGS LAND"}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {FAQ_ITEMS.slice(0, half).map((item, i) => (
              <FAQItem key={i}
                q={lang === "en" && item.q_en ? item.q_en : item.q}
                a={lang === "en" && item.a_en ? item.a_en : item.a}
                open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
            ))}
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.slice(half).map((item, i) => (
              <FAQItem key={i + half}
                q={lang === "en" && item.q_en ? item.q_en : item.q}
                a={lang === "en" && item.a_en ? item.a_en : item.a}
                open={openIdx === i + half} onToggle={() => setOpenIdx(openIdx === (i + half) ? null : i + half)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════
//  SECTION 9 — CTA BANNER
// ═══════════════════════════════════════════════════════════════
function CTABanner({ lang, onChatOpen }: { lang: Lang; onChatOpen: () => void }) {
  return (
    <section
      className="py-20"
      style={{
        background: "linear-gradient(135deg, var(--sgs-hero-deep) 0%, var(--sgs-primary-deep) 60%, var(--sgs-primary) 100%)",
        borderTop: "1px solid rgba(200,150,62,0.2)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-2xl sm:text-3xl font-semibold mb-3"
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-noto-serif, Georgia, serif)",
            letterSpacing: "-0.01em",
          }}
        >
          {lang === "vi" ? "Nhận tư vấn miễn phí trong 15 phút" : "Get free consultation in 15 minutes"}
        </h2>
        <p className="text-base mb-8" style={{ color: "var(--sgs-on-dark-muted)" }}>
          {lang === "vi"
            ? "Đội chuyên viên SGS LAND sẵn sàng hỗ trợ — định giá, pháp lý, vay vốn, đặt lịch tham quan dự án"
            : "SGS LAND specialists ready to help — valuation, legal, financing, project visits"}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="tel:+84971132378"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center"
            style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#D9A94E")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sgs-accent)")}
          >
            <Phone className="w-4 h-4" />
            Hotline
          </a>
          <button
            onClick={onChatOpen}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center cursor-pointer"
            style={{
              border: "1.5px solid rgba(255,255,255,0.35)",
              color: "#FFFFFF",
              background: "rgba(255,255,255,0.06)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <Bot className="w-4 h-4" />
            {lang === "vi" ? "Hỏi AI ngay" : "Ask AI now"}
          </button>
        </div>
      </div>
    </section>
  );
}
function PublicHeader() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [theme, setTheme]         = useState<Theme>("light");
  const [lang, setLang]           = useState<Lang>("vi");
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("sgs-theme") as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      const savedLang = localStorage.getItem("sgs-lang") as Lang | null;
      if (savedLang === "vi" || savedLang === "en") setLang(savedLang);
    } catch {}
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.classList.toggle("light", theme === "light");
    try { localStorage.setItem("sgs-theme", theme); } catch {}
  }, [theme]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const toggleLang = () => {
    const next: Lang = lang === "vi" ? "en" : "vi";
    setLang(next);
    try { localStorage.setItem("sgs-lang", next); } catch {}
    window.dispatchEvent(new CustomEvent("sgs-lang-change", { detail: next }));
  };
  const navLinks = [
    { href: "/du-an",                vi: "Dự Án",        en: "Projects"     },
    { href: "/ai-valuation",         vi: "Định Giá AI",  en: "AI Valuation" },
    { href: "/marketplace?type=ban", vi: "Mua",          en: "Buy"          },
    { href: "/marketplace?type=thue",vi: "Thuê",         en: "Rent"         },
    { href: "/news",                 vi: "Tin Tức",      en: "News"         },
    { href: "/contact",              vi: "Liên Hệ",      en: "Contact"      },
  ];
  const isHero = !scrolled;
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:      isHero ? "transparent" : theme === "dark" ? "rgba(9,21,35,0.95)" : "rgba(255,255,255,0.93)",
        backdropFilter:  isHero ? "none"        : "blur(14px)",
        WebkitBackdropFilter: isHero ? "none"   : "blur(14px)",
        borderBottom:    isHero ? "none"        : theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(27,58,92,0.12)",
        boxShadow:       isHero ? "none"        : "0 1px 20px rgba(15,39,64,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "64px" }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/logo-white.png"
              alt="SGS Land"
              className="w-9 h-9 transition-transform group-hover:scale-105"
              style={{ objectFit: "contain" }}
            />
            <div>
              <div
                className="font-bold text-lg leading-tight"
                style={{
                  color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "var(--sgs-primary)",
                  fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                SGS <span style={{ color: "var(--sgs-accent)" }}>LAND</span>
              </div>
              <div
                className="text-[9px] font-semibold uppercase hidden sm:block"
                style={{
                  color: isHero ? "rgba(200,150,62,0.85)" : theme === "dark" ? "var(--sgs-accent)" : "var(--sgs-accent-text)",
                  letterSpacing: "0.2em",
                }}
              >
                Proptech
              </div>
            </div>
          </a>
          {/* ── Desktop Nav ───────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isHero ? "rgba(255,255,255,0.85)" : theme === "dark" ? "#B0CDE0" : "var(--sgs-primary)",
                  fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isHero ? "rgba(255,255,255,0.1)" : theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(27,58,92,0.06)";
                  el.style.color = isHero ? "#FFFFFF" : theme === "dark" ? "#FFFFFF" : "var(--sgs-primary-deep)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = isHero ? "rgba(255,255,255,0.85)" : theme === "dark" ? "#B0CDE0" : "var(--sgs-primary)";
                }}
              >
                {lang === "vi" ? link.vi : link.en}
              </a>
            ))}
          </nav>
          {/* ── Right Controls ─────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {/* VI/EN Toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "var(--sgs-primary)",
              }}
              aria-label="Chuyển ngôn ngữ VI / EN"
            >
              {lang.toUpperCase()}
            </button>
            {/* Light / Dark Toggle */}
            <button
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : theme === "dark" ? "#E4EDF5" : "var(--sgs-primary)",
              }}
              aria-label="Chuyển chế độ sáng / tối"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            {/* Login — ghost outline */}
            <a
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1.5px solid ${isHero ? "rgba(255,255,255,0.45)" : theme === "dark" ? "rgba(255,255,255,0.3)" : "var(--sgs-primary)"}`,
                color: isHero ? "rgba(255,255,255,0.92)" : theme === "dark" ? "#E4EDF5" : "var(--sgs-primary)",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {lang === "vi" ? "Đăng nhập" : "Sign in"}
            </a>

            {/* CTA — Gold */}
            <a
              href="/ai-valuation"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "var(--sgs-accent)",
                color: "var(--sgs-primary-deep)",
                boxShadow: "0 2px 8px rgba(200,150,62,0.35)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#D9A94E"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--sgs-accent)"}
            >
              {lang === "vi" ? "Định giá miễn phí" : "Free Valuation"}
            </a>
          </div>
          {/* ── Mobile Hamburger ──────────────────────────── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: isHero ? "#FFFFFF" : theme === "dark" ? "#C8D8E8" : "var(--sgs-primary)" }}
            aria-label="Mở menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {/* ── Mobile Menu Drawer ─────────────────────────────── */}
      {menuOpen && (
        <div
          className="lg:hidden"
          style={{
            background: theme === "dark" ? "rgba(9,21,35,0.97)" : "rgba(255,255,255,0.97)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(27,58,92,0.1)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-sgs-bg"
                style={{ color: "var(--sgs-text-heading, var(--sgs-primary))" }}
              >
                {lang === "vi" ? link.vi : link.en}
              </a>
            ))}
            <div
              className="pt-3 flex gap-2"
              style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
            >
              <button
                onClick={toggleLang}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, var(--sgs-primary))" }}
                aria-label="Chuyển ngôn ngữ"
              >
                <Globe className="w-3.5 h-3.5" /> {lang.toUpperCase()}
              </button>
              <button
                onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "rgba(27,58,92,0.07)", color: "var(--sgs-text-heading, var(--sgs-primary))" }}
                aria-label="Chuyển chế độ sáng tối"
              >
                {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {theme === "light" ? (lang === "vi" ? "Tối" : "Dark") : (lang === "vi" ? "Sáng" : "Light")}
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ border: `1.5px solid var(--sgs-text-heading, var(--sgs-primary))`, color: "var(--sgs-text-heading, var(--sgs-primary))" }}
              >
                {lang === "vi" ? "Đăng nhập" : "Sign in"}
              </a>
              <a
                href="/ai-valuation"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
              >
                {lang === "vi" ? "Định Giá AI" : "AI Valuation"}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
const FOOTER_PROJECTS = [
  { label: "Aqua City Novaland",         href: "/du-an/aqua-city"                  },
  { label: "The Global City",            href: "/du-an/the-global-city"            },
  { label: "Izumi City Nam Long",        href: "/du-an/izumi-city"                 },
  { label: "Vinhomes Grand Park",        href: "/du-an/vinhomes-grand-park"        },
  { label: "Vinhomes Cần Giờ",           href: "/du-an/vinhomes-can-gio"           },
  { label: "Masteri Cosmo Central",      href: "/landing/masteri-cosmo-central/"   },
  { label: "Vinhomes Hóc Môn",           href: "/landing/vinhomes-hoc-mon/"        },
  { label: "Diamond Sky Vạn Phúc City",  href: "/du-an/diamond-sky-van-phuc-city"  },
  { label: "Legacy 66",                  href: "/landing/legacy-66/"               },
  { label: "Grand Manhattan Novaland",   href: "/du-an/grand-manhattan-novaland"   },
  { label: "Khu đô thị Thủ Thiêm",       href: "/du-an/thu-thiem"                  },
  { label: "Sơn Kim Land",               href: "/du-an/son-kim-land"               },
];
const FOOTER_SUPPORT = [
  { vi: "Tìm kiếm BĐS",          en: "Property Search",       href: "/marketplace"          },
  { vi: "Định giá AI",            en: "AI Valuation",          href: "/ai-valuation"         },
  { vi: "Lãi suất ngân hàng",     en: "Bank Rates",            href: "/lai-suat-ngan-hang"   },
  { vi: "CRM Bất Động Sản",       en: "Real Estate CRM",       href: "/crm-platform"         },
  { vi: "Live Chat AI",           en: "Live Chat AI",          href: "/livechat"             },
  { vi: "Trung tâm hỗ trợ",       en: "Help Center",           href: "/help-center"          },
  { vi: "Hướng dẫn sử dụng",     en: "User Guide",            href: "/huong-dan-su-dung"    },
  { vi: "Chính sách bảo mật",     en: "Privacy Policy",        href: "/privacy-policy"       },
  { vi: "Điều khoản sử dụng",     en: "Terms of Service",      href: "/terms-of-service"     },
];
const FOOTER_ABOUT = [
  { vi: "Về chúng tôi",       en: "About Us",              href: "/about-us"                 },
  { vi: "Tin tức",             en: "News",                  href: "/news"                     },
  { vi: "Tuyển dụng",          en: "Careers",               href: "/careers"                  },
  { vi: "Liên hệ",             en: "Contact",               href: "/contact"                  },
  { vi: "Chủ đầu tư", en: "Developers", href: "/chu-dau-tu" },
  { vi: "BĐS Thủ Đức",          en: "Thu Duc Properties",    href: "/bat-dong-san-thu-duc"    },
  { vi: "BĐS Long Thành",       en: "Long Thanh Properties", href: "/bat-dong-san-long-thanh" },
  { vi: "BĐS Đồng Nai",         en: "Dong Nai Properties",   href: "/bat-dong-san-dong-nai"   },
  { vi: "BĐS Bình Thạnh",       en: "Binh Thanh Properties", href: "/bat-dong-san-binh-thanh" },
  { vi: "BĐS Quận 7",           en: "District 7 Properties", href: "/bat-dong-san-quan-7"     },
  { vi: "BĐS Long An",          en: "Long An Properties",    href: "/bat-dong-san-long-an"    },
  { vi: "Nhà phố Trung Tâm",    en: "Central Townhouses",    href: "/du-an/nha-pho-trung-tam"       },
  { vi: "Trạng thái hệ thống",  en: "System Status",         href: "/status"                  },
];
const LEGAL_LINKS = [
  { vi: "Chính sách bảo mật", en: "Privacy Policy",  href: "/privacy-policy"  },
  { vi: "Điều khoản",          en: "Terms",           href: "/terms-of-service" },
  { vi: "Cookie",              en: "Cookie",          href: "/cookie-settings"  },
];
const linkHover = (e: React.MouseEvent<HTMLAnchorElement | HTMLElement>, hover: boolean) => {
  (e.currentTarget as HTMLElement).style.color = hover ? "#D4A855" : "#B9C6D4";
};
function PublicFooter({ lang }: { lang: Lang }) {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: "var(--sgs-primary-deep)", borderTop: "1px solid rgba(200,150,62,0.2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">
        {/* ── 4-column grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Col 1 — Brand + contact ────────────────────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/logo-white.png"
                alt="SGS Land"
                className="w-9 h-9 shrink-0"
                style={{ objectFit: "contain" }}
              />
              <div>
                <div
                  className="font-bold text-base leading-tight"
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "var(--font-noto-serif, Georgia, serif)",
                  }}
                >
                  SGS <span style={{ color: "#D4A855" }}>LAND</span>
                </div>
                <div
                  className="text-[9px] font-semibold uppercase"
                  style={{ color: "rgba(200,150,62,0.7)", letterSpacing: "0.2em" }}
                >
                  Proptech
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--sgs-on-dark-muted)" }}>
              {lang === "vi"
                ? "Nền tảng quản lý & phân phối BĐS AI — Đại lý F1 uỷ quyền Novaland, Masterise Homes, Nam Long, Vinhomes. Tin dùng bởi 15.000+ môi giới."
                : "AI-powered real estate management & distribution platform — Authorized F1 agent for Novaland, Masterise Homes, Nam Long, Vinhomes. Trusted by 15,000+ brokers."}
            </p>
            <div className="space-y-2.5">
              <a
                href="tel:+84971132378"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => linkHover(e, false)}
              >
                <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--sgs-accent)" }} />
                0971 132 378
              </a>
              <a
                href="mailto:info@sgsland.vn"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "#B9C6D4" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => linkHover(e, false)}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--sgs-accent)" }} />
                info@sgsland.vn
              </a>
              <div className="flex items-start gap-2.5 text-sm" style={{ color: "#B9C6D4" }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--sgs-accent)" }} />
                TP. Hồ Chí Minh, Việt Nam
              </div>
            </div>
          </div>
          {/* Col 2 — Dự án ──────────────────────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Dự án phân phối" : "Distribution Projects"}
            </h3>
            <ul className="space-y-2.5">
              {FOOTER_PROJECTS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {/* Col 3 — Hỗ trợ & Chính sách ────────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Hỗ trợ & Chính sách" : "Support & Policies"}
            </h3>
            <ul className="space-y-2.5">
              {FOOTER_SUPPORT.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link[lang]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {/* Col 4 — Về SGS LAND + pháp nhân ────────────── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase mb-4"
              style={{ color: "#D4A855", letterSpacing: "0.12em" }}
            >
              {lang === "vi" ? "Về SGS LAND" : "About SGS LAND"}
            </h3>
            <ul className="space-y-2.5 mb-5">
              {FOOTER_ABOUT.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors block"
                    style={{ color: "#B9C6D4" }}
                    onMouseEnter={e => linkHover(e, true)}
                    onMouseLeave={e => linkHover(e, false)}
                  >
                    {link[lang]}
                  </a>
                </li>
              ))}
            </ul>
            <div
              className="space-y-1 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>API: <a href="/developers" style={{ color: "#B9C6D4" }}>developers</a></p>
            </div>
          </div>
        </div>
        {/* ── Bottom bar ────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
          <p className="text-xs" style={{ color: "var(--sgs-on-dark-muted)" }}>
            {lang === "vi"
              ? `© ${year} Công ty TNHH SGS Land. GPKD số: 0312960439 | Đại lý F1: Novaland · Masterise Homes · Nam Long · Vinhomes.`
              : `© ${year} SGS Land Co., Ltd. Business Reg: 0312960439 | F1 Agent: Novaland · Masterise Homes · Nam Long · Vinhomes.`}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs transition-colors"
                style={{ color: "var(--sgs-on-dark-muted)" }}
                onMouseEnter={e => linkHover(e, true)}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--sgs-on-dark-muted)"}
              >
                {link[lang]}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
function Landing({ featuredListings, stats }: Props) {  
  const [lang, setLang] = useState<Lang>("vi");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const isCrm = typeof window !== "undefined" && !!localStorage.getItem("sgs_auth_cached");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sgs-lang") as Lang | null;
      if (saved === "vi" || saved === "en") setLang(saved);
    } catch {}
    const handler = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener("sgs-lang-change", handler);
    return () => window.removeEventListener("sgs-lang-change", handler);
  }, []);
  const handleSearch = (q: string) => {
    setChatQuery(q.trim());
    setChatOpen(true);
  };
  return (
    <div className="flex flex-col overflow-x-hidden">
      <SeoHead
        title="SGS LAND - Nền Tảng BĐS AI Hàng Đầu TP.HCM"
        description="SGS LAND: nền tảng bất động sản AI TP.HCM. Mua bán, cho thuê, định giá thông minh và quản lý BĐS toàn diện."
        canonicalPath="/"
            structuredData={[
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://sgsland.vn/#organization",
                "name": "SGS LAND",
                "url": "https://sgsland.vn",
                "logo": "https://sgsland.vn/logo-navy.png",
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.8",
                  "reviewCount": "127",
                  "bestRating": "5",
                  "worstRating": "1"
                }
              },
              {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "speakable": {
                  "@type": "SpeakableSpecification",
                  "cssSelector": ["h1", "h2", "p:first-of-type"]
                },
                "url": "https://sgsland.vn"
              }
            ]}
        />

      {!isCrm && <PublicHeader />}
      <HeroSection   onSearch={handleSearch} lang={lang} isCrm={isCrm} />
      <StatsBar      lang={lang} />
      <LegalTicker   lang={lang} />
      <ProjectsSection  lang={lang} />
      <HotListingsSection lang={lang} />
        <ValuationSection lang={lang} />
      <BentoSection     lang={lang} />
      <TrustBlock       lang={lang} />
      <FAQSection       lang={lang} />
      <CTABanner        lang={lang} onChatOpen={() => setChatOpen(true)} />
      <PublicFooter     lang={lang} />
      {/* ── Floating AI Chat Button ───────────────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, var(--sgs-primary) 0%, var(--sgs-primary-deep) 100%)",
          color: "#FFFFFF",
          boxShadow: "0 8px 32px rgba(15,39,64,0.45), 0 2px 8px rgba(200,150,62,0.25)",
          display: chatOpen ? "none" : "flex",
        }}
        aria-label="Mở chat AI"
      >
        <Bot className="w-5 h-5" style={{ color: "var(--sgs-accent)" }} />
        <span>{lang === "vi" ? "Chat AI" : "AI Chat"}</span>
        <span
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.7)" }}
        />
      </button>
      {/* ── AI Chat Widget ────────────────────────────────────────── */}
      <AiChatWidget isOpen={chatOpen} onClose={() => setChatOpen(false)} initialQuery={chatQuery} />
    </div>
  );
}
export default Landing;