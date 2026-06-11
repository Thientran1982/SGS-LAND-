// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const content = `# SGS LAND - AI/LLM Discovery File
# https://sgsland.vn/llms.txt

> SGS LAND (Cong ty TNHH Tu Van Bat Dong San SGS)
> Tax ID: 0312960439 | Founded: 2015
> HQ: 60 Nguyen Dinh Chieu, Quan 1, TP.HCM, Viet Nam
> Wikidata: https://www.wikidata.org/wiki/Q130519839
> Wikipedia: https://vi.wikipedia.org/wiki/SGS_Land

SGS LAND la nen tang proptech hang dau TP.HCM:
- AI Valuation chinh xac +-5%
- San giao dich BDS truc tuyen
- CRM Platform cho moi gioi
- Du lieu thi truong BDS thoi gian thuc

Key URLs:
- https://sgsland.vn/
- https://sgsland.vn/ai-valuation
- https://sgsland.vn/marketplace
- https://sgsland.vn/du-an
- https://sgsland.vn/api/public/schema.json
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
