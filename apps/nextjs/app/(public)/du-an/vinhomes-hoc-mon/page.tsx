import type { Metadata } from "next";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getFAQSchema, SITE_URL } from "@/lib/schema";
import type { FAQItem } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vinhomes Hóc Môn — Smart City 4.0, 667ha | Giá Từ 2,5 Tỷ | SGS LAND",
  description:
    "Vinhomes Smart City Hóc Môn — siêu đô thị 667ha, Q4/2026. Giá nhà phố từ 8 tỷ, biệt thự từ 25 tỷ, căn hộ từ 2,5 tỷ (35-80 triệu/m²). SGS LAND đại lý F1 uỷ quyền Vinhomes. Đặt chỗ ưu tiên, nhận thông tin mở bán sớm nhất.",
  keywords: [
    "Vinhomes Hóc Môn",
    "Vinhomes Smart City Hóc Môn",
    "dự án Hóc Môn 2026",
    "giá Vinhomes Hóc Môn",
    "Smart City 4.0 TP.HCM",
    "BĐS Hóc Môn Vành đai 3",
    "Vinhomes Hóc Môn 667ha",
  ],
  alternates: { canonical: `${SITE_URL}/du-an/vinhomes-hoc-mon` },
  openGraph: {
    type: "article",
    title: "Vinhomes Hóc Môn — Smart City 4.0, 667ha | SGS LAND",
    description:
      "Siêu đô thị thông minh 667ha tại Hóc Môn, TP.HCM. Giá căn hộ từ 2,5 tỷ, nhà phố từ 8 tỷ. Ra mắt Q4/2026. Đại lý F1 SGS LAND — đặt chỗ ưu tiên.",
    url: `${SITE_URL}/du-an/vinhomes-hoc-mon`,
    siteName: "SGS LAND",
    locale: "vi_VN",
    publishedTime: "2026-06-05T00:00:00.000Z",
    modifiedTime: new Date().toISOString(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Vinhomes Hóc Môn Smart City 4.0 — SGS LAND F1",
    description: "667ha, từ 2,5 tỷ. Ra mắt Q4/2026. Đăng ký đặt chỗ ưu tiên.",
  },
};

const FAQ_VHM: FAQItem[] = [
  {
    question: "Vinhomes Hóc Môn giá bao nhiêu?",
    answer:
      "Vinhomes Smart City Hóc Môn (667ha, Q4/2026) có giá dự kiến: căn hộ cao tầng 2,5-4,5 tỷ (35-80 triệu/m²); nhà phố liền kề 8-20 tỷ; shophouse mặt đại lộ 15-40 tỷ; biệt thự 25-60 tỷ. SGS LAND là đại lý F1 uỷ quyền Vinhomes — đặt chỗ ưu tiên, nhận chính sách tốt nhất tại sgsland.vn/du-an/vinhomes-hoc-mon.",
  },
  {
    question: "Vinhomes Hóc Môn ở đâu?",
    answer:
      "Vinhomes Smart City Hóc Môn tại huyện Hóc Môn, TP.HCM, cách Quận 1 khoảng 20km về phía Tây Bắc. Kết nối: Vành đai 3 (vận hành 2026) kết nối Hóc Môn với Bình Dương, Đồng Nai, Long An; Quốc lộ 22 mở rộng đến cửa khẩu Mộc Bài; Cầu Bình Phước rút ngắn kết nối TP Thủ Đức.",
  },
  {
    question: "Vinhomes Hóc Môn bao nhiêu ha?",
    answer:
      "Vinhomes Smart City Hóc Môn có quy mô 667 ha — lớn hơn Vinhomes Grand Park (271ha) và gần bằng Vinhomes Cần Giờ (2.870ha). Đây là một trong những quỹ đất phát triển đô thị quy mô lớn cuối cùng còn lại tại TP.HCM.",
  },
  {
    question: "Vinhomes Hóc Môn ra mắt khi nào?",
    answer:
      "Vinhomes Smart City Hóc Môn dự kiến ra mắt và mở bán Q4/2026. Chủ trương đầu tư đã được UBND TP.HCM phê duyệt; quy hoạch 1/500 đang triển khai. SGS LAND cập nhật tiến độ liên tục — đăng ký nhận thông báo mở bán sớm nhất tại sgsland.vn/du-an/vinhomes-hoc-mon.",
  },
  {
    question: "Vinhomes Hóc Môn có nên đặt chỗ trước không?",
    answer:
      "Theo kinh nghiệm của SGS LAND với các dự án Vinhomes (Grand Park, Cần Giờ), đăng ký đặt chỗ trước qua kênh F1 giúp: ưu tiên chọn vị trí tốt nhất (căn góc, view đẹp, phân khu đắc địa), nhận chính sách chiết khấu và ưu đãi từ chủ đầu tư, và cập nhật thông tin mở bán chính thức sớm nhất. Đăng ký miễn phí tại sgsland.vn/du-an/vinhomes-hoc-mon.",
  },
  {
    question: "So sánh Vinhomes Hóc Môn và Vinhomes Grand Park?",
    answer:
      "Vinhomes Grand Park (271ha, TP Thủ Đức): Metro số 1 vận hành, đã bàn giao, sổ hồng riêng, giá 45-90 triệu/m², thanh khoản cao nhất khu Đông — phù hợp mua ở ngay. Vinhomes Hóc Môn (667ha, Q4/2026): giá dự kiến 35-80 triệu/m² (thấp hơn 20-35%), quy mô lớn hơn, Smart City 4.0 — phù hợp đầu tư trung hạn 3-5 năm và người mua ở thực ngân sách hợp lý.",
  },
  {
    question: "Chủ đầu tư Vinhomes Hóc Môn là ai?",
    answer:
      "Chủ đầu tư Vinhomes Smart City Hóc Môn là Vinhomes Joint Stock Company (Công ty Cổ phần Vinhomes), thành viên của Tập đoàn Vingroup (niêm yết HOSE, mã VHM). Vinhomes là chủ đầu tư BĐS số 1 Việt Nam với các dự án đã bàn giao thành công: Vinhomes Grand Park (271ha), Vinhomes Central Park (44 tòa), Vinhomes Ocean Park (420ha).",
  },
  {
    question: "Pháp lý Vinhomes Hóc Môn có tốt không?",
    answer:
      "Vinhomes Smart City Hóc Môn (Q2/2026): chủ trương đầu tư đã được UBND TP.HCM phê duyệt; quy hoạch 1/500 đang triển khai; chủ đầu tư Vinhomes có lịch sử bàn giao sổ hồng riêng từng căn tại tất cả dự án đã hoàn thành. SGS LAND theo dõi và cập nhật tình trạng pháp lý dự án hàng tuần.",
  },
];

const REAL_ESTATE_LISTING_SCHEMA = {
  "@context": "https://schema.org",
  "@type": ["RealEstateListing", "Place"],
  "@id": `${SITE_URL}/du-an/vinhomes-hoc-mon#listing`,
  name: "Vinhomes Smart City Hóc Môn — SGS LAND",
  description:
    "Siêu đô thị thông minh 667ha tại huyện Hóc Môn, TP.HCM. Chủ đầu tư Vinhomes (Vingroup). Ra mắt Q4/2026. Giá căn hộ từ 2,5 tỷ (35-80 triệu/m²). Nhà phố từ 8 tỷ. Biệt thự từ 25 tỷ. SGS LAND đại lý phân phối F1 uỷ quyền.",
  url: `${SITE_URL}/du-an/vinhomes-hoc-mon`,
  datePosted: "2026-06-05",
  validThrough: "2027-12-31",
  priceRange: "2.5–60 tỷ VNĐ",
  floorSize: {
    "@type": "QuantitativeValue",
    value: 6670000,
    unitCode: "MTK",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hóc Môn",
    addressRegion: "TP. Hồ Chí Minh",
    addressCountry: "VN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 10.8913,
    longitude: 106.5939,
  },
  containedIn: {
    "@type": "Place",
    name: "Hóc Môn, TP.HCM",
    containedIn: {
      "@type": "City",
      name: "TP. Hồ Chí Minh",
      containedInPlace: { "@type": "Country", name: "Việt Nam" },
    },
  },
  seller: {
    "@type": ["Organization", "RealEstateAgent"],
    "@id": `${SITE_URL}/#organization`,
    name: "SGS LAND",
    url: SITE_URL,
    telephone: "+84971132378",
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "VND",
    lowPrice: 2500000000,
    highPrice: 60000000000,
    availability: "https://schema.org/PreOrder",
    validFrom: "2026-06-05",
  },
};

const SPECIAL_ANNOUNCEMENT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SpecialAnnouncement",
  "@id": `${SITE_URL}/du-an/vinhomes-hoc-mon#announcement`,
  name: "Mở bán Vinhomes Smart City Hóc Môn Q4/2026",
  text: "SGS LAND — đại lý F1 uỷ quyền Vinhomes — chính thức nhận đăng ký đặt chỗ ưu tiên Vinhomes Smart City Hóc Môn (667ha, giá từ 2,5 tỷ, Smart City 4.0). Ra mắt Q4/2026. Vành đai 3 vận hành 2026 — catalyst tăng giá trực tiếp.",
  datePosted: "2026-06-05",
  expires: "2027-06-30",
  category: "RealEstate",
  spatialCoverage: {
    "@type": "Place",
    name: "Hóc Môn, TP.HCM, Việt Nam",
  },
  announcementLocation: {
    "@type": "VirtualLocation",
    url: `${SITE_URL}/du-an/vinhomes-hoc-mon`,
  },
};

export default function VinhomesHocMonPage() {
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Dự án", url: `${SITE_URL}/du-an` },
    { name: "Vinhomes Hóc Môn", url: `${SITE_URL}/du-an/vinhomes-hoc-mon` },
  ]);

  const faqSchema = getFAQSchema(FAQ_VHM, `${SITE_URL}/du-an/vinhomes-hoc-mon#faq`);

  return (
    <>
      <SchemaScript schemas={[REAL_ESTATE_LISTING_SCHEMA, SPECIAL_ANNOUNCEMENT_SCHEMA, faqSchema, breadcrumb]} />

      <main className="min-h-screen bg-white dark:bg-slate-900">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 mb-6 text-sm font-semibold tracking-widest uppercase text-indigo-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
              Đại lý F1 uỷ quyền — Nhận đặt chỗ
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
              Vinhomes Hóc Môn<br />
              <span className="text-indigo-300">Smart City 4.0</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-3 font-medium">
              667ha · Ra mắt Q4/2026 · Giá từ 2,5 tỷ VNĐ
            </p>
            <p className="text-slate-400 max-w-2xl leading-relaxed">
              Siêu đô thị thông minh thế hệ 4.0 — quỹ đất quy mô lớn cuối cùng tại TP.HCM. Chủ đầu tư: Vinhomes (Vingroup, mã VHM-HOSE). Vành đai 3 (2026) kết nối toàn vùng Đông Nam Bộ.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href="https://sgsland.vn/contact"
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl font-bold text-white transition-colors"
              >
                Đăng ký đặt chỗ ưu tiên
              </a>
              <a
                href="https://sgsland.vn/ai-valuation"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white border border-white/20 transition-colors"
              >
                Định giá AI miễn phí
              </a>
            </div>
          </div>
        </section>

        {/* Key Facts */}
        <section className="py-12 px-4 bg-slate-50 dark:bg-slate-800">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">
              Thông tin dự án
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Quy mô", value: "667 ha", sub: "Smart City 4.0" },
                { label: "Chủ đầu tư", value: "Vinhomes", sub: "Vingroup · VHM" },
                { label: "Ra mắt", value: "Q4/2026", sub: "Đặt chỗ ngay" },
                { label: "Giá từ", value: "2,5 tỷ", sub: "35-80 triệu/m²" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white dark:bg-slate-700 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-600"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {item.value}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Price Table */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Bảng giá dự kiến (Q4/2026)
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Nguồn: SGS LAND broker network Q2/2026. Giá thực tế có thể thay đổi theo từng đợt mở bán của Vinhomes.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-indigo-50 dark:bg-slate-800">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      Loại hình
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      Diện tích
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      Giá dự kiến
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: "Căn hộ Studio", area: "30-45 m²", price: "2,5–3,5 tỷ", note: "Phù hợp đầu tư cho thuê" },
                    { type: "Căn hộ 1 phòng ngủ", area: "50-65 m²", price: "3,5–5 tỷ", note: "Ở thực hoặc cho thuê" },
                    { type: "Căn hộ 2 phòng ngủ", area: "70-90 m²", price: "5–7 tỷ", note: "Gia đình nhỏ" },
                    { type: "Căn hộ 3 phòng ngủ", area: "95-120 m²", price: "7–10 tỷ", note: "Gia đình lớn" },
                    { type: "Nhà phố liền kề", area: "80-150 m² đất", price: "8–20 tỷ", note: "Kinh doanh + ở thực" },
                    { type: "Shophouse mặt đại lộ", area: "100-200 m²", price: "15–40 tỷ", note: "Mặt tiền đường chính" },
                    { type: "Biệt thự song lập", area: "150-250 m² đất", price: "20–40 tỷ", note: "Vườn riêng" },
                    { type: "Biệt thự đơn lập", area: "250-500 m² đất", price: "30–60 tỷ", note: "Hạng sang nội khu" },
                  ].map((row) => (
                    <tr key={row.type} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">{row.type}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">{row.area}</td>
                      <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-600">{row.price}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="py-12 px-4 bg-slate-50 dark:bg-slate-800">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Hạ tầng kết nối — Catalyst tăng giá
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Vành đai 3 TP.HCM (2026)",
                  desc: "Kết nối trực tiếp Hóc Môn với Bình Dương, Đồng Nai, Long An. Rút ngắn thời gian di chuyển, tăng giá BĐS khu vực 25-35%.",
                  badge: "Vận hành 2026",
                },
                {
                  title: "Quốc lộ 22 mở rộng",
                  desc: "Kết nối cửa khẩu Mộc Bài (Tây Ninh) — tuyến giao thương quốc tế quan trọng phía Tây TP.HCM.",
                  badge: "Đang thi công",
                },
                {
                  title: "Cầu Bình Phước mới",
                  desc: "Rút ngắn kết nối Hóc Môn với TP Thủ Đức — giảm thời gian di chuyển qua trung tâm.",
                  badge: "Quy hoạch 2026-2027",
                },
                {
                  title: "Metro số 2 (dài hạn)",
                  desc: "Tuyến Bến Thành – Tham Lương đang nghiên cứu mở rộng đến Hóc Môn trong giai đoạn 2030+.",
                  badge: "Nghiên cứu",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white dark:bg-slate-700 rounded-xl p-5 border border-slate-100 dark:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3>
                    <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full whitespace-nowrap font-medium">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">
              Câu hỏi thường gặp về Vinhomes Hóc Môn
            </h2>
            <div className="space-y-4">
              {FAQ_VHM.map((item) => (
                <div
                  key={item.question}
                  className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700"
                >
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{item.question}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-indigo-900 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-black mb-4">Đăng ký đặt chỗ ưu tiên ngay</h2>
            <p className="text-indigo-200 mb-8 leading-relaxed">
              SGS LAND là đại lý F1 uỷ quyền chính thức của Vinhomes. Đăng ký sớm để chọn vị trí tốt nhất với chính sách chiết khấu từ chủ đầu tư.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="https://sgsland.vn/contact"
                className="px-8 py-4 bg-white text-indigo-900 rounded-xl font-black text-lg hover:bg-indigo-50 transition-colors"
              >
                Liên hệ tư vấn ngay
              </a>
              <a
                href="tel:+84971132378"
                className="px-8 py-4 bg-white/10 border border-white/30 text-white rounded-xl font-bold text-lg hover:bg-white/20 transition-colors"
              >
                +84 971 132 378
              </a>
            </div>
            <p className="text-xs text-indigo-400 mt-6">
              Miễn phí tư vấn · Không ép cọc · Pháp lý 2 lớp kiểm chứng
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
