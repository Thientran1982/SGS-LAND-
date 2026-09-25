// @ts-nocheck
import type { Metadata } from "next";
import { Phone, Mail, MapPin, Linkedin } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { getLang, langAlternates } from "@/lib/lang";
import { normalizeMetaDescription } from "@/lib/seo/meta-utils";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/contact" : "/contact"}`;
  return {
    title: { absolute: en ? "Contact SGS LAND | Property & AI Support" : "Liên Hệ SGS LAND | Tư Vấn BĐS & Định Giá AI" },
    description: normalizeMetaDescription(en
      ? "Contact SGS LAND — Hotline: 0379 281 445, email info@sgsland.vn and Ho Chi Minh City support for property, CRM and AI-assisted valuation."
      : "Liên hệ SGS LAND — Hotline 0379 281 445, email info@sgsland.vn và đội ngũ TP.HCM hỗ trợ BĐS, CRM, định giá có AI.",
      en ? " Verify current property and service information with our team before making a decision." : " Xác minh thông tin BĐS và dịch vụ với đội ngũ trước khi quyết định giao dịch."),
    alternates: { canonical, ...langAlternates("/contact") },
    openGraph: {
      type: "website",
      title: en ? "Contact SGS LAND | Property & AI Support" : "Liên Hệ SGS LAND | Tư Vấn BĐS & Định Giá AI",
      description: en
        ? "Reach SGS LAND for property, CRM and AI valuation support."
        : "Liên hệ SGS LAND để được hỗ trợ BĐS, CRM và định giá AI.",
      url: canonical,
      images: [{ url: "https://sgsland.vn/og-image.jpg", width: 1200, height: 630, alt: "Contact SGS LAND" }],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const en = (await getLang()) === "en";
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          {en ? "Contact us" : "Liên hệ với chúng tôi"}
        </h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          {en ? "Our team is ready to help." : "Đội ngũ tư vấn luôn sẵn sàng hỗ trợ bạn"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-10" aria-label={en ? "SGS LAND service facts" : "Thông tin dịch vụ SGS LAND"}>
        {[
          { value: "24/7", label: en ? "AI chat support" : "Hỗ trợ AI" },
          { value: "3 giây", label: en ? "Reference valuation" : "Định giá tham khảo" },
          { value: "0 đ", label: en ? "Fee for buyers" : "Phí cho người mua" },
        ].map((fact) => (
          <div key={fact.value} className="rounded-2xl p-4 text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}>
            <strong className="block text-lg sm:text-xl" style={{ color: "var(--primary-600)" }}>{fact.value}</strong>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{fact.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-6">
          {[
            { icon: Phone, label: "Hotline", value: "0379 281 445", href: "tel:+84379281445" },
            { icon: Mail, label: "Email", value: "info@sgsland.vn", href: "mailto:info@sgsland.vn" },
            { icon: MapPin, label: en ? "Location" : "Địa chỉ", value: en ? "Ho Chi Minh City, Vietnam" : "TP. Hồ Chí Minh, Việt Nam" },
            { icon: Linkedin, label: "LinkedIn", value: "linkedin.com/company/sgsland", href: "https://www.linkedin.com/company/sgsland" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-4 p-5 rounded-2xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <span className="text-2xl"><c.icon className="w-6 h-6" style={{ color: "var(--primary-600)" }} /></span>
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
