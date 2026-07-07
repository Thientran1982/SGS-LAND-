// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

type Lang = "vi" | "en";

// ─── Dark-mode CSS vars injected once ──────────────────────────────────────
const STYLE = `
  .lp-wrap { max-width: 1380px; margin: 0 auto; padding: 0 clamp(20px,4vw,60px); }
  .lp-serif { font-family: var(--font-noto-serif, Georgia, serif); }
  .lp-mono  { font-family: var(--font-ibm-plex-mono, monospace); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
  .lp-sans  { font-family: var(--font-be-vietnam, system-ui, sans-serif); }

  /* light / dark token bridge */
  .lp-root {
    --lp-bg:    #F7F4EC; --lp-paper: #FBF9F3; --lp-ink: #152232;
    --lp-muted: #68727F; --lp-soft:  #9AA2AC; --lp-hair: #E2DDD0;
    --lp-line:  #C9C2B0; --lp-navy:  #1B3A5C; --lp-gold: #BE8F14;
    --lp-ok:    #178A52; --lp-shadow: rgba(21,34,50,.14);
    --lp-cardbg:#FBF9F3; --lp-navbg: rgba(247,244,236,.88);
  }
  .dark .lp-root {
    --lp-bg:    #0E1621; --lp-paper: #152232; --lp-ink: #EDEAE0;
    --lp-muted: #93A0B0; --lp-soft:  #6C7887; --lp-hair: #25334A;
    --lp-line:  #31435F; --lp-navy:  #7FA8D4; --lp-gold: #D9B048;
    --lp-ok:    #3FBF7F; --lp-shadow: rgba(0,0,0,.5);
    --lp-cardbg:#16273C; --lp-navbg: rgba(14,22,33,.88);
  }

  /* pin animations */
  @keyframes lp-ring { 0%{transform:scale(.4);opacity:.7} 80%{transform:scale(1.9);opacity:0} 100%{opacity:0} }
  .lp-pin-ring { animation: lp-ring 2.6s ease-out infinite; transform-origin: center; }
  @keyframes lp-dash  { to{stroke-dashoffset:-540} }
  .lp-route { animation: lp-dash 30s linear infinite; }

  /* reveal on scroll */
  .lp-rv { opacity:0; transform:translateY(26px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
  .lp-rv.in { opacity:1; transform:none; }

  /* FAQ */
  .lp-faq-body { overflow:hidden; transition: max-height .35s ease, opacity .35s ease; }
  .lp-faq-body.closed { max-height:0; opacity:0; }
  .lp-faq-body.open   { max-height:600px; opacity:1; }

  /* card tilt */
  .lp-mapcard { transform-style: preserve-3d; transition: transform .25s ease-out, background .3s; will-change: transform; }

  @media (prefers-reduced-motion:reduce) {
    .lp-pin-ring, .lp-route { animation: none !important; }
    .lp-rv { opacity:1; transform:none; }
  }
`;

// ─── FAQ data (15 items, bilingual) ────────────────────────────────────────
const FAQ_ITEMS = [
  { q:"Tại sao nên mua bất động sản qua SGS LAND?", a:"SGS LAND là đại lý F1 uỷ quyền chính thức của Novaland, Masterise Homes, Nam Long, Vạn Phúc và Vinhomes — đảm bảo giá gốc, không phát sinh phí môi giới cho người mua, pháp lý minh bạch 2 lớp độc lập.", q_en:"Why buy real estate through SGS LAND?", a_en:"SGS LAND is the officially authorized F1 agent of Novaland, Masterise Homes, Nam Long, Van Phuc and Vinhomes — guaranteeing original prices, zero broker fees for buyers, and transparent 2-layer independent legal verification." },
  { q:"Công nghệ định giá AI của SGS LAND chính xác bao nhiêu?", a:"Công nghệ SGS-AVM v2.1 sử dụng 9 hệ số định giá chuẩn TĐGVN/IVS, MAPE ±4.8%, dựa trên hơn 2.400 giao dịch công chứng thực tế. Kết quả tức thì, minh bạch từng yếu tố ảnh hưởng.", q_en:"How accurate is SGS LAND's AI valuation technology?", a_en:"SGS-AVM v2.1 uses 9 valuation factors compliant with TĐGVN/IVS standards, MAPE ±4.8%, based on 2,400+ real notarized transactions. Instant results with full transparency on each contributing factor." },
  { q:"Quy trình kiểm tra pháp lý tại SGS LAND như thế nào?", a:"2 lớp độc lập: AI sơ thẩm kiểm tra quy hoạch 1/2000, sổ hồng, tranh chấp tài sản; Chuyên viên pháp lý xác nhận thực địa theo Luật Đất Đai 2024 và Luật Kinh doanh BĐS 2023.", q_en:"How does SGS LAND's legal verification process work?", a_en:"2 independent layers: AI first check covers zoning 1/2000, land title, and dispute records; Legal specialists then perform on-site verification under Land Law 2024 and Real Estate Business Law 2023." },
  { q:"Người mua có phải trả phí dịch vụ không?", a:"Hoàn toàn miễn phí. Định giá AI, tư vấn pháp lý, hỗ trợ vay vốn — tất cả đều không mất phí với người mua và thuê. Người bán và chủ đầu tư chi trả hoa hồng dịch vụ cho SGS LAND.", q_en:"Do buyers pay any service fees?", a_en:"Completely free. AI valuation, legal advice, mortgage support — all at no cost to buyers and renters. Sellers and developers pay the commission to SGS LAND." },
  { q:"SGS LAND hỗ trợ vay ngân hàng như thế nào?", a:"Đối tác với 12+ ngân hàng lớn (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, lãi suất từ 6–8,5%/năm. Đội tư vấn tài chính đồng hành từ hồ sơ đến giải ngân.", q_en:"How does SGS LAND help with bank financing?", a_en:"Partners with 12+ major banks (BIDV, VPBank, Techcombank, Vietcombank, MB Bank…). LTV 70–80%, interest rates from 6–8.5%/year. Our financial advisory team guides you from application to disbursement." },
  { q:"Những dự án nào đang phân phối tại SGS LAND?", a:"Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Cần Giờ, Masteri Cosmo Central, Diamond Sky, Vinhomes Hóc Môn — cập nhật liên tục.", q_en:"Which projects does SGS LAND currently distribute?", a_en:"Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Grand Park, Vinhomes Can Gio, Masteri Cosmo Central, Diamond Sky, Vinhomes Hoc Mon — continuously updated." },
  { q:"Giá nhà phố tại TP.HCM hiện nay là bao nhiêu?", a:"Giá nhà phố tại TP.HCM dao động theo khu vực: Quận 1 và trung tâm 150–400 triệu/m², Thủ Đức 40–80 triệu/m², Bình Thạnh và Phú Nhuận 80–150 triệu/m². Nhà phố liền kề dự án như Aqua City, The Global City giá 5–15 tỷ/căn. Dùng công cụ Định Giá AI miễn phí để tra cứu chính xác.", q_en:"What is the current price of townhouses in HCMC?", a_en:"Townhouse prices in HCMC vary: District 1 150–400M/sqm, Thu Duc 40–80M/sqm, Binh Thanh 80–150M/sqm. Project townhouses like Aqua City, The Global City range 5–15B VND. Use SGS LAND free AI valuation for precise pricing." },
  { q:"Nên mua căn hộ hay nhà phố để đầu tư?", a:"Căn hộ dễ cho thuê, thanh khoản cao, phù hợp đầu tư tài chính; nhà phố có biên độ tăng giá tốt hơn dài hạn. Ngân sách 4–6 tỷ: căn hộ Vinhomes/Masterise phù hợp hơn. Ngân sách 5–15 tỷ: nhà phố liền kề Long Thành, Aqua City có tiềm năng tăng giá 3–5 năm.", q_en:"Should I invest in apartments or townhouses?", a_en:"Apartments offer higher liquidity and easier rental management. Townhouses have better long-term appreciation. 4–6B budget: large project apartments; 5–15B budget: project townhouses near Long Thanh/Aqua City offer 3–5 year appreciation potential." },
  { q:"Vay mua nhà cần chuẩn bị những gì?", a:"(1) Vốn tự có tối thiểu 20–30%; (2) Thu nhập ổn định, xác nhận 6–12 tháng; (3) Lịch sử tín dụng tốt; (4) Hồ sơ BĐS đầy đủ pháp lý (sổ đỏ/hồng, HĐMB công chứng); (5) CMND/CCCD, hộ khẩu, giấy đăng ký kết hôn. SGS LAND hỗ trợ tư vấn miễn phí với 12+ ngân hàng, lãi suất từ 6–8.5%/năm.", q_en:"What do I need to prepare to get a mortgage?", a_en:"You need: 20–30% down payment, stable income proof (6–12 months), good credit history, complete legal documentation, and personal ID. SGS LAND provides free mortgage consultation with 12+ partner banks at 6–8.5%/year." },
  { q:"Sổ hồng và sổ đỏ khác nhau như thế nào?", a:"Sổ hồng cấp cho nhà ở, căn hộ chung cư, nhà phố. Sổ đỏ cấp cho đất trống, đất nông nghiệp. Từ 2009, cả hai được gộp thành giấy chứng nhận thống nhất. Khi mua BĐS: phải có giấy chứng nhận hợp lệ, không tranh chấp, pháp lý rõ ràng. SGS LAND kiểm tra pháp lý 2 lớp miễn phí.", q_en:"What is the difference between Pink Book and Red Book in Vietnam?", a_en:"Pink Book covers residential property; Red Book covers land use rights. Since 2009 they are merged into one unified certificate. SGS LAND provides free 2-layer legal verification for all transactions." },
  { q:"BĐS Long Thành có đáng đầu tư không?", a:"Long Thành là điểm nóng 2026–2030: (1) Sân bay quốc tế Long Thành GĐ1 hoàn thành 2026, 25 triệu hành khách/năm; (2) Hạ tầng cao tốc hoàn thiện; (3) Giá đất 8–25 triệu/m² còn thấp so với tiềm năng; (4) Aqua City, Gem Sky World phát triển mạnh. Lưu ý: kiểm tra pháp lý kỹ với các dự án nhỏ.", q_en:"Is investing in Long Thanh real estate worthwhile?", a_en:"Long Thanh is a top 2026–2030 hotspot driven by the new international airport (Phase 1 completing 2026, 25M passengers/year), strong highway infrastructure, and land prices still 8–25M/sqm with significant upside potential." },
  { q:"Thủ Đức có còn là khu vực đáng đầu tư không?", a:"TP. Thủ Đức vẫn là khu vực hàng đầu: trung tâm đổi mới sáng tạo, Vinhomes Grand Park 280ha đang tạo hệ sinh thái đô thị hoàn chỉnh, metro line 1 và vành đai đang phát triển. Giá căn hộ 35–70 triệu/m², thấp hơn quận trung tâm 50–60%.", q_en:"Is Thu Duc City still a good investment area?", a_en:"Thu Duc City remains HCMC's top investment area with its tech innovation hub, Vinhomes Grand Park 280ha mega-project, Metro Line 1, and apartment prices at 35–70M/sqm — still 50–60% below central districts." },
  { q:"Mua nhà lần đầu cần lưu ý gì?", a:"5 điểm quan trọng: (1) Pháp lý rõ ràng — sổ hồng/đỏ, không tranh chấp, quy hoạch 1/2000; (2) Định giá đúng — dùng AI hoặc so sánh 3–5 BĐS tương đương; (3) Tài chính — đừng vay quá 40% thu nhập hàng tháng; (4) Thanh khoản — chọn khu vực gần tiện ích; (5) Uy tín chủ đầu tư.", q_en:"What should first-time home buyers know?", a_en:"5 key points: verify legal documents (title, no disputes, 1/2000 zoning), get proper AI or comparative valuation, keep mortgage payments under 40% of income, choose high-liquidity areas near amenities, and verify developer track record." },
  { q:"SGS LAND phục vụ khu vực nào?", a:"TP.HCM (22 quận/huyện và TP Thủ Đức), Đồng Nai (Long Thành, Nhơn Trạch, Biên Hòa), Bình Dương (Thuận An, Dĩ An, Thủ Dầu Một), Long An (Cần Giuộc, Bến Lức), và Bà Rịa - Vũng Tàu. Công cụ Định Giá AI phủ sóng hơn 45.000+ giao dịch thực tế trong vùng.", q_en:"Which areas does SGS LAND serve?", a_en:"SGS LAND covers all of Southeast Vietnam: HCMC (22 districts + Thu Duc City), Dong Nai (Long Thanh, Nhon Trach, Bien Hoa), Binh Duong, Long An, and Ba Ria-Vung Tau — covering 45,000+ real transactions in the region." },
  { q:"Làm thế nào để biết giá BĐS trong khu vực đang tăng hay giảm?", a:"(1) Dùng Định Giá AI SGS LAND so sánh lịch sử giá 24 tháng; (2) Theo dõi giao dịch thực tế từ 45.000+ giao dịch công chứng; (3) Xem lãi suất, tín dụng BĐS, chính sách nhà ở; (4) Chú ý hạ tầng mới: cao tốc, metro, khu công nghiệp; (5) Báo cáo thị trường SGS LAND cập nhật hàng quý.", q_en:"How do I know if real estate prices in my area are rising or falling?", a_en:"Monitor trends using SGS LAND's AI valuation with 24-month history, track 45,000+ notarized transactions, monitor macro factors (interest rates, policy), watch new infrastructure developments, and subscribe to SGS LAND quarterly market reports." },
];

// ─── Projects ───────────────────────────────────────────────────────────────
const PROJECTS = [
  { slug:"aqua-city",        no:"№ 01 · Novaland",   name:"Aqua City",              desc:{ vi:"1.000 ha · Biên Hòa · từ 3 tỷ ₫",                  en:"1,000 ha · Bien Hoa · from 3B VND" },  price:{ vi:"Từ 3 tỷ ₫",         en:"From 3B VND" },  loc:{ vi:"Biên Hòa · Golf 18 lỗ, Marina", en:"Bien Hoa · 18-hole Golf, Marina" } },
  { slug:"the-global-city",  no:"№ 02 · Masterise",  name:"The Global City",        desc:{ vi:"117 ha · Thủ Đức · bảng giá T7/2026",               en:"117 ha · Thu Duc · price list Jul/2026" }, price:{ vi:"Bảng giá T7/2026",  en:"Price list Jul/2026" }, loc:{ vi:"Thủ Đức · trung tâm mới quốc tế", en:"Thu Duc · New International CBD" } },
  { slug:"vinhomes-can-gio", no:"№ 03 · Vinhomes",   name:"Vinhomes Cần Giờ",       desc:{ vi:"2.870 ha · siêu đô thị biển · 2026",                en:"2,870 ha · Coastal megacity · 2026" },  price:{ vi:"Mở bán 2026",       en:"Launch 2026" },  loc:{ vi:"Siêu đô thị biển lớn nhất TPHCM", en:"Largest coastal city in HCMC" } },
  { slug:"izumi-city",       no:"№ 04 · Nam Long",   name:"Izumi City",             desc:{ vi:"170 ha · Biên Hòa · chuẩn Nhật Bản",               en:"170 ha · Bien Hoa · Japanese standard" }, price:{ vi:"Giá tốt",           en:"Competitive price" }, loc:{ vi:"Biên Hòa · chuẩn sống Nhật Bản", en:"Bien Hoa · Japanese living standard" } },
  { slug:"masterise-homes",  no:"№ 05 · Masterise",  name:"Grand Marina · Masteri", desc:{ vi:"TPHCM · căn hộ hàng hiệu",                          en:"HCMC · Branded residences" },            price:{ vi:"Tư vấn 1-1",        en:"1-on-1 consultation" }, loc:{ vi:"Trung tâm TPHCM · hàng hiệu", en:"Central HCMC · luxury residences" } },
];

// ─── Map pin positions ───────────────────────────────────────────────────────
const PIN_DATA = [
  { i:0, cx:810, cy:300, label:"Aqua City",   href:"/du-an/aqua-city"       },
  { i:1, cx:590, cy:285, label:"Global City",  href:"/du-an/the-global-city" },
  { i:2, cx:520, cy:545, label:"Cần Giờ",      href:"/du-an/vinhomes-can-gio"},
  { i:3, cx:700, cy:210, label:"Izumi City",   href:"/du-an/izumi-city"      },
  { i:4, cx:452, cy:308, label:"Masterise",    href:"/du-an/masterise-homes" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── MAP SECTION ─────────────────────────────────────────────────────────────
function MapHero({ lang }: { lang: Lang }) {
  const [activePin, setActivePin] = useState<number | null>(null);
  const [cardPos, setCardPos]     = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [query, setQuery]         = useState("");
  const [visible, setVisible]     = useState(false);
  const cardRef   = useRef<HTMLDivElement>(null);
  const mapcardRef= useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  const showCard = useCallback((i: number, cx: number, cy: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const mr = mapcardRef.current?.getBoundingClientRect();
    if (!mr) return;
    const svgW = 1200, svgH = 640;
    const scaleX = mr.width / svgW, scaleY = mr.height / svgH;
    const pxX = cx * scaleX, pxY = cy * scaleY;
    const cw = 290, ch = 250;
    let left = pxX + 18, top = pxY - 10;
    if (left + cw > mr.width - 20) left = pxX - cw - 18;
    if (top + ch > mr.height - 16) top = mr.height - ch - 16;
    if (top < 16) top = 16;
    setCardPos({ left, top });
    setActivePin(i);
  }, []);

  const hideCard = useCallback(() => {
    hideTimer.current = setTimeout(() => setActivePin(null), 260);
  }, []);

  const proj = activePin !== null ? PROJECTS[activePin] : null;
  const pin  = activePin !== null ? PIN_DATA[activePin] : null;
  const imgSrc = proj ? `https://sgsland.vn/og/du-an/${proj.slug}` : "";

  return (
    <section id="ban-do" style={{ padding: "120px 0 0", background: "var(--lp-bg)" }}>
      <div className="lp-wrap">
        {/* Hero head */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", alignItems:"end", gap:"24px", marginBottom:"26px" }}
          className="max-sm:grid-cols-1">
          <h1
            className="lp-serif"
            style={{
              fontSize:"clamp(34px,5.2vw,70px)", fontWeight:550, lineHeight:1.03, letterSpacing:"-.015em",
              color:"var(--lp-ink)",
              opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity .75s ease .1s, transform .75s ease .1s",
            }}
          >
            {lang === "vi"
              ? <>Sàn F1 uy tín · bất động sản<br /><em style={{ color:"var(--lp-navy)", fontStyle:"italic", fontWeight:340 }}>6 tỉnh miền Nam.</em></>
              : <>Trusted F1 agency · real estate<br /><em style={{ color:"var(--lp-navy)", fontStyle:"italic", fontWeight:340 }}>across 6 southern provinces.</em></>
            }
          </h1>
          <p style={{ maxWidth:"320px", fontSize:"14px", color:"var(--lp-muted)", textAlign:"right", opacity: visible ? 1 : 0, transition:"opacity .75s ease .3s" }}
            className="max-sm:text-left">
            {lang === "vi"
              ? "Dự án BĐS TPHCM, Đồng Nai, Bình Dương, BR-VT, Long An, Tây Ninh. Di chuột lên từng điểm ghim để xem giá và pháp lý."
              : "Real estate projects in HCMC, Dong Nai, Binh Duong, BR-VT, Long An, Tay Ninh. Hover each pin for verified pricing and legal status."}
          </p>
        </div>

        {/* Map card */}
        <div style={{ position:"relative", perspective:"1400px" }}>
          <div
            ref={mapcardRef}
            className="lp-mapcard"
            style={{ position:"relative", background:"var(--lp-paper)", border:"1px solid var(--lp-line)", borderRadius:"24px", overflow:"hidden", boxShadow:"0 40px 100px var(--lp-shadow)" }}
          >
            {/* Corner labels */}
            {[
              { cls:"tl", style:{top:26,left:30},   text: lang==="vi" ? "SGS LAND · Bản đồ 6 tỉnh miền Nam 2026" : "SGS LAND · 6-province map, South Vietnam 2026" },
              { cls:"tr", style:{top:26,right:30},  text:"Tỷ lệ 1:250.000 · WGS-84" },
              { cls:"bl", style:{bottom:24,left:30},text:"10°25′–11°00′ N" },
              { cls:"br", style:{bottom:24,right:30},text:"106°30′–107°00′ E" },
            ].map(c => (
              <span key={c.cls} className="lp-mono" style={{ position:"absolute", color:"var(--lp-muted)", zIndex:3, pointerEvents:"none", fontSize:"10px", letterSpacing:".14em", ...c.style }}>
                {c.text}
              </span>
            ))}
            <div style={{ position:"absolute", inset:"14px", border:"1px solid var(--lp-line)", borderRadius:"14px", pointerEvents:"none", zIndex:1 }} />

            {/* SVG map */}
            <svg viewBox="0 0 1200 640" xmlns="http://www.w3.org/2000/svg" style={{ display:"block", width:"100%", height:"auto" }}
              role="img" aria-label={lang==="vi" ? "Bản đồ 5 dự án tại 6 tỉnh miền Nam" : "Map of 5 projects across 6 southern provinces"}>
              <g stroke="var(--lp-hair)" strokeWidth="1" fill="none">
                <path d="M200 0V640M400 0V640M600 0V640M800 0V640M1000 0V640"/>
                <path d="M0 160H1200M0 320H1200M0 480H1200"/>
              </g>
              <path fill="var(--lp-navy)" fillOpacity=".08" d="M0 560 C220 530 420 555 620 585 C820 615 1020 600 1200 570 L1200 640 L0 640 Z"/>
              <path stroke="var(--lp-line)" strokeWidth="1.6" fill="none" d="M0 560 C220 530 420 555 620 585 C820 615 1020 600 1200 570"/>
              <path stroke="var(--lp-line)" strokeWidth="7" strokeLinecap="round" fill="none" d="M340 0 C360 90 300 150 350 220 C400 290 480 300 470 380 C460 450 380 470 400 545" opacity=".85"/>
              <path stroke="var(--lp-line)" strokeWidth="6" strokeLinecap="round" fill="none" d="M980 0 C940 80 850 110 800 180 C750 250 640 260 560 320 C500 365 480 410 470 380" opacity=".85"/>
              <g stroke="var(--lp-hair)" fill="none" strokeWidth="1">
                <ellipse cx="180" cy="150" rx="90" ry="46"/><ellipse cx="180" cy="150" rx="60" ry="28"/>
                <ellipse cx="1050" cy="360" rx="100" ry="50"/><ellipse cx="1050" cy="360" rx="66" ry="30"/>
              </g>
              <g fill="none" stroke="var(--lp-navy)" strokeWidth="1" strokeDasharray="4 5" opacity=".35">
                <path className="lp-route" d="M430 330 C520 300 620 260 700 210"/>
                <path className="lp-route" d="M430 330 C560 320 700 330 810 300"/>
                <path className="lp-route" d="M430 330 C440 400 470 480 520 545"/>
                <path className="lp-route" d="M430 330 C480 310 540 300 590 285"/>
              </g>
              <g fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="10" letterSpacing="2">
                <text fill="var(--lp-soft)" x="150" y="90">TÂY NINH</text>
                <text fill="var(--lp-soft)" x="120" y="430">LONG AN</text>
                <text fill="var(--lp-soft)" x="960" y="520">BR-VT</text>
                <text fill="var(--lp-soft)" x="620" y="120">BÌNH DƯƠNG</text>
                <text fill="var(--lp-soft)" x="880" y="230">ĐỒNG NAI</text>
              </g>
              <g>
                <circle fill="var(--lp-ink)" cx="430" cy="330" r="5"/>
                <text x="430" y="356" textAnchor="middle" fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="10" letterSpacing="2" fill="var(--lp-soft)">TPHCM</text>
              </g>
              {PIN_DATA.map((p) => (
                <g key={p.i} style={{ cursor:"pointer" }}
                  onMouseEnter={() => showCard(p.i, p.cx, p.cy)}
                  onMouseLeave={hideCard}
                  onFocus={() => showCard(p.i, p.cx, p.cy)}
                  onBlur={hideCard}
                  onClick={() => { location.href = p.href; }}
                  tabIndex={0} role="button" aria-label={p.label}>
                  <circle className="lp-pin-ring" cx={p.cx} cy={p.cy} r="14" fill="none"
                    stroke="var(--lp-navy)" strokeWidth="1.4" opacity=".55"
                    style={{ animationDelay:`${p.i * 0.5}s` }} />
                  <circle cx={p.cx} cy={p.cy} r="7"
                    fill={activePin === p.i ? "var(--lp-gold)" : "var(--lp-navy)"}
                    stroke="var(--lp-paper)" strokeWidth="2.5"
                    style={{ transition:"fill .2s" }} />
                  <text x={p.cx} y={p.cy - 18} textAnchor="middle"
                    fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="9.5" letterSpacing=".1em"
                    style={{ textTransform:"uppercase" }}
                    fill="var(--lp-muted)">{p.label}</text>
                </g>
              ))}
              <g transform="translate(1105,90)" fill="none">
                <circle r="26" stroke="var(--lp-soft)"/>
                <circle r="3" fill="var(--lp-ink)"/>
                <path fill="var(--lp-ink)" fillOpacity=".85" d="M0 -26 L5 0 L0 26 L-5 0 Z"/>
                <text y="-34" textAnchor="middle" fontFamily="var(--font-ibm-plex-mono,monospace)" fontSize="10" fill="var(--lp-muted)">N</text>
              </g>
            </svg>

            {/* Legend */}
            <div style={{ position:"absolute", left:30, bottom:52, zIndex:3, background:"var(--lp-navbg)", backdropFilter:"blur(6px)", border:"1px solid var(--lp-line)", borderRadius:"12px", padding:"12px 16px", fontSize:"11.5px", color:"var(--lp-muted)", display:"flex", flexDirection:"column", gap:"6px" }}
              className="max-sm:hidden">
              <b className="lp-mono" style={{ color:"var(--lp-ink)", fontSize:"11px" }}>{lang==="vi" ? "Chú giải" : "Legend"}</b>
              <span style={{ display:"flex", alignItems:"center", gap:"8px" }}><i style={{ width:9,height:9,borderRadius:"50%",background:"var(--lp-navy)",flexShrink:0,display:"inline-block" }}/>{lang==="vi" ? "Dự án pháp lý 2 lớp" : "Two-layer legal verified"}</span>
              <span style={{ display:"flex", alignItems:"center", gap:"8px" }}><i style={{ width:9,height:9,borderRadius:"50%",background:"var(--lp-gold)",flexShrink:0,display:"inline-block" }}/>{lang==="vi" ? "Đang xem" : "Viewing"}</span>
            </div>

            {/* Floating project card */}
            {activePin !== null && proj && pin && (
              <div
                ref={cardRef}
                style={{
                  position:"absolute", zIndex:10, width:"290px",
                  background:"var(--lp-cardbg)", border:"1px solid var(--lp-line)",
                  borderRadius:"16px", overflow:"hidden",
                  boxShadow:"0 26px 60px var(--lp-shadow)",
                  left:cardPos.left, top:cardPos.top,
                  pointerEvents:"auto",
                  transition:"opacity .2s,transform .2s",
                }}
                onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
                onMouseLeave={hideCard}
              >
                <img src={imgSrc} alt={proj.name} loading="lazy"
                  style={{ aspectRatio:"16/9", objectFit:"cover", width:"100%", display:"block" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                <div style={{ padding:"14px 18px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                    <span className="lp-mono" style={{ fontSize:"10px", color:"var(--lp-muted)" }}>{proj.no}</span>
                    <span style={{ color:"var(--lp-ok)", fontSize:"10px" }}>✓</span>
                  </div>
                  <h3 className="lp-serif" style={{ fontSize:"19px", fontWeight:550, color:"var(--lp-ink)", lineHeight:1.1 }}>{proj.name}</h3>
                  <p style={{ fontSize:"12.5px", color:"var(--lp-muted)", marginTop:"2px" }}>{proj.loc[lang]}</p>
                  <div style={{ fontSize:"13px", fontWeight:600, color:"var(--lp-navy)", marginTop:"8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>{proj.price[lang]}</span>
                    <em className="lp-serif" style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-gold)", fontSize:"12px" }}>{lang==="vi" ? "Xem dự án →" : "View project →"}</em>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Search bar */}
        <div style={{ display:"flex", justifyContent:"center", marginTop:"-30px", position:"relative", zIndex:20, padding:"0 20px" }}>
          <form
            style={{ background:"var(--lp-ink)", color:"var(--lp-bg)", borderRadius:"999px", boxShadow:"0 24px 60px var(--lp-shadow)", display:"flex", alignItems:"center", gap:"12px", padding:"10px 10px 10px 24px", width:"min(640px,100%)" }}
            onSubmit={e => { e.preventDefault(); location.href = `/marketplace?q=${encodeURIComponent(query)}`; }}
          >
            <span className="lp-mono" style={{ color:"var(--lp-gold)", fontSize:"14px" }}>⌘</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              type="search"
              placeholder={lang==="vi" ? "Nhà phố Thủ Đức dưới 8 tỷ, pháp lý sạch…" : "Townhouse Thu Duc under 8B VND, clean title…"}
              style={{ flex:1, border:"none", outline:"none", background:"none", color:"var(--lp-bg)", fontFamily:"var(--font-be-vietnam,sans-serif)", fontSize:"15px", minWidth:0 }}
              aria-label={lang==="vi" ? "Hỏi AI về bất động sản" : "Ask AI about real estate"}
            />
            <button type="submit" style={{ background:"var(--lp-bg)", color:"var(--lp-ink)", borderRadius:"999px", padding:"11px 20px", fontSize:"13.5px", fontWeight:600, whiteSpace:"nowrap", cursor:"pointer", border:"none", transition:"opacity .2s" }}>
              {lang==="vi" ? "Hỏi AI →" : "Ask AI →"}
            </button>
          </form>
        </div>

        {/* Stats */}
        <div style={{ display:"flex", justifyContent:"center", gap:0, padding:"56px 0 0", flexWrap:"wrap" }}>
          {[
            { num:"45.000+", vi:"sản phẩm realtime",    en:"listings in realtime"     },
            { num:"±4.8%",   vi:"sai số định giá AI",   en:"AI valuation error"       },
            { num:"24h",     vi:"xác minh thực địa",    en:"on-site verification"     },
            { num:"$1B+",    vi:"giao dịch xử lý",      en:"transactions processed"   },
          ].map((s,i) => (
            <div key={i} style={{ padding:"0 34px", borderLeft: i===0 ? "none" : "1px solid var(--lp-hair)", textAlign:"center" }}>
              <b className="lp-serif" style={{ fontSize:"clamp(24px,2.6vw,36px)", fontWeight:550, display:"block", lineHeight:1.15, color:"var(--lp-ink)" }}>{s.num}</b>
              <span style={{ fontSize:"12px", color:"var(--lp-muted)" }}>{s[lang]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function ChapterHead({ no, title, side }: { no: string; title: React.ReactNode; side: string }) {
  const { ref, inView } = useReveal();
  return (
    <div ref={ref as any} className={`lp-rv${inView ? " in" : ""}`}
      style={{ display:"flex", alignItems:"baseline", gap:"22px", marginBottom:"60px", borderTop:"1px solid var(--lp-hair)", paddingTop:"22px", flexWrap:"wrap" }}>
      <span className="lp-mono" style={{ color:"var(--lp-gold)", whiteSpace:"nowrap" }}>{no}</span>
      <h2 className="lp-serif" style={{ fontSize:"clamp(32px,4.8vw,60px)", fontWeight:550, lineHeight:1.03, letterSpacing:"-.015em", color:"var(--lp-ink)" }}>
        {title}
      </h2>
      <span style={{ marginLeft:"auto", maxWidth:"300px", fontSize:"13.5px", color:"var(--lp-muted)", alignSelf:"flex-end" }}>{side}</span>
    </div>
  );
}

// ─── PROJECT CARD (isolated component so hooks aren't called in .map) ────────
function ProjectCard({ p, lang }: { p: typeof PROJECTS[number]; lang: Lang }) {
  const { ref, inView } = useReveal();
  return (
    <a
      ref={ref as any}
      href={`/du-an/${p.slug}`}
      className={`lp-rv${inView ? " in" : ""}`}
      style={{ position:"relative", borderRadius:"20px", overflow:"hidden", border:"1px solid var(--lp-line)", background:"var(--lp-cardbg)", display:"block", textDecoration:"none", transition:"transform .25s,box-shadow .3s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow="0 24px 60px var(--lp-shadow)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=""; (e.currentTarget as HTMLElement).style.boxShadow=""; }}
    >
      <img
        src={`https://sgsland.vn/og/du-an/${p.slug}`}
        alt={p.name}
        loading="lazy"
        style={{ aspectRatio:"4/3", objectFit:"cover", width:"100%", display:"block" }}
        onError={e => { const el = e.currentTarget as HTMLImageElement; el.style.background="var(--lp-hair)"; el.style.minHeight="200px"; }}
      />
      <div style={{ padding:"18px 20px 22px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
          <span className="lp-mono" style={{ fontSize:"10px", color:"var(--lp-muted)" }}>{p.no}</span>
          <span style={{ color:"var(--lp-ok)", fontSize:"10px", fontFamily:"var(--font-ibm-plex-mono,monospace)", letterSpacing:".1em" }}>✓ {lang==="vi" ? "2 lớp" : "2-layer"}</span>
        </div>
        <h3 className="lp-serif" style={{ fontSize:"21px", fontWeight:550, color:"var(--lp-ink)", lineHeight:1.1 }}>{p.name}</h3>
        <p style={{ fontSize:"13px", color:"var(--lp-muted)", marginTop:"4px" }}>{p.desc[lang]}</p>
      </div>
    </a>
  );
}

// ─── METHOD CARD ─────────────────────────────────────────────────────────────
function MethodCard({ m, lang }: { m: { n: string; ti: { vi: string; en: string }; tx: { vi: React.ReactNode; en: React.ReactNode } }; lang: Lang }) {
  const { ref, inView } = useReveal();
  return (
    <div ref={ref as any} className={`lp-rv${inView ? " in" : ""}`}>
      <span className="lp-serif" style={{ fontStyle:"italic", fontWeight:340, fontSize:"44px", lineHeight:1, color:"var(--lp-gold)", display:"block", marginBottom:"14px" }}>{m.n}</span>
      <h3 className="lp-serif" style={{ fontSize:"18px", fontWeight:550, color:"var(--lp-ink)", marginBottom:"8px" }}>{m.ti[lang]}</h3>
      <p style={{ fontSize:"13.5px", color:"var(--lp-muted)", lineHeight:1.6 }}>{m.tx[lang]}</p>
    </div>
  );
}

// ─── PROJECTS SECTION ────────────────────────────────────────────────────────
function ProjectsSection({ lang }: { lang: Lang }) {
  return (
    <section id="du-an" style={{ padding:"120px 0", background:"var(--lp-bg)" }}>
      <div className="lp-wrap">
        <ChapterHead
          no={lang==="vi" ? "Chương 01" : "Chapter 01"}
          title={lang==="vi" ? <>Cầm dự án <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>trên tay</em></> : <>Hold each project <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>in hand</em></>}
          side={lang==="vi" ? "Ảnh thật, giá gốc chủ đầu tư, pháp lý đã kiểm định 2 lớp." : "Real photos, developer prices, two-layer legal verification."}
        />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"26px" }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.slug} p={p} lang={lang} />
          ))}
          {/* +45k card */}
          <a href="/marketplace"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", background:"var(--lp-ink)", borderRadius:"20px", border:"1px solid var(--lp-line)", textDecoration:"none", minHeight:"280px", transition:"opacity .2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.88"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="1"; }}
          >
            <div style={{ padding:"40px 24px" }}>
              <h3 className="lp-serif" style={{ color:"var(--lp-gold)", fontSize:"24px", fontWeight:550 }}>+45.000 {lang==="vi" ? "sản phẩm" : "listings"}</h3>
              <p style={{ opacity:.7, fontSize:"13.5px", marginTop:"6px", color:"var(--lp-bg)" }}>
                {lang==="vi" ? "Nhà phố · Căn hộ · Đất nền · Cho thuê" : "Townhouses · Apartments · Land · Rentals"}<br/>→ Marketplace
              </p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── METHOD SECTION ──────────────────────────────────────────────────────────
function MethodSection({ lang }: { lang: Lang }) {
  const methods = [
    { n:"i.",   ti:{ vi:"Định giá minh bạch",          en:"Transparent valuation"    }, tx:{ vi:<><b>9 hệ số chuẩn TĐGVN/IVS</b>, huấn luyện trên 2.400+ giao dịch công chứng. 30 giây, sai số ±4.8%.</>, en:<><b>9 factors per TĐGVN/IVS</b>, trained on 2,400+ notarised transactions. 30 seconds, ±4.8% error.</> } },
    { n:"ii.",  ti:{ vi:"Pháp lý hai lớp",              en:"Two-layer legal check"    }, tx:{ vi:<>AI quét quy hoạch, sổ hồng, tranh chấp tức thì. Chuyên viên thực địa trong <b>24 giờ</b>, trước khi bạn cọc.</>, en:<>AI scans zoning, land titles and disputes instantly. Field specialists verify within <b>24 hours</b>, before you deposit.</> } },
    { n:"iii.", ti:{ vi:"Đúng giá chủ đầu tư",          en:"Developer prices"         }, tx:{ vi:<>Đại lý F1: <b>giá gốc công bố</b>, không chênh lệch, không phí dịch vụ với người mua.</>, en:<>F1 agency: <b>official listed prices</b>, no markup, no service fees for buyers.</> } },
    { n:"iv.",  ti:{ vi:"Một hồ sơ, 12+ ngân hàng",     en:"One file, 12+ banks"      }, tx:{ vi:<>Lãi từ <b>6-8,5%/năm</b>, LTV tới 80%: BIDV, Techcombank, VPBank… đồng hành đến giải ngân.</>, en:<>Rates from <b>6-8.5%/yr</b>, LTV up to 80%: BIDV, Techcombank, VPBank… with you until disbursement.</> } },
  ];
  return (
    <section style={{ padding:"120px 0", background:"var(--lp-paper)", borderTop:"1px solid var(--lp-hair)", borderBottom:"1px solid var(--lp-hair)" }}>
      <div className="lp-wrap">
        <ChapterHead
          no={lang==="vi" ? "Chương 02" : "Chapter 02"}
          title={lang==="vi" ? <>Bốn lớp <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>bảo chứng</em></> : <>Four layers of <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>assurance</em></>}
          side={lang==="vi" ? "Miễn phí hoàn toàn với người mua và người thuê." : "Completely free for buyers and renters."}
        />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"clamp(20px,3vw,44px)" }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
          {methods.map((m, i) => (
            <MethodCard key={i} m={m} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ SECTION ──────────────────────────────────────────────────────────────
function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderBottom:"1px solid var(--lp-hair)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width:"100%", padding:"22px 4px", background:"none", border:"none", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"16px", textAlign:"left" }}
        aria-expanded={open}
      >
        <span className="lp-serif" style={{ fontWeight:550, fontSize:"19px", color:"var(--lp-ink)", lineHeight:1.25 }}>{q}</span>
        <span className="lp-serif" style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-gold)", fontSize:"24px", flexShrink:0 }}>{open ? "–" : "+"}</span>
      </button>
      <div className={`lp-faq-body ${open ? "open" : "closed"}`}>
        <p style={{ margin:"0 0 20px", color:"var(--lp-muted)", fontSize:"14.5px", maxWidth:"64ch", lineHeight:1.7, paddingLeft:"4px" }}>{a}</p>
      </div>
    </div>
  );
}

function FaqSection({ lang }: { lang: Lang }) {
  const { ref, inView } = useReveal();
  return (
    <section id="faq" style={{ padding:"120px 0", background:"var(--lp-bg)" }}>
      <div className="lp-wrap">
        <ChapterHead
          no={lang==="vi" ? "Chương 03" : "Chapter 03"}
          title={lang==="vi" ? <>Câu hỏi <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>thường gặp</em></> : <>Frequently asked <em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>questions</em></>}
          side={lang==="vi" ? "Giải đáp trước khi bạn quyết định." : "Answers before you decide."}
        />
        <div ref={ref as any} className={`lp-rv${inView ? " in" : ""}`} style={{ maxWidth:"820px", margin:"0 auto" }}>
          {FAQ_ITEMS.map((f, i) => (
            <FaqItem key={i} q={lang==="vi" ? f.q : f.q_en} a={lang==="vi" ? f.a : f.a_en} defaultOpen={i===0} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA SECTION ─────────────────────────────────────────────────────────────
function CtaSection({ lang }: { lang: Lang }) {
  const { ref, inView } = useReveal();
  return (
    <section style={{ padding:"120px 0", background:"var(--lp-bg)", textAlign:"center" }}>
      <div className="lp-wrap">
        <div ref={ref as any} className={`lp-rv${inView ? " in" : ""}`}>
          <span className="lp-mono" style={{ color:"var(--lp-muted)" }}>{lang==="vi" ? "Miễn phí · Không cần đăng ký · 30 giây" : "Free · No sign-up · 30 seconds"}</span>
          <h2 className="lp-serif" style={{ fontSize:"clamp(36px,6vw,84px)", fontWeight:550, lineHeight:1.03, letterSpacing:"-.015em", marginTop:"18px", color:"var(--lp-ink)" }}>
            {lang==="vi"
              ? <>Bắt đầu bằng<br /><em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>giá thật.</em></>
              : <>Start with the<br /><em style={{ fontStyle:"italic", fontWeight:340, color:"var(--lp-navy)" }}>real price.</em></>}
          </h2>
          <p style={{ color:"var(--lp-muted)", margin:"22px auto 42px", maxWidth:"430px", fontSize:"15px" }}>
            {lang==="vi"
              ? "Định giá AI ngay, hoặc trò chuyện với chuyên gia: phản hồi trong 15 phút, bảy ngày mỗi tuần."
              : "Get an AI valuation now, or talk to a specialist: reply within 15 minutes, seven days a week."}
          </p>
          <div style={{ display:"flex", gap:"14px", justifyContent:"center", flexWrap:"wrap" }}>
            <a href="/ai-valuation"
              style={{ display:"inline-flex", alignItems:"center", gap:"10px", padding:"17px 36px", borderRadius:"999px", fontWeight:500, fontSize:"15px", background:"var(--lp-ink)", color:"var(--lp-bg)", textDecoration:"none", transition:"all .25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--lp-navy)"; (e.currentTarget as HTMLElement).style.transform="translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="var(--lp-ink)"; (e.currentTarget as HTMLElement).style.transform=""; }}
            >
              {lang==="vi" ? "Định giá AI miễn phí" : "Free AI valuation"}
            </a>
            <a href="tel:+84971132378"
              style={{ display:"inline-flex", alignItems:"center", gap:"10px", padding:"17px 36px", borderRadius:"999px", fontWeight:500, fontSize:"15px", border:"1px solid var(--lp-ink)", color:"var(--lp-ink)", textDecoration:"none", transition:"all .25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--lp-ink)"; (e.currentTarget as HTMLElement).style.color="var(--lp-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color="var(--lp-ink)"; }}
            >
              {lang==="vi" ? "Gọi 0971 132 378" : "Call +84 971 132 378"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ROOT COMPONENT ──────────────────────────────────────────────────────────
interface Props {
  featuredListings?: any[];
  stats?: { totalListings: number; totalProjects: number; totalBrokers: number };
}

export function LandingPage({ featuredListings = [], stats }: Props) {
  const [lang, setLang] = useState<Lang>("vi");

  // Sync with PublicHeader lang
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sgs-lang") as Lang | null;
      if (saved === "vi" || saved === "en") setLang(saved);
    } catch {}
    const handler = (e: CustomEvent) => {
      if (e.detail === "vi" || e.detail === "en") setLang(e.detail as Lang);
    };
    window.addEventListener("sgs-lang-change", handler as EventListener);
    return () => window.removeEventListener("sgs-lang-change", handler as EventListener);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="lp-root lp-sans" style={{ background:"var(--lp-bg)", color:"var(--lp-ink)", minHeight:"100vh" }}>
        <MapHero lang={lang} />
        <ProjectsSection lang={lang} />
        <MethodSection lang={lang} />
        <FaqSection lang={lang} />
        <CtaSection lang={lang} />
      </div>
    </>
  );
}

export default LandingPage;
