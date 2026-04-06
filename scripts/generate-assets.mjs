import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// ─── Logo SVG (icon only, square) ────────────────────────────────────────────
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="80" fill="#4F46E5"/>
  <path d="M256 80L96 168l160 88 160-88L256 80z" fill="white" opacity="0.95"/>
  <path d="M96 256l160 88 160-88" fill="none" stroke="white" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <path d="M96 344l160 88 160-88" fill="none" stroke="white" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" opacity="0.70"/>
</svg>`;

// ─── OG Image SVG (1200 × 630) ───────────────────────────────────────────────
const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="60%" style="stop-color:#1e1b4b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#312e81;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#22d3ee;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.08" />
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.03" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative grid lines -->
  <line x1="0" y1="210" x2="1200" y2="210" stroke="#4f46e5" stroke-width="1" opacity="0.15"/>
  <line x1="0" y1="420" x2="1200" y2="420" stroke="#4f46e5" stroke-width="1" opacity="0.15"/>
  <line x1="400" y1="0" x2="400" y2="630" stroke="#4f46e5" stroke-width="1" opacity="0.15"/>
  <line x1="800" y1="0" x2="800" y2="630" stroke="#4f46e5" stroke-width="1" opacity="0.15"/>

  <!-- Decorative circle top-right -->
  <circle cx="1050" cy="120" r="200" fill="#6366f1" opacity="0.06"/>
  <circle cx="1050" cy="120" r="140" fill="#6366f1" opacity="0.06"/>

  <!-- Decorative circle bottom-left -->
  <circle cx="80" cy="540" r="160" fill="#22d3ee" opacity="0.05"/>

  <!-- Logo box -->
  <rect x="72" y="72" width="96" height="96" rx="20" fill="#4f46e5"/>
  <!-- Logo layers (stacked diamond shapes) -->
  <path d="M120 88l-40 22 40 22 40-22L120 88z" fill="white" opacity="0.95"/>
  <path d="M80 132l40 22 40-22" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <path d="M80 154l40 22 40-22" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.70"/>

  <!-- Brand name -->
  <text x="184" y="108" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800" fill="white">SGS LAND</text>
  <text x="184" y="140" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="400" fill="#a5b4fc">Nền tảng BĐS thế hệ mới</text>

  <!-- Accent line under header -->
  <rect x="72" y="196" width="480" height="3" rx="2" fill="url(#accent)" opacity="0.8"/>

  <!-- Main headline -->
  <text x="72" y="278" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" fill="white">Định giá BĐS bằng AI</text>
  <text x="72" y="340" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" fill="url(#accent)">Chính xác &amp; Tức thì</text>

  <!-- Sub description -->
  <text x="72" y="400" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="400" fill="#94a3b8">Phân tích thị trường thực tế · Sai số ±5% · Miễn phí</text>

  <!-- Feature pills -->
  <rect x="72" y="440" width="170" height="40" rx="20" fill="url(#card)" stroke="#6366f1" stroke-width="1.5"/>
  <text x="157" y="466" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600" fill="#a5b4fc" text-anchor="middle">AI Định Giá</text>

  <rect x="256" y="440" width="170" height="40" rx="20" fill="url(#card)" stroke="#6366f1" stroke-width="1.5"/>
  <text x="341" y="466" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600" fill="#a5b4fc" text-anchor="middle">CRM Đa Kênh</text>

  <rect x="440" y="440" width="170" height="40" rx="20" fill="url(#card)" stroke="#6366f1" stroke-width="1.5"/>
  <text x="525" y="466" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600" fill="#a5b4fc" text-anchor="middle">Xu Hướng GĐ</text>

  <!-- Domain badge -->
  <rect x="72" y="512" width="200" height="40" rx="8" fill="#4f46e5" opacity="0.9"/>
  <text x="172" y="538" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="white" text-anchor="middle">sgsland.vn</text>

  <!-- Right side stats card -->
  <rect x="760" y="72" width="368" height="486" rx="24" fill="url(#card)" stroke="#6366f1" stroke-width="1.5" opacity="0.9"/>

  <!-- Stats header -->
  <text x="944" y="124" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" text-anchor="middle">THỐNG KÊ THỊ TRƯỜNG</text>
  <line x1="800" y1="144" x2="1108" y2="144" stroke="#6366f1" stroke-width="1" opacity="0.4"/>

  <!-- Stat 1: Định giá -->
  <text x="820" y="192" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="#94a3b8">Độ chính xác tối đa</text>
  <text x="820" y="226" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="800" fill="white">98%</text>
  <rect x="820" y="240" width="80" height="4" rx="2" fill="url(#accent)"/>

  <!-- Stat 2: Thời gian -->
  <text x="820" y="302" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="#94a3b8">Thời gian định giá</text>
  <text x="820" y="336" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="800" fill="white">&lt; 30s</text>
  <rect x="820" y="350" width="80" height="4" rx="2" fill="#22d3ee"/>

  <!-- Stat 3: Tỉnh thành -->
  <text x="820" y="412" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="#94a3b8">Tỉnh thành phủ sóng</text>
  <text x="820" y="446" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="800" fill="white">63</text>
  <text x="892" y="446" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="600" fill="#94a3b8"> tỉnh</text>
  <rect x="820" y="460" width="80" height="4" rx="2" fill="#10b981"/>

  <!-- Right stat badge -->
  <rect x="960" y="470" width="140" height="56" rx="14" fill="#4f46e5" opacity="0.8"/>
  <text x="1030" y="496" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="600" fill="#c7d2fe" text-anchor="middle">Powered by</text>
  <text x="1030" y="518" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800" fill="white" text-anchor="middle">Gemini AI</text>
</svg>`;

async function main() {
  console.log('⏳ Generating SGS LAND brand assets...\n');

  // ── Favicons from logo SVG ───────────────────────────────────────────────────
  const logoBuffer = Buffer.from(LOGO_SVG);

  const sizes = [
    { file: 'favicon-16x16.png',   size: 16,  radius: 2  },
    { file: 'favicon-32x32.png',   size: 32,  radius: 4  },
    { file: 'apple-touch-icon.png', size: 180, radius: 28 },
    { file: 'icon-192.png',        size: 192, radius: 30 },
    { file: 'icon-512.png',        size: 512, radius: 80 },
  ];

  for (const { file, size } of sizes) {
    await sharp(logoBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(PUBLIC, file));
    console.log(`  ✅ ${file} (${size}×${size})`);
  }

  // ── OG Image 1200×630 JPEG ──────────────────────────────────────────────────
  const ogBuffer = Buffer.from(OG_SVG);
  await sharp(ogBuffer)
    .resize(1200, 630)
    .jpeg({ quality: 92, progressive: true, mozjpeg: true })
    .toFile(join(PUBLIC, 'og-image.jpg'));
  console.log(`  ✅ og-image.jpg (1200×630)`);

  console.log('\n✨ Tất cả assets đã được tạo thành công!\n');
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
