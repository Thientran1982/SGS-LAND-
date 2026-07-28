// @ts-nocheck
"use client";
import Link from "next/link";
import { MapPin, Phone, ArrowRight, Building2 } from "lucide-react";

interface ProjectDetail {
  name: string;
  developer?: string;
  location?: string;
  description?: string;
  total_units?: number;
  status?: string;
  handover_year?: string;
  // price_range can be string ("từ 6 tỷ") or object from backend
  price_range?: { min: number; max: number; unit: string } | string;
  legal_status?: string;
  property_types?: string[];
  investment_score?: number;
}
// Rich editorial content from data/projects.ts (PROJECT_CONFIG).
// Optional: area/investment landing slugs have no config → sections below simply don't render.
interface ProjectConfig {
  heroDescription?: string;
  details?: { label: string; value: string }[];
  amenities?: { title: string; items: string[] }[];
  faqs?: { q: string; a: string }[];
  relatedProjects?: { name: string; slug: string }[];
}
interface Props {
  project: ProjectDetail;
  slug: string;
  config?: ProjectConfig | null;
}
export function ProjectDetailPage({ project, slug, config }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/" className="hover:opacity-80">Trang chủ</Link>
        <span>/</span>
        <Link href="/du-an" className="hover:opacity-80">Dự án</Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
      </nav>
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          {project.status && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: "var(--primary-600)" }}>
              {project.status}
            </span>
          )}
          {project.legal_status && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
              {project.legal_status}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{project.name}</h1>

        {project.location && (
          <p className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            <MapPin className="w-4 h-4" style={{ color: "var(--primary-600)" }} />
            {project.location}
            {project.developer && ` · ${project.developer}`}
          </p>
        )}
        {project.description && (
          <p className="text-base leading-relaxed max-w-3xl" style={{ color: "var(--text-secondary)" }}>
            {project.description}
          </p>
        )}
      </div>
      {/* Key info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          project.price_range && {
            label: "Giá từ",
            value: typeof project.price_range === "string"
              ? project.price_range
              : `${project.price_range.min} ${project.price_range.unit}`,
          },
          project.total_units && { label: "Tổng sản phẩm", value: `${project.total_units}` },
          project.handover_year && { label: "Bàn giao", value: project.handover_year },
          project.investment_score && { label: "Investment Score", value: `${project.investment_score}/100` },
        ].filter((item): item is { label: string; value: string } => Boolean(item)).map((item) => (
          <div key={item.label} className="p-4 rounded-2xl text-center"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>{item.value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
          </div>
        ))}
      </div>      
        {/* Chi tiết dự án (từ PROJECT_CONFIG) */}
        {config?.details && config.details.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Thông Tin Chi Tiết</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0 rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              {config.details.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-5 py-3.5"
                  style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <dt className="text-sm shrink-0" style={{ color: "var(--text-tertiary)" }}>{d.label}</dt>
                  <dd className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {/* Tiện ích & kết nối (từ PROJECT_CONFIG) */}
        {config?.amenities && config.amenities.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Tiện Ích & Kết Nối</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {config.amenities.map((group, i) => (
                <div key={i} className="p-5 rounded-2xl"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--primary-600)" }}>{group.title}</h3>
                  <ul className="space-y-2">
                    {group.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <Building2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary-600)" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Google Maps embed for specific projects */}
        {(["aqua-city","vinhomes-central-park","masteri-cosmo-central","diamond-sky-van-phuc-city","legacy-66"] as string[]).includes(slug) && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Vị Trí Trên Bản Đồ</h2>
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: "400px" }}>
              <iframe
                title={`Bản đồ ${project.name}`}
                src={
                  slug === "aqua-city"
                    ? "https://maps.google.com/maps?q=Aqua+City+Novaland+Nhon+Trach+Dong+Nai&t=&z=14&ie=UTF8&iwloc=&output=embed"
                    : slug === "vinhomes-central-park"
                    ? "https://maps.google.com/maps?q=Vinhomes+Central+Park+Binh+Thanh+TPHCM&t=&z=15&ie=UTF8&iwloc=&output=embed"
                    : slug === "masteri-cosmo-central"
                    ? "https://maps.google.com/maps?q=The+Global+City+Masterise+Thu+Duc+TPHCM&t=&z=15&ie=UTF8&iwloc=&output=embed"
                    : slug === "diamond-sky-van-phuc-city"
                    ? "https://maps.google.com/maps?q=Van+Phuc+City+Thu+Duc+TPHCM&t=&z=15&ie=UTF8&iwloc=&output=embed"
                    : "https://maps.google.com/maps?q=Quan+5+Ho+Chi+Minh+City&t=&z=15&ie=UTF8&iwloc=&output=embed"
                }
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">* Bản đồ mang tính tham khảo vị trí dự án.</p>
          </div>
        )}
        {/* Câu hỏi thường gặp (từ PROJECT_CONFIG) */}
        {config?.faqs && config.faqs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Câu Hỏi Thường Gặp</h2>
            <div className="space-y-3">
              {config.faqs.map((f, i) => (
                <details key={i} className="rounded-2xl px-5 py-4 group"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                  <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between gap-3"
                    style={{ color: "var(--text-primary)" }}>
                    {f.q}
                    <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" style={{ color: "var(--primary-600)" }} />
                  </summary>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}
        {/* Dự án liên quan (từ PROJECT_CONFIG) */}
        {config?.relatedProjects && config.relatedProjects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Dự Án Liên Quan</h2>
            <div className="flex flex-wrap gap-3">
              {config.relatedProjects.map((r, i) => (
                <Link key={i} href={`/du-an/${r.slug}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
                  <Building2 className="w-4 h-4" style={{ color: "var(--primary-600)" }} />
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        )}
        {/* CTA */}
      <div className="p-8 rounded-2xl" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Tư vấn & đặt mua {project.name}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              SGS LAND — Đại lý phân phối uỷ quyền chính thức
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href="tel:+84971132378"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--primary-600)" }}>
              <Phone className="w-4 h-4" />
              0971 132 378
            </a>
            <Link href="/marketplace"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ border: "1.5px solid var(--primary-600)", color: "var(--primary-600)" }}>
              Xem tất cả BĐS <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}