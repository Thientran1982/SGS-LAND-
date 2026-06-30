// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Commercial & Transactions
// =======================================================

// =============================================================================
// 4. COMMERCIAL & TRANSACTIONS
// =============================================================================
export enum ProposalStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED'
}
export interface ProposedPaymentMilestone {
    id: string;
    label: string;
    dueDate: string;
    percentage: number;
    amount: number;
}
export interface ProposalMetadata {
    depositRequired?: number;
    validityDays?: number;
    note?: string;
    terms?: string;
    paymentSchedule?: ProposedPaymentMilestone[];
}
export interface Proposal {
    id: ProposalId;
    tenantId?: TenantId;
    leadId: LeadId;
    listingId: ListingId;
    basePrice: number;
    discountAmount: number;
    finalPrice: number;
    currency: 'VND' | 'USD';
    status: ProposalStatus;
    token: string; // Public access token
    validUntil: ISOString;
    createdBy: string; // User Name (Snapshot)
    createdById?: UserId;
    createdAt: ISOString;
    metadata?: ProposalMetadata;
    // AML clearance flag — set to true after compliance review before APPROVED
    amlVerified?: boolean;
}