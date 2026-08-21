"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { LandingProject } from "@/data/landing-projects";
import { PROJECT_DETAIL_EN, type ProjectDetailEnglishCopy } from "@/data/project-detail-en";
import { PROJECT_CONFIG_EN } from "@/data/project-config-en";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";

interface ProjectDetail {
  name: string;
  developer?: string;
  location?: string;
  description?: string;
  total_units?: number;
  status?: string;
  handover_year?: string;
  price_range?: { min: number; max: number; unit: string } | string;
  legal_status?: string;
  property_types?: string[];
  investment_score?: number;
  images?: string[];
}

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
  landingProject?: LandingProject | null;
}

const surface = {
  background: "var(--bg-elevated)",
  borderColor: "var(--border-default)",
};

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: "var(--sgs-accent-text)" }}>{eyebrow}</p>
      <h2 className="text-2xl font-bold tracking-[-.035em] sm:text-3xl" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {intro && <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{intro}</p>}
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "accent" | "neutral" | "warning" }) {
  const colors = {
    accent: { background: "var(--sgs-accent-soft)", color: "var(--sgs-accent-text)" },
    neutral: { background: "var(--ui-surface-subtle)", color: "var(--text-secondary)" },
    warning: { background: "#fff4e5", color: "#9a5b00" },
  };
  return <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold" style={colors[tone]}>{children}</span>;
}

const AREA_DETAIL_SLUGS = new Set([
  "bat-dong-san-quan-7",
  "bat-dong-san-long-an",
  "bat-dong-san-dong-nai",
  "bat-dong-san-binh-thanh",
  "nha-pho-trung-tam",
  "bat-dong-san-thu-duc",
  "bat-dong-san-long-thanh",
  "bat-dong-san-binh-chanh",
  "bat-dong-san-can-gio",
  "bat-dong-san-hoc-mon",
  "bat-dong-san-binh-duong",
  "bat-dong-san-phu-nhuan",
]);

function RichProjectDetail({ project, config, landing }: { project: ProjectDetail; config?: ProjectConfig | null; landing: LandingProject }) {
  const lang = useLang();
  const isArea = AREA_DETAIL_SLUGS.has(landing.slug);
  const areaEnglishNames: Record<string, string> = {
    "bat-dong-san-long-an": "Long An Real Estate",
    "bat-dong-san-thu-duc": "Thu Duc Real Estate",
    "bat-dong-san-long-thanh": "Long Thanh Real Estate",
    "bat-dong-san-dong-nai": "Dong Nai Real Estate",
    "bat-dong-san-binh-thanh": "Binh Thanh Real Estate",
    "bat-dong-san-quan-7": "District 7 Real Estate",
    "bat-dong-san-hoc-mon": "Hoc Mon Real Estate",
    "nha-pho-trung-tam": "Central Townhouses",
  };
  const displayTitle = lang === "en" && isArea ? (areaEnglishNames[landing.slug] || landing.titleShort) : landing.titleShort;
  const translateAreaValue = (value: string) => lang === "en" && isArea
    ? value.replace(/Nhiều chủ đầu tư/gi, "Multiple developers").replace(/Nhiều CĐT/gi, "Multiple developers").replace(/Nhiều Chủ Sở Hữu Cá Nhân & Tổ Chức/gi, "Multiple individual and organizational owners").replace(/Nhiều khu vực nội thành/gi, "Multiple central districts").replace(/Cần xác minh/gi, "To be verified").replace(/Danh mục bất động sản/gi, "Real estate category").replace(/khu trung tâm TP\.?HCM/gi, "central Ho Chi Minh City").replace(/TP\.?HCM/gi, "Ho Chi Minh City").replace(/Quận\s+/gi, "District ").replace(/Đất nền/gi, "Land lots").replace(/biệt thự/gi, "villas").replace(/Căn hộ/gi, "Apartments").replace(/nhà phố/gi, "Townhouses").replace(/Nhà mặt tiền/gi, "Street-front houses").replace(/nhà hẻm/gi, "alley houses").replace(/liền kề/gi, "attached townhouses").replace(/triệu\/m²/gi, "million VND/m²").replace(/triệu\/tháng/gi, "million VND/month").replace(/\(mặt tiền lớn\)/gi, "(large frontage)").replace(/VNĐ/gi, "VND")
    : value;
  const translateAreaLabel = (label: string) => lang === "en" && isArea
    ? label.replace(/^Chủ đầu tư$/i, "Developer").replace(/^Vị trí$/i, "Location").replace(/^Quy mô$/i, "Scale").replace(/^Loại hình$/i, "Property types").replace(/^Giá tham khảo$/i, "Reference price").replace(/^Tình trạng$/i, "Status").replace(/^Kỳ dữ liệu$/i, "Data period").replace(/^Giá mặt tiền Q1$/i, "District 1 frontage price").replace(/^Giá hẻm Q1$/i, "District 1 alley-house price").replace(/^Giá thuê mặt bằng$/i, "Commercial space rent").replace(/^Cho thuê mặt bằng$/i, "Commercial space rent")
    : label;
  const areaEnglishCopy: ProjectDetailEnglishCopy | null = lang === "en" && isArea ? {
    eyebrow: "Area reference",
    desc: `Reference information about ${displayTitle}: location, products, pricing and verification points. Always confirm current documents and terms for the specific property.`,
    heroImageAlt: `${displayTitle} area reference`,
    heroSub: "Area reference",
    heroMeta: `Reference location: ${translateAreaValue(landing.heroMeta)}`,
    overviewParas: [
      `${displayTitle} is presented as an area-level real estate reference page, not as a single development or a guarantee of pricing, legal status or returns.`,
      "Use this page to understand the area, then verify the exact property, planning information, legal documents, asking price and operating status before making a transaction.",
    ],
    entityTable: landing.entityTable.map((row) => ({
      ...row,
      k: translateAreaLabel(row.k).replace(/^Khu vực$/i, "Area").replace(/^Khoảng giá$/i, "Reference range").replace(/^Điểm tham chiếu$/i, "Reference point"),
      v: translateAreaValue(row.v),
    })),
    locationIntro: `Reference location for ${displayTitle}: ${translateAreaValue(landing.heroMeta)}`,
    faq: [],
    navLinks: landing.navLinks.map((link) => ({
      href: link.href,
      label: link.label.replace(/^Tổng quan$/i, "Overview").replace(/^Thông tin$/i, "Identity").replace(/^Vị trí$/i, "Location").replace(/^Sản phẩm & giá$/i, "Products & pricing").replace(/^Tiện ích & kết nối$/i, "Amenities & connectivity").replace(/^FAQ$/i, "FAQ"),
    })),
    stats: landing.stats.map((stat) => ({ ...stat, num: translateAreaValue(stat.num), lbl: translateAreaLabel(stat.lbl) })),
  } : null;
  const englishCopy = lang === "en" ? (PROJECT_DETAIL_EN[landing.slug] || areaEnglishCopy) : null;
  const areaAmenityText: Record<string, string[]> = {
    "bat-dong-san-long-an": ["Clean climate", "New transport infrastructure", "Nearby industrial parks", "Educational amenities", "Ecological parks", "24/7 security", "Connections to Ho Chi Minh City"],
    "bat-dong-san-thu-duc": ["Metro Line 1", "Vietnam National University area", "High-tech park", "Retail centres", "Schools and hospitals", "Modern parks", "24/7 security"],
    "bat-dong-san-long-thanh": ["Near Long Thanh Airport", "Developing transport infrastructure", "Industrial parks", "Educational amenities", "Healthcare facilities", "Retail centres", "24/7 security"],
    "bat-dong-san-dong-nai": ["Coordinated transport infrastructure", "Nearby industrial parks", "Schools and hospitals", "Retail centres", "Green parks", "24/7 security", "Connections to Ho Chi Minh City"],
    "bat-dong-san-binh-thanh": ["Central location", "Saigon River access", "Retail centres", "Schools and hospitals", "Swimming pools and gyms", "Green spaces", "24/7 security"],
    "bat-dong-san-quan-7": ["Phu My Hung urban area", "Crescent Mall and retail centres", "International schools", "FV Hospital area", "Modern parks", "Dining and services", "24/7 security"],
    "bat-dong-san-hoc-mon": ["Northwest Ho Chi Minh City location", "Developing transport infrastructure", "Nearby schools and hospitals", "Green spaces", "Local retail and services", "Residential communities", "Connections to central districts"],
    "nha-pho-trung-tam": ["Central urban location", "Convenient retail and services", "Schools and hospitals", "Public transport access", "Dining and entertainment", "Established residential community", "Verify property-specific amenities"],
  };
  const areaEnglishConfig: ProjectConfig | null = lang === "en" && isArea && areaAmenityText[landing.slug] ? {
    details: (config?.details || []).map((row) => ({
      ...row,
      label: row.label.replace(/^Chủ đầu tư$/i, "Developer").replace(/^Vị trí$/i, "Location").replace(/^Quy mô$/i, "Scale").replace(/^Loại hình$/i, "Property types").replace(/^Giá tham khảo$/i, "Reference price").replace(/^Tình trạng$/i, "Status"),
    })),
    amenities: [{ title: "Area amenities and status to verify", items: areaAmenityText[landing.slug] }],
    faqs: [
      { q: `What is ${displayTitle}?`, a: `${displayTitle} is an area-level real estate reference page, not a single project. Verify the specific property and current documents before a transaction.` },
      { q: "Are the prices official?", a: "No. Prices shown are references from the available dataset and must be checked against the specific property, date and legal documents." },
      { q: "What should buyers verify?", a: "Verify planning, legal status, ownership costs, infrastructure status, transfer conditions and the actual availability of the property." },
    ],
  } : null;
  const englishConfig = lang === "en" ? (PROJECT_CONFIG_EN[landing.slug] || areaEnglishConfig) : null;
  const displayStats = (englishCopy?.stats || landing.stats).map((stat) => ({
    ...stat,
    num: translateAreaValue(stat.num),
    lbl: translateAreaLabel(stat.lbl),
  }));
  const image = project.images?.[0] || ({
    "manhattan": "/images/projects/masterise-homes.webp",
    "thu-thiem": "/images/projects/the-global-city.webp",
    "son-kim-land": "/images/projects/masterise-homes.webp",
    "vinhomes-can-gio": "/images/projects/vinhomes-can-gio.webp",
    "sala": "/images/projects/the-global-city.webp",
    "vinhomes-hoc-mon": "/images/projects/vinhomes-grand-park.webp",
    "masteri-park-place": "/images/projects/masteri-park-place.jpg",
    "masteri-cosmo-central": "/images/projects/masterise-homes.webp",
    "eco-retreat-long-an": "/images/projects/aqua-city.png",
    "legacy-66": "/images/projects/aqua-city.png",
    "nha-pho-trung-tam": "/images/projects/aqua-city.png",
    "bat-dong-san-thu-duc": "/images/projects/vinhomes-grand-park.webp",
    "bat-dong-san-long-thanh": "/images/projects/izumi-city.webp",
    "bat-dong-san-binh-thanh": "/images/projects/vinhomes-grand-park.webp",
    "bat-dong-san-quan-7": "/images/projects/the-global-city.webp",
    "bat-dong-san-long-an": "/images/projects/aqua-city.png",
    "bat-dong-san-dong-nai": "/images/projects/izumi-city.webp",
    "bat-dong-san-binh-chanh": "/images/projects/aqua-city.png",
    "bat-dong-san-can-gio": "/images/projects/vinhomes-can-gio.webp",
    "bat-dong-san-hoc-mon": "/images/projects/vinhomes-grand-park.webp",
    "bat-dong-san-binh-duong": "/images/projects/vinhomes-grand-park.webp",
    "vinhomes-grand-park": "/images/projects/vinhomes-grand-park.webp",
    "vinhomes-central-park": "/images/projects/vinhomes-grand-park.webp",
    "diamond-sky-van-phuc-city": "/images/projects/diamond-sky-van-phuc-city.jpg",
  }[landing.slug] || `/images/projects/${landing.slug}.jpg`);
  const priceRows = (englishConfig?.details || config?.details || [])
    .filter((row) => /giá|mức giá|price/i.test(row.label))
    .map((row) => ({ k: row.label, v: row.value }));
  if (priceRows.length === 0) {
    const fallbackPrice = landing.entityTable.find((row) => /giá|price/i.test(row.k));
    if (fallbackPrice) priceRows.push({ k: fallbackPrice.k, v: fallbackPrice.v });
  }
  const lastUpdated = "21/08/2026";

  return (
    <main className="bg-[var(--bg-page)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/" className="hover:underline">{tt(lang, "Trang chủ", "Home")}</Link><span>/</span>
           <Link href={AREA_DETAIL_SLUGS.has(landing.slug) ? (lang === "en" ? "/en/khu-vuc" : "/khu-vuc") : (lang === "en" ? "/en/du-an" : "/du-an")} className="hover:underline">{AREA_DETAIL_SLUGS.has(landing.slug) ? tt(lang, "Khu vực", "Areas") : tt(lang, "Dự án", "Projects")}</Link><span>/</span>
           <span style={{ color: "var(--text-primary)" }}>{displayTitle}</span>
        </nav>

        <section className="overflow-hidden rounded-3xl border shadow-[var(--ui-shadow-sm)]" style={surface}>
          <div className="grid lg:grid-cols-[1.02fr_.98fr]">
            <div className="relative min-h-[310px] overflow-hidden sm:min-h-[390px]">
              <img src={image} alt={landing.heroImageAlt} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#062f25]/90 via-[#062f25]/15 to-transparent" />
              <div className="absolute bottom-6 left-5 right-5 text-white sm:bottom-8 sm:left-8">
                <div className="mb-3 flex flex-wrap gap-2"><Tag tone="accent">{tt(lang, "Thông tin tham khảo", "Reference information")}</Tag><Tag>{tt(lang, "Cập nhật", "Updated")} {lastUpdated}</Tag></div>
                 <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/75">{AREA_DETAIL_SLUGS.has(landing.slug) ? tt(lang, "Khu vực bất động sản", "Real estate area") : tt(lang, "Dự án bất động sản", "Real estate project")}</p>
                <p className="mt-2 text-2xl font-bold tracking-[-.04em] sm:text-4xl">{displayTitle}</p>
              </div>
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--sgs-accent-text)" }}>{englishCopy?.eyebrow || landing.eyebrow}</p>
               <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl" style={{ color: "var(--text-primary)" }}>{AREA_DETAIL_SLUGS.has(landing.slug) ? tt(lang, "Thông tin khu vực", "Area information") : tt(lang, "Thông tin dự án", "Project information")} {displayTitle}</h1>
              <p className="mt-4 flex items-start gap-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}><MapPin className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{englishCopy?.heroMeta || landing.heroMeta}</p>
              <p className="answer-box mt-5 rounded-2xl border-l-4 px-4 py-4 text-sm leading-6" role="note" style={{ borderColor: "var(--sgs-accent)", background: "var(--ui-surface-subtle)", color: "var(--text-secondary)" }}>
                 {englishCopy?.desc || landing.desc} {tt(lang, "Trang này tổng hợp thông tin tham khảo về vị trí, sản phẩm, giá và hồ sơ; giá, pháp lý, tiến độ và tiện ích cần được xác minh theo đúng sản phẩm trước giao dịch.", "This page summarizes reference information about location, products, pricing and documents; pricing, legal status, progress and amenities must be verified for the specific property before a transaction.")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="tel:+84971132378" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> {tt(lang, "Liên hệ hỏi thông tin", "Contact for information")}</a>
                <Link href="#bang-gia" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--ui-border-strong)", color: "var(--ui-brand)" }}>{tt(lang, "Xem giá tham khảo", "View reference prices")} <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label={`${tt(lang, "Mục lục trang", "Page contents")} ${displayTitle}`} className="sticky top-0 z-20 -mx-4 mt-6 overflow-x-auto border-y px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border" style={{ background: "color-mix(in srgb, var(--bg-page) 92%, transparent)", borderColor: "var(--border-default)" }}>
          <div className="flex min-w-max gap-5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
             {(englishCopy?.navLinks || landing.navLinks).map((link) => <a key={link.href} href={link.href} className="transition hover:text-[var(--ui-brand)]">{link.label}</a>)}
          </div>
        </nav>

        <section id="tong-quan" className="scroll-mt-20 py-12 sm:py-16">
           <SectionHeading eyebrow={tt(lang, "01 · Tổng quan", "01 · Overview")} title={`${displayTitle} ${AREA_DETAIL_SLUGS.has(landing.slug) ? tt(lang, "là khu vực nào?", "— what area is it?") : tt(lang, "là dự án gì?", "— what is it?")}`} intro={tt(lang, "Câu trả lời ngắn gọn cho người đang tìm hiểu khu vực, vị trí và mức độ xác minh thông tin.", "A concise answer for readers researching the area, location and verification status.")} />
          <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
            <div className="space-y-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
              {(englishCopy?.overviewParas || landing.overviewParas).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <aside className="rounded-2xl border p-5" style={{ ...surface, background: "var(--ui-surface-subtle)" }}>
              <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Điểm cần xác minh", "What to verify")}</h3></div>
              <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                {[tt(lang, "Pháp lý của đúng phân khu và sản phẩm", "Legal documents for the specific phase and property"), tt(lang, "Bảng giá, chính sách và tình trạng quỹ hàng có ngày cập nhật", "Dated pricing, policies and inventory status"), tt(lang, "Tiến độ bàn giao, tiện ích đã vận hành và chi phí sở hữu", "Handover progress, operating amenities and ownership costs")].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{item}</li>)}
              </ul>
            </aside>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
             {displayStats.map((stat) => <div key={stat.lbl} className="rounded-2xl border p-4" style={surface}><p className="text-lg font-bold" style={{ color: "var(--sgs-accent-text)" }}>{stat.num}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>{stat.lbl}</p></div>)}
          </div>
        </section>

        <section id="thong-tin" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
           <SectionHeading eyebrow={tt(lang, "02 · Entity", "02 · Entity")} title={AREA_DETAIL_SLUGS.has(landing.slug) ? tt(lang, "Thông tin nhận diện khu vực", "Area identity") : tt(lang, "Thông tin nhận diện dự án", "Project identity")} intro={`${tt(lang, "Bảng tóm tắt giúp người đọc và hệ thống trả lời AI hiểu cùng một khu vực", "A summary table helps readers and AI systems identify the same area")} ${displayTitle}, ${tt(lang, "không trộn với sản phẩm hoặc dự án riêng lẻ.", "without confusing it with individual properties or projects.")}`} />
          <div className="overflow-x-auto rounded-2xl border" style={surface}>
            <table className="w-full min-w-[620px] border-collapse text-sm">
             <tbody>{(englishCopy?.entityTable || landing.entityTable).filter((row) => !/hotline|đại lý ủy quyền|distribution status/i.test(`${row.k} ${row.v}`)).map((row, index) => <tr key={row.k} style={{ background: index % 2 ? "var(--ui-surface-subtle)" : "transparent" }}><th scope="row" className="w-[30%] px-5 py-4 text-left font-medium" style={{ color: "var(--text-tertiary)" }}>{row.k}</th><td className="px-5 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{row.v}</td></tr>)}</tbody>
            </table>
          </div>
           <p className="mt-3 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Cập nhật nội dung", "Content updated")}: {lastUpdated}. {tt(lang, "Dữ liệu có chữ “tham khảo” hoặc “cần đối chiếu” không phải bảng giá, hồ sơ pháp lý hay cam kết giao dịch.", "Information marked “reference” or “verify” is not an official price list, legal file or transaction commitment.")}</p>
        </section>

        <section id="vi-tri" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
           <SectionHeading eyebrow={tt(lang, "03 · Vị trí", "03 · Location")} title={`${displayTitle} ${tt(lang, "ở đâu?", "— where is it?")}`} intro={englishCopy?.locationIntro || landing.locationIntro} />
          <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-2xl border p-6" style={{ ...surface, background: "var(--ui-surface-subtle)" }}>
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Địa điểm tham khảo", "Reference location")}</h3></div>
               <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{englishCopy?.locationIntro || landing.heroMeta}. {tt(lang, "Ranh dự án và thời gian di chuyển cần đối chiếu theo phân khu, tuyến đường và thời điểm.", "Project boundaries and travel times should be checked by phase, route and date.")}</p>
              <div className="mt-5 flex flex-wrap gap-2"><Tag>{tt(lang, "Đối chiếu bản đồ thực tế", "Check against the actual map")}</Tag></div>
            </div>
             <div className="overflow-hidden rounded-2xl border" style={surface}><iframe title={`${tt(lang, "Bản đồ vị trí", "Location map")} ${displayTitle}`} src={landing.googleMapsEmbedSrc} className="h-[300px] w-full border-0 sm:h-[360px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><p className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Bản đồ chỉ mang tính tham khảo vị trí, không thay thế hồ sơ ranh giới dự án.", "The map is for location reference only and does not replace official project boundary documents.")}</p></div>
          </div>
        </section>

        <section id="bang-gia" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow={tt(lang, "04 · Sản phẩm & giá", "04 · Products & pricing")} title={`${tt(lang, "Giá", "Prices for")} ${displayTitle}`} intro={tt(lang, "Mức tham khảo hiện có trong dữ liệu SGS LAND; giá thực tế thay đổi theo phân khu, diện tích, pháp lý, thanh toán và thời điểm.", "These are SGS LAND reference figures; actual prices vary by phase, size, legal status, payment terms and date.")} />
          <div className="grid gap-4 md:grid-cols-3">
            {priceRows.map((row) => <div key={row.k} className="rounded-2xl border p-5" style={surface}><p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{row.k}</p><p className="mt-3 text-2xl font-bold tracking-[-.03em]" style={{ color: "var(--sgs-accent-text)" }}>{row.v.replace(" (giá tham khảo)", "")}</p><p className="mt-3 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Giá tham khảo · cần xác nhận theo sản phẩm", "Reference price · verify for the specific property")}</p></div>)}
          </div>
           <div className="mt-5 flex items-start gap-3 rounded-2xl border p-5" style={{ ...surface, background: "var(--ui-surface-subtle)" }}><FileSearch className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sgs-accent-text)" }} /><p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{tt(lang, "SGS LAND không phát hành bảng giá chính thức từ các mức trên. Hãy yêu cầu bảng giá, chính sách thanh toán và tình trạng sản phẩm có ngày cập nhật trước khi đặt cọc.", "SGS LAND does not issue an official price list from these figures. Request dated pricing, payment terms and property availability before placing a deposit.")}</p></div>
        </section>

        <section id="tien-ich" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow={tt(lang, "05 · Tiện ích & kết nối", "05 · Amenities & connectivity")} title={tt(lang, "Tiện ích cần đọc theo trạng thái", "Read amenities by status")} intro={tt(lang, "Không gộp tiện ích quảng bá với tiện ích đã vận hành; mỗi hạng mục cần được kiểm tra tại đúng phân khu.", "Do not mix advertised amenities with operating amenities; check each item in the relevant phase.")} />
           <div className="grid gap-5 md:grid-cols-2">{(englishConfig?.amenities || config?.amenities || []).map((group) => <div key={group.title} className="rounded-2xl border p-6" style={surface}><div className="flex items-center gap-2"><Sparkles className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{group.title}</h3></div><ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{group.items.map((item) => <li key={item} className="flex gap-2"><ArrowRight className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{item}</li>)}</ul></div>)}</div>
        </section>

        <section id="tham-dinh" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow={tt(lang, "06 · Khung thẩm định", "06 · Due diligence")} title={tt(lang, "Cần kiểm tra gì trước khi quyết định?", "What should you verify before deciding?")} intro={tt(lang, "Một checklist trung lập giúp người mua tự kiểm tra thay vì dựa vào một kết luận mua hoặc đầu tư chung.", "A neutral checklist helps buyers verify facts instead of relying on a blanket purchase or investment conclusion.")} />
          <div className="grid gap-4 sm:grid-cols-3">
             {[["01", tt(lang, "Hồ sơ pháp lý", "Legal documents"), tt(lang, "Đối chiếu quy hoạch, hợp đồng, thế chấp, nghĩa vụ tài chính và điều kiện cấp giấy của đúng sản phẩm.", "Cross-check planning, contracts, mortgages, financial obligations and certificate conditions for the specific property."), FileSearch], ["02", tt(lang, "Giá & dòng tiền", "Price & cash flow"), tt(lang, "So sánh giá có ngày, chi phí sở hữu, khả năng vay, thanh khoản và dữ liệu cho thuê nếu có.", "Compare dated prices, ownership costs, borrowing capacity, liquidity and rental data where available."), ClipboardCheck], ["03", tt(lang, "Thực địa & tiến độ", "Site & progress"), tt(lang, "Khảo sát phân khu, tiện ích đã vận hành, tỷ lệ bàn giao và thông báo mới nhất của chủ thể liên quan.", "Survey the phase, operating amenities, handover rate and latest notices from relevant parties."), Building2]].map(([number, title, text, Icon]) => <div key={String(number)} className="rounded-2xl border p-5" style={surface}><span className="text-xs font-bold" style={{ color: "var(--sgs-accent-text)" }}>{number}</span><Icon className="mt-4 h-5 w-5" style={{ color: "var(--ui-brand)" }} /><h3 className="mt-3 font-bold" style={{ color: "var(--text-primary)" }}>{String(title)}</h3><p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{String(text)}</p></div>)}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
           <SectionHeading eyebrow={tt(lang, "07 · FAQ", "07 · FAQ")} title={`${tt(lang, "Câu hỏi thường gặp về", "Frequently asked questions about")} ${displayTitle}`} intro={tt(lang, "Các câu trả lời được viết để trả lời trực tiếp, nhưng không thay thế hồ sơ gốc hoặc tư vấn chuyên môn độc lập.", "Answers are written directly but do not replace source documents or independent professional advice.")} />
           <div className="space-y-3">{(englishConfig?.faqs || englishCopy?.faq || landing.faq).map((item) => <details key={item.q} className="group rounded-2xl border px-5 py-4" style={surface}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold" style={{ color: "var(--text-primary)" }}>{item.q}<ArrowRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" style={{ color: "var(--sgs-accent-text)" }} /></summary><p className="mt-3 max-w-4xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{item.a}</p></details>)}</div>
        </section>

        <section id="lien-he" className="scroll-mt-20 rounded-3xl p-6 sm:p-9" style={{ background: "var(--ui-brand)", color: "var(--ui-on-brand)" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] opacity-75">{tt(lang, "Bước tiếp theo", "Next step")}</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">{tt(lang, "Cần kiểm tra", "Need to verify")} {displayTitle} {tt(lang, "theo sản phẩm cụ thể?", "for a specific property?")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">{tt(lang, "Gửi nhu cầu để nhận thông tin tham khảo. Giá, pháp lý, tiến độ và tư cách phân phối vẫn cần được xác nhận bằng tài liệu hiện hành.", "Send your request for reference information. Pricing, legal status, progress and distribution status must be confirmed with current documents.")}</p></div><a href="tel:+84971132378" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold" style={{ color: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> 0971 132 378</a></div>
        </section>

        {config?.relatedProjects && config.relatedProjects.length > 0 && <section className="py-12"><SectionHeading eyebrow={tt(lang, "Đọc thêm", "Read more")} title={tt(lang, "Dự án và khu vực liên quan", "Related projects and areas")} /><div className="flex flex-wrap gap-3">{config.relatedProjects.map((related) => <Link key={related.slug} href={`/du-an/${related.slug}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" style={surface}><Building2 className="h-4 w-4" style={{ color: "var(--sgs-accent-text)" }} />{related.name}<ArrowRight className="h-4 w-4" /></Link>)}</div></section>}
      </div>
    </main>
  );
}

export function ProjectDetailPage({ project, slug, config, landingProject }: Props) {
  if (["aqua-city", "the-global-city", "izumi-city", "vinhomes-grand-park", "vinhomes-central-park", "diamond-sky-van-phuc-city", "manhattan", "thu-thiem", "son-kim-land", "vinhomes-can-gio", "sala", "vinhomes-hoc-mon", "masteri-park-place", "masteri-cosmo-central", "eco-retreat-long-an", "legacy-66", "nha-pho-trung-tam", "bat-dong-san-thu-duc", "bat-dong-san-long-thanh", "bat-dong-san-binh-thanh", "bat-dong-san-quan-7", "bat-dong-san-long-an", "bat-dong-san-dong-nai", "bat-dong-san-binh-chanh", "bat-dong-san-can-gio", "bat-dong-san-hoc-mon", "bat-dong-san-binh-duong"].includes(slug) && landingProject) {
    return <RichProjectDetail project={project} config={config} landing={landingProject} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}><Link href="/">Trang chủ</Link><span>/</span><Link href="/du-an">Dự án</Link><span>/</span><span style={{ color: "var(--text-primary)" }}>{project.name}</span></nav>
      <header className="mb-10"><div className="mb-3 flex flex-wrap gap-2">{project.status && <Tag tone="accent">{project.status}</Tag>}{project.legal_status && <Tag>{project.legal_status}</Tag>}</div><h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>{project.name}</h1>{project.location && <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><MapPin className="h-4 w-4" />{project.location}{project.developer && ` · ${project.developer}`}</p>}<p className="answer-box mt-5 max-w-3xl text-base leading-7" role="note" style={{ color: "var(--text-secondary)" }}>{project.description || config?.heroDescription}</p></header>
      {config?.details && <section className="mb-12"><SectionHeading eyebrow="Thông tin dự án" title="Thông tin chi tiết" /><div className="grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2" style={{ ...surface, background: "var(--border-default)" }}>{config.details.map((detail) => <div key={detail.label} className="flex justify-between gap-4 p-4" style={{ background: "var(--bg-elevated)" }}><span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{detail.label}</span><strong className="text-right text-sm" style={{ color: "var(--text-primary)" }}>{detail.value}</strong></div>)}</div></section>}
      {config?.faqs && <section id="faq" className="mb-12"><SectionHeading eyebrow="FAQ" title="Câu hỏi thường gặp" /><div className="space-y-3">{config.faqs.map((faq) => <details key={faq.q} className="rounded-2xl border px-5 py-4" style={surface}><summary className="cursor-pointer text-sm font-bold" style={{ color: "var(--text-primary)" }}>{faq.q}</summary><p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{faq.a}</p></details>)}</div></section>}
      <div className="rounded-2xl p-6" style={{ background: "var(--ui-surface-subtle)" }}><h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Tìm hiểu thêm về {project.name}</h2><a href="tel:+84971132378" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> Liên hệ SGS LAND</a></div>
    </main>
  );
}