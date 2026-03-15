import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../services/i18n';

// ─── WINDOW GRID GEOMETRY ──────────────────────────────────────────────────
//
// LEFT FACE: quadrilateral (240,120) (400,200) (400,440) (240,360)
//   • 8 columns: x = 240 + col*20  (col 0–7)
//   • 8 rows:    y at x=240 = 120 + row*30  (row 0–7, step 30)
//   • Isometric slope going right: +0.5 px-y per px-x → per col (+20px x) → +10px y
//   ∴  top-y of cell (col,row) at x-left = 120 + row*30 + col*10
//
// RIGHT FACE: quadrilateral (400,200) (560,120) (560,360) (400,440)
//   • 8 columns: x = 400 + col*20  (col 0–7)
//   • 8 rows:    y at x=400 = 200 + row*30  (row 0–7, same row heights)
//   • Isometric slope going right: −0.5 px-y per px-x → per col (−10px y)
//   ∴  top-y of cell (col,row) at x-left = 200 + row*30 - col*10
// ─────────────────────────────────────────────────────────────────────────────

function getLeftWindowPos(col: number, row: number) {
  const x   = 240 + col * 20;
  const yTop = 120 + row * 30 + col * 10;
  return { x: x + 3, y: yTop + 4, w: 14, h: 22 };
}

function getRightWindowPos(col: number, row: number) {
  const x   = 400 + col * 20;
  const yTop = 200 + row * 30 - col * 10;
  return { x: x + 3, y: yTop + 4, w: 14, h: 22 };
}

// ─── WINDOW DEFINITIONS ───────────────────────────────────────────────────
// [col, row, hue, speed]  — col/row are grid indices verified against geometry
type WinHue   = 'warm' | 'cool';
type WinSpeed = 'slow' | 'med' | 'fast';

const LEFT_WINDOWS:  [number, number, WinHue, WinSpeed][] = [
  [1, 1, 'warm', 'slow'], [2, 0, 'cool', 'med'],  [3, 2, 'warm', 'fast'],
  [4, 1, 'cool', 'slow'], [5, 0, 'warm', 'med'],  [6, 3, 'cool', 'fast'],
  [0, 4, 'warm', 'med'],  [1, 5, 'cool', 'slow'], [3, 3, 'warm', 'fast'],
  [5, 2, 'cool', 'med'],  [6, 4, 'warm', 'slow'], [2, 6, 'cool', 'fast'],
  [4, 5, 'warm', 'med'],  [0, 2, 'cool', 'slow'], [5, 6, 'warm', 'fast'],
];

const RIGHT_WINDOWS: [number, number, WinHue, WinSpeed][] = [
  [1, 2, 'cool', 'fast'],  [2, 0, 'warm', 'slow'], [3, 4, 'cool', 'med'],
  [4, 1, 'warm', 'fast'],  [5, 3, 'cool', 'slow'], [6, 0, 'warm', 'med'],
  [0, 5, 'cool', 'fast'],  [1, 3, 'warm', 'slow'], [4, 2, 'cool', 'med'],
  [6, 5, 'warm', 'fast'],  [2, 4, 'cool', 'slow'], [5, 1, 'warm', 'med'],
  [3, 6, 'cool', 'fast'],  [7, 3, 'warm', 'slow'], [6, 2, 'cool', 'fast'],
];

const CYCLE_DUR: Record<WinSpeed, number> = { slow: 4.5, med: 2.8, fast: 1.6 };

// 28 staggered delays (prime-spaced) so no two windows flicker together
const DELAYS = [
  0.00, 0.30, 0.73, 1.10, 1.51, 0.87, 2.13, 0.41,
  1.79, 2.37, 0.62, 1.28, 2.71, 0.19, 1.03, 2.20,
  0.55, 1.67, 3.01, 0.82, 1.99, 0.13, 1.44, 1.93,
  2.58, 3.30, 0.35, 1.08,
];

// ─── ANIMATED WINDOW COMPONENT ───────────────────────────────────────────
interface LitWindowProps {
  x: number; y: number; w: number; h: number;
  hue: WinHue; speed: WinSpeed; delay: number;
}

const LitWindow: React.FC<LitWindowProps> = ({ x, y, w, h, hue, speed, delay }) => {
  const dur     = CYCLE_DUR[speed];
  const colorOn = hue === 'warm' ? '#FCD34D' : '#93C5FD';

  return (
    <motion.g>
      {/* Soft glow halo (slightly larger, blurred via CSS filter) */}
      <motion.rect
        x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={3}
        fill={colorOn}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.28, 0, 0.25, 0] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'blur(5px)' }}
      />
      {/* Core lit window */}
      <motion.rect
        x={x} y={y} width={w} height={h} rx={1.5}
        fill={colorOn}
        initial={{ opacity: 0.06 }}
        animate={{ opacity: [0.06, 0.88, 0.06, 0.82, 0.06] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Glass-glare: top-left corner highlight */}
      <motion.rect
        x={x + 1} y={y + 1} width={Math.floor(w * 0.45)} height={Math.floor(h * 0.35)} rx={1}
        fill="#ffffff"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.42, 0, 0.38, 0] }}
        transition={{ duration: dur, delay: delay + 0.06, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.g>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
export const Hero3D = () => {
  const { language } = useTranslation();
  const textPrice = language === 'vn' ? '24.5 Tỷ' : '$2.45M';
  const textMatch = language === 'vn' ? 'Độ khớp 98%' : '98% Match';
  const textTrend = language === 'vn' ? '↑ +5.2% / Năm' : '↑ +5.2% YoY';

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/30 blur-[100px] rounded-full pointer-events-none" />

      <motion.svg
        viewBox="0 0 800 650"
        className="w-full h-auto drop-shadow-2xl relative z-10"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        <defs>
          <linearGradient id="glassLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="glassRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="glassTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="glassLeftSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312E81" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="glassRightSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="glassTopSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="aiHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
            <stop offset="50%" stopColor="#34D399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>

          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="shadowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
        </defs>

        {/* ── ISOMETRIC GRID BASE ── */}
        <g transform="translate(400, 490) scale(1, 0.5) rotate(45)" opacity="0.35">
          <rect x="-220" y="-220" width="440" height="440" fill="rgba(99,102,241,0.04)" stroke="#6366F1" strokeWidth="2" />
          {Array.from({ length: 11 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1="-220" y1={-220 + i * 44} x2="220" y2={-220 + i * 44} stroke="#6366F1" strokeWidth="1" opacity="0.3" />
              <line x1={-220 + i * 44} y1="-220" x2={-220 + i * 44} y2="220" stroke="#6366F1" strokeWidth="1" opacity="0.3" />
            </React.Fragment>
          ))}
          <rect x="-100" y="-100" width="200" height="200" fill="rgba(16,185,129,0.08)" stroke="#10B981" strokeWidth="2" filter="url(#glow)" />
        </g>

        {/* ── GROUND SHADOW ── */}
        <ellipse cx="400" cy="480" rx="170" ry="55" fill="rgba(0,0,0,0.35)" filter="url(#shadowBlur)" />

        {/* ── SECONDARY BUILDING ── */}
        <g transform="translate(-140, 80)">
          <polygon points="400,380 320,340 320,220 400,260" fill="url(#glassLeftSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,380 480,340 480,220 400,260" fill="url(#glassRightSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,260 320,220 400,180 480,220" fill="url(#glassTopSmall)" stroke="#312E81" strokeWidth="1" />
          <polyline points="320,340 400,380 480,340" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinejoin="round" />
          <line x1="400" y1="380" x2="400" y2="260" stroke="#312E81" strokeWidth="2" />
          {/* Secondary building animated windows */}
          {([
            [338, 298, 'warm', 1.2, 2.8], [356, 273, 'cool', 2.0, 4.5],
            [428, 302, 'warm', 0.6, 1.6], [448, 274, 'cool', 1.8, 2.8], [370, 315, 'warm', 3.1, 4.5],
          ] as [number, number, WinHue, number, number][]).map(([wx, wy, hue, dl, dur], i) => {
            const colorOn = hue === 'warm' ? '#FCD34D' : '#93C5FD';
            return (
              <motion.g key={`sb-${i}`}>
                <motion.rect x={wx - 1} y={wy - 1} width={13} height={9} rx={2}
                  fill={colorOn}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0, 0.28, 0] }}
                  transition={{ duration: dur, delay: dl, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ filter: 'blur(3px)' }}
                />
                <motion.rect x={wx} y={wy} width={11} height={7} rx={1}
                  fill={colorOn}
                  initial={{ opacity: 0.06 }}
                  animate={{ opacity: [0.06, 0.85, 0.06, 0.80, 0.06] }}
                  transition={{ duration: dur, delay: dl, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.g>
            );
          })}
        </g>

        {/* ── MAIN BUILDING FACES ── */}
        {/* Left face */}
        <polygon points="400,440 240,360 240,120 400,200" fill="url(#glassLeft)" stroke="#0F172A" strokeWidth="1" />
        {/* Right face */}
        <polygon points="400,440 560,360 560,120 400,200" fill="url(#glassRight)" stroke="#0F172A" strokeWidth="1" />
        {/* Top face */}
        <polygon points="400,200 240,120 400,40 560,120" fill="url(#glassTop)" stroke="#334155" strokeWidth="1.5" />

        {/* Structural edge lines */}
        <polyline points="240,360 400,440 560,360" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="400" y1="440" x2="400" y2="200" stroke="#334155" strokeWidth="2" />

        {/* ── WINDOW GRID LINES — Left face ── */}
        {/* Vertical lines (screen-x columns) */}
        <path d="M 260,350 L 260,130 M 280,360 L 280,140 M 300,370 L 300,150 M 320,380 L 320,160 M 340,390 L 340,170 M 360,400 L 360,180 M 380,410 L 380,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        {/* Horizontal (isometric-sloped) lines */}
        <path d="M 240,330 L 400,410 M 240,300 L 400,380 M 240,270 L 400,350 M 240,240 L 400,320 M 240,210 L 400,290 M 240,180 L 400,260 M 240,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* ── ANIMATED LIT WINDOWS — Left face ── */}
        {LEFT_WINDOWS.map(([col, row, hue, speed], i) => {
          const wp = getLeftWindowPos(col, row);
          return (
            <LitWindow key={`wl-${i}`}
              x={wp.x} y={wp.y} w={wp.w} h={wp.h}
              hue={hue} speed={speed}
              delay={DELAYS[i % DELAYS.length]}
            />
          );
        })}

        {/* ── WINDOW GRID LINES — Right face ── */}
        <path d="M 540,350 L 540,130 M 520,360 L 520,140 M 500,370 L 500,150 M 480,380 L 480,160 M 460,390 L 460,170 M 440,400 L 440,180 M 420,410 L 420,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        <path d="M 560,330 L 400,410 M 560,300 L 400,380 M 560,270 L 400,350 M 560,240 L 400,320 M 560,210 L 400,290 M 560,180 L 400,260 M 560,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* ── ANIMATED LIT WINDOWS — Right face ── */}
        {RIGHT_WINDOWS.map(([col, row, hue, speed], i) => {
          const wp = getRightWindowPos(col, row);
          return (
            <LitWindow key={`wr-${i}`}
              x={wp.x} y={wp.y} w={wp.w} h={wp.h}
              hue={hue} speed={speed}
              delay={DELAYS[(i + 8) % DELAYS.length]}
            />
          );
        })}

        {/* Top edge highlights */}
        <polyline points="240,120 400,40 560,120" fill="none" stroke="#6366F1" strokeWidth="1.5" opacity="0.5" filter="url(#glow)" />
        <polyline points="240,120 400,200 560,120" fill="none" stroke="#475569" strokeWidth="1" opacity="0.4" />

        {/* ── AI SCANNING LASER — sweeps building body top→bottom ── */}
        <motion.g
          animate={{ y: [0, 320, 0], opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        >
          <polygon points="240,120 400,200 400,210 240,130" fill="url(#emeraldGlow)" opacity="0.25" />
          <polygon points="400,200 560,120 560,130 400,210" fill="url(#emeraldGlow)" opacity="0.25" />
          <polyline points="240,120 400,200 560,120" fill="none" stroke="#10B981" strokeWidth="2.5" filter="url(#glow)" opacity="0.9" />
          <circle cx="400" cy="200" r="4" fill="#fff" filter="url(#glow)" />
          <circle cx="240" cy="120" r="3" fill="#10B981" filter="url(#glow)" />
          <circle cx="560" cy="120" r="3" fill="#10B981" filter="url(#glow)" />
        </motion.g>

        {/* ── LOCATION PIN ── */}
        <motion.g animate={{ y: [0, -14, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <ellipse cx="400" cy="58" rx="18" ry="8" fill="rgba(0,0,0,0.35)" filter="url(#shadowBlur)" />
          <path d="M400,20 C380,20 365,35 365,55 C365,80 400,120 400,120 C400,120 435,80 435,55 C435,35 420,20 400,20 Z"
            fill="url(#aiHighlight)" filter="url(#glow)" opacity="0.95" />
          <circle cx="400" cy="55" r="13" fill="#fff" opacity="0.95" />
          <circle cx="400" cy="55" r="7" fill="#6366F1" />
          <circle cx="400" cy="55" r="3" fill="#fff" opacity="0.8" />
        </motion.g>

        {/* ── DATA TAG 1: Price ── */}
        <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
          <line x1="560" y1="240" x2="628" y2="192" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <circle cx="628" cy="192" r="4.5" fill="#8B5CF6" filter="url(#glow)" />
          <rect x="640" y="170" width="110" height="44" rx="8" fill="#1E293B" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="695" y="188" fill="#A78BFA" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1">GIÁ ƯỚC TÍNH</text>
          <text x="695" y="206" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textPrice}</text>
        </motion.g>

        {/* ── DATA TAG 2: Match ── */}
        <motion.g animate={{ y: [0, -12, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <line x1="240" y1="280" x2="162" y2="232" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <circle cx="162" cy="232" r="4.5" fill="#10B981" filter="url(#glow)" />
          <rect x="30" y="210" width="127" height="44" rx="8" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" />
          <text x="93" y="228" fill="#34D399" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1">ĐỘ CHÍNH XÁC</text>
          <text x="93" y="246" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textMatch}</text>
        </motion.g>

        {/* ── DATA TAG 3: Trend ── */}
        <motion.g animate={{ y: [0, -10, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
          <line x1="400" y1="445" x2="400" y2="497" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <circle cx="400" cy="497" r="4.5" fill="#3B82F6" filter="url(#glow)" />
          <rect x="326" y="505" width="148" height="44" rx="8" fill="#1E293B" stroke="#3B82F6" strokeWidth="1.5" />
          <text x="400" y="523" fill="#93C5FD" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1">XU HƯỚNG THỊ TRƯỜNG</text>
          <text x="400" y="541" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textTrend}</text>
        </motion.g>

      </motion.svg>
    </div>
  );
};
