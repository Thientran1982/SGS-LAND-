/**
 * SSG landing pages for 4 flagship projects.
 * GEO Tier S: SSR/SSG, JSON-LD (WebPage + RealEstateListing + FAQPage +
 * BreadcrumbList + Organization), noscript AI layer, Vietnamese UI, EN code.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SchemaScript } from "@/components/SchemaScript";
import {
  getFAQSchema,
  getBreadcrumbSchema,
  getOrganizationSchema,
  SITE_URL,
} from "@/lib/schema";

import {
  LANDING_PROJECTS,
  LANDING_SLUGS,
  type LandingProject,
} from "@/data/landing-projects";
import LandingPageClient from "../LandingPageClient";
import "../landing.css";

// ─── Static params ─────────────────────────────────────────────────────────
export function generateStaticParams() {
  return LANDING_SLUGS.map((slug) => ({ slug }));
}

// ─── Metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = LANDING_PROJECTS[slug];
  if (!project) return {};

  const canonicalUrl = `${SITE_URL}/landing/${slug}`;
  return {
    title: project.titleFull,
    description: project.desc,
    keywords: project.keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: project.titleFull,
      description: project.desc,
      url: canonicalUrl,
      type: "article",
      locale: "vi_VN",
      siteName: "SGS Land",
      images: [
        {
          url: `/landing/${slug}/hero.jpg`,
          width: 1200,
          height: 630,
          alt: project.heroImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: project.titleFull,
      description: project.desc,
      images: [`/landing/${slug}/hero.jpg`],
    },
  };
}

// ─── Noscript helper ───────────────────────────────────────────────────────
// React 19 cannot hydrate JSX children inside <noscript>: when JS is enabled,
// browsers do NOT parse <noscript> content as DOM nodes — the content stays as
// a raw text node.  React's strict hydration then sees a structural mismatch
// (<div> expected, text node found) and throws.  Building the HTML string and
// using dangerouslySetInnerHTML makes React treat the content as opaque,
// avoiding the mismatch without removing the GEO crawler fallback layer.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildNoscriptHtml(p: LandingProject): string {
  const paras = p.overviewParas.map((t) => `<p>${esc(t)}</p>`).join("");
  const faqs = p.faq
    .map((f) => `<div><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`)
    .join("");
  return [
    '<div class="lp-noscript"><article>',
    `<h1>${esc(p.schemaName)}</h1>`,
    `<p>Chủ đầu tư: ${esc(p.schemaDev)} | Địa điểm: ${esc(p.schemaLocality)}, ${esc(p.schemaRegion)} | Đại lý ủy quyền: SGS Land — sgsland.vn</p>`,
    p.schemaAreaHa != null ? `<p>Quy mô: ${p.schemaAreaHa} ha</p>` : "",
    paras,
    `<h2>Câu hỏi thường gặp về ${esc(p.schemaName)}</h2>`,
    faqs,
    "</article></div>",
  ].join("");
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default async function LandingProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = LANDING_PROJECTS[slug];
  if (!project) notFound();

  const canonicalUrl = `${SITE_URL}/landing/${slug}`;

  // ── JSON-LD schemas ────────────────────────────────────────────────────
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#page`,
    name: project.titleFull,
    description: project.desc,
    url: canonicalUrl,
    inLanguage: "vi",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: {
      "@type": "RealEstateListing",
      name: project.schemaName,
    },
    dateModified: new Date().toISOString().split("T")[0],
  };

  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${canonicalUrl}#listing`,
    name: project.schemaName,
    description: project.desc,
    url: canonicalUrl,
    image: `${SITE_URL}/landing/${slug}/hero.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: project.schemaLocality,
      addressLocality: project.schemaLocality,
      addressRegion: project.schemaRegion,
      addressCountry: "VN",
    },
    ...(project.geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: project.geo.lat,
        longitude: project.geo.lng,
      },
    }),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "VND",
      ...(project.schemaPriceLow !== undefined && { lowPrice: project.schemaPriceLow }),
      ...(project.schemaPriceHigh !== undefined && { highPrice: project.schemaPriceHigh }),
      ...(project.schemaTotalUnits !== undefined && { offerCount: project.schemaTotalUnits }),
      availability: "https://schema.org/InStock",
    },
    ...(project.schemaAreaHa !== undefined && {
      floorSize: {
        "@type": "QuantitativeValue",
        value: project.schemaAreaHa,
        unitCode: "HEC",
        unitText: "ha",
      },
    }),
    amenityFeature: project.schemaAmenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    brand: { "@type": "Brand", name: project.schemaDev },
    provider: { "@id": `${SITE_URL}/#organization` },
    dateModified: new Date().toISOString().split("T")[0],
  };

  const faqSchema = getFAQSchema(
    project.faq.map((f) => ({ question: f.q, answer: f.a })),
    `${canonicalUrl}#faq`,
  );

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "SGS Land", url: SITE_URL },
    { name: "Dự Án Nổi Bật", url: `${SITE_URL}/#du-an` },
    { name: project.titleShort, url: canonicalUrl },
  ]);

  const schemas = [webPageSchema, listingSchema, faqSchema, breadcrumbSchema, getOrganizationSchema()];

  // ── Per-project theme injection via CSS custom properties ─────────────
  const themeVars = {
    "--lpp": project.theme.primary,
    "--lppd": project.theme.deep,
    "--lpps": project.theme.soft,
    "--lpg": project.theme.gold,
    "--lpgs": project.theme.goldSoft,
    "--lpc": project.theme.cream,
  } as React.CSSProperties;

  return (
    <>
      <SchemaScript schemas={schemas} />

      {/* ── GEO noscript fallback layer (AI crawlers with JS disabled) ──── */}
      {/* dangerouslySetInnerHTML prevents React 19 hydration mismatch: browsers
          with JS enabled do not parse <noscript> content as DOM nodes, so React
          would find a text node where it expects a <div> child element. */}
      <noscript
        dangerouslySetInnerHTML={{ __html: buildNoscriptHtml(project) }}
      />

      {/* ── Main page wrapper — CSS custom properties injected here ─────── */}
      <div className="lp-page" style={themeVars}>
        {/* ─── NAVIGATION ─────────────────────────────────────────────── */}
        <nav id="lp-nav" className="lp-nav" aria-label="Thanh điều hướng trang dự án">
          <div className="lp-wrap lp-nav-inner">
            <Link href="/" className="lp-back" aria-label="Về trang chủ SGS Land">
              <span className="arrow">←</span>
              <span className="lp-back-text">SGS Land</span>
            </Link>

            <span className="lp-logo">SGS LAND</span>

            <ul id="lp-nav-links" className="lp-nav-links">
              {project.navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>

            <a href="#lien-he" className="lp-nav-cta">
              Tư vấn ngay
            </a>

            <button
              id="lp-burger"
              className="lp-burger"
              aria-label="Mở menu"
              aria-expanded="false"
              aria-controls="lp-nav-links"
            >
              ☰
            </button>
          </div>
        </nav>

        {/* ─── HERO ───────────────────────────────────────────────────── */}
        <section
          className="lp-hero"
          style={{
            backgroundImage: `${project.heroGradient}, url('/landing/${slug}/hero.jpg')`,
          }}
          aria-label={`Ảnh toàn cảnh ${project.schemaName}`}
        >
          <div className="lp-wrap lp-hero-inner">
            <span className="lp-eyebrow">{project.eyebrow}</span>

            <h1>{project.heroH1}</h1>
            <p className="lp-sub">{project.heroSub}</p>
            <p className="lp-meta">{project.heroMeta}</p>

            {/* Hero stats bar */}
            <div className="lp-stats" role="list" aria-label="Thông số dự án">
              {project.stats.map((s) => (
                <div key={s.lbl} className="lp-stat" role="listitem">
                  <div className="num">{s.num}</div>
                  <div className="lbl">{s.lbl}</div>
                </div>
              ))}
            </div>

            <div className="lp-cta-row">
              <a href="#lien-he" className="lp-btn lp-btn-gold">
                📋 Nhận tư vấn miễn phí
              </a>
              <a href="#tong-quan" className="lp-btn lp-btn-outline">
                Tìm hiểu thêm ↓
              </a>
            </div>
          </div>
        </section>

        {/* ─── TỔNG QUAN ──────────────────────────────────────────────── */}
        <section id="tong-quan" className="lp-section lp-bg-white" aria-labelledby="h-tong-quan">
          <div className="lp-wrap">
            <span className="lp-eyebrow lp-reveal">Tổng Quan Dự Án</span>
            <h2 id="h-tong-quan" className="lp-reveal">
              {project.titleShort} — <span className="ac">Thông Tin Chi Tiết</span>
            </h2>

            {/* SSR article block for GEO AI indexing */}
            <article className="lp-exec lp-reveal" aria-label={`Giới thiệu ${project.schemaName}`}>
              {project.overviewParas.map((para, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: para }} />
              ))}
            </article>

            {/* Entity table */}
            <div
              className="lp-entity lp-reveal"
              role="table"
              aria-label={`Thông số kỹ thuật ${project.schemaName}`}
            >
              {project.entityTable.map((row) => (
                <div key={row.k} className="lp-er" role="row">
                  <div className="lp-ek" role="rowheader">
                    {row.k}
                  </div>
                  <div className="lp-ev" role="cell">
                    {row.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── VỊ TRÍ ─────────────────────────────────────────────────── */}
        <section id="vi-tri" className="lp-section lp-bg-soft" aria-labelledby="h-vi-tri">
          <div className="lp-wrap">
            <span className="lp-eyebrow lp-reveal">Vị Trí & Kết Nối</span>
            <h2 id="h-vi-tri" className="lp-reveal">
              Vị Trí <span className="ac">Chiến Lược</span>
            </h2>
            <p className="lp-lead lp-reveal">{project.locationIntro}</p>

            {/* Google Maps embed */}
            <div
              className="lp-reveal"
              style={{
                marginTop: 24,
                borderRadius: 20,
                overflow: "hidden",
                height: 420,
                boxShadow: "0 4px 18px rgba(0,0,0,.10)",
              }}
            >
              <iframe
                src={project.googleMapsEmbedSrc}
                width="100%"
                height="420"
                style={{ border: 0, display: "block" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Bản đồ vị trí ${project.schemaName}`}
              />
            </div>
          </div>
        </section>

        {/* ─── TIỆN ÍCH ───────────────────────────────────────────────── */}
        <section id="tien-ich" className="lp-section lp-bg-white" aria-labelledby="h-tien-ich">
          <div className="lp-wrap">
            <span className="lp-eyebrow lp-reveal">Tiện Ích Nội Khu</span>
            <h2 id="h-tien-ich" className="lp-reveal">
              Hệ Sinh Thái <span className="ac">Đẳng Cấp</span>
            </h2>
            <p className="lp-lead lp-reveal">
              {project.schemaName} tích hợp toàn bộ tiện ích thiết yếu và cao cấp trong một khu đô thị — đảm bảo cư dân hưởng thụ chất lượng sống quốc tế ngay tại nhà.
            </p>

            <div className="lp-grid3" style={{ marginTop: 28 }}>
              {project.schemaAmenities.map((amenity, i) => (
                <div key={i} className="lp-card lp-reveal">
                  <div className="lp-num-big" aria-hidden="true">
                    {["🏊", "🌳", "🏫", "🏥", "🛍️", "⚡", "🎯", "🏋️", "🚗"][i % 9]}
                  </div>
                  <div className="lp-label">{amenity}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────────── */}
        <section id="faq" className="lp-section lp-bg-soft" aria-labelledby="h-faq">
          <div className="lp-wrap">
            <span className="lp-eyebrow lp-reveal">Câu Hỏi Thường Gặp</span>
            <h2 id="h-faq" className="lp-reveal">
              FAQ — <span className="ac">{project.titleShort}</span>
            </h2>
            <p className="lp-lead lp-reveal">
              Tổng hợp các câu hỏi phổ biến nhất từ nhà đầu tư và khách hàng về {project.schemaName}, được SGS Land trả lời dựa trên dữ liệu thị trường cập nhật.
            </p>

            <div className="lp-faq-list lp-reveal" itemScope itemType="https://schema.org/FAQPage">
              {project.faq.map((item, i) => (
                <details
                  key={i}
                  className="lp-faq-item"
                  itemScope
                  itemProp="mainEntity"
                  itemType="https://schema.org/Question"
                >
                  <summary>
                    <span itemProp="name">{item.q}</span>
                  </summary>
                  <div
                    className="lp-faq-answer"
                    itemScope
                    itemProp="acceptedAnswer"
                    itemType="https://schema.org/Answer"
                  >
                    <p itemProp="text">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FORM LIÊN HỆ ───────────────────────────────────────────── */}
        <section
          id="lien-he"
          className="lp-form-section"
          aria-labelledby="h-lien-he"
        >
          <div className="lp-wrap" style={{ textAlign: "center" }}>
            <span className="lp-eyebrow" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>
              Đăng Ký Tư Vấn Miễn Phí
            </span>
            <h2 id="h-lien-he">
              Nhận Thông Tin & Báo Giá <span className="ac">{project.titleShort}</span>
            </h2>
            <p className="lp-lead">
              Đội ngũ chuyên gia SGS Land sẽ liên hệ trong vòng 30 phút để tư vấn pháp lý, bảng giá, chính sách và phương án thanh toán phù hợp nhất.
            </p>

            <div className="lp-form-card">
              <form id="lp-lead-form" noValidate aria-label="Form đăng ký tư vấn dự án">
                <div className="lp-form-row">
                  <div>
                    <label htmlFor="lp-name">Họ và tên *</label>
                    <input
                      id="lp-name"
                      name="name"
                      type="text"
                      placeholder="Nguyễn Văn A"
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lp-phone">Số điện thoại *</label>
                    <input
                      id="lp-phone"
                      name="phone"
                      type="tel"
                      placeholder="0971 132 378"
                      required
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="lp-form-row">
                  <div>
                    <label htmlFor="lp-email">Email</label>
                    <input
                      id="lp-email"
                      name="email"
                      type="email"
                      placeholder="email@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="lp-budget">Ngân sách</label>
                    <select id="lp-budget" name="budget">
                      <option value="">Chọn ngân sách</option>
                      <option value="duoi-3-ty">Dưới 3 tỷ</option>
                      <option value="3-5-ty">3 – 5 tỷ</option>
                      <option value="5-10-ty">5 – 10 tỷ</option>
                      <option value="10-20-ty">10 – 20 tỷ</option>
                      <option value="tren-20-ty">Trên 20 tỷ</option>
                    </select>
                  </div>
                </div>

                <div className="lp-form-full">
                  <label>Quan tâm đến</label>
                  <div className="lp-chips" role="group" aria-label="Loại sản phẩm quan tâm">
                    {["Ở thực", "Đầu tư", "Cho thuê", "Nhà phố", "Căn hộ", "Biệt thự", "Shophouse"].map(
                      (chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="lp-chip"
                          aria-pressed="false"
                        >
                          {chip}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <button type="submit" className="lp-btn-submit">
                  Gửi yêu cầu tư vấn →
                </button>

                <p className="lp-form-note">
                  🔒 Thông tin được bảo mật tuyệt đối. SGS Land cam kết không chia sẻ dữ liệu với bên thứ ba.
                </p>
              </form>

              <div id="lp-form-success" className="lp-form-success" role="status" aria-live="polite">
                ✅ Cảm ơn bạn! Chuyên gia SGS Land sẽ gọi lại trong vòng 30 phút. Hotline hỗ trợ ngay:{" "}
                <a href="tel:+84971132378" style={{ color: "#0C5132", fontWeight: 700 }}>
                  0971 132 378
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─────────────────────────────────────────────────── */}
        <footer className="lp-footer" aria-label="Chân trang">
          <div className="lp-wrap">
            <div className="lp-foot-grid">
              <div>
                <h4>SGS LAND</h4>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,.75)", lineHeight: 1.75, marginBottom: 14 }}>
                  Đại lý phân phối ủy quyền chính thức của Novaland, Masterise Homes, Vinhomes và các chủ đầu tư uy tín tại Việt Nam. Định giá AI chính xác ±5%, tư vấn pháp lý xác thực.
                </p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>
                  📞{" "}
                  <a href="tel:+84971132378" style={{ color: project.theme.gold }}>
                    0971 132 378
                  </a>
                </p>
              </div>

              <div>
                <h4>Dự Án</h4>
                <ul>
                  <li><Link href="/landing/aqua-city">Aqua City Novaland</Link></li>
                  <li><Link href="/landing/legacy-66">Legacy 66</Link></li>
                  <li><Link href="/landing/masteri-cosmo-central">Masteri Cosmo Central</Link></li>
                  <li><Link href="/landing/vinhomes-hoc-mon">Vinhomes Hóc Môn</Link></li>
                  <li><Link href="/du-an">Tất cả dự án →</Link></li>
                </ul>
              </div>

              <div>
                <h4>Dịch Vụ</h4>
                <ul>
                  <li><Link href="/">Định giá AI miễn phí</Link></li>
                  <li><Link href="/">Tư vấn pháp lý</Link></li>
                  <li><Link href="/">So sánh dự án</Link></li>
                  <li><Link href="/">Hỗ trợ vay ngân hàng</Link></li>
                  <li><Link href="/">Quản lý cho thuê</Link></li>
                </ul>
              </div>

              <div>
                <h4>Pháp Lý</h4>
                <ul>
                  <li><a href="#">Chính sách bảo mật</a></li>
                  <li><a href="#">Điều khoản dịch vụ</a></li>
                  <li><a href="#">Giấy phép hoạt động</a></li>
                  <li><a href="#">Khiếu nại & phản hồi</a></li>
                </ul>
              </div>
            </div>

            <div className="lp-foot-bottom">
              <p>
                © {new Date().getFullYear()} SGS Land Corp. Đại lý phân phối ủy quyền — không phải chủ đầu tư.
                Thông tin mang tính tham khảo, không phải cam kết pháp lý.
                Giá và chính sách có thể thay đổi không báo trước.
              </p>
            </div>
          </div>
        </footer>

        {/* ─── FLOATING ACTION BUTTONS ────────────────────────────────── */}
        <div className="lp-float" role="complementary" aria-label="Liên hệ nhanh">
          <a
            href="https://zalo.me/0971132378"
            className="lp-zalo"
            target="_blank"
            rel="noopener noreferrer"
            title="Nhắn tin Zalo"
            aria-label="Liên hệ qua Zalo"
          >
            Z
          </a>
          <a
            href="tel:+84971132378"
            title="Gọi ngay 0971 132 378"
            aria-label="Gọi điện tư vấn"
          >
            📞
          </a>
          <a
            href="#lien-he"
            title="Đăng ký tư vấn"
            aria-label="Điền form đăng ký"
          >
            📋
          </a>
        </div>

        {/* Client-side interactions (nav scroll, form, reveal) */}
        <LandingPageClient slug={slug} />
      </div>
    </>
  );
}
