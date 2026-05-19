import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Tin Tức Bất Động Sản 2025 | SGS LAND",
  description: "Cập nhật tin tức thị trường BĐS mới nhất: giá nhà đất, dự án mở bán, chính sách, pháp lý. Phân tích chuyên sâu từ chuyên gia SGS LAND.",
  alternates: { canonical: "https://sgsland.vn/news" },
};
export const revalidate = 1800; // 30min

const NEWS_CATEGORIES = ["Thị trường", "Dự án mới", "Pháp lý", "Tài chính", "Đầu tư"];

const STATIC_NEWS = [
  { id: 1, title: "Thị trường BĐS TP.HCM quý 2/2025: Phân khúc căn hộ tăng trưởng mạnh", category: "Thị trường", date: "19/05/2025", slug: "thi-truong-bds-hcm-q2-2025", summary: "Giá căn hộ trung cấp tại TP.HCM tăng 8-12% so với cùng kỳ năm ngoái, khu vực Thủ Đức dẫn đầu tăng trưởng." },
  { id: 2, title: "Masteri Cosmo Central mở bán đợt cuối: Còn 20 căn chọn lọc", category: "Dự án mới", date: "18/05/2025", slug: "masteri-cosmo-central-mo-ban-dot-cuoi", summary: "Masteri Cosmo Central (MCC) chính thức công bố đợt mở bán cuối cùng với 20 căn hộ cao cấp, giá từ 6,43 tỷ đồng." },
  { id: 3, title: "Luật Kinh doanh Bất động sản 2024: Những điểm mới cần biết", category: "Pháp lý", date: "17/05/2025", slug: "luat-kinh-doanh-bds-2024-diem-moi", summary: "Luật BĐS 2024 có hiệu lực từ 1/1/2025 với nhiều thay đổi quan trọng về thủ tục, điều kiện kinh doanh BĐS." },
  { id: 4, title: "Lãi suất vay mua nhà tháng 5/2025: Ngân hàng nào ưu đãi nhất?", category: "Tài chính", date: "16/05/2025", slug: "lai-suat-vay-mua-nha-thang-5-2025", summary: "Tổng hợp lãi suất vay mua nhà tốt nhất tháng 5/2025 từ 8 ngân hàng lớn. Techcombank và VPBank dẫn đầu ưu đãi." },
  { id: 5, title: "Long Thành: Điểm đến đầu tư BĐS hot nhất 2025 sau sân bay", category: "Đầu tư", date: "15/05/2025", slug: "long-thanh-diem-den-dau-tu-bds-2025", summary: "Khu vực Long Thành (Đồng Nai) thu hút mạnh dòng tiền đầu tư khi sân bay quốc tế Long Thành sắp hoàn thành giai đoạn 1." },
  { id: 6, title: "Vinhomes Grand Park: Cập nhật tiến độ và giá bán tháng 5/2025", category: "Dự án mới", date: "14/05/2025", slug: "vinhomes-grand-park-cap-nhat-thang-5-2025", summary: "Vinhomes Grand Park tiếp tục bàn giao các block mới, giá thứ cấp dao động 4,5-7,2 tỷ tùy vị trí và tầng." },
];

export default function NewsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Tin Tức Bất Động Sản</h1>
        <p style={{ color: "var(--text-secondary)" }}>Cập nhật mới nhất từ thị trường BĐS Việt Nam</p>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-8">
        {["Tất cả", ...NEWS_CATEGORIES].map((cat) => (
          <button key={cat} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{ background: cat === "Tất cả" ? "var(--primary-600)" : "var(--bg-elevated)", color: cat === "Tất cả" ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
            {cat}
          </button>
        ))}
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {STATIC_NEWS.map((news) => (
          <article key={news.id} className="p-6 rounded-2xl hover:scale-[1.01] transition-transform cursor-pointer group"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                {news.category}
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <Calendar className="w-3 h-3" />{news.date}
              </span>
            </div>
            <h2 className="font-bold text-base mb-2 leading-snug group-hover:text-indigo-500 transition-colors"
              style={{ color: "var(--text-primary)" }}>{news.title}</h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>{news.summary}</p>
            <Link href={`/news/${news.slug}`} className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--primary-600)" }}>
              Đọc tiếp <ArrowRight className="w-3 h-3" />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
