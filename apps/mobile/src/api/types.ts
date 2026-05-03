// Subset of the web `types.ts` — only the public marketplace shapes the buyer
// app consumes. Kept intentionally minimal so the mobile app stays decoupled
// from the (much larger) admin/CRM type surface.

export type PropertyType = 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'LAND' | 'PROJECT' | string;
export type TransactionType = 'SALE' | 'RENT' | string;
export type ListingStatus = 'AVAILABLE' | 'BOOKING' | 'OPENING' | 'SOLD' | 'PAUSED' | string;

export interface ListingBranding {
  tenantId: string;
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  hotline: string | null;
  hotlineDisplay: string | null;
  zalo: string | null;
  messenger: string | null;
}

export interface PublicListing {
  id: string;
  code?: string | null;
  title: string;
  type: PropertyType;
  transaction: TransactionType;
  status: ListingStatus;
  price: number | null;
  currency?: string | null;
  area: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  direction?: string | null;
  legalStatus?: string | null;
  description?: string | null;
  location: string | null;
  coordinates?: { lat: number; lng: number } | null;
  images: string[];
  videoUrl?: string | null;
  isVerified?: boolean;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  branding?: ListingBranding | null;
}

export interface PaginatedListings {
  data: PublicListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CursorListings {
  data: PublicListing[];
  total: number;
  nextCursor: string | null;
  hasNext: boolean;
}

export interface ListingFilters {
  type?: PropertyType;
  transaction?: TransactionType;
  location?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  isVerified?: boolean;
  projectCode?: string;
}

export interface LeadInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  source?: string;
}

export interface LeadResponse {
  id: string;
  success: boolean;
  deduped?: boolean;
}
