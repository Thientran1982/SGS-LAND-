import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORTS = [
  { name: "375px", width: 375, height: 812 },
  { name: "414px", width: 414, height: 896 },
] as const;

test.describe("public homepage mobile layout and search", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`keeps the homepage usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        window.localStorage.removeItem("sgs_consent_v1");
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const consentBanner = page.locator("[data-consent-banner]");
      await expect(consentBanner).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

      const filterTrigger = page.locator(".hs-filter-trigger");
      await expect(filterTrigger).toBeVisible();
      await filterTrigger.click();

      const filterSheet = page.locator(".hs-filter-sheet");
      await expect(filterSheet).toBeVisible();
      await filterSheet.locator("#lp-hero-type-mobile").selectOption("Apartment");
      await filterSheet.locator("#lp-hero-budget-mobile").selectOption("5");

      const searchForm = page.locator("[data-hero-search]");
      await expect(searchForm.locator('input[name="type"]')).toHaveValue("Apartment");
      await expect(searchForm.locator('input[name="maxPrice"]')).toHaveValue("5");

      await filterSheet.getByRole("button", { name: "Áp dụng" }).click();
      await expect(filterSheet).toBeHidden();
      await expect(filterTrigger).toBeFocused();
      await expect(searchForm.locator('input[name="type"]')).toHaveValue("Apartment");
      await expect(searchForm.locator('input[name="maxPrice"]')).toHaveValue("5");

      await filterTrigger.click();
      await expect(filterSheet).toBeVisible();
      await expect(consentBanner).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(filterSheet).toBeHidden();
      await expect(filterTrigger).toBeFocused();
      await expect(consentBanner).toBeVisible();

      const projectDots = page.locator(".lp-projects-section .lp-carousel-dots");
      await expect(projectDots).toBeVisible();
      const dots = projectDots.getByRole("button");
      await expect(dots).toHaveCount(5);
      await expect(dots.nth(0)).toHaveAttribute("aria-pressed", "true");
      await dots.nth(1).click();
      await expect(dots.nth(1)).toHaveAttribute("aria-pressed", "true");

      const mapGrid = page.locator("#ban-do .lp-map-grid");
      await expect(mapGrid.locator(".lp-map-intro")).toBeVisible();
      await expect(mapGrid.locator(".lp-mapcard .lp-map-shell")).toBeVisible();
      await expect(mapGrid.locator(".lp-map-projects")).toBeVisible();
      const mapSectionOrder = await mapGrid.evaluate((grid) => {
        const elements = [
          grid.querySelector(".lp-map-intro"),
          grid.querySelector(".lp-mapcard"),
          grid.querySelector(".lp-map-projects"),
        ];
        return elements.map((element) => {
          if (!element) throw new Error("Expected map section content was missing");
          return element.getBoundingClientRect().top;
        });
      });
      expect(mapSectionOrder[0]).toBeLessThan(mapSectionOrder[1]);
      expect(mapSectionOrder[1]).toBeLessThan(mapSectionOrder[2]);
    });
  }
});

test("keeps the desktop homepage search controls in their desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const searchForm = page.locator("[data-hero-search]");
  await expect(searchForm).toBeVisible();
  await expect(searchForm.locator(".hs-desktop-filter-field")).toHaveCount(2);
  await expect(searchForm.locator("#lp-hero-type")).toBeVisible();
  await expect(searchForm.locator("#lp-hero-budget")).toBeVisible();
  await expect(searchForm.locator(".hs-desktop-submit")).toBeVisible();
  await expect(searchForm.locator(".hs-mobile-actions")).toBeHidden();
  await expect(searchForm).toHaveCSS("display", "grid");
});