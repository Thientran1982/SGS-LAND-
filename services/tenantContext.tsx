import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, TenantId } from '../types';

interface TenantContextState {
    tenant: Tenant | null;
    isLoading: boolean;
    error: string | null;
    switchTenant: (tenantId: string) => void;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

const DEFAULT_PRIMARY_COLOR = '#4F46E5';

const applyTenantTheme = (primaryColor: string) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-600', primaryColor);
    root.style.setProperty('--aurora-1', `${primaryColor}20`);
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        applyTenantTheme(DEFAULT_PRIMARY_COLOR);

        fetch('/api/tenant', { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: Tenant) => {
                setTenant(data);
                setError(null);
                const color = data?.config?.primaryColor || DEFAULT_PRIMARY_COLOR;
                applyTenantTheme(color);
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Failed to load tenant';
                setTenant(null);
                setError(msg);
                applyTenantTheme(DEFAULT_PRIMARY_COLOR);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const switchTenant = (_tenantId: string) => {
        window.location.reload();
    };

    return (
        <TenantContext.Provider value={{ tenant, isLoading, error, switchTenant }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
