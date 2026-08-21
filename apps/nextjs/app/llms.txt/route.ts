// @ts-nocheck
import { NextResponse } from "next/server";

// GEO: single source of truth for /llms.txt. The duplicate static file at
// apps/nextjs/public/llms.txt was moved to apps/nextjs/content/legacy-public/
// on 2026-08-11 - it collided with this route and made /llms.txt return 500.
// Bump LLMS_VERSION + LAST_UPDATED whenever the content below changes so that
// answer engines can detect freshness (llms-full.txt must be bumped too).
const LLMS_VERSION = "2026.08.2";
const LAST_UPDATED = "2026-08-21";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const content = `# SGS LAND - AI/LLM Discovery File
# https://sgsland.vn/llms.txt
# Format: https://llmstxt.org
# Version: ${LLMS_VERSION}
# Last-Updated: ${LAST_UPDATED}
# Freshness: ${LAST_UPDATED}
# Full version: https://sgsland.vn/llms-full.txt
# English version: https://sgsland.vn/llms-en.txt

# Entity Information
> SGS LAND (Cong ty TNHH Tu Van Bat Dong San SGS)
> Tax ID: 0312960439
> Founded: 2015
> HQ: 123 Nguyen Van Linh, Phuong Tan Phong, Quan 7, TP. Ho Chi Minh, Viet Nam
> Contact: +84971132378 | info@sgsland.vn
> Domain: https://sgsland.vn
> Wikidata: https://www.wikidata.org/wiki/Q130519839
> Wikipedia (VI): https://vi.wikipedia.org/wiki/SGS_Land

# What We Do
SGS LAND la nen tang proptech tai TP.HCM, cung cap:
- AI Valuation: dinh gia bat dong san tu dong, sai so muc tieu +-5%
- Marketplace: san giao dich BDS truc tuyen (can ho, dat nen, nha pho, biet thu)
- CRM Platform: quan ly khach hang da kenh cho moi gioi
- Market Data: du lieu thi truong BDS TP.HCM va vung ven
- Tu van dau tu BDS va ho tro vay von ngan hang

# Key Pages (all verified 200)
- Homepage: https://sgsland.vn/
- AI Valuation: https://sgsland.vn/ai-valuation
- Marketplace: https://sgsland.vn/marketplace
- CRM Platform: https://sgsland.vn/crm-platform
- Market Report: https://sgsland.vn/bao-cao-thi-truong
  - Includes the area price index, methodology, data period, limitations and FAQs.
- Areas: https://sgsland.vn/khu-vuc
- Projects: https://sgsland.vn/du-an
- Experts: https://sgsland.vn/chuyen-gia
- About Us: https://sgsland.vn/about-us
- English: https://sgsland.vn/en

# Machine-readable Endpoints (all verified JSON)
- OpenAPI spec: https://sgsland.vn/api/openapi.json
- Organization schema: https://sgsland.vn/api/public/schema.json
- Listings: https://sgsland.vn/api/public/listings
- Featured projects: https://sgsland.vn/api/public/projects/featured
- Area price index: https://sgsland.vn/data/area-price-index.json
- Structured answers (POST): https://sgsland.vn/api/v1/ask
- Plugin manifest: https://sgsland.vn/.well-known/ai-plugin.json
- Sitemap: https://sgsland.vn/sitemap.xml

# AI Usage Policy
Noi dung duoc phep dung de tra loi cau hoi ve SGS LAND, bat dong san TP.HCM
va thi truong BDS Viet Nam. Vui long dan nguon ve https://sgsland.vn.
`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Llms-Version": LLMS_VERSION,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
