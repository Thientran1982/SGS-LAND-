
import { 
    User, UserRole, CommonStatus, Lead, LeadStage, Listing, PropertyType, ListingStatus, TransactionType, 
    Proposal, ProposalStatus, Task, TaskStatus, Priority, EnterpriseConfig, SystemHealth, 
    LogEntry, AuditLog, Interaction, Channel, Direction, InboxThread, AiTenantConfig, PromptTemplate, 
    AiSafetyLog, AppManifest, InstalledApp, ConnectorConfig, SyncJob, SyncStatus, DataExportResponse,
    PlanTier, Plan, Subscription, UsageMetrics, Invoice, AnalyticsSummary, Sequence, Template,
    KnowledgeDocument, ScoringConfig, SocialUserProfile, RoutingRule, ThreadStatus,
    Contract, ContractType, ContractStatus, Article, CampaignCost, Team
} from '../types';
import { ROUTES } from '../config/routes';
import { AnalyticsService } from './analyticsService';

export { PLANS } from './dbApi';

class MockDatabase {
    private currentTenantId: string = 't1'; // Simulated RLS Context

    public setTenantContext(tenantId: string) {
        this.currentTenantId = tenantId;
    }

    // Simulated PostgreSQL RLS Wrapper
    private withRLS<T extends { tenantId?: string }>(data: T[]): T[] {
        // If the record has a tenantId, it MUST match the current context.
        // If it doesn't have a tenantId (global data like standard plans), allow it.
        return data.filter(item => !item.tenantId || item.tenantId === this.currentTenantId);
    }

    private users: User[] = [
        {
            id: 'u1' as any,
            tenantId: 't1' as any,
            name: 'Admin User',
            email: 'admin@sgs.vn',
            role: UserRole.ADMIN,
            avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=4F46E5&color=fff',
            status: CommonStatus.ACTIVE,
            source: 'SYSTEM',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        },
        {
            id: 'u2' as any,
            tenantId: 't1' as any,
            name: 'Sales Agent 1',
            email: 'sales1@sgs.vn',
            role: UserRole.SALES,
            avatar: 'https://ui-avatars.com/api/?name=Sales+1&background=10B981&color=fff',
            status: CommonStatus.ACTIVE,
            source: 'SYSTEM',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        },
        {
            id: 'u3' as any,
            tenantId: 't1' as any,
            name: 'Sales Agent 2',
            email: 'sales2@sgs.vn',
            role: UserRole.SALES,
            avatar: 'https://ui-avatars.com/api/?name=Sales+2&background=F59E0B&color=fff',
            status: CommonStatus.ACTIVE,
            source: 'SYSTEM',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        }
    ];
    private teams: Team[] = [
        {
            id: 'team_1' as any,
            name: 'Alpha Sales Team',
            leadId: 'u1' as any,
            memberIds: ['u2' as any, 'u3' as any]
        }
    ];
    private documents: KnowledgeDocument[] = [
        {
            id: 'doc_1' as any,
            title: 'SGS_Land_Sales_Playbook_2026.pdf',
            type: 'PDF',
            sizeKb: 2450,
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            content: 'Nội dung mô phỏng playbook bán hàng...'
        },
        {
            id: 'doc_2' as any,
            title: 'Quy_trinh_cham_soc_khach_hang_VIP.docx',
            type: 'DOCX',
            sizeKb: 850,
            createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
            content: 'Nội dung mô phỏng quy trình chăm sóc khách hàng...'
        },
        {
            id: 'doc_3' as any,
            title: 'Kich_ban_tra_loi_tu_dong_AI.txt',
            type: 'TXT',
            sizeKb: 120,
            createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
            content: 'Nội dung mô phỏng kịch bản trả lời tự động...'
        }
    ];
    private leads: Lead[] = [];
    private listings: Listing[] = [];
    private proposals: Proposal[] = [];
    private interactions: Interaction[] = [];
    private auditLogs: AuditLog[] = [];
    private connectorConfigs: ConnectorConfig[] = [];
    private syncJobs: SyncJob[] = [];
    private installedApps: InstalledApp[] = [];
    private favorites: Set<string> = new Set(); // Listing IDs
    private sequences: Sequence[] = [];
    private contracts: Contract[] = [];
    private articles: Article[] = [];
    private campaignCosts: CampaignCost[] = [
        { id: 'c1', source: 'Facebook', month: '2026-02', cost: 15000000, currency: 'VND', updatedBy: 'Admin', updatedAt: new Date().toISOString() },
        { id: 'c2', source: 'Google', month: '2026-02', cost: 20000000, currency: 'VND', updatedBy: 'Admin', updatedAt: new Date().toISOString() },
        { id: 'c3', source: 'Zalo', month: '2026-02', cost: 5000000, currency: 'VND', updatedBy: 'Admin', updatedAt: new Date().toISOString() }
    ];
    private scoringConfig: ScoringConfig = { version: 1, weights: { engagement: 5, completeness: 10, budgetFit: 20, velocity: 5 } };
    private routingRules: RoutingRule[] = [];
    private teamAssignmentState: Record<string, number> = {};
    private enterpriseConfig: EnterpriseConfig = {
        id: 'conf_1' as any,
        tenantId: 't1' as any,
        language: 'vi-VN',
        onboarding: { completedSteps: [], isDismissed: false, percentage: 0 },
        domains: [],
        sso: { enabled: false, provider: 'OIDC' },
        scim: { enabled: false, token: '', tokenCreatedAt: '' },
        facebookPages: [],
        zalo: { enabled: false, oaId: '', oaName: '' },
        email: { enabled: false, host: '', port: 587, secure: true, user: '', fromName: '', fromAddress: '' },
        ipAllowlist: [],
        sessionTimeoutMins: 30,
        retention: { messagesDays: 90, auditLogsDays: 365 },
        legalHold: false,
        dlpRules: [],
        slaConfig: { responseThresholdHours: 24, maxDisplayItems: 50 }
    };

    constructor() {
        // Seed some data if needed
        const listingsLoaded = this.loadListingsFromStorage();
        const leadsLoaded = this.loadLeadsFromStorage();
        const interactionsLoaded = this.loadInteractionsFromStorage();
        if (!listingsLoaded || !leadsLoaded || !interactionsLoaded) {
            this.seedData();
            if (!listingsLoaded) this.saveListingsToStorage();
            if (!leadsLoaded) this.saveLeadsToStorage();
            if (!interactionsLoaded) this.saveInteractionsToStorage();
        }
        const usersLoaded = this.loadUsersFromStorage();
        if (!usersLoaded) {
            this.seedUsers(); // New User Seeder
            this.saveUsersToStorage();
        }
        this.loadContractsFromStorage();
        this.loadProposalsFromStorage();
        this.loadEnterpriseConfigFromStorage();
        const articlesLoaded = this.loadArticlesFromStorage();
        if (!articlesLoaded) {
            this.seedArticles();
        }
    }

    private loadListingsFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_listings');
                if (saved) {
                    this.listings = JSON.parse(saved);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load listings from storage', e);
            }
        }
        return false;
    }

    private saveListingsToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_listings', JSON.stringify(this.listings));
            } catch (e) {
                console.error('Failed to save listings to storage', e);
            }
        }
    }

    private loadLeadsFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_leads');
                if (saved) {
                    this.leads = JSON.parse(saved);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load leads from storage', e);
            }
        }
        return false;
    }

    private saveLeadsToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_leads', JSON.stringify(this.leads));
            } catch (e) {
                console.error('Failed to save leads to storage', e);
            }
        }
    }

    private loadUsersFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_users');
                if (saved) {
                    const loadedUsers = JSON.parse(saved);
                    // Deduplicate by ID to fix previous seeding bug
                    const uniqueUsers: User[] = [];
                    const seenIds = new Set();
                    for (const u of loadedUsers) {
                        if (!seenIds.has(u.id)) {
                            uniqueUsers.push(u);
                            seenIds.add(u.id);
                        }
                    }
                    this.users = uniqueUsers;
                    return true;
                }
            } catch (e) {
                console.error('Failed to load users from storage', e);
            }
        }
        return false;
    }

    private saveUsersToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_users', JSON.stringify(this.users));
            } catch (e) {
                console.error('Failed to save users to storage', e);
            }
        }
    }

    private loadInteractionsFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_interactions');
                if (saved) {
                    this.interactions = JSON.parse(saved);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load interactions from storage', e);
            }
        }
        return false;
    }

    private saveInteractionsToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_interactions', JSON.stringify(this.interactions));
            } catch (e) {
                console.error('Failed to save interactions to storage', e);
            }
        }
    }

    private loadContractsFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_contracts');
                if (saved) {
                    this.contracts = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to load contracts from storage', e);
            }
        }
    }

    private loadEnterpriseConfigFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_enterprise_config');
                if (saved) {
                    this.enterpriseConfig = JSON.parse(saved);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load enterprise config from storage', e);
            }
        }
        return false;
    }

    private saveEnterpriseConfigToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_enterprise_config', JSON.stringify(this.enterpriseConfig));
            } catch (e) {
                console.error('Failed to save enterprise config to storage', e);
            }
        }
    }

    private saveContractsToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_contracts', JSON.stringify(this.contracts));
            } catch (e) {
                console.error('Failed to save contracts to storage', e);
            }
        }
    }

    private loadProposalsFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_proposals');
                if (saved) {
                    this.proposals = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to load proposals from storage', e);
            }
        }
    }

    private saveProposalsToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_proposals', JSON.stringify(this.proposals));
            } catch (e) {
                console.error('Failed to save proposals to storage', e);
            }
        }
    }

    private seedArticles() {
        this.articles = [
            {
                id: 'art_1',
                title: "Thủ Thiêm 2026: Làn sóng đầu tư vào 'Thành phố AI' The Neural City",
                excerpt: "SGS Land công bố báo cáo phân tích độc quyền về The Neural City - điểm nóng đầu tư mới nhờ hạ tầng số hóa và tiềm năng tăng trưởng vượt bậc.",
                content: `<div class="space-y-6 text-slate-700 leading-relaxed">
                    <p class="first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-[-4px]">
                        Năm 2026 đánh dấu sự chuyển mình mạnh mẽ của Thủ Thiêm với phân khu "Neural City". Theo báo cáo mới nhất từ SGS Market AI, đây là khu vực có mật độ ứng dụng công nghệ Smart City cao nhất khu vực Đông Nam Á.
                    </p>
                    <h3 class="text-xl font-bold text-slate-900 mt-8">Hạ tầng số hóa toàn diện</h3>
                    <p>
                        Khác với các dự án truyền thống, The Neural City được vận hành dựa trên Data-Driven Model. Mọi chỉ số từ năng lượng, giao thông đến an ninh đều được tối ưu hóa theo thời gian thực. SGS Land tự hào là đối tác chiến lược cung cấp dữ liệu thị trường và mô hình định giá cho các nhà phát triển tại đây.
                    </p>
                    <div class="my-8 p-6 bg-indigo-50 border-l-4 border-indigo-500 italic text-indigo-800">
                        "SGS Land không chỉ kết nối giao dịch, chúng tôi cung cấp tầm nhìn chiến lược dựa trên dữ liệu cho nhà đầu tư tại The Neural City." - Trích báo cáo quý I/2026.
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mt-8">Xu hướng Token hóa tài sản (RWA)</h3>
                    <p>
                        Điểm đột phá của dự án này là việc thí điểm khung pháp lý Sandbox 2025 về RWA (Real World Assets). Nhà đầu tư có thể tham gia với dòng vốn linh hoạt, được bảo chứng bởi công nghệ Blockchain và dữ liệu định giá minh bạch từ hệ thống SGS Land.
                    </p>
                    <p>
                        Dữ liệu cho thấy, thanh khoản tại khu vực này đã tăng 45% nhờ sự minh bạch hóa thông tin mà công nghệ mang lại, giảm thiểu tối đa rủi ro pháp lý cho người mua.
                    </p>
                </div>`,
                category: "Thị Trường & Công Nghệ",
                author: "Minh Tuấn (AI Analyst)",
                date: "2026-02-15",
                readTime: "6 phút",
                image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=2070&auto=format&fit=crop",
                featured: true,
                tags: ["AI City", "Data Driven", "Thủ Thiêm"]
            },
            {
                id: 'art_2',
                title: "Tuyến Hyperloop TP.HCM - Nha Trang: BĐS nghỉ dưỡng 'cất cánh'",
                excerpt: "Với thời gian di chuyển rút ngắn xuống còn 30 phút, khái niệm 'Second Home' đang chuyển dịch thành 'Daily Home' cho giới thượng lưu Sài Gòn.",
                content: `<div class="space-y-6 text-slate-700 leading-relaxed">
                    <p>
                        Sự kiện khánh thành nhà ga Hyperloop tại Thủ Đức vào tháng 1/2026 đã thay đổi hoàn toàn bản đồ bất động sản miền Nam. Khoảng cách địa lý không còn là rào cản.
                    </p>
                    <p>
                        Các dự án biệt thự biển tại Cam Ranh và Nha Trang đang chứng kiến làn sóng mua gom chưa từng có. Không phải để đầu tư cho thuê, mà để ở thực. Giới CEO công nghệ và chuyên gia tài chính giờ đây sáng làm việc tại Quận 1, tối về ngắm hoàng hôn biển Nha Trang là chuyện bình thường.
                    </p>
                </div>`,
                category: "Hạ Tầng",
                author: "Lan Hương",
                date: "2026-02-10",
                readTime: "4 phút",
                image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop",
                featured: false,
                tags: ["Hyperloop", "Nghỉ dưỡng", "Hạ tầng"]
            },
            {
                id: 'art_3',
                title: "Luật Thuế BĐS Thứ 2 (2026): Những điều chỉnh phút chót",
                excerpt: "Quốc hội vừa thông qua sửa đổi quan trọng, miễn thuế cho BĐS thứ 2 nếu được sử dụng cho mục đích nhà ở xã hội hoặc cho thuê dài hạn được kiểm soát.",
                content: `<div class="space-y-6 text-slate-700 leading-relaxed">
                    <p>Chính sách mới nhằm khuyến khích nguồn cung nhà ở cho thuê giá rẻ, đồng thời giảm áp lực đầu cơ đất nền bỏ hoang.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>Miễn 100% thuế BĐS thứ 2 nếu đăng ký kinh doanh cho thuê trên 5 năm.</li>
                        <li>Áp dụng mức thuế lũy tiến 5% cho BĐS bỏ hoang quá 12 tháng.</li>
                        <li>Sử dụng dữ liệu điện/nước để xác định tình trạng sử dụng nhà (AI Audit).</li>
                    </ul>
                </div>`,
                category: "Pháp Lý",
                author: "Luật sư Nguyễn Văn B",
                date: "2026-02-08",
                readTime: "8 phút",
                image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2000",
                featured: false,
                tags: ["Luật", "Thuế", "Đầu tư"]
            },
            {
                id: 'art_4',
                title: "Net Zero Living: Tiêu chuẩn bắt buộc cho chung cư hạng A từ 2027",
                excerpt: "Các chủ đầu tư đang chạy đua tích hợp pin mặt trời trong suốt (Transparent Solar) và hệ thống tái chế nước thải tại chỗ.",
                content: `<div class="space-y-6 text-slate-700 leading-relaxed">
                    <p>Sống xanh không còn là trào lưu, mà là luật. Đến năm 2027, mọi dự án không đạt chứng chỉ Net Zero sẽ không được cấp phép mở bán thương mại.</p>
                    <h3 class="text-xl font-bold text-slate-900 mt-4">Công nghệ Biophilic Design</h3>
                    <p>Việc phủ xanh mặt đứng tòa nhà (Vertical Forest) giúp giảm nhiệt độ bề mặt tới 5 độ C, tiết kiệm 30% năng lượng làm mát.</p>
                </div>`,
                category: "Xu Hướng Xanh",
                author: "SGS Research Team",
                date: "2026-02-05",
                readTime: "5 phút",
                image: "https://images.unsplash.com/photo-1597659840241-37e2b9c2f55f?q=80&w=2070&auto=format&fit=crop", 
                featured: false,
                tags: ["Net Zero", "Green Tech"]
            },
            {
                id: 'art_5',
                title: "Hợp tác chiến lược SGS Land x Google Cloud: Kỷ nguyên định giá AI",
                excerpt: "SGS Land chính thức trở thành đối tác công nghệ Premier của Google, tích hợp Gemini 2.0 vào hệ thống lõi giúp dự báo giá chính xác tới 98%.",
                content: `<div class="space-y-6 text-slate-700 leading-relaxed">
                    <p>Tại sự kiện Google Cloud Summit 2026 diễn ra tại Singapore, CEO SGS Land đã ký kết thỏa thuận hợp tác chiến lược toàn diện.</p>
                    <p>
                        Theo đó, SGS Land sẽ sử dụng cơ sở hạ tầng TPU v5p của Google để huấn luyện các mô hình ngôn ngữ lớn (LLM) chuyên biệt cho bất động sản Việt Nam. Công nghệ này cho phép phân tích hàng tỷ điểm dữ liệu từ quy hoạch, giao thông đến tâm lý thị trường trong thời gian thực.
                    </p>
                    <div class="p-4 bg-slate-100 rounded-xl border border-slate-200 text-sm">
                        <strong>Tác động:</strong> Giúp các nhà đầu tư và ngân hàng giảm thiểu rủi ro nợ xấu và tăng tốc độ phê duyệt khoản vay mua nhà lên gấp 10 lần.
                    </div>
                </div>`,
                category: "Công Nghệ",
                author: "Ban Truyền Thông",
                date: "2026-02-01",
                readTime: "3 phút",
                image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
                featured: false,
                tags: ["Partnership", "AI", "Google Cloud"]
            }
        ];
        this.saveArticlesToStorage();
    }

    private seedUsers() {
        // Generate diverse user base for testing
        const roles = Object.values(UserRole);
        const statuses = [CommonStatus.ACTIVE, CommonStatus.ACTIVE, CommonStatus.ACTIVE, CommonStatus.PENDING, CommonStatus.INACTIVE];
        
        for (let i = 4; i <= 25; i++) {
            const status = statuses[i % statuses.length];
            // Pending users have no lastLoginAt
            const lastLogin = status === CommonStatus.PENDING ? undefined : new Date(Date.now() - Math.random() * 1000000000).toISOString();
            
            this.users.push({
                id: `u${i}` as any,
                tenantId: 't1' as any,
                name: `User ${i} ${status === CommonStatus.PENDING ? '(Invited)' : ''}`,
                email: `user${i}@sgs.vn`,
                role: roles[i % roles.length],
                avatar: `https://ui-avatars.com/api/?name=User+${i}&background=random`,
                status: status,
                source: 'INVITE',
                createdAt: new Date(Date.now() - Math.random() * 2000000000).toISOString(),
                lastLoginAt: lastLogin
            });
        }
    }

    private seedData() {
        // Mock Listings with Coordinates (Centered around HCMC: 10.7769, 106.7009)
        const BASE_LAT = 10.7769;
        const BASE_LNG = 106.7009;

        // Add 2 Projects
        this.listings.push({
            id: 'proj_1' as any,
            tenantId: 't1' as any,
            code: 'PRJ_METROPOLE',
            title: 'The Metropole Thu Thiem',
            location: 'District 2, Thu Duc City, HCMC',
            price: 15000000000,
            currency: 'VND',
            area: 100,
            type: PropertyType.PROJECT,
            status: ListingStatus.OPENING,
            transaction: TransactionType.SALE,
            attributes: { developer: 'SonKim Land', totalUnits: 1534, handoverYear: '2024', legalStatus: 'PinkBook' },
            isVerified: true,
            isFavorite: false,
            viewCount: 1500,
            ownerName: 'CĐT SonKim Land',
            ownerPhone: '19001234',
            commission: 1.5,
            commissionUnit: 'PERCENT',
            coordinates: { lat: BASE_LAT + 0.01, lng: BASE_LNG + 0.02 },
            images: ['https://picsum.photos/seed/proj1/800/600'],
            createdBy: 'u1' as any
        });

        this.listings.push({
            id: 'proj_2' as any,
            tenantId: 't1' as any,
            code: 'PRJ_VINHOMES',
            title: 'Vinhomes Grand Park',
            location: 'District 9, Thu Duc City, HCMC',
            price: 2500000000,
            currency: 'VND',
            area: 50,
            type: PropertyType.PROJECT,
            status: ListingStatus.BOOKING,
            transaction: TransactionType.SALE,
            attributes: { developer: 'Vingroup', totalUnits: 44000, handoverYear: '2025', legalStatus: 'PinkBook' },
            isVerified: true,
            isFavorite: false,
            viewCount: 3200,
            ownerName: 'CĐT Vingroup',
            ownerPhone: '18008888',
            commission: 2,
            commissionUnit: 'PERCENT',
            coordinates: { lat: BASE_LAT + 0.05, lng: BASE_LNG + 0.08 },
            images: ['https://picsum.photos/seed/proj2/800/600'],
            createdBy: 'u1' as any
        });

        for (let i = 1; i <= 50; i++) {
            const price = 5000000000 + (i * 100000000);
            
            // Random offset for coordinates (~5km radius)
            const latOffset = (Math.random() - 0.5) * 0.06;
            const lngOffset = (Math.random() - 0.5) * 0.06;

            let projectCode = undefined;
            if (i <= 10) projectCode = 'PRJ_METROPOLE';
            else if (i <= 20) projectCode = 'PRJ_VINHOMES';

            this.listings.push({
                id: `lst_${i}` as any,
                tenantId: i % 3 === 0 ? 't2' as any : 't1' as any,
                code: `LST${1000 + i}`,
                title: projectCode ? `Apartment ${i} at ${projectCode === 'PRJ_METROPOLE' ? 'Metropole' : 'Vinhomes'}` : `Premium Apartment ${i} at Metropole`,
                location: `District ${Math.floor(Math.random() * 10) + 1}, HCMC`,
                price: price,
                currency: 'VND',
                area: 80 + (i % 20),
                type: PropertyType.APARTMENT,
                status: i % 5 === 0 ? ListingStatus.SOLD : ListingStatus.AVAILABLE,
                transaction: TransactionType.SALE,
                projectCode: projectCode,
                attributes: { bedrooms: 2, bathrooms: 2, direction: 'North', floor: Math.floor(Math.random() * 30) + 1 },
                isVerified: i % 3 === 0,
                isFavorite: false,
                viewCount: i * 10,
                ownerName: `Chủ nhà ${i}`,
                ownerPhone: `09${10000000 + i}`,
                commission: 1 + (i % 3),
                commissionUnit: 'PERCENT',
                coordinates: {
                    lat: BASE_LAT + latOffset,
                    lng: BASE_LNG + lngOffset
                },
                images: [`https://picsum.photos/seed/${i}/400/300`], // Dummy images
                createdBy: i % 2 === 0 ? 'u1' as any : 'u2' as any
            });
        }
        
        // Mock Leads & Proposals Logic
        for (let i = 1; i <= 20; i++) {
            const isWon = i % 4 === 0;
            const leadId = `lead_${i}` as any;
            
            this.leads.push({
                id: leadId,
                tenantId: i % 2 === 0 ? 't1' as any : 't2' as any,
                name: `Khách hàng tiềm năng ${i}`,
                phone: `090${1234560 + i}`,
                source: i % 2 === 0 ? 'Facebook' : 'Website',
                stage: isWon ? LeadStage.WON : LeadStage.NEW,
                assignedTo: i <= 10 ? 'u1' as any : 'u2' as any,
                tags: ['hot'],
                createdAt: new Date(Date.now() - i * 86400000).toISOString(), 
                updatedAt: new Date().toISOString(),
                optOutChannels: [],
                score: { score: Math.floor(Math.random() * 100), grade: 'A' }
            });

            // Create proposals for WON leads to calculate revenue
            if (isWon) {
                const listing = this.listings[i % this.listings.length];
                this.proposals.push({
                    id: `prop_${i}` as any,
                    tenantId: (i % 2 === 0 ? 't1' : 't2') as any, // Match lead's tenantId
                    leadId: leadId,
                    listingId: listing.id,
                    basePrice: listing.price,
                    discountAmount: listing.price * 0.05, // 5% discount
                    finalPrice: listing.price * 0.95,
                    currency: 'VND',
                    status: ProposalStatus.APPROVED,
                    token: `token_${i}`,
                    validUntil: new Date(Date.now() + 86400000 * 7).toISOString(),
                    createdBy: 'Admin User',
                    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
                });
            }

            // Seed initial interactions for the first 5 leads
            if (i <= 5) {
                this.interactions.push({
                    id: `msg_init_${i}_1` as any,
                    leadId: leadId,
                    channel: Channel.ZALO,
                    direction: Direction.INBOUND,
                    type: 'TEXT',
                    content: 'Tôi quan tâm dự án này',
                    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                    status: 'READ'
                });
                this.interactions.push({
                    id: `msg_init_${i}_2` as any,
                    leadId: leadId,
                    channel: Channel.ZALO,
                    direction: Direction.OUTBOUND,
                    type: 'TEXT',
                    content: 'Chào bạn, cảm ơn bạn đã quan tâm. Bạn cần tư vấn thêm thông tin gì ạ?',
                    timestamp: new Date(Date.now() - i * 3600000 + 60000).toISOString(),
                    status: 'READ',
                    metadata: { isAgent: true }
                });
            }
        }

        // Mock Sequences
        this.sequences = [
            {
                id: 'seq_1' as any,
                name: 'Chuỗi Chào Mừng (Khách Mới)',
                triggerStage: LeadStage.NEW,
                isActive: true,
                stats: { enrolled: 150, active: 45, completed: 105, openRate: 68, replyRate: 12, clickRate: 25 },
                steps: [
                    { id: 's1', type: 'SEND_MESSAGE', delayHours: 0, channel: Channel.EMAIL, templateId: 't1' as any },
                    { id: 's2', type: 'WAIT', delayHours: 24 },
                    { id: 's3', type: 'SEND_MESSAGE', delayHours: 0, channel: Channel.ZALO, templateId: 't2' as any },
                    { id: 's4', type: 'CREATE_TASK', delayHours: 48, taskTitle: 'Follow up call' }
                ]
            },
            {
                id: 'seq_2' as any,
                name: 'Tái Tương Tác (Khách Lạnh)',
                triggerStage: LeadStage.LOST,
                isActive: false,
                stats: { enrolled: 80, active: 0, completed: 80, openRate: 25, replyRate: 5, clickRate: 8 },
                steps: [
                    { id: 's1', type: 'SEND_MESSAGE', delayHours: 0, channel: Channel.EMAIL, templateId: 't3' as any }
                ]
            }
        ];
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (err) {
            console.error("Backend logout error:", err);
        }
        if (typeof window !== 'undefined') {
            localStorage.removeItem('sgs_session_token');
        }
    }
    
    async authenticate(e: string, p: string) {
        const email = e.trim().toLowerCase();
        let user = this.users.find(u => u.email.toLowerCase() === email);
        
        // Auto-recreate admin user if missing
        if (!user && email === 'admin@sgs.vn' && p === '123456') {
            user = {
                id: 'u1' as any,
                tenantId: 't1' as any,
                name: 'Admin User',
                email: 'admin@sgs.vn',
                role: UserRole.ADMIN,
                avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=4F46E5&color=fff',
                status: CommonStatus.ACTIVE,
                source: 'SYSTEM',
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
            };
            this.users.push(user);
            this.saveUsersToStorage();
        }

        if (!user || p !== '123456') { 
             throw new Error("Invalid credentials");
        }
        
        // Call backend to set HttpOnly cookie
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password: p })
            });
            if (!res.ok) throw new Error("Backend auth failed");
            const data = await res.json();
            
            user.lastLoginAt = new Date().toISOString();
            this.saveUsersToStorage();
            if (typeof window !== 'undefined') {
                const token = data.token || btoa(JSON.stringify({ email: user.email, exp: Date.now() + 86400000 }));
                localStorage.setItem('sgs_session_token', token);
            }
            return user;
        } catch (err) {
            console.error("Backend login error:", err);
            throw err;
        }
    }

    async authenticateViaSSO(email: string) {
        const normalizedEmail = email.trim().toLowerCase();
        let user = this.users.find(u => u.email.toLowerCase() === normalizedEmail);
        if (!user) {
             const domain = normalizedEmail.split('@')[1];
             const namePart = normalizedEmail.split('@')[0];
             const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace('.', ' ');
             
             // Check if it's a public email provider
             const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
             const isPublicDomain = publicDomains.includes(domain);
             
             let tenantId: string;
             let role: UserRole;

             if (isPublicDomain) {
                 // Personal workspace for B2C users
                 tenantId = `t_personal_${Date.now()}`;
                 role = UserRole.ADMIN; // Admin of their own workspace
             } else {
                 // Corporate workspace for B2B users
                 const corporateTenantId = `t_${domain.replace(/[^a-z0-9]/g, '')}`;
                 const existingCorporateUsers = this.users.filter(u => u.tenantId === corporateTenantId);
                 
                 // Check if domain is verified (in a real app, this would check the domains table)
                 // For mock purposes, we assume a domain is verified if there's already an ADMIN
                 const isDomainVerified = existingCorporateUsers.some(u => u.role === UserRole.ADMIN);

                 if (existingCorporateUsers.length === 0) {
                     // First user from this domain. Do NOT grant corporate admin yet.
                     // Put them in a pending workspace until domain is verified.
                     tenantId = `t_pending_${domain.replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
                     role = UserRole.ADMIN; // Admin of their *pending* workspace
                 } else if (isDomainVerified) {
                     // Corporate workspace exists and is verified.
                     tenantId = corporateTenantId;
                     role = UserRole.VIEWER; // Default role for new members
                 } else {
                     // Corporate workspace exists but NOT verified.
                     // Put them in their own pending workspace
                     tenantId = `t_pending_${domain.replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
                     role = UserRole.ADMIN;
                 }
             }

             const newUser: User = {
                id: `u_sso_${Date.now()}` as any,
                tenantId: tenantId as any,
                name: displayName,
                email: email,
                role: role, 
                status: CommonStatus.ACTIVE,
                source: 'SSO', 
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=DB4437&color=fff`, 
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                metadata: {
                    theme: 'system',
                    notifications: { email: true, push: true, zalo: false }
                }
            };
            this.users.push(newUser);
            user = newUser;
        } else {
            user.lastLoginAt = new Date().toISOString();
        }
        
        // Call backend to set HttpOnly cookie
        try {
            const res = await fetch('/api/auth/sso', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: email })
            });
            if (!res.ok) throw new Error("Backend auth failed");
            const data = await res.json();
            
            this.saveUsersToStorage();
            if (typeof window !== 'undefined') {
                const token = data.token || btoa(JSON.stringify({ email: user.email, exp: Date.now() + 86400000 }));
                localStorage.setItem('sgs_session_token', token);
            }
            return user;
        } catch (err) {
            console.error("Backend SSO login error:", err);
            throw err;
        }
    }
    
    async register(name: string, email: string, p: string, companyName?: string) {
        if (this.users.some(u => u.email === email)) {
            throw new Error("Email already exists");
        }
        
        // Ensure tenant isolation for B2C users
        const tenantId = companyName 
            ? `t_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-4)}` 
            : `t_personal_${Date.now()}`;

        const newUser: User = {
            id: `u_${Date.now()}` as any,
            tenantId: tenantId as any,
            name: name,
            email: email,
            // If they don't provide a company, they are the admin of their personal workspace
            role: UserRole.ADMIN, 
            status: CommonStatus.ACTIVE,
            source: 'INVITE',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        };
        this.users.push(newUser);
        this.saveUsersToStorage();
        
        // Call backend to register and set HttpOnly cookie
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, email, password: p, company: companyName })
            });
            if (!res.ok) throw new Error("Backend register failed");
            const data = await res.json();
            
            if (typeof window !== 'undefined') {
                const token = data.token || btoa(JSON.stringify({ email: newUser.email, exp: Date.now() + 86400000 }));
                localStorage.setItem('sgs_session_token', token);
            }
        } catch (err) {
            console.error("Backend register error:", err);
            if (typeof window !== 'undefined') {
                const token = btoa(JSON.stringify({ email: newUser.email, exp: Date.now() + 86400000 }));
                localStorage.setItem('sgs_session_token', token);
            }
        }
        
        return newUser;
    }

    async requestPasswordReset(e: string) { 
        const user = this.users.find(u => u.email === e);
        if (!user) throw new Error("Email not found");
        if (user.source === 'SSO') throw new Error("Please reset your password via your Google Workspace provider.");
        return "123456"; 
    }
    
    async resetPassword(t: string, p: string) {
        if (t !== '123456') throw new Error("Invalid token");
    }

    async getCurrentUser(): Promise<User | null> {
        const sessionToken = typeof localStorage !== 'undefined' ? localStorage.getItem('sgs_session_token') : null;
        if (sessionToken) {
            try {
                // Verify with backend
                const res = await fetch('/api/auth/me', { credentials: 'include' });
                if (!res.ok) {
                    this.logout();
                    return null;
                }
                
                if (sessionToken.includes('@')) {
                    // Fallback for old unencrypted tokens
                    return this.users.find(u => u.email === sessionToken) || null;
                }
                
                let decoded: any;
                if (sessionToken.split('.').length === 3) {
                    // It's a JWT token
                    const base64Url = sessionToken.split('.')[1];
                    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    while (base64.length % 4) {
                        base64 += '=';
                    }
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    decoded = JSON.parse(jsonPayload);
                } else {
                    decoded = JSON.parse(atob(sessionToken));
                }

                // Check expiration
                if (decoded.exp) {
                    const expMs = decoded.exp < 10000000000 ? decoded.exp * 1000 : decoded.exp;
                    if (expMs < Date.now()) {
                        this.logout();
                        return null;
                    }
                }
                return this.users.find(u => u.email === decoded.email) || null;
            } catch (e) {
                console.error("Error decoding token", e);
                return null;
            }
        }
        return null;
    }

    async requireAdmin() {
        const user = await this.getCurrentUser();
        if (user?.role !== UserRole.ADMIN) {
            throw new Error("Access denied. Admin role required.");
        }
    }

    async getUserMenu(role: UserRole) {
        const core = { id: 'core', labelKey: 'menu.core', items: [
            { id: 'home', labelKey: 'menu.home', route: ROUTES.LANDING, iconKey: ROUTES.LANDING },
            { id: 'dash', labelKey: 'menu.dashboard', route: ROUTES.DASHBOARD, iconKey: ROUTES.DASHBOARD },
            { id: 'leads', labelKey: 'menu.leads', route: ROUTES.LEADS, iconKey: ROUTES.LEADS },
            { id: 'contracts', labelKey: 'menu.contracts', route: ROUTES.CONTRACTS, iconKey: ROUTES.CONTRACTS },
            { id: 'inv', labelKey: 'menu.inventory', route: ROUTES.INVENTORY, iconKey: ROUTES.INVENTORY },
            { id: 'inbox', labelKey: 'menu.inbox', route: ROUTES.INBOX, iconKey: ROUTES.INBOX },
            { id: 'fav', labelKey: 'menu.favorites', route: ROUTES.FAVORITES, iconKey: ROUTES.FAVORITES }
        ]};

        const ops = { id: 'ops', labelKey: 'menu.operations', items: [
            { id: 'knowledge', labelKey: 'menu.knowledge', route: ROUTES.KNOWLEDGE, iconKey: ROUTES.KNOWLEDGE },
            { id: 'rep', labelKey: 'menu.reports', route: ROUTES.REPORTS, iconKey: ROUTES.REPORTS }
        ]};

        const sys = { id: 'sys', labelKey: 'menu.ecosystem', items: [
            { id: 'users', labelKey: 'menu.admin-users', route: ROUTES.ADMIN_USERS, iconKey: ROUTES.ADMIN_USERS },
            { id: 'set', labelKey: 'menu.enterprise-settings', route: ROUTES.ENTERPRISE_SETTINGS, iconKey: ROUTES.ENTERPRISE_SETTINGS }
        ]};

        if (role === UserRole.ADMIN) {
            return [core, ops, sys];
        } else if (role === UserRole.TEAM_LEAD) {
            return [core, ops, sys];
        } else if (role === UserRole.SALES) {
            return [core, ops];
        } else {
            return [core];
        }
    }

    // --- ANALYTICS ENGINE (ENHANCED) ---
    async getAnalytics(timeRange: string, language: string): Promise<AnalyticsSummary & { revenue: number, recentActivities: any[] }> {
        const currentUser = await this.getCurrentUser();
        let scopedLeads = this.withRLS(this.leads);
        let scopedProposals = this.withRLS(this.proposals);
        let scopedInteractions = this.interactions; // Interactions are usually lead-scoped already

        // Apply Role-Based Access Control (RBAC)
        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            scopedLeads = scopedLeads.filter(l => l.assignedTo === currentUser.id);
            const accessibleLeadIds = new Set(scopedLeads.map(l => l.id));
            scopedProposals = scopedProposals.filter(p => accessibleLeadIds.has(p.leadId));
            scopedInteractions = scopedInteractions.filter(i => accessibleLeadIds.has(i.leadId));
        }
        
        const summary = AnalyticsService.getSummary(scopedLeads, scopedProposals, scopedInteractions, language, timeRange);

        // Dynamic Activities based on actual data
        const recentLeads = scopedLeads.slice(0, 3);
        const recentDeals = scopedProposals.filter(p => p.status === ProposalStatus.APPROVED).slice(0, 2);
        
        const now = new Date();
        const activities = [
            ...recentLeads.map((l, i) => ({
                type: 'LEAD',
                content: language === 'vn' ? `Khách hàng mới "${l.name}" từ ${l.source}` : `New lead "${l.name}" from ${l.source}`,
                time: `${i * 15 + 5}m ago`,
                timestamp: new Date(now.getTime() - (i * 15 + 5) * 60000).getTime(),
                icon: 'USER'
            })),
            ...recentDeals.map((p, i) => {
                const commission = Math.floor(p.finalPrice * 0.02);
                const formatter = new Intl.NumberFormat(language === 'vn' ? 'vi-VN' : 'en-US', { style: 'currency', currency: language === 'vn' ? 'VND' : 'USD' });
                return {
                    type: 'DEAL',
                    content: language === 'vn' ? `Chốt deal ${formatter.format(p.finalPrice)} (Hoa hồng: ${formatter.format(commission)})` : `Closed deal ${formatter.format(p.finalPrice)}`,
                    time: `${i * 45 + 30}m ago`,
                    timestamp: new Date(now.getTime() - (i * 45 + 30) * 60000).getTime(),
                    icon: 'CHECK'
                };
            }),
            {
                type: 'AI',
                content: language === 'vn' ? `AI đã tự động trả lời 15 tin nhắn Zalo` : `AI auto-replied to 15 Zalo messages`,
                time: '10m ago',
                timestamp: new Date(now.getTime() - 10 * 60000).getTime(),
                icon: 'AI'
            },
            {
                type: 'SYSTEM',
                content: language === 'vn' ? `Đồng bộ dữ liệu CRM thành công` : `CRM data sync completed successfully`,
                time: '1h ago',
                timestamp: new Date(now.getTime() - 60 * 60000).getTime(),
                icon: 'CLOUD'
            }
        ];

        // Sort activities by timestamp descending
        activities.sort((a, b) => b.timestamp - a.timestamp);

        // Market Pulse Data (Dynamic based on listings)
        const marketPulse = this.listings
            .filter(l => l.price && l.area && l.price > 0 && l.area > 0)
            .map(listing => {
                // Mock interest based on viewCount or random
                const interest = listing.viewCount ? Math.min(listing.viewCount, 400) : Math.floor(Math.random() * 200) + 50;
                // Convert price to billions (Tỷ) for the chart
                const priceInBillion = listing.price / 1000000000;
                
                // Extract district from location (e.g., "District 2, ..." -> "Q2")
                let location = 'Khác';
                if (listing.location) {
                    const match = listing.location.match(/District (\d+)|Quận (\d+)/i);
                    if (match) {
                        location = `Q${match[1] || match[2]}`;
                    } else if (listing.location.toLowerCase().includes('thu duc')) {
                        location = 'TĐ';
                    }
                }

                return {
                    area: listing.area,
                    price: parseFloat(priceInBillion.toFixed(1)),
                    interest: Math.round(interest),
                    location: location
                };
            })
            .slice(0, 50); // Limit to 50 points for performance

        // Agent Leaderboard Data (Dynamic based on system users and leads)
        const agentLeaderboard = this.users
            .filter(u => u.role === UserRole.SALES || u.role === UserRole.TEAM_LEAD || u.role === UserRole.ADMIN)
            .map(user => {
                // Find leads assigned to this user
                const userLeads = this.leads.filter(l => l.assignedTo === user.id);
                const totalLeads = userLeads.length;
                const wonLeads = userLeads.filter(l => l.stage === LeadStage.WON).length;
                
                // Calculate close rate
                const closeRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
                
                // Calculate SLA score (mock logic based on slaBreached)
                const breachedLeads = userLeads.filter(l => l.slaBreached).length;
                const slaScore = totalLeads > 0 ? Math.round(((totalLeads - breachedLeads) / totalLeads) * 100) : 100;
                
                // Mock avg response time based on SLA score
                const avgResponseTime = slaScore > 90 ? '3m' : slaScore > 80 ? '10m' : '25m';

                return {
                    id: user.id,
                    name: user.name,
                    avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`,
                    closeRate: closeRate,
                    slaScore: slaScore,
                    avgResponseTime,
                    deals: wonLeads
                };
            })
            .sort((a, b) => b.deals - a.deals || b.closeRate - a.closeRate) // Sort by deals, then close rate
            .slice(0, 5); // Top 5

        return {
            ...summary,
            recentActivities: activities,
            marketPulse,
            agentLeaderboard
        };
    }

    // CRM
    async getLeads(page: number, size: number, filters: any) {
        const start = (page - 1) * size;
        const currentUser = await this.getCurrentUser();
        
        // Apply RLS before filtering
        let scopedLeads = this.withRLS(this.leads);

        // Apply Role-Based Access Control (RBAC)
        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            // Sales, Marketing, Viewer can only see leads assigned to them
            scopedLeads = scopedLeads.filter(l => l.assignedTo === currentUser.id);
        }

        const { smartMatch } = await import('../utils/textUtils');
        const filtered = scopedLeads.filter(l => 
            (!filters.search || smartMatch((l.name || '') + (l.phone || '') + (l.email || ''), filters.search)) &&
            (!filters.stage || filters.stage === 'ALL' || l.stage === filters.stage) &&
            (!filters.source || filters.source === 'ALL' || l.source === filters.source)
        );
        if (filters.sort === 'score') {
            filtered.sort((a,b) => (b.score?.score || 0) - (a.score?.score || 0));
        }

        const newCount = filtered.filter(l => l.stage === LeadStage.NEW).length;
        const wonCount = filtered.filter(l => l.stage === LeadStage.WON).length;
        const avgScore = filtered.length > 0 
            ? Math.round(filtered.reduce((acc, l) => acc + (l.score?.score || 0), 0) / filtered.length) 
            : 0;

        return {
            data: filtered.slice(start, start + size),
            total: filtered.length,
            page,
            pageSize: size,
            totalPages: Math.ceil(filtered.length / size),
            stats: {
                total: filtered.length,
                newCount,
                wonCount,
                avgScore,
                winRate: filtered.length > 0 ? Math.round((wonCount / filtered.length) * 100) : 0
            }
        };
    }

    async createLead(data: Partial<Lead>) {
        const currentUser = await this.getCurrentUser();
        
        // 0. Duplicate Check
        if (data.phone) {
            const existing = this.withRLS(this.leads).find(l => l.phone === data.phone);
            if (existing) {
                throw new Error(`DUPLICATE_LEAD: Khách hàng với SĐT ${data.phone} đã tồn tại (${existing.name}, ID: ${existing.id})`);
            }
        }

        // 1. Initial Heuristic Score (Fast)
        let calculatedScore = 50;
        let grade = 'C';
        let aiReasoning = 'Đang chờ AI chấm điểm...';
        
        if (this.scoringConfig && this.scoringConfig.weights) {
            const weights = this.scoringConfig.weights;
            const totalMaxScore = Object.values(weights).reduce((a: number, b: number) => a + b, 0) || 1;
            
            let score = 0;
            const hasPhone = !!data.phone ? 1 : 0;
            const hasEmail = !!data.email ? 1 : 0;
            const completeness = (hasPhone + hasEmail) / 2;
            
            score += (weights.completeness || 0) * completeness;
            score += (weights.engagement || 0) * 0.5;
            score += (weights.budgetFit || 0) * (data.preferences?.budgetMax ? 1 : 0.5);
            score += (weights.velocity || 0) * 0.5;
            
            calculatedScore = Math.min(100, Math.round((score / totalMaxScore) * 100));
            if (calculatedScore >= 80) grade = 'A';
            else if (calculatedScore >= 60) grade = 'B';
            else if (calculatedScore >= 40) grade = 'C';
            else grade = 'D';
        }

        // 2. Apply Routing Rules
        let assignedTo = data.assignedTo || currentUser?.id;
        
        // Sort rules by priority (lower number = higher priority)
        const activeRules = this.routingRules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
        
        for (const rule of activeRules) {
            let matched = true;
            if (rule.conditions.source && rule.conditions.source.length > 0 && !rule.conditions.source.includes(data.source || '')) {
                matched = false;
            }
            
            if (matched && rule.conditions.budgetMin && data.preferences?.budgetMax) {
                if (data.preferences.budgetMax < rule.conditions.budgetMin) matched = false;
            }
            
            if (matched && rule.conditions.budgetMax && data.preferences?.budgetMax) {
                if (data.preferences.budgetMax > rule.conditions.budgetMax) matched = false;
            }
            
            if (matched && rule.conditions.region && rule.conditions.region.length > 0) {
                const leadRegions = data.preferences?.regions || [];
                const hasMatchingRegion = leadRegions.some(r => rule.conditions.region?.includes(r));
                if (!hasMatchingRegion && leadRegions.length > 0) matched = false;
            }
            
            if (matched) {
                if (rule.action.type === 'ASSIGN_USER') {
                    assignedTo = rule.action.targetId as any;
                } else if (rule.action.type === 'ASSIGN_TEAM') {
                    // Implement Round-Robin assignment
                    const teamId = rule.action.targetId || 'default_team';
                    const targetTeam = this.teams.find(t => t.id === teamId);
                    
                    let eligibleUsers: User[] = [];
                    if (targetTeam && targetTeam.memberIds && targetTeam.memberIds.length > 0) {
                        eligibleUsers = this.users.filter(u => targetTeam.memberIds.includes(u.id) && u.status === CommonStatus.ACTIVE);
                    } else {
                        // Fallback: Find all users in this tenant who are SALES, TEAM_LEAD, or ADMIN
                        eligibleUsers = this.users.filter(u => 
                            u.tenantId === this.currentTenantId && 
                            (u.role === UserRole.SALES || u.role === UserRole.TEAM_LEAD || u.role === UserRole.ADMIN) &&
                            u.status === CommonStatus.ACTIVE
                        );
                    }
                    
                    if (eligibleUsers.length > 0) {
                        const currentIndex = this.teamAssignmentState[teamId] || 0;
                        const nextIndex = currentIndex % eligibleUsers.length;
                        assignedTo = eligibleUsers[nextIndex].id as any;
                        this.teamAssignmentState[teamId] = nextIndex + 1;
                    } else {
                        assignedTo = currentUser?.id; 
                    }
                }
                break; // Stop evaluating rules once a match is found
            }
        }

        const newLead = { 
            ...data, 
            id: `lead_${Date.now()}` as any, 
            tenantId: this.currentTenantId as any, // Auto-inject tenantId (like RLS default)
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            score: { score: calculatedScore, grade, reasoning: aiReasoning },
            assignedTo: assignedTo as any
        } as Lead;
        this.leads.unshift(newLead);
        this.saveLeadsToStorage();
        
        // 3. Trigger Sequences
        this.triggerSequencesForLead(newLead);
        
        // 4. Enqueue AI Scoring Task (Background)
        try {
            const { queueService } = await import('./queueService');
            const lang = typeof window !== 'undefined' ? (localStorage.getItem('sgs_lang') || 'vn') : 'vn';
            
            queueService.enqueue('SCORE_LEAD', {
                leadId: newLead.id,
                leadData: data,
                weights: this.scoringConfig?.weights,
                lang
            });
        } catch (e) {
            console.error("Failed to enqueue AI scoring task:", e);
        }
        
        return newLead;
    }

    private async triggerSequencesForLead(lead: Lead) {
        const activeSequences = this.sequences.filter(s => s.isActive && s.triggerStage === lead.stage);
        for (const seq of activeSequences) {
            // Simulate enrolling lead in sequence
            if (seq.stats) seq.stats.enrolled++;
            
            // Simulate first step execution if delay is 0
            const firstStep = seq.steps[0];
            if (firstStep && firstStep.delayHours === 0 && firstStep.type === 'SEND_MESSAGE') {
                this.interactions.push({
                    id: `int_${Date.now()}` as any,
                    leadId: lead.id,
                    type: 'TEXT',
                    channel: firstStep.channel || Channel.EMAIL,
                    direction: Direction.OUTBOUND,
                    content: `[Automated Sequence: ${seq.name}] Xin chào ${lead.name}, cảm ơn bạn đã quan tâm.`,
                    timestamp: new Date().toISOString(),
                    status: 'SENT'
                });
                this.saveInteractionsToStorage();
            }
        }
    }

    async updateLead(id: string, data: Partial<Lead>) {
        const currentUser = await this.getCurrentUser();
        const index = this.leads.findIndex(l => l.id === id);
        
        if (index !== -1) {
            const lead = this.leads[index];
            
            // Check RBAC
            if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
                if (lead.assignedTo !== currentUser.id) {
                    throw new Error("Access denied. You can only update your own leads.");
                }
            }

            const oldStage = lead.stage;
            this.leads[index] = { ...lead, ...data, updatedAt: new Date().toISOString() };
            
            // Re-evaluate score if important fields changed
            if (data.phone !== undefined || data.email !== undefined || data.preferences !== undefined || data.notes !== undefined || data.source !== undefined) {
                if (this.scoringConfig && this.scoringConfig.weights) {
                    const weights = this.scoringConfig.weights;
                    const totalMaxScore = Object.values(weights).reduce((a: number, b: number) => a + b, 0) || 1;
                    
                    let score = 0;
                    const hasPhone = !!this.leads[index].phone ? 1 : 0;
                    const hasEmail = !!this.leads[index].email ? 1 : 0;
                    const completeness = (hasPhone + hasEmail) / 2;
                    
                    score += (weights.completeness || 0) * completeness;
                    score += (weights.engagement || 0) * 0.5;
                    score += (weights.budgetFit || 0) * (this.leads[index].preferences?.budgetMax ? 1 : 0.5);
                    score += (weights.velocity || 0) * 0.5;
                    
                    const calculatedScore = Math.min(100, Math.round((score / totalMaxScore) * 100));
                    let grade = 'D';
                    if (calculatedScore >= 80) grade = 'A';
                    else if (calculatedScore >= 60) grade = 'B';
                    else if (calculatedScore >= 40) grade = 'C';
                    
                    this.leads[index].score = {
                        score: calculatedScore,
                        grade: grade as any,
                        reasoning: 'Hệ thống tự động cập nhật lại điểm số (Heuristic). Đang chờ AI phân tích...'
                    };
                }

                // Enqueue AI Scoring Task (Background)
                try {
                    const { queueService } = await import('./queueService');
                    const lang = typeof window !== 'undefined' ? (localStorage.getItem('sgs_lang') || 'vn') : 'vn';
                    
                    queueService.enqueue('SCORE_LEAD', {
                        leadId: this.leads[index].id,
                        leadData: this.leads[index],
                        weights: this.scoringConfig?.weights,
                        lang
                    });
                } catch (e) {
                    console.error("Failed to enqueue AI scoring task:", e);
                }
            }
            
            if (data.stage && data.stage !== oldStage) {
                this.triggerSequencesForLead(this.leads[index]);

                if (data.stage === LeadStage.LOST) {
                    this.proposals.forEach(p => {
                        if (p.leadId === id && (p.status === ProposalStatus.PENDING_APPROVAL || p.status === ProposalStatus.DRAFT)) {
                            p.status = ProposalStatus.REJECTED;
                            p.updatedAt = new Date().toISOString();
                        }
                    });
                    this.saveProposalsToStorage();
                }
            }
            this.saveLeadsToStorage();
            return this.leads[index];
        }
        throw new Error("Lead not found");
    }

    async deleteLead(id: string) {
        const currentUser = await this.getCurrentUser();
        const lead = this.leads.find(l => l.id === id);
        if (!lead) return;

        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            if (lead.assignedTo !== currentUser.id) {
                throw new Error("Access denied. You can only delete your own leads.");
            }
        }

        this.leads = this.leads.filter(l => l.id !== id);
        // Cascade delete interactions and proposals
        this.interactions = this.interactions.filter(i => i.leadId !== id);
        this.proposals = this.proposals.filter(p => p.leadId !== id);
        this.saveLeadsToStorage();
        this.saveInteractionsToStorage();
        this.saveProposalsToStorage();
    }

    async checkDuplicateLead(phone: string) {
        return this.leads.find(l => l.phone === phone) || null;
    }

    async duplicateLead(id: string) {
        const currentUser = await this.getCurrentUser();
        const original = this.leads.find(l => l.id === id);
        if (original) {
            if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
                if (original.assignedTo !== currentUser.id) {
                    throw new Error("Access denied. You can only duplicate your own leads.");
                }
            }
            this.createLead({ ...original, name: `${original.name} (Copy)` });
        }
    }

    async getLeadById(id: string) {
        const currentUser = await this.getCurrentUser();
        const lead = this.withRLS(this.leads).find(l => l.id === id);
        if (!lead) return null;

        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            if (lead.assignedTo !== currentUser.id) return null;
        }
        return lead;
    }

    private maskListingSensitiveData(listing: Listing, user: User | null): Listing {
        if (!listing) return listing;
        
        // Check if user can view sensitive info
        const canView = this.canUserViewSensitiveInfo(user, listing);
        
        if (canView) return listing;

        // Mask sensitive fields
        return {
            ...listing,
            ownerName: listing.ownerName ? (listing.ownerName.charAt(0) + '***') : undefined,
            ownerPhone: listing.ownerPhone ? (listing.ownerPhone.substring(0, 3) + '*******') : undefined,
            commission: undefined,
            commissionUnit: undefined,
        };
    }

    private canUserViewSensitiveInfo(user: User | null, listing: Listing): boolean {
        if (!user) return false;
        
        // Admins and Team Leads can always view
        if ([UserRole.ADMIN, UserRole.TEAM_LEAD].includes(user.role)) return true;
        
        // Creator can always view
        if (listing.createdBy === user.id) return true;
        
        // Check for specific permission
        if (user.permissions?.includes('VIEW_SENSITIVE_INFO')) return true;
        
        // Check if explicitly authorized for this listing
        if (listing.authorizedAgents?.includes(user.id)) return true;
        
        return false;
    }

    async getListingWithSensitiveData(id: string) {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) throw new Error("Unauthorized");

        const listing = this.listings.find(l => l.id === id);
        if (!listing) throw new Error("Listing not found");

        if (!this.canUserViewSensitiveInfo(currentUser, listing)) {
            throw new Error("Forbidden: You do not have permission to view sensitive data for this listing.");
        }

        // Log the access to sensitive data
        this.auditLogs.push({
            id: `audit_${Date.now()}` as any,
            timestamp: new Date().toISOString(),
            actorId: currentUser.email,
            action: 'VIEW_SENSITIVE_LISTING_DATA',
            entityType: 'LISTING',
            entityId: id,
            details: `User requested to view sensitive data (ownerPhone, commission) for listing ${id}`,
            ipAddress: '127.0.0.1' // Mock IP
        });

        return { ...listing, isFavorite: this.favorites.has(listing.id) };
    }

    // Inventory
    async getListings(page: number, size: number, filters?: any) {
        const currentUser = await this.getCurrentUser();
        const start = (page - 1) * size;
        let scopedListings = this.withRLS(this.listings).map(l => ({ ...l, isFavorite: this.favorites.has(l.id) }));
        
        // Role-based filtering: Sales only see their own listings OR listings they are authorized for
        // Actually, usually agents can see ALL listings to sell them, but only sensitive info is hidden.
        // The previous logic was very restrictive. Let's make it more flexible but keep masking.
        /* 
        if (currentUser && currentUser.role === UserRole.SALES) {
            scopedListings = scopedListings.filter(l => l.createdBy === currentUser.id);
        }
        */

        if (filters) {
            const { smartMatch } = await import('../utils/textUtils');
            scopedListings = scopedListings.filter(l => {
                const typeStr = l.type.toUpperCase();
                const matchesSearch = !filters.search || smartMatch((l.title || '') + ' ' + (l.code || '') + ' ' + (l.location || '') + ' ' + typeStr, filters.search);
                const matchesType = !filters.type || filters.type === 'ALL' || l.type === filters.type;
                const matchesStatus = !filters.status || filters.status === 'ALL' || l.status === filters.status;
                const matchesTransaction = !filters.transaction || filters.transaction === 'ALL' || l.transaction === filters.transaction;
                return matchesSearch && matchesType && matchesStatus && matchesTransaction;
            });
        }

        const availableCount = scopedListings.filter(l => l.status === 'AVAILABLE').length;
        const holdCount = scopedListings.filter(l => l.status === 'HOLD').length;
        const soldCount = scopedListings.filter(l => l.status === 'SOLD').length;

        // Apply masking to the returned data
        const paginatedData = scopedListings.slice(start, start + size).map(l => this.maskListingSensitiveData(l, currentUser));

        return {
            data: paginatedData,
            total: scopedListings.length,
            page,
            pageSize: size,
            totalPages: Math.ceil(scopedListings.length / size),
            stats: {
                availableCount,
                holdCount,
                soldCount
            }
        };
    }

    async getListingById(id: string) {
        const currentUser = await this.getCurrentUser();
        const listing = this.listings.find(l => l.id === id);
        if (listing) {
            // Increment view count
            listing.viewCount = (listing.viewCount || 0) + 1;
            
            // Apply masking
            const maskedListing = this.maskListingSensitiveData(listing, currentUser);
            
            return { ...maskedListing, isFavorite: this.favorites.has(listing.id) };
        }
        return undefined;
    }

    async getSimilarListings(id: string) {
        const source = this.listings.find(l => l.id === id);
        if (!source) return [];
        return this.listings
            .filter(l => l.type === source.type && l.id !== id)
            .slice(0, 4)
            .map(l => ({ ...l, isFavorite: this.favorites.has(l.id) }));
    }

    async searchListings(criteria: any) {
        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
        return this.withRLS(this.listings).filter(l => {
            const query = normalize(criteria.query || '');
            const matchesQuery = !query || 
                normalize(l.title).includes(query) || 
                normalize(l.code).includes(query) || 
                normalize(l.location).includes(query);
            const matchesPrice = !criteria.priceMax || l.price <= criteria.priceMax;
            return matchesQuery && matchesPrice;
        }).map(l => ({ ...l, isFavorite: this.favorites.has(l.id) }));
    }

    async createListing(data: Partial<Listing>) {
        const currentUser = await this.getCurrentUser();
        const newListing = { 
            ...data, 
            id: `lst_${Date.now()}` as any,
            tenantId: this.currentTenantId as any,
            viewCount: data.viewCount || 0,
            bookingCount: data.bookingCount || 0,
            createdBy: currentUser?.id
        } as Listing;
        this.listings.unshift(newListing);
        this.saveListingsToStorage();
        return newListing;
    }

    async updateListing(id: string, data: Partial<Listing>) {
        const currentUser = await this.getCurrentUser();
        const index = this.listings.findIndex(l => l.id === id);
        if (index !== -1) {
            const listing = this.listings[index];
            // RBAC
            if (currentUser && currentUser.role === UserRole.SALES && listing.createdBy !== currentUser.id) {
                // If they are not the owner, we check if they are authorized
                const canView = this.canUserViewSensitiveInfo(currentUser, listing);
                if (!canView) {
                    throw new Error("Access denied. You can only update your own listings.");
                }
                
                // If they are authorized but NOT the owner, we might still want to prevent them from changing sensitive info
                // For now, let's just make sure they don't overwrite real data with masked data
                if (data.ownerPhone && data.ownerPhone.includes('*')) {
                    delete data.ownerPhone;
                }
                if (data.ownerName && data.ownerName.includes('*')) {
                    delete data.ownerName;
                }
            }
            this.listings[index] = { ...this.listings[index], ...data };
            this.saveListingsToStorage();
        }
        return this.listings[index];
    }

    async deleteListing(id: string) {
        const currentUser = await this.getCurrentUser();
        const listing = this.listings.find(l => l.id === id);
        if (listing) {
            // RBAC
            if (currentUser && currentUser.role === UserRole.SALES && listing.createdBy !== currentUser.id) {
                throw new Error("Access denied. You can only delete your own listings.");
            }
            this.listings = this.listings.filter(l => l.id !== id);
            this.saveListingsToStorage();
        }
    }

    async duplicateListing(id: string) {
        const currentUser = await this.getCurrentUser();
        const original = this.listings.find(l => l.id === id);
        if (original) {
            // RBAC
            if (currentUser && currentUser.role === UserRole.SALES && original.createdBy !== currentUser.id) {
                throw new Error("Access denied. You can only duplicate your own listings.");
            }
            await this.createListing({ 
                ...original, 
                code: `${original.code}-COPY`, 
                title: `${original.title} (Copy)`,
                viewCount: 0,
                isFavorite: false,
                bookingCount: 0
            });
        }
    }

    async incrementListingView(id: string) {
        const l = this.listings.find(x => x.id === id);
        if (l) {
            l.viewCount = (l.viewCount || 0) + 1;
            this.saveListingsToStorage();
        }
    }

    async addToFavorites(id: string) {
        this.favorites.add(id);
    }

    async removeFromFavorites(id: string) {
        this.favorites.delete(id);
    }

    async getFavorites(page: number, size: number) {
        const favs = this.listings
            .filter(l => this.favorites.has(l.id))
            .map(l => ({ ...l, isFavorite: true }));
        return {
            data: favs.slice((page - 1) * size, page * size),
            total: favs.length,
            page,
            pageSize: size,
            totalPages: Math.ceil(favs.length / size)
        };
    }

    // System
    async ping(): Promise<boolean> { return true; }

    async createBackup(): Promise<string> {
        return JSON.stringify({ users: this.users, leads: this.leads, listings: this.listings });
    }

    async restoreBackup(content: string) {
        const data = JSON.parse(content);
        if (data.users) {
            this.users = data.users;
            this.saveUsersToStorage();
        }
        if (data.leads) this.leads = data.leads;
        if (data.listings) this.listings = data.listings;
    }

    async getTenantUsers(page: number, size: number, search?: string, role?: string, sort?: { field: string, order: 'asc' | 'desc' }) {
        const allTenantUsers = this.withRLS(this.users);
        let filtered = allTenantUsers;
        if (search) {
            const { smartMatch } = await import('../utils/textUtils');
            filtered = filtered.filter(u => smartMatch((u.name || '') + (u.email || '') + (u.phone || ''), search));
        }
        if (role) filtered = filtered.filter(u => u.role === role);
        if (sort) {
            filtered.sort((a, b) => {
                let valA = (a as any)[sort.field];
                let valB = (b as any)[sort.field];
                if (!valA) return 1; if (!valB) return -1;
                if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
                if (valA < valB) return sort.order === 'asc' ? -1 : 1;
                if (valA > valB) return sort.order === 'asc' ? 1 : -1;
                return 0;
            });
        }
        const activeCount = allTenantUsers.filter(u => u.status === CommonStatus.ACTIVE).length;
        const pendingCount = allTenantUsers.filter(u => u.status === CommonStatus.PENDING).length;
        return {
            data: filtered.slice((page - 1) * size, page * size),
            total: filtered.length,
            stats: { activeCount, pendingCount }
        };
    }

    async updateUserProfile(id: string, data: Partial<User>) {
        const idx = this.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            const currentUser = this.users[idx];
            if (currentUser.source === 'SSO' && (data.email || (data as any).password)) delete data.email; 
            if (data.email && data.email !== currentUser.email) {
                if (this.users.some(u => u.email === data.email && u.id !== id)) throw new Error("Email already exists");
            }
            this.users[idx] = { ...currentUser, ...data };
            this.saveUsersToStorage();
            return this.users[idx];
        }
        throw new Error("User not found");
    }

    async deleteUser(id: string) { 
        this.users = this.users.filter(u => u.id !== id); 
        this.saveUsersToStorage();
    }

    async inviteUser(email: string, role: UserRole) {
        if (this.users.some(u => u.email === email)) throw new Error("User already exists");
        this.users.unshift({
            id: `u_${Date.now()}` as any,
            tenantId: 't1' as any,
            name: email.split('@')[0],
            email: email,
            role: role,
            status: CommonStatus.PENDING,
            source: 'INVITE',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`,
            createdAt: new Date().toISOString()
        });
        this.saveUsersToStorage();
    }

    async resendInvite(id: string) {
        await new Promise(r => setTimeout(r, 800));
        const user = this.users.find(u => u.id === id);
        if (!user) throw new Error("User not found");
        if (user.status === CommonStatus.ACTIVE && user.lastLoginAt) throw new Error("User already active");
    }

    async changeUserPassword(id: string, current: string, newVal: string) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const user = this.users.find(u => u.id === id);
        if (!user) throw new Error("User not found");
        if (user.source === 'SSO') throw new Error("SSO users cannot change passwords locally.");
        if (current !== '123456') throw new Error("Invalid credentials");
    }

    // Proposals
    async getPendingProposals() {
        const currentUser = await this.getCurrentUser();
        let scoped = this.withRLS(this.proposals).filter(p => p.status === ProposalStatus.PENDING_APPROVAL);
        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            const accessibleLeadIds = new Set(this.withRLS(this.leads).filter(l => l.assignedTo === currentUser.id).map(l => l.id));
            scoped = scoped.filter(p => accessibleLeadIds.has(p.leadId));
        }
        return scoped;
    }

    async getProposalByToken(token: string) {
        return this.proposals.find(p => p.token === token) || null;
    }

    async createProposal(data: Partial<Proposal>) {
        const currentUser = await this.getCurrentUser();
        // Smart Approval Logic: Auto-approve if discount <= 10%
        const discountPct = (data.discountAmount || 0) / (data.basePrice || 1);
        const status = discountPct > 0.10 ? ProposalStatus.PENDING_APPROVAL : ProposalStatus.APPROVED;

        const newP = { 
            ...data, 
            id: `prop_${Date.now()}` as any, 
            status: status,
            token: `token_${Date.now()}`,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'System',
            createdById: currentUser?.id
        } as Proposal;
        this.proposals.push(newP);
        this.saveProposalsToStorage();
        return newP;
    }

    async approveProposal(id: string) {
        const p = this.proposals.find(x => x.id === id);
        if (p) {
            p.status = ProposalStatus.APPROVED;
            this.saveProposalsToStorage();
        }
    }

    async rejectProposal(id: string, reason: string) {
        const p = this.proposals.find(x => x.id === id);
        if (p) {
            p.status = ProposalStatus.REJECTED;
            this.saveProposalsToStorage();
        }
    }

    // Contracts
    async getContracts(page: number, size: number, filters: any) {
        const start = (page - 1) * size;
        const currentUser = await this.getCurrentUser();
        let scopedContracts = this.withRLS(this.contracts);

        // Apply Role-Based Access Control (RBAC)
        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            const scopedLeads = this.withRLS(this.leads).filter(l => l.assignedTo === currentUser.id);
            const accessibleLeadIds = new Set(scopedLeads.map(l => l.id));
            scopedContracts = scopedContracts.filter(c => accessibleLeadIds.has(c.leadId));
        }

        let filtered = scopedContracts;
        
        if (filters.search) {
            const { smartMatch } = await import('../utils/textUtils');
            filtered = filtered.filter(c => 
                smartMatch((c.partyAName || '') + (c.partyBName || '') + (c.propertyAddress || ''), filters.search)
            );
        }
        if (filters.type && filters.type !== 'ALL') {
            filtered = filtered.filter(c => c.type === filters.type);
        }
        if (filters.status && filters.status !== 'ALL') {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        filtered.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            data: filtered.slice(start, start + size),
            total: filtered.length,
            page,
            pageSize: size,
            totalPages: Math.ceil(filtered.length / size)
        };
    }

    async getContractById(id: string) {
        return this.contracts.find(c => c.id === id) || null;
    }

    async createContract(data: Partial<Contract>) {
        const newContract = {
            ...data,
            id: `contract_${Date.now()}` as any,
            tenantId: this.currentTenantId as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: data.status || ContractStatus.DRAFT
        } as Contract;
        this.contracts.unshift(newContract);
        
        if (newContract.status === ContractStatus.SIGNED && newContract.leadId) {
            const leadIndex = this.leads.findIndex(l => l.id === newContract.leadId);
            if (leadIndex !== -1) {
                this.leads[leadIndex] = { ...this.leads[leadIndex], stage: LeadStage.WON, updatedAt: new Date().toISOString() };
                this.saveLeadsToStorage();
            }
        }
        
        this.saveContractsToStorage();
        return newContract;
    }

    async updateContract(id: string, data: Partial<Contract>) {
        const index = this.contracts.findIndex(c => c.id === id);
        if (index !== -1) {
            const contract = this.contracts[index];
            this.contracts[index] = { ...contract, ...data, updatedAt: new Date().toISOString() };
            
            // If contract is signed, update lead stage to WON
            if (data.status === ContractStatus.SIGNED && contract.leadId) {
                const leadIndex = this.leads.findIndex(l => l.id === contract.leadId);
                if (leadIndex !== -1) {
                    this.leads[leadIndex] = { ...this.leads[leadIndex], stage: LeadStage.WON, updatedAt: new Date().toISOString() };
                    this.saveLeadsToStorage();
                }
            }
            
            this.saveContractsToStorage();
        }
        return this.contracts[index];
    }

    async deleteContract(id: string) {
        this.contracts = this.contracts.filter(c => c.id !== id);
        this.saveContractsToStorage();
    }

    // Config & Integrations
    async getEnterpriseConfig(): Promise<EnterpriseConfig> {
        await this.requireAdmin();
        return JSON.parse(JSON.stringify(this.enterpriseConfig));
    }

    async saveEmailConfig(data: any) { 
        await this.requireAdmin();
        this.enterpriseConfig.email = { ...this.enterpriseConfig.email, ...data }; 
        this.saveEnterpriseConfigToStorage();
    }
    async saveSSOConfig(data: any) { 
        await this.requireAdmin();
        this.enterpriseConfig.sso = { ...this.enterpriseConfig.sso, ...data }; 
        this.saveEnterpriseConfigToStorage();
    }
    async saveComplianceConfig(data: any) { await this.requireAdmin(); }
    async getComplianceConfig() { await this.requireAdmin(); return this.getEnterpriseConfig(); }
    async getActiveSessions() { await this.requireAdmin(); return [] as any[]; }
    async revokeSession(id: string) { await this.requireAdmin(); }
    async getAuditLogs() { await this.requireAdmin(); return this.auditLogs; }
    async connectZaloOA() {
        await this.requireAdmin();
        this.enterpriseConfig.zalo = {
            enabled: true,
            oaId: `OA-${Math.floor(Math.random() * 1000000)}`,
            oaName: 'SGS Zalo OA',
            connectedAt: new Date().toISOString(),
            webhookUrl: `https://api.sgs.vn/webhook/zalo/${this.currentTenantId}`
        };
        this.saveEnterpriseConfigToStorage();
    }
    async disconnectZaloOA() {
        await this.requireAdmin();
        this.enterpriseConfig.zalo = { enabled: false, oaId: '', oaName: '' };
        this.saveEnterpriseConfigToStorage();
    }
    async connectFacebookPage(pageUrl: string) {
        await this.requireAdmin();
        if (!pageUrl || !pageUrl.includes('facebook.com')) {
            throw new Error("Invalid Facebook Page URL. Must contain 'facebook.com'");
        }
        
        // Extract page name from URL
        let pageName = pageUrl.split('facebook.com/')[1]?.split('/')[0] || 'Unknown Page';
        pageName = pageName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        if (!this.enterpriseConfig.facebookPages) this.enterpriseConfig.facebookPages = [];
        
        if (this.enterpriseConfig.facebookPages.some(p => p.name === pageName)) {
            throw new Error("This page is already connected");
        }

        this.enterpriseConfig.facebookPages.push({
            id: `FB-${Math.floor(Math.random() * 1000000)}`,
            name: pageName,
            connectedAt: new Date().toISOString(),
            accessToken: `mock_token_${Date.now()}`
        });
        this.saveEnterpriseConfigToStorage();
    }
    async disconnectFacebookPage(id: string) {
        await this.requireAdmin();
        if (this.enterpriseConfig.facebookPages) {
            this.enterpriseConfig.facebookPages = this.enterpriseConfig.facebookPages.filter(p => p.id !== id);
            this.saveEnterpriseConfigToStorage();
        }
    }
    async addDomain(domain: string) {
        await this.requireAdmin();
        if (!this.enterpriseConfig.domains) this.enterpriseConfig.domains = [];
        if (this.enterpriseConfig.domains.some(d => d.domain === domain)) throw new Error("Domain already exists");
        this.enterpriseConfig.domains.push({
            domain,
            verified: false,
            verificationTxtRecord: `sgs-verify=${Math.random().toString(36).substring(7)}`
        });
        this.saveEnterpriseConfigToStorage();
    }
    async verifyDomain(domain: string) {
        await this.requireAdmin();
        await new Promise(r => setTimeout(r, 1000)); // simulate network delay
        const d = this.enterpriseConfig.domains?.find(x => x.domain === domain);
        if (d) {
            d.verified = true;
            this.saveEnterpriseConfigToStorage();
        }
    }
    async removeDomain(domain: string) {
        await this.requireAdmin();
        if (this.enterpriseConfig.domains) {
            this.enterpriseConfig.domains = this.enterpriseConfig.domains.filter(d => d.domain !== domain);
            this.saveEnterpriseConfigToStorage();
        }
    }

    // AI
    async getAiConfig(): Promise<AiTenantConfig> { return { allowedModels: [], defaultModel: 'gemini-3-flash-preview', budgetCapUsd: 100, currentSpendUsd: 10 }; }
    async saveAiConfig(data: any) {}
    async getPromptTemplates() { return [] as PromptTemplate[]; }
    async createPromptTemplate(data: any) {}
    async getAiSafetyLogs() { return [] as AiSafetyLog[]; }

    // Billing
    async getSubscription(): Promise<Subscription> { return { planId: PlanTier.TEAM, status: 'active', currentPeriodEnd: new Date().toISOString() }; }
    async getUsageMetrics(): Promise<UsageMetrics> { return { seatsUsed: 5, emailsSent: 1200, aiRequests: 450, periodStart: '', periodEnd: '' }; }
    async getInvoices(): Promise<Invoice[]> { return []; }
    async upgradeSubscription(planId: string) {}

    // Inbox
    async getInboxThreads(): Promise<InboxThread[]> {
        const scopedLeads = this.withRLS(this.leads);
        
        // Group interactions by leadId
        const threadsMap = new Map<string, Interaction[]>();
        for (const interaction of this.interactions) {
            if (!threadsMap.has(interaction.leadId)) {
                threadsMap.set(interaction.leadId, []);
            }
            threadsMap.get(interaction.leadId)!.push(interaction);
        }

        const threads: InboxThread[] = [];
        for (const lead of scopedLeads) {
            const leadInteractions = threadsMap.get(lead.id);
            if (leadInteractions && leadInteractions.length > 0) {
                // Sort by timestamp descending to get the last message
                leadInteractions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const lastMessage = leadInteractions[0];
                
                // Calculate unread count (inbound messages that are not READ)
                const unreadCount = leadInteractions.filter(i => i.direction === Direction.INBOUND && i.status !== 'READ').length;
                
                threads.push({
                    lead,
                    unreadCount,
                    status: ThreadStatus.AI_ACTIVE,
                    lastMessage
                });
            }
        }
        
        // Sort threads by lastMessage timestamp descending
        threads.sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime());
        
        return threads;
    }
    async getInteractions(leadId: string) {
        const lead = await this.getLeadById(leadId);
        if (!lead) return [];
        return this.interactions.filter(i => i.leadId === leadId);
    }
    async markThreadAsRead(leadId: string) {
        this.interactions.forEach(i => {
            if (i.leadId === leadId && i.direction === Direction.INBOUND && i.status !== 'READ') {
                i.status = 'READ';
            }
        });
        this.saveInteractionsToStorage();
    }
    async receiveWebhookMessage(message: any) {
        let lead = this.leads.find(l => l.id === message.leadId);
        if (!lead) {
            lead = {
                id: message.leadId,
                tenantId: this.currentTenantId as any,
                name: `Khách hàng từ ${message.channel}`,
                source: message.channel,
                stage: LeadStage.NEW,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                optOutChannels: [],
                score: { score: 50, grade: 'C', reasoning: 'Khách hàng mới' }
            } as Lead;
            this.leads.unshift(lead);
            this.saveLeadsToStorage();
        }

        // Add interaction if not exists
        if (!this.interactions.find(i => i.id === message.id)) {
            this.interactions.push(message);
            this.saveInteractionsToStorage();
        }
        
        // Update lead updatedAt
        lead.updatedAt = new Date().toISOString();
        this.saveLeadsToStorage();
        
        return message;
    }

    async sendInteraction(leadId: string, content: string, channel: any, options?: { type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'VIDEO', metadata?: any }) {
        const leadExists = this.leads.some(l => l.id === leadId);
        if (!leadExists) throw new Error(`Lead not found: ${leadId}`);
        const lead = await this.getLeadById(leadId);
        if (!lead) throw new Error(`Access denied: You do not have permission to interact with this lead`);

        const msg: Interaction = {
            id: `msg_${Date.now()}` as any,
            leadId: leadId as any,
            channel,
            direction: Direction.OUTBOUND,
            type: options?.type || 'TEXT',
            content,
            timestamp: new Date().toISOString(),
            status: 'SENT',
            metadata: options?.metadata
        };
        this.interactions.push(msg);
        this.saveInteractionsToStorage();
        return msg;
    }
    async deleteConversation(id: string) { 
        this.interactions = this.interactions.filter(i => i.leadId !== id); 
        this.saveInteractionsToStorage();
    }

    // Automation
    async getSequences() { return this.sequences; }
    async getTemplates() { return [] as Template[]; }
    async deleteSequence(id: string) { this.sequences = this.sequences.filter(s => s.id !== id); }
    async deleteTemplate(id: string) {}
    async createSequence(data: Partial<Sequence>) {
        const newSeq = { ...data, id: `seq_${Date.now()}` as any, isActive: true, stats: { enrolled: 0, active: 0, completed: 0, openRate: 0, replyRate: 0, clickRate: 0 } } as Sequence;
        this.sequences.unshift(newSeq);
        return newSeq;
    }
    async updateSequence(id: string, data: Partial<Sequence>) {
        const idx = this.sequences.findIndex(s => s.id === id);
        if (idx !== -1) this.sequences[idx] = { ...this.sequences[idx], ...data };
        return this.sequences[idx];
    }

    // Knowledge & Rules
    async getDocuments() { return [...this.documents]; }
    async createDocument(data: KnowledgeDocument) { 
        this.documents.unshift(data); 
        return data;
    }
    async deleteDocument(id: string) {
        this.documents = this.documents.filter(d => d.id !== id);
    }
    async getScoringConfig() { return this.scoringConfig; }
    async updateScoringConfig(weights: any) { 
        this.scoringConfig = { version: this.scoringConfig.version + 1, weights }; 
        
        // Re-calculate scores for all leads using heuristic to avoid rate limits
        const totalMaxScore = (Object.values(weights).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number) || 1;
        this.leads = this.leads.map(lead => {
            let score = 0;
            const hasPhone = !!lead.phone ? 1 : 0;
            const hasEmail = !!lead.email ? 1 : 0;
            const completeness = (hasPhone + hasEmail) / 2;
            
            score += (weights.completeness || 0) * completeness;
            score += (weights.engagement || 0) * 0.5;
            score += (weights.budgetFit || 0) * (lead.preferences?.budgetMax ? 1 : 0.5);
            score += (weights.velocity || 0) * 0.5;
            
            const calculatedScore = Math.min(100, Math.round((score / totalMaxScore) * 100));
            let grade = 'D';
            if (calculatedScore >= 80) grade = 'A';
            else if (calculatedScore >= 60) grade = 'B';
            else if (calculatedScore >= 40) grade = 'C';
            
            return {
                ...lead,
                score: {
                    score: calculatedScore,
                    grade: grade as any,
                    reasoning: 'Hệ thống tự động cập nhật lại điểm số dựa trên cấu hình mới.'
                }
            };
        });

        return this.scoringConfig;
    }
    async getRoutingRules() { return this.routingRules; }
    async createRoutingRule(data: any) { 
        const newRule = { ...data, id: `rule_${Date.now()}` };
        this.routingRules.push(newRule);
        return newRule;
    }
    async updateRoutingRule(id: string, data: any) {
        const idx = this.routingRules.findIndex(r => r.id === id);
        if (idx !== -1) this.routingRules[idx] = { ...this.routingRules[idx], ...data };
        return this.routingRules[idx];
    }
    async deleteRoutingRule(id: string) {
        this.routingRules = this.routingRules.filter(r => r.id !== id);
    }
    async getTeams() { return this.teams; }

    // Marketplace
    async getMarketplaceApps() { return [] as AppManifest[]; }
    async getInstalledApps() { return [] as InstalledApp[]; }
    async installApp(id: string) {}
    async uninstallApp(id: string) {}
    async getConnectorConfigs() { return this.connectorConfigs; }
    async createConnectorConfig(data: any) { this.connectorConfigs.push({ ...data, id: `conn_${Date.now()}`, status: 'ACTIVE' }); }
    async saveConnectorConfig(data: any) {}
    async deleteConnectorConfig(id: string) { this.connectorConfigs = this.connectorConfigs.filter(c => c.id !== id); }
    async getSyncJobs() { return this.syncJobs; }
    async createSyncJob(connectorId: string) {
        const job = { id: `job_${Date.now()}` as any, connectorId: connectorId as any, startedAt: new Date().toISOString(), status: SyncStatus.QUEUED, recordsProcessed: 0, errors: [], retryCount: 0 };
        this.syncJobs.unshift(job);
        return job;
    }
    async updateSyncJob(id: string, data: any) {
        const job = this.syncJobs.find(j => j.id === id);
        if (job) Object.assign(job, data);
        return job!;
    }
    async exportData(params: any): Promise<DataExportResponse<any>> {
        return { data: this.leads.slice(0, 10), newWatermark: 'new_wm' };
    }
    async generateBiMarts() {
        const currentUser = await this.getCurrentUser();
        let scopedLeads = this.withRLS(this.leads);
        let scopedProposals = this.withRLS(this.proposals);

        // Apply Role-Based Access Control (RBAC)
        if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
            scopedLeads = scopedLeads.filter(l => l.assignedTo === currentUser.id);
            const accessibleLeadIds = new Set(scopedLeads.map(l => l.id));
            scopedProposals = scopedProposals.filter(p => accessibleLeadIds.has(p.leadId));
        }

        return AnalyticsService.generateBiMarts(scopedLeads, scopedProposals, this.campaignCosts);
    }
    async updateCampaignCost(id: string, cost: number) {
        const currentUser = await this.getCurrentUser();
        if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD)) {
            throw new Error('Unauthorized');
        }
        
        const campaignCost = this.campaignCosts.find(c => c.id === id);
        if (campaignCost) {
            campaignCost.cost = cost;
            campaignCost.updatedBy = currentUser.name;
            campaignCost.updatedAt = new Date().toISOString();
        }
        return campaignCost;
    }

    // --- ARTICLES (NEWS) ---
    async getArticles(page: number = 1, pageSize: number = 10) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = this.articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return {
            data: items.slice(start, end),
            total: items.length,
            page,
            pageSize,
            totalPages: Math.ceil(items.length / pageSize)
        };
    }

    async getArticleById(id: string) {
        return this.articles.find(a => a.id === id);
    }

    async createArticle(data: Partial<Article>) {
        const newArticle: Article = {
            id: `art_${Date.now()}`,
            title: data.title || '',
            excerpt: data.excerpt || '',
            content: data.content || '',
            category: data.category || 'Tin Tức',
            author: data.author || 'Admin',
            date: new Date().toISOString().split('T')[0],
            readTime: data.readTime || '5 phút',
            image: data.image || 'https://placehold.co/800x600?text=No+Image',
            images: data.images || [],
            videos: data.videos || [],
            featured: data.featured || false,
            tags: data.tags || []
        };
        this.articles.push(newArticle);
        this.saveArticlesToStorage();
        return newArticle;
    }

    async updateArticle(id: string, data: Partial<Article>) {
        const index = this.articles.findIndex(a => a.id === id);
        if (index === -1) throw new Error('Article not found');
        this.articles[index] = { ...this.articles[index], ...data };
        this.saveArticlesToStorage();
        return this.articles[index];
    }

    async deleteArticle(id: string) {
        const index = this.articles.findIndex(a => a.id === id);
        if (index === -1) throw new Error('Article not found');
        this.articles.splice(index, 1);
        this.saveArticlesToStorage();
    }

    private saveArticlesToStorage() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('sgs_mock_articles', JSON.stringify(this.articles));
            } catch (e) {
                console.error('Failed to save articles to storage', e);
            }
        }
    }

    private loadArticlesFromStorage() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sgs_mock_articles');
                if (saved) {
                    this.articles = JSON.parse(saved);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load articles from storage', e);
            }
        }
        return false;
    }

    async updateOnboardingProgress(stepId: string, completed: boolean) {
        if (!this.enterpriseConfig.onboarding) return;
        
        const steps = new Set(this.enterpriseConfig.onboarding.completedSteps);
        if (completed) {
            steps.add(stepId);
        } else {
            steps.delete(stepId);
        }
        
        this.enterpriseConfig.onboarding.completedSteps = Array.from(steps);
        // Assuming 5 steps total for percentage calculation
        this.enterpriseConfig.onboarding.percentage = Math.round((steps.size / 5) * 100);
        this.saveEnterpriseConfigToStorage();
    }
    
    async dismissOnboarding() {
        if (!this.enterpriseConfig.onboarding) return;
        this.enterpriseConfig.onboarding.isDismissed = true;
        this.saveEnterpriseConfigToStorage();
    }
    async globalSearch(query: string) {
        const { smartMatch } = await import('../utils/textUtils');
        return {
            leads: this.leads.filter(l => smartMatch(l.name + l.phone + l.email, query)),
            listings: this.listings.filter(l => smartMatch(l.title + l.code + l.location, query)),
            users: this.users.filter(u => smartMatch(u.name + u.email, query))
        };
    }
}

export const db = new MockDatabase();