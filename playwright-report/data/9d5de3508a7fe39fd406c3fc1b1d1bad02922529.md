# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing-visual.spec.ts >> Generated landing visual hierarchy >> keeps draft controls named, keyboard ordered, and failure-safe
- Location: tests/landing-visual.spec.ts:278:3

# Error details

```
error: password authentication failed for user "avnadmin"
```

```
error: password authentication failed for user "avnadmin"
```

# Test source

```ts
  59  |     skillKey: 'landing-design',
  60  |     version: '1.0',
  61  |     pattern: fixture.pattern,
  62  |     palette: {
  63  |       navy: PALETTES[fixture.pattern as keyof typeof PALETTES].brand,
  64  |       navyStrong: '#06131A',
  65  |       gold: PALETTES[fixture.pattern as keyof typeof PALETTES].accent,
  66  |       goldStrong: '#8C6420',
  67  |       surface: '#F7F3EA',
  68  |       surfaceSubtle: '#EEE8DA',
  69  |       text: '#1E252B',
  70  |       textSecondary: '#56616A',
  71  |       border: 'rgba(11,29,38,.14)',
  72  |       shadow: '0 18px 50px rgba(11,29,38,.12)',
  73  |     },
  74  |     hero: { alignment: 'left', overlay: 'strong', imageTreatment: 'image-led' },
  75  |     gallery: { layout: fixture.layout, aspectRatio: '4/3' },
  76  |     cta: { style: 'gold-pill', placement: 'hero-and-contact', label: 'Nhận tư vấn dự án' },
  77  |     accessibility: { contrastChecked: true, mobileFirst: true, altTextRequired: true },
  78  |   };
  79  |   return sections.map((section) => {
  80  |     if (section.stage === 'hero') return { ...section, design };
  81  |     if (section.stage === 'gallery') {
  82  |       return { ...section, images: fixture.images, items: [] as string[], layout: fixture.layout };
  83  |     }
  84  |     if (section.stage === 'contact') {
  85  |       return { ...section, body: 'Để lại thông tin để SGS LAND hỗ trợ bạn.', phone: '0379 281 445' };
  86  |     }
  87  |     return section;
  88  |   });
  89  | }
  90  | 
  91  | function databaseConnectionString() {
  92  |   return process.env.AIVEN_DATABASE_URL!
  93  |     .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
  94  |     .replace(/\?&/, '?')
  95  |     .replace(/[?&]$/, '');
  96  | }
  97  | 
  98  | function contrastRatio(foreground: string, background: string) {
  99  |   const parse = (value: string) => {
  100 |     const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  101 |     if (!match) return null;
  102 |     return [Number(match[1]), Number(match[2]), Number(match[3])].map((channel) => {
  103 |       const normalized = channel / 255;
  104 |       return normalized <= 0.03928
  105 |         ? normalized / 12.92
  106 |         : ((normalized + 0.055) / 1.055) ** 2.4;
  107 |     });
  108 |   };
  109 |   const fg = parse(foreground);
  110 |   const bg = parse(background);
  111 |   if (!fg || !bg) return 0;
  112 |   const luminance = (rgb: number[]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  113 |   const lighter = Math.max(luminance(fg), luminance(bg));
  114 |   const darker = Math.min(luminance(fg), luminance(bg));
  115 |   return (lighter + 0.05) / (darker + 0.05);
  116 | }
  117 | 
  118 | test.describe('Generated landing visual hierarchy', () => {
  119 |   let db: Pool;
  120 | 
  121 |   test.beforeAll(async () => {
  122 |     db = new Pool({
  123 |       connectionString: databaseConnectionString(),
  124 |       ssl: { rejectUnauthorized: false },
  125 |       max: 1,
  126 |       connectionTimeoutMillis: 10_000,
  127 |     });
  128 |     for (const fixture of VISUAL_FIXTURES) {
  129 |       await db.query(
  130 |         `INSERT INTO landing_pages
  131 |           (tenant_id, visitor_key, project_name, slug, sections, status, tokens_used, language)
  132 |          VALUES ($1, $2, $3, $4, $5::jsonb, 'published', 6, 'vi')`,
  133 |         [
  134 |           HOST_TENANT,
  135 |           `visual-${fixture.slug}`,
  136 |           `Visual ${fixture.pattern} fixture`,
  137 |           fixture.slug,
  138 |           JSON.stringify(sectionsFor(fixture)),
  139 |         ],
  140 |       );
  141 |     }
  142 |     await db.query(
  143 |       `INSERT INTO landing_pages
  144 |         (tenant_id, visitor_key, project_name, slug, sections, status, tokens_used, language)
  145 |        VALUES ($1, $2, $3, $4, $5::jsonb, 'draft', 6, 'vi')`,
  146 |       [
  147 |         HOST_TENANT,
  148 |         DRAFT_VISITOR_KEY,
  149 |         'Visual draft fixture',
  150 |         DRAFT_SLUG,
  151 |         JSON.stringify(sectionsFor(VISUAL_FIXTURES[0])),
  152 |       ],
  153 |     );
  154 |   });
  155 | 
  156 |   test.afterAll(async () => {
  157 |     try {
  158 |       for (const fixture of VISUAL_FIXTURES) {
> 159 |         await db?.query('DELETE FROM landing_pages WHERE slug = $1', [fixture.slug]);
      |         ^ error: password authentication failed for user "avnadmin"
  160 |       }
  161 |       await db?.query('DELETE FROM landing_pages WHERE slug = $1 AND visitor_key = $2', [
  162 |         DRAFT_SLUG,
  163 |         DRAFT_VISITOR_KEY,
  164 |       ]);
  165 |     } finally {
  166 |       await db?.end();
  167 |     }
  168 |   });
  169 | 
  170 |   for (const fixture of VISUAL_FIXTURES) {
  171 |     test(`keeps ${fixture.label} stable`, async ({ page }) => {
  172 |       await page.goto(`${BASE_URL}/landing/${fixture.slug}`, { waitUntil: 'networkidle' });
  173 |       await expect(page.locator('main.landing-builder-page')).toBeVisible();
  174 | 
  175 |       const renderedStageIds = await page.locator('main [id]').evaluateAll((elements) =>
  176 |         elements
  177 |           .map((element) => element.id)
  178 |           .filter((id) => ['hero', 'gallery', 'legal', 'price', 'amenities', 'contact'].includes(id)),
  179 |       );
  180 |       expect(renderedStageIds).toEqual([...SECTION_STAGES]);
  181 | 
  182 |       const main = page.locator('main.landing-builder-page');
  183 |       await expect(main).toHaveAttribute('aria-labelledby', 'hero-heading');
  184 |       await expect(page.locator('#hero')).toHaveAttribute('aria-labelledby', 'hero-heading');
  185 |       const headingOutline = await main.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) =>
  186 |         headings.map((heading) => ({
  187 |           id: heading.id,
  188 |           level: heading.tagName,
  189 |           text: heading.textContent?.trim(),
  190 |         })),
  191 |       );
  192 |       expect(headingOutline).toEqual([
  193 |         { id: 'hero-heading', level: 'H1', text: `${fixture.pattern} hero` },
  194 |         ...SECTION_STAGES.slice(1).map((stage) => ({
  195 |           id: `${stage}-heading`,
  196 |           level: 'H2',
  197 |           text: `${fixture.pattern} ${stage}`,
  198 |         })),
  199 |       ]);
  200 |       for (const stage of SECTION_STAGES.slice(1)) {
  201 |         await expect(page.locator(`#${stage}`)).toHaveAttribute('aria-labelledby', `${stage}-heading`);
  202 |       }
  203 | 
  204 |       expect(await main.getAttribute('class')).toContain(`landing-builder-pattern-${fixture.pattern}`);
  205 |       expect(await main.evaluate((element) => {
  206 |         const style = getComputedStyle(element);
  207 |         return {
  208 |           brand: style.getPropertyValue('--landing-brand').trim(),
  209 |           accent: style.getPropertyValue('--landing-accent').trim(),
  210 |         };
  211 |       })).toEqual(PALETTES[fixture.pattern as keyof typeof PALETTES]);
  212 | 
  213 |       await expect(page.locator('#hero .landing-builder-primary-button')).toHaveAttribute('href', '#contact');
  214 |       await expect(page.locator('#contact .landing-builder-primary-button')).toHaveAttribute('href', 'tel:0379281445');
  215 |       const heroCta = page.locator('#hero .landing-builder-primary-button');
  216 |       const contactCta = page.locator('#contact .landing-builder-primary-button');
  217 |       await page.keyboard.press('Tab');
  218 |       await expect(heroCta).toBeFocused();
  219 |       await expect(heroCta).toHaveCSS('outline-style', 'solid');
  220 |       await page.keyboard.press('Tab');
  221 |       await expect(contactCta).toBeFocused();
  222 |       await expect(contactCta).toHaveCSS('outline-style', 'solid');
  223 |       const ctaColors = await page.locator('#hero .landing-builder-primary-button').evaluate((element) => {
  224 |         const style = getComputedStyle(element);
  225 |         return { color: style.color, background: style.backgroundColor };
  226 |       });
  227 |       expect(contrastRatio(ctaColors.color, ctaColors.background)).toBeGreaterThanOrEqual(4.5);
  228 | 
  229 |       const viewport = page.viewportSize();
  230 |       expect(viewport).not.toBeNull();
  231 |       expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport!.width);
  232 | 
  233 |       const gallery = page.locator('#gallery .landing-builder-gallery-grid');
  234 |       const galleryImages = page.locator('#gallery .landing-builder-gallery-image');
  235 |       await expect(galleryImages).toHaveCount(fixture.images.length);
  236 |       const galleryAlts = await galleryImages.evaluateAll((images) =>
  237 |         images.map((image) => image.getAttribute('alt')?.trim() || ''),
  238 |       );
  239 |       expect(galleryAlts).toEqual(
  240 |         fixture.images.map((_, index) => `Visual ${fixture.pattern} fixture - ${fixture.pattern} gallery - hình ảnh ${index + 1}`),
  241 |       );
  242 |       expect(galleryAlts.every((alt) => alt.length > 0 && !/^hình ảnh \d+$/i.test(alt))).toBe(true);
  243 |       if (fixture.images.length === 0) {
  244 |         await expect(page.locator('#gallery h2')).toBeVisible();
  245 |         await expect(gallery).toHaveCount(0);
  246 |       } else {
  247 |         await expect(gallery).toHaveClass(new RegExp(`landing-builder-gallery-${fixture.layout}`));
  248 |         await expect(galleryImages.first()).toHaveCSS('object-fit', 'cover');
  249 |         if (fixture.images.length > 1) {
  250 |           const columnCount = await gallery.evaluate((element) =>
  251 |             getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
  252 |           );
  253 |           expect(columnCount).toBe(viewport!.width <= 700 ? 2 : 3);
  254 |         }
  255 |         const galleryBox = await gallery.boundingBox();
  256 |         expect(galleryBox).not.toBeNull();
  257 |         const imageBoxes = await galleryImages.evaluateAll((images) =>
  258 |           images.map((image) => {
  259 |             const box = image.getBoundingClientRect();
```