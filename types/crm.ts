// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Sales Engine (CRM)
// =======================================================

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
    // P3 self-learning: accumulated persona signals across sessions
    _inferredPersona?: string;        // e.g. VIET_KIEU, FAMILY_UPGRADER, FIRST_BUYER_YOUNG…
    _lifeEvents?: string[];           // e.g. ["sắp có em bé", "vừa bán nhà xong"]
    _lastUrgency?: 'HIGH' | 'MEDIUM' | 'LOW';
    _lastEmotionalState?: 'ANXIOUS' | 'FRUSTRATED' | 'EXCITED' | 'NEUTRAL';
    // Tier 1 Core Memory: SOUL identity injected per-request by livechat handler
    _soulContext?: string;
    // Tier 2 Session Memory: district extracted from current session
    _sessionDistrict?: string;
    // Phase 4 Multi-Agent: routed agent soul prompt injected per-request
    _agentSoulPrompt?: string;
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
    INACTIVE = 'INACTIVE',     // Ngưng giao dịch
    BEST_MARKET = 'BEST_MARKET' // Tốt nhất thị trường
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
    legalStatus?: 'PinkBook' | 'Contract' | 'Waiting' | string; // Denormalized for convenience
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