// ── Listing types (based on real sgsland.vn API response) ─────────────────────

export type PropertyType =
  | 'Apartment' | 'Villa' | 'Townhouse' | 'Land' | 'Office'
  | 'Shophouse' | 'Warehouse' | 'Hotel' | 'Other';

export type TransactionType = 'SALE' | 'RENT';
export type ListingStatus  = 'AVAILABLE' | 'HOLD' | 'SOLD' | 'RENTED';

export interface ListingAttributes {
  frontage?:    number;
  landType?:    string;
  direction?:   string;
  furniture?:   string;
  roadWidth?:   number;
  description?: string;
  legalStatus?: string;
  floors?:      number;
  yearBuilt?:   number;
}

/** Raw shape returned by /api/public/listings */
export interface RawListing {
  id:              string;
  code:            string;
  title:           string;
  type:            PropertyType;
  status:          ListingStatus;
  transaction:     TransactionType;
  price:           number;
  currency:        string;
  area:            number;
  location:        string;
  coordinates:     { lat: number; lng: number } | null;
  isVerified:      boolean;
  viewCount:       number;
  bookingCount:    number;
  images:          string[];
  attributes:      ListingAttributes;
  bedrooms:        number | null;
  bathrooms:       number | null;
  projectId:       string | null;
  projectCode:     string | null;
  contactPhone:    string | null;
  ownerName:       string | null;
  ownerPhone:      string | null;
  holdExpiresAt:   string | null;
  assignedToName:  string | null;
  assignedToEmail: string | null;
  assignedToRole:  string | null;
  commission:      number | null;
  commissionUnit:  string;
  createdAt:       string;
  updatedAt:       string;
}

/** Normalized listing — enriched + computed fields */
export interface Listing {
  id:            string;
  code:          string;
  title:         string;
  type:          PropertyType;
  status:        ListingStatus;
  transaction:   TransactionType;
  price:         number;
  pricePerM2:    number;
  currency:      string;
  area:          number;
  location:      string;
  lat:           number | null;
  lng:           number | null;
  isVerified:    boolean;
  viewCount:     number;
  bedrooms:      number | null;
  bathrooms:     number | null;
  direction:     string | null;
  frontage:      number | null;
  legalStatus:   string | null;
  furniture:     string | null;
  contactPhone:  string | null;
  images:        string[];
  url:           string;
  projectCode:   string | null;
  createdAt:     string;
  updatedAt:     string;
  valuation?:    ValuationTeaser | null;
}

/** /api/valuation/teaser response */
export interface ValuationTeaser {
  found:              boolean;
  locationDisplay:    string;
  pricePerM2:         number;
  priceMin:           number;
  priceMax:           number;
  pricePerM2Display:  string;
  totalMin:           number;
  totalMid:           number;
  totalMax:           number;
  totalMinDisplay:    string;
  totalMidDisplay:    string;
  totalMaxDisplay:    string;
  area:               number;
  confidence:         number;
  trendText:          string;
  dataSource:         string;
  dataAge:            string;
}

export interface PaginatedResponse {
  data:       RawListing[];
  total:      number;
  totalPages: number;
  page:       number;
  pageSize:   number;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface ListingFilters {
  type?:        string;
  transaction?: string;
  location?:    string;
  minPrice?:    number;
  maxPrice?:    number;
  minArea?:     number;
  maxArea?:     number;
  isVerified?:  boolean;
  search?:      string;
}

export interface ScraperConfig {
  baseUrl:              string;
  pageSize:             number;
  delayMs:              number;
  maxRetries:           number;
  enrichWithValuation:  boolean;
  filters?:             ListingFilters;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface PriceStats {
  min: number; max: number; avg: number;
  median: number; p25: number; p75: number;
}

export interface AreaStats {
  min: number; max: number; avg: number;
}

export interface ScrapeStats {
  totalListings:  number;
  verifiedCount:  number;
  byType:         Record<string, number>;
  byTransaction:  Record<string, number>;
  byStatus:       Record<string, number>;
  price:          PriceStats;
  area:           AreaStats;
  topLocations:   Array<{ location: string; count: number }>;
}

export interface ScrapeResult {
  scrapedAt:    string;
  durationMs:   number;
  config:       ScraperConfig;
  stats:        ScrapeStats;
  listings:     Listing[];
  errors:       Array<{ url: string; error: string }>;
}
