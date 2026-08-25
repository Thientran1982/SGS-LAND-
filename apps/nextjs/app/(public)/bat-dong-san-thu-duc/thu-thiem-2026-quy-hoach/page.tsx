import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Thủ Thiêm 2026 Quy Hoạch | Cập Nhật Mới Nhất",
  description: "Quy hoạch khu đô thị Thủ Thiêm 2026: hạ tầng giao thông, trung tâm tài chính, dự án đang triển khai. Cập nhật mới nhất từ SGS Land.",
  openGraph: { title: "Thủ Thiêm 2026 Quy Hoạch | Cập Nhật Mới Nhất", description: "Quy hoạch khu đô thị Thủ Thiêm 2026: hạ tầng giao thông, trung tâm tài chính, dự án đang triển khai. Cập nhật mới nhất từ SGS Land.", url: "https://sgsland.vn/bat-dong-san-thu-duc/thu-thiem-2026-quy-hoach", type: "article" },
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc/thu-thiem-2026-quy-hoach", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-thu-duc/thu-thiem-2026-quy-hoach", "en-US": "https://sgsland.vn/en/bat-dong-san-thu-duc/thu-thiem-2026-quy-hoach", "x-default": "https://sgsland.vn/bat-dong-san-thu-duc/thu-thiem-2026-quy-hoach" } },
};
export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chu</Link> &rsaquo; <Link href="/bat-dong-san-thu-duc">BĐS Thủ Đức</Link> &rsaquo; <span>Thủ Thiêm 2026 Quy Hoạch | Cập Nhật Mới Nhất</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Thủ Thiêm 2026 Quy Hoạch – Cập Nhật Toàn Diện</h1>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">Thủ Thiêm là khu đô thị mới 657ha tại TP Thủ Đức, được quy hoạch thành trung tâm tài chính quốc tế của TP.HCM.</p>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tong quan va thong tin chi tiet</h2>
        <p className="text-gray-700 leading-relaxed">Lien he SGS Land de nhan tu van chi tiet nhat ve du an nay va cac co hoi dau tu tai khu vuc.</p>
      </section>
      <section className="bg-blue-900 text-white rounded-xl p-8">
        <h2 className="text-2xl font-semibold mb-3">Tu Van Mien Phi</h2>
        <p className="mb-4 text-blue-100">SGS Land co chuyen gia tu van khu vuc Thu Duc, Thu Thiem. Goi ngay de duoc ho tro.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="tel:0379281445" className="bg-[var(--bg-surface)] text-blue-900 px-6 py-3 rounded-lg font-semibold text-center">0379 281 445</a>
          <Link href="/bat-dong-san-thu-duc" className="border border-white text-white px-6 py-3 rounded-lg font-semibold text-center">BĐS Thủ Đức</Link>
        </div>
      </section>
    </main>
  );
}
