import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ký Gửi Bất Động Sản | SGS LAND",
  description:
    "Ký gửi BĐS tại SGS LAND — phân phối nhanh, pháp lý bảo đảm, hoa hồng cạnh tranh. 15.000+ môi giới trong mạng lưới. Liên hệ ngay.",
  alternates: { canonical: "https://sgsland.vn/ky-gui-bat-dong-san" },
};

export const revalidate = false;

export default function ConsignmentPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Ký gửi BĐS cùng SGS LAND</h1>
        <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Tiếp cận 15.000+ môi giới chuyên nghiệp và hàng nghìn khách hàng tiềm năng.
          Phân phối nhanh, pháp lý bảo đảm, hoa hồng cạnh tranh nhất thị trường.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
        {[
          { icon: "⚡", title: "Đăng ký trong 5 phút", desc: "Điền form, gửi ảnh và giấy tờ. Chuyên viên liên hệ trong 2 giờ." },
          { icon: "🎯", title: "Phân phối đến 15K+ CTV", desc: "BĐS của bạn được push đến toàn mạng lưới môi giới SGS LAND ngay lập tức." },
          { icon: "✅", title: "Pháp lý 2 lớp", desc: "AI kiểm tra + chuyên viên xác nhận. Bảo vệ quyền lợi người bán tuyệt đối." },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-2xl text-center"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <span className="text-3xl block mb-3">{f.icon}</span>
            <h3 className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-2xl text-center"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Ký gửi BĐS của bạn ngay
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/contact"
            className="px-8 py-4 rounded-2xl text-sm font-bold text-white"
            style={{ background: "var(--primary-600)" }}>
            Đăng ký ký gửi
          </Link>
          <a href="tel:+84971132378"
            className="px-8 py-4 rounded-2xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>
            📞 0971 132 378
          </a>
        </div>
      </div>
    </div>
  );
}
