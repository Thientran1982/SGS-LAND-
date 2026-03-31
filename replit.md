# SGS Land

AI-powered real estate CRM and management platform for the Vietnamese market.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Tailwind CSS (PostCSS/npm build, NOT CDN), Framer Motion, TanStack Query, Recharts
- **Backend**: Node.js + Express (unified server with Vite middleware in dev)
- **Build Tool**: Vite 6
- **Real-time**: Socket.io, Yjs + y-websocket (CRDT collaboration)
- **Database**: PostgreSQL with Row Level Security (multi-tenancy), 25 tables
- **Queue**: QStash (Upstash) with in-memory fallback when `QSTASH_TOKEN` not configured
- **AI**: Google Gemini via `@google/genai`
- **Auth**: JWT with httpOnly cookies, bcrypt password hashing, password reset tokens, **email verification on register**
- **Email**: Brevo API (primary) + Nodemailer SMTP fallback + console fallback; verification email, password reset, welcome, invite, sequences

## Architecture

Single unified server (`server.ts`) runs both the Express API and the Vite dev server in middleware mode.

- Port: **5000** (both in dev and production)
- Host: `0.0.0.0`

### Data Access Layers

1. **Real PostgreSQL** (production path): `services/dbApi.ts` → `services/api/*.ts` → HTTP API → `server/routes/*.ts` → `server/repositories/*.ts` → PostgreSQL
2. **Legacy mockDb** (deleted — removed along with 6 other unused service files: analyticsService, vectorStore, facebookService, zaloService, dlpService, webhookService)

### Repository Pattern (`server/repositories/`)
- `baseRepository.ts` — `withTenantContext()` for RLS, pagination, error handling
- `leadRepository.ts` — CRUD leads with search, duplicate check, stage transitions
- `listingRepository.ts` — CRUD listings, favorites; overrides `findById` with user JOIN for assignedTo data; `assign()` for role-based assignment
- `proposalRepository.ts` — CRUD proposals, smart approval logic
- `contractRepository.ts` — CRUD contracts
- `interactionRepository.ts` — CRUD interactions, inbox thread aggregation
- `userRepository.ts` — CRUD users, bcrypt auth, teams, invite flow
- `analyticsRepository.ts` — SQL aggregations for dashboard KPIs, BI marts, campaign costs
- `visitorRepository.ts` — Anonymous visitor log CRUD + stats (country, city, daily, top listings)
- `auditRepository.ts` — Audit trail CRUD
- `routingRuleRepository.ts` — Lead routing rules CRUD
- `sequenceRepository.ts` — Automation sequences CRUD
- `documentRepository.ts` — Knowledge base documents CRUD
- `articleRepository.ts` — Knowledge base articles CRUD with search
- `scoringConfigRepository.ts` — Lead scoring config persistence (upsert)
- `enterpriseConfigRepository.ts` — Tenant enterprise settings (SSO, integrations)
- `subscriptionRepository.ts` — Billing subscriptions, usage tracking, invoices
- `sessionRepository.ts` — User session tracking, revocation
- `templateRepository.ts` — Message/email templates CRUD
- `aiGovernanceRepository.ts` — AI safety logs, prompt templates, AI config

### API Routes (`server/routes/`)
- `leadRoutes.ts` — `/api/leads/*`
- `listingRoutes.ts` — `/api/listings/*`
- `proposalRoutes.ts` — `/api/proposals/*`
- `contractRoutes.ts` — `/api/contracts/*`
- `interactionRoutes.ts` — `/api/inbox/*`
- `userRoutes.ts` — `/api/users/*` (list, create, delete, invite, teams, password, email change)
- `analyticsRoutes.ts` — `/api/analytics/*` (summary, audit-logs, bi-marts, campaign-costs)
- `routingRuleRoutes.ts` — `/api/routing-rules/*`
- `sequenceRoutes.ts` — `/api/sequences/*`
- `knowledgeRoutes.ts` — `/api/knowledge/*` (documents, articles)
- `scoringRoutes.ts` — `/api/scoring/*` (config get/update)
- `enterpriseRoutes.ts` — `/api/enterprise/*` (config, audit-logs, test-smtp, send-test-email, zalo/status|connect|disconnect, facebook/status|connect|disconnect/:pageId)
- `uploadRoutes.ts` — `/api/upload` (POST multi-file upload with multer, DELETE by filename; tenant-isolated storage in `uploads/<tenantId>/`)
- `billingRoutes.ts` — `/api/billing/*` (subscription, upgrade, usage, invoices)
- `sessionRoutes.ts` — `/api/sessions/*` (list, revoke)
- `aiGovernanceRoutes.ts` — `/api/ai/governance/*` (safety-logs, prompt-templates, config)
- `taskRoutes.ts` — `/api/tasks/*` (CRUD, status transitions, assign/unassign, comments, activity)
- `departmentRoutes.ts` — `/api/departments/*` (list, user workload stats)
- `taskReportRoutes.ts` — `/api/dashboard/task-stats`, `/api/reports/task-summary`, `/api/reports/task-export/csv`, `/api/reports/task-by-project`

### Frontend API Client (`services/api/`)
- `apiClient.ts` — Base HTTP client with JWT cookie auth, error handling
- `leadApi.ts`, `listingApi.ts`, `proposalApi.ts`, `contractApi.ts`, `inboxApi.ts`, `userApi.ts`, `analyticsApi.ts`, `knowledgeApi.ts`
- `services/dbApi.ts` — Compatibility shim: mirrors the mockDb interface but routes to real API

### Middleware (`server/middleware/`)
- `security.ts` — Security headers, CORS, webhook signature verification, parameter pollution prevention
- `validation.ts` — Input validation middleware with schema definitions, XSS sanitization
- `errorHandler.ts` — Centralized error handler with AppError class hierarchy
- `rateLimiter.ts` — In-memory rate limiting: AI (20/min), auth (15/15min), API (120/min), webhooks (100/min)
- `logger.ts` — Structured JSON logging with request logging middleware
- `auditLog.ts` — Audit trail writes to PostgreSQL audit_logs table

### Services (`server/services/`)
- `emailService.ts` — Nodemailer-based email sending with per-tenant SMTP config from enterprise_config. Falls back to console logging when SMTP not configured. Provides: sendEmail, sendPasswordResetEmail, sendWelcomeEmail, sendSequenceEmail, testSmtpConnection.
- `systemService.ts` — Server-side health check service. Checks DB connectivity and AI key config. Used by `GET /api/health`.
- `geoService.ts` — IP geolocation via ip-api.com (free, no key). 24h in-memory cache per IP. Returns country/region/city/lat/lon/isp. Skips private/local IPs. Helper `getClientIp()` handles X-Forwarded-For proxy headers.

### File Upload System
- **Endpoint**: `POST /api/upload` (multipart/form-data, field name: `files`, max 10 files, 10MB each)
- **Storage**: Tenant-isolated at `uploads/<tenantId>/` with randomized filenames (16 bytes entropy)
- **Allowed types**: JPEG, PNG, WebP, GIF, PDF, DOCX, DOC
- **Serving**: `GET /uploads/<tenantId>/<filename>` — authenticated, tenant-scoped (403 cross-tenant)
- **Delete**: `DELETE /api/upload/:filename` — authenticated, tenant-scoped, path traversal protected
- **Text extraction**: PDF (pdf-parse) and DOCX (mammoth) content extracted on KnowledgeBase document upload
- **Frontend integration**: `db.uploadFiles(files)` / `db.deleteUploadedFile(filename)` in dbApi.ts
- **Client validation**: 10MB file size limit, MIME type filtering on all upload forms
- **Used by**: ListingForm (property images, max 10, drag-to-reorder), KnowledgeBase (document upload with text extraction), Profile (avatar upload)

### Database Tables (32 total)
**Core CRM**: users, leads, listings, proposals, contracts, interactions, tasks, favorites
**Organization**: tenants, teams, team_members
**Automation**: sequences, routing_rules, templates
**Knowledge**: documents, articles
**Analytics**: audit_logs, campaign_costs
**Configuration**: enterprise_config, scoring_configs
**Billing**: subscriptions, usage_tracking
**AI Governance**: ai_safety_logs, prompt_templates
**Security**: user_sessions, password_reset_tokens
**Task Management (migration 020)**: departments, wf_tasks, task_assignments, task_comments, task_activity_logs, task_reminders

## Security

- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- HSTS enabled in production
- CORS: restricted origins in production, open in dev
- Rate limiting on auth (15/15min), AI (20/min), API (120/min), webhooks (100/min)
- Input validation on all POST/PUT routes with schema-based validation
- XSS prevention via input sanitization
- Webhook signature verification for Facebook (HMAC-SHA256) and Zalo
- **Auth guard fixed (App.tsx)**: `getInitialAuthState()` now always returns `'LOADING'` — server session check MUST complete before any private page renders. Prevents flash of private content on expired sessions.
- **Register role fixed (server.ts)**: `/api/auth/register` counts existing users in tenant; first user → `ADMIN`, subsequent users → `AGENT`. Previously all registrations hardcoded to `ADMIN`. `source` changed from `INVITE` to `REGISTER`.
- **ADMIN_ROLES fixed (App.tsx)**: `ADMIN_ROLES` set now correctly contains `['ADMIN', 'TEAM_LEAD']` — previously had `'MANAGER'` (nonexistent role) instead of `'TEAM_LEAD'`, blocking TEAM_LEAD users from admin-only routes.
- **JWT_SECRET persisted**: `JWT_SECRET` stored as a shared environment variable — server restarts no longer invalidate all user sessions.
- Parameter pollution prevention
- API keys (GEMINI_API_KEY) server-side only
- JWT with httpOnly cookies, 24h expiry
- Socket.io/Yjs WebSocket auth via JWT cookie
- PostgreSQL RLS enforces tenant isolation
- RBAC in repositories (Sales/Marketing see own or assigned; Admin/Team Lead see all)
- **Per-listing assignment (`assigned_to` field)**: ADMIN/TEAM_LEAD can assign project units to specific internal users via `PATCH /api/listings/:id/assign`. Assignee dropdown shown in ProjectUnits table. SALES/MARKETING can edit/view units they created or are assigned to.
- `withTenantContext` uses UUID-validated string interpolation
- Audit logging for login, CRUD operations, password changes
- Session tracking with revocation support
- Password reset: tokens hashed (SHA-256) in DB, atomic single-use consume, uniform response timing. Reset link format: `/#/reset-password/<token>` → App.tsx redirects to Login with token → Login.tsx auto-populates FORGOT_VERIFY view
- **sanitizeInput password fix**: `sanitizeObject` now skips HTML encoding for sensitive fields (`password`, `currentPassword`, `newPassword`, `confirmPassword`, `secret`, `token`, etc.) — passwords must be hashed from their raw form, not HTML-encoded versions
- **updatePassword silent-failure fix**: `userRepository.updatePassword` now includes explicit `tenant_id` in WHERE clause (via RLS `current_setting`) and updates `updated_at = NOW()`; route handler and `reset-password` endpoint both now return error if 0 rows updated instead of silently returning 200 success

## Business Logic

- **Lead → LOST**: Auto-rejects all PENDING_APPROVAL and DRAFT proposals
- **Lead Scoring**: Heuristic score + AI scoring (persisted to DB via background queue)
- **Scoring Config**: Customizable weights/thresholds stored in PostgreSQL per tenant
- **Proposal Smart Approval**: All new proposals start as `PENDING_APPROVAL` — explicit approval required via dedicated endpoint (AML check enforced)
- **Revenue**: 2% commission on APPROVED proposals' finalPrice
- **Pipeline Value**: finalPrice x probability (A=85%, B=60%, C=30%, D=10%, F=1%)
- **Win Probability**: Weighted average from actual pipeline data
- **AI Deflection Rate**: AI outbound / total outbound interactions
- **BI Marts**: Funnel analysis, attribution/ROI by source, conversion rates
- **Routing Rules**: Configurable lead distribution based on conditions
- **Sequences**: Automated outreach workflows with steps
- **Usage Tracking**: Seats, AI requests, emails tracked per tenant/period

## Real-time Events (Socket.io)

- `send_message` — Persists interaction to PostgreSQL, then broadcasts to room
- `receive_message` — Webhook worker saves to DB first, then emits
- `lead_updated` / `lead_created` — Broadcasts to other clients
- `view_lead` / `leave_lead` — Presence tracking (in-memory)
- Webhook worker persists Zalo/Facebook messages to DB + triggers AI scoring

## AI Integration

- `POST /api/ai/process-message` — Multi-agent LangGraph workflow with Gemini (inventory search now uses real DB)
- `POST /api/ai/score-lead` — Scores lead, persists score back to DB
- `POST /api/ai/summarize-lead` — Reads interactions from DB if not provided
- `POST /api/ai/valuation` — Real-time valuation with Google Search grounding; body: `{address, area, roadWidth, legal, propertyType?}`; returns `{totalPrice, compsPrice, incomeApproach, reconciliation, ...}`
- `POST /api/ai/generate-content` — Generic Gemini proxy with streaming SSE
- `POST /api/ai/embed-content` — Vector embeddings via text-embedding-004
- `GET/PUT /api/ai/governance/config` — AI configuration management
- `GET /api/ai/governance/safety-logs` — AI safety/audit logs
- `GET/POST/PUT/DELETE /api/ai/governance/prompt-templates` — Prompt template management
- All AI endpoints rate-limited (20 req/min per user)

## Entry Points

- `server.ts` - Express + Vite server entry
- `App.tsx` - React frontend entry
- `server/db.ts` - PostgreSQL schema and RLS setup (25 tables)
- `server/seed.ts` - Database seeding script
- `server/queue.ts` - BullMQ webhook queue (persists to DB)
- `server/ai.ts` - AI service (LangGraph state machine, real inventory search)
- `services/dbApi.ts` - Frontend data access (API-backed)

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `REDIS_URL` - Redis connection URL (optional; falls back to in-memory)
- `GEMINI_API_KEY` or `API_KEY` - Google Gemini API key for AI features (server-side only)
- `JWT_SECRET` - JWT signing secret (required for production; auto-generated in dev)
- `FB_VERIFY_TOKEN` - Facebook webhook verification token
- `FB_APP_SECRET` - Facebook app secret for webhook signature verification
- `ZALO_OA_SECRET` - Zalo OA secret for webhook signature verification
- `ALLOWED_ORIGINS` - Comma-separated allowed CORS origins (production)
- `COMMISSION_RATE` - Commission rate for revenue calculation (default: `0.02` = 2%)
- `SEED_PASSWORD` - Password used for all seeded demo users (required for `npm run seed`)
- `LOG_LEVEL` - Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)

## Dev Credentials

- Email: `admin@sgs.vn`, Password: set via `SEED_PASSWORD` env var at seed time (all seeded users use the same password)
- Default tenant ID: `00000000-0000-0000-0000-000000000001` (canonical const `DEFAULT_TENANT_ID` in `server/constants.ts`; also a module-level const in `services/dbApi.ts`)
- 8 users, 20 leads, 15 listings, 7 proposals, 1 contract, 35 interactions seeded

## Important Notes

- **Filter sentinel values**: Frontend uses `'ALL'` as the default for stage/source/type filters. ALL `dbApi.get*()` methods MUST check `!== 'ALL'` before adding to params — otherwise SQL gets `WHERE type = 'ALL'` → 0 results. Fixed for `getLeads`, `getContracts`, `getListings`.
- **getFavorites returns structured object**: `db.getFavorites(page?, pageSize?)` returns `{data: Listing[], total, totalPages, page, pageSize}` (NOT a bare array). Always access `favs.data`, never treat return as array. Items in `data` do NOT have `isFavorite` set from DB — callers must set `isFavorite: true` manually (e.g., Favorites page does `map(item => ({...item, isFavorite: true}))`).
- **findListings returns stats**: `listingRepository.findListings()` now returns `stats: { availableCount, holdCount, soldCount, rentedCount, bookingCount, openingCount }` alongside `data/total/page/totalPages`. Stats are **global** (unfiltered, full tenant inventory counts).
- **dbApi.ts must forward all fields**: `dbApi.getListings()` explicitly reconstructs the return object — if a new field (e.g. `stats`, `totalPages`) is added to the backend response, it MUST also be added to the `return { ... }` in `dbApi.ts`. The frontend Inventory page reads `res.stats` — if `dbApi.ts` omits `stats` in its return, the UI always shows 0.
- **pg PoolClient sequential queries only**: `withTenantContext` gives a single `PoolClient`. NEVER use `Promise.all([client.query(), client.query()])` — PostgreSQL wire protocol is sequential; concurrent `.query()` calls on the same client fire a DeprecationWarning and cause the 2nd/3rd queries to silently fail. Always `await` each `client.query()` one at a time.
- **noProjectCode filter must exempt PROJECT type**: `listingRepository` `noProjectCode` filter uses `(project_code IS NULL OR project_code = '' OR type = 'Project')`. The `OR type = 'Project'` is critical — PROJECT master listings carry their own project_code, so without this clause the filter would exclude all PROJECT listings from map/inventory views. Both the public endpoint (`server.ts`) and the Inventory page pass `noProjectCode: true` to hide individual unit listings that belong to a project; the exemption ensures project masters are always visible.
- **Public API for unauthenticated users**: Routes registered in `server.ts` BEFORE authenticated routes, using `PUBLIC_TENANT = '00000000-0000-0000-0000-000000000001'`: `GET /api/public/listings` (status_in AVAILABLE/OPENING/BOOKING), `GET /api/public/listings/:id`, `POST /api/public/leads` (requires name+phone, no auth). `dbApi.ts` exposes `getPublicListings()`, `getSimilarListings()`, `createPublicLead()`. `getListingById()` falls back to public on 401. `Landing.tsx` and `ProductSearch.tsx` use `getPublicListings()`. `ListingDetail.tsx handleBooking` uses `createPublicLead()` when `currentUser` is null, `handleContact` also captures lead silently.
- **Seed script is not re-entrant**: `server/seed.ts` checks `SELECT COUNT(*) FROM users` — if users exist it skips entirely. If proposals/listings/leads are manually deleted, re-seeding is blocked. To restore: manually INSERT records using `executeSql`. Current DB state: 1 user (admin@sgs.vn), 16 listings (all with HCMC coordinates), 0 leads, 0 proposals.
- **listings.coordinates column**: `JSONB` column storing `{"lat": number, "lng": number}`. All 16 seeded listings have realistic coordinates (HCMC districts). Seed script now includes `lat`/`lng` in `listingData` and inserts via `$13` param. MapView.tsx uses `listing.coordinates` to place Leaflet markers.
- **score column in leads is jsonb**: `leads.score` stores `{"score": 58, "grade": "B", "reasoning": "..."}`. To extract numeric score use `(score->>'score')::numeric`. Never use `COALESCE(score, 0)` — type mismatch error.
- **Lead column ambiguity**: When JOINing `leads l` with `users u`, ALL WHERE conditions MUST use `l.` prefix (both tables have `name`, `source` columns).
- **Lead creation stage**: POST `/api/leads` must destructure and pass `stage` from `req.body` to `leadRepository.create()`.

## SEO & Internationalization

### Translation Keys (`config/locales.ts`)
- **Structure**: Two-language dictionary (`vn` and `en`) with dot-notation keys (`landing.hero_title`, `routing.title`, etc.)
- **Added keys**: `landing.hero_title`, `admin.users.no_permission`, `admin.users.confirm_role_change`, `table.*` (time, task, model, latency, cost, flags, records, ip_address, device), `inbox.*` (new_message, assign_success, empty_messages), `leads.export_success`, `leads.new_lead_received`, `reports.cost_*`, `routing.*` (full routing rules page translations), `scoring.*` (full scoring config page translations), `detail.ai_no_data`, `editor.*` (AI text editor tools), `seq.step_*` (step builder i18n), `ai.error_*` (AI error toasts), `inbox.error_score_update`, `inbox.error_inbound`, `approvals.filter_all/high/medium/low`, `approvals.tooltip_self`, `reports.funnel_rate_note`, `reports.period_label`, `reports.range_7/30/90/365/all`, `reports.won`, `reports.lost`
- **Pattern to check missing keys**: `node -e "const fs=require('fs'); const content=fs.readFileSync('config/locales.ts','utf8'); const keys=new Set([...content.matchAll(/\"([^\"]+)\":\s*\"/g)].map(m=>m[1])); ..."`

### SEO Configuration (`index.html`)
- **Title**: `SGS LAND | Hệ Điều Hành Bất Động Sản Thế Hệ Mới`
- **Meta description**: Vietnamese-optimized, 155-char limit compliant
- **Keywords**: Real estate focused VN keywords
- **Favicon**: Inline SVG of the stack logo (indigo brand color `#4F46E5`)
- **Open Graph**: `og:title`, `og:description`, `og:image` (1200×630 branded SVG), `og:url` (dynamic), `og:locale` (vi_VN), `og:site_name`, `og:type`
- **Twitter Card**: `summary_large_image` with all required fields
- **Structured Data (JSON-LD)**: `Organization` schema + `SoftwareApplication` schema for rich results
- **Dynamic updates**: `Landing.tsx` updates all meta tags on language change via `useEffect`

### Logo SEO (`components/Logo.tsx`)
- SVG has `role="img"`, `aria-label`, and `<title>` element for screen readers and crawlers
- `nav.logo_label` translation key provides the accessible name

## Design System (Audited & Standardized March 2026)

### CSS Design Tokens (`index.html <style>` block)
Single source of truth for all color variables. Both `:root` (light) and `.dark` (dark) fully specified.
- **Backgrounds**: `--bg-app`, `--bg-surface`, `--bg-elevated`, `--glass-surface`, `--glass-surface-hover`, `--glass-border`
- **Text**: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`
- **Brand**: `--primary-600` (indigo-600 light / indigo-500 dark)
- **Semantic**: `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--rose-500`
- All variables override correctly in `.dark` including `--rose-500` (#F43F5E light → #FB7185 dark)

### Tailwind Config Extensions (`tailwind.config.js`)
Named semantic tokens for all CSS variables (use via `text-text-secondary`, `bg-surface`, etc.) and micro font sizes:
- `text-3xs` (8px), `text-2xs` (9px), `text-xs2` (10px), `text-xs3` (11px)

### Color Usage Rules
- **Primary CTA buttons**: `bg-indigo-600 hover:bg-indigo-700` (NEVER indigo-500 or lower)
- **Text**: Use `text-[var(--text-primary/secondary/tertiary/muted)]` in theme-aware pages. Hardcoded `text-slate-*` only inside always-dark pages (Login, AiValuation) or with explicit `dark:` prefix
- **Surfaces**: `bg-[var(--bg-surface)]` for cards/panels. `bg-slate-900/800` only for intentional always-dark overlays
- **Always-dark pages**: Login.tsx, AiValuation.tsx (use hardcoded dark colors intentionally)

### Font System
- Primary: `Inter` (300/400/500/600/700) from Google Fonts
- Mono: `JetBrains Mono` (400/500)
- Print: `Noto Serif`
- Dark mode: `class` strategy on `<html>`, persisted in `localStorage` key `sgs_theme`
- Custom theme: `services/theme.tsx` exports `CustomThemeConfig`, `applyCustomTheme()`, `clearCustomTheme()`, `useThemeConfig()` (React Query startup hook + Socket.io live listener via `useSocket()`); theme stored in `enterprise_config.theme_config JSONB` column (migration 017 added column; sentinel row `config_key='__theme__'` used for upsert); cached in `localStorage` key `sgs_custom_theme` for FOUC prevention; `public/theme-init.js` applies cached theme before React mounts; background colors scoped to `.light` via injected `<style id="sgs-custom-theme-bg">`
- Theme customizer UI: `components/ThemeCustomizer.tsx` — primary color (8 presets + hex + color picker), bg-app/bg-sidebar/bg-surface (light mode only), font family (5 options), font scale (3 options), live mini-preview; admin-only save/reset; all users receive live theme updates via `theme_updated` socket event (tenant room) + `useThemeConfig()` listener
- DB: `enterprise_config` table has `theme_config JSONB NOT NULL DEFAULT '{}'` column (migration 017); tenant-scoped sentinel row (`config_key='__theme__'`) stores and retrieves the theme config; RLS via enterprise_config policy
- Backend: `GET /api/enterprise/theme` (all authenticated users, merges defaults with hex validation); `PUT/DELETE` (admin only, validates payload, emits `theme_updated` to `tenant:${tenantId}` socket room)
- Socket: authenticated sockets auto-join `tenant:${tenantId}` room on connection; `useThemeConfig()` calls `useSocket()` to ensure socket connectivity; theme broadcast propagates immediately to all active tenant users without reload

### AiGovernance.tsx Audit & Fix (March 2026)
4 bugs resolved in `pages/AiGovernance.tsx`:
1. **Toast not in portal** — `fixed` toast inside root `animate-enter` div; moved to `createPortal(document.body)` with Fragment `<>` wrapper
2. **Root container missing `p-4 sm:p-6`** — added to `div.space-y-6 pb-20 relative animate-enter`
3. **Simulator output 3 hardcoded English strings** — `"Simulated output for: ..."`, `"Error executing simulation."`, and `"OUTPUT:"` label → 4 new locale keys: `ai.sim_result` (with `{input}` + `{version}` interpolation), `ai.sim_error`, `ai.sim_output_label`, added to VI + EN locales
4. **Safety Log table missing empty state** — added `<tr colSpan=6>` with `t('ai.no_safety_logs')` when `safetyLogs` is empty

### Leads.tsx Audit & Fix (March 2026)
All dead `|| fallback` patterns removed, hardcoded strings i18n-ified, toast portal fixed:

**i18n — hardcoded strings replaced:**
1. `overdueCount` badge — `t('leads.overdue_count', { count })`
2. Column settings tooltip — `t('leads.col_settings_title')`
3. Column panel heading "Cột hiển thị" — `t('leads.col_visible_title')`
4. Density section heading "Mật độ hàng" — `t('leads.density_title')`
5. Density buttons "Gọn/Vừa/Rộng" — `t('leads.density_compact/normal/relaxed')`

**Dead `|| fallback` patterns removed (t() never returns falsy):**
- `clear_search`, `reset_filters` (×4 occurrences), `import_excel` (×2), `export_excel` (×2)
- `scope_mine`, `total_leads`, `new_leads`/`new_leads_tooltip` (×2), `win_rate`/`win_rate_tooltip` (×2)
- `avg_score`, `kanban_empty`, `empty_filter_hint`, `empty_title`, `empty_hint` (×2 each — LIST + mobile BOARD)
- KanbanCard dead fallbacks (4 patterns), simulate inbound (3), export success count, import result messages
- `bulk_delete_confirm` dynamic fallback
- Default customer name in import → `t('leads.new_customer')`

**Critical bug — Toast portal:**
- Toast `<div className="fixed ...">` was rendered inside `<div className="h-full flex flex-col relative">` — any parent `transform` (including `animate-enter`) traps `position: fixed` positioning
- Fixed: return wrapped in `<>` Fragment; toast moved to `createPortal(toast ? <div> : null, document.body)` after the main div, before closing Fragment

**Locale keys added (config/locales.ts):**
- `leads.overdue_count`, `leads.col_settings_title`, `leads.col_visible_title`
- `leads.density_title`, `leads.density_compact`, `leads.density_normal`, `leads.density_relaxed`
- `leads.import_result`, `leads.import_result_errors`, `leads.export_success_count`
- `leads.new_lead_received` (updated with `{source}` placeholder)

---

### ProductSearch.tsx + Marketplace.tsx Audit & Fix (March 2026)
Full audit of "Sàn Giao Dịch" public listing page and internal App Store:

**ProductSearch.tsx — 8 issues fixed:**
1. **Dead `||` on `favorites.removed/added`** (line 250) — keys exist → removed fallbacks
2. **Dead `||` on `common.clear_search`** (line 359) — key exists → removed fallback
3. **`common.error_loading` missing** (line 423) — added key to both locales; removed `||` fallback
4. **`common.retry` missing** (line 428) — added key to both locales; removed `||` fallback
5. **Dead `||` on `common.loading`** (line 452) — key exists → removed fallback
6. **Dead `||` on `inventory.label_unit_price`** (line 524) — key exists → removed fallback
7. **Hardcoded "PN"** (mobile list view line 649) — `listing.bedrooms_short` key added (VI: "PN", EN: "BR"); used in template
8. **All market.* keys** confirmed existing in locales (18 keys per locale at lines 1340-1362 VI, 3090-3112 EN)

**Marketplace.tsx — 5 dead `||` fallbacks removed:**
- `common.clear_search` (clear button title)
- `market.no_installed` and `market.no_search_results` (empty state subtexts)
- `market.reset_search` (reset button)
- `market.modal_install_title`, `market.modal_uninstall_title`, `market.btn_install`, `market.btn_uninstall` (confirm modal props)

**Locale keys added (config/locales.ts — VI + EN):**
- `common.error_loading`, `common.retry`, `listing.bedrooms_short`

---

### Contracts.tsx + ContractModal.tsx Audit & Fix (March 2026)
Full audit of contract page, buttons, filters, i18n, logic, and data flow:

**Contracts.tsx — 8 bug groups fixed:**
1. **RowMenu hardcoded strings (5)**: `aria-label="Tùy chọn"` → `t('common.actions')`; menu items → `t('common.edit')`, `t('contracts.view_export_pdf')`, `t('common.share_link')`, `t('contracts.delete_label')` (all had zero i18n)
2. **RowMenu missing `useTranslation`**: Component was not calling the hook — added
3. **`handleDelete` no feedback**: Delete succeeded silently; added `notify(t('contracts.delete_success'), 'success')` + error toast; key existed but was never used
4. **Toast portal**: No toast state or portal at all — added `toast` state, `notify` callback, `createPortal` + Fragment wrapper
5. **Pagination hardcoded (3)**: `'Trang X / Y'` → `t('contracts.pagination', { page, total })`; `'← Trước'` → `t('common.prev')`; `'Sau →'` → `t('common.next')`
6. **Empty state single variant**: No "no results" branch when filter/search active — added `isFiltered` check with `t('common.no_results')` + reset button vs `t('contracts.empty')` for blank slate
7. **Share modal copy button `aria-label`**: `t('common.copied')` (state-dependent text) → `t('common.copy_link')` (static accessible label)
8. **Dead `|| fallback`**: None found in main file (already clean)

**ContractModal.tsx — 5 bug groups fixed:**
1. **Dead tab label fallback**: `t(tab.labelKey) || tab.labelKey.split('.')[1]` → `t(tab.labelKey)`
2. **Signing info section — 7 hardcoded strings**: heading, contract date label+hint, signed place label+hint+placeholder, blank line note → all using new locale keys
3. **VNĐ input helper text hardcoded**: Block with `<strong>` inline VI text → `t('contracts.vnd_input_hint')`
4. **Payment schedule dead fallbacks (2)**: `t('payment.tip_set_price') || '...'` + `t('contracts.tab_terms') || '...'` → removed `||` branches
5. **CurrencyInput missing `useTranslation`**: Hardcoded hint "Nhập số nguyên..." → added hook + `t('contracts.currency_input_hint')`

**Locale keys added (config/locales.ts — VI + EN):**
- `contracts.delete_label`, `contracts.pagination`, `contracts.reset_filters`
- `contracts.signing_info_title`, `contracts.contract_date`, `contracts.contract_date_hint`
- `contracts.signed_place`, `contracts.signed_place_hint`, `contracts.signed_place_placeholder`
- `contracts.blank_line_hint`, `contracts.vnd_input_hint`, `contracts.currency_input_hint`

---

### Inventory.tsx Audit & Fix (March 2026)
All dead `|| fallback` patterns removed, hardcoded strings i18n-ified, toast portal fixed:

**Dead `|| fallback` patterns removed (t() never returns falsy):**
- Action menus (InventoryRow, CompactInventoryRow, InventoryKanbanCard): `common.edit`, `common.duplicate`, `common.delete` fallbacks
- `status.READY` (×2), `transactionOptions` all_transactions fallback
- Toolbar: `clear_search`, `view_map`, `reset_filters` (×3)
- Metrics bar: `inventory.total_listings` + all 7 status labels (AVAILABLE/HOLD/BOOKING/OPENING/RENTED/SOLD/INACTIVE)
- `inventory.label_unit_price`, `common.loading`, `inventory.kanban_empty`
- Empty states: `empty_filter_hint` (×2), `empty_title` (×2), `empty_hint` (×2) — GRID + LIST views

**i18n — hardcoded strings replaced:**
1. PARTNER role empty state (GRID + LIST view): `t('inventory.partner_no_access')` + `t('inventory.partner_no_access_hint')`
2. Delete success: `t('inventory.action_delete')` → `t('inventory.delete_success')`
3. Duplicate success: `t('leads.duplicate_success')` → `t('inventory.duplicate_success')` (all 4 occurrences)

**Critical bug — Toast portal:**
- Same CSS transform trap as Leads.tsx/Billing.tsx — toast `fixed` div inside main container
- Fixed: return wrapped in `<>` Fragment; toast moved to `createPortal(toast ? <div> : null, document.body)` after main div

**Locale keys added (config/locales.ts):**
- `inventory.duplicate_success`, `inventory.delete_success`
- `inventory.partner_no_access`, `inventory.partner_no_access_hint`

---

### Billing.tsx Audit & Fix (March 2026)
8 bugs resolved across backend + frontend + i18n:

**Backend (Critical):**
1. **`current_period_start/end` columns missing from `subscriptions` table** — Migration 003 created `subscriptions` without these columns; Migration 009 used `CREATE TABLE IF NOT EXISTS` (no-op since table existed); result: `INSERT ... (current_period_start, current_period_end)` in `subscriptionRepository.createSubscription()` threw "column does not exist" → 500 on `/api/billing/subscription` and `/api/billing/invoices`; fixed by adding **migration 013** with `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ...`; also backfills `created_at` into the column for existing rows

**Frontend:**
2. **Root container missing `p-4 sm:p-6`** — Line 96 had no outer padding; added `p-4 sm:p-6` to root `div`
3. **Toast not in portal** — `fixed` toast inside `animate-enter` root; same CSS transform trap; moved to `createPortal(document.body)`, added Fragment `<>` wrapper + `role="status" aria-live="polite"`
4. **`notify` not memoized** — plain function re-created each render; wrapped in `useCallback([])`
5. **Invoice section heading partially hardcoded** — `{t('billing.date')} — Lịch sử hóa đơn` used wrong key and hardcoded string; replaced with new `billing.invoice_history` key
6. **Invoice table headers all hardcoded Vietnamese** — "Mã HĐ", "Gói cước", "Ngày", "Số tiền", "Trạng thái" → new locale keys `billing.inv_id/inv_plan/inv_date/inv_amount/inv_status`
7. **Invoice status badge hardcoded** — `{isPaid ? 'Đã thanh toán' : inv.status}` showed raw enum when unpaid; replaced with `t('billing.status_paid')` / `t('billing.status_unpaid')`
8. **CSV download content hardcoded Vietnamese** — all 6 CSV row labels hardcoded; replaced with new `billing.csv_title/csv_id/csv_date/csv_plan/csv_status/csv_amount` locale keys; `toLocaleDateString()` instead of hardcoded `'vi-VN'` locale
9. **ConfirmModal title = message** — both props used `billing.confirm_upgrade`; separated: title → new `billing.confirm_upgrade_title` (short), message → `billing.confirm_upgrade` with plan name interpolated from locale key
10. **Plan features hardcoded Vietnamese in PLANS** — `PLANS.*.features` arrays had hardcoded VI strings → render was not translated when user switched to EN; changed to locale keys `billing.f_{tier}_{index}` in `dbApi.ts`; render updated to `{t(f)}`; 37 new feature locale keys added (VI + EN)

- New locale keys (37): `billing.renews`, `billing.invoice_history`, `billing.inv_id/plan/date/amount/status`, `billing.status_paid/unpaid`, `billing.confirm_upgrade_title`, `billing.csv_title/id/date/plan/status/amount`, `billing.f_individual_{0-4}`, `billing.f_team_{0-5}`, `billing.f_enterprise_{0-6}` (VI + EN)

### Billing.tsx — seatsUsed Bug Fix (March 2026)
- **Bug**: `getUsageSummary()` in `subscriptionRepository.ts` queried `usage_tracking WHERE metric_type='seats'` which had no rows → `seatsUsed` always 0
- **Fix**: Updated `getUsageSummary()` to `COUNT(*) FROM users WHERE status='ACTIVE'` for real seat count; `emailsSent` now sums `usage_tracking` + `audit_logs` rows with email actions; `aiRequests` still from `usage_tracking`
- **Result**: `/api/billing/usage` now returns actual active user count (e.g. `seatsUsed: 2` matching 2 ACTIVE users); progress bar on Billing page shows real data

### Dashboard.tsx Audit & Fix (March 2026)
7 bug groups resolved in `pages/Dashboard.tsx`:
1. **Missing imports** — `useCallback` and `createPortal` were not imported; added to React and react-dom imports
2. **Toast not in portal** — `fixed` toast inside root `animate-enter` div; moved to `createPortal(document.body)` with Fragment `<>` wrapper; removed `animate-enter` from toast class (CSS transform trap)
3. **`notify` not memoized** — plain function re-created each render; wrapped in `useCallback([], [])`
4. **GeoLocationTable — 16 hardcoded Vietnamese strings** — title, error state, 3 stat labels (total visits, last 30d, unique IPs, IP source, GEO coverage, visits unit), Top Countries/Cities headings, empty state messages (no IP, no cities, localhost hint), `|| 'Không rõ'` for unknown country/city → replaced with `dash.geo_*` locale keys
5. **RealtimeTrafficWidget — 2 hardcoded strings** — "DB Latency" and "Lỗi / 60s" → `t('dash.traffic_db_latency')` / `t('dash.traffic_errors')`
6. **Dead `|| "fallback"` patterns** — 8 dead fallback patterns removed: `dash.commission_2_percent`, `dash.pipeline_value`, `dash.win_probability`, `dash.vs_last_period` (×3), `dash.ai_deflection_rate`, `dash.resolved_by_ai`, `dash.sales_velocity`, `dash.days_to_close` — `t()` never returns falsy so `||` branches never fire
7. **`isSalesScope` fragile comparison** — compared `scopeLabel` against 3 hardcoded strings (`t(...)`, `'Dữ liệu của bạn'`, `'Your data'`); simplified to single `scopeLabel === t('dash.scope_personal')`

### DataPlatform.tsx Audit & Fix (March 2026)
3 bugs resolved in `pages/DataPlatform.tsx`:
1. **Toast not in portal** — `fixed` toast inside root `animate-enter` div; moved to `createPortal(document.body)` with Fragment `<>` wrapper; added `role="status" aria-live="polite"` attributes
2. **`SyncStatus.PENDING` does not exist** — `StatusBadge` styles map had `[SyncStatus.PENDING]` key, but enum only has `QUEUED/RUNNING/COMPLETED/FAILED`; this caused QUEUED jobs to never match → always rendered gray instead of amber; fixed to `[SyncStatus.QUEUED]`
3. **4 dead `|| 'hardcoded fallback'` patterns** — `data.modal_subtitle`, `data.name_placeholder`, `data.empty_connectors_hint`, `data.empty_jobs_hint` keys all exist in locale; the `||` branches never fire; removed to keep code clean

### SecurityCompliance.tsx Audit & Fix (March 2026)
3 bugs resolved in `pages/SecurityCompliance.tsx`:
1. **Toast not in portal** — `fixed` toast inside root `animate-enter` div; moved to `createPortal(document.body)` with Fragment `<>` wrapper
2. **Root container missing `p-4 sm:p-6`** — added to `div.space-y-6 pb-20 animate-enter relative`
3. **DLP action badge wrong key for LOG_ONLY** — `'LOG_ONLY'.toLowerCase().replace('_','')` produced `'logonly'` → key `security.action_logonly` (missing) → displayed raw key in UI; replaced with static lookup map `{ REDACT: 'security.action_redact', BLOCK: 'security.action_block', LOG_ONLY: 'security.action_log' }`

### EnterpriseSettings.tsx Audit & Fix (March 2026)
6 nhóm bug đã vá trong `pages/EnterpriseSettings.tsx`:
1. **Toast không trong portal** — `fixed` toast bên trong `animate-enter` container, đã chuyển sang `createPortal(document.body)`, thêm Fragment `<>` bọc ngoài
2. **ZaloPanel — 8 chuỗi hardcoded** — token_required, token_updated, update_token button, add_token button, token_new_label, save button, env_configured/not_configured, token_configured/missing — tất cả đã thay bằng locale keys `ent.zalo_*`
3. **FacebookPanel — 1 chuỗi hardcoded** — "Webhook URL đang hoạt động" → `t('ent.facebook_webhook_active')`
4. **EmailPanel — 7 chuỗi hardcoded** — From Name label, From Address label, SSL hint, Test Connection/Testing, Send Test Email/Sending → `ent.email_*`
5. **SSOPanel** — `notify('Copied!')` hardcoded English → `notify(t('common.copied'))`, redirect hint, verify result text, verify button → `ent.sso_*`
6. **AuditPanel — toàn bộ filter/pagination hardcoded** — ENTITY_OPTIONS labels, action placeholder, clear filter button, records count, page X/Y text, prev/next buttons → `ent.audit_*`
- 35 locale keys mới (VI + EN): `ent.zalo_token_*`, `ent.facebook_webhook_active`, `ent.email_from_*`, `ent.email_ssl_hint`, `ent.email_test_conn/testing/send_test/sending`, `ent.sso_redirect_hint/verify_valid/verify_btn/verifying`, `ent.audit_entity_*/action_placeholder/clear_filter/records/page/prev/next`

### Favorites.tsx Audit & Fix (March 2026)
4 bugs resolved in `pages/Favorites.tsx`:
1. **Toast not in portal** — same `animate-enter` / `transform` trap as Inbox; moved toast to `createPortal(document.body)`, added `createPortal` import
2. **ConfirmModal wrong semantics** — title `common.delete` ("Xóa") and message `common.confirm_delete` ("Không thể hoàn tác. Bạn chắc chắn muốn xóa?") for a "remove from favorites" action; changed to `favorites.remove` + new `favorites.remove_confirm` key (clarifies the listing is NOT deleted, only removed from list)
3. **`notify` not memoized** — plain function re-created each render was captured by `fetchFavorites` stale closure; wrapped in `useCallback([])`
4. **`fetchFavorites` stale closure** — empty deps `[]` while using `t` via `notify`; changed to `[t, notify]`
- New locale key: `favorites.remove_confirm` (VI + EN)

### LiveChat AI Auto-Response Fix (March 2026)
Two root causes prevented AI from responding in the LiveChat widget:
1. **Deprecated Gemini model** — `gemini-2.0-flash` and `gemini-2.0-flash-lite` are "no longer available to new users". Updated `server/ai.ts` `GENAI_CONFIG.MODELS` to `gemini-2.5-flash` (current stable model). Verified by listing models via `/v1beta/models` API.
2. **Rate limiter too aggressive** — `publicLeadRateLimit` (5 req/min per IP) was applied to ALL public livechat routes: `/api/public/livechat/messages/:leadId` (GET), `/api/public/livechat/message` (POST), and `/api/public/ai/livechat` (POST). After just 2 messages from the same IP (lead creation + 1 message save + 1 AI call = 3 requests), the 3rd message was blocked. Created `livechatRateLimit` (60 req/min) in `server/middleware/rateLimiter.ts` specifically for livechat message and AI routes. Lead creation (`/api/public/leads`) retains the strict 5/min limit.

### Inbox AI Auto-Response Persistence Fix (March 2026)
**Root cause:** `getInboxThreads()` in `dbApi.ts` hardcoded `status: ThreadStatus.AI_ACTIVE` for every thread — no DB column existed. Every page refresh reset all threads to AI=ON, discarding agent toggles.
**Fix applied:**
- **Migration 039** (`server/migrations/039_leads_thread_status.ts`): Added `thread_status VARCHAR(50) NOT NULL DEFAULT 'AI_ACTIVE'` column to `leads` table + index
- **`interactionRepository.getInboxThreads`**: SQL now selects `COALESCE(l.thread_status, 'AI_ACTIVE') as thread_status`; mapped to `threadStatus` in result
- **`dbApi.ts` `getInboxThreads`**: Maps `r.threadStatus` to actual `ThreadStatus` enum value (not hardcoded)
- **New endpoint** `PUT /api/inbox/threads/:leadId/ai-mode` (in `interactionRoutes.ts`): Validates and persists `AI_ACTIVE` or `HUMAN_TAKEOVER` to DB
- **`inboxApi.ts`**: Added `updateAiMode(leadId, status)` 
- **`dbApi.ts`**: Added `updateThreadAiMode(leadId, status)` wrapper
- **`Inbox.tsx` `toggleAiMode`**: Now `async`, calls `db.updateThreadAiMode()` after local state update; reverts on failure
- **`handleEscalateToHuman`**: Also calls `db.updateThreadAiMode(leadId, 'HUMAN_TAKEOVER')` to persist escalation
- **Manual send path**: When agent sends without `/` prefix (human takeover), also calls `db.updateThreadAiMode(selectedLeadId, 'HUMAN_TAKEOVER')`

### Inbox.tsx Audit & Fix (March 2026)
4 bugs resolved in `pages/Inbox.tsx`:
1. **Search placeholder wrong key** — `t('inbox.select')` ("Chọn hội thoại xem chi tiết") → `t('common.search')` ("Tìm kiếm")
2. **Toast not in portal** — Toast with `position:fixed` was inside `overflow-hidden animate-enter` container; `animate-enter` uses CSS `transform` during 0.18s animation which trapped fixed positioning; moved toast to `createPortal(document.body)`
3. **Missing page padding** — Root div had no outer spacing; wrapped in `p-4 sm:p-6` height-carrying container, inner panel uses `h-full`
4. **No channel/status filters** — Multi-channel inbox had no filter UI; added `All`/`Unread` status pills + `All`/`ZALO`/`FACEBOOK`/`EMAIL`/`SMS` channel pills; `filteredThreads` useMemo updated to respect both `channelFilter` and `statusFilter` states
- New locale keys added: `inbox.filter_all` (VI: "Tất cả" / EN: "All") and `inbox.filter_unread` (VI: "Chưa đọc" / EN: "Unread")

### Comprehensive Fix Applied (March 2026)
- 277 hardcoded `text-slate-400/300/200` + `bg-white` → CSS variables in 34 theme-aware pages/components
- 382 arbitrary `text-[8px/9px/10px/11px]` → named Tailwind tokens (`text-3xs/2xs/xs2/xs3`)
- Button hover direction standardized: `hover:bg-indigo-500` → `hover:bg-indigo-700`
- `--rose-500` added to `.dark` mode override

### SEO Architecture (March 2026)

**utils/seo.ts** — Central SEO module:
- `ROUTE_SEO` (exported) — Static per-route SEO config (title, description, path, noIndex)
- `SEOConfig` (exported interface) — Shape of a route SEO entry
- `SEO_BASE_URL` (exported) — `https://sgsland.vn`
- `updatePageSEO(routeBase)` — Applies title/OG/canonical/robots for a given route, checks localStorage overrides first
- `getSEOOverrides()` / `saveSEOOverride()` / `clearSEOOverride()` — localStorage-based per-route meta overrides
- `injectListingSEO(listing)` — Dynamic SEO injection when viewing a listing detail (title from listing.title + location, description from type/area/price, canonical `/listing/:id`, OG image from listing.images[0])
- `injectArticleSEO(article)` — Dynamic SEO injection when viewing an article (title + excerpt truncated to 160 chars, canonical `/news/:id`, OG image from article.image)
- `clearDynamicSEO(routeBase)` — Restores route-level SEO (called on component unmount)

**pages/SeoManager.tsx** — Admin-only SEO dashboard (ADMIN + TEAM_LEAD, noIndex):
- Tab 1 **SERP Preview**: Dropdown route selector → Google SERP mockup card + character count bars (title 30–60, desc 120–160)
- Tab 2 **Meta Editor**: Per-route title/description editor with localStorage override save/reset, dirty state, inline char counters
- Tab 3 **Sức khoẻ SEO**: 12 automated DOM/network health checks with pass/warn/fail badges and aggregate score
- Tab 4 **Structured Data**: Extracts all `<script type="application/ld+json">` from document head, shows formatted JSON with copy buttons
- External tool links: Google Search Console, PageSpeed Insights, Rich Results Test, Schema Markup Validator
- Registered at route `seo-manager`, added to `ADMIN_ONLY_ROUTES`, listed in Ecosystem nav group (Globe icon)

**Wire-up**:
- `pages/ListingDetail.tsx` — Calls `injectListingSEO(listing)` on listing load, `clearDynamicSEO('listing')` on unmount
- `pages/News.tsx` (ArticleDetail) — Calls `injectArticleSEO(article)` on mount, `clearDynamicSEO('news')` on unmount
- `config/routes.ts` — `SEO_MANAGER: 'seo-manager'` added
- `services/dbApi.ts` — `seo-manager` entry in `sys` menu group for Admin/Team Lead
- `components/Layout.tsx` — Globe icon mapped to `ROUTES.SEO_MANAGER`
- `config/locales.ts` — `menu.seo-manager` key added (VI + EN)

## Scripts

- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build production bundle (vite build + esbuild server.ts → server.js)
- `npm run start` - Start production server (node server.js)
- `npm run seed` - Seed database with sample data (idempotent)
- `npm run lint` - TypeScript type check

## Production Deployment

### Required Replit Secrets (all set as Secrets, not shared env)
| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | PostgreSQL connection string (set automatically by Replit DB) |
| `JWT_SECRET` | 64-char hex key for signing JWT cookies — rotate immediately if exposed |
| `GEMINI_API_KEY` | Google AI Studio API key — enables AI valuation, chat, lead scoring |

### Required production env vars (set via Replit deployment environment)
| Variable | Example | Purpose |
|----------|---------|---------|
| `ALLOWED_ORIGINS` | `https://sgs-land.username.replit.app` | **Required in production.** Comma-separated list of allowed CORS origins. Set to your `.replit.app` deployment domain. Without this, cross-origin requests (e.g., from external webhooks, partner integrations) will be blocked. Same-origin browser requests still work either way, but this must be set for a complete production config. |

### Optional env vars
| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | in-memory fallback | Redis connection for job queues — required for multi-instance scale-out |
| `PORT` | `5000` | Server listen port (Replit maps 5000→80 automatically) |
| `LOG_LEVEL` | `INFO` | Log verbosity: DEBUG / INFO / WARN / ERROR |

### Deployment config (`.replit`)
- Target: `vm` (always-on VM, not serverless)
- Build command: `npm run build`
- Run command: `node server.js`
- Port mapping: `5000 → 80`

### Build artifacts
- `dist/` — Vite frontend bundle (SPA, served as static files by Express)
- `server.js` — esbuild-bundled server (537 KB, all deps external)

### Migration behaviour
- Migrations run automatically on startup via `server/migrations/runner.ts`
- Transient DB timeouts are retried 3× then skipped with a WARN log (server still starts)
- If migrations were skipped, restart the server once the DB is reachable again

### Task Management Module (Tasks #11–13, March 2026)

Complete task management system added:

**Backend (Task #11)**:
- `server/routes/taskRoutes.ts` — Full CRUD + status workflow + comments (PATCH/DELETE) + activity log pagination
- `server/routes/taskReportRoutes.ts` — `/api/dashboard/task-stats`, `/api/reports/task-summary`, `/api/reports/task-by-project`, `/api/reports/task-export/csv`
- PostgreSQL tables: `wf_tasks`, `task_assignments`, `task_comments`, `task_activity_log`

**Shared Utilities**:
- `utils/taskUtils.ts` — STATUS/PRIORITY/CATEGORY labels+colors, VALID_TRANSITIONS, `isValidTransition()`, `calcUrgency()`, `formatDeadlineRelative()`, `formatDeadlineShort()`, `exportTasksToCSV()`
- `components/task/Badges.tsx` — StatusBadge, PriorityBadge, DeadlineTag, AvatarStack (inline-style sizing), TaskSkeleton, TaskDetailSkeleton
- `components/task/TaskFilterBar.tsx` — Shared 9-dimension filter bar (search + status + priority + dept + project + assignee + deadline range)
- `services/taskApi.ts` — Full typed API layer incl. `getDepartments()`, `getUserWorkload()`, `searchUsers()`

**Core Pages (Task #12)**:
- `pages/Tasks.tsx` — Smart router (#/tasks/:id → detail, #/tasks → list); bulk actions; URL hash filter persistence (includes assigneeName via `uname=` param); filter params preserved on detail open/close; `isValidTransition()` guard on inline status change; priority success toast; department column at xl breakpoint
- `pages/TaskKanban.tsx` — @dnd-kit/core + @dnd-kit/sortable; drag-drop with isValidTransition guard, optimistic update + rollback; success/error toasts; SortableContext per column; formatDeadlineRelative for cards
- `components/TaskDetailContent.tsx` — Two-step assignee flow with due_note input; all actions have success/error toasts including comment send; confirm dialog for primary assignee removal

**Analytics Pages (Task #13)**:
- `pages/TaskDashboard.tsx` — Skeleton loading, refresh button, navigate upcoming deadlines → #/tasks/:id
- `pages/Employees.tsx` — Column sort (name/total/in_progress/done/overdue/completion_rate), skeleton rows, refresh button
- `pages/TaskReports.tsx` — User performance summary table (from /api/reports/task-summary), skeleton sections, refresh button, CATEGORY_LABELS from taskUtils

### Session note
- JWT_SECRET rotation invalidates all existing sessions — users must log in again
- `config/mockTenants.ts` deleted — tenant identity now served by real DB via `GET /api/tenant` (auth required); `tenantContext.tsx` fetches on mount with `credentials: 'include'`
- `server/seed.ts` guarded: exits with error if `NODE_ENV === 'production'`
- `TenantSwitcher.tsx` dev-only: returns null unless `import.meta.env.DEV` is true
- Migration 019: sets default `primaryColor: '#4F46E5'` + `features` on the initial tenant row
- `tsconfig.json` types now includes `vite/client` for `import.meta.env.*` support
