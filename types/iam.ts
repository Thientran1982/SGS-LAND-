// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: IAM & Organization
// =======================================================

// =============================================================================
// 2. IAM & ORGANIZATION
// =============================================================================

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',      // Quản trị viên cấp cao nhất (SGSLand platform owner)
    ADMIN = 'ADMIN',                  // Quản trị viên tenant
    MANAGER = 'MANAGER',              // Quản lý (cấp trung, được duyệt hợp đồng — xem contractRoutes)
    TEAM_LEAD = 'TEAM_LEAD',          // Trưởng nhóm
    SALES = 'SALES',                  // Nhân viên kinh doanh
    MARKETING = 'MARKETING',          // Marketing
    VIEWER = 'VIEWER',                // Chỉ xem
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
    departmentId?: string | null;
    departmentName?: string | null;
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