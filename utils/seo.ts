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
  // Default / root (hash empty)
  '': {
    title: 'SGS LAND | Phần Mềm Quản Lý Bất Động Sản AI Số 1 Việt Nam',
    description: 'SGS LAND - Phần mềm quản lý bất động sản thế hệ mới tích hợp AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
    path: '/',
  },
  // ROUTES.LANDING = 'home'
  home: {
    title: 'SGS LAND | Phần Mềm Quản Lý Bất Động Sản AI Số 1 Việt Nam',
    description: 'SGS LAND - Phần mềm quản lý bất động sản thế hệ mới tích hợp AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
    path: '/home',
  },
  // ROUTES.SEARCH = 'marketplace'
  marketplace: {
    title: 'Tìm Kiếm Bất Động Sản | Kho Hàng Cập Nhật Realtime - SGS LAND',
    description: 'Tìm kiếm bất động sản theo vị trí, loại hình, diện tích và mức giá. Kho hàng hàng nghìn bất động sản được cập nhật realtime trên toàn quốc.',
    path: '/marketplace',
  },
  // ROUTES.AI_VALUATION = 'ai-valuation'
  'ai-valuation': {
    title: 'Định Giá Bất Động Sản Bằng AI Tự Động | Chính Xác 98% - SGS LAND',
    description: 'Công nghệ định giá bất động sản AI tự động từ SGS LAND. Phân tích hàng nghìn giao dịch thực tế, cho kết quả chính xác 98% chỉ trong vài giây. Hoàn toàn miễn phí.',
    path: '/ai-valuation',
  },
  // ROUTES.CRM_SOLUTION = 'crm-platform'
  'crm-platform': {
    title: 'Nền Tảng CRM Bất Động Sản Thế Hệ Mới | SGS LAND',
    description: 'Hệ thống CRM bất động sản tích hợp AI, đa kênh Zalo/Facebook/Email, tự động hóa quy trình từ lead đến hợp đồng. Dành cho sàn giao dịch và môi giới chuyên nghiệp.',
    path: '/crm-platform',
  },
  // ROUTES.ABOUT = 'about-us'
  'about-us': {
    title: 'Về Chúng Tôi | SGS LAND – Đội Ngũ & Tầm Nhìn',
    description: 'SGS LAND - Công ty công nghệ bất động sản hàng đầu Việt Nam với đội ngũ chuyên gia AI và bất động sản. Tìm hiểu về tầm nhìn, sứ mệnh và giá trị cốt lõi của chúng tôi.',
    path: '/about-us',
  },
  // ROUTES.NEWS = 'news'
  news: {
    title: 'Tin Tức Bất Động Sản Mới Nhất | Thị Trường BĐS Hôm Nay - SGS LAND',
    description: 'Cập nhật tin tức bất động sản mới nhất, phân tích thị trường, xu hướng giá và các chính sách pháp luật liên quan đến bất động sản Việt Nam.',
    path: '/news',
  },
  // ROUTES.CONTACT = 'contact'
  contact: {
    title: 'Liên Hệ Tư Vấn | SGS LAND',
    description: 'Liên hệ với đội ngũ tư vấn SGS LAND để được hỗ trợ demo, tư vấn gói dịch vụ và tích hợp phần mềm quản lý bất động sản.',
    path: '/contact',
  },
  // ROUTES.CAREERS = 'careers'
  careers: {
    title: 'Tuyển Dụng | Cơ Hội Nghề Nghiệp tại SGS LAND',
    description: 'Tham gia đội ngũ SGS LAND – nơi công nghệ và bất động sản hội tụ. Khám phá cơ hội việc làm trong lĩnh vực AI, product và business development.',
    path: '/careers',
  },
  // ROUTES.HELP_CENTER = 'help-center'
  'help-center': {
    title: 'Trung Tâm Hỗ Trợ | SGS LAND Help Center',
    description: 'Tìm hướng dẫn sử dụng, câu hỏi thường gặp và tài liệu kỹ thuật cho nền tảng quản lý bất động sản SGS LAND.',
    path: '/help-center',
  },
  // ROUTES.API_DOCS = 'developers'
  developers: {
    title: 'API & Tài Liệu Kỹ Thuật | SGS LAND Developers',
    description: 'Tài liệu API SGS LAND dành cho nhà phát triển. Tích hợp dữ liệu bất động sản, định giá AI và CRM vào ứng dụng của bạn.',
    path: '/developers',
  },
  // ROUTES.STATUS_PUBLIC = 'status'
  status: {
    title: 'Trạng Thái Hệ Thống | SGS LAND Status',
    description: 'Theo dõi trạng thái hoạt động realtime của nền tảng SGS LAND – uptime, latency và sự cố hệ thống.',
    path: '/status',
  },
  // ROUTES.PRIVACY = 'privacy-policy'
  'privacy-policy': {
    title: 'Chính Sách Bảo Mật | SGS LAND',
    description: 'Chính sách bảo mật dữ liệu của SGS LAND. Tìm hiểu cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn.',
    path: '/privacy-policy',
  },
  // ROUTES.TERMS = 'terms-of-service'
  'terms-of-service': {
    title: 'Điều Khoản Sử Dụng | SGS LAND',
    description: 'Điều khoản và điều kiện sử dụng nền tảng SGS LAND. Quyền lợi và trách nhiệm của người dùng và nhà cung cấp dịch vụ.',
    path: '/terms-of-service',
  },
  // ROUTES.COOKIES = 'cookie-settings'
  'cookie-settings': {
    title: 'Cài Đặt Cookie | SGS LAND',
    description: 'Quản lý tùy chọn cookie và theo dõi của bạn trên nền tảng SGS LAND.',
    path: '/cookie-settings',
    noIndex: true,
  },
  // ROUTES.LOGIN = 'login'
  login: {
    title: 'Đăng Nhập | SGS LAND Enterprise',
    description: 'Đăng nhập vào nền tảng quản lý bất động sản SGS LAND. Truy cập CRM, kho hàng và công cụ định giá AI.',
    path: '/login',
    noIndex: true,
  },
  // ROUTES.INVENTORY = 'inventory'
  inventory: {
    title: 'Quản Lý Kho Hàng Bất Động Sản | SGS LAND',
    description: 'Hệ thống quản lý kho hàng bất động sản toàn diện với phân loại, lọc nhanh và cập nhật trạng thái realtime.',
    path: '/inventory',
    noIndex: true,
  },
  // ROUTES.LEADS = 'leads'
  leads: {
    title: 'Quản Lý Khách Hàng CRM | SGS LAND',
    description: 'Quản lý và theo dõi khách hàng tiềm năng với CRM tích hợp đa kênh Zalo, Facebook và Email.',
    path: '/leads',
    noIndex: true,
  },
  // ROUTES.BILLING = 'billing'
  billing: {
    title: 'Gói Dịch Vụ & Thanh Toán | SGS LAND',
    description: 'Các gói dịch vụ phần mềm quản lý bất động sản SGS LAND phù hợp với mọi quy mô doanh nghiệp.',
    path: '/billing',
    noIndex: true,
  },
  // ROUTES.SEO_MANAGER = 'seo-manager'
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
