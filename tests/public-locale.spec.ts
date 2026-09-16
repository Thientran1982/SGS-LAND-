import { test, expect } from "@playwright/test";

const publicRoutes = [
  { vi: "/", en: "/en", viText: "Bất Động Sản", enText: "real estate" },
  { vi: "/khu-vuc", en: "/en/khu-vuc", viText: "Bất động sản theo khu vực", enText: "Real estate by area" },
  { vi: "/chuyen-gia", en: "/en/chuyen-gia", viText: "Chuyên gia", enText: "Experts" },
  { vi: "/crm-platform", en: "/en/crm-platform", viText: "Hệ điều hành BĐS", enText: "operating system for real estate" },
  { vi: "/chinh-sach-bien-tap", en: "/en/chinh-sach-bien-tap", viText: "Chính sách biên tập", enText: "Editorial policy" },
  { vi: "/marketplace", en: "/en/marketplace", viText: "Tìm kiếm", enText: "Search" },
];

for (const route of publicRoutes) {
  test(`keeps VI and EN copy on ${route.vi}`, async ({ page }) => {
    await page.goto(route.vi, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.locator("body")).toContainText(route.viText);

    await page.goto(route.en, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("body")).toContainText(route.enText);
  });
}

test("keeps locale when following representative public links", async ({ page }) => {
  await page.goto("/en/khu-vuc", { waitUntil: "domcontentloaded" });
  const areaLink = page.locator('a[href^="/en/khu-vuc/"]').first();
  await expect(areaLink).toBeVisible();
  await expect(areaLink).toHaveAttribute("href", /^\/en\//);

  await page.goto("/en/chuyen-gia", { waitUntil: "domcontentloaded" });
  const expertLink = page.locator('a[href^="/en/chuyen-gia/"]').first();
  await expect(expertLink).toBeVisible();
  await expect(expertLink).toHaveAttribute("href", /^\/en\//);
});