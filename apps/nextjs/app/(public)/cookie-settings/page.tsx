// @ts-nocheck
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Cookie Settings | SGS LAND", alternates: { canonical: "https://sgsland.vn/cookie-settings" } };
export const dynamic = "force-dynamic";
export default function CookieSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">Cài Đặt Cookie</h1>
      <p style={{ color: "var(--text-secondary)" }}>SGS LAND sử dụng cookie để cải thiện trải nghiệm người dùng. Bạn có thể tùy chỉnh các loại cookie được sử dụng tại đây.</p>
      <div className="mt-8 space-y-4">
        {["Cookie thiết yếu (bắt buộc)", "Cookie hiệu suất", "Cookie phân tích", "Cookie marketing"].map((c, i) => (
          <div key={c} className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c}</span>
            <div className={`w-10 h-5 rounded-full transition-colors ${i === 0 ? "bg-sgs-primary" : "bg-gray-300"}`}>
              <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${i === 0 ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
