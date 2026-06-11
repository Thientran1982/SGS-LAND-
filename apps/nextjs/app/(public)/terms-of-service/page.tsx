// @ts-nocheck
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Điều Khoản Sử Dụng | SGS LAND", alternates: { canonical: "https://sgsland.vn/terms-of-service" } };
export const dynamic = "force-dynamic";
export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">Điều Khoản Sử Dụng</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Cập nhật lần cuối: 01/01/2025</p>
      <p style={{ color: "var(--text-secondary)" }}>Bằng cách sử dụng nền tảng SGS LAND, bạn đồng ý với các điều khoản này. Dịch vụ được cung cấp "as-is" và SGS LAND có quyền cập nhật điều khoản khi cần thiết.</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Liên hệ: <a href="mailto:legal@sgsland.vn" style={{ color: "var(--primary-600)" }}>legal@sgsland.vn</a></p>
    </div>
  );
}
