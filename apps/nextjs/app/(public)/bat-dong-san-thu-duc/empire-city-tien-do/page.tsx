import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Empire City Tiến Độ 2026 | Keppel Land Thủ Thiêm",
  description: "Cập nhật tiến độ Empire City Thủ Thiêm 2026: Linden bàn giao, Tilia đang xây, tháp Empire 88 tầng. Giá bán và cơ hội đầu tư.",
  openGraph: { title: "Empire City Tiến Độ 2026 | Keppel Land Thủ Thiêm", description: "Cập nhật tiến độ Empire City Thủ Thiêm 2026: Linden bàn giao, Tilia đang xây, tháp Empire 88 tầng. Giá bán và cơ hội đầu tư.", url: "https://sgsland.vn/bat-dong-san-thu-duc/empire-city-tien-do", type: "article" },
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc/empire-city-tien-do", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-thu-duc/empire-city-tien-do", "en-US": "https://sgsland.vn/en/bat-dong-san-thu-duc/empire-city-tien-do", "x-default": "https://sgsland.vn/bat-dong-san-thu-duc/empire-city-tien-do" } },
};
export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chu</Link> &rsaquo; <Link href="/bat-dong-san-thu-duc">BĐS Thủ Đức</Link> &rsaquo; <span>Empire City Tiến Độ 2026 | Keppel Land Thủ Thiêm</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Empire City Tiến Độ Mới Nhất Tháng 6/2026</h1>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">Empire City là tổ hợp đô thị hạng sang 14.6ha tại Thủ Thiêm do Keppel Land (Singapore) và Tiến Phước phát triển.</p>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tong quan va thong tin chi tiet</h2>
        <p className="text-gray-700 leading-relaxed">Lien he SGS Land de nhan tu van chi tiet nhat ve du an nay va cac co hoi dau tu tai khu vuc.</p>
      </section>
      <section className="bg-blue-900 text-white rounded-xl p-8">
        <h2 className="text-2xl font-semibold mb-3">Tu Van Mien Phi</h2>
        <p className="mb-4 text-blue-100">SGS Land co chuyen gia tu van khu vuc Thu Duc, Thu Thiem. Goi ngay de duoc ho tro.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0971132378" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">0971 132 378</a>
          <Link href="/bat-dong-san-thu-duc" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">BĐS Thủ Đức</Link>
        </div>
      </section>
    </main>
  );
}
