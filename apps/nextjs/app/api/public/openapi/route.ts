// @ts-nocheck
import { NextResponse } from "next/server";
import { OPENAPI_SCHEMA } from "@/lib/openapi-spec";
export const dynamic = "force-static";
export const revalidate = 86400;
export async function GET() {
  return NextResponse.json(OPENAPI_SCHEMA, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}