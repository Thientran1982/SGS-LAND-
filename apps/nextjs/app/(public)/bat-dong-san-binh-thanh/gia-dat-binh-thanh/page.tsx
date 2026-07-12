import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Giá Đất Bình Thạnh 2026 | Bảng Giá Theo Từng Tuyến Đường",
  description: "Cập nhật giá đất Bình Thạnh 2026 theo từng tuyến đường: Đinh Bộ Lĩnh, Xô Viết Nghệ Tĩnh, Nơ Trang Long, Ung Văn Khiêm. Phân tích xu hướng và dự báo tăng giá.",
  keywords: ["giá đất Bình Thạnh", "giá đất Bình Thạnh 2026", "bảng giá đất quận Bình Thạnh", "giá nhà đất Bình Thạnh theo đường", "đất mặt tiền Bình Thạnh"],
  openGraph: {
    title: "Giá Đất Bình Thạnh 2026 | Bảng Giá Theo Từng Tuyến Đường",
    description: "Cập nhật giá đất Bình Thạnh 2026 theo từng tuyến đường và phân tích xu hướng.",
    url: "https://sgsland.vn/bat-dong-san-binh-thanh/gia-dat-binh-thanh",
    type: "article",
  },
  alternates: {
    canonical: "https://sgsland.vn/bat-dong-san-binh-thanh/gia-dat-binh-thanh",
  },
};

export default function GiaDatBinhThanhPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chủ</Link> &rsaquo;{" "}
        <Link href="/bat-dong-san-binh-thanh">BĐS Bình Thạnh</Link> &rsaquo;{" "}
        <span>Giá đất Bình Thạnh theo đường</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Giá Đất Bình Thạnh 2026 – Bảng Giá Chi Tiết Theo Từng Tuyến Đường
      </h1>

      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
        Bình Thạnh là một trong những quận có giá đất cao nhất TP.HCM nhờ vị trí tiếp giáp trung tâm, hệ thống giao thông đồng bộ và metro tuyến 1 vừa đi vào hoạt động. Năm 2026, thị trường nhà đất Bình Thạnh tiếp tục ghi nhận mức tăng trưởng bền vững. Dưới đây là bảng giá đất chi tiết theo từng tuyến đường tại Bình Thạnh, cập nhật quý II/2026.
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Giá Đất Bình Thạnh Theo Từng Tuyến Đường 2026</h2>

        <h3 className="text-xl font-semibold text-gray-700 mb-3">1.1 Đường Đinh Bộ Lĩnh</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Đinh Bộ Lĩnh là trục đường huyết mạch từ Bình Thạnh lên Thủ Đức, nối Nguyễn Xí với cầu Ông Dầu. Đây là tuyến đường thương mại sầm uất, được xem là "phố Wall" của Bình Thạnh với mật độ ngân hàng, showroom xe, nhà hàng dày đặc.
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-2">Đoạn đường</th>
                <th className="border px-4 py-2">Chiều rộng</th>
                <th className="border px-4 py-2">Giá đất mặt tiền (tr/m²)</th>
                <th className="border px-4 py-2">Giá nhà phố (tỷ/căn)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Đinh Bộ Lĩnh (P.26 – P.24)</td><td className="border px-4 py-2">4m lộ giới 30m</td><td className="border px-4 py-2 text-blue-700 font-bold">180–250</td><td className="border px-4 py-2">15–35 tỷ</td></tr>
              <tr><td className="border px-4 py-2">Đinh Bộ Lĩnh (P.24 – P.13)</td><td className="border px-4 py-2">4m lộ giới 30m</td><td className="border px-4 py-2 text-blue-700 font-bold">150–200</td><td className="border px-4 py-2">12–25 tỷ</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Đinh Bộ Lĩnh (gần Gò Vấp)</td><td className="border px-4 py-2">4m lộ giới 30m</td><td className="border px-4 py-2 text-blue-700 font-bold">120–160</td><td className="border px-4 py-2">10–18 tỷ</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold text-gray-700 mb-3">1.2 Đường Xô Viết Nghệ Tĩnh</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Xô Viết Nghệ Tĩnh là tuyến đường kết nối Bình Thạnh với Quận 1 (qua cầu Sài Gòn cũ) và có tầm nhìn trực tiếp ra sông Sài Gòn. Đây là tuyến đường cao cấp nhất Bình Thạnh, nơi tập trung các dự án hạng sang như Vinhomes Central Park, Xi Riverview Palace, Saigon Pearl.
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-2">Đoạn đường</th>
                <th className="border px-4 py-2">Giá đất (tr/m²)</th>
                <th className="border px-4 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Xô Viết Nghệ Tĩnh (P.25)</td><td className="border px-4 py-2 text-blue-700 font-bold">300–450</td><td className="border px-4 py-2">Gần Vinhomes, view sông</td></tr>
              <tr><td className="border px-4 py-2">Xô Viết Nghệ Tĩnh (P.26)</td><td className="border px-4 py-2 text-blue-700 font-bold">250–350</td><td className="border px-4 py-2">Gần Landmark 81</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Xô Viết Nghệ Tĩnh (P.22)</td><td className="border px-4 py-2 text-blue-700 font-bold">200–280</td><td className="border px-4 py-2">Gần cầu Bình Triệu</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold text-gray-700 mb-3">1.3 Đường Nơ Trang Long</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-2">Đoạn đường</th>
                <th className="border px-4 py-2">Giá đất (tr/m²)</th>
                <th className="border px-4 py-2">Giá nhà phố</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Nơ Trang Long (P.12 – P.14)</td><td className="border px-4 py-2 text-blue-700 font-bold">130–180</td><td className="border px-4 py-2">10–22 tỷ</td></tr>
              <tr><td className="border px-4 py-2">Nơ Trang Long (gần chợ Bà Chiểu)</td><td className="border px-4 py-2 text-blue-700 font-bold">150–220</td><td className="border px-4 py-2">12–28 tỷ</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold text-gray-700 mb-3">1.4 Đường Ung Văn Khiêm</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-2">Đoạn đường</th>
                <th className="border px-4 py-2">Giá đất (tr/m²)</th>
                <th className="border px-4 py-2">Đặc điểm</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Ung Văn Khiêm (P.25)</td><td className="border px-4 py-2 text-blue-700 font-bold">160–230</td><td className="border px-4 py-2">Gần ĐHQG, Metro</td></tr>
              <tr><td className="border px-4 py-2">Ung Văn Khiêm (P.24)</td><td className="border px-4 py-2 text-blue-700 font-bold">140–190</td><td className="border px-4 py-2">Khu dân cư yên tĩnh</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold text-gray-700 mb-3">1.5 Đường Nguyễn Hữu Cảnh</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Nguyễn Hữu Cảnh là tuyến đường ven sông cao cấp nhất Bình Thạnh, nơi tọa lạc các dự án Xi Riverview Palace, Sunwah Pearl, Masteri An Phú. Giá đất đường Nguyễn Hữu Cảnh là cao nhất khu vực, dao động 350–600 triệu/m² tùy vị trí. Đây là tuyến đường "tỷ phú" của Bình Thạnh.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Giá Đất Bình Thạnh Theo Phường</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="border px-4 py-3">Phường</th>
                <th className="border px-4 py-3">Giá đất hẻm (tr/m²)</th>
                <th className="border px-4 py-3">Giá đất mặt tiền (tr/m²)</th>
                <th className="border px-4 py-3">Đặc điểm nổi bật</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">P.22 (Vinhomes)</td><td className="border px-4 py-3">80–130</td><td className="border px-4 py-3 text-blue-700 font-bold">300–600</td><td className="border px-4 py-3">Khu cao cấp nhất BT</td></tr>
              <tr><td className="border px-4 py-3 font-medium">P.25 (Landmark 81)</td><td className="border px-4 py-3">70–120</td><td className="border px-4 py-3 text-blue-700 font-bold">250–450</td><td className="border px-4 py-3">Gần metro, view sông</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">P.26 (cầu Sài Gòn)</td><td className="border px-4 py-3">60–100</td><td className="border px-4 py-3 text-blue-700 font-bold">180–300</td><td className="border px-4 py-3">Gần Quận 1</td></tr>
              <tr><td className="border px-4 py-3 font-medium">P.14 (chợ Bà Chiểu)</td><td className="border px-4 py-3">50–80</td><td className="border px-4 py-3 text-blue-700 font-bold">130–200</td><td className="border px-4 py-3">Khu thương mại sầm uất</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">P.13 (Đinh Bộ Lĩnh)</td><td className="border px-4 py-3">45–75</td><td className="border px-4 py-3 text-blue-700 font-bold">120–180</td><td className="border px-4 py-3">Trung tâm BT</td></tr>
              <tr><td className="border px-4 py-3 font-medium">P.11 (gần Gò Vấp)</td><td className="border px-4 py-3">35–60</td><td className="border px-4 py-3 text-blue-700 font-bold">80–130</td><td className="border px-4 py-3">Giá dễ tiếp cận</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3 font-medium">P.1, P.2, P.3</td><td className="border px-4 py-3">40–70</td><td className="border px-4 py-3 text-blue-700 font-bold">100–160</td><td className="border px-4 py-3">Giáp Quận 3</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Xu Hướng Giá Đất Bình Thạnh 2024–2026</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Theo dữ liệu giao dịch thực tế tại Bình Thạnh, giá đất khu vực này đã tăng đáng kể trong giai đoạn 2024–2026 nhờ nhiều yếu tố:
        </p>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-5 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-700 mb-2">+18%</div>
            <p className="text-gray-700 text-sm">Tăng giá đất trung bình Bình Thạnh 2024–2026</p>
          </div>
          <div className="bg-green-50 p-5 rounded-lg text-center">
            <div className="text-3xl font-bold text-green-700 mb-2">+25%</div>
            <p className="text-gray-700 text-sm">Tăng giá khu vực Vinhomes, Nguyễn Hữu Cảnh</p>
          </div>
          <div className="bg-yellow-50 p-5 rounded-lg text-center">
            <div className="text-3xl font-bold text-yellow-700 mb-2">+12%</div>
            <p className="text-gray-700 text-sm">Tăng giá khu vực Đinh Bộ Lĩnh, Nơ Trang Long</p>
          </div>
        </div>
        <p className="text-gray-700 leading-relaxed mb-4">
          <strong>Metro tuyến 1</strong> là động lực tăng giá lớn nhất tại Bình Thạnh. Khu vực xung quanh ga Vinhomes Central Park và ga Bến xe Miền Đông Mới ghi nhận mức tăng 20–30% trong vòng 12 tháng sau khi metro đưa vào vận hành (Q4/2024). Đây là hiệu ứng "transit-oriented development" (TOD) điển hình của các đô thị châu Á như Singapore, Bangkok.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          <strong>Quy hoạch mở rộng đô thị</strong> theo Điều chỉnh quy hoạch chung TP.HCM đến 2040 định vị Bình Thạnh là trung tâm phát triển tích hợp với các trục hạ tầng metro, tuyến đường cao tốc liên vùng và dự án cầu Thủ Thiêm 4 đang được xúc tiến sẽ càng tăng thêm sức hút của bất động sản Bình Thạnh trong các năm tới.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Kinh Nghiệm Mua Đất Bình Thạnh – Lưu Ý Quan Trọng</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-gray-800">Kiểm tra quy hoạch trước khi mua</h3>
              <p className="text-gray-700 text-sm mt-1">Một số khu vực tại Bình Thạnh vẫn nằm trong quy hoạch treo hoặc hành lang bảo vệ đê điều sông Sài Gòn. Luôn tra cứu quy hoạch 1/2000 tại UBND phường hoặc Sở QH-KT TP.HCM trước khi giao dịch.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <span className="text-2xl">📋</span>
            <div>
              <h3 className="font-semibold text-gray-800">Xem xét chỉ số ngập lụt</h3>
              <p className="text-gray-700 text-sm mt-1">Một số hẻm thấp trũng tại Bình Thạnh (đặc biệt khu P.1, P.2, P.7, P.8) có nguy cơ ngập khi triều cường. Nên khảo sát thực tế vào mùa mưa và hỏi người dân địa phương.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <span className="text-2xl">🏦</span>
            <div>
              <h3 className="font-semibold text-gray-800">So sánh giá thị trường và giá Nhà nước</h3>
              <p className="text-gray-700 text-sm mt-1">Bảng giá đất Nhà nước (theo UBND TP.HCM) tại Bình Thạnh hiện thấp hơn giá thị trường 30–50%. Điều này tạo ra chênh lệch lớn trong tính thuế chuyển nhượng và giá trị thế chấp ngân hàng.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. FAQ – Câu Hỏi Về Giá Đất Bình Thạnh</h2>
        <div className="space-y-4">
          {[
            { q: "Giá đất Bình Thạnh 2026 cao nhất bao nhiêu?", a: "Đường Nguyễn Hữu Cảnh và khu vực ven sông tại P.22 có giá cao nhất: 400–600 triệu/m². Đây là giá đất mặt tiền hạng sang, tiếp giáp các dự án Vinhomes, Xi Riverview." },
            { q: "Đất hẻm Bình Thạnh giá bao nhiêu?", a: "Đất hẻm tại Bình Thạnh dao động 35–130 triệu/m² tùy phường và kích thước hẻm. Hẻm ô tô tại P.22, P.25 có giá 80–130 triệu/m²; hẻm xe máy tại P.11, P.12 dao động 35–60 triệu/m²." },
            { q: "Có nên đầu tư đất Bình Thạnh năm 2026 không?", a: "Bình Thạnh vẫn là lựa chọn tốt cho nhà đầu tư dài hạn nhờ vị trí trung tâm, metro hoạt động và quỹ đất khan hiếm. Tuy nhiên, giá đã tăng mạnh nên biên lợi nhuận ngắn hạn thấp hơn giai đoạn 2020–2022." },
            { q: "Bình Thạnh có còn đất nền không?", a: "Quỹ đất nền tại Bình Thạnh gần như đã cạn kiệt, chỉ còn một số ít lô nhỏ từ phân lô bán nền trong hẻm. Phần lớn giao dịch là nhà phố có sẵn hoặc căn hộ chung cư." },
          ].map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Q: {item.q}</h3>
              <p className="text-gray-700 text-sm">A: {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-900 text-white rounded-xl p-8 mb-10">
        <h2 className="text-2xl font-semibold mb-4">Tư Vấn Mua Đất Bình Thạnh Miễn Phí</h2>
        <p className="mb-4 text-blue-100">
          SGS Land chuyên tư vấn mua bán, đầu tư nhà đất Bình Thạnh. Gọi ngay để được phân tích pháp lý và định giá miễn phí.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center hover:bg-blue-50">
            📞 0971 132 378
          </a>
          <Link href="/bat-dong-san-binh-thanh" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center hover:bg-blue-800">
            Xem BĐS Bình Thạnh
          </Link>
        </div>
      </section>
    </main>
  );
}
