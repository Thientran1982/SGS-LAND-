import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Định Giá BĐS Bằng AI | SGS-AVM v2.1 | SGS LAND",
  description:
    "Định giá bất động sản tự động bằng AI SGS-AVM v2.1 — sai số ±5%, 9 hệ số định giá, chuẩn TĐGVN/IVS. Kết quả tức thì, hoàn toàn miễn phí.",
  keywords: ["định giá bất động sản AI", "định giá nhà tự động", "AVM bất động sản Việt Nam"],
  alternates: { canonical: "https://sgsland.vn/ai-valuation" },
};

export const revalidate = false;

export default function AiValuationPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      {/* Hero */}
      <div className="text-center mb-16">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6"
          style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}
        >
          ✨ SGS-AVM v2.1 — Sai số ±5%
        </div>
        <h1 className="text-4xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          Định giá BĐS bằng AI
          <br />
          <span style={{ color: "var(--primary-600)" }}>tự động, chính xác, tức thì</span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Hệ thống AI SGS-AVM phân tích 9 hệ số để định giá bất động sản trong vài giây.
          Tuân thủ chuẩn TĐGVN/IVS và Luật Định Giá Việt Nam 2023.
        </p>
      </div>

      {/* AVM Features */}
      <h2 className="text-xl font-bold text-center mb-6" style={{ color: "var(--text-primary)" }}>
        Tại Sao Chọn Định Giá AI SGS LAND?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
        {[
          {
            icon: "📊",
            title: "9 hệ số định giá",
            desc: "Vị trí, diện tích, pháp lý, tầng, view, nội thất, tiện ích, thanh khoản, hạ tầng",
          },
          {
            icon: "🎯",
            title: "Sai số ±5%",
            desc: "Sai số trung bình tuyệt đối được kiểm định trên 10.000+ giao dịch thực tế Đông Nam Bộ",
          },
          {
            icon: "⚡",
            title: "Kết quả tức thì",
            desc: "Định giá trong 3 giây — không cần đặt lịch, không cần chờ đợi. 100% tự động.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="p-5 rounded-2xl text-center"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
          >
            <span className="text-3xl block mb-3">{f.icon}</span>
            <h3 className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Process */}
      <h2 className="text-xl font-bold text-center mb-6" style={{ color: "var(--text-primary)" }}>
        Quy Trình Định Giá AI 4 Bước
      </h2>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {[
          { step: "1", name: "Nhập thông tin BĐS", desc: "Địa chỉ, diện tích, số phòng, loại hình" },
          {
            step: "2",
            name: "AI phân tích dữ liệu",
            desc: "45.000+ giao dịch thực, dữ liệu CBRE/Savills Q2/2026",
          },
          {
            step: "3",
            name: "Nhận kết quả tức thì",
            desc: "Khoảng giá thấp/trung bình/cao, sai số ±5%",
          },
          {
            step: "4",
            name: "Tư vấn chuyên gia 1-1",
            desc: "Đặt lịch miễn phí qua hotline hoặc form",
          },
        ].map((s) => (
          <li
            key={s.step}
            className="flex items-start gap-4 p-4 rounded-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
          >
            <span
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: "var(--primary-600)" }}
            >
              {s.step}
            </span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {s.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {s.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* CTA */}
      <div
        className="text-center p-8 rounded-2xl"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}
      >
        <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Định giá BĐS của bạn ngay
        </h2>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          Miễn phí • Tức thì • Không cần đăng ký
        </p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "var(--primary-600)" }}
        >
          ✨ Dùng định giá AI miễn phí
        </a>
      </div>
    </div>
  );
}
