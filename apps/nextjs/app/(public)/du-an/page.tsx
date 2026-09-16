import type { Metadata } from "next";
import { ALL_PROJECTS } from "@/data/projects";
import ProjectDirectoryClient from "@/components/public/ProjectDirectoryClient";
import { getLang, langAlternates } from "@/lib/lang";
import { PROJECT_DETAIL_EN } from "@/data/project-detail-en";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/du-an" : "/du-an"}`;
  return {
    title: en ? "Real Estate Projects | SGS LAND" : "Dự Án Bất Động Sản | SGS LAND",
    description: en
      ? "Explore reference information for projects in Ho Chi Minh City, Dong Nai, Binh Duong, Long An and nearby areas. Verify current pricing, legal status and availability before making decisions."
      : "Khám phá thông tin tham khảo về các dự án tại TP.HCM, Đồng Nai, Bình Dương, Long An và khu vực lân cận. Xác minh giá, pháp lý và tình trạng sản phẩm trước khi quyết định.",
    alternates: { canonical, ...langAlternates("/du-an") },
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