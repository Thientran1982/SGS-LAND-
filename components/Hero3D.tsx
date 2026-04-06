import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../services/i18n';

// ─── ISOMETRIC WINDOW GEOMETRY ────────────────────────────────────────────
// LEFT FACE  (240,120)→(400,200)→(400,440)→(240,360)
//   col step: 20px-x  |  row step: 30px-y  |  slope: +10px-y per col
// RIGHT FACE (400,200)→(560,120)→(560,360)→(400,440)
//   col step: 20px-x  |  row step: 30px-y  |  slope: −10px-y per col
const PX = 3;
const PY = 4;

function leftPoly(col: number, row: number): string {
  const x0 = 240 + col * 20, x1 = 240 + (col + 1) * 20;
  const yTL = 120 + row * 30 + col * 10,         yTR = 120 + row * 30 + (col + 1) * 10;
  const yBL = 120 + (row + 1) * 30 + col * 10,   yBR = 120 + (row + 1) * 30 + (col + 1) * 10;
  return `${x0+PX},${yTL+PY} ${x1-PX},${yTR+PY} ${x1-PX},${yBR-PY} ${x0+PX},${yBL-PY}`;
}
function leftHaloPoly(col: number, row: number): string {
  const p = 1, py = 2;
  const x0 = 240 + col * 20, x1 = 240 + (col + 1) * 20;
  const yTL = 120 + row * 30 + col * 10,         yTR = 120 + row * 30 + (col + 1) * 10;
  const yBL = 120 + (row + 1) * 30 + col * 10,   yBR = 120 + (row + 1) * 30 + (col + 1) * 10;
  return `${x0+p},${yTL+py} ${x1-p},${yTR+py} ${x1-p},${yBR-py} ${x0+p},${yBL-py}`;
}
function leftGlarePoly(col: number, row: number): string {
  const x0 = 240 + col * 20, xM = 240 + col * 20 + 10;
  const yTL = 120 + row * 30 + col * 10, yTM = 120 + row * 30 + (col + 0.5) * 10;
  const yML = 120 + (row + 0.4) * 30 + col * 10, yMM = 120 + (row + 0.4) * 30 + (col + 0.5) * 10;
  return `${x0+PX+1},${yTL+PY+1} ${xM-1},${yTM+PY+1} ${xM-1},${yMM-1} ${x0+PX+1},${yML-1}`;
}
function rightPoly(col: number, row: number): string {
  const x0 = 400 + col * 20, x1 = 400 + (col + 1) * 20;
  const yTL = 200 + row * 30 - col * 10,         yTR = 200 + row * 30 - (col + 1) * 10;
  const yBL = 200 + (row + 1) * 30 - col * 10,   yBR = 200 + (row + 1) * 30 - (col + 1) * 10;
  return `${x0+PX},${yTL+PY} ${x1-PX},${yTR+PY} ${x1-PX},${yBR-PY} ${x0+PX},${yBL-PY}`;
}
function rightHaloPoly(col: number, row: number): string {
  const p = 1, py = 2;
  const x0 = 400 + col * 20, x1 = 400 + (col + 1) * 20;
  const yTL = 200 + row * 30 - col * 10,         yTR = 200 + row * 30 - (col + 1) * 10;
  const yBL = 200 + (row + 1) * 30 - col * 10,   yBR = 200 + (row + 1) * 30 - (col + 1) * 10;
  return `${x0+p},${yTL+py} ${x1-p},${yTR+py} ${x1-p},${yBR-py} ${x0+p},${yBL-py}`;
}
function rightGlarePoly(col: number, row: number): string {
  const x0 = 400 + col * 20, xM = 400 + col * 20 + 10;
  const yTL = 200 + row * 30 - col * 10, yTM = 200 + row * 30 - (col + 0.5) * 10;
  const yML = 200 + (row + 0.4) * 30 - col * 10, yMM = 200 + (row + 0.4) * 30 - (col + 0.5) * 10;
  return `${x0+PX+1},${yTL+PY+1} ${xM-1},${yTM+PY+1} ${xM-1},${yMM-1} ${x0+PX+1},${yML-1}`;
}

// ─── WINDOW DEFINITIONS ───────────────────────────────────────────────────
type WinHue = 'warm' | 'cool';

// warm = đèn vàng (2700K), cool = đèn LED trắng (4000K)
const WIN_COLOR: Record<WinHue, { fill: string; glare: string }> = {
  warm: { fill: '#FEF9C3', glare: '#FFFFFF' },
  cool: { fill: '#EFF6FF', glare: '#FFFFFF' },
};

// Clean regular grid: cols 1–6, rows 1–6, alternating hue by checkerboard
// [col, row, hue]
const LEFT_WINDOWS: [number, number, WinHue][] = [];
const RIGHT_WINDOWS: [number, number, WinHue][] = [];
for (let row = 1; row <= 6; row++) {
  for (let col = 1; col <= 6; col++) {
    const hue: WinHue = (col + row) % 2 === 0 ? 'warm' : 'cool';
    LEFT_WINDOWS.push([col, row, hue]);
    RIGHT_WINDOWS.push([col, row, hue]);
  }
}

// ─── WINDOW ───────────────────────────────────────────────────────────────
interface LitWindowProps {
  winPts: string; haloPts: string; glarePts: string;
  hue: WinHue; isLaserActive: boolean;
}
const LitWindow = React.memo<LitWindowProps>(({ winPts, haloPts, glarePts, hue, isLaserActive }) => {
  const { fill, glare } = WIN_COLOR[hue];
  return (
    <g>
      {/* Static dim base — always visible, no blinking */}
      <polygon points={winPts} fill={fill} opacity="0.10" />

      {/* Laser scan flash — sáng emerald khi laser qua hàng này */}
      {isLaserActive && (
        <motion.g
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <polygon points={haloPts} fill="#34D399" filter="url(#winGlow)" />
          <polygon points={winPts} fill="#6EE7B7" opacity="0.90" />
          <polygon points={glarePts} fill={glare} opacity="0.65" />
        </motion.g>
      )}
    </g>
  );
});

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export const Hero3D = () => {
  const { language } = useTranslation();

  // ── Laser row tracker — syncs window glow with scan position ──────────
  // Laser animation: y=[0,320,0] over 3.5s → each of 8 rows = 30px
  // Row R is active when laserY ∈ [R×30, (R+1)×30)
  const [laserRow, setLaserRow] = useState(-1);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    const PERIOD = 3500; // ms — matches motion animation duration
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) % PERIOD;
      // 0→0.5 going down, 0.5→1 going up
      const phase = elapsed / PERIOD;
      const laserY = phase < 0.5 ? phase * 2 * 320 : (1 - phase) * 2 * 320;
      const row = Math.floor(laserY / 30);
      setLaserRow(prev => {
        const next = row >= 0 && row <= 7 ? row : -1;
        return prev !== next ? next : prev;
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // ── Floor indicator label — follows laser, T8 (top) → T1 (bottom)
  const floorLabel = laserRow >= 0 ? `T${8 - laserRow}` : 'T—';
  // ── Target floors: rows 3-4-5 = "tầng đang xem xét" (T5→T3)
  const TARGET_ROWS = new Set([3, 4, 5]);

  const textPrice = language === 'vn' ? '24.5 Tỷ' : '$2.45M';
  const textMatch = language === 'vn' ? 'Độ khớp 98%' : '98% Match';
  const textTrend = language === 'vn' ? '↑ +5.2% / Năm' : '↑ +5.2% YoY';
  const labelPrice = language === 'vn' ? 'GIÁ ƯỚC TÍNH' : 'EST. PRICE';
  const labelMatch = language === 'vn' ? 'ĐỘ CHÍNH XÁC' : 'ACCURACY';
  const labelTrend = language === 'vn' ? 'XU HƯỚNG THỊ TRƯỜNG' : 'MARKET TREND';

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Primary orb — behind building roof, centered */}
      <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[52%] h-[48%] bg-indigo-500/22 dark:bg-indigo-400/28 blur-[72px] rounded-full pointer-events-none" />
      {/* Accent orb — behind price data tag (right side, violet) */}
      <div className="absolute top-[22%] right-[4%] w-[24%] h-[32%] bg-violet-500/14 dark:bg-violet-400/18 blur-[56px] rounded-full pointer-events-none" />
      {/* Accent orb — behind match data tag (left side, emerald) */}
      <div className="absolute top-[32%] left-[4%] w-[20%] h-[28%] bg-emerald-500/10 dark:bg-emerald-400/14 blur-[48px] rounded-full pointer-events-none" />

      <motion.svg viewBox="0 0 800 650" className="w-full h-auto drop-shadow-2xl relative z-10"
        role="img" aria-label={language === 'vn' ? 'Minh họa tòa nhà 3D với dữ liệu định giá AI' : '3D building illustration with AI valuation data'}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
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
          {/* Road gradient */}
          <linearGradient id="roadH" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0.3" />
            <stop offset="30%" stopColor="#0F172A" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#0F172A" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="roadV" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0.3" />
            <stop offset="30%" stopColor="#0F172A" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#0F172A" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.3" />
          </linearGradient>

          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="winGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="shadowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
          <filter id="lotGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <clipPath id="clipLeft">
            <polygon points="400,440 240,360 240,120 400,200" />
          </clipPath>
          <clipPath id="clipRight">
            <polygon points="400,440 560,360 560,120 400,200" />
          </clipPath>
        </defs>

        {/* ══ GROUND LEVEL — CITY BLOCK DETAIL ══════════════════════════ */}
        {/*  Local space: centered at 0,0 — 440×440 visible area          */}
        {/*  Transform: translate(400,490) scale(1,0.5) rotate(45)         */}
        <g transform="translate(400, 490) scale(1, 0.5) rotate(45)" opacity="0.9">

          {/* Base ground plane */}
          <rect x="-220" y="-220" width="440" height="440"
            fill="rgba(15,23,42,0.25)" stroke="#334155" strokeWidth="1.5" />

          {/* Fine grid */}
          {Array.from({ length: 11 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1="-220" y1={-220 + i * 44} x2="220" y2={-220 + i * 44}
                stroke="#172554" strokeWidth="0.8" opacity="0.5" />
              <line x1={-220 + i * 44} y1="-220" x2={-220 + i * 44} y2="220"
                stroke="#172554" strokeWidth="0.8" opacity="0.5" />
            </React.Fragment>
          ))}

          {/* ── ROADS ── */}
          {/* E-W main road */}
          <rect x="-220" y="-16" width="440" height="32" fill="url(#roadH)" />
          {/* N-S main road */}
          <rect x="-16" y="-220" width="32" height="440" fill="url(#roadV)" />
          {/* Intersection */}
          <rect x="-16" y="-16" width="32" height="32" fill="#0F172A" opacity="0.9" />
          {/* Road center-line dashes */}
          <line x1="-220" y1="0" x2="-20" y2="0" stroke="#475569" strokeWidth="1.5"
            strokeDasharray="14 9" opacity="0.55" />
          <line x1="20" y1="0" x2="220" y2="0" stroke="#475569" strokeWidth="1.5"
            strokeDasharray="14 9" opacity="0.55" />
          <line x1="0" y1="-220" x2="0" y2="-20" stroke="#475569" strokeWidth="1.5"
            strokeDasharray="14 9" opacity="0.55" />
          <line x1="0" y1="20" x2="0" y2="220" stroke="#475569" strokeWidth="1.5"
            strokeDasharray="14 9" opacity="0.55" />
          {/* Sidewalk edges */}
          <rect x="-220" y="-20" width="440" height="3" fill="#1E293B" opacity="0.7" />
          <rect x="-220" y="17" width="440" height="3" fill="#1E293B" opacity="0.7" />
          <rect x="-20" y="-220" width="3" height="440" fill="#1E293B" opacity="0.7" />
          <rect x="17" y="-220" width="3" height="440" fill="#1E293B" opacity="0.7" />
          {/* Roundabout at intersection */}
          <circle cx="0" cy="0" r="10" fill="none" stroke="#475569" strokeWidth="2" opacity="0.5" />
          <circle cx="0" cy="0" r="4" fill="#1E293B" opacity="0.7" />

          {/* ── PROPERTY LOTS ── */}
          {/* NW block — PRIMARY (emerald, highlighted) — main property */}
          <rect x="-210" y="-210" width="186" height="186"
            fill="rgba(16,185,129,0.10)" stroke="#10B981" strokeWidth="2" />
          {/* Inner sub-lot */}
          <rect x="-170" y="-170" width="100" height="100"
            fill="rgba(16,185,129,0.18)" stroke="#34D399" strokeWidth="1.5"
            filter="url(#lotGlow)" />
          {/* Building footprint marker */}
          <rect x="-80" y="-120" width="40" height="40"
            fill="rgba(16,185,129,0.35)" stroke="#6EE7B7" strokeWidth="1.5" />

          {/* NE block — indigo */}
          <rect x="24" y="-210" width="186" height="186"
            fill="rgba(99,102,241,0.07)" stroke="#6366F1" strokeWidth="1.5" opacity="0.75" />
          <rect x="60" y="-170" width="90" height="90"
            fill="rgba(99,102,241,0.10)" stroke="#818CF8" strokeWidth="1" opacity="0.6" />

          {/* SW block — violet */}
          <rect x="-210" y="24" width="186" height="186"
            fill="rgba(139,92,246,0.07)" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.65" />
          <rect x="-170" y="60" width="90" height="90"
            fill="rgba(139,92,246,0.10)" stroke="#A78BFA" strokeWidth="1" opacity="0.55" />

          {/* SE block — blue */}
          <rect x="24" y="24" width="186" height="186"
            fill="rgba(59,130,246,0.06)" stroke="#3B82F6" strokeWidth="1.5" opacity="0.55" />
          <rect x="60" y="60" width="90" height="90"
            fill="rgba(59,130,246,0.08)" stroke="#60A5FA" strokeWidth="1" opacity="0.5" />

          {/* ── TREES (circles at block corners) ── */}
          {[[-195,-195],[ 195,-195],[-195,195],[195,195],
            [-110,-110],[110,-110],[-110,110],[110,110]
          ].map(([tx,ty],i)=>(
            <g key={`tr-${i}`}>
              <circle cx={tx} cy={ty} r={i < 4 ? 7 : 5}
                fill="#065F46" opacity={i < 4 ? 0.7 : 0.5} />
              <circle cx={tx} cy={ty} r={i < 4 ? 4 : 3}
                fill="#10B981" opacity={i < 4 ? 0.6 : 0.45} />
            </g>
          ))}

          {/* ── PROPERTY BOUNDARY PINS (small markers on lots) ── */}
          {[[-140,-140],[80,-140],[-140,80]].map(([px,py],i)=>(
            <g key={`pin-${i}`}>
              <circle cx={px} cy={py} r={5}
                fill={['#10B981','#6366F1','#8B5CF6'][i]} opacity="0.9" />
              <circle cx={px} cy={py} r={2.5} fill="#fff" opacity="0.8" />
            </g>
          ))}

          {/* ── MOVING VEHICLES ── */}
          {/* E-W road — car going east (left → right, upper lane y=−7) */}
          <motion.g animate={{ x: [-195, 195] }} transition={{ duration: 9, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}>
            <rect x="-9" y="-10" width="18" height="8" rx="2" fill="#334155" opacity="0.85" />
            <rect x="-6" y="-9" width="5" height="3" rx="0.5" fill="#BFDBFE" opacity="0.7" />
            <rect x="3" y="-9" width="4" height="3" rx="0.5" fill="#BFDBFE" opacity="0.7" />
          </motion.g>
          {/* E-W road — car going west (right → left, lower lane y=+4) */}
          <motion.g animate={{ x: [195, -195] }} transition={{ duration: 11, delay: 3.5, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}>
            <rect x="-9" y="4" width="18" height="8" rx="2" fill="#1E3A5F" opacity="0.80" />
            <rect x="-6" y="5" width="5" height="3" rx="0.5" fill="#FCD34D" opacity="0.7" />
            <rect x="3" y="5" width="4" height="3" rx="0.5" fill="#FCD34D" opacity="0.7" />
          </motion.g>
          {/* N-S road — car going south (top → bottom, right lane x=+5) */}
          <motion.g animate={{ y: [-195, 195] }} transition={{ duration: 13, delay: 1.5, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}>
            <rect x="4" y="-9" width="8" height="18" rx="2" fill="#0F3460" opacity="0.80" />
            <rect x="5" y="-6" width="3" height="5" rx="0.5" fill="#93C5FD" opacity="0.7" />
            <rect x="5" y="3" width="3" height="4" rx="0.5" fill="#93C5FD" opacity="0.7" />
          </motion.g>

        </g>

        {/* ── GROUND SHADOW ── */}
        <ellipse cx="400" cy="478" rx="165" ry="52" fill="rgba(0,0,0,0.30)" filter="url(#shadowBlur)" />

        {/* ══ SECONDARY BUILDING ══════════════════════════════════════════ */}
        <g transform="translate(-140, 80)">
          <polygon points="400,380 320,340 320,220 400,260" fill="url(#glassLeftSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,380 480,340 480,220 400,260" fill="url(#glassRightSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,260 320,220 400,180 480,220" fill="url(#glassTopSmall)" stroke="#312E81" strokeWidth="1" />
          <polyline points="320,340 400,380 480,340" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinejoin="round" />
          <line x1="400" y1="380" x2="400" y2="260" stroke="#312E81" strokeWidth="2" />
          {([
            [338,298,'warm',1.5,7],[356,273,'cool',3.2,8],
            [428,302,'warm',0.8,6],[448,274,'cool',2.4,7],[370,315,'warm',4.0,8],
          ] as [number,number,WinHue,number,number][]).map(([wx,wy,hue,dl,dur],i)=>(
            <motion.g key={`sb-${i}`}
              initial={{ opacity: 0.04 }}
              animate={{ opacity: [0.04, 0.85, 0.85, 0.85, 0.04] }}
              transition={{ duration: dur, delay: dl, repeat: Infinity, ease: 'easeInOut' }}
            >
              <rect x={wx} y={wy} width={11} height={7} rx={1}
                fill={WIN_COLOR[hue].fill} />
            </motion.g>
          ))}
        </g>

        {/* ══ MAIN BUILDING FACES ══════════════════════════════════════════ */}
        <polygon points="400,440 240,360 240,120 400,200" fill="url(#glassLeft)"  stroke="#0F172A" strokeWidth="1" />
        <polygon points="400,440 560,360 560,120 400,200" fill="url(#glassRight)" stroke="#0F172A" strokeWidth="1" />
        <polygon points="400,200 240,120 400,40 560,120"  fill="url(#glassTop)"   stroke="#334155" strokeWidth="1.5" />
        <polyline points="240,360 400,440 560,360" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="400" y1="440" x2="400" y2="200" stroke="#334155" strokeWidth="2" />

        {/* Grid lines — Left face */}
        <path d="M 260,370 L 260,130 M 280,380 L 280,140 M 300,390 L 300,150 M 320,400 L 320,160 M 340,410 L 340,170 M 360,420 L 360,180 M 380,430 L 380,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        <path d="M 240,330 L 400,410 M 240,300 L 400,380 M 240,270 L 400,350 M 240,240 L 400,320 M 240,210 L 400,290 M 240,180 L 400,260 M 240,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* Target floor strip — rows 3-4-5, left face (constant subtle indigo) */}
        <polygon points="240,210 400,290 400,380 240,300"
          fill="#6366F1" opacity="0.09" clipPath="url(#clipLeft)" />
        <polygon points="240,210 400,290 400,380 240,300"
          fill="#6366F1" opacity={TARGET_ROWS.has(laserRow) ? 0.07 : 0}
          filter="url(#glow)" clipPath="url(#clipLeft)"
          style={{ transition: 'opacity 0.15s' }} />

        {/* ── Selection bracket — left side, pointing at target floors T3-T5 */}
        <line x1="233" y1="210" x2="233" y2="300" stroke="#818CF8" strokeWidth="2" filter="url(#glow)" opacity="0.8" />
        <line x1="233" y1="210" x2="242" y2="210" stroke="#818CF8" strokeWidth="2" filter="url(#glow)" opacity="0.8" />
        <line x1="233" y1="300" x2="242" y2="300" stroke="#818CF8" strokeWidth="2" filter="url(#glow)" opacity="0.8" />
        <rect x="160" y="246" width="68" height="18" rx="4" fill="#1E1B4B" stroke="#6366F1" strokeWidth="1" opacity="0.93" />
        <text x="194" y="259" fill="#A5B4FC" fontSize="8" fontWeight="bold" textAnchor="middle"
          fontFamily="system-ui,sans-serif" letterSpacing="0.8">T3 – T5</text>

        {/* Windows — Left face */}
        <g clipPath="url(#clipLeft)">
          {LEFT_WINDOWS.map(([col, row, hue], i) => (
            <LitWindow key={`wl-${i}`}
              winPts={leftPoly(col, row)} haloPts={leftHaloPoly(col, row)} glarePts={leftGlarePoly(col, row)}
              hue={hue} isLaserActive={laserRow === row}
            />
          ))}
        </g>

        {/* Grid lines — Right face */}
        <path d="M 540,370 L 540,130 M 520,380 L 520,140 M 500,390 L 500,150 M 480,400 L 480,160 M 460,410 L 460,170 M 440,420 L 440,180 M 420,430 L 420,190"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />
        <path d="M 560,330 L 400,410 M 560,300 L 400,380 M 560,270 L 400,350 M 560,240 L 400,320 M 560,210 L 400,290 M 560,180 L 400,260 M 560,150 L 400,230"
          stroke="#020617" strokeWidth="1.5" opacity="0.55" />

        {/* Target floor strip — rows 3-4-5, right face */}
        <polygon points="400,290 560,210 560,300 400,380"
          fill="#6366F1" opacity="0.09" clipPath="url(#clipRight)" />
        <polygon points="400,290 560,210 560,300 400,380"
          fill="#6366F1" opacity={TARGET_ROWS.has(laserRow) ? 0.07 : 0}
          filter="url(#glow)" clipPath="url(#clipRight)"
          style={{ transition: 'opacity 0.15s' }} />

        {/* Windows — Right face */}
        <g clipPath="url(#clipRight)">
          {RIGHT_WINDOWS.map(([col, row, hue], i) => (
            <LitWindow key={`wr-${i}`}
              winPts={rightPoly(col, row)} haloPts={rightHaloPoly(col, row)} glarePts={rightGlarePoly(col, row)}
              hue={hue} isLaserActive={laserRow === row}
            />
          ))}
        </g>

        {/* Top edge highlights */}
        <polyline points="240,120 400,40 560,120" fill="none" stroke="#6366F1" strokeWidth="2" opacity="0.55" filter="url(#glow)" />
        <polyline points="240,120 400,40 560,120" fill="none" stroke="#818CF8" strokeWidth="0.75" opacity="0.35" />
        <polyline points="240,120 400,200 560,120" fill="none" stroke="#475569" strokeWidth="1" opacity="0.35" />

        {/* ── AI SCANNING LASER ── */}
        <motion.g
          animate={{ y: [0, 320, 0], opacity: [0.15, 1, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        >
          <polygon points="240,120 400,200 400,210 240,130" fill="url(#emeraldGlow)" opacity="0.22" />
          <polygon points="400,200 560,120 560,130 400,210" fill="url(#emeraldGlow)" opacity="0.22" />
          <polyline points="240,120 400,200 560,120" fill="none" stroke="#10B981" strokeWidth="2" filter="url(#glow)" opacity="0.85" />
          {/* Center ridge dot */}
          <circle cx="400" cy="200" r="5.5" fill="#10B981" opacity="0.2" filter="url(#glow)" />
          <circle cx="400" cy="200" r="3.5" fill="#fff" filter="url(#glow)" opacity="0.95" />
          {/* Left corner dot — halo + core */}
          <circle cx="240" cy="120" r="6" fill="#10B981" opacity="0.18" filter="url(#glow)" />
          <circle cx="240" cy="120" r="3" fill="#10B981" filter="url(#glow)" />
          <circle cx="240" cy="120" r="1.2" fill="#fff" opacity="0.85" />
          {/* Right corner dot — halo + core */}
          <circle cx="560" cy="120" r="6" fill="#10B981" opacity="0.18" filter="url(#glow)" />
          <circle cx="560" cy="120" r="3" fill="#10B981" filter="url(#glow)" />
          <circle cx="560" cy="120" r="1.2" fill="#fff" opacity="0.85" />
          {/* ── Floor indicator — pill follows laser ── */}
          <rect x="196" y="112" width="36" height="17" rx="4"
            fill="#0F172A" stroke="#10B981" strokeWidth="1.2" opacity="0.95" />
          <text x="214" y="124.5" fill="#34D399" fontSize="9.5" fontWeight="bold"
            textAnchor="middle" fontFamily="monospace" letterSpacing="0.5">
            {floorLabel}
          </text>
          {/* Tick line from pill to building edge */}
          <line x1="232" y1="120" x2="239" y2="120" stroke="#34D399" strokeWidth="1" opacity="0.7" />
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
        <motion.g animate={{ y: [0,-8,0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
          <line x1="560" y1="240" x2="628" y2="192" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.65" />
          {/* Connector dot — halo + core + white center */}
          <circle cx="628" cy="192" r="8" fill="#8B5CF6" opacity="0.18" filter="url(#glow)" />
          <circle cx="628" cy="192" r="4.5" fill="#8B5CF6" filter="url(#glow)" />
          <circle cx="628" cy="192" r="1.8" fill="#fff" opacity="0.9" />
          <rect x="640" y="170" width="114" height="46" rx="9" fill="#1E293B" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.97" />
          <rect x="640" y="170" width="114" height="46" rx="9" fill="url(#aiHighlight)" opacity="0.06" />
          <text x="697" y="188" fill="#A78BFA" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1.2">{labelPrice}</text>
          <text x="697" y="207" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textPrice}</text>
        </motion.g>

        {/* ── DATA TAG 2: Match ── */}
        <motion.g animate={{ y: [0,-12,0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <line x1="240" y1="280" x2="162" y2="232" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.65" />
          {/* Connector dot — halo + core + white center */}
          <circle cx="162" cy="232" r="8" fill="#10B981" opacity="0.18" filter="url(#glow)" />
          <circle cx="162" cy="232" r="4.5" fill="#10B981" filter="url(#glow)" />
          <circle cx="162" cy="232" r="1.8" fill="#fff" opacity="0.9" />
          <rect x="28" y="210" width="130" height="46" rx="9" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" opacity="0.97" />
          <rect x="28" y="210" width="130" height="46" rx="9" fill="#10B981" opacity="0.05" />
          <text x="93" y="228" fill="#34D399" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1.2">{labelMatch}</text>
          <text x="93" y="247" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textMatch}</text>
        </motion.g>

        {/* ── DATA TAG 3: Trend ── */}
        <motion.g animate={{ y: [0,-10,0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
          <line x1="400" y1="445" x2="400" y2="497" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.65" />
          {/* Connector dot — halo + core + white center */}
          <circle cx="400" cy="497" r="8" fill="#3B82F6" opacity="0.18" filter="url(#glow)" />
          <circle cx="400" cy="497" r="4.5" fill="#3B82F6" filter="url(#glow)" />
          <circle cx="400" cy="497" r="1.8" fill="#fff" opacity="0.9" />
          <rect x="324" y="505" width="152" height="46" rx="9" fill="#1E293B" stroke="#3B82F6" strokeWidth="1.5" opacity="0.97" />
          <rect x="324" y="505" width="152" height="46" rx="9" fill="#3B82F6" opacity="0.05" />
          <text x="400" y="523" fill="#93C5FD" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif" letterSpacing="1.2">{labelTrend}</text>
          <text x="400" y="542" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textTrend}</text>
        </motion.g>

      </motion.svg>
    </div>
  );
};
