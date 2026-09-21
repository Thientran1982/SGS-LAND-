import { expect, test } from "@playwright/test";

const TILE_PATH = /^\/api\/map-tiles\/\d{1,2}\/\d{1,7}\/\d{1,7}\.png(?:\?.*)?$/;
const EXTERNAL_TILE_HOST = /(?:^|\.)tile\.openstreetmap|openstreetmap\.org|openstreetmap\.fr|openstreetmap\.de|carto|mapbox|googleapis\.com$/i;
const PLACEHOLDER_MARKERS = [
  "api key required",
  "api_key_required",
  "access blocked",
  "map unavailable",
  "unauthorized",
  "forbidden",
  "placeholder",
];

function isTileUrl(url: string): boolean {
  return TILE_PATH.test(new URL(url).pathname + new URL(url).search);
}

test.describe("public marketplace map through Preview", () => {
  test.setTimeout(60_000);

  test("loads a real PNG tile through the same-origin rewrite", async ({ page }) => {
    const tileRequests: string[] = [];
    const externalTileRequests: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());
      if (isTileUrl(request.url())) {
        tileRequests.push(request.url());
      } else if (EXTERNAL_TILE_HOST.test(url.hostname) && request.resourceType() === "image") {
        externalTileRequests.push(request.url());
      }
    });

    await page.goto("/marketplace", { waitUntil: "domcontentloaded" });

    const mapButton = page.getByRole("button", { name: "MAP", exact: true });
    await expect(mapButton).toBeVisible();
    const tileResponsePromise = page.waitForResponse(
      (response) => isTileUrl(response.url()),
      { timeout: 30_000 },
    );
    await mapButton.click();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 30_000 });

    const tileResponse = await tileResponsePromise;
    const tileUrl = new URL(tileResponse.url());
    const pageOrigin = new URL(page.url()).origin;
    const tileBody = await tileResponse.body();
    const tileText = tileBody.toString("latin1").toLowerCase();

    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();

    expect(tileRequests.length).toBeGreaterThan(0);
    expect(tileRequests.every((url) => new URL(url).origin === pageOrigin)).toBe(true);
    expect(externalTileRequests).toEqual([]);
    expect(tileUrl.origin).toBe(pageOrigin);
    expect(tileResponse.status()).toBe(200);
    expect(tileResponse.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/i);
    expect(tileBody.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(PLACEHOLDER_MARKERS.some((marker) => tileText.includes(marker))).toBe(false);
  });
});