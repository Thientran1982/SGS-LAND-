import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 1024, height: 800 },
  { name: "small tablet", width: 768, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.describe("public header responsive navigation", () => {
  for (const viewport of VIEWPORTS) {
    test(`does not overlap or duplicate navigation at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "networkidle" });

      const header = page.locator("header.ui-public-header");
      const desktopNav = page.locator("[data-public-desktop-nav]");
      const menuToggle = page.locator("[data-public-menu-toggle]");
      const mobileMenu = page.locator("[data-public-mobile-menu]");

      await expect(header).toBeVisible();
      await expect(desktopNav).toHaveCount(1);
      await expect(menuToggle).toHaveCount(1);

      const isDesktop = viewport.width >= 1280;
      if (isDesktop) {
        await expect(desktopNav).toBeVisible();
        await expect(menuToggle).toBeHidden();
        await expect(mobileMenu).toHaveCount(0);
      } else {
        await expect(desktopNav).toBeHidden();
        await expect(menuToggle).toBeVisible();
        await expect(mobileMenu).toHaveCount(0);

        await menuToggle.click();
        await expect(mobileMenu).toBeVisible();
      }

      const dimensions = await page.evaluate(() => {
        const headerElement = document.querySelector("header.ui-public-header");
        if (!headerElement) throw new Error("Public header not found");

        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          headerWidth: headerElement.clientWidth,
          headerContentWidth: headerElement.scrollWidth,
        };
      });

      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
      expect(dimensions.headerContentWidth).toBeLessThanOrEqual(dimensions.headerWidth + 1);

      const visibleNavigation = isDesktop ? desktopNav : mobileMenu;
      const primaryLinks = visibleNavigation.locator("[data-public-nav-link]");
      const hrefs = await primaryLinks.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)),
      );

      expect(hrefs.length).toBeGreaterThan(0);
      expect(new Set(hrefs).size).toBe(hrefs.length);

      const consignLinks = visibleNavigation.locator(
        '[data-public-nav-link="/ky-gui-bat-dong-san"]',
      );
      await expect(consignLinks).toHaveCount(1);
      await expect(
        visibleNavigation.locator('a[href="/ky-gui-bat-dong-san"]'),
      ).toHaveCount(1);
    });
  }
});