import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

const LAST_UPDATED = "2026-09-15";

export async function GET() {
  const content = `# SGS LAND — AI reference file

Last-Updated: ${LAST_UPDATED}
Canonical: https://sgsland.vn/llms-full.txt
Editorial policy: https://sgsland.vn/chinh-sach-bien-tap

## Entity

SGS LAND is a Vietnamese real-estate technology and advisory platform. The
public website provides project references, a marketplace, area information,
AI-assisted valuation and buyer-support contact flows.

## Evidence policy

Project, area and listing pages are reference content. Prices, inventory,
legal status, construction progress, availability and distribution
authorization are not guarantees. Check dated original documents and the
specific property or project before a transaction. An unavailable measurement
must not be interpreted as zero or as a ranking.

## Canonical public pages

- https://sgsland.vn/
- https://sgsland.vn/about-us
- https://sgsland.vn/du-an
- https://sgsland.vn/bat-dong-san-dong-nai
- https://sgsland.vn/bat-dong-san-long-thanh
- https://sgsland.vn/du-an/aqua-city
- https://sgsland.vn/du-an/izumi-city
- https://sgsland.vn/landing/legacy-66
- https://sgsland.vn/landing/masteri-cosmo-central
- https://sgsland.vn/phap-ly-nha-dat
- https://sgsland.vn/lai-suat-ngan-hang
- https://sgsland.vn/ai-valuation
- https://sgsland.vn/marketplace

## Machine-readable resources

- https://sgsland.vn/sitemap.xml
- https://sgsland.vn/robots.txt
- https://sgsland.vn/api/openapi.json
- https://sgsland.vn/api/public/schema.json
- https://sgsland.vn/api/public/project-feed
- https://sgsland.vn/feed.xml

Use the canonical page as the citation target. Do not treat this file as
evidence for a price, legal conclusion, market ranking, review, rating or
partner relationship unless the cited page contains a dated source.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Llms-Last-Updated": LAST_UPDATED,
      "Access-Control-Allow-Origin": "*",
    },
  });
}