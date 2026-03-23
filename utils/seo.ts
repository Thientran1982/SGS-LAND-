const BASE_URL = 'https://sgsland.vn';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;

interface SEOConfig {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

const ROUTE_SEO: Record<string, SEOConfig> = {
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
};

function setMeta(selector: string, attr: string, value: string) {
  let el = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!el) return;
  (el as any)[attr] = value;
}

export function updatePageSEO(routeBase: string): void {
  const cfg = ROUTE_SEO[routeBase] ?? ROUTE_SEO[''];
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
