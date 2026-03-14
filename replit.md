# SGS Land

AI-powered real estate CRM and management platform for the Vietnamese market.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Tailwind CSS (PostCSS/npm build, NOT CDN), Framer Motion, TanStack Query, Recharts
- **Backend**: Node.js + Express (unified server with Vite middleware in dev)
- **Build Tool**: Vite 6
- **Real-time**: Socket.io, Yjs + y-websocket (CRDT collaboration)
- **Database**: PostgreSQL with Row Level Security (multi-tenancy), 25 tables
- **Queue**: BullMQ (falls back to in-memory if no Redis)
- **AI**: Google Gemini via `@google/genai`
- **Auth**: JWT with httpOnly cookies, bcrypt password hashing, password reset tokens
- **Email**: Nodemailer (SMTP per-tenant from enterprise_config, console fallback)

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
- `listingRepository.ts` — CRUD listings, favorites
- `proposalRepository.ts` — CRUD proposals, smart approval logic
- `contractRepository.ts` — CRUD contracts
- `interactionRepository.ts` — CRUD interactions, inbox thread aggregation
- `userRepository.ts` — CRUD users, bcrypt auth, teams, invite flow
- `analyticsRepository.ts` — SQL aggregations for dashboard KPIs, BI marts, campaign costs
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

### Database Tables (26 total)
**Core CRM**: users, leads, listings, proposals, contracts, interactions, tasks, favorites
**Organization**: tenants, teams, team_members
**Automation**: sequences, routing_rules, templates
**Knowledge**: documents, articles
**Analytics**: audit_logs, campaign_costs
**Configuration**: enterprise_config, scoring_configs
**Billing**: subscriptions, usage_tracking
**AI Governance**: ai_safety_logs, prompt_templates
**Security**: user_sessions, password_reset_tokens

## Security

- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- HSTS enabled in production
- CORS: restricted origins in production, open in dev
- Rate limiting on auth (15/15min), AI (20/min), API (120/min), webhooks (100/min)
- Input validation on all POST/PUT routes with schema-based validation
- XSS prevention via input sanitization
- Webhook signature verification for Facebook (HMAC-SHA256) and Zalo
- Parameter pollution prevention
- API keys (GEMINI_API_KEY) server-side only
- JWT with httpOnly cookies, 24h expiry
- Socket.io/Yjs WebSocket auth via JWT cookie
- PostgreSQL RLS enforces tenant isolation
- RBAC in repositories (Sales see own, Admin/Team Lead see all)
- `withTenantContext` uses UUID-validated string interpolation
- Audit logging for login, CRUD operations, password changes
- Session tracking with revocation support
- Password reset: tokens hashed (SHA-256) in DB, atomic single-use consume, uniform response timing. Reset link format: `/#/reset-password/<token>` → App.tsx redirects to Login with token → Login.tsx auto-populates FORGOT_VERIFY view

## Business Logic

- **Lead → LOST**: Auto-rejects all PENDING_APPROVAL and DRAFT proposals
- **Lead Scoring**: Heuristic score + AI scoring (persisted to DB via background queue)
- **Scoring Config**: Customizable weights/thresholds stored in PostgreSQL per tenant
- **Proposal Smart Approval**: Auto-approves if discount <= 10%
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
- `POST /api/ai/valuation` — Real-time valuation with Google Search grounding
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
- `LOG_LEVEL` - Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)

## Dev Credentials

- Email: `admin@sgs.vn`, Password: `123456` (all seeded users use `123456`)
- Default tenant ID: `00000000-0000-0000-0000-000000000001` (canonical const `DEFAULT_TENANT_ID` in `server/constants.ts`; also a module-level const in `services/dbApi.ts`)
- 8 users, 20 leads, 15 listings, 7 proposals, 1 contract, 35 interactions seeded

## Important Notes

- **Filter sentinel values**: Frontend uses `'ALL'` as the default for stage/source/type filters. ALL `dbApi.get*()` methods MUST check `!== 'ALL'` before adding to params — otherwise SQL gets `WHERE type = 'ALL'` → 0 results. Fixed for `getLeads`, `getContracts`, `getListings`.
- **getFavorites returns structured object**: `db.getFavorites(page?, pageSize?)` returns `{data: Listing[], total, totalPages, page, pageSize}` (NOT a bare array). Always access `favs.data`, never treat return as array. Items in `data` do NOT have `isFavorite` set from DB — callers must set `isFavorite: true` manually (e.g., Favorites page does `map(item => ({...item, isFavorite: true}))`).
- **findListings returns stats**: `listingRepository.findListings()` now returns `stats: { availableCount, holdCount, soldCount, rentedCount, bookingCount, openingCount }` alongside `data/total/page/totalPages`. Stats are **global** (unfiltered, full tenant inventory counts).
- **dbApi.ts must forward all fields**: `dbApi.getListings()` explicitly reconstructs the return object — if a new field (e.g. `stats`, `totalPages`) is added to the backend response, it MUST also be added to the `return { ... }` in `dbApi.ts`. The frontend Inventory page reads `res.stats` — if `dbApi.ts` omits `stats` in its return, the UI always shows 0.
- **pg PoolClient sequential queries only**: `withTenantContext` gives a single `PoolClient`. NEVER use `Promise.all([client.query(), client.query()])` — PostgreSQL wire protocol is sequential; concurrent `.query()` calls on the same client fire a DeprecationWarning and cause the 2nd/3rd queries to silently fail. Always `await` each `client.query()` one at a time.
- **Public API for unauthenticated users**: Routes registered in `server.ts` BEFORE authenticated routes, using `PUBLIC_TENANT = '00000000-0000-0000-0000-000000000001'`: `GET /api/public/listings` (status_in AVAILABLE/OPENING/BOOKING), `GET /api/public/listings/:id`, `POST /api/public/leads` (requires name+phone, no auth). `dbApi.ts` exposes `getPublicListings()`, `getSimilarListings()`, `createPublicLead()`. `getListingById()` falls back to public on 401. `Landing.tsx` and `ProductSearch.tsx` use `getPublicListings()`. `ListingDetail.tsx handleBooking` uses `createPublicLead()` when `currentUser` is null, `handleContact` also captures lead silently.
- **Seed script is not re-entrant**: `server/seed.ts` checks `SELECT COUNT(*) FROM users` — if users exist it skips entirely. If proposals/listings/leads are manually deleted, re-seeding is blocked. To restore: manually INSERT records using `executeSql`. Current DB state: 1 user (admin@sgs.vn), 16 listings (all with HCMC coordinates), 0 leads, 0 proposals.
- **listings.coordinates column**: `JSONB` column storing `{"lat": number, "lng": number}`. All 16 seeded listings have realistic coordinates (HCMC districts). Seed script now includes `lat`/`lng` in `listingData` and inserts via `$13` param. MapView.tsx uses `listing.coordinates` to place Leaflet markers.
- **score column in leads is jsonb**: `leads.score` stores `{"score": 58, "grade": "B", "reasoning": "..."}`. To extract numeric score use `(score->>'score')::numeric`. Never use `COALESCE(score, 0)` — type mismatch error.
- **Lead column ambiguity**: When JOINing `leads l` with `users u`, ALL WHERE conditions MUST use `l.` prefix (both tables have `name`, `source` columns).
- **Lead creation stage**: POST `/api/leads` must destructure and pass `stage` from `req.body` to `leadRepository.create()`.

## Scripts

- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run seed` - Seed database with sample data (idempotent)
- `npm run lint` - TypeScript type check
