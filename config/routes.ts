
export const ROUTES = {
    LOGIN: 'login',
    PUBLIC_PREFIX: 'p',
    DEFAULT_PRIVATE: 'dashboard',
    
    // Public Pages
    LANDING: 'home', 
    SEARCH: 'marketplace',  // Matched with footer and other navigation
    AI_VALUATION: 'ai-valuation',   
    CRM_SOLUTION: 'crm-platform',   
    ABOUT: 'about-us',
    NEWS: 'news',
    CONTACT: 'contact',
    CAREERS: 'careers',
    HELP_CENTER: 'help-center',
    API_DOCS: 'developers',
    STATUS_PUBLIC: 'status',
    LIVE_CHAT: 'livechat',
    
    // Legal Pages
    PRIVACY: 'privacy-policy',
    TERMS: 'terms-of-service',
    COOKIES: 'cookie-settings',

    // Private Pages
    DASHBOARD: 'dashboard',
    LEADS: 'leads',
    CONTRACTS: 'contracts',
    INVENTORY: 'inventory',
    LISTING: 'listing', 
    FAVORITES: 'favorites',
    APPROVALS: 'approvals',
    SYSTEM: 'system',
    ADMIN_USERS: 'admin-users',
    ROUTING_RULES: 'routing-rules',
    ENTERPRISE_SETTINGS: 'enterprise-settings',
    BILLING: 'billing',
    INBOX: 'inbox',
    SEQUENCES: 'sequences',
    KNOWLEDGE: 'knowledge',
    SCORING_RULES: 'scoring-rules',
    REPORTS: 'reports',
    MARKETPLACE: 'marketplace-apps', // Internal App Store
    DATA_PLATFORM: 'data-platform',
    SECURITY: 'security',
    AI_GOVERNANCE: 'ai-governance',
    SEO_MANAGER: 'seo-manager',
    PROFILE: 'profile',
    MOBILE_APP: 'mobile-app',
    RESET_PASSWORD: 'reset-password',

    // Task Management Module
    TASK_DASHBOARD: 'task-dashboard',
    TASK_KANBAN: 'task-kanban',
    TASKS: 'tasks',
    EMPLOYEES: 'employees',
    TASK_REPORTS: 'task-reports',
} as const;

export const FULL_HEIGHT_PAGES = new Set([
    ROUTES.INBOX,
    ROUTES.LEADS,
    ROUTES.ADMIN_USERS,
    ROUTES.INVENTORY,
    ROUTES.CONTRACTS,
    ROUTES.FAVORITES,
    ROUTES.SYSTEM,
]);

export type RouteKey = typeof ROUTES[keyof typeof ROUTES];
