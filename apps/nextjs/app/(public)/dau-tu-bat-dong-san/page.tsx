// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, Shield, MapPin, BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Đầu Tư Bất Động Sản 2026: 5 Kênh Sinh Lời 8-15%/Năm | SGS Land",
  description: "Đầu tư BĐS 2026 sinh lời 8-15%/năm: chọn dự án tiềm năng, pháp lý rõ ràng, dòng tiền ổn định tại TP.HCM, Đồng Nai, Bình Dương. ☎ Nhận tư vấn & báo giá miễn phí từ SGS Land!",
  alternates: { canonical: "https://sgsland.vn/dau-tu-bat-dong-san", languages: { "vi-VN": "https://sgsland.vn/dau-tu-bat-dong-san", "en-US": "https://sgsland.vn/en/dau-tu-bat-dong-san", "x-default": "https://sgsland.vn/dau-tu-bat-dong-san" } },
};
export const dynamic = "force-dynamic";

const INVESTMENT_ZONES = [
  { area: "Long Thành, Đồng Nai", growth: "+32%", reason: "Sân bay quốc tế Long Thành giai đoạn 1 hoàn thành 2026", score: 95 },
  { area: "TP Thủ Đức, TP.HCM", growth: "+18%", reason: "Trung tâm kinh tế - tài chính - công nghệ phía Đông", score: 90 },
  { area: "Cần Giờ, TP.HCM", growth: "+25%", reason: "Quy hoạch siêu đô thị lấn biển 2.870ha, Metro số 4", score: 85 },
  { area: "Nhơn Trạch, Đồng Nai", growth: "+22%", reason: "Cầu Nhơn Trạch, đường vành đai 3 nối TP.HCM", score: 82 },
];

export default function DauTuBDSPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
          style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
          <TrendingUp className="w-3.5 h-3.5" /> Phân tích đầu tư 2025
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Đầu Tư Bất Động Sản</h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>Cơ hội, chiến lược và khu vực tiềm năng nhất 2025</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { icon: TrendingUp, title: "Tăng trưởng bền vững", desc: "BĐS Việt Nam tăng trưởng 8-15%/năm trong 10 năm liên tiếp" },
          { icon: Shield, title: "Tài sản hữu hình", desc: "Sổ hồng, pháp lý rõ ràng — bảo toàn và gia tăng tài sản" },
          { icon: BarChart3, title: "Dòng tiền thụ động", desc: "Cho thuê 4-8%/năm, kết hợp tăng giá trị 10-20%/năm" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-5 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="p-2.5 rounded-xl w-fit mb-3" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Khu Vực Đầu Tư Tiềm Năng 2025</h2>
      <div className="space-y-4 mb-10">
        {INVESTMENT_ZONES.map((zone) => (
          <div key={zone.area} className="p-5 rounded-2xl flex items-center gap-5"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="text-center shrink-0 w-16">
              <p className="text-2xl font-black" style={{ color: "var(--color-success)" }}>{zone.growth}</p>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>tăng giá</p>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary-600)" }} />{zone.area}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{zone.reason}</p>
            </div>
            <div className="shrink-0 text-center">
              <div className="text-lg font-black" style={{ color: "var(--primary-600)" }}>{zone.score}</div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>AI Score</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)" }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--primary-600)" }}>Tư Vấn Đầu Tư Miễn Phí</h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Chuyên gia SGS LAND phân tích danh mục đầu tư phù hợp với ngân sách</p>
        <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: "var(--primary-600)" }}>Đặt lịch tư vấn</Link>
      </div>
    </div>
  );
}
