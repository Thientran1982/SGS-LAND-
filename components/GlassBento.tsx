import React, { useRef, memo } from 'react';

interface BentoCardProps extends React.HTMLAttributes<HTMLElement> {
    title: string;
    value?: number | string;
    subtext?: string;
    trend?: 'up' | 'down';
    trendValue?: string;
    icon?: React.ReactNode;
    accentColor?: string;
    contentClassName?: string; // New prop for content alignment control
    onClick?: () => void;
}

const CONSTANTS = {
    TREND_STYLES: {
        up: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
        down: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400'
    },
    // ADDED rounded-[32px] here to fix the square corners issue
    BASE_CLASS: "glass-card rounded-[32px] p-6 md:p-8 flex flex-col group relative text-left w-full h-full transition-all duration-500 ease-out",
    INTERACTIVE_CLASS: "cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
};

export const GlassBento: React.FC<BentoCardProps> = memo(({ 
    title, 
    value, 
    subtext, 
    trend, 
    trendValue, 
    icon, 
    className = "", 
    children, 
    accentColor = "text-[var(--text-primary)]",
    contentClassName = "justify-end", // Default to bottom alignment for stats cards
    onClick,
    ...props
}) => {
    const containerRef = useRef<HTMLElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        containerRef.current.style.setProperty('--mouse-x', `${x}px`);
        containerRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            ref={containerRef as any}
            onMouseMove={handleMouseMove}
            onClick={onClick}
            onKeyDown={onClick ? handleKeyDown : undefined}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            className={`${CONSTANTS.BASE_CLASS} ${onClick ? CONSTANTS.INTERACTIVE_CLASS : ''} ${className}`}
            {...props}
        >
            {/* Depth Layer - Subtle Gradient for 3D feel - Added rounded-[32px] to match container */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[32px]" />

            <div className="w-full h-full flex flex-col relative z-10">
                <div className="flex justify-between items-start mb-4 w-full flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="text-[var(--text-tertiary)] p-2.5 bg-white/40 dark:bg-white/5 rounded-2xl border border-white/20 shadow-sm group-hover:scale-110 group-hover:text-[var(--primary)] group-hover:bg-white/60 dark:group-hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
                                {icon}
                            </div>
                        )}
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider leading-tight pt-1 select-none">{title}</h3>
                    </div>
                    {trend && (
                        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-sm backdrop-blur-md transition-colors ${CONSTANTS.TREND_STYLES[trend]}`}>
                            <span className="text-xs">{trend === 'up' ? '↗' : '↘'}</span>
                            <span>{trendValue || "0%"}</span>
                        </div>
                    )}
                </div>
                
                {value !== undefined && (
                    <div className="mb-2 animate-enter flex-shrink-0">
                         <div className={`text-4xl md:text-5xl font-extrabold tracking-tighter leading-none ${accentColor} drop-shadow-sm group-hover:scale-[1.02] transition-transform origin-left`}>
                             {value}
                         </div>
                    </div>
                )}
                
                {subtext && (
                    <div className="text-sm text-[var(--text-tertiary)] font-medium leading-relaxed max-w-[95%] flex-shrink-0">
                        {subtext}
                    </div>
                )}

                {/* Content Container: Uses flex-1 and min-h-0 to properly handle internal scrolling */}
                <div className={`flex-1 flex flex-col mt-4 w-full min-h-0 ${contentClassName}`}>
                    {children}
                </div>
            </div>
        </Tag>
    );
});