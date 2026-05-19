// ─── SGS LAND — Shared TypeScript Types ──────────────────────────────────────

export interface Listing {
  id: string;
  code: string;
  title: string;
  slug: string;
  price: number;
  price_unit?: string;       // "tỷ" | "triệu/m²"
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string | number;
  tower?: string;
  view?: string;
  direction?: string;
  status?: string;
  type?: string;             // property type alias (căn hộ, villa, đất…)
  property_type?: string;
  location?: string;         // human-readable address / district + city
  legalStatus?: string;      // pháp lý
  address?: string;
  district?: string;
  city?: string;
  project_code?: string;
  project_name?: string;
  images?: string[];
  description?: string;
  features?: string[];
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
  agent_name?: string;
  agent_phone?: string;
}

export interface Project {
  id?: string;
  code: string;
  name: string;
  slug?: string;
  developer?: string;
  location?: string;
  district?: string;
  city?: string;
  description?: string;
  images?: string[];
  total_units?: number;
  floors?: number;
  towers?: number;
  handover_date?: string;
  status?: string;
  price_range?: string;
  amenities?: string[];
  listings?: Listing[];
  listing_count?: number;
}

export interface BankRate {
  bank_name: string;
  bank_code?: string;
  logo?: string;
  rates: BankRateDetail[];
  updated_at?: string;
  // Static fallback fields (used when backend unavailable)
  bank?: string;
  rate6m?: string;
  rate12m?: string;
  rate24m?: string;
  rate36m?: string;
  note?: string;
}

export interface BankRateDetail {
  term: string;           // "6 tháng", "12 tháng", "24 tháng"
  term_months?: number;
  rate: number;           // percentage, e.g. 5.2
  type?: "tiết kiệm" | "vay" | "online";
}

export interface MarketStats {
  total_listings: number;
  avg_price_sqm: number;
  price_change_pct?: number;
  districts?: DistrictStat[];
  property_types?: PropertyTypeStat[];
  updated_at?: string;
}

export interface DistrictStat {
  district: string;
  avg_price_sqm: number;
  listing_count: number;
}

export interface PropertyTypeStat {
  type: string;
  count: number;
  avg_price: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source?: string;
  status?: "new" | "contacted" | "qualified" | "converted" | "lost";
  score?: number;
  notes?: string;
  assigned_to?: string;
  property_interest?: string;
  budget?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  total_leads: number;
  total_listings: number;
  contracts_this_month: number;
  revenue_this_month: number;
  leads_trend?: number;
  listings_trend?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  message?: string;
  success?: boolean;
}

export interface ListingsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  district?: string;
  city?: string;
  property_type?: string;
  bedrooms?: number;
  min_price?: number;
  max_price?: number;
  min_area?: number;
  max_area?: number;
  project_code?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "area_asc";
  featured?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface ValuationRequest {
  address: string;
  area: number;
  bedrooms?: number;
  floor?: number;
  property_type?: string;
  project_code?: string;
}

export interface ValuationResult {
  estimated_price: number;
  price_per_sqm: number;
  confidence: number;        // 0-1
  price_range: {
    min: number;
    max: number;
  };
  comparable_listings?: Listing[];
  methodology?: string;
}
