import type { Metadata } from "next";
import Link from "next/link";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getFAQSchema, SITE_URL } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Aqua City Có Nên Mua Không 2026? Phân Tích Toàn Diện",
  description: "Phân tích tham khảo Aqua City Novaland: pháp lý, tiến độ, giá, cho thuê và rủi ro. Các dữ liệu giao dịch cần được xác minh bằng hồ sơ hiện hành trước khi quyết định.",
  keywords: ["Aqua City có nên mua không", "Aqua City 2026", "đầu tư Aqua City Novaland", "Aqua City pháp lý 2026", "mua nhà Aqua City"],
  openGraph: {
    title: "Aqua City Có Nên Mua Không 2026? Phân Tích Toàn Diện",
    description: "Phân tích chi tiết Aqua City 2026: pháp lý, tiến độ, giá bán và cơ hội đầu tư.",
    url: "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026",
    type: "article",
  },
  alternates: {
    canonical: "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026",
  },
};

const FAQ = [
  {
    question: "Aqua City có nên mua không?",
    answer: "Không có câu trả lời chung cho mọi người mua. Cần đối chiếu mục tiêu sử dụng, khả năng tài chính, tình trạng pháp lý của đúng sản phẩm, tiến độ và điều khoản hợp đồng bằng tài liệu hiện hành trước khi đặt cọc.",
  },
  {
    question: "Giá Aqua City hiện tại bao nhiêu?",
    answer: "Giá Aqua City thay đổi theo phân khu, loại hình, diện tích, tình trạng pháp lý và thời điểm giao dịch. Các khoảng giá trên trang chỉ là tham khảo, không thay thế bảng giá hoặc xác nhận giao dịch mới nhất.",
  },
  {
    question: "Aqua City đã có sổ hồng chưa?",
    answer: "Tình trạng giấy chứng nhận có thể khác nhau theo từng lô và phân khu. Người mua cần yêu cầu bản sao hồ sơ gốc và kiểm tra tình trạng thế chấp, quy hoạch, nghĩa vụ tài chính trước khi ký hoặc đặt cọc.",
  },
];

export default function AquaCityCoNenMuaPage() {
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "BĐS Đồng Nai", url: `${SITE_URL}/bat-dong-san-dong-nai` },
    { name: "Aqua City có nên mua không", url: `${SITE_URL}/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026` },
  ]);
  return (
    <>
      <SchemaScript schemas={[getFAQSchema(FAQ, `${SITE_URL}/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026#faq`), breadcrumb]} />
      <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chủ</Link> &rsaquo;{" "}
        <Link href="/bat-dong-san-dong-nai">BĐS Đồng Nai</Link> &rsaquo;{" "}
        <span>Aqua City có nên mua không 2026</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Aqua City Có Nên Mua Không 2026? – Phân Tích Toàn Diện Pháp Lý, Giá & Cơ Hội
      </h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-8">
        <p className="text-yellow-800 font-medium">Thông tin tham khảo: tình trạng pháp lý, giá và tiến độ Aqua City có thể khác nhau theo từng phân khu và thời điểm. Hãy xác minh hồ sơ gốc trước khi giao dịch.</p>
      </div>

        <p className="answer-box text-lg text-gray-600 mb-8 leading-relaxed">
         Aqua City Novaland là khu đô thị tại Long Hưng, Biên Hòa, Đồng Nai. Có nên mua hay không phụ thuộc vào mục tiêu sử dụng, tài chính và hồ sơ pháp lý của đúng sản phẩm; bài viết này phân tích các yếu tố cần kiểm tra, không phải khuyến nghị đầu tư.
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Tổng Quan Aqua City Novaland 2026</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Chủ đầu tư</span><span className="font-semibold">Novaland Group</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Vị trí</span><span className="font-semibold">Nhơn Trạch, Đồng Nai</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Quy mô</span><span className="font-semibold">~1.000 ha</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Loại hình</span><span className="font-semibold">Nhà phố, biệt thự, shophouse</span></div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Giá 2026</span><span className="font-semibold text-blue-700">5–18 tỷ/căn</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Tiến độ xây dựng</span><span className="font-semibold text-green-600">60–80% (tùy phân khu)</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Pháp lý</span><span className="font-semibold text-yellow-600">Đang hoàn thiện theo từng lô</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600">Khoảng cách CBD</span><span className="font-semibold">30–35km (qua cầu Nhơn Trạch)</span></div>
          </div>
        </div>
        <p className="text-gray-700 leading-relaxed">
          Aqua City được quy hoạch theo mô hình "thành phố trong thành phố" với 9 phân khu chức năng, trung tâm thương mại Aqua Central Square, chuỗi khách sạn 5 sao, bệnh viện quốc tế, trường đại học và hệ thống 4km bờ sông mặt nước. Đây là đại dự án có tầm nhìn dài hạn nhưng cũng đối mặt với nhiều thách thức pháp lý và tài chính kể từ 2022.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Tình Trạng Pháp Lý Aqua City 2026</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Pháp lý là yếu tố quan trọng nhất khi quyết định mua Aqua City. Dưới đây là tổng hợp tình hình pháp lý theo từng phân khu tính đến tháng 6/2026:
        </p>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Phoenix Central & Phoenix South</h3>
              <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium">✅ Pháp lý đã ổn</span>
            </div>
            <p className="text-gray-700 text-sm">Đây là các phân khu sớm nhất và có tình trạng pháp lý tốt nhất. Nhiều căn đã được cấp sổ hồng, đang bàn giao cho khách hàng. Giao dịch thứ cấp diễn ra bình thường.</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">The Suite & Aqua Marine</h3>
              <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full font-medium">⚬ Đang hoàn thiện</span>
            </div>
            <p className="text-gray-700 text-sm">Pháp lý đang trong quá trình hoàn thiện thủ tục. Một số lô đã có quyết định giao đất, đang chờ cấp sổ. Dự kiến hoàn thiện trong Q3–Q4/2026.</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Aqua Residences & Aqua Town</h3>
              <span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-medium">⚠️ Còn vướng mắc</span>
            </div>
            <p className="text-gray-700 text-sm">Vẫn còn vướng mắc về quy hoạch phân khu và chuyển đổi mục đích sử dụng đất. Khuyến nghị: chỉ mua khi đã có đủ pháp lý rõ ràng.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Giá Thứ Cấp Aqua City Tháng 6/2026</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-3">Loại hình</th>
                <th className="border px-4 py-3">Diện tích đất</th>
                <th className="border px-4 py-3">Giá gốc CĐT</th>
                <th className="border px-4 py-3">Giá thứ cấp 2026</th>
                <th className="border px-4 py-3">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-3">Nhà phố thương mại</td><td className="border px-4 py-3">80–100m²</td><td className="border px-4 py-3">8–12 tỷ</td><td className="border px-4 py-3 text-blue-700 font-bold">6–10 tỷ</td><td className="border px-4 py-3 text-red-600">-15% đến -25%</td></tr>
              <tr><td className="border px-4 py-3">Nhà phố vườn</td><td className="border px-4 py-3">100–150m²</td><td className="border px-4 py-3">9–14 tỷ</td><td className="border px-4 py-3 text-blue-700 font-bold">7–12 tỷ</td><td className="border px-4 py-3 text-red-600">-15% đến -20%</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3">Biệt thự đơn lập</td><td className="border px-4 py-3">200–350m²</td><td className="border px-4 py-3">15–25 tỷ</td><td className="border px-4 py-3 text-blue-700 font-bold">12–20 tỷ</td><td className="border px-4 py-3 text-red-600">-10% đến -20%</td></tr>
              <tr><td className="border px-4 py-3">Shophouse</td><td className="border px-4 py-3">60–80m²</td><td className="border px-4 py-3">7–10 tỷ</td><td className="border px-4 py-3 text-blue-700 font-bold">5–8 tỷ</td><td className="border px-4 py-3 text-red-600">-20% đến -30%</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-600 text-sm italic mt-2">*Giá thứ cấp 2026 đã giảm đáng kể so với giá gốc do áp lực thanh khoản của thị trường. Đây là cơ hội mua giá tốt cho nhà đầu tư dài hạn.</p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Phân Tích Rủi Ro Và Cơ Hội Đầu Tư Aqua City 2026</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
            <h3 className="font-semibold text-red-800 mb-3">❌ Rủi Ro Cần Biết</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Pháp lý chưa hoàn thiện toàn bộ dự án (một số phân khu vẫn còn vướng)</li>
              <li>• Cơ sở hạ tầng kết nối chưa đồng bộ — đường cầu Nhơn Trạch đang thi công</li>
              <li>• Tiện ích thương mại vận hành chưa đầy đủ — dân cư thưa thớt</li>
              <li>• Thanh khoản thứ cấp khó khăn do thị trường vẫn còn e ngại</li>
              <li>• Novaland vẫn đang tái cơ cấu tài chính, tiến độ có thể bị ảnh hưởng</li>
            </ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="font-semibold text-green-800 mb-3">✅ Cơ Hội Đầu Tư</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Giá thứ cấp đã giảm 15–30% — mua giá tốt hơn giá gốc</li>
              <li>• Cầu Nhơn Trạch (đường Vành đai 3) hoàn thành sẽ rút ngắn kết nối với TPHCM</li>
              <li>• Sân bay Long Thành 2026 đi vào giai đoạn hoàn thiện tạo sức hút khu vực</li>
              <li>• Quy mô 1.000ha — hệ sinh thái lớn khi hoàn thiện sẽ rất hấp dẫn</li>
              <li>• Nhà đầu tư dài hạn (5–10 năm) có thể đạt lợi nhuận cao khi hạ tầng hoàn chỉnh</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Kết Luận: Aqua City Có Nên Mua Không?</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Khung đánh giá tham khảo:</strong> Chỉ cân nhắc Aqua City sau khi xác minh pháp lý của đúng lô, khả năng tài chính, thanh khoản dự kiến và điều khoản hợp đồng; không nên xem nội dung này là khuyến nghị mua.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>KHÔNG nên mua</strong> nếu: bạn cần thanh khoản trong 1–3 năm, hoặc bạn mua các phân khu còn vướng pháp lý, hoặc bạn dùng đòn bẩy tài chính (vay ngân hàng) quá mức.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Tiềm năng dài hạn của Aqua City vẫn rất lớn nhờ quy mô, vị trí và hạ tầng kết nối đang hoàn thiện. Nhưng cần kiên nhẫn và thẩm định kỹ pháp lý từng lô trước khi xuống tiền.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">FAQ – Aqua City 2026</h2>
        <div className="space-y-4">
          {[
            { q: "Aqua City đã cấp sổ hồng chưa?", a: "Một số phân khu đã được cấp sổ hồng (Phoenix Central). Các phân khu khác đang hoàn thiện thủ tục, dự kiến có sổ trong 2026–2027. Cần hỏi cụ thể từng lô trước khi mua." },
            { q: "Aqua City có dân cư ở thực tế chưa?", a: "Đã có một số hộ dân vào ở tại phân khu Phoenix. Mật độ dân cư hiện còn thưa, dự kiến tăng nhanh khi cầu Nhơn Trạch và sân bay Long Thành đi vào hoạt động." },
            { q: "Mua Aqua City thuê được không?", a: "Tiềm năng cho thuê hiện còn hạn chế do dân cư thưa. Tuy nhiên, khi hạ tầng khu vực hoàn chỉnh (2027–2030), giá thuê được dự báo sẽ tăng mạnh. Shophouse mặt tiền đường lớn có thể cho thuê kinh doanh từ 15–30 triệu/tháng." },
            { q: "Novaland có bị phá sản không?", a: "Novaland đang trong quá trình tái cơ cấu tài chính dưới sự hỗ trợ của Nhà nước và ngân hàng. Tập đoàn vẫn hoạt động và tiếp tục thi công, bàn giao dự án. Rủi ro phá sản là thấp nhưng không bằng không." },
            { q: "Cầu Nhơn Trạch bao giờ xong?", a: "Cầu Nhơn Trạch (nằm trên đường Vành đai 3 TP.HCM) dự kiến hoàn thành trong năm 2026. Khi thông xe, thời gian di chuyển từ Aqua City về trung tâm TPHCM sẽ rút ngắn xuống còn 20–25 phút." },
          ].map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Q: {item.q}</h3>
              <p className="text-gray-700 text-sm">A: {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-900 text-white rounded-xl p-8 mb-10">
        <h2 className="text-2xl font-semibold mb-3">Tư Vấn Mua Aqua City Đúng Phân Khu, Đúng Giá</h2>
        <p className="mb-4 text-blue-100">SGS Land có đội ngũ chuyên gia am hiểu toàn bộ pháp lý Aqua City. Gọi ngay để được tư vấn miễn phí và chọn đúng lô phù hợp nhu cầu.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">📞 0971 132 378</a>
          <Link href="/bat-dong-san-dong-nai" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">Xem BĐS Đồng Nai</Link>
        </div>
      </section>
      </main>
    </>
  );
}
