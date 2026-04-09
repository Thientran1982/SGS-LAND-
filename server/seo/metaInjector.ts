/**
 * Server-side SEO meta tag injection.
 *
 * Reads dist/index.html (production) and replaces static meta tags with
 * dynamic content derived from the DB — so crawlers (Google, Facebook,
 * Zalo, Telegram, etc.) always see the correct title / description / image
 * without executing JavaScript.
 */

import { readFileSync } from 'fs';
import path from 'path';

const APP_URL = (process.env.APP_URL || 'https://sgsland.vn').replace(/\/$/, '');
const DEFAULT_IMAGE = `${APP_URL}/og-image.jpg`;

const DEFAULT_META = {
  title: 'SGS LAND | Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam',
  description:
    'SGS LAND - Nền tảng BĐS AI: định giá tự động, CRM đa kênh, quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
  image: DEFAULT_IMAGE,
  url: APP_URL,
  type: 'website',
};

/** Server-side route → meta mapping (mirrors utils/seo.ts ROUTE_SEO without browser APIs). */
const STATIC_PAGE_META: Record<string, { title: string; description: string; h1?: string; noIndex?: boolean; structuredData?: object }> = {
  '':                      { title: DEFAULT_META.title, description: DEFAULT_META.description, h1: 'SGS LAND - Nền Tảng Quản Lý Bất Động Sản AI' },
  home:                    { title: DEFAULT_META.title, description: DEFAULT_META.description, h1: 'SGS LAND - Nền Tảng Quản Lý Bất Động Sản AI' },
  marketplace:             { title: 'Mua Bán Bất Động Sản | Nhà Đất Toàn Quốc - SGS LAND', description: 'Mua bán bất động sản toàn quốc — tìm kiếm nhà đất, căn hộ, biệt thự theo vị trí, diện tích và mức giá. Kho hàng nghìn bất động sản cập nhật realtime.', h1: 'Mua Bán Bất Động Sản | Nhà Đất Toàn Quốc' },
  'ai-valuation':          { title: 'Định Giá Bất Động Sản Bằng AI | Sai Số ±5% - SGS LAND', description: 'Công nghệ định giá bất động sản AI từ SGS LAND với sai số chỉ ±5–10% — ngang chuẩn thẩm định viên chuyên nghiệp. Hoàn toàn miễn phí.', h1: 'Định Giá Bất Động Sản Bằng AI' },
  'crm-platform':          { title: 'Nền Tảng CRM Bất Động Sản Thế Hệ Mới | SGS LAND', description: 'Hệ thống CRM bất động sản tích hợp AI, đa kênh Zalo/Facebook/Email, tự động hóa quy trình từ lead đến hợp đồng.', h1: 'CRM Bất Động Sản Thế Hệ Mới' },
  'about-us':              { title: 'Về Chúng Tôi | SGS LAND – Đội Ngũ & Tầm Nhìn', description: 'SGS LAND - Công ty công nghệ bất động sản hàng đầu Việt Nam. Tìm hiểu về tầm nhìn, sứ mệnh và giá trị cốt lõi của chúng tôi.', h1: 'Về SGS LAND' },
  news:                    { title: 'Tin Tức Bất Động Sản | Thị Trường BĐS Cập Nhật - SGS LAND', description: 'Cập nhật tin tức bất động sản mới nhất, phân tích thị trường, xu hướng giá và các chính sách pháp luật liên quan đến bất động sản Việt Nam.', h1: 'Tin Tức Bất Động Sản Mới Nhất' },
  contact:                 { title: 'Liên Hệ Tư Vấn | SGS LAND', description: 'Liên hệ với đội ngũ tư vấn SGS LAND để được hỗ trợ demo, tư vấn gói dịch vụ và tích hợp nền tảng quản lý bất động sản.', h1: 'Liên Hệ SGS LAND' },
  careers:                 { title: 'Tuyển Dụng | Cơ Hội Nghề Nghiệp tại SGS LAND', description: 'Tham gia đội ngũ SGS LAND – nơi công nghệ và bất động sản hội tụ. Khám phá cơ hội việc làm trong lĩnh vực AI, product và business development.', h1: 'Cơ Hội Nghề Nghiệp tại SGS LAND' },
  'help-center':           { title: 'Trung Tâm Hỗ Trợ | SGS LAND Help Center', description: 'Tìm hướng dẫn sử dụng, câu hỏi thường gặp và tài liệu kỹ thuật cho nền tảng quản lý bất động sản SGS LAND.', h1: 'Trung Tâm Hỗ Trợ SGS LAND' },
  developers:              { title: 'API & Tài Liệu Kỹ Thuật | SGS LAND Developers', description: 'Tài liệu API SGS LAND dành cho nhà phát triển. Tích hợp dữ liệu bất động sản, định giá AI và CRM vào ứng dụng của bạn.', h1: 'SGS LAND Developer API' },
  status:                  { title: 'Trạng Thái Hệ Thống | SGS LAND Status', description: 'Theo dõi trạng thái hoạt động realtime của nền tảng SGS LAND – uptime, latency và sự cố hệ thống.', h1: 'Trạng Thái Hệ Thống SGS LAND' },
  'privacy-policy':        { title: 'Chính Sách Bảo Mật | SGS LAND', description: 'Chính sách bảo mật dữ liệu của SGS LAND. Tìm hiểu cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn.', h1: 'Chính Sách Bảo Mật' },
  'terms-of-service':      { title: 'Điều Khoản Sử Dụng | SGS LAND', description: 'Điều khoản và điều kiện sử dụng nền tảng SGS LAND. Quyền lợi và trách nhiệm của người dùng và nhà cung cấp dịch vụ.', h1: 'Điều Khoản Sử Dụng' },
  'ky-gui-bat-dong-san':   { title: 'Ký Gửi Bất Động Sản | Bán Nhanh, Giá Tốt - SGS LAND', description: 'Ký gửi bất động sản tại SGS LAND — đội ngũ chuyên gia định giá miễn phí, tiếp cận hàng nghìn khách hàng tiềm năng và hỗ trợ pháp lý toàn diện.', h1: 'Ký Gửi Bất Động Sản' },
  livechat:                { title: 'Chat Trực Tiếp | Hỗ Trợ Khách Hàng 24/7 - SGS LAND', description: 'Kết nối trực tiếp với đội ngũ tư vấn SGS LAND qua Live Chat. Được hỗ trợ 24/7 về bất động sản, định giá AI và các dịch vụ.', h1: 'Chat Trực Tiếp Với Chuyên Gia' },
  login:                   { title: 'Đăng Nhập | SGS LAND Enterprise', description: 'Đăng nhập vào nền tảng quản lý bất động sản SGS LAND.', noIndex: true },

  // ─── SEO Local & Project Landing Pages ─────────────────────────────────────
  'bat-dong-san-dong-nai': {
    title: 'Bất Động Sản Đồng Nai | Nhà Đất, Căn Hộ, Dự Án - SGS LAND',
    description: 'Tìm mua bán bất động sản Đồng Nai: nhà đất Long Thành, Nhơn Trạch, Biên Hòa. Cập nhật giá thị trường, dự án mới và pháp lý rõ ràng tại SGS LAND.',
    h1: 'Bất Động Sản Đồng Nai',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Bất Động Sản Đồng Nai', item: `${APP_URL}/bat-dong-san-dong-nai` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản Đồng Nai có nên đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Đồng Nai là một trong những thị trường BĐS tiềm năng nhất miền Nam nhờ ba động lực chính: sân bay Long Thành (hoàn thành 2026), các tuyến cao tốc kết nối TP.HCM và làn sóng di dời khu công nghiệp. Giá đất nhiều khu vực tăng 15-25%/năm.' } },
            { '@type': 'Question', name: 'Giá đất Đồng Nai hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 15-50 triệu/m².' } },
            { '@type': 'Question', name: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?', acceptedAnswer: { '@type': 'Answer', text: 'Sân bay quốc tế Long Thành có công suất 25 triệu hành khách/giai đoạn 1. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-dong-nai#agent`,
          name: 'SGS LAND - Bất Động Sản Đồng Nai',
          url: `${APP_URL}/bat-dong-san-dong-nai`,
          areaServed: { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          knowsAbout: ['Bất động sản Đồng Nai', 'Đất nền Long Thành', 'Nhơn Trạch', 'Biên Hòa', 'Sân bay Long Thành'],
        },
      ],
    },
  },
  'bat-dong-san-long-thanh': {
    title: 'Bất Động Sản Long Thành | Đất Nền Sân Bay, Căn Hộ - SGS LAND',
    description: 'Mua bán bất động sản Long Thành, Đồng Nai: đất nền khu vực sân bay Long Thành, dự án căn hộ và liền kề. Cơ hội đầu tư tiềm năng tại SGS LAND.',
    h1: 'Bất Động Sản Long Thành',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'BĐS Đồng Nai', item: `${APP_URL}/bat-dong-san-dong-nai` },
            { '@type': 'ListItem', position: 3, name: 'Bất Động Sản Long Thành', item: `${APP_URL}/bat-dong-san-long-thanh` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Có nên mua đất Long Thành năm 2025-2026 không?', acceptedAnswer: { '@type': 'Answer', text: 'Long Thành là một trong các thị trường BĐS được khuyến nghị đầu tư mạnh. Với sân bay Long Thành hoàn thành giai đoạn 1 năm 2026, giá BĐS được dự báo tiếp tục tăng 15-25%/năm.' } },
            { '@type': 'Question', name: 'Giá đất nền Long Thành hiện nay khoảng bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Đất nền thổ cư mặt tiền đường lớn: 20-35 triệu/m². Đất phân lô dự án sổ sẵn: 10-25 triệu/m². Đất vườn nông nghiệp có thể chuyển đổi: 3-8 triệu/m².' } },
            { '@type': 'Question', name: 'Sân bay Long Thành khai thác vào năm nào?', acceptedAnswer: { '@type': 'Answer', text: 'Sân bay Long Thành giai đoạn 1 dự kiến hoàn thành vào cuối năm 2026, khai thác thương mại đầu năm 2027 với công suất 25 triệu hành khách/năm.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-long-thanh#agent`,
          name: 'SGS LAND - Bất Động Sản Long Thành',
          url: `${APP_URL}/bat-dong-san-long-thanh`,
          areaServed: { '@type': 'City', name: 'Long Thành', containedInPlace: { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Long Thành', 'Đất nền sân bay Long Thành', 'Đầu tư BĐS Đồng Nai'],
        },
      ],
    },
  },
  'du-an/aqua-city': {
    title: 'Aqua City Novaland | Căn Hộ, Biệt Thự Đồng Nai - SGS LAND',
    description: 'Aqua City Novaland Đồng Nai: tổng quan dự án, vị trí, tiện ích đẳng cấp, bảng giá và pháp lý cập nhật. Tư vấn và đặt chỗ miễn phí tại SGS LAND.',
    h1: 'Aqua City Novaland',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Aqua City Novaland', item: `${APP_URL}/du-an/aqua-city` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Aqua City Novaland có đáng mua không?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City là đại đô thị sinh thái 1.000ha với hơn 100.000m² mặt nước, tiện ích 5 sao. Đây là lựa chọn phù hợp cho người mua ở thực và đầu tư dài hạn, đặc biệt hưởng lợi từ cầu Nhơn Trạch và sân bay Long Thành.' } },
            { '@type': 'Question', name: 'Giá căn hộ Aqua City hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo: căn hộ 1-2 phòng ngủ từ 3-5 tỷ; nhà phố liền kề từ 6-12 tỷ; biệt thự đơn lập từ 15-50 tỷ. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.' } },
            { '@type': 'Question', name: 'Aqua City cách TP.HCM bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City tại Nhơn Trạch, cách trung tâm TP.HCM 35-40km. Khi cầu Nhơn Trạch hoàn thành, thời gian di chuyển đến quận 2 chỉ còn 20-25 phút.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          '@id': `${APP_URL}/du-an/aqua-city#project`,
          name: 'Aqua City Novaland',
          description: 'Đại đô thị sinh thái 1.000ha do Novaland phát triển tại Nhơn Trạch, Đồng Nai',
          url: `${APP_URL}/du-an/aqua-city`,
          numberOfRooms: '1-4',
          address: { '@type': 'PostalAddress', addressLocality: 'Nhơn Trạch', addressRegion: 'Đồng Nai', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 1000, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/manhattan': {
    title: 'Dự Án Manhattan | Căn Hộ Cao Cấp Bình Dương - SGS LAND',
    description: 'Dự án Manhattan Bình Dương: vị trí đắc địa, thiết kế hiện đại, giá từ 35 triệu/m². Xem bảng giá, tiến độ xây dựng và chính sách ưu đãi tại SGS LAND.',
    h1: 'Dự Án Manhattan',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Dự Án Manhattan', item: `${APP_URL}/du-an/manhattan` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Dự án Manhattan Bình Dương có ưu điểm gì nổi bật?', acceptedAnswer: { '@type': 'Answer', text: 'Manhattan Bình Dương nổi bật với vị trí trung tâm Bình Dương, thiết kế chuẩn quốc tế phù hợp chuyên gia nước ngoài và giá cạnh tranh hơn căn hộ cao cấp TP.HCM cùng phân khúc.' } },
            { '@type': 'Question', name: 'Giá căn hộ Manhattan Bình Dương từ bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo từ 35 triệu/m², căn hộ 1 phòng ngủ từ 2-3 tỷ, 2 phòng ngủ từ 3-5 tỷ, 3 phòng ngủ từ 5-8 tỷ. Hỗ trợ vay ngân hàng tối đa 70% giá trị.' } },
            { '@type': 'Question', name: 'Có thể cho thuê căn hộ Manhattan không?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương có nhu cầu thuê nhà ở cao nhất cả nước. Căn hộ Manhattan phù hợp cho thuê với giá 10-25 triệu/tháng, tỷ suất lợi nhuận cho thuê ước tính 5-7%/năm.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          '@id': `${APP_URL}/du-an/manhattan#project`,
          name: 'Dự Án Manhattan Bình Dương',
          description: 'Tổ hợp căn hộ cao cấp chuẩn quốc tế tại trung tâm tỉnh lỵ Bình Dương',
          url: `${APP_URL}/du-an/manhattan`,
          address: { '@type': 'PostalAddress', addressLocality: 'Bình Dương', addressCountry: 'VN' },
          offers: { '@type': 'Offer', price: '35000000', priceCurrency: 'VND', unitText: 'm²' },
        },
      ],
    },
  },
};

export interface MetaData {
  title?: string;
  description?: string;
  h1?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: object;
  noIndex?: boolean;
}

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtVND(price: number): string {
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)} tỷ đồng`;
  if (price >= 1_000_000) return `${Math.round(price / 1_000_000)} triệu đồng`;
  return price.toLocaleString('vi-VN') + ' đồng';
}

export function buildListingMeta(listing: any): MetaData {
  const priceStr = listing.price ? fmtVND(Number(listing.price)) : '';
  const areaStr = listing.area ? `${listing.area}m²` : '';
  const transaction = listing.transaction === 'RENT' ? 'Cho thuê' : 'Bán';
  const type = listing.type ?? '';

  const title = listing.title
    ? `${listing.title} | SGS LAND`
    : `${transaction} ${type} ${areaStr} - ${listing.location ?? ''} | SGS LAND`.trim();

  const parts: string[] = [
    listing.title || `${transaction} bất động sản`,
    listing.location ? `Vị trí: ${listing.location}` : '',
    priceStr ? `Giá: ${priceStr}` : '',
    areaStr ? `Diện tích: ${areaStr}` : '',
    listing.bedrooms ? `${listing.bedrooms} phòng ngủ` : '',
  ].filter(Boolean);
  const description = parts.join(' — ').slice(0, 160);

  const images: string[] = Array.isArray(listing.images) ? listing.images : [];
  const image = images[0] || DEFAULT_IMAGE;
  const url = `${APP_URL}/listing/${listing.id}`;

  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    inLanguage: 'vi',
    name: listing.title || '',
    description,
    url,
    image: images.slice(0, 5).length ? images.slice(0, 5) : undefined,
    address: listing.location
      ? { '@type': 'PostalAddress', streetAddress: listing.location, addressCountry: 'VN' }
      : undefined,
    ...(listing.price
      ? { offers: { '@type': 'Offer', price: String(listing.price), priceCurrency: listing.currency || 'VND' } }
      : {}),
    ...(listing.area
      ? { floorSize: { '@type': 'QuantitativeValue', value: listing.area, unitCode: 'MTK' } }
      : {}),
    ...(listing.bedrooms != null ? { numberOfRooms: listing.bedrooms } : {}),
  };

  const h1 = listing.title || `${transaction} ${type} ${areaStr}`.trim() || 'Bất Động Sản SGS LAND';
  return { title, description, h1, image, url, type: 'website', structuredData };
}

export function buildArticleMeta(article: any): MetaData {
  const rawExcerpt =
    article.excerpt ||
    (article.content ? article.content.replace(/<[^>]+>/g, '').slice(0, 160) : '');
  const title = article.title ? `${article.title} - Tin Tức BĐS | SGS LAND` : DEFAULT_META.title;
  const description = rawExcerpt.slice(0, 300) || DEFAULT_META.description;
  const image = article.coverImage || article.cover_image || DEFAULT_IMAGE;
  const url = article.slug ? `${APP_URL}/news/${article.slug}` : `${APP_URL}/news/${article.id}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    inLanguage: 'vi',
    headline: article.title || '',
    description,
    image,
    url,
    datePublished: article.publishedAt || article.published_at || undefined,
    dateModified: article.updatedAt || article.updated_at || undefined,
    author: { '@type': 'Person', name: article.author || 'SGS LAND' },
    publisher: {
      '@type': 'Organization',
      name: 'SGS LAND',
      logo: { '@type': 'ImageObject', url: `${APP_URL}/apple-touch-icon.png` },
    },
  };

  return { title, description, h1: article.title || undefined, image, url, type: 'article', structuredData };
}

export function buildStaticPageMeta(
  overrideTitle: string | null | undefined,
  overrideDesc: string | null | undefined,
  ogImage: string | null | undefined,
  pagePath: string
): MetaData {
  // Full path lookup first (e.g. "du-an/aqua-city"), then first segment, then default
  const fullKey = pagePath.replace(/^\//, '') || '';
  const shortKey = fullKey.split('/')[0] || '';
  const routeMeta = STATIC_PAGE_META[fullKey] ?? STATIC_PAGE_META[shortKey] ?? STATIC_PAGE_META[''];
  return {
    title: overrideTitle || routeMeta.title,
    description: overrideDesc || routeMeta.description,
    h1: routeMeta.h1,
    image: ogImage || DEFAULT_IMAGE,
    url: `${APP_URL}${pagePath}`,
    type: 'website',
    noIndex: routeMeta.noIndex,
    structuredData: routeMeta.structuredData,
  };
}

export function injectMeta(baseHtml: string, meta: MetaData): string {
  const m = { ...DEFAULT_META, ...meta };
  const t = esc(m.title!);
  const d = esc(m.description!);
  const img = m.image!;
  const u = m.url!;
  const type = m.type || 'website';

  let html = baseHtml;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${d}$2`);

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${t}$2`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${d}$2`);
  html = html.replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/i, `$1${type}$2`);
  html = html.replace(
    /(<meta\s+(?:id="og-url"\s+)?property="og:url"\s+content=")[^"]*(")/i,
    `$1${u}$2`
  );
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${img}$2`);
  html = html.replace(/(<meta\s+property="og:image:secure_url"\s+content=")[^"]*(")/i, `$1${img}$2`);
  html = html.replace(/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/i, `$1${t}$2`);

  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i, `$1${t}$2`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i, `$1${d}$2`);
  html = html.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${img}$2`);

  html = html.replace(
    /(<link\s+(?:id="canonical-url"\s+)?rel="canonical"\s+href=")[^"]*(")/i,
    `$1${u}$2`
  );

  if (m.noIndex) {
    html = html.replace(
      /(<meta\s+name="robots"\s+content=")[^"]*(")/i,
      `$1noindex, nofollow$2`
    );
  }

  if (m.h1) {
    const h1Text = esc(m.h1);
    html = html.replace(
      /(<h1[^>]*>)[^<]*(<\/h1>)/i,
      `$1${h1Text}$2`
    );
  }

  if (m.structuredData) {
    const jsonLd = `  <script type="application/ld+json">${JSON.stringify(m.structuredData)}</script>`;
    html = html.replace('</head>', `${jsonLd}\n</head>`);
  }

  return html;
}

let _cachedHtml: string | null = null;

export function getBaseHtml(): string {
  if (!_cachedHtml) {
    const distPath = path.join(process.cwd(), 'dist', 'index.html');
    _cachedHtml = readFileSync(distPath, 'utf-8');
  }
  return _cachedHtml;
}
