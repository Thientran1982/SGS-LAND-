// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

const OPENAPI_SCHEMA = {
  openapi: "3.0.0",
  info: {
    title: "SGS LAND Public API",
    version: "1.0.0",
    description: "Nền tảng bất động sản AI - SGS LAND. Provides real estate data, AI valuation, and project information for TP.HCM market.",
    contact: {
      name: "SGS LAND",
      url: "https://sgsland.vn",
      email: "info@sgsland.vn",
    },
    license: {
      name: "Public Data",
      url: "https://sgsland.vn/terms-of-service",
    },
  },
  servers: [{ url: "https://sgsland.vn/api/public", description: "Production" }],
  paths: {
    "/schema.json": {
      get: {
        summary: "SGS LAND Organization Schema",
        description: "Returns full Schema.org Organization data for SGS LAND entity",
        operationId: "getOrganizationSchema",
        responses: {
          "200": {
            description: "Schema.org Organization JSON-LD",
            content: { "application/ld+json": { schema: { type: "object" } } },
          },
        },
      },
    },
  },
  "x-entity": {
    wikidata: "Q130519839",
    wikipedia: "https://vi.wikipedia.org/wiki/SGS_Land",
    taxID: "0312960439",
    country: "VN",
    city: "Ho Chi Minh City",
    industry: "Real Estate Technology (Proptech)",
  },
};

export async function GET() {
  return NextResponse.json(OPENAPI_SCHEMA, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
