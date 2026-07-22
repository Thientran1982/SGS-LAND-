// @ts-nocheck
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MiniSiteProjectPage } from "@/components/public/MiniSiteProjectPage";
// ─── ISR — Mini-site projects (Cosmo Central, etc.) ──────
export const dynamic = "force-dynamic";

// ─── Metadata ─────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/projects/${code}`,
      { next: { revalidate: 300 } }
    );
    if (res.ok) {
      const data = await res.json();
      project = data.project ?? null;
    }
  } catch {}
  const name = project?.name ?? code.toUpperCase();
  const loc = project?.location ?? "TP.HCM";
  return {
    title: `${name} | Dự án BĐS`,
    description: `${name} — ${loc}. Xem danh sách căn hộ, bảng giá và thông tin chi tiết tại SGS LAND.`,
    alternates: { canonical: `https://sgsland.vn/p/${code}` },
    openGraph: {
      title: `${name}`,
      description: `Dự án ${name} tại ${loc} — xem bảng giá và danh sách căn hộ thực tế.`,
      url: `https://sgsland.vn/p/${code}`,
    },
  };
}
export default async function MiniSitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Fetch from Express → which calls the real project API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectData: any = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/projects/${code}`,
      { next: { revalidate: 300 } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.project) {
        projectData = {
          ...data.project,
          listings: data.listings ?? [],
          listingCount: data.listingCount ?? 0,
          code,
          url: `https://sgsland.vn/p/${code}`,
        };
      }
    }
  } catch {}
  if (!projectData) notFound();

  return <MiniSiteProjectPage project={projectData} />;
}