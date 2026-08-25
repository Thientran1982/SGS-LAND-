// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { getLang, langAlternates } from "@/lib/lang";

function expertSlug(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d").replace(/\u0110/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-");
}

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const url = en ? "https://sgsland.vn/en/chuyen-gia" : "https://sgsland.vn/chuyen-gia";
  return {
    title: en
      ? "Real Estate Experts | The SGS LAND Advisory Team"
      : "Chuyên Gia Bất Động Sản | Đội Ngũ Tư Vấn SGS LAND",
    description: en
      ? "SGS LAND's 50+ property experts: 10+ years distributing Vinhomes, Novaland and Masterise. Investment advice, ±5% AI AVM valuation, Vietnamese real estate law."
      : "Đội ngũ 50+ chuyên gia BĐS SGS LAND: 10+ năm kinh nghiệm phân phối Vinhomes, Novaland, Masterise. Tư vấn đầu tư, định giá AI AVM ±5%, pháp lý BĐS Việt Nam.",
    alternates: { canonical: url, ...langAlternates("/chuyen-gia") },
    openGraph: {
      title: en
        ? "Real Estate Experts | The SGS LAND Advisory Team"
        : "Chuyên Gia Bất Động Sản | Đội Ngũ Tư Vấn SGS LAND",
      description: en
        ? "50+ property consultants licensed by Vietnam's Ministry of Construction. Tier-1 agent for Vinhomes, Novaland and Masterise Homes. Free AI valuation and independent legal advice."
        : "50+ chuyên gia BĐS có chứng chỉ hành nghề Bộ Xây Dựng. Đại lý F1 Vinhomes, Novaland, Masterise Homes. Định giá AI miễn phí, tư vấn pháp lý độc lập.",
      url,
    },
  };
}

export const dynamic = "force-dynamic";

const EXPERTS = (en: boolean) => [
  {
    name: "Trần Minh Thiện",
    title: en ? "CEO & Founder — Primary distribution specialist" : "CEO & Founder — Chuyên gia phân phối sơ cấp",
    exp: en ? "10+ years" : "10+ năm",
    spec: "Vinhomes, Novaland, Aqua City",
    desc: en ? "Authorised tier-1 agent for Novaland (2017), Vinhomes (2019) and Masterise Homes (2021). Specialises in long-term investment analysis and luxury property advice in Ho Chi Minh City." : "Đại lý F1 ủy quyền Novaland (2017), Vinhomes (2019), Masterise Homes (2021). Chuyên phân tích đầu tư dài hạn và tư vấn BĐS hạng sang TP.HCM.",
  },
  {
    name: "Nguyễn Hoàng Nam",
    title: en ? "CTO — AI valuation (AVM) specialist" : "CTO — Chuyên gia định giá AI (AVM)",
    exp: en ? "10+ years" : "10+ năm",
    spec: en ? "AI valuation, PropTech, CRM" : "Định giá AI, PropTech, CRM",
    desc: en ? "Architect of the AVM valuation engine, accurate to ±5% across 45,000+ real transactions. Specialises in big-data market analysis." : "Kiến trúc sư hệ thống AVM định giá BĐS với sai số ±5% trên 45.000+ giao dịch thực. Chuyên phân tích thị trường dữ liệu lớn.",
  },
  {
    name: "Lê Thị Hoa",
    title: en ? "COO — Legal & operations specialist" : "COO — Chuyên gia pháp lý & vận hành",
    exp: en ? "15+ years" : "15+ năm",
    spec: en ? "Property law, Ministry of Construction brokerage" : "Pháp lý BĐS, Môi giới Bộ Xây Dựng",
    desc: en ? "Licensed real estate broker (Ministry of Construction). Designed the two-layer legal due-diligence process (AI + specialist review) and runs the nationwide network of 15,000+ brokers." : "Chứng chỉ môi giới BĐS Bộ Xây Dựng. Thiết kế quy trình kiểm tra pháp lý 2 lớp (AI + chuyên viên). Quản lý mạng lưới 15.000+ môi giới toàn quốc.",
  },
  {
    name: "Nguyễn Thị Lan",
    title: en ? "Head of Advisory — South-East region" : "Trưởng Phòng Tư Vấn — BĐS Đông Nam Bộ",
    exp: en ? "8+ years" : "8+ năm",
    spec: "Aqua City, Izumi City, Đồng Nai",
    desc: en ? "Deep expertise in the Dong Nai, Long An and Binh Duong markets. Advises on industrial-park investment and suburban eco-township projects." : "Chuyên sâu thị trường BĐS Đồng Nai, Long An, Bình Dương. Tư vấn đầu tư khu công nghiệp và dự án sinh thái ven đô.",
  },
  {
    name: "Phạm Văn Đức",
    title: en ? "Senior Consultant — HCMC luxury property" : "Senior Tư Vấn — BĐS Cao Cấp TP.HCM",
    exp: en ? "7+ years" : "7+ năm",
    spec: en ? "Thu Duc, Binh Thanh, District 1" : "Thủ Đức, Bình Thạnh, Quận 1",
    desc: en ? "Distributes high-end Thu Duc apartments: The Global City, Vinhomes Grand Park, Masteri Thao Dien. Supports mortgage applications and e-signed contracts." : "Chuyên phân phối căn hộ cao cấp Thủ Đức: The Global City, Vinhomes Grand Park, Masteri Thảo Điền. Hỗ trợ vay ngân hàng và ký hợp đồng điện tử.",
  },
  {
    name: "Trần Thị Thu",
    title: en ? "Senior Consultant — Coastal & resort property" : "Senior Tư Vấn — BĐS Ven Biển & Nghỉ Dưỡng",
    exp: en ? "6+ years" : "6+ năm",
    spec: "Vinhomes Cần Giờ, NovaWorld Phan Thiết",
    desc: en ? "Advises on coastal resort property: rental yields, resort pink-book legal status and 5–10 year capital growth potential." : "Chuyên tư vấn BĐS nghỉ dưỡng ven biển: yield cho thuê, pháp lý sổ hồng resort, tiềm năng tăng giá 5-10 năm.",
  },
];

const STATS = (en: boolean) => [
  { value: "50+", label: en ? "Licensed property experts" : "Chuyên gia có chứng chỉ hành nghề" },
  { value: en ? "45,000+" : "45.000+", label: en ? "Transactions successfully advised" : "Giao dịch được tư vấn thành công" },
  { value: "±5%", label: en ? "AI AVM valuation accuracy" : "Độ chính xác định giá AI AVM" },
  { value: en ? "2 hours" : "2 giờ", label: en ? "Advisory response time" : "Thời gian phản hồi tư vấn" },
];

const FAQ = (en: boolean) => [
  {
    q: en ? "Which projects have SGS LAND experts distributed?" : "Chuyên gia SGS LAND có kinh nghiệm phân phối dự án nào?",
    a: en
      ? "The SGS LAND team is an officially authorised tier-1 agent for Vinhomes (since 2019), Novaland (since 2017), Masterise Homes (since 2021) and Nam Long Group (since 2020), distributing across Ho Chi Minh City, Dong Nai and Binh Duong."
      : "Đội ngũ SGS LAND là đại lý F1 ủy quyền chính thức của Vinhomes (từ 2019), Novaland (từ 2017), Masterise Homes (từ 2021), Nam Long Group (từ 2020). Chuyên phân phối tại TP.HCM, Đồng Nai, Bình Dương.",
  },
  {
    q: en ? "Are SGS LAND consultants licensed?" : "Tư vấn viên SGS LAND có chứng chỉ hành nghề không?",
    a: en
      ? "100% of our consultants hold a real estate brokerage licence from Vietnam's Ministry of Construction and comply with the Real Estate Business Law 2023. They receive regular training in AI valuation, property law and advisory skills."
      : "100% tư vấn viên có chứng chỉ hành nghề môi giới BĐS Bộ Xây Dựng, tuân thủ Luật Kinh doanh BĐS 2023. Đào tạo định kỳ về định giá AI, pháp lý và kỹ năng tư vấn.",
  },
  {
    q: en ? "How do I book a free consultation?" : "Làm thế nào để đặt lịch tư vấn miễn phí?",
    a: en
      ? "Call the hotline +84 379 281 445, email info@sgsland.vn, or message us on Zalo/Facebook. We reply within 2 working hours and the first consultation is completely free."
      : "Gọi hotline +84 379 281 445, email info@sgsland.vn hoặc nhắn tin Zalo/Facebook. Phản hồi trong 2 giờ làm việc. Buổi tư vấn đầu tiên hoàn toàn miễn phí.",
  },
  {
    q: en ? "How does SGS LAND's AI AVM valuation work?" : "Hệ thống định giá AI AVM của SGS LAND hoạt động như thế nào?",
    a: en
      ? "The AVM (Automated Valuation Model) analyses 45,000+ real transactions and adjusts for 12 factors: location, legal status, amenities, zoning, area and frontage among them. Average error is ±5%."
      : "AVM (Automated Valuation Model) phân tích 45.000+ giao dịch thực, điều chỉnh theo 12 yếu tố: vị trí, pháp lý, tiện ích, quy hoạch, diện tích, mặt tiền. Sai số trung bình ±5%.",
  },
];

export default async function ChuyenGiaPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--primary-600)" }}>
          {en ? "Our Expert Team" : "Đội Ngũ Chuyên Gia"}
        </p>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          {en ? "SGS LAND Property Experts" : "Chuyên Gia BĐS SGS LAND"}
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          {en
            ? "50+ consultants licensed by Vietnam's Ministry of Construction, an officially authorised tier-1 agent for Vinhomes, Novaland and Masterise Homes. Advice is free — we never charge buyers commission."
            : "50+ chuyên gia có chứng chỉ hành nghề Bộ Xây Dựng, đại lý F1 ủy quyền chính thức của Vinhomes, Novaland và Masterise Homes. Tư vấn miễn phí, không hoa hồng từ khách hàng."}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {STATS(en).map((s) => (
          <div key={s.label} className="text-center p-5 rounded-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="text-2xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>
              {s.value}
            </div>
            <div className="text-xs leading-tight" style={{ color: "var(--text-secondary)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {EXPERTS(en).map((expert) => (
          <div key={expert.name} className="p-6 rounded-2xl hover:shadow-token-md transition-all"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-start gap-4 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-bold text-white"
                style={{ background: "var(--primary-600)" }}>
                {expert.name.split(" ").pop()?.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base leading-tight" style={{ color: "var(--text-primary)" }}>
                  {expert.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--primary-600)" }}>
                  {expert.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>⏱ {expert.exp}{en ? " experience" : " kinh nghiệm"}</span>
              <span>🏢 {expert.spec}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {expert.desc}
            </p>
              <Link
                href={en ? `/en/chuyen-gia/${expertSlug(expert.name)}` : `/chuyen-gia/${expertSlug(expert.name)}`}
                className="inline-block mt-4 text-sm font-semibold"
                style={{ color: "var(--primary-600)" }}
              >
                {en ? "View profile →" : "Xem hồ sơ →"}
              </Link>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
          {en ? "Frequently Asked Questions" : "Câu Hỏi Thường Gặp"}
        </h2>
        <div className="space-y-4">
          {FAQ(en).map((faq) => (
            <div key={faq.q} className="p-5 rounded-xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <h3 className="font-semibold mb-2 text-sm" style={{ color: "var(--text-primary)" }}>
                {faq.q}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 rounded-2xl text-center"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {en ? "Book a Free Consultation" : "Đặt Lịch Tư Vấn Miễn Phí"}
        </h2>
        <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
          {en
            ? "An SGS LAND expert will analyse your needs, run an AI valuation and recommend properties that fit your budget and investment goals."
            : "Chuyên gia SGS LAND sẽ phân tích nhu cầu, định giá AI và đề xuất bất động sản phù hợp với ngân sách và mục tiêu đầu tư của bạn."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="tel:+84379281445"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--primary-600)" }}>
            {en ? "Call" : "Gọi"} +84 379 281 445
          </a>
          <a href="mailto:info@sgsland.vn"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            ✉️ info@sgsland.vn
          </a>
        </div>
      </div>
    </div>
  );
}
