const BASE_URL = 'https://sgsland.vn';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;

export interface SEOConfig {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

export const ROUTE_SEO: Record<string, SEOConfig> = {
  '': {
    title: 'SGS LAND | Phần Mềm Quản Lý Bất Động Sản AI Số 1 Việt Nam',
    description: 'SGS LAND - Phần mềm quản lý bất động sản thế hệ mới tích hợp AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
    path: '/',
  },
  landing: {
    title: 'SGS LAND | Phần Mềm Quản Lý Bất Động Sản AI Số 1 Việt Nam',
    description: 'SGS LAND - Phần mềm quản lý bất động sản thế hệ mới tích hợp AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
    path: '/',
  },
  search: {
    title: 'Tìm Kiếm Bất Động Sản | Kho Hàng Cập Nhật Realtime - SGS LAND',
    description: 'Tìm kiếm bất động sản theo vị trí, loại hình, diện tích và mức giá. Kho hàng hàng nghìn bất động sản được cập nhật realtime trên toàn quốc.',
    path: '/search',
  },
  'ai-valuation': {
    title: 'Định Giá Bất Động Sản Bằng AI Tự Động | Chính Xác 98% - SGS LAND',
    description: 'Công nghệ định giá bất động sản AI tự động từ SGS LAND. Phân tích hàng nghìn giao dịch thực tế, cho kết quả chính xác 98% chỉ trong vài giây. Hoàn toàn miễn phí.',
    path: '/ai-valuation',
  },
  news: {
    title: 'Tin Tức Bất Động Sản Mới Nhất | Thị Trường BĐS Hôm Nay - SGS LAND',
    description: 'Cập nhật tin tức bất động sản mới nhất, phân tích thị trường, xu hướng giá và các chính sách pháp luật liên quan đến bất động sản Việt Nam.',
    path: '/news',
  },
  login: {
    title: 'Đăng Nhập | SGS LAND Enterprise',
    description: 'Đăng nhập vào nền tảng quản lý bất động sản SGS LAND. Truy cập CRM, kho hàng và công cụ định giá AI.',
    path: '/login',
    noIndex: true,
  },
  register: {
    title: 'Đăng Ký Dùng Thử Miễn Phí | SGS LAND Enterprise',
    description: 'Đăng ký dùng thử SGS LAND miễn phí. Trải nghiệm phần mềm quản lý bất động sản AI đầy đủ tính năng trong 30 ngày.',
    path: '/register',
  },
  inventory: {
    title: 'Quản Lý Kho Hàng Bất Động Sản | SGS LAND',
    description: 'Hệ thống quản lý kho hàng bất động sản toàn diện với phân loại, lọc nhanh và cập nhật trạng thái realtime.',
    path: '/inventory',
    noIndex: true,
  },
  leads: {
    title: 'Quản Lý Khách Hàng CRM | SGS LAND',
    description: 'Quản lý và theo dõi khách hàng tiềm năng với CRM tích hợp đa kênh Zalo, Facebook và Email.',
    path: '/leads',
    noIndex: true,
  },
  billing: {
    title: 'Gói Dịch Vụ & Thanh Toán | SGS LAND',
    description: 'Các gói dịch vụ phần mềm quản lý bất động sản SGS LAND phù hợp với mọi quy mô doanh nghiệp.',
    path: '/billing',
    noIndex: true,
  },
  'seo-manager': {
    title: 'SEO Manager | SGS LAND Admin',
    description: 'Quản lý và kiểm tra SEO cho toàn bộ nền tảng SGS LAND.',
    path: '/seo-manager',
    noIndex: true,
  },
};

function setMeta(selector: string, attr: string, value: string) {
  let el = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!el) return;
  (el as any)[attr] = value;
}

const SEO_OVERRIDES_KEY = 'sgs_seo_overrides';

export function getSEOOverrides(): Record<string, { title: string; description: string }> {
  try {
    const raw = localStorage.getItem(SEO_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveSEOOverride(routeBase: string, title: string, description: string): void {
  const overrides = getSEOOverrides();
  overrides[routeBase] = { title, description };
  localStorage.setItem(SEO_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function clearSEOOverride(routeBase: string): void {
  const overrides = getSEOOverrides();
  delete overrides[routeBase];
  localStorage.setItem(SEO_OVERRIDES_KEY, JSON.stringify(overrides));
}

export const SEO_BASE_URL = BASE_URL;

export function updatePageSEO(routeBase: string): void {
  const baseCfg = ROUTE_SEO[routeBase] ?? ROUTE_SEO[''];
  const overrides = getSEOOverrides();
  const override = overrides[routeBase];
  const title = override?.title ?? baseCfg.title;
  const description = override?.description ?? baseCfg.description;
  const cfg = { ...baseCfg, title, description };
  const fullUrl = `${BASE_URL}${cfg.path}`;
  const image = cfg.image ?? DEFAULT_IMAGE;

  document.title = cfg.title;

  setMeta('meta[name="description"]', 'content', cfg.description);
  setMeta('meta[name="robots"]', 'content', cfg.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
  if (canonical) canonical.href = fullUrl;

  setMeta('meta[property="og:title"]', 'content', cfg.title);
  setMeta('meta[property="og:description"]', 'content', cfg.description);
  setMeta('meta[property="og:image"]', 'content', image);
  const ogUrl = document.getElementById('og-url') as HTMLMetaElement | null;
  if (ogUrl) ogUrl.content = fullUrl;

  setMeta('meta[name="twitter:title"]', 'content', cfg.title);
  setMeta('meta[name="twitter:description"]', 'content', cfg.description);
  setMeta('meta[name="twitter:image"]', 'content', image);
}

// =============================================================================
// DYNAMIC SEO — Per-Listing and Per-Article injection
// =============================================================================

function applyDynamicSEO(title: string, description: string, image: string, canonicalPath: string, noIndex = false): void {
  const fullUrl = `${BASE_URL}${canonicalPath}`;
  document.title = title;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[name="robots"]', 'content', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
  if (canonical) canonical.href = fullUrl;
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:image"]', 'content', image);
  const ogUrl = document.getElementById('og-url') as HTMLMetaElement | null;
  if (ogUrl) ogUrl.content = fullUrl;
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="twitter:image"]', 'content', image);
}

function formatVNDShort(price: number, currency: 'VND' | 'USD'): string {
  if (currency === 'USD') return `$${(price / 1_000).toFixed(0)}K`;
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)} tỷ VNĐ`;
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(0)} triệu VNĐ`;
  return `${price.toLocaleString('vi-VN')} VNĐ`;
}

export interface ListingForSEO {
  id: string;
  title: string;
  location: string;
  price: number;
  currency: 'VND' | 'USD';
  area: number;
  type?: string;
  transaction?: string;
  bedrooms?: number;
  images?: string[];
}

export interface ArticleForSEO {
  id: string;
  title: string;
  excerpt: string;
  image?: string;
  author?: string;
  date?: string;
  category?: string;
}

export function injectListingSEO(listing: ListingForSEO): void {
  const priceStr = formatVNDShort(listing.price, listing.currency);
  const title = `${listing.title} | ${listing.location} – SGS LAND`.slice(0, 70);
  const bedroomStr = listing.bedrooms ? `, ${listing.bedrooms} PN` : '';
  const description = `${listing.type ?? 'Bất động sản'} tại ${listing.location}. Diện tích ${listing.area}m²${bedroomStr}, giá ${priceStr}. Xem chi tiết và đặt lịch xem nhà trên SGS LAND.`.slice(0, 160);
  const image = listing.images?.[0] ?? DEFAULT_IMAGE;
  const canonicalPath = `/listing/${listing.id}`;
  applyDynamicSEO(title, description, image, canonicalPath);
}

export function injectArticleSEO(article: ArticleForSEO): void {
  const title = `${article.title} | SGS LAND`.slice(0, 70);
  const description = (article.excerpt ?? '').slice(0, 160);
  const image = article.image ?? DEFAULT_IMAGE;
  const canonicalPath = `/news/${article.id}`;
  applyDynamicSEO(title, description, image, canonicalPath);
}

export function clearDynamicSEO(routeBase: string): void {
  updatePageSEO(routeBase);
}
