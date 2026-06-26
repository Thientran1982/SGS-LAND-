// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { Linkedin, Award, Shield, Users, TrendingUp, Building2 } from "lucide-react";
import { AUTHORS } from "@/data/authors";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getOrganizationSchema, SITE_URL, ORG_ID } from "@/lib/schema";
export const metadata: Metadata = {
  title: "Về SGS LAND | Nền tảng BĐS AI hàng đầu Việt Nam",
  description:
    "SGS LAND — Công ty TNHH SGS Land, thành lập 2024. Đại lý uỷ quyền Vinhomes, Novaland, Masterise, Nam Long. 15.000+ môi giới, 45.000+ sản phẩm, 200 triệu USD giao dịch. Top Proptech VN 2025.",
  alternates: { canonical: `${SITE_URL}/about-us` },
};
export const dynamic = "force-dynamic";
const STATS = [
  { value: "2024", label: "Năm thành lập", icon: Building2 },
  { value: "15.000+", label: "Môi giới trong mạng lưới", icon: Users },
  { value: "45.000+", label: "Sản phẩm BĐS quản lý", icon: Building2 },
  { value: "2 tỷ USD+", label: "Giá trị giao dịch", icon: TrendingUp },
];
const TIMELINE = [
  { year: "T1/2024", event: "Thành lập SGS Land Co.,ltd tại TP. Hồ Chí Minh" },
  { year: "T3/2024", event: "Ra mắt nền tảng marketplace BĐS và hệ thống CRM đa kênh" },
  { year: "T6/2024", event: "Ký kết đối tác phân phối uỷ quyền với Novaland và Nam Long" },
  { year: "T8/2024", event: "Triển khai hệ thống định giá AVM — độ chính xác ±5%" },
  { year: "T11/2024", event: "Ký kết đối tác phân phối uỷ quyền với Masterise Homes và Vinhomes" },
  { year: "T1/2025", event: "Đạt mốc 10.000 môi giới xác thực trên nền tảng" },
  { year: "T3/2025", event: "Ra mắt ứng dụng di động cho người mua nhà (iOS & Android)" },
  { year: "T5/2025", event: "Vinh danh Top Proptech Việt Nam 2025 — vượt mốc 45.000 sản phẩm" },
];
const PARTNERS = [
  { name: "Vinhomes", since: 2024 },
  { name: "Novaland", since: 2024 },
  { name: "Masterise Homes", since: 2024 },
  { name: "Nam Long Group", since: 2024 },
  { name: "Sơn Kim Land", since: 2025 },
  { name: "Khang Điền", since: 2025 },
];
const AWARDS = [
  { title: "Top Proptech Việt Nam 2025", org: "Vietnam PropTech Awards", icon: "🏆" },
  { title: "Đại lý phân phối uỷ quyền chính thức", org: "Vinhomes, Novaland, Masterise Homes, Nam Long", icon: "🤝" },
  { title: "Tuân thủ NĐ 13/2023/NĐ-CP", org: "Nghị định bảo vệ dữ liệu cá nhân", icon: "🔒" },
  { title: "Chuẩn TĐGVN/IVS", org: "Định giá theo tiêu chuẩn quốc tế, Luật Đất Đai 2024", icon: "📊" },
];
export default function AboutUsPage() {
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Về chúng tôi", url: `${SITE_URL}/about-us` },
  ]);
  // AboutPage + Organization JSON-LD
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about-us#about`,
    url: `${SITE_URL}/about-us`,
    name: "Về SGS LAND",
    description:
      "SGS LAND là nền tảng bất động sản AI hàng đầu Việt Nam. Đại lý phân phối uỷ quyền Vinhomes, Novaland, Masterise Homes và Nam Long — 15.000+ môi giới, 45.000+ sản phẩm.",
    about: { "@id": ORG_ID },
  };
  // Person JSON-LD for each leader (GEO Tier S: E-E-A-T named authorship)
  const personSchemas = AUTHORS.slice(0, 3).map((author) => ({
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/tac-gia/${author.slug}#person`,
    name: author.name,
    jobTitle: author.title,
    url: `${SITE_URL}/tac-gia/${author.slug}`,
    sameAs: [author.linkedIn, ...author.sameAs].filter(Boolean),
    worksFor: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "SGS Land Co.ltd",
      url: SITE_URL,
    },
  }));
  return (
    <>
      <SchemaScript schemas={[breadcrumb, aboutSchema, getOrganizationSchema(), ...personSchemas]} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <li><Link href="/" className="hover:underline">Trang chủ</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" style={{ color: "var(--text-secondary)" }}>Về chúng tôi</li>
          </ol>
        </nav>
        {/* Hero */}
        <section className="mb-12">
          <h1 className="text-4xl font-extrabold mb-4" style={{ color: "var(--text-primary)" }}>
            Về SGS LAND
          </h1>
          <p className="text-lg leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
            <strong>SGS LAND</strong> (Công ty TNHH SGS Land) là nền tảng quản lý &amp; phân phối bất
            động sản AI thế hệ mới, thành lập năm 2024 tại TP. Hồ Chí Minh, Việt Nam. Tính đến tháng
            5/2025, SGS LAND vận hành mạng lưới <strong>15.000+ môi giới</strong> được xác thực,
            kho hàng <strong>45.000+ sản phẩm</strong> và đã xử lý hơn <strong>200 triệu USD</strong> giá trị
            giao dịch.
          </p>
        </section>
        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-14">
          {STATS.map(({ value, label, icon: Icon }) => (
            <div
              key={label}
              className="text-center p-5 rounded-2xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--primary-600)" }} aria-hidden />
              <p className="text-2xl font-extrabold mb-1" style={{ color: "var(--primary-600)" }}>{value}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
            </div>
          ))}
        </section>
        {/* Team — E-E-A-T: named leadership with full profiles */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Đội ngũ sáng lập
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {AUTHORS.slice(0, 3).map((author) => (
              <div
                key={author.slug}
                className="p-5 rounded-2xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                itemScope                itemType="https://schema.org/Person"
              >
                <div
                  className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: "var(--primary-600)" }}
                  aria-hidden
                >
                  {author.name.charAt(0)}
                </div>
                <p className="font-bold text-center mb-0.5" style={{ color: "var(--text-primary)" }} itemProp="name">
                  {author.name}
                </p>
                <p className="text-sm text-center mb-2" style={{ color: "var(--text-secondary)" }} itemProp="jobTitle">
                  {author.title}
                </p>
                <p className="text-xs text-center leading-snug mb-3 line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
                  {author.bio.split(".")[0]}.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link href={`/tac-gia/${author.slug}`} className="text-xs font-medium hover:underline"
                    style={{ color: "var(--primary-600)" }}>
                    Xem hồ sơ →
                  </Link>
                  <a href={author.linkedIn} target="_blank" rel="noopener noreferrer"
                    className="text-xs flex items-center gap-0.5 hover:underline"
                    style={{ color: "#0A66C2" }}>
                    <Linkedin className="w-3 h-3" /> LinkedIn
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
        {/* Timeline */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Hành trình phát triển
          </h2>
          <div className="relative">
            <div className="absolute left-[68px] top-0 bottom-0 w-0.5"
              style={{ background: "var(--border-default)" }} aria-hidden />
            <ol className="space-y-5">
              {TIMELINE.map(({ year, event }) => (
                <li key={year} className="flex items-start gap-5">
                  <time
                    className="shrink-0 text-xs font-bold w-14 text-right pt-0.5"
                    style={{ color: "var(--primary-600)" }}
                    dateTime={year}
                  >
                    {year}
                  </time>
                  <div className="relative z-10">
                    <div
                      className="w-3 h-3 rounded-full border-2 mt-0.5"
                      style={{ background: "var(--primary-600)", borderColor: "var(--bg-app)" }}
                      aria-hidden
                    />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{event}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        {/* Partners */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
            Đối tác uỷ quyền chính thức
          </h2>
          <div className="flex flex-wrap gap-3">
            {PARTNERS.map(({ name, since }) => (
              <div
                key={name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{name}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Từ {since}</span>
              </div>
            ))}
          </div>
        </section>
        {/* Awards & Compliance */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
            Giải thưởng &amp; Tuân thủ pháp lý
          </h2>
          <ul className="space-y-3">
            {AWARDS.map(({ title, org, icon }) => (
              <li
                key={title}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <span className="text-2xl shrink-0" aria-hidden>{icon}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{org}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        {/* Legal compliance note */}
        <div
          className="flex items-start gap-3 p-5 rounded-2xl text-sm"
          style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)", color: "var(--text-secondary)" }}
          role="note"
        >
          <Shield className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--sgs-verified)" }} aria-hidden />
          <div>
            <p className="font-semibold mb-1" style={{ color: "var(--sgs-verified)" }}>Tuân thủ pháp luật</p>
            <p>
              SGS LAND hoạt động theo Luật Đất Đai 2024, Luật Nhà Ở 2023, Luật Kinh Doanh BĐS 2023,
              và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Định giá theo chuẩn TĐGVN/IVS.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}