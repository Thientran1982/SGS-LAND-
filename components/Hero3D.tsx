import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../services/i18n';

// ─── ISOMETRIC GEOMETRY ────────────────────────────────────────────────────
//
// LEFT FACE  — quadrilateral: (240,120) → (400,200) → (400,440) → (240,360)
//   Grid: 8 cols × 8 rows  |  col-step: 20px-x  |  row-step: 30px-y
//   Isometric slope → going right +20px-x: y shifts +10px  (slope = +0.5)
//   Top-left corner of cell(col, row):
//     x = 240 + col*20
//     y = 120 + row*30 + col*10
//
// RIGHT FACE — quadrilateral: (400,200) → (560,120) → (560,360) → (400,440)
//   Same grid dimensions, slope = -0.5 (y decreases going right)
//   Top-left corner of cell(col, row):
//     x = 400 + col*20
//     y = 200 + row*30 - col*10
//
// Each window is a PARALLELOGRAM polygon (4 corners) so it fits exactly
// inside its cell without crossing the isometric grid lines.
// ─────────────────────────────────────────────────────────────────────────

const PX = 3;   // horizontal padding inside cell
const PY = 4;   // vertical padding inside cell

function leftPoly(col: number, row: number): string {
  const x0 = 240 + col * 20;
  const x1 = 240 + (col + 1) * 20;
  const yTL = 120 + row * 30       + col * 10;
  const yTR = 120 + row * 30       + (col + 1) * 10;
  const yBR = 120 + (row + 1) * 30 + (col + 1) * 10;
  const yBL = 120 + (row + 1) * 30 + col * 10;
  return `${x0 + PX},${yTL + PY} ${x1 - PX},${yTR + PY} ${x1 - PX},${yBR - PY} ${x0 + PX},${yBL - PY}`;
}

function leftGlarePoly(col: number, row: number): string {
  // Top-left quarter of the window cell for glass-glare effect
  const x0 = 240 + col * 20;
  const xM = 240 + col * 20 + 10;   // mid-x
  const yTL = 120 + row * 30       + col * 10;
  const yTM = 120 + row * 30       + (col + 0.5) * 10; // mid top
  const yML = 120 + (row + 0.45) * 30 + col * 10;      // mid left
  const yMM = 120 + (row + 0.45) * 30 + (col + 0.5) * 10;
  return `${x0 + PX + 1},${yTL + PY + 1} ${xM - 1},${yTM + PY + 1} ${xM - 1},${yMM - 1} ${x0 + PX + 1},${yML - 1}`;
}

function rightPoly(col: number, row: number): string {
  const x0 = 400 + col * 20;
  const x1 = 400 + (col + 1) * 20;
  const yTL = 200 + row * 30       - col * 10;
  const yTR = 200 + row * 30       - (col + 1) * 10;
  const yBR = 200 + (row + 1) * 30 - (col + 1) * 10;
  const yBL = 200 + (row + 1) * 30 - col * 10;
  return `${x0 + PX},${yTL + PY} ${x1 - PX},${yTR + PY} ${x1 - PX},${yBR - PY} ${x0 + PX},${yBL - PY}`;
}

function rightGlarePoly(col: number, row: number): string {
  const x0 = 400 + col * 20;
  const xM = 400 + col * 20 + 10;
  const yTL = 200 + row * 30       - col * 10;
  const yTM = 200 + row * 30       - (col + 0.5) * 10;
  const yML = 200 + (row + 0.45) * 30 - col * 10;
  const yMM = 200 + (row + 0.45) * 30 - (col + 0.5) * 10;
  return `${x0 + PX + 1},${yTL + PY + 1} ${xM - 1},${yTM + PY + 1} ${xM - 1},${yMM - 1} ${x0 + PX + 1},${yML - 1}`;
}

// Slightly expanded polygon for the glow halo (padding - 2)
function leftHaloPoly(col: number, row: number): string {
  const p = PX - 2, py = PY - 2;
  const x0 = 240 + col * 20;
  const x1 = 240 + (col + 1) * 20;
  const yTL = 120 + row * 30       + col * 10;
  const yTR = 120 + row * 30       + (col + 1) * 10;
  const yBR = 120 + (row + 1) * 30 + (col + 1) * 10;
  const yBL = 120 + (row + 1) * 30 + col * 10;
  return `${x0 + p},${yTL + py} ${x1 - p},${yTR + py} ${x1 - p},${yBR - py} ${x0 + p},${yBL - py}`;
}

function rightHaloPoly(col: number, row: number): string {
  const p = PX - 2, py = PY - 2;
  const x0 = 400 + col * 20;
  const x1 = 400 + (col + 1) * 20;
  const yTL = 200 + row * 30       - col * 10;
  const yTR = 200 + row * 30       - (col + 1) * 10;
  const yBR = 200 + (row + 1) * 30 - (col + 1) * 10;
  const yBL = 200 + (row + 1) * 30 - col * 10;
  return `${x0 + p},${yTL + py} ${x1 - p},${yTR + py} ${x1 - p},${yBR - py} ${x0 + p},${yBL - py}`;
}

// ─── WINDOW DEFINITIONS ────────────────────────────────────────────────────
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

const DELAYS = [
  0.00, 0.30, 0.73, 1.10, 1.51, 0.87, 2.13, 0.41,
  1.79, 2.37, 0.62, 1.28, 2.71, 0.19, 1.03, 2.20,
  0.55, 1.67, 3.01, 0.82, 1.99, 0.13, 1.44, 1.93,
  2.58, 3.30, 0.35, 1.08,
];

// ─── ANIMATED WINDOW ────────────────────────────────────────────────────────
interface LitWindowProps {
  winPoints:   string;   // parallelogram window polygon
  haloPoints:  string;   // slightly larger polygon for glow halo
  glarePoints: string;   // top-left quarter for glass glare
  hue: WinHue; speed: WinSpeed; delay: number;
}

const LitWindow: React.FC<LitWindowProps> = ({
  winPoints, haloPoints, glarePoints, hue, speed, delay,
}) => {
  const dur     = CYCLE_DUR[speed];
  const colorOn = hue === 'warm' ? '#FCD34D' : '#93C5FD';

  return (
    <motion.g>
      {/* Glow halo — expanded parallelogram, blurred */}
      <motion.g
        filter="url(#winGlow)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0, 0.50, 0] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon points={haloPoints} fill={colorOn} />
      </motion.g>

      {/* Core window — exact parallelogram cell */}
      <motion.g
        initial={{ opacity: 0.05 }}
        animate={{ opacity: [0.05, 0.90, 0.05, 0.85, 0.05] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon points={winPoints} fill={colorOn} />
      </motion.g>

      {/* Glass glare — top-left quarter highlight */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.45, 0, 0.40, 0] }}
        transition={{ duration: dur, delay: delay + 0.06, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon points={glarePoints} fill="#ffffff" />
      </motion.g>
    </motion.g>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
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
            <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="glassRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" /><stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="glassTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="glassLeftSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312E81" /><stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="glassRightSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338CA" /><stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="glassTopSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="aiHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
            <stop offset="50%" stopColor="#34D399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>

          {/* Glow for scan beam / pin */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Glow halo for windows */}
          <filter id="winGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          {/* Shadow blur */}
          <filter id="shadowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
          {/* Clip paths so windows cannot escape their face */}
          <clipPath id="clipLeft">
            <polygon points="400,440 240,360 240,120 400,200" />
          </clipPath>
          <clipPath id="clipRight">
            <polygon points="400,440 560,360 560,120 400,200" />
          </clipPath>
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
          {([
            [338, 298, 'warm', 1.2, 2.8], [356, 273, 'cool', 2.0, 4.5],
            [428, 302, 'warm', 0.6, 1.6], [448, 274, 'cool', 1.8, 2.8], [370, 315, 'warm', 3.1, 4.5],
          ] as [number, number, WinHue, number, number][]).map(([wx, wy, hue, dl, dur], i) => {
            const colorOn = hue === 'warm' ? '#FCD34D' : '#93C5FD';
            return (
              <motion.g key={`sb-${i}`}
                initial={{ opacity: 0.06 }}
                animate={{ opacity: [0.06, 0.85, 0.06, 0.80, 0.06] }}
                transition={{ duration: dur, delay: dl, repeat: Infinity, ease: 'easeInOut' }}
              >
                <rect x={wx} y={wy} width={11} height={7} rx={1} fill={colorOn} />
              </motion.g>
            );
          })}
        </g>

        {/* ── MAIN BUILDING — FACES ── */}
        <polygon points="400,440 240,360 240,120 400,200" fill="url(#glassLeft)" stroke="#0F172A" strokeWidth="1" />
        <polygon points="400,440 560,360 560,120 400,200" fill="url(#glassRight)" stroke="#0F172A" strokeWidth="1" />
        <polygon points="400,200 240,120 400,40 560,120" fill="url(#glassTop)" stroke="#334155" strokeWidth="1.5" />
        <polyline points="240,360 400,440 560,360" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="400" y1="440" x2="400" y2="200" stroke="#334155" strokeWidth="2" />

        {/* ── WINDOW GRID LINES — Left face ── */}
        <path d="M 260,370 L 260,130 M 280,380 L 280,140 M 300,390 L 300,150 M 320,400 L 320,160 M 340,410 L 340,170 M 360,420 L 360,180 M 380,430 L 380,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        <path d="M 240,330 L 400,410 M 240,300 L 400,380 M 240,270 L 400,350 M 240,240 L 400,320 M 240,210 L 400,290 M 240,180 L 400,260 M 240,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* ── ANIMATED WINDOWS — Left face (clipped to face boundary) ── */}
        <g clipPath="url(#clipLeft)">
          {LEFT_WINDOWS.map(([col, row, hue, speed], i) => (
            <LitWindow key={`wl-${i}`}
              winPoints={leftPoly(col, row)}
              haloPoints={leftHaloPoly(col, row)}
              glarePoints={leftGlarePoly(col, row)}
              hue={hue} speed={speed}
              delay={DELAYS[i % DELAYS.length]}
            />
          ))}
        </g>

        {/* ── WINDOW GRID LINES — Right face ── */}
        <path d="M 540,370 L 540,130 M 520,380 L 520,140 M 500,390 L 500,150 M 480,400 L 480,160 M 460,410 L 460,170 M 440,420 L 440,180 M 420,430 L 420,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        <path d="M 560,330 L 400,410 M 560,300 L 400,380 M 560,270 L 400,350 M 560,240 L 400,320 M 560,210 L 400,290 M 560,180 L 400,260 M 560,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* ── ANIMATED WINDOWS — Right face (clipped to face boundary) ── */}
        <g clipPath="url(#clipRight)">
          {RIGHT_WINDOWS.map(([col, row, hue, speed], i) => (
            <LitWindow key={`wr-${i}`}
              winPoints={rightPoly(col, row)}
              haloPoints={rightHaloPoly(col, row)}
              glarePoints={rightGlarePoly(col, row)}
              hue={hue} speed={speed}
              delay={DELAYS[(i + 8) % DELAYS.length]}
            />
          ))}
        </g>

        {/* Top edge highlights */}
        <polyline points="240,120 400,40 560,120" fill="none" stroke="#6366F1" strokeWidth="1.5" opacity="0.5" filter="url(#glow)" />
        <polyline points="240,120 400,200 560,120" fill="none" stroke="#475569" strokeWidth="1" opacity="0.4" />

        {/* ── AI SCANNING LASER ── */}
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
