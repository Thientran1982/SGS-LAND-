import React from 'react';
import { useTenant } from '../services/tenantContext';

export const TenantSwitcher: React.FC = () => {
    const { tenant } = useTenant();

    if (!import.meta.env.DEV) return null;
    if (!tenant) return null;

    return (
        <div className="flex items-center space-x-2 px-4 py-2 bg-[var(--glass-surface-hover)] dark:bg-white/5 rounded-xl border border-[var(--glass-border)] dark:border-white/10">
            <div className="flex flex-col">
                <span className="text-xs2 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Tenant (dev)
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {tenant.name}
                </span>
            </div>
            <div
                className="w-3 h-3 rounded-full shadow-inner"
                style={{ backgroundColor: 'var(--primary-600)' }}
                title="Tenant Primary Color"
            />
        </div>
    );
};
