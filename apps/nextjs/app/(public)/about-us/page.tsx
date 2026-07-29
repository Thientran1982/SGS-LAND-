// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { Linkedin, Award, Shield, Users, TrendingUp, Building2 } from "lucide-react";
import { AUTHORS } from "@/data/authors";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getOrganizationSchema, SITE_URL, ORG_ID } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en
      ? "About SGS LAND | Vietnam's Leading AI Real Estate Platform"
      : "Về SGS LAND | Nền tảng BĐS AI hàng đầu Việt Nam",
    description: en
      ? "SGS LAND — SGS Land Co., Ltd, founded in 2024. Authorised distribution agent for Vinhomes, Novaland, Masterise and Nam Long. 15,000+ brokers, 45,000+ listings, US$200 million in transactions. Top Vietnam Proptech 2025."
      : "SGS LAND — Công ty TNHH SGS Land, thành lập 2024. Đại lý uỷ quyền Vinhomes, Novaland, Masterise, Nam Long. 15.000+ môi giới, 45.000+ sản phẩm, 200 triệu USD giao dịch. Top Proptech VN 2025.",
    alternates: {
      canonical: en ? `${SITE_URL}/en/about-us` : `${SITE_URL}/about-us`,
      ...langAlternates("/about-us"),
    },
  };
}
export const dynamic = "force-dynamic";
const STATS = (en: boolean) => [
  { value: "2024", label: en ? "Year founded" : "Năm thành lập", icon: Building2 },
  { value: en ? "15,000+" : "15.000+", label: en ? "Brokers in the network" : "Môi giới trong mạng lưới", icon: Users },
  { value: en ? "45,000+" : "45.000+", label: en ? "Listings under management" : "Sản phẩm BĐS quản lý", icon: Building2 },
  { value: en ? "US$2B+" : "2 tỷ USD+", label: en ? "Transaction value" : "Giá trị giao dịch", icon: TrendingUp },
];
const TIMELINE = (en: boolean) => [
  { year: en ? "Jan 2024" : "T1/2024", event: en ? "SGS Land Co., Ltd founded in Ho Chi Minh City" : "Thành lập SGS Land Co.,ltd tại TP. Hồ Chí Minh" },
  { year: en ? "Mar 2024" : "T3/2024", event: en ? "Launched the property marketplace and omnichannel CRM" : "Ra mắt nền tảng marketplace BĐS và hệ thống CRM đa kênh" },
  { year: en ? "Jun 2024" : "T6/2024", event: en ? "Signed authorised distribution agreements with Novaland and Nam Long" : "Ký kết đối tác phân phối uỷ quyền với Novaland và Nam Long" },
  { year: en ? "Aug 2024" : "T8/2024", event: en ? "Deployed the AVM valuation engine — ±5% accuracy" : "Triển khai hệ thống định giá AVM — độ chính xác ±5%" },
  { year: en ? "Nov 2024" : "T11/2024", event: en ? "Signed authorised distribution agreements with Masterise Homes and Vinhomes" : "Ký kết đối tác phân phối uỷ quyền với Masterise Homes và Vinhomes" },
  { year: en ? "Jan 2025" : "T1/2025", event: en ? "Reached 10,000 verified brokers on the platform" : "Đạt mốc 10.000 môi giới xác thực trên nền tảng" },
  { year: en ? "Mar 2025" : "T3/2025", event: en ? "Released the home-buyer mobile app (iOS & Android)" : "Ra mắt ứng dụng di động cho người mua nhà (iOS & Android)" },
  { year: en ? "May 2025" : "T5/2025", event: en ? "Named Top Vietnam Proptech 2025 — passed 45,000 listings" : "Vinh danh Top Proptech Việt Nam 2025 — vượt mốc 45.000 sản phẩm" },
];
const PARTNERS = [
  { name: "Vinhomes", since: 2024 },
  { name: "Novaland", since: 2024 },
  { name: "Masterise Homes", since: 2024 },
  { name: "Nam Long Group", since: 2024 },
  { name: "Sơn Kim Land", since: 2025 },
  { name: "Khang Điền", since: 2025 },
];
const AWARDS = (en: boolean) => [
  { title: en ? "Top Vietnam Proptech 2025" : "Top Proptech Việt Nam 2025", org: "Vietnam PropTech Awards", icon: "🏆" },
  { title: en ? "Official authorised distribution agent" : "Đại lý phân phối uỷ quyền chính thức", org: "Vinhomes, Novaland, Masterise Homes, Nam Long", icon: "🤝" },
  { title: en ? "Compliant with Decree 13/2023/ND-CP" : "Tuân thủ NĐ 13/2023/NĐ-CP", org: en ? "Vietnam's personal data protection decree" : "Nghị định bảo vệ dữ liệu cá nhân", icon: "🔒" },
  { title: en ? "TĐGVN / IVS valuation standards" : "Chuẩn TĐGVN/IVS", org: en ? "Valuation to international standards, Land Law 2024" : "Định giá theo tiêu chuẩn quốc tế, Luật Đất Đai 2024", icon: "📊" },
];
export default async function AboutUsPage() {
  const en = (await getLang()) === "en";
  const base = en ? `${SITE_URL}/en` : SITE_URL;
  const breadcrumb = getBreadcrumbSchema([
    { name: en ? "Home" : "Trang chủ", url: base },
    { name: en ? "About us" : "Về chúng tôi", url: `${base}/about-us` },
  ]);
  // AboutPage + Organization JSON-LD
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about-us#about`,
    url: `${SITE_URL}/about-us`,
    name: en ? "About SGS LAND" : "Về SGS LAND",
    description: en
      ? "SGS LAND is Vietnam's leading AI real estate platform. Authorised distribution agent for Vinhomes, Novaland, Masterise Homes and Nam Long — 15,000+ brokers, 45,000+ listings."
      : "SGS LAND là nền tảng bất động sản AI hàng đầu Việt Nam. Đại lý phân phối uỷ quyền Vinhomes, Novaland, Masterise Homes và Nam Long — 15.000+ môi giới, 45.000+ sản phẩm.",
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
            <li><Link href={en ? "/en" : "/"} className="hover:underline">{en ? "Home" : "Trang chủ"}</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" style={{ color: "var(--text-secondary)" }}>{en ? "About us" : "Về chúng tôi"}</li>
          </ol>
        </nav>
        {/* Hero */}
        <section className="mb-12">
          <h1 className="text-4xl font-extrabold mb-4" style={{ color: "var(--text-primary)" }}>
            {en ? "About SGS LAND" : "Về SGS LAND"}
          </h1>
          <p className="text-lg leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
            {en ? (
              <>
                <strong>SGS LAND</strong> (SGS Land Co., Ltd) is a new-generation AI platform for real
                estate management &amp; distribution, founded in 2024 in Ho Chi Minh City, Vietnam. As of
                May 2025 SGS LAND operates a network of <strong>15,000+ verified brokers</strong>, an
                inventory of <strong>45,000+ listings</strong>, and has processed more than{" "}
                <strong>US$200 million</strong> in transaction value.
              </>
            ) : (
              <>
                <strong>SGS LAND</strong> (Công ty TNHH SGS Land) là nền tảng quản lý &amp; phân phối bất
                động sản AI thế hệ mới, thành lập năm 2024 tại TP. Hồ Chí Minh, Việt Nam. Tính đến tháng
                5/2025, SGS LAND vận hành mạng lưới <strong>15.000+ môi giới</strong> được xác thực,
                kho hàng <strong>45.000+ sản phẩm</strong> và đã xử lý hơn <strong>200 triệu USD</strong> giá trị
                giao dịch.
              </>
            )}
          </p>
        </section>
        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-14">
          {STATS(en).map(({ value, label, icon: Icon }) => (
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
            {en ? "Founding team" : "Đội ngũ sáng lập"}
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
                  <Link href={en ? `/en/tac-gia/${author.slug}` : `/tac-gia/${author.slug}`} className="text-xs font-medium hover:underline"
                    style={{ color: "var(--primary-600)" }}>
                    {en ? "View profile →" : "Xem hồ sơ →"}
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
            {en ? "Our journey" : "Hành trình phát triển"}
          </h2>
          <div className="relative">
            <div className="absolute left-[68px] top-0 bottom-0 w-0.5"
              style={{ background: "var(--border-default)" }} aria-hidden />
            <ol className="space-y-5">
              {TIMELINE(en).map(({ year, event }) => (
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
            {en ? "Official authorised partners" : "Đối tác uỷ quyền chính thức"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {PARTNERS.map(({ name, since }) => (
              <div
                key={name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{name}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{en ? "Since" : "Từ"} {since}</span>
              </div>
            ))}
          </div>
        </section>
        {/* Awards & Compliance */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
            {en ? "Awards &amp; legal compliance" : "Giải thưởng &amp; Tuân thủ pháp lý"}
          </h2>
          <ul className="space-y-3">
            {AWARDS(en).map(({ title, org, icon }) => (
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
            <p className="font-semibold mb-1" style={{ color: "var(--sgs-verified)" }}>{en ? "Legal compliance" : "Tuân thủ pháp luật"}</p>
            <p>
              {en
                ? "SGS LAND operates under Vietnam's Land Law 2024, Housing Law 2023, Real Estate Business Law 2023 and Decree 13/2023/ND-CP on personal data protection. Valuations follow the TĐGVN / IVS standards."
                : "SGS LAND hoạt động theo Luật Đất Đai 2024, Luật Nhà Ở 2023, Luật Kinh Doanh BĐS 2023, và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Định giá theo chuẩn TĐGVN/IVS."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}