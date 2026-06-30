// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Infrastructure & Configuration
// =======================================================

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