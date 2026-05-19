// ─── SGS LAND — Next.js App Router Routes ────────────────
// Clean URL routing (replaces legacy hash-based ROUTES from Vite CSR)

export const ROUTES = {
  // Public
  HOME:         "/",
  MARKETPLACE:  "/marketplace",
  AI_VALUATION: "/ai-valuation",
  CRM_LANDING:  "/crm-platform",
  ABOUT:        "/about-us",
  NEWS:         "/news",
  CONTACT:      "/contact",
  CAREERS:      "/careers",
  HELP_CENTER:  "/help-center",
  API_DOCS:     "/developers",
  STATUS:       "/status",
  LIVE_CHAT:    "/livechat",
  CONSIGNMENT:  "/ky-gui-bat-dong-san",
  BANK_RATES:   "/lai-suat-ngan-hang",

  // SEO Local Pages
  BDS_DONG_NAI:   "/bat-dong-san-dong-nai",
  BDS_LONG_THANH: "/bat-dong-san-long-thanh",
  BDS_THU_DUC:    "/bat-dong-san-thu-duc",
  BDS_BINH_DUONG: "/bat-dong-san-binh-duong",
  BDS_QUAN_7:     "/bat-dong-san-quan-7",
  BDS_PHU_NHUAN:  "/bat-dong-san-phu-nhuan",

  // Dynamic public
  DU_AN:          (slug: string) => `/du-an/${slug}`,
  MINI_SITE:      (code: string) => `/p/${code}`,
  BDS_DETAIL:     (slug: string) => `/bds/${slug}`,

  // Legal
  PRIVACY:        "/privacy-policy",
  TERMS:          "/terms-of-service",
  COOKIES:        "/cookie-settings",

  // Auth
  LOGIN:          "/login",
  RESET_PW:       "/reset-password",
  VERIFY_EMAIL:   "/verify-email",

  // Private (requires auth)
  DASHBOARD:      "/dashboard",
  LEADS:          "/leads",
  CONTRACTS:      "/contracts",
  INVENTORY:      "/inventory",
  PROJECTS:       "/projects",
  FAVORITES:      "/favorites",
  INBOX:          "/inbox",
  REPORTS:        "/reports",
  APPROVALS:      "/approvals",
  ROUTING_RULES:  "/routing-rules",
  SEQUENCES:      "/sequences",
  CAMPAIGNS:      "/campaigns",
  KNOWLEDGE:      "/knowledge",
  SCORING_RULES:  "/scoring-rules",
  MARKETPLACE_APPS: "/marketplace-apps",
  DATA_PLATFORM:  "/data-platform",
  SECURITY:       "/security",
  AI_GOVERNANCE:  "/ai-governance",
  SEO_MANAGER:    "/seo-manager",
  ERROR_MONITOR:  "/error-monitor",
  PROFILE:        "/profile",
  ADMIN_USERS:    "/admin-users",
  ENTERPRISE:     "/enterprise-settings",
  ADMIN_AI_COST:  "/admin-ai-cost",
  BILLING:        "/billing",
  VENDOR:         "/vendor-management",
  TASK_DASHBOARD: "/task-dashboard",
  TASK_KANBAN:    "/task-kanban",
  TASKS:          "/tasks",
  EMPLOYEES:      "/employees",
  TASK_REPORTS:   "/task-reports",
} as const;

// Private route prefixes (for middleware)
export const PRIVATE_PREFIXES = [
  "/dashboard", "/leads", "/contracts", "/inventory", "/projects",
  "/favorites", "/inbox", "/reports", "/approvals", "/routing-rules",
  "/sequences", "/campaigns", "/knowledge", "/scoring-rules",
  "/marketplace-apps", "/data-platform", "/security", "/ai-governance",
  "/seo-manager", "/error-monitor", "/profile", "/admin-users",
  "/enterprise-settings", "/admin-ai-cost", "/billing", "/checkout",
  "/vendor-management", "/task-dashboard", "/task-kanban", "/tasks",
  "/employees", "/task-reports", "/scraper",
] as const;
