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
    'aria-label': ariaLabel
}) => {
    const { t } = useTranslation();
    const label = ariaLabel || t('nav.logo_label');
    return (
        <img
            src="/logo-icon.png"
            alt={label}
            role="img"
            aria-label={label}
            className={`object-contain transition-transform duration-300 ${className}`}
            draggable={false}
        />
    );
});

Logo.displayName = 'Logo';
