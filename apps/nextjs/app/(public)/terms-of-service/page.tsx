// @ts-nocheck
import type { Metadata } from "next";
import { getLang, langAlternates } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/terms-of-service" : "/terms-of-service"}`;
  return { title: en ? "Terms of Service" : "Điều Khoản Sử Dụng", alternates: { canonical, ...langAlternates("/terms-of-service") } };
}
export const dynamic = "force-dynamic";
export default async function TermsPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">{en ? "Terms of Service" : "Điều Khoản Sử Dụng"}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{en ? "Last updated: 01/01/2025" : "Cập nhật lần cuối: 01/01/2025"}</p>
      <p style={{ color: "var(--text-secondary)" }}>{en
        ? "By using the SGS LAND platform, you agree to these terms. The platform provides information and reference tools; SGS LAND is not a party to every transaction. Prices, legal status, inventory and distribution authority must be confirmed using current documents."
        : "Bằng cách sử dụng nền tảng SGS LAND, bạn đồng ý với các điều khoản này. Nền tảng cung cấp thông tin và công cụ tham khảo; SGS LAND không phải là bên của mọi giao dịch. Giá, pháp lý, quỹ hàng và tư cách phân phối phải được xác nhận bằng tài liệu hiện hành."}</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>{en ? "Contact: " : "Liên hệ: "} <a href="mailto:legal@sgsland.vn" style={{ color: "var(--primary-600)" }}>legal@sgsland.vn</a></p>
    </div>
  );
}
