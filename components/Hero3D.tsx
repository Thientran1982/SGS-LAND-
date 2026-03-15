import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../services/i18n';

export const Hero3D = () => {
  const { language } = useTranslation();
  
  const textPrice = language === 'vn' ? '24.5 Tỷ' : '$2.45M';
  const textMatch = language === 'vn' ? 'Độ khớp 98%' : '98% Match';
  const textTrend = language === 'vn' ? '↑ +5.2% / Năm' : '↑ +5.2% YoY';

  return (
    <div className="relative w-full max-w-2xl mx-auto perspective-1000">
      {/* Ambient Glow behind the 3D object */}
      <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/30 blur-[100px] rounded-full pointer-events-none"></div>
      
      <motion.svg 
        viewBox="0 0 800 650" 
        className="w-full h-auto drop-shadow-2xl relative z-10"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <defs>
          {/* Gradients for Building Glass */}
          <linearGradient id="glassLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" /> {/* slate-800 */}
            <stop offset="100%" stopColor="#0F172A" /> {/* slate-900 */}
          </linearGradient>
          <linearGradient id="glassRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" /> {/* slate-700 */}
            <stop offset="100%" stopColor="#1E293B" /> {/* slate-800 */}
          </linearGradient>
          <linearGradient id="glassTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" /> {/* slate-600 */}
            <stop offset="100%" stopColor="#334155" /> {/* slate-700 */}
          </linearGradient>

          {/* Gradients for Secondary Building */}
          <linearGradient id="glassLeftSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312E81" /> {/* indigo-900 */}
            <stop offset="100%" stopColor="#1E1B4B" /> {/* indigo-950 */}
          </linearGradient>
          <linearGradient id="glassRightSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338CA" /> {/* indigo-700 */}
            <stop offset="100%" stopColor="#312E81" /> {/* indigo-900 */}
          </linearGradient>
          <linearGradient id="glassTopSmall" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" /> {/* indigo-500 */}
            <stop offset="100%" stopColor="#4F46E5" /> {/* indigo-600 */}
          </linearGradient>

          {/* AI Highlights & Glows */}
          <linearGradient id="aiHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" /> {/* indigo-500 */}
            <stop offset="100%" stopColor="#8B5CF6" /> {/* violet-500 */}
          </linearGradient>
          <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Glowing filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Isometric Grid Base (Land Plot) */}
        <g transform="translate(400, 480) scale(1, 0.5) rotate(45)" opacity="0.4">
          {/* Base plane */}
          <rect x="-220" y="-220" width="440" height="440" fill="rgba(99, 102, 241, 0.05)" stroke="#6366F1" strokeWidth="2" />
          {/* Grid lines */}
          {Array.from({ length: 11 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1="-220" y1={-220 + i * 44} x2="220" y2={-220 + i * 44} stroke="#6366F1" strokeWidth="1" opacity="0.3" />
              <line x1={-220 + i * 44} y1="-220" x2={-220 + i * 44} y2="220" stroke="#6366F1" strokeWidth="1" opacity="0.3" />
            </React.Fragment>
          ))}
          {/* Highlighted Plot */}
          <rect x="-100" y="-100" width="200" height="200" fill="rgba(16, 185, 129, 0.1)" stroke="#10B981" strokeWidth="2" filter="url(#glow)" />
        </g>

        {/* Shadow */}
        <ellipse cx="400" cy="480" rx="160" ry="80" fill="rgba(0,0,0,0.3)" filter="blur(15px)" />

        {/* Secondary Building (Left) */}
        <g transform="translate(-140, 80)">
          <polygon points="400,380 320,340 320,220 400,260" fill="url(#glassLeftSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,380 480,340 480,220 400,260" fill="url(#glassRightSmall)" stroke="#1E1B4B" strokeWidth="1" />
          <polygon points="400,260 320,220 400,180 480,220" fill="url(#glassTopSmall)" stroke="#312E81" strokeWidth="1" />
          
          {/* Front edges for definition */}
          <polyline points="320,340 400,380 480,340" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinejoin="round" />
          <line x1="400" y1="380" x2="400" y2="260" stroke="#312E81" strokeWidth="2" />

          {/* Simple Windows */}
          <path d="M 340,330 L 340,230 M 360,340 L 360,240 M 380,350 L 380,250" stroke="#0F172A" strokeWidth="2" opacity="0.4" />
          <path d="M 420,350 L 420,250 M 440,340 L 440,240 M 460,330 L 460,230" stroke="#0F172A" strokeWidth="2" opacity="0.4" />
        </g>

        {/* Main Skyscraper (Smart Building) */}
        <g>
          {/* Left Face */}
          <polygon points="400,440 240,360 240,120 400,200" fill="url(#glassLeft)" stroke="#0F172A" strokeWidth="1" />
          {/* Right Face */}
          <polygon points="400,440 560,360 560,120 400,200" fill="url(#glassRight)" stroke="#0F172A" strokeWidth="1" />
          {/* Top Face */}
          <polygon points="400,200 240,120 400,40 560,120" fill="url(#glassTop)" stroke="#334155" strokeWidth="1" />

          {/* Front edges for definition */}
          <polyline points="240,360 400,440 560,360" fill="none" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
          <line x1="400" y1="440" x2="400" y2="200" stroke="#334155" strokeWidth="2" />

          {/* Windows / Grid on Left Face */}
          <path d="M 260,350 L 260,130 M 280,360 L 280,140 M 300,370 L 300,150 M 320,380 L 320,160 M 340,390 L 340,170 M 360,400 L 360,180 M 380,410 L 380,190" stroke="#020617" strokeWidth="2" opacity="0.5" />
          <path d="M 240,330 L 400,410 M 240,300 L 400,380 M 240,270 L 400,350 M 240,240 L 400,320 M 240,210 L 400,290 M 240,180 L 400,260 M 240,150 L 400,230" stroke="#020617" strokeWidth="2" opacity="0.5" />

          {/* Windows / Grid on Right Face */}
          <path d="M 540,350 L 540,130 M 520,360 L 520,140 M 500,370 L 500,150 M 480,380 L 480,160 M 460,390 L 460,170 M 440,400 L 440,180 M 420,410 L 420,190" stroke="#020617" strokeWidth="2" opacity="0.5" />
          <path d="M 560,330 L 400,410 M 560,300 L 400,380 M 560,270 L 400,350 M 560,240 L 400,320 M 560,210 L 400,290 M 560,180 L 400,260 M 560,150 L 400,230" stroke="#020617" strokeWidth="2" opacity="0.5" />
        </g>

        {/* AI Scanning Laser Effect */}
        <motion.g
          animate={{ y: [-40, 200, -40], opacity: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          {/* Laser Plane */}
          <polygon points="400,200 220,110 400,20 580,110" fill="url(#emeraldGlow)" opacity="0.15" />
          {/* Laser Edge */}
          <polyline points="220,110 400,200 580,110" fill="none" stroke="#10B981" strokeWidth="3" filter="url(#glow)" />
          {/* Scanning Dots */}
          <circle cx="400" cy="200" r="4" fill="#fff" filter="url(#glow)" />
          <circle cx="220" cy="110" r="3" fill="#10B981" />
          <circle cx="580" cy="110" r="3" fill="#10B981" />
        </motion.g>

        {/* Real Estate Location Pin (Hovering above building) */}
        <motion.g 
          animate={{ y: [0, -15, 0] }} 
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Pin Shadow on Roof */}
          <ellipse cx="400" cy="80" rx="20" ry="10" fill="rgba(0,0,0,0.4)" filter="blur(4px)" />
          
          {/* Pin Body */}
          <path d="M400,20 C380,20 365,35 365,55 C365,80 400,120 400,120 C400,120 435,80 435,55 C435,35 420,20 400,20 Z" fill="url(#aiHighlight)" filter="url(#glow)" opacity="0.9" />
          {/* Pin Inner Circle */}
          <circle cx="400" cy="55" r="12" fill="#fff" />
          <circle cx="400" cy="55" r="6" fill="#6366F1" />
        </motion.g>

        {/* Data Nodes / Valuation Tags */}
        {/* Tag 1: Estimated Price */}
        <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
          <line x1="560" y1="240" x2="640" y2="190" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
          <circle cx="640" cy="190" r="5" fill="#8B5CF6" filter="url(#glow)" />
          <rect x="655" y="175" width="90" height="30" rx="6" fill="#1E293B" stroke="#8B5CF6" strokeWidth="1" />
          <text x="700" y="195" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textPrice}</text>
        </motion.g>

        {/* Tag 2: AI Confidence / Match */}
        <motion.g animate={{ y: [0, -12, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <line x1="240" y1="280" x2="160" y2="230" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
          <circle cx="160" cy="230" r="5" fill="#10B981" filter="url(#glow)" />
          <rect x="45" y="215" width="110" height="30" rx="6" fill="#1E293B" stroke="#10B981" strokeWidth="1" />
          <text x="100" y="235" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textMatch}</text>
        </motion.g>

        {/* Tag 3: Market Trend */}
        <motion.g animate={{ y: [0, -10, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
          <line x1="400" y1="440" x2="400" y2="500" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
          <circle cx="400" cy="500" r="5" fill="#3B82F6" filter="url(#glow)" />
          <rect x="335" y="515" width="130" height="30" rx="6" fill="#1E293B" stroke="#3B82F6" strokeWidth="1" />
          <text x="400" y="535" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{textTrend}</text>
        </motion.g>

      </motion.svg>
    </div>
  );
};
