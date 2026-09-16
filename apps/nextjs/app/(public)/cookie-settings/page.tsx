// @ts-nocheck
import type { Metadata } from "next";
import CookieSettingsClient from "@/components/CookieSettingsClient";
import { getLang, langAlternates } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Cookie Settings" : "Cài Đặt Cookie",
    alternates: { canonical: `https://sgsland.vn${en ? "/en/cookie-settings" : "/cookie-settings"}`, ...langAlternates("/cookie-settings") },
  };
}
export const dynamic = "force-dynamic";
export default async function CookieSettingsPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">{en ? "Cookie Settings" : "Cài Đặt Cookie"}</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        {en
          ? "SGS LAND uses cookies to improve your experience. You can customise the types of cookies used here. Changes apply immediately and are saved for your next visit."
          : "SGS LAND sử dụng cookie để cải thiện trải nghiệm người dùng. Bạn có thể tuỳ chỉnh các loại cookie được sử dụng tại đây. Thay đổi sẽ được áp dụng ngay và lưu lại cho lần truy cập sau."}
      </p>
      <CookieSettingsClient />
    </div>
  );
}
