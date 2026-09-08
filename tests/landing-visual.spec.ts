import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';

test.skip(!process.env.AIVEN_DATABASE_URL, 'requires the integration PostgreSQL database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const SECTION_STAGES = ['hero', 'gallery', 'legal', 'price', 'amenities', 'contact'] as const;

function imageFixture(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="${color}"/><text x="60" y="120" fill="white" font-size="48" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const VISUAL_FIXTURES = [
  {
    label: 'sanctuary with no gallery images',
    pattern: 'sanctuary',
    layout: 'editorial-grid',
    images: [] as string[],
  },
  {
    label: 'coastal with one gallery image',
    pattern: 'coastal',
    layout: 'single-focus',
    images: [imageFixture('COASTAL', '#0D3442')],
  },
  {
    label: 'urban with a mosaic gallery',
    pattern: 'urban',
    layout: 'mosaic',
    images: [
      imageFixture('URBAN 1', '#1D2A35'),
      imageFixture('URBAN 2', '#53636D'),
      imageFixture('URBAN 3', '#C6923D'),
    ],
  },
].map((fixture) => ({ ...fixture, slug: `landing-visual-${randomUUID()}` }));

const PALETTES = {
  sanctuary: { brand: '#0B1D26', accent: '#C6923D' },
  coastal: { brand: '#0D3442', accent: '#CBA45A' },
  urban: { brand: '#1D2A35', accent: '#C6923D' },
} as const;

function sectionsFor(fixture: (typeof VISUAL_FIXTURES)[number]) {
  const sections = SECTION_STAGES.map((stage) => ({
    stage,
    title: `${fixture.pattern} ${stage}`,
    body: `Nội dung kiểm tra hierarchy cho ${stage}.`,
    items: stage === 'amenities' ? ['Công viên trung tâm', 'Trường học nội khu'] : [],
    tokens: 1,
  }));
  const design = {
    skillKey: 'landing-design',
    version: '1.0',
    pattern: fixture.pattern,
    palette: {
      navy: PALETTES[fixture.pattern as keyof typeof PALETTES].brand,
      navyStrong: '#06131A',
      gold: PALETTES[fixture.pattern as keyof typeof PALETTES].accent,
      goldStrong: '#8C6420',
      surface: '#F7F3EA',
      surfaceSubtle: '#EEE8DA',
      text: '#1E252B',
      textSecondary: '#56616A',
      border: 'rgba(11,29,38,.14)',
      shadow: '0 18px 50px rgba(11,29,38,.12)',
    },
    hero: { alignment: 'left', overlay: 'strong', imageTreatment: 'image-led' },
    gallery: { layout: fixture.layout, aspectRatio: '4/3' },
    cta: { style: 'gold-pill', placement: 'hero-and-contact', label: 'Nhận tư vấn dự án' },
    accessibility: { contrastChecked: true, mobileFirst: true, altTextRequired: true },
  };
  return sections.map((section) => {
    if (section.stage === 'hero') return { ...section, design };
    if (section.stage === 'gallery') {
      return { ...section, images: fixture.images, items: [] as string[], layout: fixture.layout };
    }
    if (section.stage === 'contact') {
      return { ...section, body: 'Để lại thông tin để SGS LAND hỗ trợ bạn.', phone: '0379 281 445' };
    }
    return section;
  });
}

function databaseConnectionString() {
  return process.env.AIVEN_DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function contrastRatio(foreground: string, background: string) {
  const parse = (value: string) => {
    const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
  };
  const fg = parse(foreground);
  const bg = parse(background);
  if (!fg || !bg) return 0;
  const luminance = (rgb: number[]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Generated landing visual hierarchy', () => {
  let db: Pool;

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    for (const fixture of VISUAL_FIXTURES) {
      await db.query(
        `INSERT INTO landing_pages
          (tenant_id, visitor_key, project_name, slug, sections, status, tokens_used, language)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'published', 6, 'vi')`,
        [
          HOST_TENANT,
          `visual-${fixture.slug}`,
          `Visual ${fixture.pattern} fixture`,
          fixture.slug,
          JSON.stringify(sectionsFor(fixture)),
        ],
      );
    }
  });

  test.afterAll(async () => {
    try {
      for (const fixture of VISUAL_FIXTURES) {
        await db?.query('DELETE FROM landing_pages WHERE slug = $1', [fixture.slug]);
      }
    } finally {
      await db?.end();
    }
  });

  for (const fixture of VISUAL_FIXTURES) {
    test(`keeps ${fixture.label} stable`, async ({ page }) => {
      await page.goto(`${BASE_URL}/landing/${fixture.slug}`, { waitUntil: 'networkidle' });
      await expect(page.locator('main.landing-builder-page')).toBeVisible();

      const renderedStageIds = await page.locator('main [id]').evaluateAll((elements) =>
        elements
          .map((element) => element.id)
          .filter((id) => ['hero', 'gallery', 'legal', 'price', 'amenities', 'contact'].includes(id)),
      );
      expect(renderedStageIds).toEqual([...SECTION_STAGES]);

      const main = page.locator('main.landing-builder-page');
      expect(await main.getAttribute('class')).toContain(`landing-builder-pattern-${fixture.pattern}`);
      expect(await main.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          brand: style.getPropertyValue('--landing-brand').trim(),
          accent: style.getPropertyValue('--landing-accent').trim(),
        };
      })).toEqual(PALETTES[fixture.pattern as keyof typeof PALETTES]);

      await expect(page.locator('#hero .landing-builder-primary-button')).toHaveAttribute('href', '#contact');
      await expect(page.locator('#contact .landing-builder-primary-button')).toHaveAttribute('href', 'tel:0379281445');
      const ctaColors = await page.locator('#hero .landing-builder-primary-button').evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, background: style.backgroundColor };
      });
      expect(contrastRatio(ctaColors.color, ctaColors.background)).toBeGreaterThanOrEqual(4.5);

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport!.width);

      const gallery = page.locator('#gallery .landing-builder-gallery-grid');
      const galleryImages = page.locator('#gallery .landing-builder-gallery-image');
      await expect(galleryImages).toHaveCount(fixture.images.length);
      if (fixture.images.length === 0) {
        await expect(page.locator('#gallery h2')).toBeVisible();
        await expect(gallery).toHaveCount(0);
      } else {
        await expect(gallery).toHaveClass(new RegExp(`landing-builder-gallery-${fixture.layout}`));
        await expect(galleryImages.first()).toHaveCSS('object-fit', 'cover');
        if (fixture.images.length > 1) {
          const columnCount = await gallery.evaluate((element) =>
            getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
          );
          expect(columnCount).toBe(viewport!.width <= 700 ? 2 : 3);
        }
        const galleryBox = await gallery.boundingBox();
        expect(galleryBox).not.toBeNull();
        const imageBoxes = await galleryImages.evaluateAll((images) =>
          images.map((image) => {
            const box = image.getBoundingClientRect();
            return {
              right: box.right,
              bottom: box.bottom,
              width: box.width,
              height: box.height,
            };
          }),
        );
        for (const box of imageBoxes) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
          expect(box.right).toBeLessThanOrEqual(galleryBox!.x + galleryBox!.width + 1);
          expect(box.bottom).toBeLessThanOrEqual(galleryBox!.y + galleryBox!.height + 1);
        }
      }
    });
  }
});