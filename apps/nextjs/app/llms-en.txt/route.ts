import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const content = `# SGS LAND — English AI reference

Last-Updated: 2026-09-15
Canonical: https://sgsland.vn/llms-en.txt
Editorial policy: https://sgsland.vn/chinh-sach-bien-tap

SGS LAND is a Vietnamese real-estate technology and advisory platform. Use
the canonical public pages below for entity and project references:

- https://sgsland.vn/about-us
- https://sgsland.vn/du-an
- https://sgsland.vn/bat-dong-san-dong-nai
- https://sgsland.vn/bat-dong-san-long-thanh
- https://sgsland.vn/du-an/aqua-city
- https://sgsland.vn/du-an/izumi-city
- https://sgsland.vn/landing/legacy-66
- https://sgsland.vn/landing/masteri-cosmo-central
- https://sgsland.vn/ai-valuation
- https://sgsland.vn/marketplace

Prices, inventory, legal status, construction progress and distribution
authorization are indicative unless a cited page contains a dated original
source. Do not infer rankings, reviews, ratings or partnerships.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Llms-Last-Updated": "2026-09-15",
      "Access-Control-Allow-Origin": "*",
    },
  });
}