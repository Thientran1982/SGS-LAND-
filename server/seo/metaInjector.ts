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
  '': {
    title: DEFAULT_META.title,
    description: DEFAULT_META.description,
    h1: 'SGS LAND - Nền Tảng Quản Lý Bất Động Sản AI',
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
          description: 'Nền tảng công nghệ bất động sản AI hàng đầu Việt Nam, chuyên tư vấn và giao dịch bất động sản TP.HCM, Đồng Nai, Bình Dương.',
          contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: ['Vietnamese', 'English'], url: `${APP_URL}/contact` },
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Long An', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Bất động sản', 'Định giá AI', 'CRM bất động sản', 'Aqua City', 'Vinhomes Grand Park', 'Vinhomes Central Park', 'Masterise Homes', 'Sơn Kim Land', 'The Global City', 'Thủ Thiêm', 'Đồng Nai', 'Long Thành', 'TP.HCM', 'Bình Dương', 'Quận 7', 'Thủ Đức'],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/#agent`,
          name: 'SGS LAND - Nền Tảng BĐS AI Số 1 Việt Nam',
          url: APP_URL,
          description: 'Định giá bất động sản AI, mua bán BĐS, CRM đa kênh tại Việt Nam.',
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Aqua City Novaland', 'Izumi City', 'Vinhomes Grand Park', 'Vinhomes Central Park', 'The Global City', 'Masterise Homes', 'Thủ Thiêm', 'BĐS Long Thành', 'BĐS Đồng Nai', 'BĐS Bình Dương', 'BĐS Quận 7', 'BĐS Phú Nhuận', 'BĐS TP Thủ Đức'],
        },
        {
          '@type': 'WebSite',
          '@id': `${APP_URL}/#website`,
          url: APP_URL,
          name: 'SGS LAND',
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/marketplace?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
        },
      ],
    },
  },
  home: {
    title: DEFAULT_META.title,
    description: DEFAULT_META.description,
    h1: 'SGS LAND - Nền Tảng Quản Lý Bất Động Sản AI',
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
          description: 'Nền tảng công nghệ bất động sản AI hàng đầu Việt Nam, chuyên tư vấn và giao dịch bất động sản TP.HCM, Đồng Nai, Bình Dương.',
          contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: ['Vietnamese', 'English'], url: `${APP_URL}/contact` },
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Long An', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Bất động sản', 'Định giá AI', 'CRM bất động sản', 'Aqua City', 'Vinhomes Grand Park', 'Vinhomes Central Park', 'Masterise Homes', 'Sơn Kim Land', 'The Global City', 'Thủ Thiêm', 'Đồng Nai', 'Long Thành', 'TP.HCM', 'Bình Dương', 'Quận 7', 'Thủ Đức'],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/#agent`,
          name: 'SGS LAND - Nền Tảng BĐS AI Số 1 Việt Nam',
          url: APP_URL,
          description: 'Định giá bất động sản AI, mua bán BĐS, CRM đa kênh tại Việt Nam.',
          areaServed: [
            { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Đồng Nai', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
            { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          ],
          knowsAbout: ['Aqua City Novaland', 'Izumi City', 'Vinhomes Grand Park', 'Vinhomes Central Park', 'The Global City', 'Masterise Homes', 'Thủ Thiêm', 'BĐS Long Thành', 'BĐS Đồng Nai', 'BĐS Bình Dương', 'BĐS Quận 7', 'BĐS Phú Nhuận', 'BĐS TP Thủ Đức'],
        },
        {
          '@type': 'WebSite',
          '@id': `${APP_URL}/#website`,
          url: APP_URL,
          name: 'SGS LAND',
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/marketplace?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
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
  'ky-gui-bat-dong-san':   { title: 'Ký Gửi Bất Động Sản | Bán Nhanh, Giá Tốt - SGS LAND', description: 'Ký gửi bất động sản tại SGS LAND — đội ngũ chuyên gia định giá miễn phí, tiếp cận hàng nghìn khách hàng tiềm năng và hỗ trợ pháp lý toàn diện.', h1: 'Ký Gửi Bất Động Sản' },
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
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản Đồng Nai có nên đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Đồng Nai là một trong những thị trường BĐS tiềm năng nhất miền Nam nhờ ba động lực chính: sân bay Long Thành (hoàn thành 2026), các tuyến cao tốc kết nối TP.HCM và làn sóng di dời khu công nghiệp. Giá đất nhiều khu vực tăng 15-25%/năm.' } },
            { '@type': 'Question', name: 'Giá đất Đồng Nai hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 15-50 triệu/m².' } },
            { '@type': 'Question', name: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?', acceptedAnswer: { '@type': 'Answer', text: 'Sân bay quốc tế Long Thành có công suất 25 triệu hành khách/giai đoạn 1. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.' } },
            { '@type': 'Question', name: 'Những dự án BĐS nào nổi bật tại Đồng Nai?', acceptedAnswer: { '@type': 'Answer', text: 'Các dự án lớn: Aqua City (Novaland, 1.000ha tại Nhơn Trạch), Izumi City (Nam Long, 170ha tại Biên Hòa), Gem Sky World (Long Thành), HUD Nhơn Trạch. SGS LAND cung cấp thông tin và tư vấn tất cả dự án.' } },
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
            { '@type': 'Question', name: 'Pháp lý Aqua City có an toàn không?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City được cấp sổ hồng riêng cho từng căn. Sau tái cơ cấu tài chính, Novaland đã hoàn thành nghĩa vụ pháp lý và tiếp tục bàn giao nhiều phân khu. SGS LAND kiểm tra pháp lý miễn phí.' } },
            { '@type': 'Question', name: 'Aqua City đã có sổ hồng riêng chưa?', acceptedAnswer: { '@type': 'Answer', text: 'Một số phân khu Aqua City đã được cấp sổ hồng riêng từng căn. Tình trạng pháp lý từng phân khu khác nhau — SGS LAND hỗ trợ xác minh sổ hồng cụ thể trước khi đặt cọc.' } },
            { '@type': 'Question', name: 'Novaland có còn tài chính ổn định sau tái cơ cấu?', acceptedAnswer: { '@type': 'Answer', text: 'Novaland hoàn thành tái cơ cấu tài chính năm 2024, đạt thoả thuận với trái chủ quốc tế và tiếp tục bàn giao Aqua City. Vẫn là chủ đầu tư BĐS tư nhân lớn nhất Việt Nam với quỹ đất 10.600ha+.' } },
            { '@type': 'Question', name: 'So sánh Aqua City và Izumi City — nên chọn đâu?', acceptedAnswer: { '@type': 'Answer', text: 'Aqua City: quy mô lớn hơn (1.000ha), tiện ích golf/marina, giá biệt thự cao hơn. Izumi City: chuẩn Nhật Bản, Fuji Mart, Nam Long track record bàn giao tốt, giá nhà phố thấp hơn, gần TP.HCM hơn.' } },
            { '@type': 'Question', name: 'Cho thuê Aqua City được bao nhiêu tiền?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ 1PN: 4-7 triệu/tháng; nhà phố liền kề: 8-15 triệu/tháng; biệt thự đơn lập: 30-60 triệu/tháng. Tỷ suất cho thuê biệt thự cao cấp ước đạt 4-6%/năm.' } },
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

  // ─── New Location Landing Pages ─────────────────────────────────────────────
  'bat-dong-san-thu-duc': {
    title: 'Bất Động Sản TP Thủ Đức | Căn Hộ, Đất Nền — SGS LAND',
    description: 'Mua bán bất động sản TP Thủ Đức: Vinhomes, Masterise, The Global City. Giá thị trường cập nhật, tư vấn chuyên nghiệp tại SGS LAND.',
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
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản TP Thủ Đức có nên đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'TP Thủ Đức là khu vực có tiềm năng tăng trưởng BĐS cao nhất TP.HCM nhờ Metro số 1, Khu Đô Thị Thủ Thiêm và Khu Công Nghệ Cao SHTP. Giá căn hộ tăng 10-18%/năm.' } },
            { '@type': 'Question', name: 'Giá căn hộ TP Thủ Đức hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Thủ Thiêm (Q2 cũ) 80-250 triệu/m²; khu vực Metro số 1 (Q9 cũ) 45-90 triệu/m²; Thủ Đức 35-65 triệu/m².' } },
            { '@type': 'Question', name: 'Metro số 1 ảnh hưởng thế nào đến BĐS Thủ Đức?', acceptedAnswer: { '@type': 'Answer', text: 'BĐS trong bán kính 500m quanh các ga Metro số 1 tăng giá 20-40% sau khi Metro vận hành. Nhà cho thuê gần ga Metro đạt tỷ suất 6-9%/năm.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-thu-duc#agent`,
          name: 'SGS LAND - BĐS TP Thủ Đức',
          url: `${APP_URL}/bat-dong-san-thu-duc`,
          areaServed: { '@type': 'City', name: 'TP Thủ Đức', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Thủ Đức', 'Thủ Thiêm', 'Vinhomes Grand Park', 'The Global City', 'Metro số 1', 'SHTP'],
        },
      ],
    },
  },
  'bat-dong-san-binh-duong': {
    title: 'Bất Động Sản Bình Dương | Nhà Phố, Đất Nền — SGS LAND',
    description: 'Mua bán nhà đất Bình Dương: Thuận An, Dĩ An, Thủ Dầu Một. Pháp lý an toàn, định giá AI chính xác. Liên hệ SGS LAND ngay.',
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
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản Bình Dương có tiềm năng không?', acceptedAnswer: { '@type': 'Answer', text: 'Bình Dương là tỉnh có tốc độ đô thị hóa nhanh nhất cả nước với hơn 30 KCN đang hoạt động. Giá BĐS tăng 8-15%/năm trong 5 năm gần đây.' } },
            { '@type': 'Question', name: 'Mua căn hộ Bình Dương để cho thuê có lời không?', acceptedAnswer: { '@type': 'Answer', text: 'Căn hộ cao cấp tại Bình Dương cho thuê 10-25 triệu/tháng. Tỷ suất cho thuê bruto đạt 5-8%/năm, vượt lãi suất gửi tiết kiệm ngân hàng.' } },
            { '@type': 'Question', name: 'Giá đất Bình Dương hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Thuận An, Dĩ An 40-100 triệu/m²; Thủ Dầu Một 30-80 triệu/m²; Thành Phố Mới 20-50 triệu/m²; Bến Cát, Tân Uyên 8-20 triệu/m².' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-binh-duong#agent`,
          name: 'SGS LAND - BĐS Bình Dương',
          url: `${APP_URL}/bat-dong-san-binh-duong`,
          areaServed: { '@type': 'State', name: 'Bình Dương', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } },
          knowsAbout: ['Bất động sản Bình Dương', 'Khu công nghiệp Bình Dương', 'Thuận An', 'Dĩ An', 'Thành Phố Mới Bình Dương', 'Grand Manhattan Novaland'],
        },
      ],
    },
  },
  'bat-dong-san-quan-7': {
    title: 'Bất Động Sản Quận 7 TP.HCM | Nhà Phố, Căn Hộ — SGS LAND',
    description: 'Mua bán nhà đất Quận 7: Phú Mỹ Hưng, Tân Phong, Tân Quy. Vị trí đắc địa, tiện ích cao cấp. Kho hàng đa dạng tại SGS LAND.',
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
          mainEntity: [
            { '@type': 'Question', name: 'Bất động sản Quận 7 có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Quận 7 là thị trường BĐS ổn định và thanh khoản cao nhất TP.HCM nhờ cộng đồng quốc tế đông đảo. Giá BĐS tăng đều đặn 8-12%/năm.' } },
            { '@type': 'Question', name: 'Giá căn hộ Quận 7 hiện tại là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Phú Mỹ Hưng 70-150 triệu/m²; Sunrise City 55-90 triệu/m²; khu vực khác Q7 40-70 triệu/m². Cho thuê 2-3PN Phú Mỹ Hưng 25-60 triệu/tháng.' } },
            { '@type': 'Question', name: 'Phú Mỹ Hưng có đặc điểm gì hấp dẫn nhà đầu tư?', acceptedAnswer: { '@type': 'Answer', text: 'Phú Mỹ Hưng thu hút nhà đầu tư nhờ cộng đồng quốc tế đông (Hàn, Nhật, Đài), hạ tầng xanh chuẩn Singapore, 20+ trường quốc tế và bệnh viện FV tiêu chuẩn Pháp.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-quan-7#agent`,
          name: 'SGS LAND - BĐS Quận 7',
          url: `${APP_URL}/bat-dong-san-quan-7`,
          areaServed: { '@type': 'City', name: 'Quận 7', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Quận 7', 'Phú Mỹ Hưng', 'Sunrise City', 'Cộng đồng Hàn Quốc TP.HCM', 'Trường quốc tế Quận 7'],
        },
      ],
    },
  },
  'bat-dong-san-phu-nhuan': {
    title: 'Bất Động Sản Phú Nhuận TP.HCM | Nhà Trung Tâm — SGS LAND',
    description: 'Mua bán nhà đất Phú Nhuận: Nhà phố, căn hộ trung tâm TP.HCM. Vị trí thuận tiện, giao thông kết nối. Tư vấn miễn phí tại SGS LAND.',
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
          mainEntity: [
            { '@type': 'Question', name: 'Giá nhà phố Phú Nhuận hiện nay là bao nhiêu?', acceptedAnswer: { '@type': 'Answer', text: 'Mặt tiền đường lớn (Phan Đình Phùng, Hoàng Văn Thụ) 150-300 triệu/m²; nhà hẻm xe hơi 80-150 triệu/m²; nhà hẻm nhỏ 50-80 triệu/m². Căn hộ cao cấp 60-120 triệu/m².' } },
            { '@type': 'Question', name: 'BĐS Phú Nhuận có đáng đầu tư không?', acceptedAnswer: { '@type': 'Answer', text: 'Phú Nhuận là thị trường BĐS trú ẩn an toàn — giá tăng đều đặn 8-15%/năm, thanh khoản vượt trội nhờ nhu cầu ở thực và cho thuê mặt bằng kinh doanh từ doanh nhân và chuyên gia quốc tế.' } },
            { '@type': 'Question', name: 'Gần sân bay Tân Sơn Nhất có lợi gì cho BĐS Phú Nhuận?', acceptedAnswer: { '@type': 'Answer', text: 'Cách sân bay Tân Sơn Nhất 2-4km tạo nhu cầu thuê nhà và văn phòng từ chuyên gia hàng không, phi công, doanh nhân quốc tế — giữ cho thị trường cho thuê Phú Nhuận luôn sôi động.' } },
          ],
        },
        {
          '@type': 'RealEstateAgent',
          '@id': `${APP_URL}/bat-dong-san-phu-nhuan#agent`,
          name: 'SGS LAND - BĐS Phú Nhuận',
          url: `${APP_URL}/bat-dong-san-phu-nhuan`,
          areaServed: { '@type': 'City', name: 'Phú Nhuận', containedInPlace: { '@type': 'State', name: 'TP.HCM', containedInPlace: { '@type': 'Country', name: 'Việt Nam' } } },
          knowsAbout: ['Bất động sản Phú Nhuận', 'Nhà phố Phú Nhuận', 'Phan Đình Phùng', 'Hoàng Văn Thụ', 'Gần sân bay Tân Sơn Nhất'],
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
    title: 'Masterise Homes | Căn Hộ Hạng Sang Masteri, Lumière, Grand Marina - SGS LAND',
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
