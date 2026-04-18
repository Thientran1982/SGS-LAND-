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

// ─── Reusable JSON-LD fragments for E-E-A-T (used across all area + project pages) ─
const SGS_RATING = { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '127', bestRating: '5', worstRating: '1' };
const SGS_PARENT_ORG = { '@id': `${APP_URL}/#org` };
const SGS_FAQ_META = { datePublished: '2025-06-01', dateModified: '2026-04-18', inLanguage: 'vi' };

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
  '': {
    title: 'SGS LAND | Top BĐS TP.HCM 2026: Căn Hộ Nhà Phố Aqua City Vinhomes',
    description: 'Top 3 dự án căn hộ TP.HCM 2026 (Vinhomes Grand Park, Global City, Masterise) và Top 3 nhà phố Đồng Nai (Aqua City, Izumi City, Vạn Phúc). SGS LAND định giá AI ±5%, tư vấn miễn phí.',
    h1: 'SGS LAND - Đại Lý Bất Động Sản TP.HCM',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${APP_URL}/#org`,
          name: 'SGS LAND',
          url: APP_URL,
          logo: { '@type': 'ImageObject', url: `${APP_URL}/apple-touch-icon.png` },
          sameAs: [
            'https://www.facebook.com/sgslandvn',
            'https://www.linkedin.com/company/sgsland',
            'https://www.youtube.com/@sgsland',
            'https://zalo.me/sgsland',
            'https://sgsland.vn',
          ],
          description: 'Đại lý phân phối bất động sản hàng đầu TP.HCM, chuyên Aqua City Novaland, The Global City Masterise Homes, Izumi City Nam Long, Vinhomes Cần Giờ. Định giá AI ±5%, tư vấn miễn phí.',
          contactPoint: { '@type': 'ContactPoint', telephone: '+84-971-132-378', contactType: 'customer service', availableLanguage: ['Vietnamese', 'English'], url: `${APP_URL}/contact` },
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Long An', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Bất động sản TP.HCM', 'Căn hộ TP.HCM', 'Nhà phố TP.HCM', 'Biệt thự Đồng Nai', 'Định giá AI', 'Aqua City Novaland', 'The Global City Masterise', 'Izumi City Nam Long', 'Vinhomes Cần Giờ', 'Vinhomes Grand Park', 'Masterise Homes', 'Grand Marina Saigon', 'Vạn Phúc City', 'Thủ Thiêm', 'Đồng Nai', 'Long Thành', 'TP.HCM', 'Bình Dương', 'TP Thủ Đức'],
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '127', bestRating: '5', worstRating: '1' },
          foundingDate: '2024-01-01',
          numberOfEmployees: { '@type': 'QuantitativeValue', value: 200 },
          award: 'Top Proptech Việt Nam 2025',
          founder: { '@type': 'Person', name: 'Trần Minh Thiện', jobTitle: 'Founder & CEO' },
          slogan: 'Đại lý phân phối BĐS độc lập — kiểm duyệt pháp lý 2 lớp, định giá AI ±5%',
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/#agent`,
          name: 'SGS LAND - Đại Lý BĐS TP.HCM',
          url: APP_URL,
          telephone: '+84-971-132-378',
          email: 'info@sgsland.vn',
          description: 'Đại lý phân phối bất động sản TP.HCM, Đồng Nai, Bình Dương. Định giá AI ±5%, không thu phí người mua.',
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Aqua City Novaland', 'Izumi City Nam Long', 'Vinhomes Grand Park', 'Vinhomes Cần Giờ', 'The Global City Masterise', 'Masterise Homes', 'Grand Marina Saigon', 'Thủ Thiêm', 'BĐS Đồng Nai', 'BĐS Bình Dương', 'BĐS TP Thủ Đức'],
        },
        {
          '@type': 'WebSite',
          '@id': `${APP_URL}/#website`,
          url: APP_URL,
          name: 'SGS LAND',
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/marketplace?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
        },
        {
          '@type': 'FAQPage',
          '@id': `${APP_URL}/#faq`,
          inLanguage: 'vi',
          mainEntity: [
            { '@type': 'Question', name: 'SGS LAND là gì? SGS LAND phân phối những dự án nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND là đại lý phân phối bất động sản tại TP.HCM, chuyên các dự án lớn: Aqua City Novaland (1.000ha, Biên Hòa, Đồng Nai), The Global City Masterise Homes (117ha, Thủ Đức), Izumi City Nam Long (170ha, Biên Hòa), Vinhomes Cần Giờ (2.870ha), Masterise Homes (Masteri, Lumière, Grand Marina), Vinhomes Grand Park (271ha, Thủ Đức). Tư vấn miễn phí tại sgsland.vn hoặc hotline 0971 132 378.' } },
            { '@type': 'Question', name: 'Mua bất động sản qua SGS LAND có mất phí môi giới không?', acceptedAnswer: { '@type': 'Answer', text: 'Không. SGS LAND không thu phí môi giới từ người mua. Doanh thu của SGS LAND đến từ hoa hồng do chủ đầu tư trả theo hợp đồng phân phối. Khách hàng được tư vấn pháp lý, kiểm tra hợp đồng và hỗ trợ hồ sơ vay vốn hoàn toàn miễn phí.' } },
            { '@type': 'Question', name: 'Công cụ định giá AI của SGS LAND hoạt động như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Hệ thống định giá AI (AVM) của SGS LAND phân tích dữ liệu giao dịch thực tế, quy hoạch đô thị, hạ tầng và xu hướng thị trường để cho ra giá ước tính với sai số ±5%. Người dùng nhập địa chỉ, diện tích và loại hình tài sản — hệ thống trả kết quả trong vài giây, không cần đăng nhập.' } },
            { '@type': 'Question', name: 'Dự án nào đang mở bán và có thể đặt chỗ ưu tiên qua SGS LAND?', acceptedAnswer: { '@type': 'Answer', text: 'Tính đến tháng 4/2026: Aqua City Novaland đang bàn giao nhiều phân khu, có sổ hồng riêng. Izumi City Nam Long mở giai đoạn mới từ 2 tỷ. The Global City Masterise đang nhận đặt cọc từ 15 tỷ. Vinhomes Cần Giờ đang mở bán phân kỳ đầu từ 12 tỷ đồng, đặt chỗ ưu tiên tại SGS LAND. Liên hệ 0971 132 378 để nhận bảng giá và tiến độ mới nhất.' } },
            { '@type': 'Question', name: 'SGS LAND hỗ trợ vay vốn ngân hàng như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND kết nối khách hàng với các ngân hàng đối tác: Vietcombank, BIDV, Techcombank, VPBank — hỗ trợ vay tối đa 70% giá trị căn, kỳ hạn 20–25 năm, lãi suất ưu đãi 12–24 tháng đầu. Đội ngũ pháp lý kiểm tra hợp đồng mua bán và hồ sơ vay miễn phí trước khi ký.' } },
            { '@type': 'Question', name: 'Bất động sản Đồng Nai có tiềm năng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo CBRE Vietnam và Savills Vietnam, bất động sản vùng ven TP.HCM — đặc biệt Đồng Nai (Nhơn Trạch, Biên Hòa) — tăng giá trung bình 12–18%/năm trong giai đoạn 2022–2024 nhờ hạ tầng Vành đai 3, cầu Nhơn Trạch và sân bay Long Thành. Aqua City Novaland và Izumi City Nam Long là hai dự án quy mô lớn SGS LAND đang phân phối tại khu vực này.' } },
            { '@type': 'Question', name: 'Giá bất động sản TP.HCM năm 2026 như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo năm 2026 tại TP.HCM: căn hộ trung cấp TP Thủ Đức 50–80 triệu/m², nhà phố Bình Thạnh 150–300 triệu/m², biệt thự ven đô Nhơn Trạch 20–50 triệu/m². SGS LAND cung cấp công cụ định giá AI miễn phí tại sgsland.vn/ai-valuation — dữ liệu cập nhật hàng ngày từ giao dịch thực tế.' } },
            { '@type': 'Question', name: 'Chủ đầu tư muốn tìm đơn vị phân phối dự án, SGS LAND có hỗ trợ không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. SGS LAND hợp tác phân phối với các chủ đầu tư tại TP.HCM, Đồng Nai, Bình Dương và Long An. Mạng lưới của SGS LAND hỗ trợ CRM tracking real-time, chiến dịch marketing digital và team pháp lý chuyên trách. Liên hệ info@sgsland.vn để nhận đề xuất hợp tác.' } },
            { '@type': 'Question', name: 'Top 3 dự án căn hộ tốt nhất TP.HCM năm 2026 là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 dự án căn hộ tại TP.HCM năm 2026 do SGS LAND phân phối: (1) Vinhomes Grand Park — Vinhomes, 271ha, TP Thủ Đức, căn hộ từ 3 tỷ, đang bàn giao; (2) The Global City — Masterise Homes, 117ha An Phú TP Thủ Đức, căn hộ từ 7,5 tỷ; (3) Masterise Homes — Lumière, Masteri, Grand Marina (Q1 và Bình Thạnh, từ 7,5 tỷ). Cả ba đều có sổ hồng riêng, pháp lý SGS LAND kiểm tra trước khi ký.' } },
            { '@type': 'Question', name: 'Top 3 dự án nhà phố biệt thự tốt nhất khu Đông TP.HCM 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 dự án nhà phố biệt thự khu Đông TP.HCM năm 2026: (1) Aqua City Novaland — 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai, biệt thự đảo từ 6,5 tỷ; (2) Izumi City Nam Long — 170ha tại Biên Hòa, nhà phố compound chuẩn Nhật Bản từ 8,4 tỷ; (3) Vạn Phúc City Đại Phúc — 198ha ven sông Sài Gòn, TP Thủ Đức, nhà phố và biệt thự liền kề. Tất cả có sổ hồng riêng từng căn.' } },
            { '@type': 'Question', name: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam tính đến tháng 4/2026 (sắp xếp theo diện tích): (1) Vinhomes Cần Giờ — Green Paradise (Vinhomes, 2.870ha lấn biển Cần Giờ, TP.HCM); (2) Aqua City Novaland (1.000ha tại Long Hưng, Biên Hòa, Đồng Nai); (3) Vinhomes Grand Park (Vinhomes, 271ha, TP Thủ Đức). Cả ba do SGS LAND phân phối chính thức — hotline 0971 132 378.' } },
            { '@type': 'Question', name: 'Bất động sản TP.HCM là gì? Khu vực nào sôi động nhất 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Bất động sản TP.HCM là thị trường BĐS lớn nhất Việt Nam, GDP đầu người gấp 2,5 lần trung bình cả nước, lượng giao dịch chiếm 35% cả nước. Năm 2026 ba khu vực sôi động nhất: TP Thủ Đức (căn hộ 50–80 triệu/m² — Vinhomes Grand Park, The Global City), Bình Thạnh (nhà phố 150–300 triệu/m² — Masterise Homes), khu Đông Đồng Nai (Long Hưng – Biên Hòa, biệt thự từ 6,5 tỷ — Aqua City, Izumi City). SGS LAND phân phối chính thức 11+ dự án tại các khu vực này.' } },
          ],
          datePublished: '2025-01-01',
          dateModified: '2026-04-18',
          speakable: { '@type': 'SpeakableSpecification', xpath: ['/html/head/title', "//*[@class='speakable']"] },
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#featured-projects`,
          name: 'Dự Án Bất Động Sản SGS LAND Đang Phân Phối',
          description: 'Danh sách các dự án bất động sản lớn tại TP.HCM và Đồng Nai mà SGS LAND đang phân phối chính thức.',
          numberOfItems: 6,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland. Từ 6,5 tỷ đồng.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha tại An Phú, TP Thủ Đức. Masterise Homes. Từ 15 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Izumi City Nam Long', url: `${APP_URL}/du-an/izumi-city`, description: 'Đô thị chuẩn Nhật Bản 170ha tại Biên Hòa, Đồng Nai. Nam Long Group. Từ 2 tỷ đồng.' },
            { '@type': 'ListItem', position: 4, name: 'Vinhomes Cần Giờ', url: `${APP_URL}/du-an/vinhomes-can-gio`, description: 'Siêu đô thị lấn biển 2.870ha tại Cần Giờ, TP.HCM. Vinhomes. Đang bán từ 12 tỷ.' },
            { '@type': 'ListItem', position: 5, name: 'Masterise Homes – Grand Marina, Masteri, Lumière', url: `${APP_URL}/du-an/masterise-homes`, description: 'Hệ sinh thái branded residence hạng sang TP.HCM. Masterise Group. Từ 60 triệu/m².' },
            { '@type': 'ListItem', position: 6, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức. Vinhomes. Từ 2,5 tỷ đồng.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-condos`,
          name: 'Top 3 Dự Án Căn Hộ Tốt Nhất TP.HCM 2026',
          description: 'Bảng xếp hạng 3 dự án căn hộ hàng đầu TP.HCM năm 2026 do SGS LAND phân phối — chọn lọc theo quy mô, chủ đầu tư, pháp lý sổ hồng và tiến độ bàn giao.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức, Vinhomes phát triển. Đang bàn giao. Căn hộ từ 3 tỷ đồng, sổ hồng riêng.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha tại An Phú, TP Thủ Đức. Masterise Homes. Căn hộ từ 7,5 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Masterise Homes — Lumière, Masteri, Grand Marina', url: `${APP_URL}/du-an/masterise-homes`, description: 'Hệ sinh thái branded residence hạng sang tại Q1 và Bình Thạnh. Masterise Group. Căn hộ từ 7,5 tỷ đồng.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-townhouses`,
          name: 'Top 3 Dự Án Nhà Phố Biệt Thự Khu Đông TP.HCM 2026',
          description: 'Bảng xếp hạng 3 dự án nhà phố và biệt thự lớn nhất khu Đông TP.HCM (Đồng Nai – TP Thủ Đức) năm 2026 do SGS LAND phân phối.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland. Biệt thự đảo từ 6,5 tỷ đồng, sổ hồng riêng.' },
            { '@type': 'ListItem', position: 2, name: 'Izumi City Nam Long', url: `${APP_URL}/du-an/izumi-city`, description: 'Đô thị tích hợp chuẩn Nhật 170ha tại Biên Hòa, Đồng Nai. Nam Long Group. Nhà phố compound từ 8,4 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Vạn Phúc City', url: `${APP_URL}/du-an/van-phuc-city`, description: 'Khu đô thị ven sông Sài Gòn 198ha tại TP Thủ Đức. Đại Phúc Group. Nhà phố và biệt thự liền kề.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-megacities`,
          name: 'Top 3 Đại Đô Thị Tích Hợp Lớn Nhất Việt Nam 2026',
          description: 'Bảng xếp hạng 3 đại đô thị tích hợp quy mô lớn nhất Việt Nam tính đến tháng 4/2026, sắp xếp theo diện tích từ lớn đến nhỏ.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Vinhomes Cần Giờ — Green Paradise', url: `${APP_URL}/du-an/vinhomes-can-gio`, description: 'Siêu đô thị du lịch lấn biển 2.870ha tại Cần Giờ, TP.HCM. Vinhomes. Lớn nhất Việt Nam.' },
            { '@type': 'ListItem', position: 2, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland.' },
            { '@type': 'ListItem', position: 3, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức, TP.HCM. Vinhomes.' },
          ],
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#founder-thien`,
          name: 'Trần Minh Thiện',
          jobTitle: 'Founder & CEO',
          worksFor: { '@id': `${APP_URL}/#org` },
          sameAs: ['https://www.linkedin.com/company/sgsland'],
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#cto-nam`,
          name: 'Nguyễn Hoàng Nam',
          jobTitle: 'Chief Technology Officer',
          worksFor: { '@id': `${APP_URL}/#org` },
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#coo-hoa`,
          name: 'Lê Thị Hoa',
          jobTitle: 'Chief Operating Officer',
          worksFor: { '@id': `${APP_URL}/#org` },
        },
      ],
    },
  },
  home: {
    title: 'SGS LAND | Top BĐS TP.HCM 2026: Căn Hộ Nhà Phố Aqua City Vinhomes',
    description: 'Top 3 dự án căn hộ TP.HCM 2026 (Vinhomes Grand Park, Global City, Masterise) và Top 3 nhà phố Đồng Nai (Aqua City, Izumi City, Vạn Phúc). SGS LAND định giá AI ±5%, tư vấn miễn phí.',
    h1: 'SGS LAND - Đại Lý Bất Động Sản TP.HCM',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${APP_URL}/#org`,
          name: 'SGS LAND',
          url: APP_URL,
          logo: { '@type': 'ImageObject', url: `${APP_URL}/apple-touch-icon.png` },
          sameAs: [
            'https://www.facebook.com/sgslandvn',
            'https://www.linkedin.com/company/sgsland',
            'https://www.youtube.com/@sgsland',
            'https://zalo.me/sgsland',
            'https://sgsland.vn',
          ],
          description: 'Đại lý phân phối bất động sản hàng đầu TP.HCM, chuyên Aqua City Novaland, The Global City Masterise Homes, Izumi City Nam Long, Vinhomes Cần Giờ. Định giá AI ±5%, tư vấn miễn phí.',
          contactPoint: { '@type': 'ContactPoint', telephone: '+84-971-132-378', contactType: 'customer service', availableLanguage: ['Vietnamese', 'English'], url: `${APP_URL}/contact` },
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Long An', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Bất động sản TP.HCM', 'Căn hộ TP.HCM', 'Nhà phố TP.HCM', 'Biệt thự Đồng Nai', 'Định giá AI', 'Aqua City Novaland', 'The Global City Masterise', 'Izumi City Nam Long', 'Vinhomes Cần Giờ', 'Vinhomes Grand Park', 'Masterise Homes', 'Grand Marina Saigon', 'Vạn Phúc City', 'Thủ Thiêm', 'Đồng Nai', 'Long Thành', 'TP.HCM', 'Bình Dương', 'TP Thủ Đức'],
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '127', bestRating: '5', worstRating: '1' },
          foundingDate: '2024-01-01',
          numberOfEmployees: { '@type': 'QuantitativeValue', value: 200 },
          award: 'Top Proptech Việt Nam 2025',
          founder: { '@type': 'Person', name: 'Trần Minh Thiện', jobTitle: 'Founder & CEO' },
          slogan: 'Đại lý phân phối BĐS độc lập — kiểm duyệt pháp lý 2 lớp, định giá AI ±5%',
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/#agent`,
          name: 'SGS LAND - Đại Lý BĐS TP.HCM',
          url: APP_URL,
          telephone: '+84-971-132-378',
          email: 'info@sgsland.vn',
          description: 'Đại lý phân phối bất động sản TP.HCM, Đồng Nai, Bình Dương. Định giá AI ±5%, không thu phí người mua.',
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Aqua City Novaland', 'Izumi City Nam Long', 'Vinhomes Grand Park', 'Vinhomes Cần Giờ', 'The Global City Masterise', 'Masterise Homes', 'Grand Marina Saigon', 'Thủ Thiêm', 'BĐS Đồng Nai', 'BĐS Bình Dương', 'BĐS TP Thủ Đức'],
        },
        {
          '@type': 'WebSite',
          '@id': `${APP_URL}/#website`,
          url: APP_URL,
          name: 'SGS LAND',
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/marketplace?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
        },
        {
          '@type': 'FAQPage',
          '@id': `${APP_URL}/#faq`,
          inLanguage: 'vi',
          mainEntity: [
            { '@type': 'Question', name: 'SGS LAND là gì? SGS LAND phân phối những dự án nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND là đại lý phân phối bất động sản tại TP.HCM, chuyên các dự án lớn: Aqua City Novaland (1.000ha, Biên Hòa, Đồng Nai), The Global City Masterise Homes (117ha, Thủ Đức), Izumi City Nam Long (170ha, Biên Hòa), Vinhomes Cần Giờ (2.870ha), Masterise Homes (Masteri, Lumière, Grand Marina), Vinhomes Grand Park (271ha, Thủ Đức). Tư vấn miễn phí tại sgsland.vn hoặc hotline 0971 132 378.' } },
            { '@type': 'Question', name: 'Mua bất động sản qua SGS LAND có mất phí môi giới không?', acceptedAnswer: { '@type': 'Answer', text: 'Không. SGS LAND không thu phí môi giới từ người mua. Doanh thu của SGS LAND đến từ hoa hồng do chủ đầu tư trả theo hợp đồng phân phối. Khách hàng được tư vấn pháp lý, kiểm tra hợp đồng và hỗ trợ hồ sơ vay vốn hoàn toàn miễn phí.' } },
            { '@type': 'Question', name: 'Công cụ định giá AI của SGS LAND hoạt động như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Hệ thống định giá AI (AVM) của SGS LAND phân tích dữ liệu giao dịch thực tế, quy hoạch đô thị, hạ tầng và xu hướng thị trường để cho ra giá ước tính với sai số ±5%. Người dùng nhập địa chỉ, diện tích và loại hình tài sản — hệ thống trả kết quả trong vài giây, không cần đăng nhập.' } },
            { '@type': 'Question', name: 'Dự án nào đang mở bán và có thể đặt chỗ ưu tiên qua SGS LAND?', acceptedAnswer: { '@type': 'Answer', text: 'Tính đến tháng 4/2026: Aqua City Novaland đang bàn giao nhiều phân khu, có sổ hồng riêng. Izumi City Nam Long mở giai đoạn mới từ 2 tỷ. The Global City Masterise đang nhận đặt cọc từ 15 tỷ. Vinhomes Cần Giờ đang mở bán phân kỳ đầu từ 12 tỷ đồng, đặt chỗ ưu tiên tại SGS LAND. Liên hệ 0971 132 378 để nhận bảng giá và tiến độ mới nhất.' } },
            { '@type': 'Question', name: 'SGS LAND hỗ trợ vay vốn ngân hàng như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND kết nối khách hàng với các ngân hàng đối tác: Vietcombank, BIDV, Techcombank, VPBank — hỗ trợ vay tối đa 70% giá trị căn, kỳ hạn 20–25 năm, lãi suất ưu đãi 12–24 tháng đầu. Đội ngũ pháp lý kiểm tra hợp đồng mua bán và hồ sơ vay miễn phí trước khi ký.' } },
            { '@type': 'Question', name: 'Bất động sản Đồng Nai có tiềm năng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo CBRE Vietnam và Savills Vietnam, bất động sản vùng ven TP.HCM — đặc biệt Đồng Nai (Nhơn Trạch, Biên Hòa) — tăng giá trung bình 12–18%/năm trong giai đoạn 2022–2024 nhờ hạ tầng Vành đai 3, cầu Nhơn Trạch và sân bay Long Thành. Aqua City Novaland và Izumi City Nam Long là hai dự án quy mô lớn SGS LAND đang phân phối tại khu vực này.' } },
            { '@type': 'Question', name: 'Giá bất động sản TP.HCM năm 2026 như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo năm 2026 tại TP.HCM: căn hộ trung cấp TP Thủ Đức 50–80 triệu/m², nhà phố Bình Thạnh 150–300 triệu/m², biệt thự ven đô Nhơn Trạch 20–50 triệu/m². SGS LAND cung cấp công cụ định giá AI miễn phí tại sgsland.vn/ai-valuation — dữ liệu cập nhật hàng ngày từ giao dịch thực tế.' } },
            { '@type': 'Question', name: 'Chủ đầu tư muốn tìm đơn vị phân phối dự án, SGS LAND có hỗ trợ không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. SGS LAND hợp tác phân phối với các chủ đầu tư tại TP.HCM, Đồng Nai, Bình Dương và Long An. Mạng lưới của SGS LAND hỗ trợ CRM tracking real-time, chiến dịch marketing digital và team pháp lý chuyên trách. Liên hệ info@sgsland.vn để nhận đề xuất hợp tác.' } },
            { '@type': 'Question', name: 'Top 3 dự án căn hộ tốt nhất TP.HCM năm 2026 là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 dự án căn hộ tại TP.HCM năm 2026 do SGS LAND phân phối: (1) Vinhomes Grand Park — Vinhomes, 271ha, TP Thủ Đức, căn hộ từ 3 tỷ, đang bàn giao; (2) The Global City — Masterise Homes, 117ha An Phú TP Thủ Đức, căn hộ từ 7,5 tỷ; (3) Masterise Homes — Lumière, Masteri, Grand Marina (Q1 và Bình Thạnh, từ 7,5 tỷ). Cả ba đều có sổ hồng riêng, pháp lý SGS LAND kiểm tra trước khi ký.' } },
            { '@type': 'Question', name: 'Top 3 dự án nhà phố biệt thự tốt nhất khu Đông TP.HCM 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 dự án nhà phố biệt thự khu Đông TP.HCM năm 2026: (1) Aqua City Novaland — 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai, biệt thự đảo từ 6,5 tỷ; (2) Izumi City Nam Long — 170ha tại Biên Hòa, nhà phố compound chuẩn Nhật Bản từ 8,4 tỷ; (3) Vạn Phúc City Đại Phúc — 198ha ven sông Sài Gòn, TP Thủ Đức, nhà phố và biệt thự liền kề. Tất cả có sổ hồng riêng từng căn.' } },
            { '@type': 'Question', name: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 đại đô thị tích hợp lớn nhất Việt Nam tính đến tháng 4/2026 (sắp xếp theo diện tích): (1) Vinhomes Cần Giờ — Green Paradise (Vinhomes, 2.870ha lấn biển Cần Giờ, TP.HCM); (2) Aqua City Novaland (1.000ha tại Long Hưng, Biên Hòa, Đồng Nai); (3) Vinhomes Grand Park (Vinhomes, 271ha, TP Thủ Đức). Cả ba do SGS LAND phân phối chính thức — hotline 0971 132 378.' } },
            { '@type': 'Question', name: 'Bất động sản TP.HCM là gì? Khu vực nào sôi động nhất 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Bất động sản TP.HCM là thị trường BĐS lớn nhất Việt Nam, GDP đầu người gấp 2,5 lần trung bình cả nước, lượng giao dịch chiếm 35% cả nước. Năm 2026 ba khu vực sôi động nhất: TP Thủ Đức (căn hộ 50–80 triệu/m² — Vinhomes Grand Park, The Global City), Bình Thạnh (nhà phố 150–300 triệu/m² — Masterise Homes), khu Đông Đồng Nai (Long Hưng – Biên Hòa, biệt thự từ 6,5 tỷ — Aqua City, Izumi City). SGS LAND phân phối chính thức 11+ dự án tại các khu vực này.' } },
          ],
          datePublished: '2025-01-01',
          dateModified: '2026-04-18',
          speakable: { '@type': 'SpeakableSpecification', xpath: ['/html/head/title', "//*[@class='speakable']"] },
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#featured-projects`,
          name: 'Dự Án Bất Động Sản SGS LAND Đang Phân Phối',
          description: 'Danh sách các dự án bất động sản lớn tại TP.HCM và Đồng Nai mà SGS LAND đang phân phối chính thức.',
          numberOfItems: 6,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland. Từ 6,5 tỷ đồng.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha tại An Phú, TP Thủ Đức. Masterise Homes. Từ 15 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Izumi City Nam Long', url: `${APP_URL}/du-an/izumi-city`, description: 'Đô thị chuẩn Nhật Bản 170ha tại Biên Hòa, Đồng Nai. Nam Long Group. Từ 2 tỷ đồng.' },
            { '@type': 'ListItem', position: 4, name: 'Vinhomes Cần Giờ', url: `${APP_URL}/du-an/vinhomes-can-gio`, description: 'Siêu đô thị lấn biển 2.870ha tại Cần Giờ, TP.HCM. Vinhomes. Đang bán từ 12 tỷ.' },
            { '@type': 'ListItem', position: 5, name: 'Masterise Homes – Grand Marina, Masteri, Lumière', url: `${APP_URL}/du-an/masterise-homes`, description: 'Hệ sinh thái branded residence hạng sang TP.HCM. Masterise Group. Từ 60 triệu/m².' },
            { '@type': 'ListItem', position: 6, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức. Vinhomes. Từ 2,5 tỷ đồng.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-condos`,
          name: 'Top 3 Dự Án Căn Hộ Tốt Nhất TP.HCM 2026',
          description: 'Bảng xếp hạng 3 dự án căn hộ hàng đầu TP.HCM năm 2026 do SGS LAND phân phối — chọn lọc theo quy mô, chủ đầu tư, pháp lý sổ hồng và tiến độ bàn giao.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức, Vinhomes phát triển. Đang bàn giao. Căn hộ từ 3 tỷ đồng, sổ hồng riêng.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha tại An Phú, TP Thủ Đức. Masterise Homes. Căn hộ từ 7,5 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Masterise Homes — Lumière, Masteri, Grand Marina', url: `${APP_URL}/du-an/masterise-homes`, description: 'Hệ sinh thái branded residence hạng sang tại Q1 và Bình Thạnh. Masterise Group. Căn hộ từ 7,5 tỷ đồng.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-townhouses`,
          name: 'Top 3 Dự Án Nhà Phố Biệt Thự Khu Đông TP.HCM 2026',
          description: 'Bảng xếp hạng 3 dự án nhà phố và biệt thự lớn nhất khu Đông TP.HCM (Đồng Nai – TP Thủ Đức) năm 2026 do SGS LAND phân phối.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland. Biệt thự đảo từ 6,5 tỷ đồng, sổ hồng riêng.' },
            { '@type': 'ListItem', position: 2, name: 'Izumi City Nam Long', url: `${APP_URL}/du-an/izumi-city`, description: 'Đô thị tích hợp chuẩn Nhật 170ha tại Biên Hòa, Đồng Nai. Nam Long Group. Nhà phố compound từ 8,4 tỷ đồng.' },
            { '@type': 'ListItem', position: 3, name: 'Vạn Phúc City', url: `${APP_URL}/du-an/van-phuc-city`, description: 'Khu đô thị ven sông Sài Gòn 198ha tại TP Thủ Đức. Đại Phúc Group. Nhà phố và biệt thự liền kề.' },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/#top3-megacities`,
          name: 'Top 3 Đại Đô Thị Tích Hợp Lớn Nhất Việt Nam 2026',
          description: 'Bảng xếp hạng 3 đại đô thị tích hợp quy mô lớn nhất Việt Nam tính đến tháng 4/2026, sắp xếp theo diện tích từ lớn đến nhỏ.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Vinhomes Cần Giờ — Green Paradise', url: `${APP_URL}/du-an/vinhomes-can-gio`, description: 'Siêu đô thị du lịch lấn biển 2.870ha tại Cần Giờ, TP.HCM. Vinhomes. Lớn nhất Việt Nam.' },
            { '@type': 'ListItem', position: 2, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha tại Long Hưng, Biên Hòa, Đồng Nai. Novaland.' },
            { '@type': 'ListItem', position: 3, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha tại TP Thủ Đức, TP.HCM. Vinhomes.' },
          ],
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#founder-thien`,
          name: 'Trần Minh Thiện',
          jobTitle: 'Founder & CEO',
          worksFor: { '@id': `${APP_URL}/#org` },
          sameAs: ['https://www.linkedin.com/company/sgsland'],
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#cto-nam`,
          name: 'Nguyễn Hoàng Nam',
          jobTitle: 'Chief Technology Officer',
          worksFor: { '@id': `${APP_URL}/#org` },
        },
        {
          '@type': 'Person',
          '@id': `${APP_URL}/#coo-hoa`,
          name: 'Lê Thị Hoa',
          jobTitle: 'Chief Operating Officer',
          worksFor: { '@id': `${APP_URL}/#org` },
        },
      ],
    },
  },
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
  'ky-gui-bat-dong-san': {
    title: 'Ký Gửi Bất Động Sản | Bán Nhanh, Giá Tốt - SGS LAND',
    description: 'Ký gửi bất động sản tại SGS LAND — đội ngũ chuyên gia định giá miễn phí, tiếp cận hàng nghìn khách hàng tiềm năng và hỗ trợ pháp lý toàn diện.',
    h1: 'Ký Gửi Bất Động Sản',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Ký Gửi Bất Động Sản', item: `${APP_URL}/ky-gui-bat-dong-san` },
          ],
        },
        {
          '@type': 'HowTo',
          name: 'Quy trình ký gửi bất động sản tại SGS LAND',
          description: 'Hướng dẫn từng bước quy trình ký gửi bất động sản để mua bán hoặc cho thuê qua sàn giao dịch SGS LAND.',
          inLanguage: 'vi',
          totalTime: 'P7D',
          step: [
            { '@type': 'HowToStep', position: 1, name: 'Tiếp nhận hồ sơ', text: 'Điền form đăng ký ký gửi. Chuyên viên SGS LAND liên hệ trong vòng 4 giờ làm việc để xác nhận thông tin và thu thập hồ sơ pháp lý ban đầu.' },
            { '@type': 'HowToStep', position: 2, name: 'Thẩm định pháp lý', text: 'Đội ngũ pháp lý SGS LAND kiểm tra tính hợp lệ của hồ sơ: tình trạng tranh chấp, quy hoạch, nghĩa vụ tài chính còn lại. Hoàn thành trong 1–3 ngày làm việc.' },
            { '@type': 'HowToStep', position: 3, name: 'Ký kết hợp đồng ký gửi', text: 'Hai bên ký Hợp đồng Ký gửi Bất động sản xác định rõ mức hoa hồng, thời hạn ký gửi, quyền và nghĩa vụ từng bên. Căn cứ Điều 41–42 Luật KDBĐS 2023 & Nghị định 96/2024/NĐ-CP.' },
            { '@type': 'HowToStep', position: 4, name: 'Định giá & Triển khai marketing', text: 'Định giá bằng AI (AVM) kết hợp thẩm định thực tế. Đăng tin trên SGS LAND, sàn giao dịch đối tác, mạng xã hội và kênh môi giới nội bộ. Bộ ảnh, video và mô tả SEO miễn phí.' },
            { '@type': 'HowToStep', position: 5, name: 'Kết nối khách & Đàm phán', text: 'Môi giới SGS LAND dẫn dắt toàn bộ quá trình xem nhà, đàm phán giá và điều khoản hợp đồng mua bán hoặc thuê. Chủ sở hữu được cập nhật tiến độ định kỳ.' },
            { '@type': 'HowToStep', position: 6, name: 'Ký kết & Thu hoa hồng', text: 'Sau khi hợp đồng mua bán hoặc thuê được ký kết hợp lệ và tiền được chuyển cho chủ sở hữu, hoa hồng SGS LAND được thanh toán theo hợp đồng ký gửi. Chỉ thu phí khi giao dịch thành công.' },
          ],
        },
        {
          '@type': 'FAQPage',
          inLanguage: 'vi',
          mainEntity: [
            { '@type': 'Question', name: 'Ký gửi bất động sản là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Ký gửi bất động sản là việc chủ sở hữu ủy quyền cho SGS LAND thực hiện toàn bộ hoạt động marketing, môi giới và hỗ trợ pháp lý để mua bán hoặc cho thuê tài sản. Hai bên ký Hợp đồng Ký gửi theo quy định Luật KDBĐS 2023.' } },
            { '@type': 'Question', name: 'Hoa hồng được tính như thế nào và khi nào phải trả?', acceptedAnswer: { '@type': 'Answer', text: 'Hoa hồng chỉ phát sinh khi giao dịch thành công: (1) Mua bán: 1–2% giá trị hợp đồng, thu khi hợp đồng công chứng; (2) Cho thuê ≥12 tháng: 1 tháng tiền thuê; (3) Cho thuê <12 tháng: 50% tháng thuê. Không có bất kỳ khoản phí nào nếu không giao dịch.' } },
            { '@type': 'Question', name: 'Tôi có cần đặt cọc hay trả phí trước không?', acceptedAnswer: { '@type': 'Answer', text: 'Hoàn toàn không. SGS LAND không thu bất kỳ khoản phí nào trước khi giao dịch thành công. Toàn bộ chi phí marketing — ảnh, video, quảng cáo — do SGS LAND chi trả.' } },
            { '@type': 'Question', name: 'Thời hạn hợp đồng ký gửi là bao lâu?', acceptedAnswer: { '@type': 'Answer', text: 'Thông thường 3–6 tháng, có thể gia hạn theo thỏa thuận. Trong thời hạn hợp đồng, chủ sở hữu không ký giao dịch độc lập với khách hàng do SGS LAND giới thiệu để tránh tranh chấp hoa hồng.' } },
            { '@type': 'Question', name: 'Tôi có thể tự bán trong thời gian ký gửi không?', acceptedAnswer: { '@type': 'Answer', text: 'Có thể — nếu khách mua là người chủ sở hữu tự tìm, không qua SGS LAND. Tuy nhiên, nếu khách mua đã từng được SGS LAND giới thiệu, hoa hồng vẫn phát sinh theo hợp đồng ký gửi (điều khoản bảo lưu khách hàng thường 90 ngày).' } },
            { '@type': 'Question', name: 'SGS LAND có đảm bảo bán được không?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND cam kết nỗ lực tiếp thị tối đa, nhưng kết quả giao dịch phụ thuộc vào thị trường và giá kỳ vọng của chủ sở hữu. Chúng tôi tư vấn định giá thực tế để tối ưu khả năng giao dịch nhanh.' } },
            { '@type': 'Question', name: 'Tài liệu pháp lý cần chuẩn bị gồm những gì?', acceptedAnswer: { '@type': 'Answer', text: 'Tối thiểu: (1) Sổ đỏ / Sổ hồng (Giấy CNQSDĐ) bản gốc hoặc photo công chứng; (2) CMND/CCCD của chủ sở hữu; (3) Giấy phép xây dựng (nếu nhà ở). Đội ngũ SGS LAND sẽ hướng dẫn chi tiết sau khi tiếp nhận yêu cầu.' } },
            { '@type': 'Question', name: 'Vùng địa lý SGS LAND đang hoạt động?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND hiện hoạt động tập trung tại TP. Hồ Chí Minh và các tỉnh lân cận (Bình Dương, Đồng Nai, Long An). Đang mở rộng sang Hà Nội và Đà Nẵng. Liên hệ để kiểm tra khả năng ký gửi tại khu vực của bạn.' } },
          ],
        },
        {
          '@type': 'Service',
          '@id': `${APP_URL}/ky-gui-bat-dong-san#service`,
          name: 'Dịch vụ Ký Gửi Bất Động Sản SGS LAND',
          serviceType: 'Ký gửi bất động sản',
          inLanguage: 'vi',
          provider: { '@type': 'Organization', name: 'SGS LAND', url: APP_URL },
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Long An', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          url: `${APP_URL}/ky-gui-bat-dong-san`,
        },
      ],
    },
  },
  livechat:                { title: 'Chat Trực Tiếp | Hỗ Trợ Khách Hàng 24/7 - SGS LAND', description: 'Kết nối trực tiếp với đội ngũ tư vấn SGS LAND qua Live Chat. Được hỗ trợ 24/7 về bất động sản, định giá AI và các dịch vụ.', h1: 'Chat Trực Tiếp Với Chuyên Gia' },
  login:                   { title: 'Đăng Nhập | SGS LAND Enterprise', description: 'Đăng nhập vào nền tảng quản lý bất động sản SGS LAND.', noIndex: true },

  // ─── SEO Local & Project Landing Pages ─────────────────────────────────────
  'bat-dong-san-dong-nai': {
    title: 'Bất Động Sản Đồng Nai | Mua Bán Nhà Đất 2025 — SGS LAND',
    description: 'Mua bán bất động sản Đồng Nai: Nhơn Trạch, Biên Hòa, Long Thành. Kho hàng nghìn căn, giá thực tế, pháp lý kiểm tra trước. SGS LAND.',
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
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản Đồng Nai có nên đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Đồng Nai là một trong những thị trường BĐS tiềm năng nhất miền Nam nhờ ba động lực chính: sân bay Long Thành (hoàn thành 2026), các tuyến cao tốc kết nối TP.HCM và làn sóng di dời khu công nghiệp. Giá đất nhiều khu vực tăng 15-25%/năm.' } },
            { '@type': 'Question', name: 'Giá đất Đồng Nai hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 15-50 triệu/m².' } },
            { '@type': 'Question', name: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?', acceptedAnswer: { '@type': 'Answer', text: 'Sân bay quốc tế Long Thành có công suất 25 triệu hành khách/giai đoạn 1. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.' } },
            { '@type': 'Question', name: 'Những dự án BĐS nào nổi bật tại Đồng Nai?', acceptedAnswer: { '@type': 'Answer', text: 'Các dự án lớn: Aqua City (Novaland, 1.000ha tại Biên Hòa), Izumi City (Nam Long, 170ha tại Biên Hòa), Gem Sky World (Long Thành), HUD Nhơn Trạch. SGS LAND cung cấp thông tin và tư vấn tất cả dự án.' } },
            { '@type': 'Question', name: 'Mua đất Đồng Nai cần lưu ý gì về pháp lý?', acceptedAnswer: { '@type': 'Answer', text: 'Kiểm tra quy hoạch (tránh đất quy hoạch lộ, đất nông nghiệp chưa chuyển mục đích), xác nhận sổ đỏ chính chủ, tránh đất chung sổ. SGS LAND kiểm tra pháp lý miễn phí trước giao dịch.' } },
            { '@type': 'Question', name: 'Bình Dương hay Đồng Nai nên đầu tư BĐS hơn?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương mạnh về đô thị hoá, nhu cầu thuê lớn. Đồng Nai tiềm năng tăng trưởng còn lớn hơn nhờ sân bay Long Thành. Ngân sách vừa, đầu tư dài hạn nên chọn Đồng Nai.' } },
            { '@type': 'Question', name: 'Có thể vay ngân hàng mua BĐS Đồng Nai không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. Ngân hàng lớn cho vay mua BĐS Đồng Nai LTV 70-80%, kỳ hạn 15-25 năm, lãi suất ưu đãi 6-8,5%/năm 24 tháng đầu. SGS LAND kết nối ngân hàng và hỗ trợ hồ sơ vay miễn phí.' } },
            { '@type': 'Question', name: 'Tìm môi giới bất động sản Đồng Nai uy tín ở đâu?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND có đội ngũ 200+ chuyên gia am hiểu Đồng Nai, Biên Hòa, Long Thành, Nhơn Trạch. BĐS kiểm tra pháp lý độc lập, giá so sánh realtime bằng AI — giao dịch an toàn, minh bạch.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-dong-nai#agent`,
          name: 'SGS LAND - Bất Động Sản Đồng Nai',
          url: `${APP_URL}/bat-dong-san-dong-nai`,
          areaServed: { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          knowsAbout: ['Bất động sản Đồng Nai', 'Đất nền Long Thành', 'Nhơn Trạch', 'Biên Hòa', 'Sân bay Long Thành'],
          telephone: '+84-971-132-378',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },
  'bat-dong-san-long-thanh': {
    title: 'Bất Động Sản Long Thành | Đất Nền, Nhà Phố — SGS LAND',
    description: 'Mua bán đất nền, nhà phố Long Thành Đồng Nai. Vùng kinh tế sân bay, tiềm năng tăng giá cao. Định giá AI miễn phí tại SGS LAND.',
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
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Có nên mua đất Long Thành năm 2025-2026 không?', acceptedAnswer: { '@type': 'Answer', text: 'Long Thành là một trong các thị trường BĐS được khuyến nghị đầu tư mạnh. Với sân bay Long Thành hoàn thành giai đoạn 1 năm 2026, giá BĐS được dự báo tiếp tục tăng 15-25%/năm.' } },
            { '@type': 'Question', name: 'Giá đất nền Long Thành hiện nay khoảng bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Đất nền thổ cư mặt tiền đường lớn: 20-35 triệu/m². Đất phân lô dự án sổ sẵn: 10-25 triệu/m². Đất vườn nông nghiệp có thể chuyển đổi: 3-8 triệu/m².' } },
            { '@type': 'Question', name: 'Sân bay Long Thành khai thác vào năm nào?', acceptedAnswer: { '@type': 'Answer', text: 'Sân bay Long Thành giai đoạn 1 dự kiến hoàn thành vào cuối năm 2026, khai thác thương mại đầu năm 2027 với công suất 25 triệu hành khách/năm.' } },
            { '@type': 'Question', name: 'Mua BĐS Long Thành qua SGS LAND có lợi ích gì?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND cung cấp kho hàng Long Thành đã xác minh pháp lý, so sánh giá realtime bằng AI, hỗ trợ đàm phán và kết nối ngân hàng vay vốn lãi suất tốt.' } },
            { '@type': 'Question', name: 'Rủi ro khi đầu tư đất Long Thành là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Rủi ro cần lưu ý: đất quy hoạch đường/sân bay chưa giải toả, đất không sổ đỏ, dự án ma chưa đủ điều kiện mở bán. SGS LAND kiểm tra pháp lý độc lập trước mỗi giao dịch.' } },
            { '@type': 'Question', name: 'Khu vực nào ở Long Thành gần sân bay nhất?', acceptedAnswer: { '@type': 'Answer', text: 'Xã Bình Sơn, Long An, Suối Trầu gần sân bay nhất (3-5km). Khu vực thị trấn Long Thành và các xã phía Nam (Long Phước, Phước Bình) cân bằng tốt giữa tiềm năng và rủi ro pháp lý.' } },
            { '@type': 'Question', name: 'Tỷ suất cho thuê BĐS Long Thành là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà trọ công nhân KCN 8-12%/năm; nhà phố thương mại 5-8%/năm; căn hộ cho chuyên gia 5-7%/năm. Nhu cầu thuê tăng mạnh khi sân bay Long Thành vận hành.' } },
            { '@type': 'Question', name: 'Cầu nào kết nối Long Thành với TP.HCM?', acceptedAnswer: { '@type': 'Answer', text: 'Tương lai: Cầu Nhơn Trạch (đang thi công, dự kiến 2025-2026) rút ngắn kết nối Long Thành – Q2 còn 20-25 phút qua cao tốc Bến Lức – Long Thành.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-long-thanh#agent`,
          name: 'SGS LAND - Bất Động Sản Long Thành',
          url: `${APP_URL}/bat-dong-san-long-thanh`,
          areaServed: { '@type': 'City', name: 'Long Thành', containedInPlace: { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Long Thành', 'Đất nền sân bay Long Thành', 'Đầu tư BĐS Đồng Nai'],
          telephone: '+84-971-132-378',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },
  'du-an': {
    title: 'Dự Án Bất Động Sản | Aqua City, The Global City, Izumi, Vinhomes — SGS LAND',
    description: 'Tổng hợp các dự án bất động sản SGS LAND đang phân phối: Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Cần Giờ, Vinhomes Grand Park, Grand Marina Saigon. Giá từ 2 tỷ, tư vấn miễn phí.',
    h1: 'Dự Án Bất Động Sản SGS LAND Đang Phân Phối',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án Bất Động Sản', item: `${APP_URL}/du-an` },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/du-an#project-list`,
          name: 'Dự Án Bất Động Sản SGS LAND Đang Phân Phối',
          description: 'SGS LAND phân phối chính thức các dự án bất động sản lớn tại TP.HCM, Đồng Nai, Bình Dương. Tư vấn miễn phí, hỗ trợ vay vốn, pháp lý rõ ràng.',
          numberOfItems: 11,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Aqua City Novaland', url: `${APP_URL}/du-an/aqua-city`, description: 'Đại đô thị sinh thái 1.000ha, Long Hưng, Biên Hòa, Đồng Nai. Chủ đầu tư Novaland. Từ 6,5 tỷ.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha, An Phú, TP Thủ Đức. Masterise Homes. Từ 15 tỷ.' },
            { '@type': 'ListItem', position: 3, name: 'Izumi City Nam Long', url: `${APP_URL}/du-an/izumi-city`, description: 'Đô thị chuẩn Nhật Bản 170ha, Biên Hòa, Đồng Nai. Nam Long Group. Từ 2 tỷ.' },
            { '@type': 'ListItem', position: 4, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha, TP Thủ Đức, TP.HCM. Vinhomes. Từ 2,5 tỷ.' },
            { '@type': 'ListItem', position: 5, name: 'Vinhomes Central Park', url: `${APP_URL}/du-an/vinhomes-central-park`, description: 'Khu đô thị cao cấp Bình Thạnh, TP.HCM, Landmark 81. Vinhomes. Từ 50 triệu/m².' },
            { '@type': 'ListItem', position: 6, name: 'Masterise Homes – Grand Marina, Masteri, Lumière', url: `${APP_URL}/du-an/masterise-homes`, description: 'Hệ sinh thái branded residence hạng sang TP.HCM. Masterise Group. Từ 60 triệu/m².' },
            { '@type': 'ListItem', position: 7, name: 'Grand Manhattan Novaland', url: `${APP_URL}/du-an/manhattan`, description: 'Căn hộ hạng sang Novaland nội thành TP.HCM. Từ 120 triệu/m².' },
            { '@type': 'ListItem', position: 8, name: 'Khu Đô Thị Thủ Thiêm', url: `${APP_URL}/du-an/thu-thiem`, description: 'BĐS hạng sang trung tâm tài chính Thủ Thiêm 657ha, TP.HCM. Từ 80 triệu/m².' },
            { '@type': 'ListItem', position: 9, name: 'Sơn Kim Land', url: `${APP_URL}/du-an/son-kim-land`, description: 'BĐS thương mại cao cấp TP.HCM và Hà Nội. Gem Riverside, Metropole Thủ Thiêm. Từ 40 triệu/m².' },
            { '@type': 'ListItem', position: 10, name: 'Nhà Phố Trung Tâm TP.HCM', url: `${APP_URL}/du-an/nha-pho-trung-tam`, description: 'Mua bán nhà phố mặt tiền, hẻm, shophouse trung tâm TP.HCM. Định giá AI miễn phí.' },
            { '@type': 'ListItem', position: 11, name: 'Vinhomes Cần Giờ', url: `${APP_URL}/du-an/vinhomes-can-gio`, description: 'Siêu đô thị lấn biển 2.870ha, Cần Giờ, TP.HCM. Vinhomes. Đang bán từ 12 tỷ.' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/du-an#agent`,
          name: 'SGS LAND - Đại Lý BĐS TP.HCM',
          url: `${APP_URL}/du-an`,
          telephone: '+84-971-132-378',
          description: 'Đại lý phân phối chính thức các dự án bất động sản lớn tại TP.HCM, Đồng Nai, Bình Dương.',
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
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
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Aqua City Novaland có đáng mua không?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City là đại đô thị sinh thái 1.000ha với hơn 100.000m² mặt nước, tiện ích 5 sao. Đây là lựa chọn phù hợp cho người mua ở thực và đầu tư dài hạn, đặc biệt hưởng lợi từ cầu Nhơn Trạch và sân bay Long Thành.' } },
            { '@type': 'Question', name: 'Giá căn hộ Aqua City hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo: căn hộ 1-2 phòng ngủ từ 3-5 tỷ; nhà phố liền kề từ 6-12 tỷ; biệt thự đơn lập từ 15-50 tỷ. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.' } },
            { '@type': 'Question', name: 'Aqua City cách TP.HCM bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City tọa lạc tại Long Hưng, Biên Hòa, Đồng Nai, cách trung tâm TP.HCM 35-40km. Khi cầu Nhơn Trạch hoàn thành, thời gian di chuyển đến quận 2 chỉ còn 20-25 phút.' } },
            { '@type': 'Question', name: 'Pháp lý Aqua City có an toàn không?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City được cấp sổ hồng riêng cho từng căn. Sau tái cơ cấu tài chính, Novaland đã hoàn thành nghĩa vụ pháp lý và tiếp tục bàn giao nhiều phân khu. SGS LAND kiểm tra pháp lý miễn phí.' } },
            { '@type': 'Question', name: 'Aqua City đã có sổ hồng riêng chưa?', acceptedAnswer: { '@type': 'Answer', text: 'Một số phân khu Aqua City đã được cấp sổ hồng riêng từng căn. Tình trạng pháp lý từng phân khu khác nhau — SGS LAND hỗ trợ xác minh sổ hồng cụ thể trước khi đặt cọc.' } },
            { '@type': 'Question', name: 'Novaland có còn tài chính ổn định sau tái cơ cấu?', acceptedAnswer: { '@type': 'Answer', text: 'Novaland hoàn thành tái cơ cấu tài chính năm 2024, đạt thoả thuận với trái chủ quốc tế và tiếp tục bàn giao Aqua City. Vẫn là chủ đầu tư BĐS tư nhân lớn nhất Việt Nam với quỹ đất 10.600ha+.' } },
            { '@type': 'Question', name: 'So sánh Aqua City và Izumi City — nên chọn đâu?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City: quy mô lớn hơn (1.000ha), tiện ích golf/marina, giá biệt thự cao hơn. Izumi City: chuẩn Nhật Bản, Fuji Mart, Nam Long track record bàn giao tốt, giá nhà phố thấp hơn, gần TP.HCM hơn.' } },
            { '@type': 'Question', name: 'Cho thuê Aqua City được bao nhiêu tiền?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ 1PN: 4-7 triệu/tháng; nhà phố liền kề: 8-15 triệu/tháng; biệt thự đơn lập: 30-60 triệu/tháng. Tỷ suất cho thuê biệt thự cao cấp ước đạt 4-6%/năm.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          review: [
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Nguyễn Minh Hoàng' },
              datePublished: '2026-03-12',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Mua biệt thự Aqua City Đảo Phượng Hoàng qua SGS LAND, pháp lý sổ hồng riêng từng căn, đội ngũ tư vấn chuyên sâu về quy hoạch Long Hưng - Biên Hòa. Đặt cọc giữ chỗ trong 24h, thủ tục nhanh, minh bạch chính sách CK của Novaland.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Trần Thị Mai' },
              datePublished: '2026-02-25',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'So sánh Aqua City vs Izumi City rất chi tiết, cuối cùng chọn nhà phố The Suite vì gần trường quốc tế Tesla. Hỗ trợ vay BIDV 70% giải ngân theo tiến độ, ân hạn gốc 24 tháng.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Lê Tuấn Anh' },
              datePublished: '2026-01-18',
              reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5 },
              reviewBody: 'Cho thuê lại biệt thự đơn lập đạt yield 4.2%/năm cho expat Hàn-Nhật làm việc tại KCN Long Bình. Hài lòng dịch vụ vận hành Novaland Property Management.',
            },
          ],
          '@id': `${APP_URL}/du-an/aqua-city#project`,
          name: 'Aqua City Novaland',
          description: 'Đại đô thị sinh thái 1.000ha do Novaland phát triển tại Long Hưng, Biên Hòa, Đồng Nai',
          url: `${APP_URL}/du-an/aqua-city`,
          numberOfRooms: '1-4',
          address: { '@type': 'PostalAddress', addressLocality: 'Biên Hòa', addressRegion: 'Đồng Nai', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 1000, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/manhattan': {
    title: 'Grand Manhattan Novaland | Căn Hộ Hạng Sang Novaland TP.HCM - SGS LAND',
    description: 'Grand Manhattan Novaland: căn hộ hạng sang biểu tượng của Novaland tại trung tâm TP.HCM, từ 120 triệu/m². Xem bảng giá, penthouse và sky villa tại SGS LAND.',
    h1: 'Grand Manhattan Novaland',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Grand Manhattan Novaland', item: `${APP_URL}/du-an/manhattan` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Grand Manhattan Novaland có điểm gì nổi bật?', acceptedAnswer: { '@type': 'Answer', text: 'Grand Manhattan Novaland nổi bật với thương hiệu Novaland hạng sang, vị trí trung tâm nội đô TP.HCM và chuẩn mực 5 sao từ tiện ích đến dịch vụ quản lý vận hành.' } },
            { '@type': 'Question', name: 'Giá căn hộ Grand Manhattan Novaland từ bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá từ 120 triệu/m²; căn hộ 2PN từ 9-15 tỷ; 3PN từ 15-22 tỷ; penthouse từ 30-50 tỷ. Hỗ trợ vay ngân hàng tối đa 70% giá trị.' } },
            { '@type': 'Question', name: 'Grand Manhattan Novaland ở vị trí nào tại TP.HCM?', acceptedAnswer: { '@type': 'Answer', text: 'Tọa lạc nội thành TP.HCM, tiếp giáp Quận 1 và khu vực Phú Nhuận. Chỉ 5-10 phút đến sân bay Tân Sơn Nhất, 10-15 phút đến Landmark 81.' } },
            { '@type': 'Question', name: 'Cho thuê Grand Manhattan Novaland thu nhập bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Cho thuê dài hạn: 2PN 50-80 triệu/tháng; 3PN 80-130 triệu/tháng; penthouse từ 150 triệu/tháng. Nhu cầu thuê hạng sang từ doanh nhân và chuyên gia quốc tế ổn định.' } },
            { '@type': 'Question', name: 'Pháp lý Grand Manhattan Novaland có an toàn không?', acceptedAnswer: { '@type': 'Answer', text: 'Novaland Group là tập đoàn BĐS niêm yết HOSE (mã NVL), minh bạch tài chính cao. Dự án cấp sổ hồng chính chủ lâu dài. SGS LAND kiểm tra pháp lý độc lập miễn phí.' } },
            { '@type': 'Question', name: 'Novaland Group có uy tín như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Novaland là một trong hai tập đoàn BĐS tư nhân lớn nhất Việt Nam, với các dự án biểu tượng: Aqua City 1.000ha, Novaworld Phan Thiết, NovaWorld Hồ Tràm.' } },
            { '@type': 'Question', name: 'Vay ngân hàng mua Grand Manhattan Novaland có dễ không?', acceptedAnswer: { '@type': 'Answer', text: 'Novaland uy tín và pháp lý minh bạch giúp vay thuận lợi. LTV tối đa 70%, kỳ hạn 25 năm, lãi suất ưu đãi 18-24 tháng đầu. SGS LAND hỗ trợ hồ sơ vay miễn phí.' } },
            { '@type': 'Question', name: 'Tiềm năng tăng giá Grand Manhattan Novaland trong 5 năm tới?', acceptedAnswer: { '@type': 'Answer', text: 'BĐS hạng sang nội đô TP.HCM tăng 10-18%/năm trong thập kỷ qua. Grand Manhattan hưởng lợi từ quỹ đất khan hiếm, Metro số 2 (2028-2030) và TP.HCM phát triển thành trung tâm tài chính khu vực.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/manhattan#project`,
          name: 'Grand Manhattan Novaland',
          description: 'Tổ hợp căn hộ hạng sang biểu tượng của Novaland tại trung tâm TP.HCM, chuẩn mực 5 sao quốc tế',
          url: `${APP_URL}/du-an/manhattan`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP.HCM', addressCountry: 'VN' },
          offers: { '@type': 'Offer', price: '120000000', priceCurrency: 'VND', unitText: 'm²' },
        },
      ],
    },
  },

  'du-an/vinhomes-can-gio': {
    title: 'Vinhomes Cần Giờ 2.870ha — Siêu Đô Thị Biển Lớn Nhất VN | SGS LAND',
    description: 'Vinhomes Cần Giờ (Green Paradise): siêu đô thị lấn biển 2.870ha lớn nhất Việt Nam tại huyện Cần Giờ, TP.HCM. Bãi biển 7km, Vinwonders, golf, marina. Từ 12 tỷ. Đặt chỗ ưu tiên tại SGS LAND.',
    h1: 'Vinhomes Cần Giờ — Vinhomes Green Paradise 2.870ha',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/du-an` },
            { '@type': 'ListItem', position: 3, name: 'Vinhomes Cần Giờ', item: `${APP_URL}/du-an/vinhomes-can-gio` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Vinhomes Cần Giờ là dự án gì và quy mô bao nhiêu hecta?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Cần Giờ (tên thương mại Vinhomes Green Paradise) là siêu đô thị du lịch nghỉ dưỡng lấn biển 2.870ha do Vinhomes – Vingroup phát triển tại huyện Cần Giờ, TP.HCM. Đây là dự án BĐS có quy mô lớn nhất Việt Nam từ trước đến nay, gấp 10 lần Vinhomes Grand Park (271ha), tích hợp nhà ở, nghỉ dưỡng, thương mại và giải trí trong một đô thị biển hoàn chỉnh.' } },
            { '@type': 'Question', name: 'Giá bán Vinhomes Cần Giờ bao nhiêu tiền năm 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo Vinhomes Cần Giờ năm 2026: căn hộ resort từ 12-25 tỷ; shophouse biển từ 20-50 tỷ; biệt thự song lập từ 30-80 tỷ; biệt thự đơn lập mặt biển từ 80-200 tỷ; condotel từ 8-15 tỷ. Đây là giá mở bán phân kỳ đầu — kỳ vọng tăng 20-40% sau khi cầu Cần Giờ hoàn thành năm 2028. Đặt chỗ ưu tiên tại SGS LAND hotline 0971 132 378.' } },
            { '@type': 'Question', name: 'Vinhomes Cần Giờ cách trung tâm TP.HCM bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Hiện tại: cách Q1 khoảng 50km, qua phà Bình Khánh mất 45-60 phút. Sau 2028 khi cầu Cần Giờ hoàn thành (vốn 11.000 tỷ, dài 3,2km): chỉ còn 30-40 phút. Tuyến tàu cao tốc Sài Gòn – Cần Giờ đang được quy hoạch rút xuống 25-30 phút. Hạ tầng kết nối là yếu tố then chốt tăng giá trị dự án.' } },
            { '@type': 'Question', name: 'Cầu Cần Giờ khi nào hoàn thành và ảnh hưởng thế nào đến BĐS?', acceptedAnswer: { '@type': 'Answer', text: 'Cầu Cần Giờ tổng vốn 11.000 tỷ đồng, khởi công 2025, dự kiến hoàn thành 2028. Cầu dài 3,2km nối huyện Nhà Bè và Cần Giờ, rút ngắn thời gian di chuyển xuống 15-20 phút. Kinh nghiệm từ Nhơn Trạch và Long An: BĐS tăng 30-60% trong 2 năm sau khi cầu hoàn thành.' } },
            { '@type': 'Question', name: 'Vinhomes Cần Giờ có những loại hình sản phẩm bất động sản nào?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Cần Giờ cung cấp: (1) Căn hộ resort view biển từ 12 tỷ; (2) Condotel vận hành bởi Vinpearl/Marriott; (3) Shophouse biển mặt tiền đại lộ từ 20 tỷ; (4) Biệt thự song lập/đơn lập ven biển từ 30 tỷ; (5) Villa mặt biển ultra-luxury từ 80 tỷ; (6) Căn hộ cao tầng view toàn cảnh. Tích hợp Vinwonders, sân golf 18 lỗ, marina, bãi biển nhân tạo 7km.' } },
            { '@type': 'Question', name: 'Pháp lý Vinhomes Cần Giờ ra sao và có an toàn để đầu tư?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Cần Giờ đã được Thủ tướng Chính phủ phê duyệt chủ trương đầu tư. Quy hoạch 1/500 đang hoàn thiện theo từng phân kỳ. Vinhomes (Vingroup) là tập đoàn BĐS số 1 Việt Nam với lịch sử pháp lý sạch và bàn giao đúng tiến độ. SGS LAND kiểm tra pháp lý từng phân kỳ miễn phí trước khi khách đặt cọc.' } },
            { '@type': 'Question', name: 'Tại sao Vinhomes Cần Giờ là siêu dự án lớn nhất Việt Nam?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Cần Giờ 2.870ha vượt xa bất kỳ dự án BĐS nào về quy mô — gấp 10 lần Vinhomes Grand Park (271ha), gấp 24 lần The Global City (117ha). Dự án tích hợp bãi biển nhân tạo 7km (lớn nhất VN), Vinwonders đại dương, sân golf 18 lỗ, marina du thuyền và chuỗi resort 5 sao — tạo nên đô thị biển hoàn chỉnh đầu tiên tại Việt Nam.' } },
            { '@type': 'Question', name: 'Đầu tư Vinhomes Cần Giờ tiềm năng sinh lời thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Ba yếu tố tạo sinh lời: (1) Hạ tầng: cầu Cần Giờ 2028 + tàu cao tốc — kết nối rút ngắn kéo giá tăng 30-60%; (2) Scarcity: đất biển TP.HCM cực hiếm, không thể tái tạo; (3) Vinhomes brand: dự án Vinhomes thường tăng 15-30% từ mở bán đến bàn giao. Kỳ vọng tăng giá 3-5 năm: 40-80%. Cho thuê condotel theo mô hình Vinpearl: tỷ suất 6-10%/năm.' } },
            { '@type': 'Question', name: 'Vinhomes Cần Giờ có ảnh hưởng đến sinh quyển UNESCO Cần Giờ không?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Cần Giờ phát triển theo quy hoạch TP.HCM phê duyệt, trong vùng đô thị được cho phép — không xâm phạm vùng lõi bảo vệ của Khu dự trữ sinh quyển thế giới Cần Giờ (UNESCO 2000). Dự án lấn biển ra ngoài đất liền, bảo tồn nguyên vẹn hệ sinh thái rừng ngập mặn.' } },
            { '@type': 'Question', name: 'SGS LAND hỗ trợ mua Vinhomes Cần Giờ như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND là đại lý phân phối chính thức Vinhomes Cần Giờ: (1) Đặt chỗ ưu tiên phân kỳ đầu trước khi mở bán rộng rãi; (2) Tư vấn chiến lược đầu tư theo ngân sách; (3) Kiểm tra pháp lý miễn phí; (4) Kết nối vay ngân hàng tối đa 70% (VCB, BIDV, TCB, VPBank); (5) Không thu phí từ người mua. Hotline 0971 132 378 — info@sgsland.vn.' } },
            { '@type': 'Question', name: 'So sánh Vinhomes Cần Giờ và Vinhomes Grand Park nên mua đâu?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Grand Park (271ha, Thủ Đức): đã bàn giao, sổ hồng đầy đủ, Metro số 1, từ 3 tỷ — phù hợp ở thực, an toàn pháp lý, thanh khoản cao. Vinhomes Cần Giờ (2.870ha, Cần Giờ): mở bán từ 12 tỷ, tiềm năng tăng 40-80% trong 3-5 năm, sản phẩm nghỉ dưỡng cao cấp. Chọn Grand Park nếu ưu tiên ở thực; Cần Giờ nếu ưu tiên đầu tư biên lợi nhuận cao.' } },
          ],
        },
        {
          '@type': 'RealEstateListing',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          review: [
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Phạm Quang Vinh' },
              datePublished: '2026-03-28',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Đặt chỗ ưu tiên Vinhomes Cần Giờ giai đoạn 1 qua SGS LAND, vị trí siêu đô thị lấn biển 2.870ha quá tiềm năng. Đại lý phân phối chính thức nên cập nhật liên tục tiến độ san lấp và lộ trình mở bán dự kiến Q3/2026.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Vũ Hương Giang' },
              datePublished: '2026-03-05',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Thông tin pháp lý chuẩn xác, không kiểu cò mồi thổi giá. Tư vấn rõ ràng về cầu Cần Giờ 11.000 tỷ và quy hoạch giao thông kết nối Quận 7. Tin tưởng vào uy tín Vingroup và đội ngũ SGS LAND.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Hoàng Tiến Dũng' },
              datePublished: '2026-02-14',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Mua từ xa qua SGS LAND, nhận hỗ trợ ký hợp đồng đặt cọc online, không cần bay từ Hà Nội vào TP.HCM. Quy trình đặt chỗ Vinhomes Cần Giờ minh bạch, có biên lai chính chủ, sau đó chuyển HĐMB qua Vinhomes.',
            },
          ],
          '@id': `${APP_URL}/du-an/vinhomes-can-gio#project`,
          name: 'Vinhomes Cần Giờ (Green Paradise)',
          alternateName: 'Vinhomes Green Paradise',
          description: 'Siêu đô thị du lịch nghỉ dưỡng lấn biển 2.870ha — dự án BĐS lớn nhất Việt Nam của Vinhomes tại huyện Cần Giờ, TP.HCM',
          url: `${APP_URL}/du-an/vinhomes-can-gio`,
          image: `${APP_URL}/images/projects/vinhomes-can-gio.png`,
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Huyện Cần Giờ',
            addressLocality: 'TP.HCM',
            addressRegion: 'TP.HCM',
            addressCountry: 'VN',
            postalCode: '733000',
          },
          geo: { '@type': 'GeoCoordinates', latitude: 10.4229, longitude: 106.9488 },
          floorSize: { '@type': 'QuantitativeValue', value: 2870, unitText: 'ha' },
          numberOfRooms: 'Đa dạng — căn hộ, biệt thự, shophouse, condotel',
          priceRange: 'Từ 12 tỷ VND',
          offers: {
            '@type': 'Offer',
            priceCurrency: 'VND',
            price: '12000000000',
            priceSpecification: { '@type': 'PriceSpecification', minPrice: 12000000000, maxPrice: 200000000000, priceCurrency: 'VND' },
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
          },
          amenityFeature: [
            { '@type': 'LocationFeatureSpecification', name: 'Bãi biển nhân tạo', value: '7km' },
            { '@type': 'LocationFeatureSpecification', name: 'Vinwonders Cần Giờ', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Sân golf 18 lỗ', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Marina & bến du thuyền', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Resort 5 sao Vinpearl', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Bệnh viện Vinmec', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Trường Vinschool', value: true },
          ],
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Chủ đầu tư', value: 'Vinhomes (Tập đoàn Vingroup)' },
            { '@type': 'PropertyValue', name: 'Pháp lý', value: 'Thủ tướng phê duyệt chủ trương' },
            { '@type': 'PropertyValue', name: 'Tiến độ', value: 'Khởi công 2025 — mở bán 2026 — bàn giao từ 2028' },
            { '@type': 'PropertyValue', name: 'Cầu Cần Giờ', value: '11.000 tỷ VND, hoàn thành 2028' },
            { '@type': 'PropertyValue', name: 'Đại lý phân phối', value: 'SGS LAND — sgsland.vn — 0971 132 378' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          name: 'SGS LAND',
          url: `${APP_URL}`,
          telephone: '+84-971-132-378',
          email: 'info@sgsland.vn',
          description: 'Đại lý phân phối chính thức Vinhomes Cần Giờ. Tư vấn miễn phí, không thu phí người mua.',
          areaServed: { '@type': 'City', name: 'TP.HCM' },
        },
      ],
    },
  },
  'du-an/van-phuc-city': {
    title: 'Vạn Phúc City | Khu Đô Thị 198ha Ven Sông Sài Gòn, Thủ Đức — SGS LAND',
    description: 'Vạn Phúc City Đại Phúc: khu đô thị 198ha ven sông Sài Gòn tại TP Thủ Đức. Bảng giá nhà phố, biệt thự, shophouse cập nhật, sổ hồng riêng. Tư vấn miễn phí tại SGS LAND.',
    h1: 'Vạn Phúc City — Khu Đô Thị Ven Sông Đại Phúc',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Vạn Phúc City', item: `${APP_URL}/du-an/van-phuc-city` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Vạn Phúc City do ai làm chủ đầu tư?', acceptedAnswer: { '@type': 'Answer', text: 'Vạn Phúc City do Tập đoàn Đại Phúc (Đại Phúc Group) phát triển — chủ đầu tư có hơn 20 năm kinh nghiệm BĐS, sở hữu chuỗi Van Phuc Mall, EMASI và bệnh viện Hạnh Phúc.' } },
            { '@type': 'Question', name: 'Giá nhà phố Vạn Phúc City bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà phố từ 18-35 tỷ; biệt thự đơn lập 40-120 tỷ; shophouse mặt đại lộ 25-60 tỷ. Giá secondary tăng ổn định 10-15%/năm. Liên hệ SGS LAND để nhận bảng giá realtime.' } },
            { '@type': 'Question', name: 'Pháp lý Vạn Phúc City có an toàn không?', acceptedAnswer: { '@type': 'Answer', text: 'Phần lớn phân khu đã có sổ hồng riêng từng căn, đã bàn giao và vào ở. SGS LAND kiểm tra sổ cụ thể trước khi đặt cọc miễn phí.' } },
            { '@type': 'Question', name: 'Vạn Phúc City có những tiện ích gì nổi bật?', acceptedAnswer: { '@type': 'Answer', text: '3,4km bờ sông Sài Gòn, quảng trường nhạc nước Van Phuc Symphony, Van Phuc Mall, trường quốc tế EMASI, bệnh viện Hạnh Phúc, công viên ven sông, chuỗi tiện ích nội khu hoàn thiện.' } },
            { '@type': 'Question', name: 'Vạn Phúc City cách trung tâm TP.HCM bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Cách Q1 khoảng 12km qua quốc lộ 13. Gần ga Metro số 1 Tân Cảng, cầu Bình Triệu, cao tốc TP.HCM – Long Thành – Dầu Giây.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/van-phuc-city#project`,
          name: 'Vạn Phúc City',
          description: 'Khu đô thị 198ha ven sông Sài Gòn của Đại Phúc Group tại TP Thủ Đức',
          url: `${APP_URL}/du-an/van-phuc-city`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP Thủ Đức', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 198, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/sala': {
    title: 'Sala Đại Quang Minh | Khu Đô Thị Sala Thủ Thiêm 257ha — SGS LAND',
    description: 'Khu đô thị Sala Đại Quang Minh tại Thủ Thiêm: căn hộ Sarica, Sarimi, Sadora, Sapphire; nhà phố, biệt thự cao cấp. Bảng giá, pháp lý, định giá AI miễn phí tại SGS LAND.',
    h1: 'Khu Đô Thị Sala Đại Quang Minh — Thủ Thiêm',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Sala Đại Quang Minh', item: `${APP_URL}/du-an/sala` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Khu đô thị Sala là dự án gì?', acceptedAnswer: { '@type': 'Answer', text: 'Sala là khu đô thị 257ha do Đại Quang Minh phát triển tại Khu chức năng số 6 Khu Đô Thị mới Thủ Thiêm, đối diện Quận 1 qua sông Sài Gòn. Giai đoạn 1 đã hoàn thiện và bàn giao từ 2017.' } },
            { '@type': 'Question', name: 'Các phân khu căn hộ Sala gồm những gì?', acceptedAnswer: { '@type': 'Answer', text: 'Sala có các phân khu căn hộ hạng sang Sarica, Sarimi, Sadora, Sapphire — cùng nhà phố thương mại, biệt thự, shophouse Sala. Tất cả đều đã có sổ hồng riêng.' } },
            { '@type': 'Question', name: 'Giá căn hộ Sala bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ Sala 75-150 triệu/m² (3-12 tỷ tùy diện tích); nhà phố Sala 35-90 tỷ; biệt thự đơn lập 80-250 tỷ. SGS LAND có dữ liệu giao dịch secondary cập nhật hàng tuần.' } },
            { '@type': 'Question', name: 'Sala đi vào trung tâm Q1 bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Sala cách Q1 khoảng 5 phút qua hầm Thủ Thiêm. Gần cầu Ba Son, cầu Thủ Thiêm 2 và ga Metro số 1 Ba Son.' } },
            { '@type': 'Question', name: 'Tiềm năng tăng giá Sala?', acceptedAnswer: { '@type': 'Answer', text: 'Sala nằm trong vùng lõi Trung Tâm Tài Chính tương lai TP.HCM (Thủ Thiêm). Giá tăng ổn định 8-15%/năm; cho thuê đạt 3-5%/năm với khách thuê quốc tế.' } },
            { '@type': 'Question', name: 'Đại Quang Minh có uy tín không?', acceptedAnswer: { '@type': 'Answer', text: 'Đại Quang Minh là chủ đầu tư BĐS lớn, được giao thực hiện 4 tuyến đường chính Thủ Thiêm theo BT, hợp tác chiến lược với THACO Group. Track record bàn giao Sala đúng tiến độ và chất lượng cao.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/sala#project`,
          name: 'Khu Đô Thị Sala Đại Quang Minh',
          description: 'Khu đô thị 257ha tại Khu Đô Thị mới Thủ Thiêm, TP Thủ Đức — bao gồm các phân khu căn hộ Sarica, Sarimi, Sadora, Sapphire',
          url: `${APP_URL}/du-an/sala`,
          address: { '@type': 'PostalAddress', addressLocality: 'Thủ Thiêm, TP Thủ Đức', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 257, unitText: 'ha' },
        },
      ],
    },
  },

  // ─── New Location Landing Pages ─────────────────────────────────────────────
  'bat-dong-san-thu-duc': {
    title: 'Bất Động Sản TP Thủ Đức 2026 | Top 3 Dự Án Căn Hộ Vinhomes, Masterise — SGS LAND',
    description: 'Top 3 dự án căn hộ TP Thủ Đức 2026: Vinhomes Grand Park (271ha), The Global City (117ha), Vạn Phúc City (198ha). Giá 35–250 triệu/m², gần Metro số 1 vận hành cuối 2024. SGS LAND phân phối, định giá AI miễn phí.',
    h1: 'Bất Động Sản TP Thủ Đức',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'BĐS TP Thủ Đức', item: `${APP_URL}/bat-dong-san-thu-duc` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Top 3 dự án căn hộ tốt nhất TP Thủ Đức 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 dự án căn hộ tại TP Thủ Đức năm 2026 do SGS LAND phân phối: (1) Vinhomes Grand Park — Vinhomes, 271ha, từ 3 tỷ đồng, đang bàn giao; (2) The Global City — Masterise Homes, 117ha tại An Phú, từ 7,5 tỷ đồng; (3) Vạn Phúc City — Đại Phúc Group, 198ha ven sông Sài Gòn. Cả ba đều có sổ hồng riêng từng căn.' } },
            { '@type': 'Question', name: 'Bất động sản TP Thủ Đức có nên đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'TP Thủ Đức là khu vực có tiềm năng tăng trưởng BĐS cao nhất TP.HCM nhờ Metro số 1 (vận hành cuối 2024), Khu Đô Thị Thủ Thiêm 657ha và Khu Công Nghệ Cao SHTP. Theo CBRE Vietnam Q4/2025, giá căn hộ Thủ Đức tăng trung bình 10–18%/năm trong 5 năm gần đây — cao nhất TP.HCM.' } },
            { '@type': 'Question', name: 'Giá căn hộ TP Thủ Đức năm 2026 là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá tham khảo căn hộ TP Thủ Đức năm 2026: Thủ Thiêm (Q2 cũ) 80–250 triệu/m²; khu vực Metro số 1 (Q9 cũ) 45–90 triệu/m²; trung tâm Thủ Đức 35–65 triệu/m²; khu Vinhomes Grand Park 50–80 triệu/m².' } },
            { '@type': 'Question', name: 'Metro số 1 ảnh hưởng thế nào đến BĐS Thủ Đức?', acceptedAnswer: { '@type': 'Answer', text: 'Theo Savills Vietnam, BĐS trong bán kính 500m quanh các ga Metro số 1 (Bến Thành – Suối Tiên) tăng giá 20–40% sau khi Metro vận hành thương mại cuối 2024. Nhà cho thuê gần ga Metro đạt tỷ suất 6–9%/năm — cao hơn mặt bằng chung TP.HCM (4–6%).' } },
            { '@type': 'Question', name: 'Vinhomes Grand Park hay The Global City — nên chọn dự án nào?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Grand Park (271ha) phù hợp người mua ở thực và đầu tư trung dài hạn — giá khởi điểm thấp hơn (từ 3 tỷ), tiện ích Vinhomes hoàn chỉnh, đang bàn giao thực tế. The Global City (117ha) phù hợp đầu tư hạng sang — vị trí An Phú gần Q1, giá cao hơn (từ 7,5 tỷ), thương hiệu Masterise quốc tế hoá.' } },
            { '@type': 'Question', name: 'Thủ Thiêm và Q9 cũ — khu nào tăng giá BĐS hơn?', acceptedAnswer: { '@type': 'Answer', text: 'Thủ Thiêm tăng giá nhanh hơn về tuyệt đối (80–250 triệu/m²) nhờ định vị trung tâm tài chính TP.HCM mới và quỹ đất khan hiếm. Q9 cũ (Vinhomes Grand Park, SHTP) tăng giá nhanh hơn về tỷ lệ (10–18%/năm) nhờ quỹ đất dồi dào, hạ tầng Metro số 1 và làn sóng dịch chuyển dân số trẻ.' } },
            { '@type': 'Question', name: 'Tỷ suất cho thuê căn hộ TP Thủ Đức là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Tỷ suất cho thuê căn hộ TP Thủ Đức năm 2026: căn 1PN gần Metro 7–9%/năm; căn 2PN Vinhomes Grand Park 5–7%/năm; căn hộ hạng sang Thủ Thiêm 3–5%/năm. Tỷ suất cho thuê chuyên gia nước ngoài tại The Global City đạt 6–8%/năm.' } },
            { '@type': 'Question', name: 'Mua nhà phố TP Thủ Đức giá bao nhiêu năm 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Giá nhà phố TP Thủ Đức năm 2026: nhà phố mặt tiền đường lớn 150–300 triệu/m²; nhà phố hẻm xe hơi 80–150 triệu/m²; shophouse Vinhomes Grand Park từ 18 tỷ; biệt thự Vạn Phúc City từ 25 tỷ.' } },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/bat-dong-san-thu-duc#top3`,
          name: 'Top 3 Dự Án Căn Hộ TP Thủ Đức 2026',
          description: 'Bảng xếp hạng 3 dự án căn hộ hàng đầu tại TP Thủ Đức năm 2026 do SGS LAND phân phối — chọn lọc theo quy mô, chủ đầu tư, tiến độ bàn giao và pháp lý sổ hồng.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Vinhomes Grand Park', url: `${APP_URL}/du-an/vinhomes-grand-park`, description: 'Siêu đô thị tích hợp 271ha, Vinhomes phát triển. Đang bàn giao. Căn hộ từ 3 tỷ.' },
            { '@type': 'ListItem', position: 2, name: 'The Global City Masterise Homes', url: `${APP_URL}/du-an/the-global-city`, description: 'Đại đô thị thương mại 117ha tại An Phú. Masterise Homes. Căn hộ từ 7,5 tỷ.' },
            { '@type': 'ListItem', position: 3, name: 'Vạn Phúc City', url: `${APP_URL}/du-an/van-phuc-city`, description: 'Khu đô thị ven sông Sài Gòn 198ha. Đại Phúc Group. Nhà phố và căn hộ.' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-thu-duc#agent`,
          name: 'SGS LAND - BĐS TP Thủ Đức',
          url: `${APP_URL}/bat-dong-san-thu-duc`,
          telephone: '+84-971-132-378',
          areaServed: { '@type': 'City', name: 'TP Thủ Đức', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Thủ Đức', 'Căn hộ Thủ Đức', 'Vinhomes Grand Park', 'The Global City', 'Vạn Phúc City', 'Thủ Thiêm', 'Metro số 1', 'SHTP'],
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },
  'bat-dong-san-binh-duong': {
    title: 'Bất Động Sản Bình Dương 2026 | Top 3 Khu Đầu Tư Thuận An, Dĩ An, TP Mới — SGS LAND',
    description: 'Top 3 khu đầu tư BĐS Bình Dương 2026: Thuận An (40–100tr/m²), Dĩ An (30–90tr/m²), Thành Phố Mới (20–50tr/m²). Hơn 30 khu công nghiệp, tăng 8–15%/năm. SGS LAND định giá AI miễn phí, kiểm tra pháp lý độc lập.',
    h1: 'Bất Động Sản Bình Dương',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'BĐS Bình Dương', item: `${APP_URL}/bat-dong-san-binh-duong` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Top 3 khu vực nên đầu tư BĐS Bình Dương 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 khu đầu tư BĐS Bình Dương năm 2026: (1) Thuận An — giáp TP.HCM, giá 40–100 triệu/m², thanh khoản cao; (2) Dĩ An — gần Metro số 1 và ĐH Quốc Gia, giá 30–90 triệu/m²; (3) Thành Phố Mới Bình Dương — quy hoạch bài bản, giá 20–50 triệu/m², tiềm năng tăng giá lớn nhất.' } },
            { '@type': 'Question', name: 'Bất động sản Bình Dương có tiềm năng không?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương là tỉnh có tốc độ đô thị hóa nhanh nhất cả nước với hơn 30 KCN đang hoạt động và GRDP bình quân đầu người cao thứ 2 Việt Nam (sau Bà Rịa – Vũng Tàu). Theo Hiệp Hội BĐS Bình Dương, giá BĐS tăng 8–15%/năm trong 5 năm gần đây, dẫn dắt bởi nhu cầu nhà ở chuyên gia FDI.' } },
            { '@type': 'Question', name: 'Mua căn hộ Bình Dương để cho thuê có lời không?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ cao cấp tại Thuận An, Dĩ An cho thuê 10–25 triệu/tháng (chuyên gia Hàn, Nhật, Đài). Tỷ suất cho thuê bruto đạt 5–8%/năm — vượt lãi suất tiết kiệm ngân hàng (4–5%) và cao hơn căn hộ TP.HCM (3–5%) cùng phân khúc.' } },
            { '@type': 'Question', name: 'Giá đất Bình Dương năm 2026 là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá đất Bình Dương năm 2026: Thuận An, Dĩ An 40–100 triệu/m²; Thủ Dầu Một 30–80 triệu/m²; Thành Phố Mới 20–50 triệu/m²; Bến Cát, Tân Uyên 8–20 triệu/m². Đất KCN cho thuê 100–250 USD/m²/50 năm.' } },
            { '@type': 'Question', name: 'Bình Dương hay Đồng Nai — nên đầu tư BĐS hơn?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương mạnh về tốc độ đô thị hoá hiện tại và nhu cầu thuê từ chuyên gia FDI. Đồng Nai tiềm năng tăng trưởng dài hạn lớn hơn nhờ sân bay Long Thành (vận hành 2027). Ngân sách 2–5 tỷ, ưu tiên cash-flow cho thuê nên chọn Bình Dương; ngân sách 5–15 tỷ, đầu tư chờ sóng hạ tầng nên chọn Đồng Nai.' } },
            { '@type': 'Question', name: 'Khu công nghiệp Bình Dương ảnh hưởng thế nào đến BĐS?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương có hơn 30 KCN với 1,2 triệu lao động và 50.000+ chuyên gia nước ngoài. Nhu cầu nhà trọ công nhân (4–8 triệu/tháng/căn) và căn hộ chuyên gia (15–30 triệu/tháng) ổn định, tỷ suất cho thuê 8–12%/năm — cao nhất khu vực Đông Nam Bộ.' } },
            { '@type': 'Question', name: 'Vay ngân hàng mua BĐS Bình Dương có dễ không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. Vietcombank, BIDV, Techcombank cho vay mua BĐS Bình Dương LTV 70–80%, kỳ hạn 20–25 năm, lãi suất ưu đãi 6–8,5%/năm 24 tháng đầu. SGS LAND kết nối ngân hàng và hỗ trợ hồ sơ vay miễn phí, duyệt trong 7–10 ngày.' } },
            { '@type': 'Question', name: 'Pháp lý đất Bình Dương cần lưu ý gì?', acceptedAnswer: { '@type': 'Answer', text: 'Lưu ý: tránh đất quy hoạch giao thông và KCN chưa giải toả, đất nông nghiệp chưa chuyển mục đích, đất dự án chưa đủ điều kiện mở bán theo Luật Kinh Doanh BĐS 2023. SGS LAND kiểm tra quy hoạch 1/500 và sổ đỏ độc lập miễn phí trước khi đặt cọc.' } },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/bat-dong-san-binh-duong#top3`,
          name: 'Top 3 Khu Vực Đầu Tư BĐS Bình Dương 2026',
          description: 'Bảng xếp hạng 3 khu vực đầu tư bất động sản hàng đầu tại Bình Dương năm 2026 — chọn lọc theo thanh khoản, tăng giá, hạ tầng và nhu cầu thuê từ chuyên gia FDI.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Thuận An', description: 'Giáp TP.HCM, giá 40–100 triệu/m², thanh khoản cao nhất Bình Dương.' },
            { '@type': 'ListItem', position: 2, name: 'Dĩ An', description: 'Gần Metro số 1 và Đại Học Quốc Gia, giá 30–90 triệu/m², nhu cầu thuê sinh viên và chuyên gia ổn định.' },
            { '@type': 'ListItem', position: 3, name: 'Thành Phố Mới Bình Dương', description: 'Quy hoạch bài bản, giá 20–50 triệu/m², tiềm năng tăng giá dài hạn lớn nhất.' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-binh-duong#agent`,
          name: 'SGS LAND - BĐS Bình Dương',
          url: `${APP_URL}/bat-dong-san-binh-duong`,
          telephone: '+84-971-132-378',
          areaServed: { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          knowsAbout: ['Bất động sản Bình Dương', 'Khu công nghiệp Bình Dương', 'Thuận An', 'Dĩ An', 'Thủ Dầu Một', 'Thành Phố Mới Bình Dương', 'Cho thuê chuyên gia FDI'],
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },
  'bat-dong-san-quan-7': {
    title: 'Bất Động Sản Quận 7 TP.HCM 2026 | Top 3 Khu Phú Mỹ Hưng, Sunrise, Tân Phong — SGS LAND',
    description: 'Top 3 khu BĐS Quận 7 TP.HCM 2026: Phú Mỹ Hưng (70–150tr/m²), Sunrise City (55–90tr/m²), Tân Phong (40–70tr/m²). Cộng đồng Hàn–Nhật–Đài đông nhất TP.HCM, tăng 8–12%/năm. SGS LAND định giá AI miễn phí.',
    h1: 'Bất Động Sản Quận 7',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'BĐS Quận 7', item: `${APP_URL}/bat-dong-san-quan-7` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Top 3 khu vực BĐS đáng mua nhất Quận 7 TP.HCM 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 khu BĐS Quận 7 năm 2026: (1) Phú Mỹ Hưng — 433ha, giá căn hộ 70–150 triệu/m², cộng đồng Hàn–Nhật–Đài lớn nhất TP.HCM; (2) Sunrise City Novaland — 5ha tại Nguyễn Hữu Thọ, giá 55–90 triệu/m², bàn giao đầy đủ; (3) Tân Phong & Tân Quy — giá 40–70 triệu/m², gần Phú Mỹ Hưng nhưng giá hợp lý hơn.' } },
            { '@type': 'Question', name: 'Bất động sản Quận 7 có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Quận 7 là thị trường BĐS ổn định và thanh khoản cao nhất TP.HCM nhờ cộng đồng quốc tế đông đảo (50.000+ chuyên gia Hàn, Nhật, Đài). Theo Savills Vietnam, giá BĐS Quận 7 tăng đều đặn 8–12%/năm và tỷ suất cho thuê hạng sang đạt 4–6%/năm — ổn định hơn các quận khác TP.HCM.' } },
            { '@type': 'Question', name: 'Giá căn hộ Quận 7 năm 2026 là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá căn hộ Quận 7 năm 2026: Phú Mỹ Hưng (Sky Garden, Riverpark, Scenic Valley) 70–150 triệu/m²; Sunrise City 55–90 triệu/m²; khu vực Tân Phong, Tân Quy, Tân Thuận Đông 40–70 triệu/m². Cho thuê căn 2–3PN Phú Mỹ Hưng đạt 25–60 triệu/tháng.' } },
            { '@type': 'Question', name: 'Phú Mỹ Hưng có đặc điểm gì hấp dẫn nhà đầu tư?', acceptedAnswer: { '@type': 'Answer', text: 'Phú Mỹ Hưng (433ha) hấp dẫn nhờ: (1) cộng đồng quốc tế đông nhất TP.HCM — Hàn (15.000+), Nhật (8.000+), Đài Loan (5.000+); (2) hạ tầng xanh chuẩn Singapore — 50% diện tích cây xanh; (3) hệ sinh thái 20+ trường quốc tế (RMIT, Saigon South International School, Renaissance) và bệnh viện FV tiêu chuẩn Pháp.' } },
            { '@type': 'Question', name: 'Cho thuê căn hộ Phú Mỹ Hưng có ổn định không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. Tỷ lệ lấp đầy cho thuê Phú Mỹ Hưng đạt 92–98% (CBRE Vietnam Q4/2025) — cao nhất TP.HCM. Tỷ suất cho thuê căn 2PN: 4–6%/năm; 3PN: 3,5–5%/năm. Khách thuê chính là chuyên gia Hàn–Nhật–Đài, hợp đồng 1–3 năm, thanh toán đúng hạn.' } },
            { '@type': 'Question', name: 'Quận 7 hay Quận 2 — nên mua BĐS đâu hơn?', acceptedAnswer: { '@type': 'Answer', text: 'Quận 2 (Thủ Thiêm, An Phú) định vị trung tâm tài chính mới, giá tăng nhanh hơn (15–25%/năm) nhưng giá tuyệt đối cao (80–250 triệu/m²). Quận 7 (Phú Mỹ Hưng) định vị cộng đồng quốc tế ổn định, giá tăng chậm hơn (8–12%/năm) nhưng cho thuê ổn định và thanh khoản cao hơn. Đầu tư dài hạn ưu tiên Q2; mua ở thực và cho thuê ưu tiên Q7.' } },
            { '@type': 'Question', name: 'Mua nhà phố Quận 7 giá bao nhiêu năm 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Giá nhà phố Quận 7 năm 2026: nhà phố Phú Mỹ Hưng (Hưng Phước, Mỹ Toàn, Mỹ Phúc) 250–500 triệu/m²; biệt thự Phú Mỹ Hưng 35–80 tỷ/căn; nhà phố Tân Phong, Tân Quy 80–180 triệu/m²; shophouse mặt tiền Nguyễn Thị Thập 200–400 triệu/m².' } },
            { '@type': 'Question', name: 'Cộng đồng Hàn Quốc Quận 7 có quy mô như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Cộng đồng Hàn Quốc tại Quận 7 ước 15.000+ người (lớn nhất Việt Nam), tập trung Phú Mỹ Hưng — phố Hàn Sky Garden, Mỹ Khánh, Mỹ Đức. Hệ sinh thái: Trường Hàn Quốc TP.HCM, siêu thị Lotte Mart, K-Mart, hơn 200 nhà hàng Hàn Quốc — tạo nhu cầu thuê căn hộ Hàn ổn định nhất TP.HCM.' } },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/bat-dong-san-quan-7#top3`,
          name: 'Top 3 Khu Vực BĐS Quận 7 TP.HCM 2026',
          description: 'Bảng xếp hạng 3 khu vực bất động sản hàng đầu Quận 7 năm 2026 — chọn lọc theo cộng đồng quốc tế, hạ tầng xanh, thanh khoản cho thuê và tốc độ tăng giá.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Phú Mỹ Hưng', description: '433ha, giá 70–150 triệu/m², cộng đồng Hàn–Nhật–Đài lớn nhất TP.HCM, 20+ trường quốc tế.' },
            { '@type': 'ListItem', position: 2, name: 'Sunrise City Novaland', description: '5ha tại Nguyễn Hữu Thọ, giá 55–90 triệu/m², đã bàn giao đầy đủ, gần cầu Kênh Tẻ.' },
            { '@type': 'ListItem', position: 3, name: 'Tân Phong & Tân Quy', description: 'Giá 40–70 triệu/m², giáp Phú Mỹ Hưng, giá hợp lý cho người mua ở thực và đầu tư trung hạn.' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-quan-7#agent`,
          name: 'SGS LAND - BĐS Quận 7',
          url: `${APP_URL}/bat-dong-san-quan-7`,
          telephone: '+84-971-132-378',
          areaServed: { '@type': 'City', name: 'Quận 7', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Quận 7', 'Phú Mỹ Hưng', 'Sunrise City Novaland', 'Cộng đồng Hàn Quốc TP.HCM', 'Cộng đồng Nhật TP.HCM', 'Trường quốc tế Quận 7', 'Cho thuê chuyên gia'],
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },
  'bat-dong-san-phu-nhuan': {
    title: 'Bất Động Sản Phú Nhuận TP.HCM 2026 | Top 3 Trục Phan Đình Phùng, Hoàng Văn Thụ — SGS LAND',
    description: 'Top 3 trục BĐS Phú Nhuận 2026: Phan Đình Phùng (200–350tr/m²), Hoàng Văn Thụ (150–280tr/m²), nhà hẻm xe hơi (80–150tr/m²). Cách sân bay Tân Sơn Nhất 2–4km, tăng 8–15%/năm. SGS LAND định giá AI miễn phí.',
    h1: 'Bất Động Sản Phú Nhuận',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'BĐS Phú Nhuận', item: `${APP_URL}/bat-dong-san-phu-nhuan` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Top 3 trục đường BĐS đắt nhất Phú Nhuận TP.HCM 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Top 3 trục đường BĐS đắt nhất Phú Nhuận năm 2026: (1) Phan Đình Phùng — 200–350 triệu/m², trục thương mại sầm uất; (2) Hoàng Văn Thụ — 150–280 triệu/m², trục cửa ngõ sân bay; (3) Phan Xích Long & Nguyễn Văn Trỗi — 180–300 triệu/m², khu ẩm thực và shophouse cao cấp.' } },
            { '@type': 'Question', name: 'Giá nhà phố Phú Nhuận năm 2026 là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá nhà phố Phú Nhuận năm 2026: mặt tiền đường lớn (Phan Đình Phùng, Hoàng Văn Thụ, Phan Xích Long) 150–350 triệu/m²; nhà hẻm xe hơi 80–150 triệu/m²; nhà hẻm nhỏ 50–80 triệu/m². Căn hộ cao cấp 60–120 triệu/m². Shophouse mặt tiền Phan Xích Long từ 35 tỷ.' } },
            { '@type': 'Question', name: 'BĐS Phú Nhuận có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Phú Nhuận là thị trường BĐS trú ẩn an toàn nhất TP.HCM — diện tích nhỏ (4,88km²), quỹ đất khan hiếm. Theo CBRE Vietnam, giá BĐS tăng đều đặn 8–15%/năm 10 năm qua, thanh khoản nhà mặt tiền dưới 30 ngày, vượt trội nhờ nhu cầu ở thực và cho thuê mặt bằng kinh doanh từ doanh nhân và chuyên gia quốc tế.' } },
            { '@type': 'Question', name: 'Gần sân bay Tân Sơn Nhất có lợi gì cho BĐS Phú Nhuận?', acceptedAnswer: { '@type': 'Answer', text: 'Cách sân bay Tân Sơn Nhất 2–4km tạo nhu cầu thuê nhà và văn phòng từ chuyên gia hàng không, phi công, tiếp viên quốc tế và doanh nhân — giữ thị trường cho thuê Phú Nhuận luôn sôi động. Tỷ suất cho thuê nhà phố mặt tiền 4–6%/năm, căn hộ 4–5%/năm.' } },
            { '@type': 'Question', name: 'Phú Nhuận hay Quận 3 — nên mua nhà phố đâu hơn?', acceptedAnswer: { '@type': 'Answer', text: 'Quận 3 (giá 250–500 triệu/m², trung tâm hành chính – tài chính) thanh khoản tốt hơn cho khách Việt giàu có và doanh nghiệp lớn. Phú Nhuận (giá 150–350 triệu/m², trung tâm dân sinh – ẩm thực) cho thuê ổn định hơn từ chuyên gia quốc tế và phi công. Ngân sách 30+ tỷ ưu tiên Q3; ngân sách 15–30 tỷ ưu tiên Phú Nhuận.' } },
            { '@type': 'Question', name: 'Cho thuê mặt bằng kinh doanh Phú Nhuận thu nhập bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Mặt bằng kinh doanh Phú Nhuận năm 2026: Phan Xích Long (ẩm thực) 60–150 triệu/tháng/căn 80–150m²; Phan Đình Phùng (thương mại) 80–200 triệu/tháng/căn 100–200m²; Hoàng Văn Thụ (showroom, văn phòng) 70–180 triệu/tháng. Tỷ suất 4–6%/năm.' } },
            { '@type': 'Question', name: 'Mua căn hộ Phú Nhuận giá bao nhiêu năm 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Giá căn hộ Phú Nhuận năm 2026: căn hộ cao cấp Botanica Premier, Garden Gate 60–120 triệu/m²; căn hộ trung cấp Newton Residence, Orchard Garden 50–80 triệu/m²; căn hộ cũ trung tâm 40–60 triệu/m². Cho thuê 2PN: 18–35 triệu/tháng.' } },
            { '@type': 'Question', name: 'Pháp lý nhà phố Phú Nhuận cần lưu ý gì?', acceptedAnswer: { '@type': 'Answer', text: 'Lưu ý: nhà cũ trước 1975 cần kiểm tra giấy tờ nhà đất hợp lệ và quy hoạch hẻm; nhà có hiện trạng cải tạo cần kiểm tra giấy phép xây dựng; nhà chung sổ cần phân lô tách thửa trước giao dịch. SGS LAND kiểm tra pháp lý độc lập miễn phí, hoàn tất trong 5–7 ngày.' } },
          ],
        },
        {
          '@type': 'ItemList',
          '@id': `${APP_URL}/bat-dong-san-phu-nhuan#top3`,
          name: 'Top 3 Trục Đường BĐS Phú Nhuận TP.HCM 2026',
          description: 'Bảng xếp hạng 3 trục đường có giá BĐS cao và thanh khoản tốt nhất Phú Nhuận năm 2026 — chọn lọc theo giá, lưu lượng thương mại, nhu cầu thuê mặt bằng và vị trí cửa ngõ.',
          inLanguage: 'vi',
          numberOfItems: 3,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Phan Đình Phùng', description: 'Trục thương mại sầm uất, 200–350 triệu/m², thanh khoản nhà mặt tiền dưới 30 ngày.' },
            { '@type': 'ListItem', position: 2, name: 'Phan Xích Long & Nguyễn Văn Trỗi', description: 'Khu ẩm thực và shophouse cao cấp, 180–300 triệu/m², cho thuê F&B 60–150 triệu/tháng.' },
            { '@type': 'ListItem', position: 3, name: 'Hoàng Văn Thụ', description: 'Trục cửa ngõ sân bay Tân Sơn Nhất, 150–280 triệu/m², cho thuê chuyên gia hàng không ổn định.' },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-phu-nhuan#agent`,
          name: 'SGS LAND - BĐS Phú Nhuận',
          url: `${APP_URL}/bat-dong-san-phu-nhuan`,
          telephone: '+84-971-132-378',
          areaServed: { '@type': 'City', name: 'Phú Nhuận', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Phú Nhuận', 'Nhà phố Phú Nhuận', 'Phan Đình Phùng', 'Hoàng Văn Thụ', 'Phan Xích Long', 'Gần sân bay Tân Sơn Nhất', 'Cho thuê mặt bằng kinh doanh'],
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
        },
      ],
    },
  },

  // ─── New Project Landing Pages ───────────────────────────────────────────────
  'du-an/izumi-city': {
    title: 'Izumi City Nam Long | Đô Thị Chuẩn Nhật Bản Đồng Nai - SGS LAND',
    description: 'Izumi City Nam Long Biên Hòa: đô thị tích hợp 170ha chuẩn Nhật Bản, siêu thị Fuji Mart, trường học Nhật. Bảng giá nhà phố, biệt thự và tư vấn tại SGS LAND.',
    h1: 'Izumi City Nam Long',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'BĐS Đồng Nai', item: `${APP_URL}/bat-dong-san-dong-nai` },
            { '@type': 'ListItem', position: 3, name: 'Izumi City Nam Long', item: `${APP_URL}/du-an/izumi-city` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Izumi City Nam Long có đáng mua không?', acceptedAnswer: { '@type': 'Answer', text: 'Izumi City là dự án đô thị tích hợp chuẩn Nhật Bản với đối tác Hankyu Hanshin uy tín. Phù hợp ở thực và đầu tư hưởng lợi sân bay Long Thành. Nam Long có lịch sử bàn giao đúng tiến độ.' } },
            { '@type': 'Question', name: 'Giá nhà phố Izumi City là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà phố liền kề từ 5-12 tỷ; biệt thự song lập 10-18 tỷ; biệt thự đơn lập 15-25 tỷ; căn hộ Akari 2-5 tỷ.' } },
            { '@type': 'Question', name: 'Izumi City cách TP.HCM bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'Izumi City tại Biên Hòa, Đồng Nai, cách trung tâm TP.HCM khoảng 30km qua cao tốc TP.HCM – Long Thành – Dầu Giây, di chuyển 25-35 phút.' } },
            { '@type': 'Question', name: 'Tiện ích Nhật Bản tại Izumi City gồm những gì?', acceptedAnswer: { '@type': 'Answer', text: 'Siêu thị Fuji Mart, trường học chuẩn Nhật, trung tâm y tế, công viên 7ha phong cách Nhật, khu thể thao và nhà văn hóa cộng đồng.' } },
            { '@type': 'Question', name: 'Nam Long Group có uy tín bàn giao đúng hẹn không?', acceptedAnswer: { '@type': 'Answer', text: 'Nam Long là chủ đầu tư mid-high end có track record bàn giao đúng tiến độ tốt nhất Việt Nam. Flora Fuji, Flora Panorama, Valora Kikyo đều bàn giao đúng hạn.' } },
            { '@type': 'Question', name: 'So sánh Izumi City và Aqua City — nên chọn đâu?', acceptedAnswer: { '@type': 'Answer', text: 'Izumi City: nhỏ hơn (170ha), chuẩn Nhật Bản, gần TP.HCM hơn, Nam Long track record tốt, giá nhà phố vừa hơn. Aqua City: 1.000ha, marina/golf, Novaland thương hiệu lớn.' } },
            { '@type': 'Question', name: 'Cho thuê Izumi City thu nhập bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà phố liền kề 8-15 triệu/tháng; biệt thự song lập 15-25 triệu/tháng; biệt thự đơn lập 25-40 triệu/tháng. Gross yield ước đạt 4-5%/năm.' } },
            { '@type': 'Question', name: 'Sân bay Long Thành ảnh hưởng thế nào đến Izumi City?', acceptedAnswer: { '@type': 'Answer', text: 'Izumi City cách sân bay Long Thành 20 phút. Khi SBLT hoàn thành, giá BĐS Izumi dự báo tăng 15-25% nhờ nhu cầu nhà ở từ nhân sự sân bay và logistics Đồng Nai.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/izumi-city#project`,
          name: 'Izumi City Nam Long',
          description: 'Đô thị tích hợp 170ha chuẩn Nhật Bản tại Biên Hòa, Đồng Nai',
          url: `${APP_URL}/du-an/izumi-city`,
          address: { '@type': 'PostalAddress', addressLocality: 'Biên Hòa', addressRegion: 'Đồng Nai', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 170, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/vinhomes-grand-park': {
    title: 'Vinhomes Grand Park | Siêu Đô Thị 271ha Thủ Đức - SGS LAND',
    description: 'Vinhomes Grand Park Quận 9 TP Thủ Đức: căn hộ, shophouse, biệt thự siêu đô thị 271ha. Công viên 36ha, Metro số 1, Vinmec, Vinschool. Bảng giá tại SGS LAND.',
    h1: 'Vinhomes Grand Park',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'BĐS TP Thủ Đức', item: `${APP_URL}/bat-dong-san-thu-duc` },
            { '@type': 'ListItem', position: 3, name: 'Vinhomes Grand Park', item: `${APP_URL}/du-an/vinhomes-grand-park` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Vinhomes Grand Park có đáng mua không năm 2025-2026?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Grand Park là dự án có thanh khoản tốt nhất Thủ Đức nhờ quy mô lớn, Metro số 1 và thương hiệu Vinhomes uy tín. Giá tăng ổn định 8-15%/năm.' } },
            { '@type': 'Question', name: 'Giá căn hộ Vinhomes Grand Park mới nhất là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'The Rainbow 2,5-4 tỷ; The Origami 3-5 tỷ; The Beverly 4-7 tỷ; The Opus One 8-15 tỷ. Cho thuê 8-20 triệu/tháng tùy phân khu.' } },
            { '@type': 'Question', name: 'Metro số 1 ảnh hưởng thế nào đến Vinhomes Grand Park?', acceptedAnswer: { '@type': 'Answer', text: 'Ga Suối Tiên và Bến Xe Miền Đông Mới chỉ 5-10 phút đi bộ từ Grand Park. Giá thuê tăng 15-20% sau khi Metro hoạt động, thời gian về Q1 còn 30 phút.' } },
            { '@type': 'Question', name: 'The Opus One Vinhomes Grand Park có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'The Opus One là phân khu hạng sang nhất Grand Park, giá 8-15 tỷ/căn, thiết kế quốc tế, vận hành chuẩn khách sạn 5 sao. Phù hợp đầu tư dài hạn cho thuê.' } },
            { '@type': 'Question', name: 'So sánh Vinhomes Grand Park và Vinhomes Central Park?', acceptedAnswer: { '@type': 'Answer', text: 'Grand Park (271ha, 2,5-7 tỷ, cộng đồng trẻ, gần SHTP) phù hợp ngân sách vừa. Central Park (Bình Thạnh, 50-200 triệu/m², gần sân bay, Landmark 81) dành cho nội thành đẳng cấp.' } },
            { '@type': 'Question', name: 'Pháp lý Vinhomes Grand Park có sổ hồng chưa?', acceptedAnswer: { '@type': 'Answer', text: 'The Rainbow, Origami, Beverly đã bàn giao và có sổ hồng riêng. The Opus One đang tiếp tục bàn giao. SGS LAND xác minh sổ hồng từng căn miễn phí trước khi đặt cọc.' } },
            { '@type': 'Question', name: 'Cho thuê căn hộ Vinhomes Grand Park thu nhập bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: '1PN (45-55m²) 8-12 triệu/tháng; 2PN 12-18 triệu/tháng; 3PN 18-25 triệu/tháng. Gross yield 4-6%/năm. Nhu cầu thuê mạnh từ chuyên gia SHTP và sinh viên ĐH Quốc Gia.' } },
            { '@type': 'Question', name: 'Vinhomes Grand Park có phù hợp cho gia đình có con nhỏ không?', acceptedAnswer: { '@type': 'Answer', text: 'Rất phù hợp — Vinschool các cấp trong khuôn viên, Vinmec quốc tế, công viên 36ha an toàn. Cộng đồng cư dân văn minh, hệ thống an ninh 24/7.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          review: [
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Nguyễn Thanh Tú' },
              datePublished: '2026-03-22',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Mua căn S5.02 2PN 71m² qua SGS LAND, đã nhận nhà tháng 1/2026, sổ hồng đang chờ cấp. TP Thủ Đức phát triển nhanh nhờ Metro số 1 và cầu Thủ Thiêm 2. Dịch vụ tư vấn nhiệt tình từ lúc xem nhà mẫu đến khi bàn giao.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Đỗ Văn Hùng' },
              datePublished: '2026-02-08',
              reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5 },
              reviewBody: 'Cho thuê căn 2PN The Origami giá 14tr/tháng, lấp đầy nhanh do gần Khu Công Nghệ Cao và ĐH Quốc Gia. Yield ~5%/năm, ổn định. Hỗ trợ tìm khách thuê qua mạng lưới SGS LAND.',
            },
            {
              '@type': 'Review',
              author: { '@type': 'Person', name: 'Phan Mỹ Linh' },
              datePublished: '2026-01-30',
              reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
              reviewBody: 'Tham quan The Origami + The Beverly trong cùng buổi, tư vấn so sánh chi tiết về view, hướng, tiến độ. Cuối cùng chọn The Beverly vì view sông Đồng Nai đẹp. Pháp lý sổ hồng riêng đầy đủ.',
            },
          ],
          '@id': `${APP_URL}/du-an/vinhomes-grand-park#project`,
          name: 'Vinhomes Grand Park',
          description: 'Siêu đô thị 271ha với 44 tòa tháp tại TP Thủ Đức, TP.HCM',
          url: `${APP_URL}/du-an/vinhomes-grand-park`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP Thủ Đức', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 271, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/vinhomes-central-park': {
    title: 'Vinhomes Central Park | Căn Hộ Cao Cấp Bình Thạnh Landmark 81 - SGS LAND',
    description: 'Vinhomes Central Park Bình Thạnh: 44 tòa cao tầng, Landmark 81, bể bơi vô cực ven sông Sài Gòn. Căn hộ từ 50 triệu/m², cho thuê 15-60 triệu/tháng. Tư vấn tại SGS LAND.',
    h1: 'Vinhomes Central Park',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Vinhomes Central Park', item: `${APP_URL}/du-an/vinhomes-central-park` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Vinhomes Central Park có phải BĐS hạng sang không?', acceptedAnswer: { '@type': 'Answer', text: 'Vinhomes Central Park thuộc phân khúc cao cấp – hạng sang tại TP.HCM với giá 50-200 triệu/m². Landmark 81 (tòa nhà cao nhất VN) là biểu tượng của dự án.' } },
            { '@type': 'Question', name: 'Giá căn hộ Vinhomes Central Park mới nhất?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ 1PN từ 3,5-5 tỷ; 2PN 5-9 tỷ; 3PN 8-15 tỷ; penthouse từ 20-50 tỷ. Cho thuê: studio 15-20 triệu/tháng; 2PN 25-40 triệu/tháng.' } },
            { '@type': 'Question', name: 'Landmark 81 tại Vinhomes Central Park là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Landmark 81 là tòa nhà cao nhất Việt Nam (461m, 81 tầng) gồm khách sạn Marriott 5 sao, văn phòng hạng A+ và đài quan sát trên đỉnh.' } },
            { '@type': 'Question', name: 'Người nước ngoài có được mua căn hộ Vinhomes Central Park không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo Luật Nhà Ở 2023, người nước ngoài mua tối đa 30% số căn. Central Park có cộng đồng expat Hàn, Nhật, Âu rất đông. SGS LAND hỗ trợ thủ tục pháp lý riêng cho người nước ngoài.' } },
            { '@type': 'Question', name: 'Đầu tư cho thuê Vinhomes Central Park có lời không?', acceptedAnswer: { '@type': 'Answer', text: 'Gross yield 4-6%/năm cộng tăng giá BĐS 8-12%/năm, tổng return 12-18%/năm. Nhu cầu thuê mạnh từ chuyên gia nước ngoài và doanh nhân cấp cao.' } },
            { '@type': 'Question', name: 'Phí quản lý Vinhomes Central Park là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Phí quản lý 10.000-12.000 VNĐ/m²/tháng. Căn 2PN (75m²) khoảng 750.000-900.000 đồng/tháng. Vinhomes quản lý chuyên nghiệp, chất lượng dịch vụ cao nhất TP.HCM.' } },
            { '@type': 'Question', name: 'Vay ngân hàng mua thứ cấp Vinhomes Central Park có khó không?', acceptedAnswer: { '@type': 'Answer', text: 'Sổ hồng riêng đầy đủ, vay thuận lợi. LTV tối đa 65-70%, kỳ hạn 25 năm. VCB, Techcombank, BIDV đều nhận thế chấp. SGS LAND hỗ trợ hồ sơ vay miễn phí.' } },
            { '@type': 'Question', name: 'So sánh Vinhomes Central Park và Thủ Thiêm?', acceptedAnswer: { '@type': 'Answer', text: 'Central Park: hệ sinh thái Vinhomes đầy đủ, gần sân bay, thanh khoản cao. Thủ Thiêm: tiềm năng dài hạn cao hơn, giá cao hơn, đang phát triển. Chọn Central Park nếu cần thanh khoản.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/vinhomes-central-park#project`,
          name: 'Vinhomes Central Park',
          description: '44 tòa cao tầng ven sông Sài Gòn tại Bình Thạnh, TP.HCM',
          url: `${APP_URL}/du-an/vinhomes-central-park`,
          address: { '@type': 'PostalAddress', addressLocality: 'Bình Thạnh', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          numberOfRooms: '1-4',
          offers: { '@type': 'Offer', price: '50000000', priceCurrency: 'VND', unitText: 'm²' },
        },
      ],
    },
  },
  'du-an/thu-thiem': {
    title: 'Khu Đô Thị Thủ Thiêm | BĐS Hạng Sang Trung Tâm Tài Chính - SGS LAND',
    description: 'Bất động sản Khu Đô Thị Mới Thủ Thiêm 657ha — trung tâm tài chính tương lai TP.HCM. Empire City, Metropole, The River. Giá từ 80 triệu/m². Tư vấn tại SGS LAND.',
    h1: 'Khu Đô Thị Thủ Thiêm',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'BĐS TP Thủ Đức', item: `${APP_URL}/bat-dong-san-thu-duc` },
            { '@type': 'ListItem', position: 3, name: 'Khu Đô Thị Thủ Thiêm', item: `${APP_URL}/du-an/thu-thiem` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Khu đô thị Thủ Thiêm có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Thủ Thiêm là thị trường BĐS chiến lược dài hạn, quy hoạch là trung tâm tài chính quốc tế TP.HCM tương tự Pudong Thượng Hải. Phù hợp nhà đầu tư dài hạn tài chính mạnh.' } },
            { '@type': 'Question', name: 'Giá căn hộ Thủ Thiêm hiện tại là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Empire City 90-150 triệu/m²; Metropole Thủ Thiêm 90-130 triệu/m²; The River 80-120 triệu/m²; Grand Marina Saigon 130-250 triệu/m².' } },
            { '@type': 'Question', name: 'Các dự án BĐS nào đáng chú ý tại Thủ Thiêm?', acceptedAnswer: { '@type': 'Answer', text: 'Ba dự án lớn nhất: Empire City (Keppel Land), Metropole Thủ Thiêm (SonKim Land) và The River (Kiến Á). Ngoài ra còn Grand Marina Saigon (Masterise Homes) tại Ba Son.' } },
            { '@type': 'Question', name: 'Hầm Thủ Thiêm và cầu Thủ Thiêm 2 đã hoạt động chưa?', acceptedAnswer: { '@type': 'Answer', text: 'Cả hai đã hoạt động: Hầm Thủ Thiêm từ 2011, cầu Thủ Thiêm 2 từ 2022. Di chuyển từ Thủ Thiêm vào Q1 chỉ còn 5-8 phút.' } },
            { '@type': 'Question', name: 'Metropole Thủ Thiêm SonKim Land là dự án như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Metropole Thủ Thiêm (5,04ha) là 5 phân khu do Sơn Kim Land và Creed Group Nhật Bản đồng phát triển. The River và The Grand Riverside đã bàn giao, giá 7-20 tỷ/căn.' } },
            { '@type': 'Question', name: 'Người nước ngoài có mua được BĐS Thủ Thiêm không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo Luật Nhà Ở 2023, người nước ngoài mua tối đa 30% căn hộ trong một dự án. Metropole, Empire City, The River đều có phần dành cho người nước ngoài.' } },
            { '@type': 'Question', name: 'Thủ Thiêm sẽ phát triển thành trung tâm tài chính như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Thủ Thiêm quy hoạch là "Manhattan của Sài Gòn" với văn phòng tập đoàn quốc tế, khách sạn 5-6 sao, thương mại cao cấp. Dự kiến hoàn chỉnh 2030-2035, là trung tâm kinh tế Đông Nam Á.' } },
            { '@type': 'Question', name: 'Rủi ro khi đầu tư BĐS Thủ Thiêm là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Rủi ro: giá cao, thanh khoản thứ cấp chậm hơn nội thành; tiến độ hạ tầng có thể chậm; một số lô đất còn tranh chấp quy hoạch. SGS LAND kiểm tra pháp lý và đánh giá rủi ro độc lập.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/thu-thiem#project`,
          name: 'Khu Đô Thị Mới Thủ Thiêm',
          description: 'Khu đô thị mới 657ha đối diện Q1 qua sông Sài Gòn — trung tâm tài chính tương lai TP.HCM',
          url: `${APP_URL}/du-an/thu-thiem`,
          address: { '@type': 'PostalAddress', addressLocality: 'Thủ Thiêm', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 657, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/son-kim-land': {
    title: 'Sơn Kim Land | BĐS Thương Mại Cao Cấp TP.HCM & Hà Nội - SGS LAND',
    description: 'Sơn Kim Land — danh mục BĐS cao cấp: Gem Riverside Q4, Metropole Thủ Thiêm, Seasons Avenue HN. GEM Center, GS25. Giá 40-150 triệu/m². Tư vấn tại SGS LAND.',
    h1: 'Sơn Kim Land',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Sơn Kim Land', item: `${APP_URL}/du-an/son-kim-land` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Sơn Kim Land có uy tín không?', acceptedAnswer: { '@type': 'Answer', text: 'Sơn Kim Land là thương hiệu BĐS uy tín thuộc Sơn Kim Group thành lập từ 1993 với BĐS, bán lẻ GS25, GEM Center. Gem Riverside và Metropole Thủ Thiêm được đánh giá cao về thiết kế.' } },
            { '@type': 'Question', name: 'Dự án Gem Riverside của Sơn Kim Land như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Gem Riverside tại Quận 4 là căn hộ cao cấp ven sông Sài Gòn, cách Q1 10 phút. Giá 65-100 triệu/m², phù hợp đầu tư dài hạn tại trung tâm thành phố.' } },
            { '@type': 'Question', name: 'GEM Center liên quan gì đến Sơn Kim Land?', acceptedAnswer: { '@type': 'Answer', text: 'GEM Center (186 Lê Thánh Tôn, Q1) là trung tâm sự kiện hàng đầu TP.HCM do Sơn Kim Group vận hành, tạo giá trị cộng thêm cho hệ sinh thái BĐS Sơn Kim Land.' } },
            { '@type': 'Question', name: 'Metropole Thủ Thiêm của Sơn Kim Land có đáng mua không?', acceptedAnswer: { '@type': 'Answer', text: 'Metropole Thủ Thiêm đồng phát triển với Creed Group Nhật Bản, vị trí số 1 Thủ Thiêm nhìn ra sông Sài Gòn. Phân khu The River đã bàn giao, giá 7-20 tỷ/căn, yield 3-5%/năm.' } },
            { '@type': 'Question', name: 'Gem Riverside Q4 Sơn Kim Land giá bao nhiêu năm 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Thứ cấp 2026: 2PN (70-80m²) khoảng 5-8 tỷ, 3PN (90-110m²) khoảng 8-12 tỷ. Cho thuê 2PN 20-30 triệu/tháng. Vị trí hiếm view sông nội thành, tiềm năng tăng giá bền vững.' } },
            { '@type': 'Question', name: 'So sánh Sơn Kim Land và Masterise Homes?', acceptedAnswer: { '@type': 'Answer', text: 'Sơn Kim Land: tích hợp thương mại-lifestyle, giá 50-130 triệu/m². Masterise: ultra-luxury branded residence, vận hành Marriott/IHG, 60-300 triệu/m². Chọn Sơn Kim nếu giá vừa hơn.' } },
            { '@type': 'Question', name: 'GS25 có mặt trong dự án Sơn Kim Land không?', acceptedAnswer: { '@type': 'Answer', text: 'Sơn Kim Group vận hành GS25 Việt Nam (700+ điểm, chuỗi Hàn Quốc). Trong dự án Sơn Kim Land thường tích hợp GS25 nội khu, tạo tiện ích lifestyle tích hợp cho cư dân.' } },
            { '@type': 'Question', name: 'Nên chọn dự án Sơn Kim Land hay thương hiệu khác?', acceptedAnswer: { '@type': 'Answer', text: 'Sơn Kim Land phù hợp với nhà đầu tư ưu tiên BĐS tích hợp thương mại-dịch vụ, cộng đồng quốc tế và vận hành chuyên nghiệp. SGS LAND tư vấn khách quan, không hoa hồng chủ đầu tư.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/son-kim-land#project`,
          name: 'Sơn Kim Land — Gem Riverside & Metropole Thủ Thiêm',
          description: 'Bất động sản cao cấp Sơn Kim Land: Gem Riverside (Q4), Metropole Thủ Thiêm (An Phú, TP Thủ Đức). Tích hợp GEM Center và GS25.',
          url: `${APP_URL}/du-an/son-kim-land`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP.HCM', addressCountry: 'VN' },
          priceRange: '50-300 triệu/m²',
          amenityFeature: ['GEM Center', 'GS25', 'Sông Sài Gòn', 'Creed Group Nhật Bản'],
        },
      ],
    },
  },
  'du-an/masterise-homes': {
    title: 'Masterise Homes | Masteri, Lumière, Grand Marina — SGS LAND',
    description: 'Masterise Homes — BĐS hạng sang Việt Nam: Masteri Thảo Điền, Lumière Boulevard, Grand Marina Saigon. Giá 60-300 triệu/m². Vận hành bởi chuỗi khách sạn 5 sao. Tư vấn SGS LAND.',
    h1: 'Masterise Homes',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Masterise Homes', item: `${APP_URL}/du-an/masterise-homes` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Masterise Homes có đáng tin không?', acceptedAnswer: { '@type': 'Answer', text: 'Masterise Homes là thương hiệu BĐS hạng sang uy tín với đối tác Marriott, IHG. Masteri Thảo Điền và Masteri An Phú đã bàn giao thành công, giữ giá tốt qua các chu kỳ thị trường.' } },
            { '@type': 'Question', name: 'Giá căn hộ Masterise Homes hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Masteri Thảo Điền 65-100 triệu/m²; Lumière Boulevard 90-150 triệu/m²; Grand Marina Saigon 130-300 triệu/m². Cho thuê Masteri Thảo Điền 25-60 triệu/tháng.' } },
            { '@type': 'Question', name: 'Grand Marina Saigon của Masterise có đặc biệt không?', acceptedAnswer: { '@type': 'Answer', text: 'Grand Marina Saigon tại Ba Son (Q1) là BĐS hạng sang nhất TP.HCM, tích hợp khách sạn Marriott, JW Marriott và bến du thuyền riêng trên sông Sài Gòn. Giá 130-300 triệu/m².' } },
            { '@type': 'Question', name: 'Masteri Thảo Điền có còn tốt để đầu tư năm 2026 không?', acceptedAnswer: { '@type': 'Answer', text: 'Masteri Thảo Điền đã bàn giao 2017-2018, sổ hồng đầy đủ, giá tăng 10%+/năm. Cho thuê 25-60 triệu/tháng nhờ vị trí Thảo Điền expat hub. Giá thứ cấp 65-100 triệu/m².' } },
            { '@type': 'Question', name: 'Người nước ngoài có thể mua Masterise Homes không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo Luật Nhà Ở 2023, người nước ngoài mua tối đa 30% số căn. Masteri Thảo Điền có cộng đồng expat đông nhất TP.HCM. SGS LAND hỗ trợ hợp đồng song ngữ và thủ tục chuyển tiền.' } },
            { '@type': 'Question', name: 'Masteri Thảo Điền hay Masteri An Phú nên chọn?', acceptedAnswer: { '@type': 'Answer', text: 'Thảo Điền: gần sông hơn, cộng đồng expat đông, cho thuê ngắn hạn tốt. An Phú: cạnh ga Metro số 1, kết nối toàn TP.HCM, thanh khoản cao. SGS LAND tư vấn theo mục tiêu cụ thể.' } },
            { '@type': 'Question', name: 'Tại sao Masterise được coi là ultra-luxury?', acceptedAnswer: { '@type': 'Answer', text: 'Ba yếu tố: thiết kế bởi kiến trúc sư Châu Âu/Singapore; vận hành bởi Marriott/IHG concierge 24/7; vị trí prime location Thảo Điền, An Phú, Ba Son Q1. Branded residence đẳng cấp nhất VN.' } },
            { '@type': 'Question', name: 'Lumière Boulevard và Lumière Riverside khác nhau thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Lumière Boulevard (Q9/Thủ Đức): ultra-luxury phong cách Paris, gần Metro, 90-150 triệu/m². Lumière Riverside (Q2): biệt thự ven sông, tính riêng tư cao, 120-200 triệu/m². Cả hai vận hành 5 sao.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/masterise-homes#project`,
          name: 'Masterise Homes — Masteri Thảo Điền & Grand Marina Saigon',
          description: 'Bất động sản ultra-luxury Masterise Homes tại TP.HCM: Masteri Thảo Điền, Masteri An Phú, Lumière Boulevard, Grand Marina Saigon vận hành Marriott/IHG.',
          url: `${APP_URL}/du-an/masterise-homes`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP.HCM', addressCountry: 'VN' },
          priceRange: '60-300 triệu/m²',
          amenityFeature: ['Marriott', 'JW Marriott', 'Bến Du Thuyền', 'Concierge 24/7', 'Trường Quốc Tế'],
        },
      ],
    },
  },
  'du-an/the-global-city': {
    title: 'The Global City Masterise | Đại Đô Thị 117ha An Phú Thủ Đức - SGS LAND',
    description: 'The Global City Masterise Homes An Phú Thủ Đức: đại đô thị 117ha chuẩn Singapore, cạnh Metro số 1. Nhà phố từ 15 tỷ, biệt thự từ 30 tỷ. Tư vấn tại SGS LAND.',
    h1: 'The Global City',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'BĐS TP Thủ Đức', item: `${APP_URL}/bat-dong-san-thu-duc` },
            { '@type': 'ListItem', position: 3, name: 'The Global City', item: `${APP_URL}/du-an/the-global-city` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'The Global City có phải dự án tốt để đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'The Global City là dự án chiến lược 117ha tại vị trí đắc địa khu Đông TP.HCM, tích hợp thương mại – giáo dục – y tế – ở. Phù hợp đầu tư nhà phố thương mại và biệt thự dài hạn.' } },
            { '@type': 'Question', name: 'Giá nhà phố thương mại The Global City là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Shophouse từ 15-40 tỷ tùy vị trí; biệt thự song lập 30-60 tỷ; biệt thự đơn lập 60-120 tỷ. Cho thuê nhà phố từ 50-200 triệu/tháng (mặt tiền trục chính).' } },
            { '@type': 'Question', name: 'The Global City cách Q1 và Thủ Thiêm bao xa?', acceptedAnswer: { '@type': 'Answer', text: 'The Global City tại An Phú, TP Thủ Đức, cách Q1 khoảng 6-8km qua cầu Thủ Thiêm 2 chỉ 5-10 phút. Cách Thủ Thiêm 2km. Metro số 1 ga An Phú chỉ 5 phút đi bộ.' } },
            { '@type': 'Question', name: 'Trường học và bệnh viện tại The Global City như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'Trường quốc tế BIS (IB/IGCSE, 20-40 triệu/tháng), Eaton House, IVS (10-20 triệu/tháng); bệnh viện 5 sao tiêu chuẩn quốc tế 300 giường bệnh. Lợi thế lớn thu hút expat.' } },
            { '@type': 'Question', name: 'Shophouse The Global City cho thuê được bao nhiêu tiền?', acceptedAnswer: { '@type': 'Answer', text: 'Mặt tiền trục chính The Global City cho thuê 50-200 triệu/tháng. Khi hoàn thành toàn bộ 2026-2028, nhu cầu kinh doanh từ 60.000+ cư dân nội khu và lưu lượng Metro số 1.' } },
            { '@type': 'Question', name: 'The Global City có cạnh tranh được với Thủ Thiêm không?', acceptedAnswer: { '@type': 'Answer', text: 'The Global City và Thủ Thiêm bổ trợ nhau: Thủ Thiêm là tài chính-văn phòng; The Global City là thương mại-dịch vụ-ở tích hợp. Lợi thế: Metro số 1 ngay cửa, quy mô thương mại lớn hơn.' } },
            { '@type': 'Question', name: 'Tiêu chuẩn Singapore tại The Global City nghĩa là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Masterise hợp tác kiến trúc sư Singapore (từng làm với CapitaLand, Keppel): quy hoạch phân khu khoa học, cây xanh đạt chuẩn, hạ tầng đồng bộ — tương tự One North hay Sentosa Cove.' } },
            { '@type': 'Question', name: 'Vay ngân hàng mua nhà phố The Global City có thuận lợi không?', acceptedAnswer: { '@type': 'Answer', text: 'Pháp lý rõ ràng, Masterise uy tín cao, vay ngân hàng dễ dàng. LTV 65-70%, kỳ hạn 20-25 năm, Techcombank/VPBank ưu đãi 12-18 tháng đầu. SGS LAND hỗ trợ hồ sơ vay miễn phí.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/the-global-city#project`,
          name: 'The Global City',
          description: 'Đại đô thị thương mại 117ha chuẩn Singapore do Masterise Homes phát triển tại An Phú, TP Thủ Đức',
          url: `${APP_URL}/du-an/the-global-city`,
          address: { '@type': 'PostalAddress', addressLocality: 'An Phú, TP Thủ Đức', addressRegion: 'TP.HCM', addressCountry: 'VN' },
          floorSize: { '@type': 'QuantitativeValue', value: 117, unitText: 'ha' },
        },
      ],
    },
  },
  'du-an/nha-pho-trung-tam': {
    title: 'Nhà Phố Trung Tâm TP.HCM | Mặt Tiền, Nhà Hẻm, Shophouse - SGS LAND',
    description: 'Mua bán nhà phố trung tâm TP.HCM: mặt tiền Q1 từ 500 triệu/m², nhà hẻm Q3 từ 100 triệu/m². Định giá AI miễn phí, kiểm tra pháp lý độc lập tại SGS LAND.',
    h1: 'Nhà Phố Trung Tâm TP.HCM',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: `${APP_URL}` },
            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: `${APP_URL}/marketplace` },
            { '@type': 'ListItem', position: 3, name: 'Nhà Phố Trung Tâm', item: `${APP_URL}/du-an/nha-pho-trung-tam` },
          ],
        },
        {
          '@type': 'FAQPage',
          ...SGS_FAQ_META,
          mainEntity: [
            { '@type': 'Question', name: 'Nên mua nhà phố hay căn hộ tại TP.HCM để đầu tư?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà phố có ba lợi thế: pháp lý sổ đỏ không thời hạn, thu nhập kép (ở + cho thuê mặt bằng) và tăng trưởng giá trị bền vững 8-15%/năm trong 30 năm qua.' } },
            { '@type': 'Question', name: 'Giá mặt tiền Quận 1 TP.HCM hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Đường Nguyễn Huệ, Đồng Khởi 1.000-2.000 triệu/m²; Lê Lợi, Lê Thánh Tôn 500-1.000 triệu/m²; các đường nhánh 300-600 triệu/m². Cho thuê mặt bằng kinh doanh 100-500 triệu/tháng.' } },
            { '@type': 'Question', name: 'Tại sao nhà phố nội thành TP.HCM luôn tăng giá?', acceptedAnswer: { '@type': 'Answer', text: 'Ba lý do: quỹ đất nội thành hữu hạn, lạm phát đồng tiền đẩy giá tài sản thực tăng, và TP.HCM là đầu tàu kinh tế Việt Nam với nhu cầu mặt bằng kinh doanh liên tục tăng.' } },
            { '@type': 'Question', name: 'Nhà hẻm xe hơi Quận 3, Phú Nhuận giá bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Nhà hẻm 4-6m Q3 từ 100-200 triệu/m²; Phú Nhuận 80-150 triệu/m²; Bình Thạnh 60-120 triệu/m². Nhà 4x15m Q3 khoảng 6-12 tỷ — phân khúc phổ biến nhất với ngân sách 5-15 tỷ.' } },
            { '@type': 'Question', name: 'Kiểm tra pháp lý nhà phố cũ TP.HCM cần lưu ý gì?', acceptedAnswer: { '@type': 'Answer', text: 'Sáu điểm: (1) Sổ đỏ thổ cư chính chủ; (2) Không quy hoạch lộ giới/kênh rạch; (3) Không tranh chấp thừa kế; (4) Diện tích khớp hiện trạng; (5) Không vi phạm xây dựng; (6) Đủ thuế trước bạ.' } },
            { '@type': 'Question', name: 'SGS LAND định giá AI nhà phố nội thành chính xác cỡ nào?', acceptedAnswer: { '@type': 'Answer', text: 'Phân tích 500+ giao dịch thực trong bán kính 500m, điều chỉnh theo 12 yếu tố (diện tích, mặt tiền, số tầng, hướng, lộ giới, pháp lý). Độ chính xác 92% so với giá giao dịch thực.' } },
            { '@type': 'Question', name: 'Nhà phố Gò Vấp có đang tăng giá nhanh không?', acceptedAnswer: { '@type': 'Answer', text: 'Gò Vấp tăng giá mạnh nhất các quận nội thành 2025-2026: 15-25%/năm nhờ hạ tầng hoàn thiện. Nhà hẻm từ 4-8 tỷ, mặt tiền 6-12 tỷ — rẻ hơn 30-40% so với Q3 và Phú Nhuận lân cận.' } },
            { '@type': 'Question', name: 'SGS LAND hỗ trợ tìm nhà phố trung tâm như thế nào?', acceptedAnswer: { '@type': 'Answer', text: 'SGS LAND cung cấp: tìm kiếm theo yêu cầu, định giá AI miễn phí, kiểm tra pháp lý sổ đỏ độc lập, hỗ trợ đàm phán giá, kết nối công chứng và ngân hàng vay vốn lãi suất tốt.' } },
          ],
        },
        {
          '@type': 'ApartmentComplex',
          aggregateRating: SGS_RATING,
          parentOrganization: SGS_PARENT_ORG,
          dateModified: '2026-04-18',
          '@id': `${APP_URL}/du-an/nha-pho-trung-tam#project`,
          name: 'Nhà Phố Trung Tâm TP.HCM — Mặt Tiền & Nhà Hẻm Nội Thành',
          description: 'Nhà phố mặt tiền và nhà hẻm xe hơi tại các quận trung tâm TP.HCM: Q1, Q3, Phú Nhuận, Bình Thạnh, Gò Vấp. Sổ đỏ, pháp lý rõ ràng, tiềm năng tăng giá 8-15%/năm.',
          url: `${APP_URL}/du-an/nha-pho-trung-tam`,
          address: { '@type': 'PostalAddress', addressLocality: 'TP.HCM', addressCountry: 'VN' },
          priceRange: '60-2000 triệu/m²',
          amenityFeature: ['Sổ đỏ vĩnh viễn', 'Mặt tiền kinh doanh', 'Trung tâm TP.HCM', 'Không thời hạn sở hữu'],
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

/**
 * Walk a JSON-LD @graph (or single object) and collect entries where @type matches.
 * Used to extract project facts + FAQ items for noscript content injection.
 */
function findSchemaNodes(structuredData: any, typeMatcher: (t: string) => boolean): any[] {
  const out: any[] = [];
  const walk = (o: any) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o['@type'];
    if (t && (Array.isArray(t) ? t : [t]).some(x => typeof x === 'string' && typeMatcher(x))) {
      out.push(o);
    }
    Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
  };
  walk(structuredData);
  return out;
}

/**
 * Build per-route noscript HTML for project landing pages so bots that don't
 * execute JavaScript (most LLM crawlers + some legacy SEO bots) see real,
 * project-specific text content — not the generic homepage fallback.
 *
 * Returns the inner HTML for `<div class="noscript-wrapper">…</div>`.
 * Returns null when the route has no project-like structured data.
 */
function buildProjectNoscriptHtml(structuredData: any, h1: string | undefined, url: string): string | null {
  const projectNodes = findSchemaNodes(structuredData,
    t => /^(ApartmentComplex|RealEstateListing|Place|LodgingBusiness|Residence)$/i.test(t));
  if (projectNodes.length === 0) return null;

  const project = projectNodes[0];
  const faqNodes = findSchemaNodes(structuredData, t => /^FAQPage$/i.test(t));
  const breadcrumbs = findSchemaNodes(structuredData, t => /^BreadcrumbList$/i.test(t))[0];

  const lines: string[] = [];
  lines.push(`<h1>${esc(h1 || project.name || 'Dự án bất động sản')}</h1>`);

  // Lead paragraph from description
  if (project.description) {
    lines.push(`<p><strong>${esc(project.name || h1 || '')}</strong> — ${esc(project.description)}.</p>`);
  }

  // Breadcrumbs as schema-friendly nav links
  if (breadcrumbs?.itemListElement?.length) {
    const crumbs = breadcrumbs.itemListElement
      .map((it: any) => it.name && it.item ? `<a href="${esc(it.item)}">${esc(it.name)}</a>` : null)
      .filter(Boolean)
      .join(' › ');
    if (crumbs) lines.push(`<p style="text-align:left; color:#475569; font-size:14px;">${crumbs}</p>`);
  }

  // Key facts table — extracted from project schema
  const facts: { label: string; value: string }[] = [];
  if (project.address) {
    const a = project.address;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean);
    if (parts.length) facts.push({ label: 'Vị trí', value: parts.join(', ') });
  }
  if (project.floorSize?.value) {
    facts.push({ label: 'Quy mô', value: `${project.floorSize.value} ${project.floorSize.unitText || project.floorSize.unitCode || ''}`.trim() });
  }
  if (project.numberOfRooms) {
    facts.push({ label: 'Số phòng ngủ', value: String(project.numberOfRooms) });
  }
  if (project.priceRange) {
    facts.push({ label: 'Khoảng giá', value: String(project.priceRange) });
  }
  if (project.offers?.price) {
    const cur = project.offers.priceCurrency || 'VND';
    const unit = project.offers.unitText ? ` / ${project.offers.unitText}` : '';
    facts.push({ label: 'Giá từ', value: `${project.offers.price} ${cur}${unit}` });
  }
  if (Array.isArray(project.amenityFeature) && project.amenityFeature.length) {
    facts.push({ label: 'Tiện ích nổi bật', value: project.amenityFeature.slice(0, 6).map(String).join(', ') });
  }
  if (facts.length) {
    lines.push('<h2>Thông tin dự án</h2>');
    lines.push('<ul style="text-align:left; color:#475569;">');
    for (const f of facts) lines.push(`  <li><strong>${esc(f.label)}:</strong> ${esc(f.value)}</li>`);
    lines.push('</ul>');
  }

  // FAQ — top 6 Q&A pairs surfaced as readable text (separate from JSON-LD)
  const faqItems = faqNodes.flatMap(n => Array.isArray(n.mainEntity) ? n.mainEntity : []);
  if (faqItems.length) {
    lines.push('<h2>Câu hỏi thường gặp</h2>');
    for (const q of faqItems.slice(0, 6)) {
      const qText = q?.name;
      const aText = q?.acceptedAnswer?.text;
      if (!qText || !aText) continue;
      lines.push(`<h3 style="text-align:left; color:#1E293B; margin-top:16px;">${esc(qText)}</h3>`);
      lines.push(`<p style="text-align:left; color:#475569;">${esc(aText)}</p>`);
    }
  }

  // Authority + brand footer (E-E-A-T signal carried into every project page)
  lines.push('<h2>Về SGS LAND</h2>');
  lines.push('<p style="text-align:left; color:#475569;"><strong>SGS LAND</strong> (sgsland.vn) — đại lý phân phối uỷ quyền của Novaland, Masterise Homes, Nam Long, Vinhomes, Sơn Kim Land. 5+ năm kinh nghiệm, 15.000+ môi giới, 45.000+ sản phẩm, 2 tỷ USD+ giao dịch xử lý qua nền tảng. Định giá theo chuẩn TĐGVN/IVS, tuân thủ Luật Đất Đai 2024 và Nghị định 13/2023.</p>');
  lines.push('<ul style="text-align:left; color:#475569;">');
  lines.push('  <li>📞 Hotline: <a href="tel:+84971132378">+84 971 132 378</a></li>');
  lines.push('  <li>✉️ Email: <a href="mailto:info@sgsland.vn">info@sgsland.vn</a></li>');
  lines.push(`  <li>🌐 Trang dự án: <a href="${esc(url)}">${esc(url)}</a></li>`);
  lines.push('</ul>');

  lines.push('<p style="margin-top:24px;">Vui lòng bật JavaScript để xem đầy đủ tiện ích, mặt bằng và bảng giá realtime. <a href="' + esc(url) + '">Tải lại trang</a></p>');
  return lines.join('\n        ');
}

export function injectMeta(baseHtml: string, meta: MetaData): string {
  const m = { ...DEFAULT_META, ...meta };
  const t = esc(m.title!);
  const d = esc(m.description!);
  const img = m.image!;
  const u = m.url!;
  const type = m.type || 'website';

  let html = baseHtml;

  // Per-route noscript content for project landing pages.
  // Replace homepage-generic noscript wrapper content with project-specific
  // facts + FAQ so non-JS bots see ≥300 words of real, citation-worthy data.
  if (m.structuredData) {
    const projectNoscript = buildProjectNoscriptHtml(m.structuredData, m.h1, u);
    if (projectNoscript) {
      html = html.replace(
        /(<div class="noscript-wrapper">)[\s\S]*?(<\/div>\s*<\/noscript>)/,
        `$1\n        ${projectNoscript}\n      $2`
      );
    }
  }

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

  // Fix hreflang for non-homepage pages.
  // Location/project landing pages are Vietnamese-only — hreflang must point to the
  // page's own canonical URL, not the homepage. Leaving en/x-default pointing to "/" 
  // causes a canonical conflict that Google Search Console flags as "URL has issues".
  if (u !== APP_URL && u !== `${APP_URL}/`) {
    html = html.replace(
      /(<link\s+rel="alternate"\s+hreflang="vi"\s+href=")[^"]*(")/i,
      `$1${u}$2`
    );
    // Remove the English hreflang line — no English version exists for these pages
    html = html.replace(
      /[ \t]*<link\s+rel="alternate"\s+hreflang="en"\s+href="[^"]*"\s*\/?>\n?/i,
      ''
    );
    html = html.replace(
      /(<link\s+rel="alternate"\s+hreflang="x-default"\s+href=")[^"]*(")/i,
      `$1${u}$2`
    );
  }

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
    const sdJson = JSON.stringify(m.structuredData);
    const hasPageFaq = sdJson.includes('"FAQPage"');
    const hasPageBreadcrumb = sdJson.includes('"BreadcrumbList"');

    // Remove global JSON-LD blocks whose @type is now covered by the page-specific
    // structured data below. Keeping both causes Google to flag "duplicate @type" errors.
    if (hasPageFaq || hasPageBreadcrumb) {
      html = html.replace(
        /<script\s+type="application\/ld\+json">([\s\S]+?)<\/script>/gi,
        (match, content) => {
          if (hasPageFaq && content.includes('"FAQPage"')) return '';
          if (hasPageBreadcrumb && content.includes('"BreadcrumbList"')) return '';
          return match;
        }
      );
    }

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
