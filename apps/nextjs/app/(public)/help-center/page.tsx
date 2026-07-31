// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, MessageSquare, Phone, Mail, BookOpen, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Trung Tâm Trợ Giúp",
  description: "Hỗ trợ khách hàng SGS LAND: hướng dẫn sử dụng nền tảng, tư vấn BĐS, giải đáp thắc mắc. Liên hệ qua hotline, chat hoặc email.",
  alternates: { canonical: "https://sgsland.vn/help-center", languages: { "vi-VN": "https://sgsland.vn/help-center", "en-US": "https://sgsland.vn/en/help-center", "x-default": "https://sgsland.vn/help-center" } },
};
export const dynamic = "force-dynamic";

const TOPICS = [
  { icon: BookOpen, title: "Hướng dẫn tìm kiếm BĐS", desc: "Cách lọc, so sánh và lưu tin BĐS yêu thích", href: "/marketplace" },
  { icon: HelpCircle, title: "Định giá AI", desc: "Cách sử dụng công cụ định giá tự động", href: "/ai-valuation" },
  { icon: MessageSquare, title: "Chat với AI Agent", desc: "Hỏi về giá, pháp lý, dự án bất kỳ lúc nào", href: "/livechat" },
  { icon: BookOpen, title: "Ký gửi bất động sản", desc: "Quy trình ký gửi và phí dịch vụ", href: "/ky-gui-bat-dong-san" },
];

export default function HelpCenterPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Trung Tâm Trợ Giúp</h1>
        <p style={{ color: "var(--text-secondary)" }}>Chúng tôi luôn sẵn sàng hỗ trợ bạn</p>
      </div>

      {/* Contact options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { icon: Phone, label: "Hotline", value: "0971 132 378", desc: "Thứ 2 – Chủ nhật, 8:00 – 20:00", href: "tel:0971132378" },
          { icon: MessageSquare, label: "Live Chat", value: "Chat ngay", desc: "AI Agent 24/7, phản hồi tức thì", href: "/livechat" },
          { icon: Mail, label: "Email", value: "info@sgsland.vn", desc: "Phản hồi trong 2 giờ làm việc", href: "mailto:info@sgsland.vn" },
        ].map(({ icon: Icon, label, value, desc, href }) => (
          <a key={label} href={href}
            className="p-5 rounded-2xl flex flex-col items-center text-center gap-2 hover:scale-[1.02] transition-transform"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="p-3 rounded-2xl" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              <Icon className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</p>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</p>
          </a>
        ))}
      </div>

      {/* Topics */}
      <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>Chủ Đề Phổ Biến</h2>
      <div className="space-y-3 mb-10">
        {TOPICS.map(({ icon: Icon, title, desc, href }) => (
          <Link key={title} href={href}
            className="flex items-center gap-4 p-4 rounded-2xl hover:scale-[1.01] transition-transform group"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </Link>
        ))}
      </div>

      <div className="p-6 rounded-2xl text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--primary-600)" }}>Không tìm thấy câu trả lời?</p>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Đội ngũ tư vấn SGS LAND sẵn sàng hỗ trợ bạn trực tiếp</p>
        <Link href="/contact" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--primary-600)" }}>Liên hệ ngay</Link>
      </div>
    </div>
  );
}
