import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Về Chúng Tôi | SGS LAND",
  description:
    "SGS LAND — Công ty Cổ phần SGS Land. Đại lý phân phối BĐS uỷ quyền chính thức của Novaland, Masterise Homes, Nam Long, Vinhomes tại Đông Nam Bộ. Thành lập 2024.",
  alternates: { canonical: "https://sgsland.vn/about-us" },
};

export const revalidate = false; // Static — pure SSG

export default function AboutUsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <h1 className="text-4xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Về SGS LAND
      </h1>
      <p className="text-lg mb-8 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <strong>SGS LAND</strong> (Công ty Cổ phần SGS Land) là nền tảng quản lý &amp; phân phối bất
        động sản AI thế hệ mới, thành lập năm 2024 tại TP. Hồ Chí Minh, Việt Nam.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-16">
        {[
          { value: "5+ năm", label: "Kinh nghiệm đội ngũ sáng lập" },
          { value: "15.000+", label: "Môi giới trong mạng lưới" },
          { value: "45.000+", label: "Sản phẩm BĐS quản lý" },
          { value: "2 tỷ USD+", label: "Giá trị giao dịch xử lý" },
        ].map((s) => (
          <div key={s.label} className="text-center p-4 rounded-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-2xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Đối tác uỷ quyền</h2>
        <div className="flex flex-wrap gap-3">
          {["Novaland", "Masterise Homes", "Nam Long Group", "Vinhomes", "Sơn Kim Land", "Đại Quang Minh", "Khang Điền"].map((p) => (
            <span key={p} className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              {p}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Đội ngũ sáng lập</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { name: "Trần Minh Thiện", role: "Founder & CEO" },
            { name: "Nguyễn Hoàng Nam", role: "Chief Technology Officer" },
            { name: "Lê Thị Hoa", role: "Chief Operating Officer" },
          ].map((m) => (
            <div key={m.name} className="p-5 rounded-2xl text-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: "var(--primary-600)" }}>
                {m.name.charAt(0)}
              </div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{m.name}</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Giải thưởng &amp; chứng nhận</h2>
        <ul className="space-y-3">
          {[
            "Top Proptech Việt Nam 2025",
            "Đại lý phân phối uỷ quyền Novaland, Masterise Homes, Nam Long, Vinhomes",
            "Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân",
            "Định giá theo chuẩn TĐGVN/IVS, Luật Đất Đai 2024, Luật KDBĐS 2023",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm"
              style={{ color: "var(--text-secondary)" }}>
              <span className="mt-0.5 text-base" style={{ color: "var(--primary-600)" }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
