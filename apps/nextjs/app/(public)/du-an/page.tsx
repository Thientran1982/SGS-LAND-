import type { Metadata } from "next";
import { ALL_PROJECTS } from "@/data/projects";
import ProjectDirectoryClient from "@/components/public/ProjectDirectoryClient";
import { getLang, langAlternates } from "@/lib/lang";
import { PROJECT_DETAIL_EN } from "@/data/project-detail-en";
import { normalizeMetaDescription } from "@/lib/seo/meta-utils";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/du-an" : "/du-an"}`;
  return {
    title: { absolute: en ? "Real Estate Projects in HCMC & Nearby Areas | SGS LAND" : "Dự Án Bất Động Sản TP.HCM & Vùng Ven | SGS LAND" },
    description: normalizeMetaDescription(en
      ? "Explore reference information for projects in Ho Chi Minh City, Dong Nai, Binh Duong, Long An and nearby areas. Verify current pricing, legal status and availability before making decisions."
      : "Khám phá thông tin tham khảo về các dự án tại TP.HCM, Đồng Nai, Bình Dương, Long An và khu vực lân cận. Xác minh giá, pháp lý và tình trạng sản phẩm trước khi quyết định.",
      en ? " Verify current pricing, legal status and availability before making a decision." : " Xác minh giá, pháp lý và tình trạng sản phẩm trước khi quyết định giao dịch."),
    alternates: { canonical, ...langAlternates("/du-an") },
    openGraph: {
      type: "website",
      title: en ? "Real Estate Projects in HCMC & Nearby Areas | SGS LAND" : "Dự Án Bất Động Sản TP.HCM & Vùng Ven | SGS LAND",
      description: en
        ? "Compare reference projects, locations, legal status and current availability across HCMC and nearby markets."
        : "So sánh dự án, vị trí, pháp lý và tình trạng sản phẩm tham khảo tại TP.HCM cùng các thị trường vùng ven.",
      url: canonical,
      images: [{ url: "https://sgsland.vn/og-image.jpg", width: 1200, height: 630, alt: "SGS LAND real estate projects" }],
    },
  };
}
export const dynamic = "force-dynamic";

const HOT = new Set(["aqua-city", "the-global-city", "vinhomes-can-gio", "vinhomes-hoc-mon", "masteri-cosmo-central"]);

export default function DuAnPage() {
  const projects = ALL_PROJECTS.map((project) => ({
    slug: project.slug,
    name: project.name,
    dev: project.developer,
    loc: project.location,
    province: project.province,
    scale: project.scale,
    price: project.slug === "aqua-city" ? "Từ 6 tỷ" : project.slug === "diamond-sky-van-phuc-city" ? "Từ 190 triệu/m²" : project.priceRange,
    type: project.projectType,
    typeGroup: project.typeGroup,
    badge: project.status,
    hot: HOT.has(project.slug),
    img: project.img,
    description: project.description,
    en: (() => {
      const detail = PROJECT_DETAIL_EN[project.slug];
      const entity = Object.fromEntries((detail?.entityTable || []).map((row) => [row.k, row.v]));
      return {
        dev: entity.Developer || project.developer,
        loc: entity.Location || project.location,
        scale: entity.Scale || project.scale,
        type: entity.Type || "See verified product catalog",
        typeGroup: project.typeGroup === "Căn hộ cao cấp" ? "Premium apartments" : "Mixed-use township",
        price: Object.entries(entity)
          .filter(([key]) => /price|townhouse|villa|shophouse|apartment/i.test(key))
          .map(([, value]) => value)
          .join("; ") || "Reference pricing — verify current data",
        description: detail?.desc,
      };
    })(),
  }));

  return <ProjectDirectoryClient projects={projects} />;
}