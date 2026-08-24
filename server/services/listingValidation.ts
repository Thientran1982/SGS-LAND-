/** Canonical validation for listing writes and licensed market-ingest rows. */
export const LISTING_TYPES = [
  'APARTMENT', 'HOUSE', 'LAND', 'OFFICE', 'PENTHOUSE', 'TOWNHOUSE', 'VILLA',
] as const;
export const LISTING_TRANSACTIONS = ['SALE', 'RENT'] as const;
export const LISTING_CURRENCIES = ['VND', 'USD'] as const;
export const MARKET_PRICE_UNITS = ['VND', 'TY', 'TRIEU', 'VND/M2', 'VND_PER_M2'] as const;

export class ListingValidationError extends Error {
  code = 'LISTING_VALIDATION';
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ListingValidationError';
  }
}

function finitePositive(value: unknown, field: string, required = false): number | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ListingValidationError(`${field} phải là số dương`);
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new ListingValidationError(`${field} phải là số dương hữu hạn`);
  return n;
}

export function validateCoordinates(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ListingValidationError('coordinates phải là object gồm lat và lng');
  }
  const point = value as Record<string, unknown>;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 8 || lat > 24 || lng < 102 || lng > 110) {
    throw new ListingValidationError('Tọa độ phải nằm trong phạm vi hợp lệ của Việt Nam');
  }
}

export function validateListingFields(data: Record<string, any>, existing?: Record<string, any>): Record<string, any> {
  const merged = { ...(existing || {}), ...data };
  if (data.type !== undefined) {
    const type = String(data.type).trim().toUpperCase();
    if (!(LISTING_TYPES as readonly string[]).includes(type)) {
      throw new ListingValidationError(`type không hợp lệ: ${type}`);
    }
    data.type = type;
  }
  if (data.transaction !== undefined) {
    const transaction = String(data.transaction).trim().toUpperCase();
    if (!(LISTING_TRANSACTIONS as readonly string[]).includes(transaction)) {
      throw new ListingValidationError(`transaction không hợp lệ: ${transaction}`);
    }
    data.transaction = transaction;
  }
  if (data.status !== undefined) {
    const status = String(data.status).trim().toUpperCase();
    // Avoid importing the transition service here: this module is also used by
    // low-level repositories and must not create a circular dependency.
    const statuses = ['BOOKING', 'OPENING', 'AVAILABLE', 'HOLD', 'SOLD', 'RENTED', 'INACTIVE', 'BEST_MARKET'];
    if (!statuses.includes(status)) throw new ListingValidationError(`status không hợp lệ: ${status}`);
    data.status = status;
  }
  if (data.currency !== undefined) {
    const currency = String(data.currency).trim().toUpperCase();
    if (!(LISTING_CURRENCIES as readonly string[]).includes(currency)) {
      throw new ListingValidationError(`currency không hợp lệ: ${currency}`);
    }
    data.currency = currency;
  }
  if (data.price !== undefined) data.price = finitePositive(data.price, 'price');
  if (data.area !== undefined) data.area = finitePositive(data.area, 'area');
  if (data.builtArea !== undefined && data.builtArea !== null) data.builtArea = finitePositive(data.builtArea, 'builtArea');
  validateCoordinates(data.coordinates);

  const transaction = String(merged.transaction || 'SALE').toUpperCase();
  const status = String(merged.status || 'AVAILABLE').toUpperCase();
  if (transaction === 'SALE' && status === 'RENTED') {
    throw new ListingValidationError('transaction SALE không tương thích với status RENTED');
  }
  if (transaction === 'RENT' && status === 'SOLD') {
    throw new ListingValidationError('transaction RENT không tương thích với status SOLD');
  }
  return data;
}

export function validateMarketListing(data: {
  price: number | null; priceUnit: string | null; areaM2: number | null;
  lat: number | null; lng: number | null; externalListingId: string;
}): void {
  if (!data.externalListingId?.trim()) throw new ListingValidationError('externalListingId không được để trống');
  if (data.price != null) finitePositive(data.price, 'price');
  if (data.areaM2 != null) finitePositive(data.areaM2, 'areaM2');
  if (data.priceUnit != null) {
    const unit = data.priceUnit.trim().toUpperCase();
    if (!(MARKET_PRICE_UNITS as readonly string[]).includes(unit)) {
      throw new ListingValidationError(`price_unit không hợp lệ: ${data.priceUnit}`);
    }
  }
  const hasLat = data.lat != null;
  const hasLng = data.lng != null;
  if (hasLat !== hasLng) throw new ListingValidationError('lat và lng phải cùng có hoặc cùng không có');
  if (hasLat) validateCoordinates({ lat: data.lat, lng: data.lng });
}