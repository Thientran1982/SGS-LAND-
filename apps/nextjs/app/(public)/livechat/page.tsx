// @ts-nocheck
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Chat AI BĐS",
  description: "Chat trực tiếp với AI Agent SGS LAND: hỏi về giá BĐS, pháp lý, dự án, lãi suất vay. Phản hồi tức thì 24/7.",
  alternates: { canonical: "https://sgsland.vn/livechat" },
};
export const dynamic = "force-dynamic";

export default function LiveChatPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-3xl"
          style={{ background: "var(--primary-subtle)" }}>
          💬
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>AI Chat BĐS 24/7</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Hỏi bất kỳ điều gì về thị trường BĐS — giá, pháp lý, dự án, lãi suất ngân hàng
        </p>
      </div>

      <div className="p-6 rounded-2xl mb-8" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Widget chat AI đang tải... Nếu không thấy, click vào icon chat ở góc dưới phải màn hình.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {["Giá căn hộ Thủ Đức?", "Aqua City pháp lý thế nào?", "Cosmo MCC còn căn nào?", "Lãi suất vay mua nhà hiện tại?"].map((q) => (
            <span key={q} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: "var(--primary-subtle)", color: "var(--primary-600)", border: "1px solid var(--primary-600)" }}>
              {q}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Hotline hỗ trợ: <a href="tel:0971132378" className="font-semibold" style={{ color: "var(--primary-600)" }}>0971 132 378</a>
      </p>
    </div>
  );
}
