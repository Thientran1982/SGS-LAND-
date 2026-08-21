// @ts-nocheck
import { SITE_URL, ORG_ID } from "./constants";

export interface RealEstateProject {
  name: string;
  slug?: string;
  description?: string;
  location?: string;
  district?: string;
  city?: string;
  developer?: string;
  images?: string[];
  price_range?: string;
  total_units?: number;
  floors?: number;
  /** Numeric price low bound in VND */
  price_low?: number;
  /** Numeric price high bound in VND */
  price_high?: number;
  /** Hectares */
  area_ha?: number;
  amenities?: string[];
  geo?: { latitude: number; longitude: number };
}

export interface RealEstateListingSchema {
  "@context": "https://schema.org";
  "@type": "RealEstateListing";
  "@id": string;
  name: string;
  description: string;
  url: string;
  image?: string | string[];
  address: {
    "@type": "PostalAddress";
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    addressCountry: string;
  };
  geo?: {
    "@type": "GeoCoordinates";
    latitude: number;
    longitude: number;
  };
  offers?: {
    "@type": "AggregateOffer";
    priceCurrency: "VND";
    lowPrice?: number;
    highPrice?: number;
    offerCount?: number;
    availability: string;
  };
  floorSize?: {
    "@type": "QuantitativeValue";
    value: number;
    unitCode: "HEC";
    unitText: "ha";
  };
  numberOfRooms?: number;
  amenityFeature?: { "@type": "LocationFeatureSpecification"; name: string; value: boolean }[];
  provider: { "@id": string };
  brand?: { "@type": "Brand"; name: string };
  dateModified: string;
}

/**
 * Generates a RealEstateListing JSON-LD schema for a project page.
 *
 * GEO note: include price ranges, area, and amenities — AI engines extract
 * numeric facts (±5% valuation accuracy, ha size, unit counts) as high-value
 * statistics that increase citation probability by ~34%.
 */
export function getRealEstateListingSchema(project: RealEstateProject): RealEstateListingSchema {
  const slug = project.slug ?? project.name.toLowerCase().replace(/\s+/g, "-");
  const projectUrl = `${SITE_URL}/du-an/${slug}`;
  const city = project.city ?? project.location ?? "TP. Hồ Chí Minh";
  const addressLocality = project.district ?? project.location ?? city;

  const amenityFeature =
    project.amenities?.map((name) => ({
      "@type": "LocationFeatureSpecification" as const,
      name,
      value: true,
    })) ?? [];

  const images = project.images?.length
    ? project.images.length === 1
      ? project.images[0]
      : project.images
    : `${SITE_URL}/images/projects/${slug}.jpg`;

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${projectUrl}#listing`,
    name: project.name,
    description:
      project.description ??
      `Thông tin dự án ${project.name} tại ${city}. Đại lý phân phối uỷ quyền SGS LAND — pháp lý xác minh, tư vấn miễn phí.`,
    url: projectUrl,
    image: images,
    address: {
      "@type": "PostalAddress",
      streetAddress: project.location,
      addressLocality,
      addressRegion: city,
      addressCountry: "VN",
    },
    ...(project.geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: (project.geo as any).lat ?? project.geo.latitude,
        longitude: (project.geo as any).lng ?? project.geo.longitude,
      },
    }),
    ...((project.price_low !== undefined || project.price_high !== undefined || project.total_units !== undefined) && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "VND",
        ...(project.price_low !== undefined && { lowPrice: project.price_low }),
        ...(project.price_high !== undefined && { highPrice: project.price_high }),
        ...(project.total_units !== undefined && { offerCount: project.total_units }),
        availability: "https://schema.org/InStock",
      },
    }),
    ...(project.area_ha !== undefined && {
      floorSize: {
        "@type": "QuantitativeValue",
        value: project.area_ha,
        unitCode: "HEC",
        unitText: "ha",
      },
    }),
    ...(amenityFeature.length > 0 && { amenityFeature }),
    provider: { "@id": ORG_ID },
    ...(project.developer && {
      brand: { "@type": "Brand", name: project.developer },
    }),
    dateModified: new Date().toISOString().split("T")[0],
  };
}

export interface ApartmentComplexInput {
  name: string;
  url: string;
  description: string;
  location: string;
  developer: string;
  numberOfRooms?: string;
  floorLevel?: string;
  amenities?: string[];
  priceRange?: string;
  image?: string;
}

export function getApartmentComplexSchema(input: ApartmentComplexInput) {
  return {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    "name": input.name,
    "url": input.url,
    "description": input.description,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": input.location,
      "addressCountry": "VN"
    },
    "brand": {
      "@type": "Brand",
      "name": input.developer
    },
    ...(input.numberOfRooms ? { "numberOfRooms": input.numberOfRooms } : {}),
    ...(input.amenities && input.amenities.length > 0 ? {
      "amenityFeature": input.amenities.map(a => ({
        "@type": "LocationFeatureSpecification",
        "name": a,
        "value": true
      }))
    } : {}),
    ...(input.priceRange ? { "priceRange": input.priceRange } : {}),
    "hasMap": `https://maps.google.com/?q=${encodeURIComponent(input.location)}`,
    "provider": {
      "@type": "RealEstateAgent",
      "name": "SGS LAND",
      "telephone": "+84-971-132-378",
      "url": "https://sgsland.vn"
    }
  };
}
