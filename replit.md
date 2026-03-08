# SGS Land

AI-powered real estate CRM and management platform for the Vietnamese market.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Recharts
- **Backend**: Node.js + Express (unified server with Vite middleware in dev)
- **Build Tool**: Vite 6
- **Real-time**: Socket.io, Yjs + y-websocket (CRDT collaboration)
- **Database**: PostgreSQL with Row Level Security (multi-tenancy)
- **Queue**: BullMQ (falls back to in-memory if no Redis)
- **AI**: Google Gemini via `@google/genai`
- **Auth**: JWT with httpOnly cookies, bcrypt password hashing

## Architecture

Single unified server (`server.ts`) runs both the Express API and the Vite dev server in middleware mode.

- Port: **5000** (both in dev and production)
- Host: `0.0.0.0`

### Data Access Layers

The app has TWO data access paths:

1. **Real PostgreSQL** (production path): `services/dbApi.ts` → `services/api/*.ts` → HTTP API → `server/routes/*.ts` → `server/repositories/*.ts` → PostgreSQL
2. **Legacy mockDb** (still exists as `services/mockDb.ts` but NO longer imported by any frontend code)

### Repository Pattern (`server/repositories/`)
- `baseRepository.ts` — `withTenantContext()` for RLS, pagination, error handling
- `leadRepository.ts` — CRUD leads with search, duplicate check, stage transitions
- `listingRepository.ts` — CRUD listings, favorites
- `proposalRepository.ts` — CRUD proposals, smart approval logic
- `contractRepository.ts` — CRUD contracts
- `interactionRepository.ts` — CRUD interactions, inbox thread aggregation
- `userRepository.ts` — CRUD users, bcrypt auth, teams
- `analyticsRepository.ts` — SQL aggregations for dashboard KPIs

### API Routes (`server/routes/`)
- `leadRoutes.ts` — `/api/leads/*`
- `listingRoutes.ts` — `/api/listings/*`
- `proposalRoutes.ts` — `/api/proposals/*`
- `contractRoutes.ts` — `/api/contracts/*`
- `interactionRoutes.ts` — `/api/inbox/*`
- `userRoutes.ts` — `/api/users/*`
- `analyticsRoutes.ts` — `/api/analytics/*`

### Frontend API Client (`services/api/`)
- `apiClient.ts` — Base HTTP client with JWT cookie auth, error handling
- `leadApi.ts`, `listingApi.ts`, `proposalApi.ts`, `contractApi.ts`, `inboxApi.ts`, `userApi.ts`, `analyticsApi.ts`
- `services/dbApi.ts` — Compatibility shim: mirrors the mockDb interface but routes to real API

## Security

- API keys (GEMINI_API_KEY) are server-side only — never exposed to frontend bundle
- JWT_SECRET auto-generates a random secret per session if not set (logged as warning)
- Socket.io connections require JWT auth via httpOnly cookie
- Yjs WebSocket connections require JWT auth via httpOnly cookie
- Vite HMR WebSocket is excluded from auth (dev only)
- All API routes require `authenticateToken` middleware (except auth endpoints, webhooks, health)
- PostgreSQL RLS enforces tenant isolation at DB level
- RBAC enforced in repositories (Sales agents see own leads, Admin/Team Lead see all)
- `withTenantContext` uses UUID-validated string interpolation (SET LOCAL doesn't support $1 params)

## Business Logic

- **Lead → LOST**: Auto-rejects all PENDING_APPROVAL and DRAFT proposals for that lead
- **Lead Scoring**: Heuristic score on create/update, then enqueues AI scoring via background queue
- **Proposal Smart Approval**: Auto-approves if discount <= 10%, otherwise PENDING_APPROVAL
- **Revenue**: 2% commission on APPROVED proposals' finalPrice
- **Pipeline Value**: finalPrice × probability (A=85%, B=60%, C=30%, D=10%, F=1%)
- **Win Probability**: Weighted average from actual pipeline data (not hardcoded)
- **AI Deflection Rate**: AI outbound interactions / total outbound interactions

## Entry Points

- `server.ts` - Express + Vite server entry
- `App.tsx` - React frontend entry
- `server/db.ts` - PostgreSQL schema and RLS setup
- `server/seed.ts` - Database seeding script
- `server/queue.ts` - BullMQ webhook queue
- `server/ai.ts` - AI service routes
- `services/dbApi.ts` - Frontend data access (API-backed)

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `REDIS_URL` - Redis connection URL (optional; falls back to in-memory)
- `GEMINI_API_KEY` or `API_KEY` - Google Gemini API key for AI features (server-side only)
- `JWT_SECRET` - JWT signing secret (required for production; auto-generated in dev)
- `FB_VERIFY_TOKEN` - Facebook webhook verification token

## Dev Credentials

- Email: `admin@sgs.vn`, Password: `admin`
- Default tenant ID: `00000000-0000-0000-0000-000000000001`
- 8 users, 20 leads, 15 listings, 7 proposals, 1 contract, 35 interactions seeded

## Scripts

- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run seed` - Seed database with sample data (idempotent)
- `npm run lint` - TypeScript type check

## Known Issues (Resolved)

- SVG path error in ListingCard EYE icon: fixed malformed `s` command
- Dashboard AI Deflection Rate circle overflow: fixed with overflow-hidden
- Recharts ResponsiveContainer negative dimensions: fixed with minHeight/minWidth
- Dashboard KPI cards: unified layout with computed metrics and delta trends
- winProbability: computed as weighted average from pipeline data
- RLS/RBAC enforced in getLeadById, getInteractions, getPendingProposals
- /api/courses: added authenticateToken middleware
- withTenantContext SET LOCAL: uses UUID-validated string interpolation (not $1 params)
- Inbox threads query: fixed l.avatar → l.attributes->>'avatar'
