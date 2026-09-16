// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, MessageSquare, Phone, Mail, BookOpen, ChevronRight } from "lucide-react";
import { getLang, langAlternates } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/help-center" : "/help-center"}`;
  return {
    title: en ? "Help Center" : "Trung Tâm Trợ Giúp",
    description: en
      ? "SGS LAND support: platform guidance, property assistance and answers to common questions. Contact us by phone, chat or email."
      : "Hỗ trợ khách hàng SGS LAND: hướng dẫn sử dụng nền tảng, tư vấn BĐS, giải đáp thắc mắc. Liên hệ qua hotline, chat hoặc email.",
    alternates: { canonical, ...langAlternates("/help-center") },
  };
}
export const dynamic = "force-dynamic";

const TOPICS = [
  { icon: BookOpen, vi: "Hướng dẫn tìm kiếm BĐS", en: "Property search guide", viDesc: "Cách lọc, so sánh và lưu tin BĐS yêu thích", enDesc: "How to filter, compare and save property listings", href: "/marketplace" },
  { icon: HelpCircle, vi: "Định giá AI", en: "AI-assisted valuation", viDesc: "Cách sử dụng công cụ định giá tự động", enDesc: "How to use the AI-assisted valuation tool", href: "/ai-valuation" },
  { icon: MessageSquare, vi: "Chat với AI Agent", en: "Chat with our AI agent", viDesc: "Hỏi về giá, pháp lý, dự án bất kỳ lúc nào", enDesc: "Ask about prices, legal information or projects", href: "/livechat" },
  { icon: BookOpen, vi: "Ký gửi bất động sản", en: "Property consignment", viDesc: "Quy trình ký gửi và phí dịch vụ", enDesc: "Consignment process and service fees", href: "/ky-gui-bat-dong-san" },
];

export default async function HelpCenterPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{en ? "Help Center" : "Trung Tâm Trợ Giúp"}</h1>
        <p style={{ color: "var(--text-secondary)" }}>{en ? "We are here to help." : "Chúng tôi luôn sẵn sàng hỗ trợ bạn"}</p>
      </div>

      {/* Contact options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { icon: Phone, label: "Hotline", value: "0379 281 445", desc: en ? "Monday – Sunday, 8:00 – 20:00" : "Thứ 2 – Chủ nhật, 8:00 – 20:00", href: "tel:0379281445" },
          { icon: MessageSquare, label: "Live Chat", value: en ? "Chat now" : "Chat ngay", desc: en ? "AI agent 24/7, instant responses" : "AI Agent 24/7, phản hồi tức thì", href: "/livechat" },
          { icon: Mail, label: "Email", value: "info@sgsland.vn", desc: en ? "Replies within two business hours" : "Phản hồi trong 2 giờ làm việc", href: "mailto:info@sgsland.vn" },
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
      <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>{en ? "Popular topics" : "Chủ Đề Phổ Biến"}</h2>
      <div className="space-y-3 mb-10">
        {TOPICS.map(({ icon: Icon, vi, en: enTitle, viDesc, enDesc, href }) => (
          <Link key={vi} href={en ? `/en${href}` : href}
            className="flex items-center gap-4 p-4 rounded-2xl hover:scale-[1.01] transition-transform group"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>{en ? enTitle : vi}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{en ? enDesc : viDesc}</p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </Link>
        ))}
      </div>

      <div className="p-6 rounded-2xl text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)" }}>
         <p className="font-semibold mb-1" style={{ color: "var(--primary-600)" }}>{en ? "Still need help?" : "Không tìm thấy câu trả lời?"}</p>
         <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{en ? "The SGS LAND team is ready to assist you directly." : "Đội ngũ tư vấn SGS LAND sẵn sàng hỗ trợ bạn trực tiếp"}</p>
         <Link href={en ? "/en/contact" : "/contact"} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
           style={{ background: "var(--primary-600)" }}>{en ? "Contact us" : "Liên hệ ngay"}</Link>
      </div>
    </div>
  );
}
