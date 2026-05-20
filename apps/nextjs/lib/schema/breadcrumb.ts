export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: {
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }[];
}

/**
 * Generates a BreadcrumbList JSON-LD schema.
 *
 * Breadcrumbs help AI engines understand site hierarchy and are extracted
 * as navigation context in Google AI Overviews and Perplexity citations.
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
