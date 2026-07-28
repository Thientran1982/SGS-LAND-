// @ts-nocheck
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/schema";
import { CodeBlock } from "./CodeBlock";

export const metadata: Metadata = {
  title: "Tài Liệu API cho Nhà Phát Triển | SGS LAND",
  description:
    "Tài liệu API SGS LAND: xác thực bằng API key, endpoint quản lý khách hàng tiềm năng (leads), ví dụ request/response. Hướng dẫn tích hợp cho nhà phát triển.",
  alternates: { canonical: `${SITE_URL}/developers` },
};
export const dynamic = "force-dynamic";

const NAV = [
  { id: "intro", label: "Giới thiệu" },
  { id: "auth", label: "Xác thực" },
  { id: "endpoints", label: "Endpoint" },
];

export default function DevelopersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex gap-10">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 hidden md:block">
        <div className="sticky top-24">
          <h3 className="font-bold text-xs uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
            Mục Lục
          </h3>
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 max-w-3xl">
        <section id="intro" className="mb-14">
          <h1 className="text-4xl font-black mb-4" style={{ color: "var(--text-primary)" }}>
            Tài Liệu API SGS Land
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Tích hợp dữ liệu bất động sản, khách hàng tiềm năng và định giá của SGS Land vào hệ thống của bạn qua REST API. Mọi phản hồi đều ở định dạng JSON.
          </p>
        </section>

        <section id="auth" className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Xác thực</h2>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            SGS Land API sử dụng API key để xác thực yêu cầu. Bạn có thể xem và quản lý key trong phần Cài đặt Doanh nghiệp. Gửi key qua header Authorization theo dạng Bearer token.
          </p>
          <CodeBlock code={`Authorization: Bearer sgs_live_...`} language="http" />
        </section>

        <section id="endpoints" className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Endpoint Khách Hàng</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              GET
            </span>
            <code className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>/v1/leads</code>
          </div>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Trả về danh sách khách hàng tiềm năng (leads) liên kết với tài khoản của bạn.
          </p>
          <CodeBlock
            code={`curl https://api.sgs.vn/v1/leads \
  -H "Authorization: Bearer sgs_live_..." \
  -H "Content-Type: application/json"`}
          />
          <h3 className="font-bold mt-6 mb-2" style={{ color: "var(--text-primary)" }}>Phản hồi mẫu</h3>
          <CodeBlock
            language="json"
            code={`{
  "data": [
    {
      "id": "lead_123",
      "name": "Nguyen Van A",
      "status": "NEW",
      "score": 85
    }
  ],
  "meta": {
    "total": 1,
    "page": 1
  }
}`}
          />
        </section>
      </div>
    </div>
  );
}
