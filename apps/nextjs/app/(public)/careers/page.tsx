// @ts-nocheck
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tuyển Dụng",
  description:
    "Cơ hội nghề nghiệp tại SGS LAND — Môi giới BĐS, Kỹ sư phần mềm, Product Manager, Data Analyst. Startup proptech hàng đầu Việt Nam.",
  alternates: { canonical: "https://sgsland.vn/careers" },
};

export const dynamic = "force-dynamic";

const JOBS = [
  { title: "Senior Môi Giới BĐS", dept: "Sales", location: "TP.HCM", type: "Full-time", desc: "Tư vấn và phân phối BĐS cao cấp tại khu vực Đông Nam Bộ. Thu nhập không giới hạn." },
  { title: "Full-Stack Engineer (Next.js / Node.js)", dept: "Engineering", location: "Remote", type: "Full-time", desc: "Xây dựng nền tảng PropTech AI quy mô lớn với Next.js 15, PostgreSQL, Redis." },
  { title: "AI/ML Engineer", dept: "Engineering", location: "TP.HCM / Remote", type: "Full-time", desc: "Phát triển mô hình định giá AVM, intent classifier, recommendation engine cho BĐS." },
  { title: "Product Manager - CRM", dept: "Product", location: "TP.HCM", type: "Full-time", desc: "Quản lý roadmap sản phẩm CRM cho 15.000+ môi giới. Data-driven, user-centric." },
  { title: "Data Analyst", dept: "Analytics", location: "TP.HCM", type: "Full-time", desc: "Phân tích thị trường BĐS Đông Nam Bộ, xây dựng báo cáo chỉ số giá tuần, quý." },
  { title: "Marketing Manager", dept: "Marketing", location: "TP.HCM", type: "Full-time", desc: "Xây dựng thương hiệu SGS LAND, performance marketing, SEO/content cho PropTech." },
];

export default function CareersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Cùng xây dựng PropTech #1 Việt Nam
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          Chúng tôi đang tìm kiếm những người tài năng, đam mê công nghệ và bất động sản để cùng
          tạo ra nền tảng PropTech thay đổi ngành BĐS Việt Nam.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {JOBS.map((job) => (
          <div key={job.title} className="p-6 rounded-2xl hover:shadow-token-md transition-all"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-bold text-base leading-tight" style={{ color: "var(--text-primary)" }}>
                {job.title}
              </h3>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                {job.type}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>🏢 {job.dept}</span>
              <span>📍 {job.location}</span>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {job.desc}
            </p>
            <a href={`mailto:info@sgsland.vn?subject=Ứng tuyển: ${job.title}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "var(--primary-600)" }}>
              Ứng tuyển ngay
            </a>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-2xl text-center"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Không thấy vị trí phù hợp?
        </p>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Gửi CV của bạn đến chúng tôi — chúng tôi luôn tìm kiếm nhân tài xuất sắc!
        </p>
        <a href="mailto:careers@sgsland.vn"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--primary-600)" }}>
          ✉️ careers@sgsland.vn
        </a>
      </div>
    </div>
  );
}
