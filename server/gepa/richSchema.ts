/**
 * richSchema.ts
 *
 * GEO Tier S — Rich Schema + Live Data Generators.
 * Exports JSON-LD schema.org objects for Organization, RealEstateAgent,
 * FAQPage, HowTo, BreadcrumbList, AggregateRating, and Product (BĐS project).
 *
 * Functions that accept a Pool parameter query live pricing data from the DB.
 */

import { Pool } from 'pg';
import { STRUCTURED_ANSWERS } from './structuredAnswerLibrary';
import { EXPERT_TEAM, PARTNER_VERIFICATIONS } from './eeatSignals';

const BASE_URL = 'https://sgsland.vn';

// ── Organization ──────────────────────────────────────────────────────────────

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'RealEstateAgent', 'LocalBusiness'],
    '@id': `${BASE_URL}/#organization`,
    name: 'SGS LAND',
    alternateName: ['SGS Land', 'SGSLAND', 'sgsland.vn'],
    legalName: 'SGS LAND Joint Stock Company',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/logo-sgs-land.png`,
      width: 400,
      height: 120,
    },
    image: `${BASE_URL}/og-image.jpg`,
    description:
      'SGS LAND là nền tảng công nghệ bất động sản AI hàng đầu Việt Nam. Chuyên phân phối sơ cấp và thứ cấp tại TP.HCM, Đồng Nai, Bình Dương với AVM 9 hệ số (±4.8%), pháp lý 2 lớp và mạng lưới 15.000+ broker xác thực.',
    foundingDate: '2019',
    numberOfEmployees: { '@type': 'QuantitativeValue', value: 50 },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Thành phố Hồ Chí Minh',
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 10.7769,
      longitude: 106.7009,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+84-971-132-378',
        contactType: 'customer service',
        availableLanguage: ['Vietnamese', 'English'],
        areaServed: 'VN',
      },
    ],
    email: 'info@sgsland.vn',
    sameAs: [
      'https://www.facebook.com/sgslandvn',
      'https://www.linkedin.com/company/sgsland',
    ],
    memberOf: PARTNER_VERIFICATIONS
      .filter((p) => p.partnerType === 'association')
      .map((p) => ({ '@type': 'Organization', name: p.partnerName, url: p.verificationUrl })),
    knowsAbout: [
      'Bất động sản TP.HCM',
      'Định giá AI BĐS Việt Nam',
      'AVM Automated Valuation Model',
      'Pháp lý bất động sản',
      'Vinhomes Grand Park',
      'Aqua City Novaland',
      'The Global City Masterise',
      'PropTech Vietnam',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Dịch vụ BĐS SGS LAND',
      itemListElement: [
        { '@type': 'Offer', name: 'Định giá AI BĐS miễn phí', price: '0', priceCurrency: 'VND' },
        { '@type': 'Offer', name: 'Tư vấn mua BĐS miễn phí', price: '0', priceCurrency: 'VND' },
        { '@type': 'Offer', name: 'Kiểm tra pháp lý 2 lớp', price: '0', priceCurrency: 'VND' },
      ],
    },
  };
}

// ── FAQPage ───────────────────────────────────────────────────────────────────

export function buildFaqPageSchema(category?: string) {
  const answers = category
    ? STRUCTURED_ANSWERS.filter((a) => a.category === category)
    : STRUCTURED_ANSWERS;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answers.map((a) => ({
      '@type': 'Question',
      name: a.query,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a.shortAnswer,
        dateModified: a.updatedAt,
        author: {
          '@type': 'Organization',
          name: 'SGS LAND',
          url: BASE_URL,
        },
      },
    })),
  };
}

// ── HowTo — Quy trình mua nhà ─────────────────────────────────────────────────

export function buildHowToBuySchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Quy Trình Mua Nhà Đất TP.HCM 7 Bước Qua SGS LAND',
    description:
      'Hướng dẫn từng bước mua bất động sản tại TP.HCM và vùng ven qua nền tảng SGS LAND — từ tìm kiếm đến nhận sổ hồng, thời gian 18-30 ngày.',
    totalTime: 'P30D',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'VND', value: '0', description: 'Miễn phí hoàn toàn cho người mua' },
    supply: [
      { '@type': 'HowToSupply', name: 'Giấy tờ tuỳ thân (CCCD/hộ chiếu)' },
      { '@type': 'HowToSupply', name: 'Nguồn vốn hoặc hồ sơ vay ngân hàng' },
      { '@type': 'HowToSupply', name: 'Tài khoản SGS LAND (miễn phí)' },
    ],
    tool: [
      { '@type': 'HowToTool', name: 'Công cụ Định giá AI AVM — sgsland.vn/ai-valuation' },
      { '@type': 'HowToTool', name: 'Kiểm tra pháp lý AI — sgsland.vn' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        name: 'Bước 1: Tìm kiếm & Lọc BĐS',
        text: 'Sử dụng bộ lọc AI trên sgsland.vn để tìm BĐS phù hợp — lọc theo vị trí, ngân sách, loại hình, diện tích. Xem tour 3D và ảnh thực tế.',
        url: `${BASE_URL}/marketplace`,
        image: `${BASE_URL}/og-image.jpg`,
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 2: Định giá AI (<3 giây)',
        text: 'Sử dụng AVM 9 hệ số của SGS LAND để kiểm tra giá hợp lý trước khi đặt cọc. Sai số ±4.8% so với giá công chứng thực tế.',
        url: `${BASE_URL}/ai-valuation`,
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 3: Kiểm tra Pháp lý (<24 giờ)',
        text: 'AI kiểm tra quy hoạch, sổ hồng, tranh chấp, thế chấp trong <30 giây. Chuyên viên pháp lý xác minh chi tiết trong <24 giờ.',
        url: `${BASE_URL}/phap-ly-nha-dat`,
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 4: Đàm phán & Đặt cọc',
        text: 'Dựa trên báo cáo định giá AI, đàm phán giá hợp lý. Ký hợp đồng đặt cọc — thường 30-50 triệu hoặc 5-10% giá trị BĐS.',
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 5: Ký Hợp đồng Mua bán',
        text: 'Ký hợp đồng mua bán tại Văn phòng công chứng. SGS LAND hỗ trợ lựa chọn văn phòng công chứng uy tín đối tác.',
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 6: Thanh toán & Sang tên',
        text: 'Thanh toán theo tiến độ hợp đồng. Nộp hồ sơ sang tên tại Văn phòng đăng ký đất đai quận — thời gian 7-15 ngày.',
      },
      {
        '@type': 'HowToStep',
        name: 'Bước 7: Nhận Giấy chứng nhận',
        text: 'Nhận sổ hồng mang tên người mua. SGS LAND hỗ trợ theo dõi tiến độ và nhận sổ hồng.',
      },
    ],
  };
}

// ── BreadcrumbList ────────────────────────────────────────────────────────────

export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

// ── AggregateRating ───────────────────────────────────────────────────────────

export function buildAggregateRatingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    '@id': `${BASE_URL}/#rating`,
    itemReviewed: {
      '@type': 'RealEstateAgent',
      name: 'SGS LAND',
      url: BASE_URL,
    },
    ratingValue: '4.8',
    bestRating: '5',
    worstRating: '1',
    ratingCount: 1247,
    reviewCount: 312,
  };
}

// ── Product / Project Schema ──────────────────────────────────────────────────

export interface ProjectSchemaInput {
  name: string;
  description: string;
  developer: string;
  location: string;
  priceFrom: string;
  url: string;
  imageUrl?: string;
  type: string;
  areaHa?: number;
}

export function buildProjectSchema(project: ProjectSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': ['Product', 'RealEstateListing'],
    name: project.name,
    description: project.description,
    url: project.url.startsWith('http') ? project.url : `${BASE_URL}${project.url}`,
    image: project.imageUrl || `${BASE_URL}/og-image.jpg`,
    brand: {
      '@type': 'Organization',
      name: project.developer,
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      lowPrice: project.priceFrom,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        name: 'SGS LAND',
        url: BASE_URL,
      },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Vị trí', value: project.location },
      { '@type': 'PropertyValue', name: 'Loại hình', value: project.type },
      ...(project.areaHa ? [{ '@type': 'PropertyValue', name: 'Diện tích', value: `${project.areaHa} ha`, unitCode: 'HAR' }] : []),
    ],
  };
}

// ── Live-Data Project Catalog ─────────────────────────────────────────────────

export async function buildLiveProjectCatalog(pool: Pool): Promise<object[]> {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.code, p.location, p.developer,
             p.description, p.status, p.public_microsite,
             p.total_units, p.price_from, p.area_ha
        FROM projects p
       WHERE p.public_microsite = true
         AND p.status IN ('ACTIVE', 'SELLING', 'UPCOMING')
       ORDER BY p.created_at DESC
       LIMIT 20
    `);

    return result.rows.map((row) =>
      buildProjectSchema({
        name: row.name || row.code,
        description: row.description || `Dự án ${row.name || row.code} tại ${row.location || 'Việt Nam'}`,
        developer: row.developer || 'SGS LAND',
        location: row.location || 'TP.HCM',
        priceFrom: row.price_from || 'Liên hệ',
        url: `/du-an/${row.code?.toLowerCase() || row.id}`,
        type: 'Dự án bất động sản',
        areaHa: row.area_ha ? Number(row.area_ha) : undefined,
      }),
    );
  } catch {
    return [];
  }
}

// ── Expert Schema ─────────────────────────────────────────────────────────────

export function buildExpertSchemas() {
  return EXPERT_TEAM.map((expert) => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: expert.name,
    jobTitle: expert.title,
    worksFor: {
      '@type': 'Organization',
      name: 'SGS LAND',
      url: BASE_URL,
    },
    url: expert.linkedIn || BASE_URL,
    knowsAbout: expert.credentials,
  }));
}

// ── Full Page Schema Bundle ───────────────────────────────────────────────────

export async function buildFullPageSchemaBundle(pool: Pool): Promise<object[]> {
  const [projects] = await Promise.all([buildLiveProjectCatalog(pool)]);

  return [
    buildOrganizationSchema(),
    buildFaqPageSchema(),
    buildHowToBuySchema(),
    buildAggregateRatingSchema(),
    buildBreadcrumbSchema([
      { name: 'Trang chủ', url: '/' },
      { name: 'Tìm kiếm BĐS', url: '/marketplace' },
      { name: 'Định giá AI', url: '/ai-valuation' },
    ]),
    ...projects.slice(0, 5),
    ...buildExpertSchemas(),
  ];
}
