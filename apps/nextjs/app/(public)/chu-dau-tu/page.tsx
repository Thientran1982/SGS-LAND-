// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { DEVELOPERS } from "@/data/developers";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const url = en ? `${SITE_URL}/en/chu-dau-tu` : `${SITE_URL}/chu-dau-tu`;
  return {
    title: en
      ? "Property Developers in Vietnam | SGS LAND Partners"
      : "Chủ Đầu Tư Bất Động Sản | Đối Tác Của SGS LAND",
    description: en
      ? "Property developers distributed by SGS LAND: Vinhomes, Novaland, Masterise Homes, Nam Long, Van Phuc Group, SonKim Land and Dai Quang Minh — projects, locations and authorised distribution."
      : "Các chủ đầu tư SGS LAND phân phối: Vinhomes, Novaland, Masterise Homes, Nam Long, Vạn Phúc, Sơn Kim Land, Đại Quang Minh — danh sách dự án, khu vực và tình trạng uỷ quyền.",
    alternates: { canonical: url, ...langAlternates("/chu-dau-tu") },
  };
}

export default async function DevelopersPage() {
  const en = (await getLang()) === "en";
  const lp = (p: string) => (en ? "/en" + p : p);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <SchemaScript
        schemas={[
          getBreadcrumbSchema([
            { name: en ? "Home" : "Trang chủ", url: en ? `${SITE_URL}/en` : SITE_URL },
            { name: en ? "Developers" : "Chủ đầu tư", url: en ? `${SITE_URL}/en/chu-dau-tu` : `${SITE_URL}/chu-dau-tu` },
          ]),
        ]}
      />

      <nav className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
        <Link href={lp("/")} className="hover:opacity-80">{en ? "Home" : "Trang chủ"}</Link>
        <span>/</span>
        <span>{en ? "Developers" : "Chủ đầu tư"}</span>
      </nav>

      <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
        {en ? "Property Developers" : "Chủ Đầu Tư Bất Động Sản"}
      </h1>
      <p className="text-lg mb-12 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        {en
          ? "SGS LAND distributes projects from Vietnam's leading developers as an authorised agent. Buyers pay developer prices — advice, the two-layer legal check and AI valuation are free."
          : "SGS LAND phân phối dự án của các chủ đầu tư hàng đầu Việt Nam với tư cách đại lý uỷ quyền. Người mua nhận đúng giá gốc chủ đầu tư — tư vấn, kiểm tra pháp lý 2 lớp và định giá AI đều miễn phí."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DEVELOPERS.map((d) => (
          <Link
            key={d.slug}
            href={lp(`/chu-dau-tu/${d.slug}`)}
            className="p-6 rounded-2xl block transition-all hover:shadow-token-md"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex items-start gap-4 mb-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--primary-subtle)" }}
              >
                <Building2 className="w-5 h-5" style={{ color: "var(--primary-600)" }} />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{d.name}</h2>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {d.projects.length} {en ? "projects distributed" : "dự án đang phân phối"}
                  {d.partnerSince ? ` · ${en ? "partner since" : "đối tác từ"} ${d.partnerSince}` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
              {en ? d.enDesc : d.viDesc}
            </p>
            <span className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: "var(--primary-600)" }}>
              {en ? "View developer" : "Xem chủ đầu tư"} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
