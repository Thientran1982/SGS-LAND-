// @ts-nocheck
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chuyên Gia Bất Động Sản | Đội Ngũ Tư Vấn SGS LAND",
  description:
    "Đội ngũ 50+ chuyên gia BĐS SGS LAND: 10+ năm kinh nghiệm phân phối Vinhomes, Novaland, Masterise. Tư vấn đầu tư, định giá AI AVM ±5%, pháp lý BĐS Việt Nam.",
  alternates: { canonical: "https://sgsland.vn/chuyen-gia" },
  openGraph: {
    title: "Chuyên Gia Bất Động Sản | Đội Ngũ Tư Vấn SGS LAND",
    description:
      "50+ chuyên gia BĐS có chứng chỉ hành nghề Bộ Xây Dựng. Đại lý F1 Vinhomes, Novaland, Masterise Homes. Định giá AI miễn phí, tư vấn pháp lý độc lập.",
    url: "https://sgsland.vn/chuyen-gia",
  },
};

export const dynamic = "force-dynamic";

const EXPERTS = [
  {
    name: "Trần Minh Thiện",
    title: "CEO & Founder — Chuyên gia phân phối sơ cấp",
    exp: "10+ năm",
    spec: "Vinhomes, Novaland, Aqua City",
    desc: "Đại lý F1 ủy quyền Novaland (2017), Vinhomes (2019), Masterise Homes (2021). Chuyên phân tích đầu tư dài hạn và tư vấn BĐS hạng sang TP.HCM.",
  },
  {
    name: "Nguyễn Hoàng Nam",
    title: "CTO — Chuyên gia định giá AI (AVM)",
    exp: "10+ năm",
    spec: "Định giá AI, PropTech, CRM",
    desc: "Kiến trúc sư hệ thống AVM định giá BĐS với sai số ±5% trên 45.000+ giao dịch thực. Chuyên phân tích thị trường dữ liệu lớn.",
  },
  {
    name: "Lê Thị Hoa",
    title: "COO — Chuyên gia pháp lý & vận hành",
    exp: "15+ năm",
    spec: "Pháp lý BĐS, Môi giới Bộ Xây Dựng",
    desc: "Chứng chỉ môi giới BĐS Bộ Xây Dựng. Thiết kế quy trình kiểm tra pháp lý 2 lớp (AI + chuyên viên). Quản lý mạng lưới 15.000+ môi giới toàn quốc.",
  },
  {
    name: "Nguyễn Thị Lan",
    title: "Trưởng Phòng Tư Vấn — BĐS Đông Nam Bộ",
    exp: "8+ năm",
    spec: "Aqua City, Izumi City, Đồng Nai",
    desc: "Chuyên sâu thị trường BĐS Đồng Nai, Long An, Bình Dương. Tư vấn đầu tư khu công nghiệp và dự án sinh thái ven đô.",
  },
  {
    name: "Phạm Văn Đức",
    title: "Senior Tư Vấn — BĐS Cao Cấp TP.HCM",
    exp: "7+ năm",
    spec: "Thủ Đức, Bình Thạnh, Quận 1",
    desc: "Chuyên phân phối căn hộ cao cấp Thủ Đức: The Global City, Vinhomes Grand Park, Masteri Thảo Điền. Hỗ trợ vay ngân hàng và ký hợp đồng điện tử.",
  },
  {
    name: "Trần Thị Thu",
    title: "Senior Tư Vấn — BĐS Ven Biển & Nghỉ Dưỡng",
    exp: "6+ năm",
    spec: "Vinhomes Cần Giờ, NovaWorld Phan Thiết",
    desc: "Chuyên tư vấn BĐS nghỉ dưỡng ven biển: yield cho thuê, pháp lý sổ hồng resort, tiềm năng tăng giá 5-10 năm.",
  },
];

const STATS = [
  { value: "50+", label: "Chuyên gia có chứng chỉ hành nghề" },
  { value: "45.000+", label: "Giao dịch được tư vấn thành công" },
  { value: "±5%", label: "Độ chính xác định giá AI AVM" },
  { value: "2 giờ", label: "Thời gian phản hồi tư vấn" },
];

export default function ChuyenGiaPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--primary-600)" }}>
          Đội Ngũ Chuyên Gia
        </p>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Chuyên Gia BĐS SGS LAND
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          50+ chuyên gia có chứng chỉ hành nghề Bộ Xây Dựng, đại lý F1 ủy quyền chính thức của
          Vinhomes, Novaland và Masterise Homes. Tư vấn miễn phí, không hoa hồng từ khách hàng.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {STATS.map((s) => (
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
        {EXPERTS.map((expert) => (
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
              <span>⏱ {expert.exp} kinh nghiệm</span>
              <span>🏢 {expert.spec}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {expert.desc}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
          Câu Hỏi Thường Gặp
        </h2>
        <div className="space-y-4">
          {[
            {
              q: "Chuyên gia SGS LAND có kinh nghiệm phân phối dự án nào?",
              a: "Đội ngũ SGS LAND là đại lý F1 ủy quyền chính thức của Vinhomes (từ 2019), Novaland (từ 2017), Masterise Homes (từ 2021), Nam Long Group (từ 2020). Chuyên phân phối tại TP.HCM, Đồng Nai, Bình Dương.",
            },
            {
              q: "Tư vấn viên SGS LAND có chứng chỉ hành nghề không?",
              a: "100% tư vấn viên có chứng chỉ hành nghề môi giới BĐS Bộ Xây Dựng, tuân thủ Luật Kinh doanh BĐS 2023. Đào tạo định kỳ về định giá AI, pháp lý và kỹ năng tư vấn.",
            },
            {
              q: "Làm thế nào để đặt lịch tư vấn miễn phí?",
              a: "Gọi hotline +84 971 132 378, email info@sgsland.vn hoặc nhắn tin Zalo/Facebook. Phản hồi trong 2 giờ làm việc. Buổi tư vấn đầu tiên hoàn toàn miễn phí.",
            },
            {
              q: "Hệ thống định giá AI AVM của SGS LAND hoạt động như thế nào?",
              a: "AVM (Automated Valuation Model) phân tích 45.000+ giao dịch thực, điều chỉnh theo 12 yếu tố: vị trí, pháp lý, tiện ích, quy hoạch, diện tích, mặt tiền. Sai số trung bình ±5%.",
            },
          ].map((faq) => (
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
          Đặt Lịch Tư Vấn Miễn Phí
        </h2>
        <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
          Chuyên gia SGS LAND sẽ phân tích nhu cầu, định giá AI và đề xuất bất động sản phù hợp với
          ngân sách và mục tiêu đầu tư của bạn.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="tel:+84971132378"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--primary-600)" }}>
            📞 Gọi +84 971 132 378
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
