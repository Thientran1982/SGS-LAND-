/**
 * Public viewer for AI-generated landing pages (landing_pages table, built via
 * the landing_builder chat tool). URL: /landing-ai/<slug>.
 *
 * Layout contract: reuse the shared ProjectDetailPage (the same layout as
 * /du-an/aqua-city). Any future layout change on project pages automatically
 * applies here - do NOT fork the markup in this file.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailPage } from "@/components/public/ProjectDetailPage";
import type { LandingProject } from "@/data/landing-projects";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";

interface LandingSection {
  stage: string;
  title?: string;
  body?: string;
  items?: string[];
  phone?: string;
  contactName?: string;
  tokens: number;
}

interface GeneratedLandingPage {
  id: string;
  project_name: string;
  slug: string;
  brochure_name: string | null;
  sections: LandingSection[];
  status: string;
  language: string;
  updated_at: string;
}

async function fetchLandingPage(slug: string): Promise<GeneratedLandingPage | null> {
  try {
    const res = await fetch(BACKEND_URL + "/api/landing-pages/" + encodeURIComponent(slug), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.page ?? null;
  } catch {
    return null;
  }
}

async function fetchLandingStatus(slug: string): Promise<string | null> {
  try {
    const res = await fetch(BACKEND_URL + "/api/landing-pages/" + encodeURIComponent(slug) + "/status", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.status ?? null;
  } catch {
    return null;
  }
}
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const liveStatus = await fetchLandingStatus(slug);
  if (!liveStatus || (liveStatus !== "published" && sp.preview !== "1")) notFound();
  const page = await fetchLandingPage(slug);
  if (!page) return {};
  const hero = page.sections.find((s) => s.stage === "hero");
  return {
    title: page.project_name,
    description: hero?.body || "Du an bat dong san phan bo boi SGS LAND.",
    robots:
      page.status === "published"
        ? { index: true, follow: true }
        : { index: false, follow: false },
    alternates: { canonical: "/landing-ai/" + page.slug },
  };
}

function pick(pattern: RegExp, text: string): string {
  const m = text.match(pattern);
  return m ? m[1].trim() : "";
}

type PageConfig = {
  heroDescription?: string;
  details?: { label: string; value: string }[];
  amenities?: { title: string; items: string[] }[];
  faqs?: { q: string; a: string }[];
};

/** Map the tool-generated sections onto the shared project-page layout data. */
function buildPageProps(page: GeneratedLandingPage): {
  landing: LandingProject;
  project: { name: string; location?: string; description?: string; images: string[]; videos: string[] };
  config: PageConfig;
  telHref: string;
} {
  const sec = (stage: string) => page.sections.find((s) => s.stage === stage);
  const hero = sec("hero");
  const gallery = sec("gallery");
  const legal = sec("legal");
  const price = sec("price");
  const amenities = sec("amenities");
  const name = page.project_name;
  const heroBody = hero?.body || "";
  const priceBody = price?.body || "";
  const legalBody = legal?.body || "";
  const amenityItems = amenities?.items || [];
  const contact = sec("contact");
  const contactPhoneRaw = (contact?.phone || "").trim();
  const contactName = (contact?.contactName || "").trim();
  const contactDigits = contactPhoneRaw.replace(/\D/g, "");
  const telHref = contactDigits
    ? contactDigits.startsWith("84")
      ? "+" + contactDigits
      : contactDigits.startsWith("0")
        ? "+84" + contactDigits.slice(1)
        : "+" + contactDigits
    : "";
  const area = pick(/([\d]+(?:[.,]\d+)?\s*(?:ha|hecta))/i, heroBody + " " + priceBody);
  const priceFrom = pick(/([\d]+(?:[.,]\d+)?\s*t[ỷy])/i, priceBody);

  const faqs: { q: string; a: string }[] = [];
  if (legalBody) faqs.push({ q: "Pháp lý dự án hiện tại ra sao?", a: legalBody });
  if (priceBody) faqs.push({ q: "Mức giá tham khảo hiện tại?", a: priceBody });
  if (amenityItems.length) {
    faqs.push({ q: "Dự án có những tiện ích nào?", a: amenityItems.join(", ") + "." });
  }

  const stats: { num: string; lbl: string }[] = [];
  if (area) stats.push({ num: area, lbl: "Quy mô" });
  if (priceFrom) stats.push({ num: priceFrom, lbl: "Giá từ" });
  if (amenityItems.length) stats.push({ num: String(amenityItems.length), lbl: "Tiện ích" });

  const landing: LandingProject = {
    slug: page.slug,
    titleFull: name + " — Thông Tin Dự Án | SGS LAND",
    titleShort: name,
    eyebrow: "Dự án từ SGS AI",
    desc: heroBody || name,
    keywords: "",
    heroImageAlt: name,
    heroGradient: "linear-gradient(rgba(6,48,31,.72),rgba(6,48,31,.55))",
    theme: { primary: "#0ea5e9", deep: "#062f25", soft: "#e0f2fe", gold: "#f59e0b", goldSoft: "#fff7e6", cream: "#f8fafc" },
    geo: { lat: 10.95, lng: 106.75 },
    stats,
    heroH1: name,
    heroSub: heroBody,
    heroMeta: heroBody || "Vị trí đang cập nhật",
    overviewParas: [
      name + " — " + heroBody + "." + (gallery?.items?.length ? " Không gian chính: " + gallery.items.join(", ") + "." : ""),
      legalBody || "Thông tin pháp lý đang được cập nhật; hãy kiểm tra hồ sơ gốc trước khi giao dịch.",
    ],
    entityTable: (
      [
        { k: "Tên dự án", v: name },
        heroBody ? { k: "Vị trí / Quy mô", v: heroBody } : null,
        priceBody ? { k: "Giá tham khảo", v: priceBody } : null,
        legalBody ? { k: "Pháp lý", v: legalBody } : null,
        contactName || contactPhoneRaw
          ? { k: "Người liên hệ", v: [contactName, contactPhoneRaw].filter(Boolean).join(" · ") }
          : null,
        page.brochure_name
          ? { k: "Nguồn nội dung", v: "Brochure: " + page.brochure_name }
          : { k: "Nguồn nội dung", v: "SGS AI tổng hợp từ yêu cầu" },
      ].filter(Boolean) as { k: string; v: string }[]
    ),
    locationIntro: heroBody || name,
    googleMapsEmbedSrc: "https://www.google.com/maps?q=" + encodeURIComponent(name + " " + heroBody) + "&output=embed",
    faq: faqs.length ? faqs : [{ q: "Dự án này ở đâu?", a: heroBody || "Đang cập nhật." }],
    navLinks: [
      { href: "#tong-quan", label: "Tổng quan" },
      { href: "#thong-tin", label: "Thông tin" },
      { href: "#vi-tri", label: "Vị trí" },
      { href: "#bang-gia", label: "Bảng giá" },
      { href: "#tien-ich", label: "Tiện ích" },
      { href: "#tham-dinh", label: "Thẩm định" },
      { href: "#faq", label: "FAQ" },
      { href: "#lien-he", label: "Liên hệ" },
    ],
    schemaName: name,
    schemaDev: "",
    schemaLocality: "TP. Hồ Chí Minh",
    schemaRegion: "VN",
    schemaAmenities: amenityItems,
  };

  const project = { name, location: heroBody, description: heroBody, images: [], videos: [] };
  const config: PageConfig = {
    heroDescription: heroBody,
    details: priceBody ? [{ label: "Giá tham khảo", value: priceBody }] : [],
    amenities: amenityItems.length ? [{ title: "Tiện ích & kết nối", items: amenityItems }] : [],
    faqs,
  };
  return { landing, project, config, telHref };
}

export default async function GeneratedLandingView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const liveStatus = await fetchLandingStatus(slug);
  if (!liveStatus || (liveStatus !== "published" && sp.preview !== "1")) notFound();
  const page = await fetchLandingPage(slug);
  if (!page) notFound();
  const { landing, project, config, telHref } = buildPageProps(page);
  return (
    <ProjectDetailPage
      project={project}
      slug={page.slug}
      config={config}
      landingProject={landing}
      forceRich
      lastUpdated={new Date(page.updated_at).toLocaleDateString("vi-VN")}
      contactPhone={telHref}
    />
  );
}
