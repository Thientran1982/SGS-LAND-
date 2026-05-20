import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, RefreshCw, Scale, BookOpen, Users, Mail } from "lucide-react";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Chính Sách Biên Tập | SGS LAND",
  description:
    "Quy trình biên soạn, kiểm chứng thông tin và cập nhật nội dung pháp lý của SGS LAND. Tất cả bài viết được fact-check bởi chuyên gia và cập nhật theo luật hiện hành.",
  alternates: { canonical: `${SITE_URL}/chinh-sach-bien-tap` },
};

export const revalidate = false;

const PROCESS_STEPS = [
  {
    icon: BookOpen,
    title: "Nghiên cứu & Soạn thảo",
    desc: "Tác giả nghiên cứu từ nguồn chính thống: văn bản pháp luật, báo cáo từ Bộ Xây dựng, Bộ TN&MT, và nghiên cứu từ CBRE, Savills, JLL. Bài viết được soạn thảo theo chuẩn E-E-A-T với dẫn chứng cụ thể và số liệu kiểm chứng.",
  },
  {
    icon: ShieldCheck,
    title: "Kiểm chứng thông tin (Fact-check)",
    desc: "Mọi số liệu và khẳng định đều được đối chiếu với ít nhất 2 nguồn độc lập. Bài viết pháp lý được chuyên gia pháp lý SGS Land review riêng — xác nhận tính chính xác theo luật hiện hành trước khi xuất bản.",
  },
  {
    icon: Users,
    title: "Review bởi chuyên gia",
    desc: "Bài viết về pháp lý BĐS bắt buộc qua quy trình review của chuyên gia tư vấn pháp lý. Bài phân tích thị trường được xem xét bởi ít nhất 1 chuyên gia với 5+ năm kinh nghiệm trong lĩnh vực liên quan.",
  },
  {
    icon: RefreshCw,
    title: "Cập nhật định kỳ",
    desc: "Bài viết pháp lý được rà soát mỗi khi có thay đổi về luật hoặc nghị định. Bài phân tích thị trường được cập nhật theo quý. Ngày cập nhật cuối hiển thị rõ ràng trong header bài viết.",
  },
];

const POLICIES = [
  {
    icon: Scale,
    title: "Chính sách pháp lý YMYL",
    items: [
      "Tất cả nội dung pháp lý (mua bán, sổ đỏ, quy hoạch) đều có disclaimer rõ ràng",
      "Bài viết pháp lý ghi rõ 'Cập nhật theo [tên luật], hiệu lực [ngày]'",
      "Không đưa ra tư vấn pháp lý cụ thể thay thế tư vấn chuyên nghiệp",
      "Luôn khuyến nghị người đọc tham khảo luật sư/chuyên gia cho trường hợp cụ thể",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Chính sách nguồn và trích dẫn",
    items: [
      "Mọi bài viết đều có phần 'Nguồn tham khảo' với link trực tiếp",
      "Ưu tiên nguồn chính thống: văn bản pháp luật, cơ quan nhà nước, tổ chức nghiên cứu quốc tế",
      "Phân loại rõ: Official (nhà nước) | Research (nghiên cứu) | News (báo chí) | Legal (pháp lý)",
      "Không sử dụng nguồn ẩn danh hoặc không thể kiểm chứng",
    ],
  },
  {
    icon: Users,
    title: "Chính sách tác giả",
    items: [
      "100% bài viết có byline tác giả thực — không đăng nội dung vô danh",
      "Trang tác giả đầy đủ: kinh nghiệm, chứng chỉ, LinkedIn, danh sách bài viết",
      "Tác giả bên ngoài phải cung cấp thông tin xác thực và chịu trách nhiệm nội dung",
      "Xung đột lợi ích được tiết lộ rõ ràng (ví dụ: bài viết về dự án SGS Land phân phối)",
    ],
  },
];

export default function EditorialPolicyPage() {
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Chính sách biên tập", url: `${SITE_URL}/chinh-sach-bien-tap` },
  ]);

  return (
    <>
      <SchemaScript schemas={[breadcrumb]} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <li><Link href="/" className="hover:underline">Trang chủ</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" style={{ color: "var(--text-secondary)" }}>Chính sách biên tập</li>
          </ol>
        </nav>

        <h1 className="text-4xl font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
          Chính sách biên tập
        </h1>
        <p className="text-lg leading-relaxed mb-10" style={{ color: "var(--text-secondary)" }}>
          SGS LAND cam kết cung cấp thông tin BĐS chính xác, cập nhật và có nguồn gốc rõ ràng —
          đặc biệt quan trọng với nội dung pháp lý thuộc lĩnh vực YMYL (Your Money, Your Life).
        </p>

        {/* E-E-A-T commitment */}
        <section
          className="p-6 rounded-2xl mb-10"
          style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Cam kết E-E-A-T của SGS LAND
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Experience", desc: "Số năm kinh nghiệm thực tế của từng tác giả" },
              { label: "Expertise", desc: "Chuyên môn và chứng chỉ được ghi rõ" },
              { label: "Authority", desc: "Trích dẫn từ nguồn uy tín quốc gia & quốc tế" },
              { label: "Trust", desc: "Disclaimer pháp lý, cập nhật luật, chính sách rõ ràng" },
            ].map(({ label, desc }) => (
              <div key={label}>
                <p className="text-sm font-extrabold mb-1" style={{ color: "var(--primary-600)" }}>{label}</p>
                <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Quy trình biên soạn nội dung
          </h2>
          <div className="space-y-5">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-4">
                  <div className="shrink-0 flex flex-col items-center">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: "var(--primary-600)" }}
                    >
                      {i + 1}
                    </div>
                    {i < PROCESS_STEPS.length - 1 && (
                      <div className="w-0.5 flex-1 mt-2" style={{ background: "var(--border-default)" }} />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color: "var(--primary-600)" }} aria-hidden />
                      <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Policies */}
        <section className="space-y-6 mb-10">
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Các chính sách chi tiết
          </h2>
          {POLICIES.map(({ icon: Icon, title, items }) => (
            <div
              key={title}
              className="p-5 rounded-2xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} aria-hidden />
                <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{title}</h3>
              </div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="text-base shrink-0" style={{ color: "var(--primary-600)" }} aria-hidden>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Update frequency */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Tần suất rà soát và cập nhật
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { type: "Bài viết pháp lý", freq: "Khi có thay đổi luật", icon: "⚖️" },
              { type: "Phân tích thị trường", freq: "Hàng quý (Q1–Q4)", icon: "📊" },
              { type: "So sánh lãi suất", freq: "Hàng tháng", icon: "🏦" },
            ].map(({ type, freq, icon }) => (
              <div key={type} className="p-4 rounded-xl text-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <span className="text-2xl block mb-1">{icon}</span>
                <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>{type}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{freq}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact editorial */}
        <section
          className="flex items-start gap-3 p-5 rounded-2xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        >
          <Mail className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--primary-600)" }} aria-hidden />
          <div>
            <h2 className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>
              Liên hệ ban biên tập
            </h2>
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
              Nếu bạn phát hiện thông tin không chính xác, có đề xuất sửa đổi, hoặc muốn đóng góp
              nội dung cho sgsland.vn, hãy liên hệ:
            </p>
            <a
              href="mailto:editorial@sgsland.vn"
              className="font-semibold text-sm hover:underline"
              style={{ color: "var(--primary-600)" }}
            >
              editorial@sgsland.vn
            </a>
            <span className="text-sm mx-2" style={{ color: "var(--text-tertiary)" }}>hoặc</span>
            <Link href="/contact" className="font-semibold text-sm hover:underline"
              style={{ color: "var(--primary-600)" }}>
              trang liên hệ
            </Link>
          </div>
        </section>

        <p className="text-xs mt-6 text-center" style={{ color: "var(--text-tertiary)" }}>
          Chính sách này được cập nhật lần cuối tháng 05/2025. Phiên bản hiện tại áp dụng cho tất cả
          nội dung xuất bản từ 01/01/2025.
        </p>
      </div>
    </>
  );
}
