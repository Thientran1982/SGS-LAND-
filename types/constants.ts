// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Shared Constants & Enums
// =======================================================

/**
 * CORE DOMAIN DEFINITIONS - SGS LAND ENTERPRISE
 * -----------------------------------------------------------------------------
 * Architect: Staff Engineer
 * Standard: Strict Typing, Discriminated Unions, Branded IDs
 * -----------------------------------------------------------------------------
 */
// =============================================================================
// 0. SHARED CONSTANTS (Single Source of Truth)
// =============================================================================
export const LEAD_SOURCES = [
  // Manual / social
  'Facebook', 'Zalo', 'Website', 'Giới thiệu', 'Khách vãng lai',
  // System-generated (from DB)
  'WIDGET', 'BOOKING', 'LINK', 'QR',
] as const;
export const VN_PHONE_REGEX = /^(03|05|07|08|09)([0-9]{8})$/;

export interface Article {
    id: string;
    slug?: string;
    title: string;
    excerpt: string;
    content: string; // HTML string
    category: string;
    author: string;
    date: string;
    readTime: string;
    image: string;
    images?: string[];
    videos?: string[];
    featured: boolean;
    tags: string[];
}