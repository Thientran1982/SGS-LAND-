import React from 'react';
import { useTenant, MOCK_TENANTS } from '../services/tenantContext';

export const TenantSwitcher: React.FC = () => {
    const { tenant, switchTenant } = useTenant();

    if (!tenant) return null;

    return (
        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Current Tenant
                </span>
                <select 
                    value={tenant.id}
                    onChange={(e) => switchTenant(e.target.value)}
                    className="bg-transparent border-none text-sm font-semibold text-[var(--text-primary)] focus:ring-0 p-0 cursor-pointer"
                >
                    {MOCK_TENANTS.map(t => (
                        <option key={t.id} value={t.id} className="text-slate-900">
                            {t.name}
                        </option>
                    ))}
                </select>
            </div>
            <div 
                className="w-3 h-3 rounded-full shadow-inner" 
                style={{ backgroundColor: 'var(--primary-600)' }}
                title="Tenant Primary Color"
            />
        </div>
    );
};
