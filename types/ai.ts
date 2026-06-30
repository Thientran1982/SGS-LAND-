// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Omnichannel & AI Agents
// =======================================================

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
export type UserIntent =
    | 'tim_mua'
    | 'tim_thue'
    | 'dinh_gia'
    | 'hoi_phap_ly'
    | 'can_vay'
    | 'dau_tu'
    | 'hoi_du_an'
    | 'unknown';

export interface IntentResult {
    primary: UserIntent;
    confidence: number;
    extractedEntities: {
        projectName?: string;
        district?: string;
        budget?: string;
        propertyType?: string;
    };
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
    detectedIntent?: IntentResult;
}
export interface GraphState {
    messages: { role: 'user' | 'model' | 'system'; content: string; name?: string }[];
    lead: Lead;
    nextNode: string;
    artifacts: AgentArtifact[];
    trace: AgentTraceStep[];
}