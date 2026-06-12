import React, { memo } from 'react';
import { useTranslation } from '../services/i18n';

interface LogoProps {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  variant?: 'white' | 'navy';
  'aria-label'?: string;
}

export const Logo: React.FC<LogoProps> = memo(({
    className = "w-6 h-6",
    variant = 'white',
    'aria-label': ariaLabel
}) => {
    const { t } = useTranslation();
    const label = ariaLabel || t('nav.logo_label');
    const src = variant === 'navy' ? '/logo-navy.png' : '/logo-white.png';
    return (
        <img
            src={src}
            alt={label}
            role="img"
            aria-label={label}
            className={`object-contain transition-transform duration-300 ${className}`}
            draggable={false}
        />
    );
});

Logo.displayName = 'Logo';
