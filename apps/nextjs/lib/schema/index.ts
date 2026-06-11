// @ts-nocheck
export { SITE_URL, SITE_NAME, ORG_ID, WEBSITE_ID, LOGO_ID } from "./constants";

export { getOrganizationSchema } from "./organization";
export type { OrganizationSchema, GeoCoordinates, PostalAddress, ContactPoint, AggregateRating } from "./organization";

export { getWebsiteSchema } from "./website";
export type { WebsiteSchema } from "./website";

export { getRealEstateListingSchema } from "./realestate-listing";
export type { RealEstateListingSchema, RealEstateProject } from "./realestate-listing";

export { getFAQSchema, getFAQSchemaForPage, FAQ_HOMEPAGE } from "./faq";
export type { FAQItem } from "./faq";

export { getBreadcrumbSchema, getProjectBreadcrumbSchema, BREADCRUMBS } from "./breadcrumb";
export type { BreadcrumbItem } from "./breadcrumb";

export { getFoundersSchema } from "./person";
export type { PersonSchema } from "./person";

export { getApartmentComplexSchema } from "./realestate-listing";
export type { ApartmentComplexInput } from "./realestate-listing";

export {
  getEntityDisambiguationSchema,
  getMetricsSchema,
  getLocalBusinessSchema,
  getProjectAnnouncementSchema,
  FAQ_KNOWLEDGE_GRAPH,
} from "./knowledge-graph";

export * from "./author";
export * from "./video";
export * from "./announcement";
export * from "./reviews";
