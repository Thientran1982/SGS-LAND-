// @ts-nocheck
import Link from "next/link";
import { MapPin, Building2, ArrowRight } from "lucide-react";
import { SchemaScript } from "@/components/SchemaScript";
import { getFAQSchema, getBreadcrumbSchema } from "@/lib/schema";
import type { FAQItem } from "@/lib/schema";
import { getLang } from "@/lib/lang";
interface Props {
  area: string;
  areaSlug: string;
  districts: string[];
  projects: string[];
  priceRange: string;
  totalListings: number;
  description: string;
  intro?: { heading: string; body: string }[];
  subAreas?: { label: string; href: string }[];
  faqs?: FAQItem[];
}
// Server Component — pure SSG
export async function LocalLandingPageTemplate({ area, areaSlug, districts, projects, priceRange, totalListings, description, intro, subAreas, faqs }: Props) {
  const en = (await getLang()) === "en";
  const lp = (p: string) => (en ? "/en" + p : p);
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      {/* Hero */}
      <div className="mb-12">
        <nav className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
          <Link href={lp("/")} className="hover:opacity-80">{en ? "Home" : "Trang chủ"}</Link>
          <span>/</span>
          <span>{en ? `${area} property` : `Bất động sản ${area}`}</span>
        </nav>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          {en ? `${area} Property 2026` : `Bất Động Sản ${area} 2026`}
        </h1>
        <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      {/* Intro content sections (SEO/AEO) */}
        {intro && intro.length > 0 && (
          <div className="mb-12 space-y-6">
            {intro.map((sec) => (
              <section key={sec.heading}>
                <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{sec.heading}</h2>
                <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{sec.body}</p>
              </section>
            ))}
          </div>
        )}
        {/* Sub-area internal links (satellite cluster) */}
        {subAreas && subAreas.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{en ? "Key areas & projects" : "Khu vực & dự án nổi bật"}</h2>
            <div className="flex flex-wrap gap-3">
              {subAreas.map((sa) => (
                <Link key={sa.href} href={sa.href} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{sa.label}</Link>
              ))}
            </div>
          </div>
        )}
        {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          { label: en ? "Listings" : "Sản phẩm", value: `${totalListings.toLocaleString()}+` },
          { label: en ? "Districts" : "Quận/Huyện", value: `${districts.length}` },
          { label: en ? "Major projects" : "Dự án lớn", value: `${projects.length}+` },
          { label: en ? "From" : "Giá từ", value: priceRange.split("—")[0].trim() },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl text-center"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
          </div>
        ))}
      </div>
      {/* Districts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          {en ? "Search by district" : "Tìm theo khu vực"}
        </h2>
        <div className="flex flex-wrap gap-3">
          {districts.map((d) => (
            <Link
              key={d}
              href={`/marketplace?area=${encodeURIComponent(d)}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-token-md hover:-translate-y-0.5"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--primary-600)" }} />
              {d}
            </Link>
          ))}
        </div>
      </section>
      {/* Projects */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          {en ? `Featured projects in ${area}` : `Dự án nổi bật tại ${area}`}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((proj) => (
            <div key={proj} className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--primary-subtle)" }}>
                <Building2 className="w-5 h-5" style={{ color: "var(--primary-600)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{proj}</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{en ? "SGS LAND — authorised agent" : "SGS LAND — đại lý uỷ quyền"}</p>
              </div>
              <Link href={lp(`/marketplace?q=${encodeURIComponent(proj)}`)}
                className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-app)] transition-colors">
                <ArrowRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              </Link>
            </div>
          ))}
        </div>
      </section>
      {/* FAQ section (AEO) */}
        {faqs && faqs.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>{en ? `Frequently asked questions about ${area} property` : `Câu hỏi thường gặp về bất động sản ${area}`}</h2>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                  <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{f.question}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* JSON-LD structured data (SSR) */}
        <SchemaScript schemas={[
          getBreadcrumbSchema([{ name: en ? `${area} property` : `Bất động sản ${area}`, url: en ? `https://sgsland.vn/en/${areaSlug}` : `https://sgsland.vn/${areaSlug}` }]),
          ...(faqs && faqs.length > 0 ? [getFAQSchema(faqs, `https://sgsland.vn/${areaSlug}`)] : []),
        ]} />
        {/* CTA */}
      <div className="p-8 rounded-2xl text-center"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          {en ? `Browse ${totalListings.toLocaleString()}+ properties in ${area}` : `Xem ${totalListings.toLocaleString()}+ BĐS tại ${area}`}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {en ? `Priced ${priceRange} · Clear pink-book title · Updated continuously` : `Giá ${priceRange} · Pháp lý sổ hồng rõ ràng · Cập nhật liên tục`}
        </p>
        <Link href={lp(`/marketplace?area=${encodeURIComponent(area)}`)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--primary-600)" }}>
          {en ? `View all ${area} listings` : `Xem tất cả BĐS ${area}`}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}