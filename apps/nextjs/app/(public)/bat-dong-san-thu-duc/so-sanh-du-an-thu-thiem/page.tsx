import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "So Sánh Dự Án Thủ Thiêm 2026 | Empire City vs The Metropole",
  description: "So sánh chi tiết các dự án Thủ Thiêm 2026: Empire City, The Metropole, Thủ Thiêm Dragon. Giá, tiến độ, pháp lý, nên mua dự án nào?",
  openGraph: { title: "So Sánh Dự Án Thủ Thiêm 2026 | Empire City vs The Metropole", description: "So sánh chi tiết các dự án Thủ Thiêm 2026: Empire City, The Metropole, Thủ Thiêm Dragon. Giá, tiến độ, pháp lý, nên mua dự án nào?", url: "https://sgsland.vn/bat-dong-san-thu-duc/so-sanh-du-an-thu-thiem", type: "article" },
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc/so-sanh-du-an-thu-thiem", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-thu-duc/so-sanh-du-an-thu-thiem", "en-US": "https://sgsland.vn/en/bat-dong-san-thu-duc/so-sanh-du-an-thu-thiem", "x-default": "https://sgsland.vn/bat-dong-san-thu-duc/so-sanh-du-an-thu-thiem" } },
};
export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/">Trang chu</Link> &rsaquo; <Link href="/bat-dong-san-thu-duc">BĐS Thủ Đức</Link> &rsaquo; <span>So Sánh Dự Án Thủ Thiêm 2026 | Empire City vs The Metropole</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">So Sánh Dự Án Thủ Thiêm 2026 – Nên Mua Dự Án Nào?</h1>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">Thủ Thiêm đang có nhiều dự án hạng sang cùng triển khai. Bài viết so sánh chi tiết để giúp nhà đầu tư chọn đúng dự án phù hợp.</p>
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
