// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, MapPin, ArrowRight } from "lucide-react";
import { DEVELOPERS, getDeveloper } from "@/data/developers";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return DEVELOPERS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const en = (await getLang()) === "en";
  const d = getDeveloper(slug);
  // notFound() o day chay TRUOC khi stream shell => Next dat duoc status 404 that
  if (!d) notFound();
  const url = en ? `${SITE_URL}/en/chu-dau-tu/${slug}` : `${SITE_URL}/chu-dau-tu/${slug}`;
  return {
    title: en ? `${d.name} — Projects & Distribution | SGS LAND` : `${d.name} — Dự Án & Phân Phối | SGS LAND`,
    description: en ? d.enDesc : d.viDesc,
    alternates: { canonical: url, ...langAlternates(`/chu-dau-tu/${slug}`) },
    openGraph: { title: d.name, description: en ? d.enDesc : d.viDesc, url },
  };
}

export default async function DeveloperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const en = (await getLang()) === "en";
  const d = getDeveloper(slug);
  if (!d) notFound();
  const lp = (p: string) => (en ? "/en" + p : p);

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/chu-dau-tu/${d.slug}#organization`,
    name: d.name,
    description: en ? d.enDesc : d.viDesc,
    url: en ? `${SITE_URL}/en/chu-dau-tu/${d.slug}` : `${SITE_URL}/chu-dau-tu/${d.slug}`,
    areaServed: d.areas,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <SchemaScript
        schemas={[
          getBreadcrumbSchema([
            { name: en ? "Home" : "Trang chủ", url: en ? `${SITE_URL}/en` : SITE_URL },
            { name: en ? "Developers" : "Chủ đầu tư", url: en ? `${SITE_URL}/en/chu-dau-tu` : `${SITE_URL}/chu-dau-tu` },
            { name: d.name, url: en ? `${SITE_URL}/en/chu-dau-tu/${d.slug}` : `${SITE_URL}/chu-dau-tu/${d.slug}` },
          ]),
          orgSchema,
        ]}
      />

      <nav className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
        <Link href={lp("/")} className="hover:opacity-80">{en ? "Home" : "Trang chủ"}</Link>
        <span>/</span>
        <Link href={lp("/chu-dau-tu")} className="hover:opacity-80">{en ? "Developers" : "Chủ đầu tư"}</Link>
        <span>/</span>
        <span>{d.name}</span>
      </nav>

      <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{d.name}</h1>
      <p className="text-lg leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
        {en ? d.enDesc : d.viDesc}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
        <div className="p-4 rounded-2xl text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
          <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{d.projects.length}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{en ? "Projects distributed" : "Dự án phân phối"}</p>
        </div>
        <div className="p-4 rounded-2xl text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
          <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{d.areas.length}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{en ? "Areas covered" : "Khu vực hoạt động"}</p>
        </div>
        {d.partnerSince ? (
          <div className="p-4 rounded-2xl text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--primary-600)" }}>{d.partnerSince}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{en ? "Partner since" : "Đối tác từ"}</p>
          </div>
        ) : null}
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
          {en ? `Projects by ${d.name}` : `Dự án của ${d.name}`}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {d.projects.map((p) => (
            <Link
              key={p.slug}
              href={lp(`/du-an/${p.slug}`)}
              className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:shadow-token-md"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--primary-subtle)" }}>
                <Building2 className="w-5 h-5" style={{ color: "var(--primary-600)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {en ? "SGS LAND — authorised agent" : "SGS LAND — đại lý uỷ quyền"}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
          {en ? "Areas covered" : "Khu vực hoạt động"}
        </h2>
        <div className="flex flex-wrap gap-3">
          {d.areas.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--primary-600)" }} /> {a}
            </span>
          ))}
        </div>
      </section>

      <div className="p-8 rounded-2xl text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {en ? `Need advice on a ${d.name} project?` : `Cần tư vấn dự án ${d.name}?`}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {en
            ? "Developer prices, two-layer legal check and free AI valuation. Our specialists reply within 2 working hours."
            : "Đúng giá gốc chủ đầu tư, kiểm tra pháp lý 2 lớp và định giá AI miễn phí. Chuyên viên phản hồi trong 2 giờ làm việc."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="tel:+84971132378"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--primary-600)" }}
          >
            📞 {en ? "Call" : "Gọi"} +84 971 132 378
          </a>
          <Link
            href={lp("/marketplace")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          >
            {en ? "Browse listings" : "Xem kho bất động sản"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
