// @ts-nocheck
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Chính Sách Bảo Mật", alternates: { canonical: "https://sgsland.vn/privacy-policy", languages: { "vi-VN": "https://sgsland.vn/privacy-policy", "en-US": "https://sgsland.vn/en/privacy-policy", "x-default": "https://sgsland.vn/privacy-policy" } } };
export const dynamic = "force-dynamic";
export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 prose prose-sm" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">Chính Sách Bảo Mật</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Cập nhật lần cuối: 01/01/2025</p>
      <p style={{ color: "var(--text-secondary)" }}>SGS LAND cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân của Việt Nam.</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Chúng tôi chỉ thu thập thông tin cần thiết để cung cấp dịch vụ, không bán dữ liệu cho bên thứ ba và áp dụng mã hoá TLS 1.3 cho toàn bộ kết nối.</p>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Liên hệ: <a href="mailto:privacy@sgsland.vn" style={{ color: "var(--primary-600)" }}>privacy@sgsland.vn</a></p>
    </div>
  );
}
