// @ts-nocheck
import type { Metadata } from "next";
import { ContactForm } from "@/components/public/ContactForm";

export const metadata: Metadata = {
  title: "Liên Hệ",
  description:
    "Liên hệ SGS LAND — Hotline: 0971 132 378 | Email: info@sgsland.vn | TP. Hồ Chí Minh. Tư vấn BĐS, CRM, định giá AI miễn phí.",
  alternates: { canonical: "https://sgsland.vn/contact" },
};

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Liên hệ với chúng tôi
        </h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          Đội ngũ tư vấn luôn sẵn sàng hỗ trợ bạn
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-6">
          {[
            { icon: "📞", label: "Hotline", value: "0971 132 378", href: "tel:+84971132378" },
            { icon: "✉️", label: "Email", value: "info@sgsland.vn", href: "mailto:info@sgsland.vn" },
            { icon: "📍", label: "Địa chỉ", value: "TP. Hồ Chí Minh, Việt Nam" },
            { icon: "🔗", label: "LinkedIn", value: "linkedin.com/company/sgsland", href: "https://www.linkedin.com/company/sgsland" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-4 p-5 rounded-2xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <span className="text-2xl">{c.icon}</span>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--text-tertiary)" }}>{c.label}</p>
                {c.href ? (
                  <a href={c.href} className="text-sm font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: "var(--primary-600)" }}>
                    {c.value}
                  </a>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <ContactForm />
      </div>
    </div>
  );
}
