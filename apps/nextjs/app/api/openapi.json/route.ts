// @ts-nocheck
import { NextResponse } from "next/server";
import { OPENAPI_SCHEMA } from "@/lib/openapi-spec";

// GEO: /.well-known/ai-plugin.json advertises api.url = /api/openapi.json.
// Before this route existed the path fell through the /api/:path* rewrite to
// Express and returned the SPA index.html (200 text/html), so every AI agent
// that fetched the manifest got HTML instead of a machine-readable spec.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return NextResponse.json(OPENAPI_SCHEMA, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Robots-Tag": "all",
    },
  });
}
