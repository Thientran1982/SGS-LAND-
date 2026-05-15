// server/ssr-renderer.tsx
// Programmatic SEO renderer for high-value real estate landing pages.
//
// Provides:
//   1. Enhanced RealEstateListing schema with AggregateOffer price data (lowPrice/highPrice).
//   2. Raw-HTML body content injected into <!-- ssr-body-placeholder --> inside #root.
//      Crawlers (Googlebot, GPTBot, PerplexityBot, ClaudeBot, Bingbot) see this in raw HTML
//      before JS executes. React's createRoot().render() replaces #root on mount, so
//      users with JS never see duplicate content.
//
// Integration: called from the /du-an/:projectSlug handler in server.ts.
// Returns null for unknown paths — caller falls back to buildStaticPageMeta.

import { injectMeta, getBaseHtml, MetaData } from './seo/metaInjector';

const APP = 'https://sgsland.vn';

// ---------------------------------------------------------------------------
// Page metadata registry
// Only routes that need RICHER schema than the metaInjector STATIC_PAGE_META
// (i.e. RealEstateListing + AggregateOffer price data) are listed here.
// ---------------------------------------------------------------------------

interface SsrPage {
  title: string;
  description: string;
  h1: string;
  keywords: string;
  image?: string;
  geoPosition?: string;
  geoPlacename?: string;
  geoRegion?: string;
  schema: object[];
}

export const PAGE_META: Record<string, SsrPage> = {
  '/du-an/aqua-city': {
    title: 'Aqua City Novaland | Bảng Giá & Pháp Lý Mới Nhất T5/2026 — SGS LAND',
    description:
      'Aqua City Novaland Nhơn Trạch: căn hộ từ 3 tỷ, biệt thự từ 15 tỷ. Cập nhật bảng giá, tiến độ xây dựng, pháp lý T5/2026. Đại lý ủy quyền chính thức SGS LAND.',
    h1: 'Aqua City Novaland',
    keywords:
      'aqua city novaland, aqua city bảng giá 2026, aqua city nhơn trạch đồng nai, biệt thự aqua city giá bao nhiêu, aqua city có nên mua không',
    image: `${APP}/og/du-an/aqua-city`,
    geoPosition: '10.8912;106.8712',
    geoPlacename: 'Long Hưng, Biên Hòa, Đồng Nai',
    geoRegion: 'VN-43',
    schema: [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: APP },
          { '@type': 'ListItem', position: 2, name: 'Dự Án BĐS', item: `${APP}/marketplace` },
          { '@type': 'ListItem', position: 3, name: 'Aqua City Novaland', item: `${APP}/du-an/aqua-city` },
        ],
      },
      {
        '@type': 'RealEstateListing',
        '@id': `${APP}/du-an/aqua-city#project`,
        name: 'Aqua City Novaland',
        description:
          'Đại đô thị sinh thái 1.000ha do Novaland phát triển tại Long Hưng – Nhơn Trạch, Đồng Nai. Căn hộ từ 3 tỷ, nhà phố từ 8 tỷ, biệt thự từ 15 tỷ.',
        url: `${APP}/du-an/aqua-city`,
        image: `${APP}/og/du-an/aqua-city`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'VND',
          lowPrice: 3_000_000_000,
          highPrice: 50_000_000_000,
          offerCount: 120,
          availability: 'https://schema.org/InStock',
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Long Hưng, Biên Hòa',
          addressLocality: 'Nhơn Trạch',
          addressRegion: 'Đồng Nai',
          addressCountry: 'VN',
          postalCode: '820000',
        },
        brand: { '@type': 'Brand', name: 'Novaland' },
        floorSize: { '@type': 'QuantitativeValue', value: 1000, unitText: 'ha' },
        numberOfRooms: '1–4',
        amenityFeature: [
          'Golf 18 lỗ',
          'Marina cảng du thuyền',
          'Bệnh viện Hòa Hảo',
          'Trường Tesla Education',
          'Công viên 100.000m² mặt nước',
          'Trung tâm thương mại Nova Mall',
        ],
        dateModified: '2026-05-01',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Aqua City Novaland giá bao nhiêu tháng 5/2026?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Giá Aqua City T5/2026: căn hộ 3–5 tỷ (60–100m²), nhà phố liền kề 8–20 tỷ, biệt thự đơn lập 15–50 tỷ. Chính sách: thanh toán 30% ký HĐMB, 70% còn lại trả góp 24–36 tháng không lãi suất. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.',
            },
          },
          {
            '@type': 'Question',
            name: 'Aqua City Novaland có nên mua đầu tư 2026 không?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Aqua City phù hợp đầu tư dài hạn 5–10 năm. Lợi thế: quy mô 1.000ha, vị trí hưởng lợi sân bay Long Thành (2026) và cầu Nhơn Trạch (cuối 2026), tiện ích 5 sao. Giá đã tăng 18% từ 2024–2026. Novaland hoàn thành tái cơ cấu tài chính 2024, tiếp tục bàn giao.',
            },
          },
          {
            '@type': 'Question',
            name: 'Từ trung tâm TP.HCM đến Aqua City mất bao lâu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Từ trung tâm TP.HCM: ~30 phút qua cao tốc Long Thành – Dầu Giây, hoặc ~45 phút qua phà Cát Lái. Sau khi cầu Nhơn Trạch hoàn thành (cuối 2026), thời gian đến Quận 2 giảm còn 20–25 phút.',
            },
          },
          {
            '@type': 'Question',
            name: 'Pháp lý Aqua City có sổ hồng riêng chưa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Một số phân khu Aqua City đã được cấp sổ hồng riêng từng căn sau khi Novaland hoàn thành tái cơ cấu. Tình trạng pháp lý khác nhau theo từng phân khu — SGS LAND kiểm tra sổ hồng cụ thể miễn phí trước khi đặt cọc.',
            },
          },
          {
            '@type': 'Question',
            name: 'So sánh Aqua City và Izumi City — nên chọn đâu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Aqua City: quy mô lớn hơn (1.000ha), tiện ích golf/marina, giá biệt thự cao hơn, vị trí Nhơn Trạch. Izumi City: chuẩn Nhật Bản (Fuji Mart), track record bàn giao tốt của Nam Long, giá nhà phố thấp hơn, gần TP.HCM hơn.',
            },
          },
          {
            '@type': 'Question',
            name: 'Cho thuê Aqua City thu nhập bao nhiêu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Căn hộ 1PN 4–7 triệu/tháng; nhà phố liền kề 8–15 triệu/tháng; biệt thự đơn lập 30–60 triệu/tháng (khách Hàn/Nhật từ KCN Long Bình). Tỷ suất cho thuê biệt thự cao cấp ước 4–6%/năm.',
            },
          },
        ],
      },
    ],
  },

  '/du-an/vinhomes-grand-park': {
    title: 'Vinhomes Grand Park | Căn Hộ Từ 2.5 Tỷ, Bảng Giá T5/2026 — SGS LAND',
    description:
      'Vinhomes Grand Park TP. Thủ Đức: siêu đô thị 271ha, căn hộ từ 2.5 tỷ. Bảng giá, chính sách vay, tiến độ bàn giao mới nhất tháng 5/2026. Đại lý ủy quyền chính thức.',
    h1: 'Vinhomes Grand Park',
    keywords:
      'vinhomes grand park, vinhomes grand park bảng giá 2026, vinhomes thủ đức căn hộ, vinhomes grand park có nên mua, the opus one vinhomes',
    image: `${APP}/og/du-an/vinhomes-grand-park`,
    geoPosition: '10.8555;106.8400',
    geoPlacename: 'TP Thủ Đức, TP.HCM',
    geoRegion: 'VN-SG',
    schema: [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: APP },
          { '@type': 'ListItem', position: 2, name: 'BĐS TP Thủ Đức', item: `${APP}/bat-dong-san-thu-duc` },
          { '@type': 'ListItem', position: 3, name: 'Vinhomes Grand Park', item: `${APP}/du-an/vinhomes-grand-park` },
        ],
      },
      {
        '@type': 'RealEstateListing',
        '@id': `${APP}/du-an/vinhomes-grand-park#project`,
        name: 'Vinhomes Grand Park',
        description:
          'Siêu đô thị thông minh 271ha tại TP. Thủ Đức, TP.HCM với 44 tòa tháp cao tầng, công viên 36ha, Metro số 1, Vinmec và Vinschool.',
        url: `${APP}/du-an/vinhomes-grand-park`,
        image: `${APP}/og/du-an/vinhomes-grand-park`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'VND',
          lowPrice: 2_500_000_000,
          highPrice: 15_000_000_000,
          offerCount: 380,
          availability: 'https://schema.org/InStock',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'TP. Thủ Đức',
          addressRegion: 'TP.HCM',
          addressCountry: 'VN',
          postalCode: '700000',
        },
        brand: { '@type': 'Brand', name: 'Vinhomes' },
        floorSize: { '@type': 'QuantitativeValue', value: 271, unitText: 'ha' },
        numberOfRooms: '1–4',
        amenityFeature: [
          'Công viên 36ha',
          'Vinmec quốc tế',
          'Vinschool các cấp',
          'Metro số 1 (ga Suối Tiên 5 phút)',
          'Trung tâm thương mại Vincom Mega Mall',
          'Hồ bơi ngoài trời mỗi phân khu',
        ],
        dateModified: '2026-05-01',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Giá căn hộ Vinhomes Grand Park tháng 5/2026 là bao nhiêu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Giá căn hộ Vinhomes Grand Park T5/2026: The Rainbow 1PN từ 2.5 tỷ (45m²), 2PN từ 3.5 tỷ; The Origami 2PN từ 4 tỷ; The Beverly 2PN từ 5 tỷ; The Opus One 3PN từ 8 tỷ. Giá đã bao gồm VAT. Vay ngân hàng tối đa 70%, lãi suất ưu đãi 6.9%/2 năm đầu.',
            },
          },
          {
            '@type': 'Question',
            name: 'Vinhomes Grand Park có bao nhiêu phân khu? Phân khu nào tốt nhất?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Vinhomes Grand Park gồm 9 phân khu. Tốt nhất về vị trí: The Origami (gần công viên 36ha, cộng đồng Nhật Bản). Về tài chính: The Rainbow và The Masteri Centre Point (đã bàn giao, dễ cho thuê). Cao cấp nhất: The Opus One (8–15 tỷ, tiêu chuẩn khách sạn 5 sao).',
            },
          },
          {
            '@type': 'Question',
            name: 'Metro số 1 ảnh hưởng thế nào đến Vinhomes Grand Park?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Ga Suối Tiên và Bến Xe Miền Đông Mới chỉ 5–10 phút đi bộ từ Grand Park. Sau khi Metro hoạt động, về Q1 chỉ 30 phút. Giá thuê đã tăng 15–20% kể từ khi Metro chạy thương mại. Là lợi thế cạnh tranh lớn nhất của dự án.',
            },
          },
          {
            '@type': 'Question',
            name: 'Pháp lý Vinhomes Grand Park có sổ hồng chưa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The Rainbow, The Origami, The Beverly đã bàn giao và có sổ hồng riêng từng căn. The Opus One đang tiếp tục bàn giao. SGS LAND xác minh sổ hồng từng căn miễn phí trước khi đặt cọc.',
            },
          },
          {
            '@type': 'Question',
            name: 'Cho thuê Vinhomes Grand Park thu nhập bao nhiêu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '1PN (45–55m²) 8–12 triệu/tháng; 2PN 12–18 triệu/tháng; 3PN 18–25 triệu/tháng. Gross yield 4–6%/năm. Nhu cầu thuê mạnh từ chuyên gia Khu Công Nghệ Cao SHTP và sinh viên ĐH Quốc Gia.',
            },
          },
          {
            '@type': 'Question',
            name: 'So sánh Vinhomes Grand Park và Vinhomes Central Park?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Grand Park (271ha, từ 2.5 tỷ, cộng đồng trẻ, gần Metro/SHTP) phù hợp ngân sách vừa và cho thuê. Central Park (Bình Thạnh, 50–200 triệu/m², gần sân bay, Landmark 81) dành cho nội thành đẳng cấp và ở thực.',
            },
          },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Body HTML generators
// Produces visible HTML injected into <!-- ssr-body-placeholder --> inside #root.
// React.createRoot().render() replaces #root on mount — users with JS see the SPA.
// Crawlers (Googlebot, GPTBot, ClaudeBot, PerplexityBot) read this before JS runs.
// ---------------------------------------------------------------------------

function buildProjectBodyHtml(page: SsrPage, path: string): string {
  const listing = page.schema.find((s: any) => s['@type'] === 'RealEstateListing') as any;
  const faqNode = page.schema.find((s: any) => s['@type'] === 'FAQPage') as any;
  const breadcrumb = page.schema.find((s: any) => s['@type'] === 'BreadcrumbList') as any;

  const lines: string[] = [];

  // Breadcrumbs
  if (breadcrumb?.itemListElement?.length) {
    const crumbs = breadcrumb.itemListElement
      .map((it: any) => (it.item ? `<a href="${esc(it.item)}">${esc(it.name)}</a>` : esc(it.name)))
      .join(' › ');
    lines.push(`<p style="font-size:13px;color:#64748b;margin-bottom:12px;">${crumbs}</p>`);
  }

  // Lead paragraph
  if (listing?.description) {
    lines.push(`<p><strong>${esc(page.h1)}</strong> — ${esc(listing.description)}</p>`);
  }

  // Key facts
  const facts: { label: string; value: string }[] = [];
  if (listing?.address) {
    const a = listing.address;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean);
    if (parts.length) facts.push({ label: 'Vị trí', value: parts.join(', ') });
  }
  if (listing?.floorSize?.value) {
    facts.push({ label: 'Quy mô', value: `${listing.floorSize.value} ${listing.floorSize.unitText || ''}`.trim() });
  }
  if (listing?.numberOfRooms) {
    facts.push({ label: 'Loại phòng', value: String(listing.numberOfRooms) + ' phòng ngủ' });
  }
  if (listing?.offers) {
    const o = listing.offers;
    if (o.lowPrice && o.highPrice) {
      facts.push({ label: 'Khoảng giá', value: `Từ ${fmtVND(o.lowPrice)} — ${fmtVND(o.highPrice)}` });
    } else if (o.price) {
      facts.push({ label: 'Giá từ', value: `${fmtVND(Number(o.price))} ${o.priceCurrency || 'VND'}` });
    }
  }
  if (Array.isArray(listing?.amenityFeature) && listing.amenityFeature.length) {
    facts.push({ label: 'Tiện ích', value: listing.amenityFeature.slice(0, 5).join(', ') });
  }

  if (facts.length) {
    lines.push('<h2 style="font-size:16px;margin:16px 0 8px;">Thông tin dự án</h2>');
    lines.push('<ul style="margin:0;padding-left:20px;color:#475569;">');
    for (const f of facts) {
      lines.push(`  <li><strong>${esc(f.label)}:</strong> ${esc(f.value)}</li>`);
    }
    lines.push('</ul>');
  }

  // FAQ (top 4 Q&A)
  const faqs: any[] = faqNode?.mainEntity ?? [];
  if (faqs.length) {
    lines.push('<h2 style="font-size:16px;margin:20px 0 8px;">Câu hỏi thường gặp</h2>');
    for (const q of faqs.slice(0, 4)) {
      const qText = q?.name;
      const aText = q?.acceptedAnswer?.text;
      if (!qText || !aText) continue;
      lines.push(`<h3 style="font-size:14px;color:#1e293b;margin:12px 0 4px;">${esc(qText)}</h3>`);
      lines.push(`<p style="color:#475569;margin:0 0 8px;">${esc(aText)}</p>`);
    }
  }

  // Authority footer + internal links
  lines.push('<h2 style="font-size:16px;margin:20px 0 8px;">Về SGS LAND</h2>');
  lines.push(
    '<p style="color:#475569;"><strong>SGS LAND</strong> (sgsland.vn) — đại lý phân phối uỷ quyền cấp 1 của Vinhomes, Novaland, Masterise Homes, Nam Long. ' +
    '5+ năm kinh nghiệm, 15.000+ môi giới, 45.000+ sản phẩm, 2 tỷ USD+ giao dịch. Định giá AVM ±5%, kiểm tra pháp lý 2 lớp miễn phí.</p>'
  );
  lines.push('<ul style="margin:0;padding-left:20px;color:#475569;">');
  lines.push(`  <li>Hotline: <a href="tel:+84971132378">+84 971 132 378</a></li>`);
  lines.push(`  <li>Email: <a href="mailto:info@sgsland.vn">info@sgsland.vn</a></li>`);
  lines.push(`  <li><a href="${esc(APP)}/ai-valuation">Định giá AI bất động sản miễn phí</a> — kết quả ±5% trong 30 giây</li>`);
  lines.push(`  <li><a href="${esc(APP)}/marketplace">Tìm kiếm 45.000+ bất động sản toàn quốc</a></li>`);
  lines.push(`  <li><a href="${esc(APP)}/contact">Đặt lịch tư vấn miễn phí</a></li>`);
  lines.push('</ul>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Renders the production index.html with enhanced SSR meta for the given path.
 *
 * Uses injectMeta() to:
 *   - Set title, description, canonical, OG tags
 *   - Inject RealEstateListing + AggregateOffer schema into <head>
 *   - Trigger buildProjectNoscriptHtml() for the <noscript> fallback block
 *   - Replace <!-- ssr-body-placeholder --> with crawlable body content
 *
 * Returns null if path is not in PAGE_META — caller should fall back to
 * buildStaticPageMeta() + sendMeta().
 */
export function renderSsrPage(path: string): string | null {
  const page = PAGE_META[path];
  if (!page) return null;

  let baseHtml: string;
  try {
    baseHtml = getBaseHtml();
  } catch {
    return null;
  }

  // Build a merged @graph schema (strips per-item @context; injectMeta adds one block)
  const graph = page.schema.map((node: any) => {
    const { '@context': _ctx, ...rest } = node as any;
    return rest;
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  const bodyHtml = buildProjectBodyHtml(page, path);

  const meta: MetaData = {
    title: page.title,
    description: page.description,
    h1: page.h1,
    url: `${APP}${path}`,
    image: page.image,
    keywords: page.keywords,
    geoPosition: page.geoPosition,
    geoPlacename: page.geoPlacename,
    geoRegion: page.geoRegion,
    structuredData,
    bodyHtml,
  };

  return injectMeta(baseHtml, meta);
}
