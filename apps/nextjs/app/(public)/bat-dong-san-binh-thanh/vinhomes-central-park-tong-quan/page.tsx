import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Vinhomes Central Park Tổng Quan 2026 | Giá Bán, Cho Thuê, Block",
  description: "Tổng quan Vinhomes Central Park Bình Thạnh 2026: 9 tòa tháp, Landmark 81, công viên 36ha. Giá bán 65-180 triệu/m², cho thuê 12-50 triệu/tháng. SGS Land.",
  keywords: ["Vinhomes Central Park tổng quan","Vinhomes Bình Thạnh","Central Park Bình Thạnh","Landmark 81","Vinhomes Central Park giá 2026"],
  openGraph: { title: "Vinhomes Central Park Tổng Quan 2026", description: "9 tòa tháp, Landmark 81, công viên 36ha, metro tuyến 1.", url: "https://sgsland.vn/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan", type: "article" },
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan", "en-US": "https://sgsland.vn/en/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan", "x-default": "https://sgsland.vn/bat-dong-san-binh-thanh/vinhomes-central-park-tong-quan" } },
};
export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6"><Link href="/">Trang chủ</Link> &rsaquo; <Link href="/bat-dong-san-binh-thanh">BĐS Bình Thạnh</Link> &rsaquo; <span>Vinhomes Central Park tổng quan</span></nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Vinhomes Central Park – Tổng Quan Toàn Diện 2026</h1>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">Vinhomes Central Park là khu đô thị phức hợp đẳng cấp 44ha tại Phường 22, Bình Thạnh — biểu tượng bất động sản cao cấp nhất TP.HCM. Với 9 tòa tháp cao tầng, tòa Landmark 81 cao nhất Đông Nam Á và công viên trung tâm 36ha lớn nhất thành phố, dự án đã định nghĩa lại tiêu chuẩn sống đô thị Việt Nam. Cập nhật đầy đủ thông tin năm 2026.</p>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Thông Tin Tổng Quan</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-5 space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2"><span>Chủ đầu tư</span><span className="font-semibold">Vinhomes (Vingroup)</span></div>
            <div className="flex justify-between border-b pb-2"><span>Vị trí</span><span className="font-semibold">Phường 22, Bình Thạnh</span></div>
            <div className="flex justify-between border-b pb-2"><span>Quy mô</span><span className="font-semibold">44 ha</span></div>
            <div className="flex justify-between border-b pb-2"><span>Số tòa tháp</span><span className="font-semibold">9 tòa (Park 1-7, Landmark 1-2)</span></div>
            <div className="flex justify-between border-b pb-2"><span>Landmark 81</span><span className="font-semibold">81 tầng – cao nhất ĐNA</span></div>
            <div className="flex justify-between"><span>Công viên</span><span className="font-semibold">36ha – lớn nhất TPHCM</span></div>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2"><span>Tổng căn hộ</span><span className="font-semibold">~10.000 căn</span></div>
            <div className="flex justify-between border-b pb-2"><span>Giá bán 2026</span><span className="font-semibold text-blue-700">65–180 triệu/m²</span></div>
            <div className="flex justify-between border-b pb-2"><span>Giá cho thuê</span><span className="font-semibold text-blue-700">12–50 triệu/tháng</span></div>
            <div className="flex justify-between border-b pb-2"><span>Pháp lý</span><span className="font-semibold text-green-600">Đã có sổ hồng</span></div>
            <div className="flex justify-between border-b pb-2"><span>Metro</span><span className="font-semibold">Tuyến 1 – Ga VCP</span></div>
            <div className="flex justify-between"><span>Năm bàn giao</span><span className="font-semibold">2016–2018 (đã ở)</span></div>
          </div>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Giá Bán Theo Từng Block 2026</h2>
        <p className="text-gray-700 leading-relaxed mb-4">Vinhomes Central Park gồm 9 tòa chia làm 2 nhóm: Park Series (Park 1–7) phân khúc cao cấp và Landmark Series (Landmark 1–2, Landmark 81) phân khúc siêu cao cấp. Giá thứ cấp tháng 6/2026:</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-900 text-white">
              <tr><th className="border px-4 py-2">Tòa tháp</th><th className="border px-4 py-2">Tầng</th><th className="border px-4 py-2">Giá (tr/m²)</th><th className="border px-4 py-2">Nổi bật</th></tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Park 1, 2</td><td className="border px-4 py-2">35 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">65–85</td><td className="border px-4 py-2">View công viên</td></tr>
              <tr><td className="border px-4 py-2">Park 3</td><td className="border px-4 py-2">35 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">70–90</td><td className="border px-4 py-2">View sông Sài Gòn</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Park 4, 5</td><td className="border px-4 py-2">40 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">75–95</td><td className="border px-4 py-2">Gần ga Metro</td></tr>
              <tr><td className="border px-4 py-2">Park 6, 7</td><td className="border px-4 py-2">40 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">80–100</td><td className="border px-4 py-2">View Landmark 81</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Landmark 1, 2</td><td className="border px-4 py-2">45 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">100–130</td><td className="border px-4 py-2">View sông + công viên</td></tr>
              <tr><td className="border px-4 py-2">Landmark 81</td><td className="border px-4 py-2">81 tầng</td><td className="border px-4 py-2 text-blue-700 font-bold">150–180+</td><td className="border px-4 py-2">Cao nhất ĐNA</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Tiện Ích Nội Khu 5 Sao</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🏊 Hồ bơi & Spa</h3><p>5 hồ bơi nội khu, spa Vinpearl, gym đa năng 24/7</p></div>
          <div className="bg-green-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🛍️ Vincom Mega Mall</h3><p>70.000m² mua sắm, F&B, rạp chiếu phim, Vinmart</p></div>
          <div className="bg-yellow-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🏫 Vinschool</h3><p>Trường Vinschool mầm non–THPT ngay trong khuôn viên</p></div>
          <div className="bg-purple-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🏥 Vinmec</h3><p>Bệnh viện quốc tế Vinmec 5 sao ngay trong khu</p></div>
          <div className="bg-red-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🌳 Công viên 36ha</h3><p>Lớn nhất TPHCM: đường chạy, đạp xe, vui chơi trẻ em</p></div>
          <div className="bg-gray-50 p-4 rounded-lg text-sm"><h3 className="font-semibold mb-1">🚇 Metro tuyến 1</h3><p>Ga Metro ngay trong dự án – 10 phút đến Bến Thành</p></div>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Landmark 81 – Biểu Tượng Sài Gòn</h2>
        <p className="text-gray-700 leading-relaxed mb-4">Landmark 81 cao 461m, 81 tầng — cao nhất Đông Nam Á tính đến 2026. Công trình biểu tượng này bao gồm: tầng 3–8 Vincom Mega Mall; tầng 9–17 văn phòng hạng A; tầng 18–79 khách sạn JW Marriott 5 sao; tầng 76–79 Sky View đài quan sát 360°; tầng 80–81 căn hộ penthouse Marriott Residences. Giá căn hộ Landmark 81: 150–250 triệu/m² — là sản phẩm cao cấp nhất trong toàn dự án Vinhomes Central Park.</p>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Cho Thuê Vinhomes Central Park 2026</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-800 text-white"><tr><th className="border px-4 py-2">Loại căn</th><th className="border px-4 py-2">Diện tích</th><th className="border px-4 py-2">Giá thuê/tháng</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50"><td className="border px-4 py-2">Studio</td><td className="border px-4 py-2">38–45m²</td><td className="border px-4 py-2 font-bold text-blue-700">9–13 triệu</td></tr>
              <tr><td className="border px-4 py-2">1 phòng ngủ</td><td className="border px-4 py-2">50–60m²</td><td className="border px-4 py-2 font-bold text-blue-700">12–18 triệu</td></tr>
              <tr className="bg-gray-50"><td className="border px-4 py-2">2 phòng ngủ</td><td className="border px-4 py-2">75–90m²</td><td className="border px-4 py-2 font-bold text-blue-700">18–28 triệu</td></tr>
              <tr><td className="border px-4 py-2">3 phòng ngủ</td><td className="border px-4 py-2">100–130m²</td><td className="border px-4 py-2 font-bold text-blue-700">30–50 triệu</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. FAQ – Vinhomes Central Park</h2>
        <div className="space-y-3">
          {[
            {q:"Vinhomes Central Park có bao nhiêu block?",a:"9 tòa: Park 1-7 và Landmark 1-2 (riêng Landmark 81 là tòa cao nhất với 81 tầng)."},
            {q:"Giá Vinhomes Central Park 2026?",a:"65–180 triệu/m² tùy tòa. Park series: 65–100 tr/m². Landmark series: 100–130 tr/m². Landmark 81: 150–180+ tr/m²."},
            {q:"Metro Vinhomes Central Park ở đâu?",a:"Ga Metro tuyến 1 nằm ngay trong khuôn viên dự án. Từ đây đến Bến Thành chỉ khoảng 10 phút."},
            {q:"Có nên mua Vinhomes Central Park không?",a:"Có. Dự án đã có sổ hồng đầy đủ, pháp lý sạch, tỷ lệ cho thuê cao 92-95%, và là khu đô thị cao cấp nhất Bình Thạnh với hệ sinh thái tiện ích hoàn chỉnh."},
          ].map((item,i) => (
            <div key={i} className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-1">Q: {item.q}</h3>
              <p className="text-gray-700 text-sm">A: {item.a}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-blue-900 text-white rounded-xl p-8">
        <h2 className="text-2xl font-semibold mb-3">Tư Vấn Vinhomes Central Park – Mua & Thuê</h2>
        <p className="mb-4 text-blue-100">SGS Land có danh mục Vinhomes Central Park phong phú. Gọi ngay để nhận tư vấn miễn phí.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">📞 0971 132 378</a>
          <Link href="/du-an/vinhomes-central-park" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">Xem dự án</Link>
        </div>
      </section>
    </main>
  );
}
