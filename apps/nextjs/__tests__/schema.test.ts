/**
 * Schema.org structured data unit tests.
 *
 * Run with: npx jest  (requires Jest + ts-jest or vitest)
 * Install:  pnpm --filter @sgsland/nextjs add -D jest @jest/globals ts-jest
 *
 * These tests verify that every schema factory returns structurally valid
 * JSON-LD — i.e. required fields are present, types are correct, and
 * cross-schema @id references are consistent.
 */

// NOTE: Install a test runner before executing this file:
//   pnpm --filter @sgsland/nextjs add -D jest @types/jest ts-jest
//   Then add "jest": { "preset": "ts-jest" } to apps/nextjs/package.json
// Jest globals (describe, it, expect) are injected automatically at runtime.
import {
  getOrganizationSchema,
  getWebsiteSchema,
  getRealEstateListingSchema,
  getFAQSchema,
  getBreadcrumbSchema,
  getFoundersSchema,
  FAQ_HOMEPAGE,
  SITE_URL,
  ORG_ID,
  WEBSITE_ID,
} from "../lib/schema";

// ─── Organization ──────────────────────────────────────────────────────────

describe("getOrganizationSchema", () => {
  const schema = getOrganizationSchema();

  it("has required @context, @type, and @id", () => {
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toContain("Organization");
    expect(schema["@id"]).toBe(ORG_ID);
  });

  it("has name and url", () => {
    expect(typeof schema.name).toBe("string");
    expect(schema.name.length).toBeGreaterThan(0);
    expect(schema.url).toBe(SITE_URL);
  });

  it("has valid logo with url, width, height", () => {
    expect(schema.logo["@type"]).toBe("ImageObject");
    expect(schema.logo.url).toMatch(/^https:/);
    expect(schema.logo.width).toBeGreaterThan(0);
    expect(schema.logo.height).toBeGreaterThan(0);
  });

  it("has aggregateRating with ratingValue between 1 and 5", () => {
    expect(schema.aggregateRating.ratingValue).toBeGreaterThanOrEqual(1);
    expect(schema.aggregateRating.ratingValue).toBeLessThanOrEqual(5);
    expect(schema.aggregateRating.reviewCount).toBeGreaterThan(0);
  });

  it("has non-empty areaServed and knowsAbout arrays", () => {
    expect(Array.isArray(schema.areaServed)).toBe(true);
    expect(schema.areaServed.length).toBeGreaterThan(0);
    expect(Array.isArray(schema.knowsAbout)).toBe(true);
    expect(schema.knowsAbout.length).toBeGreaterThan(0);
  });

  it("serialises to valid JSON", () => {
    const json = JSON.stringify(schema);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ─── WebSite ───────────────────────────────────────────────────────────────

describe("getWebsiteSchema", () => {
  const schema = getWebsiteSchema();

  it("has @type WebSite and correct @id", () => {
    expect(schema["@type"]).toBe("WebSite");
    expect(schema["@id"]).toBe(WEBSITE_ID);
  });

  it("has potentialAction SearchAction with a urlTemplate", () => {
    const action = schema.potentialAction;
    expect(action["@type"]).toBe("SearchAction");
    expect(action.target.urlTemplate).toContain("{search_term_string}");
    expect(action.target.urlTemplate).toContain(SITE_URL);
  });

  it("publisher references the organisation @id", () => {
    expect(schema.publisher["@id"]).toBe(ORG_ID);
  });
});

// ─── RealEstateListing ────────────────────────────────────────────────────

describe("getRealEstateListingSchema", () => {
  const project = {
    name: "Aqua City Novaland",
    slug: "aqua-city",
    description: "Đại đô thị sinh thái 1.000ha tại Nhơn Trạch, Đồng Nai.",
    location: "Nhơn Trạch, Biên Hòa",
    city: "Đồng Nai",
    developer: "Novaland",
    price_low: 3_000_000_000,
    price_high: 50_000_000_000,
    area_ha: 1000,
    amenities: ["Golf 18 lỗ", "Marina", "Vinmec", "Vinschool"],
    total_units: 120,
  };

  const schema = getRealEstateListingSchema(project);

  it("has @type RealEstateListing", () => {
    expect(schema["@type"]).toBe("RealEstateListing");
  });

  it("has name, description, and a canonical url", () => {
    expect(schema.name).toBe(project.name);
    expect(schema.description).toBeTruthy();
    expect(schema.url).toContain(`/du-an/${project.slug}`);
  });

  it("has VND offers with lowPrice ≤ highPrice", () => {
    expect(schema.offers.priceCurrency).toBe("VND");
    expect(schema.offers.lowPrice!).toBeLessThanOrEqual(schema.offers.highPrice!);
  });

  it("has floorSize in ha", () => {
    expect(schema.floorSize?.value).toBe(1000);
    expect(schema.floorSize?.unitText).toBe("ha");
  });

  it("provider references the organisation @id", () => {
    expect(schema.provider["@id"]).toBe(ORG_ID);
  });

  it("serialises to valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(schema))).not.toThrow();
  });
});

// ─── FAQ ───────────────────────────────────────────────────────────────────

describe("getFAQSchema", () => {
  const items = [
    { question: "SGS Land là gì?", answer: "SGS LAND là nền tảng bất động sản AI." },
    { question: "Giá Aqua City bao nhiêu?", answer: "Từ 3 tỷ VND." },
  ];
  const schema = getFAQSchema(items);

  it("has @type FAQPage", () => {
    expect(schema["@type"]).toBe("FAQPage");
  });

  it("mainEntity length matches input array length", () => {
    expect(schema.mainEntity).toHaveLength(items.length);
  });

  it("each Question has a non-empty acceptedAnswer.text", () => {
    for (const q of schema.mainEntity) {
      expect(q["@type"]).toBe("Question");
      expect(q.acceptedAnswer["@type"]).toBe("Answer");
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });
});

describe("FAQ_HOMEPAGE", () => {
  it("has exactly 8 items", () => {
    expect(FAQ_HOMEPAGE).toHaveLength(8);
  });

  it("every item has a non-empty question and answer", () => {
    for (const item of FAQ_HOMEPAGE) {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.answer.length).toBeGreaterThan(30);
    }
  });
});

// ─── BreadcrumbList ────────────────────────────────────────────────────────

describe("getBreadcrumbSchema", () => {
  const items = [
    { name: "Trang chủ", url: SITE_URL },
    { name: "Dự án", url: `${SITE_URL}/du-an` },
    { name: "Aqua City", url: `${SITE_URL}/du-an/aqua-city` },
  ];
  const schema = getBreadcrumbSchema(items);

  it("has @type BreadcrumbList", () => {
    expect(schema["@type"]).toBe("BreadcrumbList");
  });

  it("itemListElement length matches input", () => {
    expect(schema.itemListElement).toHaveLength(items.length);
  });

  it("positions are sequential starting at 1", () => {
    schema.itemListElement.forEach((el, i) => {
      expect(el.position).toBe(i + 1);
      expect(el["@type"]).toBe("ListItem");
    });
  });

  it("preserves names and URLs", () => {
    expect(schema.itemListElement[0].name).toBe("Trang chủ");
    expect(schema.itemListElement[2].item).toContain("aqua-city");
  });
});

// ─── Person / Founders ────────────────────────────────────────────────────

describe("getFoundersSchema", () => {
  const founders = getFoundersSchema();

  it("returns exactly 3 founders", () => {
    expect(founders).toHaveLength(3);
  });

  it("each person has @type Person, name, jobTitle, and worksFor", () => {
    for (const p of founders) {
      expect(p["@type"]).toBe("Person");
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.jobTitle.length).toBeGreaterThan(0);
      expect(p.worksFor["@id"]).toBe(ORG_ID);
    }
  });

  it("each @id is unique", () => {
    const ids = founders.map((p) => p["@id"]);
    expect(new Set(ids).size).toBe(3);
  });

  it("includes a CEO", () => {
    expect(founders.some((p) => p.jobTitle.includes("CEO"))).toBe(true);
  });
});
