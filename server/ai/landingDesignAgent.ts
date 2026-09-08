/**
 * Landing Design Agent.
 *
 * This is a deterministic specialist: it turns verified landing inputs into
 * a bounded design system. It deliberately does not invent project facts or
 * call a provider, so landing creation keeps its existing latency and retry
 * behavior.
 */

export const LANDING_DESIGN_SKILL_KEY = 'landing-design';
export const LANDING_DESIGN_VERSION = '1.0';

export const LANDING_DESIGN_SYSTEM = `Bạn là Landing Design Agent của SGS LAND.
Nhiệm vụ duy nhất: tạo design system có cấu trúc cho landing page bất động sản từ brief, brochure và ảnh đã xác minh.
Luôn giữ thứ tự hero → gallery → legal → price → amenities → contact.
Dùng semantic tokens navy, gold, surface, text, border, shadow; mobile-first; contrast rõ; alt text bắt buộc.
Không bịa giá, pháp lý, tiện ích, lợi nhuận, tiến độ hoặc claim bán hàng. Thiếu dữ kiện thì dùng pattern trung tính và đánh dấu needs_review.
Không publish, không gửi tin nhắn, không thay đổi quota. Chỉ trả structured design draft để Minh và landing renderer sử dụng.`;

export type LandingDesignPattern = 'sanctuary' | 'coastal' | 'urban' | 'family';
export type LandingGalleryLayout = 'single-focus' | 'mosaic' | 'editorial-grid';

export type LandingDesign = {
  skillKey: typeof LANDING_DESIGN_SKILL_KEY;
  version: typeof LANDING_DESIGN_VERSION;
  pattern: LandingDesignPattern;
  palette: {
    navy: string;
    navyStrong: string;
    gold: string;
    goldStrong: string;
    surface: string;
    surfaceSubtle: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
  };
  hero: {
    alignment: 'left' | 'center';
    overlay: 'soft' | 'strong';
    imageTreatment: 'gradient' | 'image-led';
  };
  gallery: {
    layout: LandingGalleryLayout;
    aspectRatio: '4/3' | '16/10';
  };
  cta: {
    style: 'gold-pill';
    placement: 'hero-and-contact';
    label: string;
  };
  sectionSurfaces: {
    legal: 'subtle';
    price: 'paper';
    amenities: 'paper';
  };
  accessibility: {
    contrastChecked: true;
    mobileFirst: true;
    altTextRequired: true;
  };
  rationale: string[];
  confidence: number;
  needsReview?: boolean;
};

export type LandingDesignInput = {
  brief?: string;
  brochureText?: string;
  projectName?: string;
  language?: string;
  galleryImages?: string[];
  hasLegalDoc?: boolean;
  amenities?: string[];
};

const PALETTES: Record<LandingDesignPattern, LandingDesign['palette']> = {
  sanctuary: {
    navy: '#0B1D26',
    navyStrong: '#06131A',
    gold: '#C6923D',
    goldStrong: '#8C6420',
    surface: '#F7F3EA',
    surfaceSubtle: '#EEE8DA',
    text: '#1E252B',
    textSecondary: '#56616A',
    border: 'rgba(11,29,38,.14)',
    shadow: '0 18px 50px rgba(11,29,38,.12)',
  },
  coastal: {
    navy: '#0D3442',
    navyStrong: '#08232D',
    gold: '#CBA45A',
    goldStrong: '#8A6A2D',
    surface: '#F2F7F6',
    surfaceSubtle: '#E1EFEC',
    text: '#183039',
    textSecondary: '#587078',
    border: 'rgba(13,52,66,.15)',
    shadow: '0 18px 50px rgba(8,35,45,.13)',
  },
  urban: {
    navy: '#1D2A35',
    navyStrong: '#101820',
    gold: '#C6923D',
    goldStrong: '#8C6420',
    surface: '#F5F5F2',
    surfaceSubtle: '#E8EBEA',
    text: '#1B2228',
    textSecondary: '#5C6870',
    border: 'rgba(29,42,53,.15)',
    shadow: '0 18px 50px rgba(16,24,32,.13)',
  },
  family: {
    navy: '#153B4A',
    navyStrong: '#0B2935',
    gold: '#C6923D',
    goldStrong: '#8C6420',
    surface: '#F8F5ED',
    surfaceSubtle: '#EDF1EC',
    text: '#1D292D',
    textSecondary: '#5B6A6B',
    border: 'rgba(21,59,74,.14)',
    shadow: '0 18px 50px rgba(21,59,74,.11)',
  },
};

function normalizeDesignText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

export function chooseLandingDesignPattern(input: LandingDesignInput): LandingDesignPattern {
  const text = normalizeDesignText([
    input.projectName,
    input.brief,
    input.brochureText?.slice(0, 12_000),
    ...(input.amenities || []),
  ].join(' '));
  if (containsAny(text, ['bien', 'beach', 'resort', 'nghi duong', 'marina', 'waterfront', 'ven song'])) return 'coastal';
  if (containsAny(text, ['metro', 'trung tam', 'city', 'cbd', 'office', 'mixed-use', 'thu thiem', 'van phong'])) return 'urban';
  if (containsAny(text, ['truong', 'school', 'benh vien', 'cong vien', 'gia dinh', 'o thuc', 'family'])) return 'family';
  return 'sanctuary';
}

export function designLandingPage(input: LandingDesignInput): LandingDesign {
  const pattern = chooseLandingDesignPattern(input);
  const imageCount = Array.isArray(input.galleryImages) ? input.galleryImages.length : 0;
  const hasVisuals = imageCount > 0;
  const language = String(input.language || 'vi').toLowerCase() === 'en' ? 'en' : 'vi';
  const galleryLayout: LandingGalleryLayout =
    imageCount === 1 ? 'single-focus' : imageCount > 1 ? 'mosaic' : 'editorial-grid';
  const rationale: string[] = [
    `Pattern ${pattern} được chọn từ ngữ cảnh brief/tài liệu, không suy đoán dữ kiện dự án.`,
    imageCount === 1
      ? 'Một ảnh được ưu tiên thành single-focus để không bị thu nhỏ trong gallery.'
      : imageCount > 1
        ? 'Nhiều ảnh dùng mosaic để tạo nhịp thị giác và giữ crop nhất quán.'
        : 'Chưa có ảnh xác thực nên dùng editorial placeholder layout an toàn.',
    'CTA tập trung vào tư vấn, không tạo cam kết giá hoặc pháp lý.',
  ];
  const confidence = pattern === 'sanctuary' && !input.brief && !input.brochureText ? 0.62 : 0.88;
  return {
    skillKey: LANDING_DESIGN_SKILL_KEY,
    version: LANDING_DESIGN_VERSION,
    pattern,
    palette: PALETTES[pattern],
    hero: {
      alignment: pattern === 'urban' ? 'left' : 'left',
      overlay: hasVisuals ? 'strong' : 'soft',
      imageTreatment: hasVisuals ? 'image-led' : 'gradient',
    },
    gallery: {
      layout: galleryLayout,
      aspectRatio: pattern === 'coastal' ? '16/10' : '4/3',
    },
    cta: {
      style: 'gold-pill',
      placement: 'hero-and-contact',
      label: language === 'en' ? 'Talk to a project advisor' : 'Nhận tư vấn dự án',
    },
    sectionSurfaces: {
      legal: 'subtle',
      price: 'paper',
      amenities: 'paper',
    },
    accessibility: {
      contrastChecked: true,
      mobileFirst: true,
      altTextRequired: true,
    },
    rationale,
    confidence,
    ...(confidence < 0.7 ? { needsReview: true } : {}),
  };
}

export function handle_landing_design(args: Record<string, any>): LandingDesign {
  return designLandingPage({
    brief: args.brief,
    brochureText: args.brochureText,
    projectName: args.projectName,
    language: args.language,
    galleryImages: args.galleryImages,
    hasLegalDoc: args.hasLegalDoc,
    amenities: args.amenities,
  });
}