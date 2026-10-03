import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maplibreDist = path.resolve(
  process.cwd(),
  "../../node_modules/maplibre-gl/dist",
);
const servedAssets = new Set([
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (!servedAssets.has(asset)) {
    return new Response("Not found", { status: 404 });
  }

  const content = await readFile(path.join(maplibreDist, asset));
  return new Response(content, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}