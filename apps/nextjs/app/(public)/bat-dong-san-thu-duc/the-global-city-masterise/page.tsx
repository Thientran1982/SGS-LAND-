import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Global City Masterise Homes 2026 | Tổng Quan & Giá Bán",
  description: "The Global City Masterise Homes tại Thủ Đức – tổng hợp đầy đủ thông tin: vị trí, quy mô, giá bán 2026, tiến độ xây dựng, pháp lý và lý do nên đầu tư.",
  keywords: ["The Global City Masterise", "The Global City Thủ Đức", "Masteri The Global City", "The Global City giá bán", "căn hộ The Global City"],
  openGraph: {
    title: "The Global City Masterise Homes 2026 | Tổng Quan & Giá Bán",
    description: "The Global City Masterise Homes tại Thủ Đức – vị trí, giá bán 2026, tiến độ và cơ hội đầu tư.",
    url: "https://sgsland.vn/bat-dong-san-thu-duc/the-global-city-masterise",
    type: "article",
  },
  alternates: {
    canonical: "https://sgsland.vn/bat-dong-san-thu-duc/the-global-city-masterise",
  },
};

export default function TheGlobalCityPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chủ</Link> &rsaquo;{" "}
        <Link href="/bat-dong-san-thu-duc">BĐS Thủ Đức</Link> &rsaquo;{" "}
        <span>The Global City Masterise Homes</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        The Global City Masterise Homes – Siêu Đô Thị 117ha Tại Thủ Đức 2026
      </h1>

      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
        The Global City là dự án đô thị tích hợp quy mô 117ha do Masterise Homes phát triển tại Thủ Đức, TP.HCM — một trong những đại dự án bất động sản cao cấp lớn nhất Việt Nam hiện nay. Tọa lạc ngay trục Đại lộ Vành đai 2 và Metro tuyến 2, The Global City được kỳ vọng trở thành trung tâm thương mại, tài chính và sáng tạo mới của TP.HCM, với cam kết đẳng cấp quốc tế từ nhiều thương hiệu danh tiếng toàn cầu.
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Thông Tin Tổng Quan The Global City</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-5 space-y-3">
            <div className="flex justify-between"><span className="text-gray-600">Chủ đầu tư</span><span className="font-semibold">Masterise Homes</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Vị trí</span><span className="font-semibold">P. Hiệp Bình Phước, Thủ Đức</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Quy mô</span><span className="font-semibold">117 ha</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tổng căn</span><span className="font-semibold">~30.000 đơn vị ở</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Loại hình</span><span className="font-semibold">Căn hộ, shophouse, biệt thự, TTTM</span></div>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 space-y-3">
            <div className="flex justify-between"><span className="text-gray-600">Pháp lý</span><span className="font-semibold text-green-600">Đã có giấy phép xây dựng</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Metro</span><span className="font-semibold">Tuyến 2 (đang xây dựng)</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Giá căn hộ 2026</span><span className="font-semibold text-blue-700">Từ 80 triệu/m²</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tiến độ</span><span className="font-semibold text-green-600">Đang thi công nhiều giai đoạn</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Thương hiệu quản lý</span><span className="font-semibold">Marriott, IHG, Masterise</span></div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Vị Trí Và Kết Nối The Global City</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          The Global City tọa lạc tại Phường Hiệp Bình Phước, TP Thủ Đức — vị trí chiến lược kết nối đa hướng:
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <span className="text-2xl">🚇</span>
            <div>
              <h3 className="font-semibold text-gray-800">Metro tuyến 2</h3>
              <p className="text-sm text-gray-700">Ga metro tuyến 2 ngay trong dự án — kết nối thẳng đến CBD Quận 1 chỉ 20 phút (khi metro hoạt động)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <span className="text-2xl">🛣️</span>
            <div>
              <h3 className="font-semibold text-gray-800">Vành đai 2 & Xa lộ Hà Nội</h3>
              <p className="text-sm text-gray-700">Tiếp cận trực tiếp Xa lộ Hà Nội và Vành đai 2 — kết nối nhanh đến sân bay Tân Sơn Nhất (30 phút) và sân bay Long Thành (35 phút)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <span className="text-2xl">🏫</span>
            <div>
              <h3 className="font-semibold text-gray-800">Khu Đại học Quốc gia</h3>
              <p className="text-sm text-gray-700">Cách ĐHQG TP.HCM 3km — tạo hệ sinh thái giáo dục - công nghệ - sáng tạo liên kết với dự án</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <span className="text-2xl">🏥</span>
            <div>
              <h3 className="font-semibold text-gray-800">Khu Y tế Cao kỹ thuật</h3>
              <p className="text-sm text-gray-700">Gần Bệnh viện Ung bướu cơ sở 2, Bệnh viện Quân y 175 và hệ thống y tế phía Đông TPHCM</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Các Phân Khu & Sản Phẩm Tại The Global City</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-blue-600 pl-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">3.1 Masteri Cosmo Central – Phân Khu Căn Hộ Trung Tâm</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              Masteri Cosmo Central là tổ hợp căn hộ cao tầng tại trung tâm The Global City, gồm 6 tòa tháp All-in-One từ 30–45 tầng. Mỗi tháp tích hợp hoàn toàn: căn hộ ở, văn phòng, trung tâm thương mại và không gian xanh. Giá từ 6,5–12 tỷ/căn 2PN (70–90m²).
            </p>
            <Link href="/du-an/masteri-cosmo-central" className="text-blue-600 text-sm hover:underline">→ Xem chi tiết Masteri Cosmo Central</Link>
          </div>

          <div className="border-l-4 border-green-600 pl-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">3.2 Masteri Grand Avenue – Căn Hộ Hạng Sang</h3>
            <p className="text-gray-700 leading-relaxed">
              Masteri Grand Avenue là phân khu căn hộ cao cấp nhất trong The Global City với thiết kế kiến trúc hướng đến chuẩn mực quốc tế. Sản phẩm gồm studio, 1–4PN và penthouse. Giá từ 80–150 triệu/m², phù hợp nhà đầu tư tầm cao và chuyên gia nước ngoài.
            </p>
          </div>

          <div className="border-l-4 border-yellow-600 pl-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">3.3 Khu Thương Mại The Global Mall</h3>
            <p className="text-gray-700 leading-relaxed">
              The Global Mall là trung tâm thương mại lớn nhất trong dự án, quy mô 50.000m² diện tích bán lẻ với các thương hiệu quốc tế cao cấp. Shophouse mặt tiền The Global Mall là sản phẩm đầu tư sinh lời cao nhờ lưu lượng khách lớn khi đưa vào vận hành.
            </p>
          </div>

          <div className="border-l-4 border-purple-600 pl-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">3.4 Khu Biệt Thự & Nhà Phố The Global Residences</h3>
            <p className="text-gray-700 leading-relaxed">
              The Global Residences là phân khu nhà ở thấp tầng gồm biệt thự đơn lập, song lập và nhà phố thương mại. Diện tích đất từ 120–500m², giá từ 15–50 tỷ/căn. Đây là phân khúc khan hiếm nhất vì quỹ đất thấp tầng tại Thủ Đức ngày càng ít.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Bảng Giá The Global City 2026</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="border px-4 py-3">Loại sản phẩm</th>
                <th className="border px-4 py-3">Diện tích</th>
                <th className="border px-4 py-3">Giá/m²</th>
                <th className="border px-4 py-3">Tổng giá tham khảo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-3">Studio</td><td className="border px-4 py-3">35–45m²</td><td className="border px-4 py-3 text-blue-700 font-bold">80–95 tr/m²</td><td className="border px-4 py-3">2.8–4.3 tỷ</td></tr>
              <tr><td className="border px-4 py-3">1 phòng ngủ</td><td className="border px-4 py-3">45–60m²</td><td className="border px-4 py-3 text-blue-700 font-bold">80–100 tr/m²</td><td className="border px-4 py-3">3.6–6 tỷ</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3">2 phòng ngủ</td><td className="border px-4 py-3">65–90m²</td><td className="border px-4 py-3 text-blue-700 font-bold">85–110 tr/m²</td><td className="border px-4 py-3">5.5–9.9 tỷ</td></tr>
              <tr><td className="border px-4 py-3">3 phòng ngủ</td><td className="border px-4 py-3">90–130m²</td><td className="border px-4 py-3 text-blue-700 font-bold">90–120 tr/m²</td><td className="border px-4 py-3">8.1–15.6 tỷ</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-3">Shophouse</td><td className="border px-4 py-3">60–120m² (sàn)</td><td className="border px-4 py-3 text-blue-700 font-bold">150–250 tr/m²</td><td className="border px-4 py-3">9–30 tỷ</td></tr>
              <tr><td className="border px-4 py-3">Biệt thự</td><td className="border px-4 py-3">200–500m² (đất)</td><td className="border px-4 py-3 text-blue-700 font-bold">120–180 tr/m² (đất)</td><td className="border px-4 py-3">24–90 tỷ</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-600 text-sm italic mt-2">*Giá tham khảo quý II/2026, có thể thay đổi theo giai đoạn mở bán và tầng. Liên hệ SGS Land để nhận báo giá chính thức.</p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Tại Sao The Global City Là Điểm Sáng Đầu Tư 2026?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-5">
            <h3 className="font-semibold text-blue-800 mb-3">🏆 Thương hiệu uy tín</h3>
            <p className="text-gray-700 text-sm">Masterise Homes là chủ đầu tư uy tín nhất phân khúc cao cấp Việt Nam, không có tiền lệ trễ tiến độ hay vướng pháp lý kể từ khi thành lập. Quản lý vận hành bởi Marriott, IHG — thương hiệu khách sạn 5 sao hàng đầu thế giới.</p>
          </div>
          <div className="bg-green-50 rounded-lg p-5">
            <h3 className="font-semibold text-green-800 mb-3">📍 Vị trí không thể tốt hơn</h3>
            <p className="text-gray-700 text-sm">117ha ngay tại trung tâm Thủ Đức mới — TP Thủ Đức được định hướng là Silicon Valley của Việt Nam. Tiếp giáp Metro tuyến 2, ĐHQG, Khu Công nghệ cao, tạo hệ sinh thái tri thức và đổi mới sáng tạo hiếm có.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-5">
            <h3 className="font-semibold text-yellow-800 mb-3">💰 Tiềm năng tăng giá</h3>
            <p className="text-gray-700 text-sm">Giá căn hộ The Global City đã tăng 25–40% từ giá mở bán đầu tiên đến 2026. Khi Metro tuyến 2 hoàn thành và The Global Mall đi vào vận hành, kỳ vọng giá sẽ tiếp tục tăng mạnh thêm 20–30%.</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-5">
            <h3 className="font-semibold text-purple-800 mb-3">🏘️ Hệ sinh thái hoàn chỉnh</h3>
            <p className="text-gray-700 text-sm">The Global City tự cung tự cấp: trường quốc tế, bệnh viện, trung tâm thương mại, văn phòng, khách sạn — tất cả trong một khu 117ha. Cư dân không cần rời khu để đáp ứng mọi nhu cầu cuộc sống.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. FAQ – The Global City Masterise</h2>
        <div className="space-y-4">
          {[
            { q: "The Global City ở đâu?", a: "The Global City tọa lạc tại Phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM. Địa chỉ cụ thể: Đại lộ Phạm Văn Đồng kéo dài, giao với Xa lộ Hà Nội. Cách trung tâm Quận 1 khoảng 10km." },
            { q: "The Global City do ai làm chủ đầu tư?", a: "Masterise Homes — đơn vị thành viên của Masterise Group, trước đây là Thiso (Techcombank). Masterise Homes là chủ đầu tư cao cấp hàng đầu Việt Nam với các dự án Masteri Thảo Điền, Masteri An Phú, Masteri Centre Point." },
            { q: "Masteri Cosmo Central có phải trong The Global City không?", a: "Có. Masteri Cosmo Central là phân khu căn hộ chủ lực trong đại dự án The Global City, với 6 tòa tháp All-in-One. Đây là sản phẩm nổi bật nhất và được quan tâm nhiều nhất trong dự án." },
            { q: "The Global City có pháp lý không?", a: "Có. Masterise Homes đã được cấp giấy phép xây dựng cho nhiều giai đoạn. Pháp lý sạch, không vướng tranh chấp. Sản phẩm sẽ được cấp sổ hồng cho người mua sau khi hoàn thành công trình." },
            { q: "The Global City có metro không?", a: "Metro tuyến 2 (Bến Thành – Tham Lương) đi qua và có ga ngay trong dự án The Global City. Khi Metro tuyến 2 đi vào hoạt động (dự kiến 2028–2030), cư dân có thể di chuyển về Quận 1 chỉ trong 20–25 phút." },
          ].map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Q: {item.q}</h3>
              <p className="text-gray-700 text-sm">A: {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-900 text-white rounded-xl p-8 mb-10">
        <h2 className="text-2xl font-semibold mb-3">Tư Vấn The Global City – Nhận Bảng Giá & Ưu Đãi</h2>
        <p className="mb-4 text-blue-100">SGS Land là đại lý phân phối chính thức sản phẩm Masterise Homes. Gọi ngay để nhận bảng giá mới nhất và ưu đãi đặc biệt.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">📞 0971 132 378</a>
          <Link href="/bat-dong-san-thu-duc" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">Xem BĐS Thủ Đức</Link>
        </div>
      </section>
    </main>
  );
}
