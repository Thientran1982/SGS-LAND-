/**
 * Dynamic OG image generator for project and district landing pages.
 * Uses sharp to composite SVG overlays onto project photos (where available)
 * or generate branded gradient backgrounds.
 * Results are cached in-memory for the lifetime of the server process.
 *
 * Output: 1200x630 JPEG — the standard Open Graph image size.
 */

import sharp from 'sharp';
import type { Sharp } from 'sharp';
import path from 'path';
import { existsSync } from 'fs';

const W = 1200;
const H = 630;

interface OgConfig {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  price?: string;
  photoFile?: string;
  accentColor: string;
  bgGradient: [string, string];
}

const ROOT = process.cwd();

// Config for every project/district SEO page.
// photoFile paths are relative to project root.
export const OG_CONFIG: Record<string, OgConfig> = {
  // ── Project pages (with real photos) ──────────────────────────────────────
  'du-an/aqua-city': {
    title: 'Aqua City Novaland',
    subtitle: 'Long Hưng, Biên Hòa, Đồng Nai',
    badge: 'Biệt thự & Nhà phố',
    badgeColor: '#0ea5e9',
    price: 'Từ 3 tỷ',
    photoFile: 'public/images/projects/aqua-city.png',
    accentColor: '#0ea5e9',
    bgGradient: ['#0c4a6e', '#1e3a5f'],
  },
  'du-an/izumi-city': {
    title: 'Izumi City',
    subtitle: 'Long Hưng, Biên Hòa, Đồng Nai',
    badge: 'Đô thị chuẩn Nhật Bản',
    badgeColor: '#dc2626',
    price: 'Từ 2.5 tỷ',
    photoFile: 'public/images/projects/izumi-city.png',
    accentColor: '#ef4444',
    bgGradient: ['#1c1917', '#292524'],
  },
  'du-an/vinhomes-grand-park': {
    title: 'Vinhomes Grand Park',
    subtitle: 'TP Thủ Đức, TP.HCM',
    badge: 'Siêu đô thị 271ha',
    badgeColor: '#16a34a',
    price: 'Từ 35 tr/m²',
    photoFile: 'public/images/projects/vinhomes-grand-park.png',
    accentColor: '#22c55e',
    bgGradient: ['#052e16', '#14532d'],
  },
  'du-an/vinhomes-can-gio': {
    title: 'Vinhomes Cần Giờ',
    subtitle: 'Cần Giờ, TP.HCM',
    badge: 'Siêu đô thị biển 2.870ha',
    badgeColor: '#0891b2',
    price: 'Từ 12 tỷ',
    photoFile: 'public/images/projects/vinhomes-can-gio.png',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#164e63'],
  },
  'du-an/masterise-homes': {
    title: 'Masterise Homes',
    subtitle: 'Bình Thạnh, TP.HCM',
    badge: 'Hạng sang 5 sao',
    badgeColor: '#b45309',
    price: 'Từ 60 tr/m²',
    photoFile: 'public/images/projects/masterise-homes.png',
    accentColor: '#d97706',
    bgGradient: ['#1c1917', '#431407'],
  },
  'du-an/the-global-city': {
    title: 'The Global City',
    subtitle: 'An Phú, TP Thủ Đức, TP.HCM',
    badge: 'Đại đô thị 117ha',
    badgeColor: '#7c3aed',
    price: 'Từ 15 tỷ',
    photoFile: 'public/images/projects/the-global-city.png',
    accentColor: '#8b5cf6',
    bgGradient: ['#2e1065', '#3b0764'],
  },

  // ── Project pages (gradient background) ───────────────────────────────────
  'du-an/manhattan': {
    title: 'Grand Manhattan',
    subtitle: 'Bình Thạnh, TP.HCM',
    badge: 'Căn hộ hạng sang',
    badgeColor: '#b45309',
    price: 'Từ 120 tr/m²',
    accentColor: '#f59e0b',
    bgGradient: ['#1c1917', '#431407'],
  },
  'du-an/van-phuc-city': {
    title: 'Vạn Phúc City',
    subtitle: 'TP Thủ Đức, TP.HCM',
    badge: 'Khu đô thị 198ha',
    badgeColor: '#0891b2',
    price: 'Từ 8 tỷ',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#083344'],
  },
  'du-an/sala': {
    title: 'Sala Đại Quang Minh',
    subtitle: 'Thủ Thiêm, TP Thủ Đức, TP.HCM',
    badge: 'Khu đô thị 257ha',
    badgeColor: '#4f46e5',
    price: 'Từ 50 tr/m²',
    accentColor: '#6366f1',
    bgGradient: ['#1e1b4b', '#312e81'],
  },
  'du-an/vinhomes-central-park': {
    title: 'Vinhomes Central Park',
    subtitle: 'Bình Thạnh, TP.HCM',
    badge: 'Landmark 81',
    badgeColor: '#16a34a',
    price: 'Từ 50 tr/m²',
    accentColor: '#22c55e',
    bgGradient: ['#052e16', '#166534'],
  },
  'du-an/thu-thiem': {
    title: 'Khu Đô Thị Thủ Thiêm',
    subtitle: 'Thủ Thiêm, TP Thủ Đức, TP.HCM',
    badge: 'Trung tâm tài chính',
    badgeColor: '#4f46e5',
    price: 'Từ 80 tr/m²',
    accentColor: '#818cf8',
    bgGradient: ['#1e1b4b', '#1e3a5f'],
  },
  'du-an/son-kim-land': {
    title: 'Sơn Kim Land',
    subtitle: 'Quận 4, TP.HCM',
    badge: 'BĐS thương mại cao cấp',
    badgeColor: '#b45309',
    price: 'Từ 40 tr/m²',
    accentColor: '#f59e0b',
    bgGradient: ['#1c1917', '#431407'],
  },
  'du-an/nha-pho-trung-tam': {
    title: 'Nhà Phố Trung Tâm',
    subtitle: 'Quận 1, Quận 3, TP.HCM',
    badge: 'Mặt tiền & Nhà hẻm',
    badgeColor: '#0891b2',
    price: 'Từ 100 tr/m²',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#1e3a5f'],
  },

  // ── District / area pages (gradient background) ───────────────────────────
  'bat-dong-san-dong-nai': {
    title: 'Bất Động Sản Đồng Nai',
    subtitle: 'Biên Hòa · Nhơn Trạch · Long Thành',
    badge: 'Thị trường tỉnh 2026',
    badgeColor: '#16a34a',
    accentColor: '#22c55e',
    bgGradient: ['#052e16', '#14532d'],
  },
  'bat-dong-san-long-thanh': {
    title: 'Bất Động Sản Long Thành',
    subtitle: 'Long Thành, Đồng Nai',
    badge: 'Vùng kinh tế sân bay',
    badgeColor: '#0891b2',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#083344'],
  },
  'bat-dong-san-thu-duc': {
    title: 'Bất Động Sản Thủ Đức',
    subtitle: 'TP Thủ Đức, TP.HCM',
    badge: 'Thành phố sáng tạo',
    badgeColor: '#7c3aed',
    accentColor: '#8b5cf6',
    bgGradient: ['#2e1065', '#3b0764'],
  },
  'bat-dong-san-binh-duong': {
    title: 'Bất Động Sản Bình Dương',
    subtitle: 'Thuận An · Dĩ An · TP Mới',
    badge: 'Tỉnh công nghiệp',
    badgeColor: '#b45309',
    accentColor: '#f59e0b',
    bgGradient: ['#1c1917', '#292524'],
  },
  'bat-dong-san-quan-7': {
    title: 'Bất Động Sản Quận 7',
    subtitle: 'Phú Mỹ Hưng, TP.HCM',
    badge: 'Khu Nam TP.HCM',
    badgeColor: '#0891b2',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#164e63'],
  },
  'bat-dong-san-phu-nhuan': {
    title: 'Bất Động Sản Phú Nhuận',
    subtitle: 'Phú Nhuận, TP.HCM',
    badge: 'Gần sân bay TSN',
    badgeColor: '#4f46e5',
    accentColor: '#6366f1',
    bgGradient: ['#1e1b4b', '#312e81'],
  },
  'bat-dong-san-binh-chanh': {
    title: 'Bất Động Sản Bình Chánh',
    subtitle: 'Bình Chánh, TP.HCM',
    badge: 'Cửa ngõ Tây Nam',
    badgeColor: '#16a34a',
    accentColor: '#22c55e',
    bgGradient: ['#052e16', '#14532d'],
  },
  'bat-dong-san-can-gio': {
    title: 'Bất Động Sản Cần Giờ',
    subtitle: 'Cần Giờ, TP.HCM',
    badge: 'Đô thị biển UNESCO',
    badgeColor: '#0891b2',
    accentColor: '#06b6d4',
    bgGradient: ['#0c4a6e', '#083344'],
  },
  'bat-dong-san-binh-thanh': {
    title: 'Bất Động Sản Bình Thạnh',
    subtitle: 'Bình Thạnh, TP.HCM',
    badge: 'Landmark 81 · Sông Sài Gòn',
    badgeColor: '#4f46e5',
    accentColor: '#818cf8',
    bgGradient: ['#1e1b4b', '#1e3a5f'],
  },
  'bat-dong-san-long-an': {
    title: 'Bất Động Sản Long An',
    subtitle: 'Đức Hòa · Bến Lức · Cần Đước',
    badge: 'Hưởng lợi Vành đai 3&4',
    badgeColor: '#16a34a',
    accentColor: '#22c55e',
    bgGradient: ['#052e16', '#166534'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleFontSize(title: string): number {
  if (title.length <= 16) return 72;
  if (title.length <= 24) return 60;
  if (title.length <= 32) return 50;
  return 42;
}

/** SVG text layer: SGS LAND badge, category badge, title, subtitle, price. */
function buildTextSvg(cfg: OgConfig): Buffer {
  const fs = titleFontSize(cfg.title);
  const titleY = H - 112;
  const subtitleY = H - 56;

  const priceBadge = cfg.price
    ? `<rect x="${W - 260}" y="${H - 80}" width="220" height="46" rx="23" fill="${xmlEsc(cfg.accentColor)}" opacity="0.95"/>
       <text x="${W - 150}" y="${H - 49}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="white" text-anchor="middle">${xmlEsc(cfg.price)}</text>`
    : '';

  // Badge width roughly based on text length
  const badgeW = Math.min(280, Math.max(180, cfg.badge.length * 12 + 40));
  const badgeX = W - 48 - badgeW;

  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- SGS LAND brand badge (top-left) -->
  <rect x="48" y="44" width="168" height="48" rx="10" fill="#4f46e5"/>
  <text x="132" y="75" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">SGS LAND</text>
  <!-- Category badge (top-right) -->
  <rect x="${badgeX}" y="44" width="${badgeW}" height="48" rx="24" fill="${xmlEsc(cfg.badgeColor)}" opacity="0.92"/>
  <text x="${badgeX + badgeW / 2}" y="75" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">${xmlEsc(cfg.badge)}</text>
  <!-- Accent line above title -->
  <rect x="80" y="${titleY - 32}" width="80" height="5" rx="3" fill="${xmlEsc(cfg.accentColor)}"/>
  <!-- Project / district title -->
  <text x="80" y="${titleY}" font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="900" fill="white">${xmlEsc(cfg.title)}</text>
  <!-- Subtitle / location -->
  <text x="80" y="${subtitleY}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="white" opacity="0.82">${xmlEsc(cfg.subtitle)}</text>
  <!-- Price badge -->
  ${priceBadge}
</svg>`
  );
}

/** Full-canvas gradient SVG (used as background for pages without a photo). */
function buildGradientBg(cfg: OgConfig): Buffer {
  const [c1, c2] = cfg.bgGradient;
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${xmlEsc(c1)}"/>
      <stop offset="100%" stop-color="${xmlEsc(c2)}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- Decorative circles for depth -->
  <circle cx="${W - 60}" cy="60" r="240" fill="${xmlEsc(cfg.accentColor)}" opacity="0.10"/>
  <circle cx="40" cy="${H + 60}" r="280" fill="${xmlEsc(cfg.accentColor)}" opacity="0.07"/>
  <!-- Subtle grid lines -->
  <line x1="0" y1="${H - 100}" x2="${W}" y2="${H - 100}" stroke="${xmlEsc(cfg.accentColor)}" stroke-opacity="0.12" stroke-width="1"/>
  <line x1="0" y1="${H - 200}" x2="${W}" y2="${H - 200}" stroke="${xmlEsc(cfg.accentColor)}" stroke-opacity="0.06" stroke-width="1"/>
  <!-- Accent bar above text area -->
  <rect x="0" y="${H - 175}" width="${W}" height="1" fill="${xmlEsc(cfg.accentColor)}" opacity="0.2"/>
</svg>`
  );
}

/** Dark gradient overlay composited on top of a photo to make text readable. */
function buildPhotoOverlay(): Buffer {
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="40%"  stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.84"/>
    </linearGradient>
    <linearGradient id="hg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vg)"/>
  <rect width="${W}" height="${H}" fill="url(#hg)"/>
</svg>`
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

const cache = new Map<string, Buffer>();

/**
 * Generate (or return cached) a 1200x630 JPEG OG image for the given slug.
 * Returns null if the slug is not in OG_CONFIG.
 */
export async function generateOgImage(slug: string): Promise<Buffer | null> {
  if (cache.has(slug)) return cache.get(slug)!;

  const cfg = OG_CONFIG[slug];
  if (!cfg) return null;

  const photoPath = cfg.photoFile ? path.join(ROOT, cfg.photoFile) : null;
  const hasPhoto = photoPath !== null && existsSync(photoPath);

  let image: Sharp;

  if (hasPhoto) {
    const overlay = buildPhotoOverlay();
    const text = buildTextSvg(cfg);
    image = sharp(photoPath!)
      .resize(W, H, { fit: 'cover', position: 'attention' })
      .composite([
        { input: overlay, blend: 'over' },
        { input: text, blend: 'over' },
      ]);
  } else {
    const bg = buildGradientBg(cfg);
    const text = buildTextSvg(cfg);
    // density: sharp renders SVG at this DPI — 96 gives 1:1 pixel mapping at declared size
    image = sharp(bg, { density: 96 })
      .resize(W, H)
      .composite([{ input: text, blend: 'over' }]);
  }

  const buf = await image
    .jpeg({ quality: 87, mozjpeg: true })
    .toBuffer();

  cache.set(slug, buf);
  return buf;
}

/** Clear the in-memory cache (e.g. after config changes). */
export function clearOgCache(): void {
  cache.clear();
}
