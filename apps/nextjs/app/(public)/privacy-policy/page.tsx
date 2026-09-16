// @ts-nocheck
import type { Metadata } from "next";
import { getLang, langAlternates } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/privacy-policy" : "/privacy-policy"}`;
  return { title: en ? "Privacy Policy" : "Chính Sách Bảo Mật", alternates: { canonical, ...langAlternates("/privacy-policy") } };
}
export const dynamic = "force-dynamic";
export default async function PrivacyPolicyPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 prose prose-sm" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">{en ? "Privacy Policy" : "Chính Sách Bảo Mật"}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{en ? "Last updated: 01/01/2025" : "Cập nhật lần cuối: 01/01/2025"}</p>
      <p style={{ color: "var(--text-secondary)" }}>{en
        ? "SGS LAND is committed to protecting personal data in accordance with Vietnam’s Decree 13/2023/ND-CP on personal data protection."
        : "SGS LAND cam kết bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân của Việt Nam."}</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>{en
        ? "We collect and use data for the purposes, legal bases, retention periods and data-subject rights described in this policy. We do not sell personal data. Security controls may vary by service and should not be understood as an absolute guarantee."
        : "Chúng tôi thu thập và sử dụng dữ liệu theo mục đích, cơ sở pháp lý, thời hạn lưu giữ và quyền của chủ thể dữ liệu được nêu trong chính sách này. Chúng tôi không bán dữ liệu cá nhân. Biện pháp bảo mật có thể khác nhau theo từng dịch vụ và không nên được hiểu là một cam kết tuyệt đối."}</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>{en ? "Contact: " : "Liên hệ: "} <a href="mailto:privacy@sgsland.vn" style={{ color: "var(--primary-600)" }}>privacy@sgsland.vn</a></p>
    </div>
  );
}
