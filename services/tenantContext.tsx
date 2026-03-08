import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, TenantId } from '../types';
import { db } from './mockDb';

interface TenantContextState {
    tenant: Tenant | null;
    isLoading: boolean;
    switchTenant: (tenantId: string) => void;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

// Mock tenants for demonstration
export const MOCK_TENANTS: Tenant[] = [
    {
        id: 't1' as TenantId,
        name: 'SGS Land (Default)',
        domain: 'sgs.vn',
        config: {
            primaryColor: '#4F46E5', // Indigo
            features: { enableZalo: true, maxUsers: 100 }
        }
    },
    {
        id: 't2' as TenantId,
        name: 'Vinhomes Agency',
        domain: 'vinhomes.sgs.vn',
        config: {
            primaryColor: '#E11D48', // Rose
            features: { enableZalo: true, maxUsers: 500 }
        }
    },
    {
        id: 't3' as TenantId,
        name: 'DatXanh Group',
        domain: 'datxanh.sgs.vn',
        config: {
            primaryColor: '#059669', // Emerald
            features: { enableZalo: false, maxUsers: 50 }
        }
    }
];

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Tenant Resolution (Simulated Middleware)
        // In production, this would read window.location.hostname
        const hostname = window.location.hostname;
        
        // For local dev, we check localStorage first, then fallback to default
        const savedTenantId = localStorage.getItem('sgs_tenant_id');
        let resolvedTenant = MOCK_TENANTS.find(t => t.id === savedTenantId) || MOCK_TENANTS[0];

        // If we were using subdomains:
        // const subdomain = hostname.split('.')[0];
        // resolvedTenant = MOCK_TENANTS.find(t => t.domain.startsWith(subdomain)) || MOCK_TENANTS[0];

        setTenant(resolvedTenant);
        db.setTenantContext(resolvedTenant.id); // Apply RLS context to Mock DB
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
            // In a real app, you might want to reload or clear user session if switching tenants
            window.location.reload(); 
        }
    };

    const applyTenantTheme = (t: Tenant) => {
        // 2. Tenant-Specific Configurations (Theming)
        const root = document.documentElement;
        root.style.setProperty('--primary-600', t.config.primaryColor);
        
        // Generate a lighter version for backgrounds/aurora
        root.style.setProperty('--aurora-1', `${t.config.primaryColor}20`); // 20% opacity hex
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
