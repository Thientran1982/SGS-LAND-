import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, TenantId } from '../types';
import { db } from './dbApi';
import { MOCK_TENANTS } from '../config/mockTenants';

interface TenantContextState {
    tenant: Tenant | null;
    isLoading: boolean;
    switchTenant: (tenantId: string) => void;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const hostname = window.location.hostname;
        
        const savedTenantId = localStorage.getItem('sgs_tenant_id');
        let resolvedTenant = MOCK_TENANTS.find(t => t.id === savedTenantId) || MOCK_TENANTS[0];

        setTenant(resolvedTenant);
        db.setTenantContext(resolvedTenant.id);
        applyTenantTheme(resolvedTenant);
        setIsLoading(false);
    }, []);

    const switchTenant = (tenantId: string) => {
        const newTenant = MOCK_TENANTS.find(t => t.id === tenantId);
        if (newTenant) {
            localStorage.setItem('sgs_tenant_id', newTenant.id);
            setTenant(newTenant);
            db.setTenantContext(newTenant.id);
            applyTenantTheme(newTenant);
            window.location.reload(); 
        }
    };

    const applyTenantTheme = (t: Tenant) => {
        const root = document.documentElement;
        root.style.setProperty('--primary-600', t.config.primaryColor);
        root.style.setProperty('--aurora-1', `${t.config.primaryColor}20`);
    };

    return (
        <TenantContext.Provider value={{ tenant, isLoading, switchTenant }}>
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
