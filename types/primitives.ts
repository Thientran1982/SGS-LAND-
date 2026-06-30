// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Kernel & Primitives (Branded Types)
// =======================================================

// =============================================================================
// 1. KERNEL & PRIMITIVES (Branded Types)
// =============================================================================
// Utility to create Nominal/Branded types (prevents mixing up different ID types)
declare const __brand: unique symbol;
type Brand<K, T> = K & { [__brand]: T };
export type UUID = string;
export type ISOString = string; // e.g. "2024-01-01T00:00:00Z"
export type HTMLContent = string;
export type Locale = 'vi-VN' | 'en-US' | (string & {}); // Flexible locale
// Branded IDs for Type Safety
export type UserId = Brand<UUID, 'UserId'>;
export type LeadId = Brand<UUID, 'LeadId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type ListingId = Brand<UUID, 'ListingId'>;
export type ProposalId = Brand<UUID, 'ProposalId'>;
export type TaskId = Brand<UUID, 'TaskId'>;
export interface TenantConfig {
    primaryColor: string;
    logoUrl?: string;
    features: {
        enableZalo: boolean;
        maxUsers: number;
    };
}
export interface Tenant {
    id: TenantId;
    name: string;
    domain: string;
    config: TenantConfig;
}
export interface PaginatedList<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export enum CommonStatus {
    ACTIVE = 'ACTIVE',
    PENDING = 'PENDING',
    INACTIVE = 'INACTIVE',
    DEACTIVATED = 'DEACTIVATED',
    ARCHIVED = 'ARCHIVED'
}

export enum DataResidency {
    VN = 'VN',
    SG = 'SG',
    US = 'US',
    EU = 'EU'
}