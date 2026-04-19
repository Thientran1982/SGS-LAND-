
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
export const LEAD_SOURCES = ['Facebook', 'Zalo', 'Website', 'Giới thiệu', 'Khách vãng lai'] as const;
export const VN_PHONE_REGEX = /^(03|05|07|08|09)([0-9]{8})$/;

export interface Article {
    id: string;
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

// =============================================================================
// 2. IAM & ORGANIZATION
// =============================================================================

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',      // Quản trị viên cấp cao nhất (SGSLand platform owner)
    ADMIN = 'ADMIN',
    SALES = 'SALES',
    TEAM_LEAD = 'TEAM_LEAD',
    MARKETING = 'MARKETING',
    VIEWER = 'VIEWER',
    // B2B2C: Broker/Exchange partner roles
    PARTNER_ADMIN = 'PARTNER_ADMIN',  // Quản trị viên sàn đối tác
    PARTNER_AGENT = 'PARTNER_AGENT',  // Nhân viên môi giới sàn đối tác
}

// B2B2C: Dự án do chủ đầu tư sở hữu
export interface Project {
    id: UUID;
    tenantId: TenantId;         // Chủ đầu tư (developer tenant)
    name: string;
    code?: string;              // Mã dự án
    description?: string;
    location?: string;
    totalUnits?: number;
    status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'SUSPENDED';
    openDate?: ISOString;       // Ngày mở bán
    handoverDate?: ISOString;   // Ngày bàn giao dự kiến
    metadata?: Record<string, unknown>;
    createdAt: ISOString;
    updatedAt: ISOString;
}

// B2B2C: Cấp quyền sàn đối tác xem/bán dự án
export interface ProjectAccess {
    id: UUID;
    projectId: UUID;
    partnerTenantId: TenantId;  // Sàn giao dịch BDS
    partnerTenantName?: string;
    partnerTenantDomain?: string;
    grantedBy?: UUID;
    grantedAt: ISOString;
    expiresAt?: ISOString;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    note?: string;              // Ghi chú điều kiện hợp tác
}

// B2B2C: Phân quyền xem từng sản phẩm (listing-level) cho partner tenant cụ thể
// Logic: nếu listing có bất kỳ ACTIVE listing_access → chỉ partner được grant mới thấy
//        nếu listing không có listing_access nào → mọi partner có project_access đều thấy (mặc định)
export interface ListingAccess {
    id: UUID;
    listingId: UUID;
    partnerTenantId: TenantId;
    partnerTenantName?: string;
    partnerTenantDomain?: string;
    grantedBy?: UUID;
    grantedAt: ISOString;
    expiresAt?: ISOString;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    note?: string;
}

export type Permission = 
    | 'VIEW_DASHBOARD'
    | 'MANAGE_USERS'
    | 'MANAGE_LEADS'
    | 'EXPORT_DATA'
    | 'CONFIGURE_AI'
    | 'APPROVE_DEALS'
    | 'VIEW_SENSITIVE_INFO';

export interface UserPreferences {
    theme?: 'light' | 'dark' | 'system';
    notifications?: {
        email: boolean;
        push: boolean;
        zalo: boolean;
    };
    language?: Locale;
}

export interface User {
    id: UserId;
    tenantId: TenantId;
    name: string;
    email: string;
    role: UserRole;
    permissions?: Permission[]; // Granular permissions overriding role defaults
    avatar: string;
    status: CommonStatus;
    source?: 'SSO' | 'INVITE' | 'SYSTEM';
    phone?: string;
    bio?: string;
    metadata?: UserPreferences;
    lastLoginAt?: ISOString;
    createdAt?: ISOString;
}

export interface Team {
    id: UUID;
    name: string;
    leadId: UserId;
    memberIds: UserId[];
    metadata?: Record<string, unknown>;
}

// --- DYNAMIC NAVIGATION TYPES (SERVER DRIVEN UI) ---
export interface NavItem {
    id: string;
    labelKey: string; // Translation key
    route: string;
    iconKey: string;  // Key to map to icon component
    badge?: { count: number; color: 'red' | 'blue' | 'green' };
}

export interface NavGroup {
    id: string;
    labelKey: string;
    items: NavItem[];
}

// =============================================================================
// 3. SALES ENGINE (CRM)
// =============================================================================

export enum LeadStage {
    NEW = 'NEW',
    CONTACTED = 'CONTACTED',
    QUALIFIED = 'QUALIFIED',
    PROPOSAL = 'PROPOSAL',
    NEGOTIATION = 'NEGOTIATION',
    WON = 'WON',
    LOST = 'LOST',
    MANUAL = 'MANUAL'
}

export interface LeadScore {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F' | string;
    factors?: Array<{ factor: string; weight: number; delta: number }>;
    reasoning?: string;
}

export interface LeadPreferences {
    budgetMin?: number;
    budgetMax?: number;
    areaMin?: number;
    areaMax?: number;
    directions?: string[];
    propertyTypes?: PropertyType[];
    regions?: string[];
    _intentHistory?: string[];
    _lastInteraction?: string;
    _lastAnalysisSummary?: string;
    _lastAnalysisDate?: string;
}

export type AmlStatus = 'PENDING' | 'CLEAR' | 'FLAGGED' | 'BLOCKED';

export interface Lead {
    id: LeadId;
    tenantId?: TenantId;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    source: string;
    stage: LeadStage;
    assignedTo: UserId;
    assignedToName?: string;
    tags: string[];
    notes?: string;
    score?: LeadScore;
    slaBreached?: boolean;
    createdAt: ISOString;
    updatedAt: ISOString;
    socialIds?: {
        zalo?: string;
        facebook?: string;
        telegram?: string;
    };
    optOutChannels: string[]; // e.g. ['SMS', 'EMAIL']

    // AML / Compliance
    amlStatus?: AmlStatus;
    amlRiskScore?: number;   // 0–100; higher = riskier
    amlCheckedAt?: ISOString;
    amlNotes?: string;

    // Flexible attributes but prefer strongly typed preferences for matching
    attributes?: Record<string, string | number | boolean | string[]>;
    preferences?: LeadPreferences;

    // Denormalized from latest linked contract (via LATERAL JOIN)
    contractId?: string;
    contractPaymentSchedule?: PaymentMilestone[];
    contractStatus?: string;
    contractType?: string;
    contractValue?: number;
    contractNumber?: string;
}

export enum PropertyType {
    PROJECT = 'Project',       // Dự án
    APARTMENT = 'Apartment',   // Căn hộ
    PENTHOUSE = 'Penthouse',   // Penthouse
    TOWNHOUSE = 'Townhouse',   // Nhà phố
    HOUSE = 'House',           // Nhà riêng
    VILLA = 'Villa',           // Biệt thự
    LAND = 'Land',             // Đất nền
    FACTORY = 'Factory',       // Nhà xưởng
    OFFICE = 'Office',         // Văn phòng
    COMMERCIAL = 'Commercial'  // Thương mại
}

export enum ListingStatus {
    // Project Statuses
    BOOKING = 'BOOKING',       // Nhận Booking
    OPENING = 'OPENING',       // Đang mở bán
    
    // Unit Statuses
    AVAILABLE = 'AVAILABLE',   // Đang bán/cho thuê
    HOLD = 'HOLD',             // Giữ chỗ
    SOLD = 'SOLD',             // Đã bán
    RENTED = 'RENTED',         // Đã thuê
    INACTIVE = 'INACTIVE'      // Ngưng giao dịch
}

export enum TransactionType {
    SALE = 'SALE',
    RENT = 'RENT'
}

export interface ListingAttributes {
    direction?: 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest' | string;
    floor?: number;
    view?: string;
    tower?: string;       // Toà / Block (Apartment/Penthouse)
    clearArea?: number;   // DT thông thủy m² (Apartment/Penthouse)
    legalStatus?: 'PinkBook' | 'Contract' | 'Waiting' | string;
    furniture?: 'FULL' | 'BASIC' | 'NONE';
    
    // Vietnam Specific Land Types
    landType?: 'ONT' | 'ODT' | 'CLN' | 'LUK' | 'SKK' | 'TMD'; 
    frontage?: number; // meters (Mặt tiền)
    roadWidth?: number; // meters (Lộ giới)
    
    // Project Specifics
    developer?: string;
    handoverYear?: string;

    // General
    notes?: string;
    
    // Index signature for extensibility
    [key: string]: unknown;
}

export interface Listing {
    id: ListingId;
    tenantId?: TenantId;
    code: string;
    title: string;
    location: string;
    price: number;
    currency: 'VND' | 'USD';
    area: number; // m2 (Diện tích đất / sàn)
    builtArea?: number; // m2 (DT xây dựng — Townhouse/Villa/House/Office/Factory/Commercial)
    bedrooms?: number; 
    bathrooms?: number;
    type: PropertyType;
    status: ListingStatus;
    transaction: TransactionType;
    attributes: ListingAttributes;
    holdExpiresAt?: ISOString;
    images?: string[];
    projectCode?: string;
    projectId?: UUID; // FK to projects.id (B2B2C: scoped listing access via project_access)

    // Contact Info
    contactPhone?: string; // Explicit contact number for this listing

    // Coordinates for Map View
    coordinates?: {
        lat: number;
        lng: number;
    };
    
    // New Fields
    isVerified: boolean;
    isFavorite: boolean;
    viewCount: number;
    bookingCount?: number; // For Projects
    totalUnits?: number; // For Projects
    availableUnits?: number; // For Projects

    // Internal / Agent Info
    ownerName?: string;
    ownerPhone?: string;
    commission?: number; // Percentage or fixed amount
    commissionUnit?: 'PERCENT' | 'FIXED';
    createdBy?: UserId;
    assignedTo?: UserId;       // Internal user responsible for this unit
    assignedToName?: string;   // Denormalized from users JOIN
    assignedToEmail?: string;
    assignedToAvatar?: string;
    assignedToRole?: string;
    authorizedAgents?: UserId[]; // Agents granted permission to view sensitive info
    createdAt?: ISOString;
}

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

// =============================================================================
// 5. WORKFLOW & AUTOMATION
// =============================================================================

export enum TaskStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
    OVERDUE = 'OVERDUE',
    CANCELED = 'CANCELED'
}

export enum Priority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export interface Task {
    id: TaskId;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    relatedEntityId?: string; // Polymorphic ID
    relatedEntityType?: 'LEAD' | 'LISTING' | 'DEAL' | 'CAMPAIGN';
    assignedTo?: UserId;
    dueDate: ISOString;
    createdAt: ISOString;
}

export enum RoutingStrategy {
    ROUND_ROBIN = 'ROUND_ROBIN',
    WEIGHTED_ROUND_ROBIN = 'WEIGHTED_ROUND_ROBIN',
    SKILL_BASED = 'SKILL_BASED',
    BEST_AVAILABLE = 'BEST_AVAILABLE'
}

export interface RoutingCondition {
    source?: string[];
    region?: string[];
    projects?: string[];
    tags?: string[];
    budgetMin?: number;
    budgetMax?: number;
    temperature?: string[];
}

export interface RoutingRule {
    id: UUID;
    name: string;
    priority: number;
    conditions: RoutingCondition;
    action: {
        type: 'ASSIGN_TEAM' | 'ASSIGN_USER';
        targetId: string; // UUID of Team or User
        strategy: RoutingStrategy;
        requiredSkills?: string[];
    };
    enabled?: boolean;
    isActive?: boolean;
}

// =============================================================================
// 6. INFRASTRUCTURE & CONFIGURATION
// =============================================================================

export interface EnterpriseConfig {
    id: UUID;
    tenantId: TenantId;
    dataResidency?: DataResidency;
    language: Locale;
    onboarding: OnboardingState;
    domains: DomainVerification[];
    sso: SSOConfig;
    scim: SCIMConfig;
    facebookPages: FacebookPage[];
    zalo: ZaloOaConfig;
    email: EmailConfig; 
    ipAllowlist: string[];
    sessionTimeoutMins: number;
    retention: RetentionPolicy;
    legalHold: boolean;
    dlpRules: DlpRule[];
    slaConfig: SLAConfig;
}

export type ComplianceConfig = Pick<EnterpriseConfig, 'retention' | 'legalHold' | 'dlpRules' | 'ipAllowlist'>;

export interface OnboardingState {
    completedSteps: string[];
    isDismissed: boolean;
    percentage: number;
}

export interface DomainVerification {
    domain: string;
    verified: boolean;
    verifiedAt?: ISOString;
    verificationTxtRecord?: string;
}

export interface SSOConfig {
    enabled: boolean;
    provider: 'OIDC' | 'SAML';
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    loginUrl?: string;
}

export interface SCIMConfig {
    enabled: boolean;
    token: string;
    tokenCreatedAt: ISOString;
}

export interface RetentionPolicy {
    messagesDays: number;
    auditLogsDays: number;
}

export interface SLAConfig {
    responseThresholdHours: number;
    maxDisplayItems: number;
}

export interface FacebookPage {
    id: string;
    name: string;
    pageUrl?: string;
    accessToken: string;
    connectedAt: ISOString;
    connectedBy?: string;
    picture?: string;
}

export interface ZaloOaConfig {
    enabled: boolean;
    oaId: string;
    oaName: string;
    cover?: string;
    connectedAt?: ISOString;
    accessToken?: string;
    refreshToken?: string;
    webhookUrl?: string;
}

export interface EmailConfig {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    fromName: string;
    fromAddress: string;
}

export enum HealthStatus {
    HEALTHY = 'HEALTHY',
    DEGRADED = 'DEGRADED',
    CRITICAL = 'CRITICAL'
}

export interface EnvCheckResult {
    key: string;
    exists: boolean;
    maskedValue?: string;
    status: 'OK' | 'MISSING';
}

export interface SystemHealth {
    status: HealthStatus;
    uptime: number;
    timestamp: ISOString;
    environment: string;
    version: string;
    checks: Record<string, boolean>;
    config: EnvCheckResult[];
}

export type LogSource = 'USER' | 'SYSTEM' | 'CHAOS' | 'TRAFFIC' | 'SECURITY' | 'AI';

export interface LogEntry {
    id: UUID;
    timestamp: ISOString;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    context?: Record<string, unknown>;
    tenantId?: string;
    source: LogSource;
    correlationId?: string;
    traceId?: string;
}

export interface ChaosConfig {
    latencyMs: number;
    errorRate: number; // 0.0 to 1.0
    services: { database: boolean; webhook: boolean; ai: boolean };
    enabled: boolean;
}

export interface AuditLog {
    id: UUID;
    timestamp: ISOString;
    actorId: string;
    actorName?: string; // joined from users table
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
}

export interface DlpRule {
    id: UUID;
    name: string;
    pattern: string; // Regex
    action: 'REDACT' | 'BLOCK' | 'LOG_ONLY';
    enabled: boolean;
}

export interface SecuritySession {
    id: UUID;
    userId: UserId;
    ipAddress: string;
    userAgent: string;
    createdAt: ISOString;
    expiresAt: ISOString;
    userName?: string;
    userEmail?: string;
}

// =============================================================================
// 7. OMNICHANNEL & AI AGENTS
// =============================================================================

export enum Channel {
    ZALO = 'ZALO',
    FACEBOOK = 'FACEBOOK',
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    WEBHOOK = 'WEBHOOK',
    VOICE = 'VOICE',
    WEB = 'WEB'
}

export enum Direction {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND'
}

export type AgentArtifact = 
    | { type: 'LOAN_SCHEDULE'; title: string; data: LoanScheduleData }
    | { type: 'BOOKING_DRAFT'; title: string; data: BookingDraftData }
    | { type: 'MARKET_CHART'; title: string; data: MarketChartData }
    | { type: 'MARKETING_COPY'; title: string; data: MarketingCopyData }
    | { type: 'VALUATION_REPORT'; title: string; data: ValuationData }
    | { type: 'LEAD_BRIEF'; title: string; data: LeadBriefData }
    | { type: 'ESCALATION_HANDOVER'; title: string; data: EscalationHandoverData };

export interface LoanScheduleData {
    monthlyPayment: number;
    totalInterest: number;
    input: { principal: number; rate: number; months: number };
    schedule: Array<{ month: number; principal: number; interest: number; balance: number }>;
}

export interface BookingDraftData {
    time: string;
    location: string;
    notes?: string;
}

export interface MarketChartData {
    labels: string[];
    values: number[];
    trend: number;
}

export interface MarketingCopyData {
    headline: string;
    body: string;
    hashtags: string[];
}

export interface ValuationData {
    estimatedPrice: number;
    confidence: number;
    comparables: string[];
}

export interface LeadBriefData {
    leadName: string;
    stage: 'Awareness' | 'Consideration' | 'Decision' | string;
    readiness: number;
    communicationStyle: 'Formal' | 'Casual' | 'Data-driven' | string;
    recommendedAction: string;
    analysisSnippet: string;
    urgencySignals: string[];
    hesitationSignals: string[];
}

export interface EscalationHandoverData {
    leadName: string;
    stage: string;
    score: number;
    grade: string;
    budgetMax: number;
    regions: string;
    propertyTypes: string;
    lastIntent: string;
    urgency: string;
    recentMessages: string;
    escalatedAt: string;
    triggerMessage: string;
}

export interface InteractionMetadata {
    fileName?: string;
    fileSize?: number;
    duration?: number;
    mimeType?: string;
    isAgent?: boolean;
    aiConfidence?: number; // 0.0 to 1.0
    aiSentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ANGRY';
    agentAction?: 'REPLY' | 'ESCALATE' | 'IGNORE';
    artifact?: AgentArtifact;
    systemType?: 'ASSIGNMENT' | 'STATUS_CHANGE' | 'MERGE' | 'ALERT' | 'HANDOFF';
    groundingMetadata?: GroundingMetadata;
    trace?: AgentTraceStep[]; // Trace for debugging
    [key: string]: unknown; // Allow extensions but prefer typed unions above
}

export interface Interaction {
    id: UUID;
    leadId: LeadId;
    channel: Channel;
    direction: Direction;
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'VIDEO';
    content: string;
    timestamp: ISOString;
    metadata?: InteractionMetadata;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PENDING';
}

export enum ThreadStatus {
    AI_ACTIVE = 'AI_ACTIVE', // Agent is handling
    HUMAN_NEEDED = 'HUMAN_NEEDED', // AI gave up or low confidence
    HUMAN_TAKEOVER = 'HUMAN_TAKEOVER', // Agent manually paused
    COMPLETED = 'COMPLETED' // Closed
}

export interface InboxThread {
    lead: Lead;
    lastMessage?: Interaction;
    unreadCount: number;
    status: ThreadStatus;
    aiConfidenceLast?: number; // Snapshot of last AI confidence
    lastChannel?: string;
}

// Updated models based on Google GenAI SDK rules (Feb 2026 Compatible)
export type AiModelType = 
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro'
    | 'gemini-2.5-flash-lite'
    | 'gemini-3-flash-preview'
    | 'gemini-3-pro-preview'
    | 'gemini-3.1-flash-lite-preview'
    | 'gemini-3.1-pro-preview'
    | 'gemini-2.0-flash'
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
    | (string & {}); 

export interface AiTenantConfig {
    allowedModels: AiModelType[];
    defaultModel: AiModelType;
    budgetCapUsd: number;
    currentSpendUsd: number;
}

export interface SystemPrompt {
    key: string; 
    version: string;
    content: string; 
    model?: AiModelType; 
    isActive: boolean;
}

export interface PromptTemplate {
    id: UUID;
    name: string;
    description: string;
    activeVersion: number;
    versions: Array<{ 
        version: number; 
        content: string; 
        status: 'DRAFT' | 'APPROVED'; 
        createdAt?: ISOString;
    }>;
}

export interface AiEvalRun {
    id: UUID;
    templateId: UUID;
    version: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    score: number;
    results: Array<{ id: string; pass: boolean; reason?: string }>;
    runAt: ISOString;
    runBy: string;
}

export interface AiSafetyLog {
    id: UUID;
    timestamp: ISOString;
    model: string;
    taskType: string;
    latencyMs: number;
    costUsd: number;
    safetyFlags: string[];
}

export interface GroundingChunk {
    web?: { uri?: string; title?: string };
    maps?: { uri?: string; title?: string; placeAnswerSources?: unknown };
}

export interface GroundingMetadata {
    groundingChunks?: GroundingChunk[];
    webSearchQueries?: string[];
    searchEntryPoint?: unknown;
    [key: string]: unknown;
}

export interface AgentTraceStep {
    id: string;
    node: string; 
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
    detail?: string;
    input?: unknown; 
    output?: unknown; 
    timestamp: number;
    durationMs?: number;
    modelUsed?: string;
    tokensEstimate?: number;
    costEstimate?: number;
}

export interface AgentTraceResponse {
    agent: string;
    content: string;
    steps: AgentTraceStep[];
    artifact?: AgentArtifact;
    groundingMetadata?: GroundingMetadata;
    suggestedAction?: 'CREATE_PROPOSAL' | 'SEND_DOCS' | 'BOOK_VIEWING' | 'COPY_CONTENT' | 'NONE';
    confidence: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ANGRY';
    escalated?: boolean;
    isSysMsg?: boolean;
    intent?: string;
    userMessage?: string;
}

export interface GraphState {
    messages: { role: 'user' | 'model' | 'system'; content: string; name?: string }[];
    lead: Lead;
    nextNode: string;
    artifacts: AgentArtifact[];
    trace: AgentTraceStep[];
}

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
    DEPOSIT = 'DEPOSIT', // Thoả thuận đặt cọc
    SALES = 'SALES'      // Hợp đồng mua bán
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

// =============================================================================
// 20. TASK MANAGEMENT MODULE
// =============================================================================

export type WfTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory =
    | 'sales' | 'legal' | 'marketing' | 'site_visit'
    | 'customer_care' | 'finance' | 'construction' | 'admin' | 'other';

export interface Department {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    created_at: ISOString;
    task_count?: number;
}

export interface TaskAssignee {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
    is_primary: boolean;
    assigned_at?: ISOString;
    due_note?: string;
}

export interface WfTask {
    id: string;
    tenant_id: string;
    title: string;
    description?: string;
    project_id?: string;
    project_name?: string;
    department_id?: string;
    department_name?: string;
    category?: TaskCategory;
    status: WfTaskStatus;
    priority: TaskPriority;
    deadline?: string;
    estimated_hours?: number;
    actual_hours?: number;
    completion_note?: string;
    created_by?: string;
    created_by_name?: string;
    created_at: ISOString;
    updated_at: ISOString;
    assignees: TaskAssignee[];
    comment_count?: number;
    is_overdue: boolean;
    days_until_deadline: number | null;
    urgency_level: 'normal' | 'warning' | 'critical' | 'overdue';
}

export interface TaskComment {
    id: string;
    tenant_id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    user_avatar?: string;
    content: string;
    created_at: ISOString;
    updated_at: ISOString;
}

export interface TaskActivityLog {
    id: string;
    tenant_id: string;
    task_id: string;
    user_id?: string;
    user_name?: string;
    user_avatar?: string;
    action: string;
    old_value?: Record<string, unknown>;
    new_value?: Record<string, unknown>;
    detail?: string;
    created_at: ISOString;
}

export interface WorkloadStats {
    user_id: string;
    name: string;
    department?: string;
    active_tasks: number;
    overdue_tasks: number;
    workload_score: number;
    completed_this_week?: number;
    completed_this_month?: number;
}

export interface TaskDashboardStats {
    overview: {
        total_tasks: number;
        todo: number;
        in_progress: number;
        review: number;
        done: number;
        cancelled: number;
        overdue_count: number;
        due_today_count: number;
        due_this_week_count: number;
    };
    completion_rate_today: number;
    completion_rate_week: number;
    by_priority: Record<TaskPriority, number>;
    by_category: Partial<Record<TaskCategory, number>>;
    by_project: Array<{
        project_id: string;
        name: string;
        total: number;
        done: number;
        overdue: number;
    }>;
    top_overdue_tasks: WfTask[];
    upcoming_deadlines: WfTask[];
    workload_by_user: WorkloadStats[];
}

export interface TaskListParams {
    status?: WfTaskStatus | WfTaskStatus[];
    priority?: TaskPriority | TaskPriority[];
    project_id?: string;
    department_id?: string;
    category?: TaskCategory;
    assignee_id?: string;
    created_by?: string;
    is_overdue?: boolean;
    deadline_from?: string;
    deadline_to?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort_by?: 'deadline' | 'priority' | 'created_at' | 'updated_at';
    sort_dir?: 'asc' | 'desc';
}
