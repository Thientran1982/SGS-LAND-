import React, { memo } from 'react';
import { useTranslation } from '../services/i18n';

interface LogoProps {
    className?: string;
    strokeWidth?: number;
    fill?: string;
    'aria-label'?: string;
}

export const Logo: React.FC<LogoProps> = memo(({ 
    className = "w-6 h-6", 
    strokeWidth = 2, 
    fill = "none",
    'aria-label': ariaLabel
}) => {
    const { t } = useTranslation();
    // Fallback localization for accessibility
    const label = ariaLabel || t('nav.logo_label');

    return (
        <svg 
            className={`transition-transform duration-300 ${className}`}
            viewBox="0 0 24 24" 
            width="24"
            height="24"
            fill={fill}
            stroke="currentColor" 
            strokeWidth={strokeWidth}
            strokeLinecap="round" 
            strokeLinejoin="round"
            role="img"
            aria-label={label}
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>{label}</title>
            {/* Top Layer - The Interface */}
            <path d="M12 2L2 7l10 5 10-5-10-5z" className="opacity-100" />
            {/* Middle Layer - The Data */}
            <path d="M2 12l10 5 10-5" className="opacity-80" />
            {/* Bottom Layer - The Infrastructure */}
            <path d="M2 17l10 5 10-5" className="opacity-60" />
        </svg>
    );
});

Logo.displayName = 'Logo';