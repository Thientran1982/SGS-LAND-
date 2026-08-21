import type { Metadata } from "next";
import ProjectPage, {
  generateMetadata as generateProjectMetadata,
} from "../../du-an/[slug]/page";
import { langAlternates } from "@/lib/lang";

const AREA_SLUGS = new Set([
  "bat-dong-san-quan-7",
  "bat-dong-san-long-an",
  "bat-dong-san-dong-nai",
  "bat-dong-san-binh-thanh",
  "nha-pho-trung-tam",
  "bat-dong-san-thu-duc",
  "bat-dong-san-long-thanh",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!AREA_SLUGS.has(slug)) {
    return generateProjectMetadata({ params });
  }

  const metadata = await generateProjectMetadata({ params });
  const canonical = `https://sgsland.vn/khu-vuc/${slug}`;
  return {
    ...metadata,
    alternates: {
      canonical,
      ...langAlternates(`/khu-vuc/${slug}`),
    },
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
    },
  };
}

export default ProjectPage;
