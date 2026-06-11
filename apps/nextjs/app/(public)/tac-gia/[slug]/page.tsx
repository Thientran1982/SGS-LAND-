// @ts-nocheck
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Linkedin, ArrowRight, Calendar, Clock } from "lucide-react";
import { AUTHORS, getAuthorBySlug } from "@/data/authors";
import { ARTICLES } from "@/data/articles";
import { CATEGORIES } from "@/data/categories";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL, ORG_ID } from "@/lib/schema";

export async function generateStaticParams() {
  return AUTHORS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return { title: "Tác giả không tìm thấy | SGS LAND" };
  return {
    title: `${author.name} — ${author.title} | SGS LAND`,
    description: author.bio,
    alternates: { canonical: `${SITE_URL}/tac-gia/${slug}` },
    openGraph: {
      title: `${author.name} | SGS LAND`,
      description: author.bio,
      url: `${SITE_URL}/tac-gia/${slug}`,
      images: [{ url: `${SITE_URL}${author.avatar}`, width: 400, height: 400, alt: author.name }],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = ARTICLES.filter((a) => a.author === slug);
  const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Tác giả", url: `${SITE_URL}/tac-gia` },
    { name: author.name, url: `${SITE_URL}/tac-gia/${slug}` },
  ]);

  // Person JSON-LD for E-E-A-T
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/tac-gia/${slug}#person`,
    name: author.name,
    jobTitle: author.title,
    description: author.bio,
    url: `${SITE_URL}/tac-gia/${slug}`,
    image: `${SITE_URL}${author.avatar}`,
    sameAs: author.sameAs,
    worksFor: { "@id": ORG_ID },
    knowsAbout: author.expertise,
  };

  return (
    <>
      <SchemaScript schemas={[personSchema, breadcrumb]} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center flex-wrap gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <li><Link href="/" className="hover:underline">Trang chủ</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/news" className="hover:underline">Kiến thức</Link></li>
            <li aria-hidden>/</li>
            <li style={{ color: "var(--text-secondary)" }} aria-current="page">{author.name}</li>
          </ol>
        </nav>

        {/* Hero section */}
        <section
          className="flex flex-col sm:flex-row gap-7 p-7 rounded-2xl mb-10"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
          itemScope
          itemType="https://schema.org/Person"
        >
          {/* Avatar */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="relative w-28 h-28 rounded-full overflow-hidden">
              <Image
                src={author.avatar}
                alt={author.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }} itemProp="name">
              {author.name}
            </h1>
            <p className="text-base mb-3" style={{ color: "var(--text-secondary)" }} itemProp="jobTitle">
              {author.title}
            </p>

            {/* Credentials */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
              {author.credentials.map((cred) => (
                <span
                  key={cred}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}
                >
                  {cred}
                </span>
              ))}
            </div>

            {/* Stats + LinkedIn */}
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span>{author.yearsExperience}+ năm kinh nghiệm</span>
              <span>{author.articlesCount} bài viết</span>
              <a
                href={author.linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-medium hover:underline"
                style={{ color: "#0A66C2" }}
                itemProp="sameAs"
              >
                <Linkedin className="w-4 h-4" aria-hidden />
                LinkedIn
              </a>
            </div>
          </div>
        </section>

        {/* Credentials section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>Chuyên môn</h2>
          <div className="flex flex-wrap gap-2">
            {author.expertise.map((exp) => (
              <span
                key={exp}
                className="px-3 py-1.5 rounded-xl text-sm font-medium"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {exp}
              </span>
            ))}
          </div>
        </section>

        {/* Full bio */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Giới thiệu</h2>
          <div className="space-y-4">
            {author.bioFull.split("\n\n").filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }} itemProp="description">
                {para}
              </p>
            ))}
          </div>
        </section>

        {/* Articles by this author */}
        {articles.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
              Bài viết của {author.name} ({articles.length})
            </h2>
            <div className="space-y-4">
              {articles.map((article) => {
                const cat = catMap[article.category];
                return (
                  <article
                    key={article.slug}
                    className="group flex items-start gap-4 p-4 rounded-xl transition-transform hover:scale-[1.005]"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      {cat && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-block"
                          style={{ background: `${cat.color}18`, color: cat.color }}
                        >
                          {cat.name}
                        </span>
                      )}
                      <h3 className="font-semibold text-sm leading-snug mb-1 group-hover:text-sgs-primary transition-colors"
                        style={{ color: "var(--text-primary)" }}>
                        <Link href={`/news/${article.slug}`}>{article.title}</Link>
                      </h3>
                      <p className="text-xs line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>
                        {article.excerpt}
                      </p>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden />
                          {new Date(article.publishedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden />
                          {article.readTime} phút
                        </span>
                      </div>
                    </div>
                    <Link href={`/news/${article.slug}`} className="shrink-0 mt-1"
                      style={{ color: "var(--primary-600)" }} aria-label={`Đọc ${article.title}`}>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
