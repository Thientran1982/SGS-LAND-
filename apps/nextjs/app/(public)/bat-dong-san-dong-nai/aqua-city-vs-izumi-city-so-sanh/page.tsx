import type { Metadata } from "next";
import Link from "next/link";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getFAQSchema, SITE_URL } from "@/lib/schema";
export const metadata: Metadata = {
  title: "Aqua City vs Izumi City So Sánh 2026 | Nên Mua Dự Án Nào?",
  description: "So sánh tham khảo Aqua City và Izumi City về vị trí, quy mô, pháp lý, tiến độ và giá. Xác minh dữ liệu từng sản phẩm bằng hồ sơ hiện hành trước khi giao dịch.",
  keywords: ["Aqua City vs Izumi City","so sánh Aqua City Izumi City","Aqua City hay Izumi City","Novaland hay Nam Long","BĐS Long Thành 2026"],
  openGraph: { title: "Aqua City vs Izumi City 2026 – So Sánh Toàn Diện", description: "So sánh Aqua City Novaland và Izumi City Nam Long: pháp lý, tiến độ, giá bán 2026.", url: "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh", type: "article" },
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh", "en-US": "https://sgsland.vn/en/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh", "x-default": "https://sgsland.vn/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh" } },
};
const FAQ = [
  { question: "Aqua City hay Izumi City tốt hơn?", answer: "Không có lựa chọn tốt nhất cho mọi người mua. Hãy so sánh đúng sản phẩm theo mục tiêu sử dụng, ngân sách, hồ sơ pháp lý, tiến độ và thanh khoản tại thời điểm giao dịch." },
  { question: "Giá Aqua City và Izumi City bao nhiêu?", answer: "Giá thay đổi theo phân khu, diện tích, loại hình và thời điểm. Các khoảng giá trong bài chỉ mang tính tham khảo; cần xác nhận bảng giá và giao dịch thực tế trước khi quyết định." },
  { question: "Pháp lý hai dự án cần kiểm tra gì?", answer: "Kiểm tra quy hoạch, quyết định giao đất, giấy phép, giấy chứng nhận hoặc điều kiện cấp giấy, nghĩa vụ tài chính, thế chấp và điều khoản hợp đồng của đúng sản phẩm." },
];
export default function Page() {
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "BĐS Đồng Nai", url: `${SITE_URL}/bat-dong-san-dong-nai` },
    { name: "So sánh Aqua City và Izumi City", url: `${SITE_URL}/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh` },
  ]);
  return (
    <>
      <SchemaScript schemas={[getFAQSchema(FAQ, `${SITE_URL}/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh#faq`), breadcrumb]} />
      <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6"><Link href="/">Trang chủ</Link> &rsaquo; <Link href="/bat-dong-san-dong-nai">BĐS Đồng Nai</Link> &rsaquo; <span>Aqua City vs Izumi City so sánh</span></nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Aqua City vs Izumi City 2026 – So Sánh Toàn Diện & Khuyến Nghị</h1>
      <p className="answer-box text-lg text-gray-600 mb-8 leading-relaxed">Aqua City và Izumi City là hai dự án tại Đồng Nai có khác biệt về vị trí, quy mô, sản phẩm, pháp lý và tiến độ. Bài viết cung cấp khung so sánh tham khảo; các số liệu và nhận định cần được đối chiếu với hồ sơ chính thức và thị trường tại thời điểm giao dịch.</p>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. So Sánh Tổng Quan Hai Dự Án</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white"><tr><th className="border px-4 py-3">Tiêu chí</th><th className="border px-4 py-3 text-center">Aqua City (Novaland)</th><th className="border px-4 py-3 text-center">Izumi City (Nam Long)</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">Quy mô</td><td className="border px-4 py-3 text-center font-bold text-blue-700">~1.000 ha</td><td className="border px-4 py-3 text-center">~170 ha</td></tr>
              <tr><td className="border px-4 py-3 font-medium">Chủ đầu tư</td><td className="border px-4 py-3 text-center">Novaland Group</td><td className="border px-4 py-3 text-center font-bold text-green-700">Nam Long Group</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">Pháp lý</td><td className="border px-4 py-3 text-center text-yellow-600">⚬ Đang hoàn thiện (một số phân khu)</td><td className="border px-4 py-3 text-center text-green-600 font-bold">✅ Sổ hồng nhiều block</td></tr>
              <tr><td className="border px-4 py-3 font-medium">Tiến độ</td><td className="border px-4 py-3 text-center text-yellow-600">⚬ Chậm do vướng pháp lý</td><td className="border px-4 py-3 text-center text-green-600 font-bold">✅ Đúng kế hoạch</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">Giá nhà phố</td><td className="border px-4 py-3 text-center">5–18 tỷ (thứ cấp: giảm 15–30%)</td><td className="border px-4 py-3 text-center">3,5–6 tỷ (ổn định)</td></tr>
              <tr><td className="border px-4 py-3 font-medium">Điểm nổi bật</td><td className="border px-4 py-3 text-center">Quy mô khổng lồ, 4km bờ sông</td><td className="border px-4 py-3 text-center font-bold text-green-700">Japan Town 10ha độc đáo</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">Thanh khoản</td><td className="border px-4 py-3 text-center text-red-600">❌ Khó (thị trường e ngại)</td><td className="border px-4 py-3 text-center text-green-600 font-bold">✅ Dễ hơn, ổn định</td></tr>
              <tr><td className="border px-4 py-3 font-medium">Tiềm năng dài hạn</td><td className="border px-4 py-3 text-center font-bold text-blue-700">Rất cao (nếu pháp lý xong)</td><td className="border px-4 py-3 text-center">Tốt (ổn định)</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">Phù hợp với ai</td><td className="border px-4 py-3 text-center">Nhà đầu tư dài hạn, chịu rủi ro</td><td className="border px-4 py-3 text-center font-bold text-green-700">Mua ở thực, đầu tư an toàn</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Phân Tích Chuyên Sâu Từng Tiêu Chí</h2>
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Quy Mô Và Tầm Nhìn Dự Án</h3>
            <p className="text-gray-700 leading-relaxed mb-3">Aqua City được giới thiệu là khu đô thị quy mô lớn tại Đồng Nai với các nhóm sản phẩm nhà ở và tiện ích theo phân khu. Quy mô, chức năng quy hoạch và mức độ hoàn thiện cần được đối chiếu với hồ sơ dự án hiện hành; không nên suy ra kết quả đầu tư từ quy mô quảng bá.</p>
            <p className="text-gray-700 leading-relaxed">Izumi City 170ha nhỏ hơn nhưng có điểm nhấn rõ ràng: Japan Town 10ha là sản phẩm độc đáo không có ở bất kỳ dự án BĐS nào khác tại Việt Nam, tạo ra định vị thương hiệu rất mạnh và thu hút nhóm khách hàng yêu thích phong cách Nhật Bản.</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Pháp Lý – Yếu Tố Quyết Định</h3>
            <p className="text-gray-700 leading-relaxed mb-3">Đây là sự khác biệt lớn nhất giữa hai dự án. Izumi City của Nam Long Group có lịch sử pháp lý minh bạch, ít vướng mắc. Phân khu Sakura (Giai đoạn 1) đã được cấp sổ hồng. Nam Long không vướng vào cuộc khủng hoảng trái phiếu doanh nghiệp năm 2022–2023 như Novaland.</p>
            <p className="text-gray-700 leading-relaxed">Tình trạng pháp lý Aqua City có thể khác nhau theo phân khu và sản phẩm. Người mua cần kiểm tra quy hoạch, quyết định giao đất, giấy phép, điều kiện cấp giấy, thế chấp và nghĩa vụ tài chính bằng tài liệu chính thức trước khi đặt cọc; bài viết không thay thế thẩm định pháp lý.</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.3 Giá & Tiềm Năng Đầu Tư</h3>
            <p className="text-gray-700 leading-relaxed mb-3">Chênh lệch giữa giá gốc và giá thứ cấp Aqua City phải được tính từ giao dịch hoặc bảng giá có ngày, cùng loại sản phẩm và cùng điều kiện thanh toán. Bài viết không sử dụng tỷ lệ giảm hoặc dự báo tăng giá khi chưa có nguồn kiểm chứng tương ứng.</p>
            <p className="text-gray-700 leading-relaxed">Izumi City giữ giá ổn định hơn, không có mức sụt giảm mạnh như Aqua City. Yield cho thuê EHome Southgate khoảng 5–7%/năm — đây là mức tốt cho nhà đầu tư cần dòng tiền ngay.</p>
          </div>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Kết Luận: Nên Chọn Aqua City Hay Izumi City?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-800 mb-3 text-lg">🏙️ Cân nhắc Aqua City khi:</h3>
            <ul className="space-y-2 text-gray-700 text-sm"><li>✓ Hồ sơ pháp lý của đúng sản phẩm đã được kiểm tra độc lập</li><li>✓ Giá, tiến độ và điều khoản thanh toán có tài liệu cập nhật</li><li>✓ Khả năng tài chính phù hợp mà không phụ thuộc vào dự báo tăng giá</li><li>✓ Mục tiêu sử dụng và thời gian nắm giữ phù hợp với thanh khoản thực tế</li></ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="font-semibold text-green-800 mb-3 text-lg">🌸 Chọn Izumi City nếu:</h3>
            <ul className="space-y-2 text-gray-700 text-sm"><li>✓ Mua để ở thực, ưu tiên an toàn pháp lý</li><li>✓ Đầu tư ngắn–trung hạn (2–5 năm)</li><li>✓ Thích phong cách Nhật Bản, Japan Town</li><li>✓ Cần thanh khoản tốt hơn khi cần bán lại</li></ul>
          </div>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. FAQ – Aqua City vs Izumi City</h2>
        <div className="space-y-3">
          {[{q:"Aqua City hay Izumi City tốt hơn?",a:"Không có lựa chọn tốt nhất cho mọi người mua. So sánh cần dựa trên mục tiêu sử dụng, ngân sách, hồ sơ pháp lý, tiến độ và thanh khoản của đúng sản phẩm tại thời điểm giao dịch."},
            {q:"Dự án nào gần sân bay Long Thành hơn?",a:"Khoảng cách cần được đo từ đúng phân khu đến điểm hạ tầng cụ thể; không nên dùng khoảng cách quảng bá thay cho bản đồ và thời gian di chuyển thực tế có ngày cập nhật."},
            {q:"Giá Aqua City hay Izumi City rẻ hơn?",a:"Giá phụ thuộc loại hình, diện tích, phân khu, pháp lý và điều kiện thanh toán. Các mức giá trong bài chỉ là tham khảo và cần được xác nhận bằng bảng giá hoặc giao dịch hiện hành."},
          ].map((item,i) => (
            <div key={i} className="border rounded-lg p-4"><h3 className="font-semibold text-gray-800 mb-1">Q: {item.q}</h3><p className="text-gray-700 text-sm">A: {item.a}</p></div>
          ))}
        </div>
      </section>
      <section className="bg-blue-900 text-white rounded-xl p-8">
        <h2 className="text-2xl font-semibold mb-3">Tư Vấn Chọn Aqua City hay Izumi City?</h2>
        <p className="mb-4 text-blue-100">SGS Land có chuyên gia am hiểu cả hai dự án, giúp bạn chọn đúng theo nhu cầu và ngân sách cụ thể.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">📞 0971 132 378</a>
          <Link href="/bat-dong-san-dong-nai" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">BĐS Đồng Nai</Link>
        </div>
      </section>
    </main>
    </>
  );
}
