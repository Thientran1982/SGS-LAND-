/**
 * One-off migration: move the hand-written articles that used to live in
 * apps/nextjs/data/articles.ts into the Postgres `articles` table, so the site
 * has a SINGLE source of truth (Postgres) for editorial content.
 *
 * Idempotent: re-running skips slugs that already exist.
 *   npx tsx scripts/seed-static-articles.ts
 */
import { Pool } from "pg";
import { ARTICLES } from "../apps/nextjs/data/articles";
import { AUTHORS } from "../apps/nextjs/data/authors";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  // Use the same Aiven database as the running application.
  const conn = process.env.AIVEN_DATABASE_URL;
  if (!conn) throw new Error("AIVEN_DATABASE_URL is not configured");
  const pool = new Pool({ connectionString: conn });
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [TENANT_ID]);

    for (const a of ARTICLES) {
      const author = AUTHORS.find((x) => x.slug === a.author);
      const authorLabel =
        a.authorName || (author ? author.name + " - " + author.title : "Ban Bien Tap SGS LAND");
      const metadata = {
        source: "static-seed",
        authorSlug: a.author,
        readTime: a.readTime,
        wordCount: a.wordCount,
        outline: a.outline || [],
        sources: a.sources || [],
        relatedSlugs: a.relatedSlugs || [],
        isLegal: a.isLegal === true,
        seo: a.seo || null,
        updatedAt: a.updatedAt,
      };
      const res = await client.query(
        `INSERT INTO articles
           (tenant_id, title, slug, content, excerpt, category, tags, author,
            cover_image, images, featured, status, published_at, videos, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,'PUBLISHED',$12,'[]'::jsonb,$13::jsonb)
         ON CONFLICT (tenant_id, slug) DO NOTHING
         RETURNING id`,
        [
          TENANT_ID,
          a.title,
          a.slug,
          a.body || "",
          a.excerpt,
          a.category,
          JSON.stringify(a.tags || []),
          authorLabel,
          a.coverImage,
          JSON.stringify([]),
          a.featured === true,
          a.publishedAt,
          JSON.stringify(metadata),
        ]
      );
      if (res.rowCount) {
        inserted++;
        console.log("  + " + a.slug);
      } else {
        skipped++;
        console.log("  = " + a.slug + " (already exists)");
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
  console.log("Seed done: inserted=" + inserted + " skipped=" + skipped);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
