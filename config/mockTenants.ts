import { Tenant, TenantId } from '../types';

export const MOCK_TENANTS: Tenant[] = [
    {
        id: 't1' as TenantId,
        name: 'SGS Land (Default)',
        domain: 'sgs.vn',
        config: {
            primaryColor: '#4F46E5',
            features: { enableZalo: true, maxUsers: 100 }
        }
    },
    {
        id: 't2' as TenantId,
        name: 'Vinhomes Agency',
        domain: 'vinhomes.sgs.vn',
        config: {
            primaryColor: '#E11D48',
            features: { enableZalo: true, maxUsers: 500 }
        }
    },
    {
        id: 't3' as TenantId,
        name: 'DatXanh Group',
        domain: 'datxanh.sgs.vn',
        config: {
            primaryColor: '#059669',
            features: { enableZalo: false, maxUsers: 50 }
        }
    }
];
