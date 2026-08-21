import type { Metadata } from "next";
import { ALL_PROJECTS } from "@/data/projects";
import ProjectDirectoryClient from "@/components/public/ProjectDirectoryClient";

export const metadata: Metadata = {
  title: "Dự Án Bất Động Sản",
  description: "Khám phá các dự án BĐS lớn nhất TP.HCM, Đồng Nai, Bình Dương, Long An. Aqua City, The Global City, Vinhomes, Masterise Homes và nhiều dự án nổi bật khác.",
  alternates: { canonical: "https://sgsland.vn/du-an", languages: { "vi-VN": "https://sgsland.vn/du-an", "en-US": "https://sgsland.vn/en/du-an", "x-default": "https://sgsland.vn/du-an" } },
};
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
  }));

  return <ProjectDirectoryClient projects={projects} />;
}