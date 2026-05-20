import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailPage } from "@/components/public/ProjectDetailPage";
import { SchemaScript } from "@/components/SchemaScript";
import { getRealEstateListingSchema, getBreadcrumbSchema, SITE_URL } from "@/lib/schema";

// ─── Static project data (SEO seed) ──────────────────────
const PROJECT_META: Record<string, { name: string; dev: string; loc: string; desc: string }> = {
  "aqua-city":           { name: "Aqua City Novaland",      dev: "Novaland",          loc: "Biên Hòa, Đồng Nai",       desc: "Đại đô thị sinh thái 1.000ha tại Nhơn Trạch, Đồng Nai. Pháp lý sổ hồng, bàn giao 2024-2025." },
  "the-global-city":     { name: "The Global City",          dev: "Masterise Homes",   loc: "An Phú, TP Thủ Đức",       desc: "Đô thị thương mại 117ha của Masterise Homes, trung tâm tài chính TP Thủ Đức." },
  "izumi-city":          { name: "Izumi City Nam Long",      dev: "Nam Long Group",    loc: "Biên Hòa, Đồng Nai",       desc: "Đô thị tích hợp chuẩn Nhật 170ha, tiêu chuẩn sống quốc tế, giá từ 8,4 tỷ." },
  "vinhomes-can-gio":    { name: "Vinhomes Cần Giờ",         dev: "Vinhomes",          loc: "Cần Giờ, TP.HCM",          desc: "Siêu đô thị lấn biển 2.870ha, tuyến Metro số 4, khu đô thị sinh thái biển đầu tiên Việt Nam." },
  "vinhomes-grand-park": { name: "Vinhomes Grand Park",      dev: "Vinhomes",          loc: "TP Thủ Đức, TP.HCM",       desc: "Siêu đô thị 271ha, 12 công viên chủ đề, Metro số 1, tâm điểm phát triển phía Đông TP.HCM." },
  "vinhomes-central-park":{ name: "Vinhomes Central Park",  dev: "Vinhomes",          loc: "Bình Thạnh, TP.HCM",       desc: "Khu đô thị 43,9ha ven sông Sài Gòn, công viên 10ha, tiện ích đẳng cấp 5 sao." },
  "masterise-homes":     { name: "Masterise Homes",          dev: "Masterise Group",   loc: "TP.HCM",                   desc: "Hệ sinh thái căn hộ hạng sang Masterise Homes tại Quận 1, Quận 2, Bình Thạnh TP.HCM." },
  "lumiere":             { name: "Lumière Riverside",        dev: "Masterise Homes",   loc: "Bình Thạnh, TP.HCM",       desc: "Căn hộ hạng sang ven sông Sài Gòn, tầm nhìn panorama, tiện ích 5 sao." },
  "waterpoint":          { name: "Waterpoint Nam Long",      dev: "Nam Long Group",    loc: "Bến Lức, Long An",          desc: "Đô thị sông nước 355ha, vị trí cửa ngõ TP.HCM, pháp lý minh bạch sổ hồng từng căn." },
  "the-privia":          { name: "The Privia Khang Điền",    dev: "Khang Điền",        loc: "Bình Tân, TP.HCM",         desc: "Khu căn hộ cao cấp 7.5ha, tiện ích nội khu đẳng cấp, pháp lý sổ hồng." },
  "van-phuc-city":       { name: "Văn Phúc City",            dev: "Văn Phúc Group",    loc: "Thủ Đức, TP.HCM",          desc: "Khu đô thị phức hợp 198ha ven sông Sài Gòn, tiêu chuẩn quốc tế, pháp lý sổ hồng." },
  "sala":                { name: "Sala Đại Quang Minh",      dev: "Đại Quang Minh",    loc: "TP Thủ Đức, TP.HCM",       desc: "Khu đô thị ven sông 98ha, trung tâm thương mại, căn hộ và nhà phố cao cấp." },
  "thu-thiem":           { name: "Thủ Thiêm",                dev: "Nhiều CĐT",         loc: "TP Thủ Đức, TP.HCM",       desc: "Trung tâm tài chính - thương mại mới của TP.HCM, 657ha, nhiều dự án hạng sang." },
  "manhattan":           { name: "Manhattan",                 dev: "Hưng Thịnh Land",  loc: "Quận 7, TP.HCM",           desc: "Khu căn hộ cao tầng 5,1ha tại Quận 7, tiện ích đầy đủ, gần Phú Mỹ Hưng." },
  "son-kim-land":        { name: "Sơn Kim Land",              dev: "Sơn Kim Group",     loc: "TP.HCM",                   desc: "Hệ sinh thái BĐS cao cấp Sơn Kim Land tại TP.HCM, pháp lý minh bạch." },
  "nha-pho-trung-tam":   { name: "Nhà Phố Trung Tâm",        dev: "Nhiều CĐT",         loc: "TP.HCM",                   desc: "Danh mục nhà phố, biệt thự khu trung tâm TP.HCM — pháp lý sổ hồng, vị trí đắc địa." },
};

// ─── Generate static paths ────────────────────────────────
export async function generateStaticParams() {
  // Pre-generate known project slugs at build time
  return Object.keys(PROJECT_META).map((slug) => ({ slug }));
}

// ─── Metadata ─────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = PROJECT_META[slug];

  const title = meta
    ? `${meta.name} | Dự án BĐS | SGS LAND`
    : `Dự án ${slug} | SGS LAND`;
  const description = meta?.desc ?? "Thông tin chi tiết dự án bất động sản tại SGS LAND.";

  return {
    title,
    description,
    alternates: { canonical: `https://sgsland.vn/du-an/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://sgsland.vn/du-an/${slug}`,
      images: [{ url: `/images/projects/${slug}.jpg`, width: 1200, height: 630 }],
    },
  };
}

// ─── ISR — revalidate every 6 hours ──────────────────────
export const revalidate = 21600;

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Fetch project data from Express backend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/projects/${slug}`,
      { next: { revalidate: 21600 } }
    );
    if (res.ok) {
      const data = await res.json();
      project = data.project ?? null;
    }
  } catch {
    // Fallback to static meta
  }

  // If no project found anywhere, 404
  if (!project && !PROJECT_META[slug]) {
    notFound();
  }

  const meta = PROJECT_META[slug];
  const projectData = project ?? {
    name: meta?.name ?? slug,
    developer: meta?.dev ?? "",
    location: meta?.loc ?? "",
    description: meta?.desc ?? "",
    slug,
  };

  const listingSchema = getRealEstateListingSchema({
    name: projectData.name,
    slug,
    description: projectData.description,
    location: projectData.location,
    developer: projectData.developer,
    images: projectData.images,
    amenities: projectData.amenities,
    total_units: projectData.total_units ?? projectData.listing_count,
  });

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Dự án BĐS", url: `${SITE_URL}/du-an` },
    { name: projectData.name, url: `${SITE_URL}/du-an/${slug}` },
  ]);

  return (
    <>
      {/* Page-specific JSON-LD: RealEstateListing + BreadcrumbList */}
      <SchemaScript schemas={[listingSchema, breadcrumbSchema]} />
      <ProjectDetailPage project={projectData} slug={slug} />
    </>
  );
}
