import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL, getBreadcrumbSchema } from "@/lib/schema";
import {
  EXPERTS,
  getExpertBySlug,
  getExpertSlugs,
} from "@/data/experts";

export function generateStaticParams() {
  return getExpertSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const expert = getExpertBySlug(slug);
  if (!expert) return { title: "Không tìm thấy chuyên gia" };
  const title = `${expert.name} - ${expert.title} | SGS LAND`;
  const url = `${SITE_URL}/chuyen-gia/${expert.slug}`;
  return {
    title,
    description: expert.desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: expert.desc,
      url,
      type: "profile",
    },
  };
}

export default async function ExpertProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const expert = getExpertBySlug(slug);
  if (!expert) notFound();

  const url = `${SITE_URL}/chuyen-gia/${expert.slug}`;
  const breadcrumb = getBreadcrumbSchema([
    { name: "Chuyên gia", url: `${SITE_URL}/chuyen-gia` },
    { name: expert.name, url },
  ]);

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: expert.name,
    jobTitle: expert.title,
    description: expert.desc,
    url,
    worksFor: {
      "@type": "Organization",
      name: "SGS LAND",
      url: SITE_URL,
    },
    knowsAbout: expert.spec.split(",").map((s) => s.trim()).filter(Boolean),
  };

  const others = EXPERTS.filter((e) => e.slug !== expert.slug).slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />

      <nav className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        <Link href="/">Trang chủ</Link>
        {" / "}
        <Link href="/chuyen-gia">Chuyên gia</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>{expert.name}</span>
      </nav>

      <header className="mb-10">
        <p
          className="text-sm font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--primary-600)" }}
        >
          Chuyên gia BĐS SGS LAND
        </p>
        <h1
          className="text-4xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {expert.name}
        </h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          {expert.title}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="p-5 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Kinh nghiệm
          </p>
          <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {expert.exp}
          </p>
        </div>
        <div className="p-5 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Chuyên môn
          </p>
          <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {expert.spec}
          </p>
        </div>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Giới thiệu
        </h2>
        <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {expert.desc}
        </p>
      </section>

      <div className="flex flex-wrap gap-3 mb-16">
        <Link
          href="/contact"
          className="px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: "var(--primary-600)" }}
        >
          Tư vấn miễn phí
        </Link>
        <Link
          href="/chuyen-gia"
          className="px-6 py-3 rounded-xl font-semibold border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Xem tất cả chuyên gia
        </Link>
      </div>

      {others.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Chuyên gia khác
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {others.map((e) => (
              <Link
                key={e.slug}
                href={`/chuyen-gia/${e.slug}`}
                className="block p-4 rounded-2xl border hover:shadow-md transition"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {e.name}
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {e.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
