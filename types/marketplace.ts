// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Marketplace & Integrations
// =======================================================

// =============================================================================
// 8. MARKETPLACE & INTEGRATIONS
// =============================================================================
export interface AppManifest {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    version: string;
    requiredPermissions: Array<'READ_LEADS' | 'WRITE_LEADS' | 'SEND_MESSAGES' | 'ADMIN' | 'READ_REPORTS'>;
    subscribedEvents: string[];
    developer?: string;
}
export interface InstalledApp {
    id: UUID;
    appId: string;
    status: 'ACTIVE' | 'DISABLED';
    installedAt: ISOString;
    webhookUrl?: string;
    clientSecret: string;
    eventCount: number;
    lastEventAt?: ISOString;
    config?: Record<string, unknown>;
}
export interface WebhookEventPayload {
    eventId: string;
    eventType: string;
    timestamp: ISOString;
    tenantId: string;
    data: unknown;
}
export enum ConnectorType {
    GOOGLE_SHEETS = 'GOOGLE_SHEETS',
    HUBSPOT = 'HUBSPOT',
    ZOHO_CRM = 'ZOHO_CRM',
    WEBHOOK_EXPORT = 'WEBHOOK_EXPORT',
    SALESFORCE = 'SALESFORCE'
}
export interface ConnectorConfig<T = Record<string, unknown>> {
    id: UUID;
    type: ConnectorType;
    name: string;
    status: 'ACTIVE' | 'PAUSED' | 'ERROR';
    config: T; // Vendor specific config
    watermark?: string;
    lastSyncAt?: ISOString;
    lastSyncStatus?: SyncStatus;
}
export enum SyncStatus {
    QUEUED = 'QUEUED',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}
export interface SyncJob {
    id: UUID;
    connectorId: UUID;
    startedAt: ISOString;
    finishedAt?: ISOString;
    status: SyncStatus;
    recordsProcessed: number;
    errors: string[];
    retryCount: number;
}
export interface DataExportResponse<T> {
    data: T[];
    newWatermark: string;
}
export enum PlanTier {
    INDIVIDUAL = 'INDIVIDUAL',
    TEAM = 'TEAM',
    ENTERPRISE = 'ENTERPRISE'
}
export interface Plan {
    id: PlanTier;
    name: string;
    price: number;
    features: string[];
    limits: { 
        seats: number; 
        emailsPerMonth: number; 
        aiRequestsPerMonth: number;
        storageGb?: number; 
    };
}
export interface Subscription {
    planId: PlanTier;
    status: 'active' | 'past_due' | 'canceled' | 'trialing';
    currentPeriodEnd: ISOString;
    paymentMethod?: { last4: string; brand: string; expMonth: number; expYear: number };
}
export interface UsageMetrics {
    seatsUsed: number;
    emailsSent: number;
    aiRequests: number;
    periodStart: ISOString;
    periodEnd: ISOString;
}
export interface Invoice {
    id: string;
    number: string;
    created: ISOString;
    amount: number;
    currency?: string;
    status: 'paid' | 'open' | 'void' | 'uncollectible';
    pdfUrl?: string;
}
export interface AnalyticsSummary {
    totalLeads: number;
    totalLeadsDelta: number;
    slaBreachedCount: number;
    leadsTrend: { date: string; count: number }[];
    forecast: { month: string; actual: number; target: number }[];
    aiHighlights: string[];
    conversionRate: number;
    pipelineValue?: number;
    pipelineValueDelta?: number;
    aiDeflectionRate?: number;
    aiDeflectionRateDelta?: number;
    salesVelocity?: number;
    revenue?: number;
    revenueDelta?: number;
    winProbability?: number;
    salesVelocityDelta?: number;
    marketPulse?: MarketMetrics & { region?: string; lastUpdated?: ISOString };
    agentLeaderboard?: Array<{ userId: UserId; name: string; avatar: string; score: number; deals: number }>;
    /** Describes data scope: "Toàn công ty" | "Dữ liệu của bạn" */
    scopeLabel?: string;
}
export interface CampaignCost {
    id: UUID;
    campaignName: string;
    source: string;
    period: string; // YYYY-MM
    cost: number;
    createdAt: ISOString;
}
// Update to include metrics
export interface SequenceStats {
    enrolled: number;
    active: number;
    completed: number;
    openRate: number; // percentage
    replyRate: number; // percentage
    clickRate: number; // percentage
}
export interface Sequence {
    id: UUID;
    name: string;
    triggerEvent: LeadStage;
    steps: SequenceStep[];
    isActive?: boolean;
    stats?: SequenceStats; // Added metrics
    createdAt?: ISOString;
}
export interface Template {
    id: UUID;
    name: string;
    channel: Channel;
    content: string;
    variables?: string[];
}
export interface SequenceStep {
    id: string;
    type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'WAIT' | 'CONDITION';
    delayHours: number;
    channel?: Channel;
    templateId?: UUID;
    taskTitle?: string;
    condition?: unknown;
}
export interface KnowledgeDocument {
    id: UUID;
    title: string;
    type: 'PDF' | 'DOCX' | 'TXT';
    sizeKb: number;
    createdAt: ISOString;
    content: string;
    status: 'ACTIVE' | 'PROCESSING' | 'INACTIVE';
    fileUrl?: string;
    vectorId?: string;
}
export interface ScoringConfig {
    version: number;
    weights: { 
        engagement: number; 
        completeness: number; 
        budgetFit: number; 
        velocity: number;
        [key: string]: number;
    };
    thresholds?: { A: number; B: number; C: number; D: number };
}
export interface Playbook {
    id: UUID;
    stage: LeadStage;
    title: string;
    description: string;
    steps: { id: string; text: string; type: 'CHECKBOX' | 'INFO'; required: boolean }[];
}
export interface MarketMetrics {
    avgPrice: number;
    trend: number;
    liquidity: 'High' | 'Medium' | 'Low';
    rentalYield: number;
}
export enum ContractType {
    RESERVATION = 'RESERVATION', // Phiếu giữ chỗ
    DEPOSIT = 'DEPOSIT',          // Thoả thuận đặt cọc
    SALES = 'SALES'               // Hợp đồng mua bán
}
export enum ContractStatus {
    DRAFT = 'DRAFT',
    PENDING_SIGNATURE = 'PENDING_SIGNATURE',
    SIGNED = 'SIGNED',
    CANCELLED = 'CANCELLED'
}
export enum PaymentStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    OVERDUE = 'OVERDUE',
    WAIVED = 'WAIVED'
}
export interface PaymentMilestone {
    id: string;
    name: string;        // "Đợt 1 - Đặt cọc", "Đợt 2 - Ký HĐMB"
    dueDate: string;     // ISO date string
    amount: number;      // Số tiền VND
    percentage: number;  // % trên tổng giá trị hợp đồng
    status: PaymentStatus;
    paidDate?: string;   // Ngày thanh toán thực tế
    paidAmount?: number; // Số tiền đã thanh toán thực tế
    note?: string;
}
export interface Contract {
    id: UUID;
    tenantId?: string;
    type: ContractType;
    status: ContractStatus;
    leadId: LeadId;
    listingId: ListingId;   
    // Party A (Seller/Company)
    partyAName: string;
    partyARepresentative: string;
    partyAIdNumber?: string; // CMND/CCCD/ĐKKD
    partyAIdDate?: string;
    partyAIdPlace?: string;
    partyAAddress: string;
    partyATaxCode: string;
    partyAPhone: string;
    partyABankAccount?: string;
    partyABankName?: string;
    // Party B (Buyer/Customer)
    partyBName: string;
    partyBIdNumber: string; // CMND/CCCD
    partyBIdDate: string;
    partyBIdPlace: string;
    partyBAddress: string;
    partyBPhone: string;
    partyBBankAccount?: string;
    partyBBankName?: string;
    // Property Details
    propertyAddress: string;
    propertyArea: number; // General area, kept for backward compatibility
    propertyLandArea?: number; // Diện tích đất
    propertyConstructionArea?: number; // Diện tích xây dựng
    propertyType?: string; // Loại đất/nhà
    propertyCertificateNumber?: string; // Số Giấy chứng nhận/Sổ đỏ
    propertyCertificateDate?: string; // Ngày cấp GCN
    propertyCertificatePlace?: string; // Nơi cấp GCN
    propertyUnitCode?: string; // Mã căn (căn hộ)
    propertyRoomNumber?: string; // Số phòng (căn hộ)
    propertyFloorNumber?: string; // Số tầng (căn hộ)
    propertyPrice: number;
    // Payment & Terms
    depositAmount?: number;
    paymentTerms: string;
    paymentSchedule?: PaymentMilestone[];
    taxResponsibility?: string; // Trách nhiệm nộp thuế/phí
    handoverDate?: string; // Ngày bàn giao dự kiến
    handoverCondition?: string; // Tình trạng bàn giao
    disputeResolution?: string; // Giải quyết tranh chấp
    signedAt?: ISOString;    // Ngày ký (mapped from signed_at)
    signedPlace?: string;    // Địa điểm ký hợp đồng
    contractDate?: string;   // Ngày ký tùy chỉnh (nếu khác ngày tạo)

    createdAt: ISOString;
    updatedAt: ISOString;
    createdBy: string;
}
export interface ISocialProvider {
    getProfile(userId: string, config?: Record<string, unknown>): Promise<SocialUserProfile>;
    sendMessage(userId: string, text: string, config?: Record<string, unknown>): Promise<{ messageId: string; error?: string }>;
    verifySignature(signature: string, body: unknown, secret?: string): boolean;
}
export interface SocialUserProfile {
    id: string;
    name: string;
    avatar: string;
    platform: Channel;
    email?: string;
}