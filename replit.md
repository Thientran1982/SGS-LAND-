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
- **Auth**: JWT with httpOnly cookies

## Architecture

Single unified server (`server.ts`) runs both the Express API and the Vite dev server in middleware mode.

- Port: **5000** (both in dev and production)
- Host: `0.0.0.0`

## Security

- API keys (GEMINI_API_KEY) are server-side only — never exposed to frontend bundle
- JWT_SECRET auto-generates a random secret per session if not set (logged as warning)
- Socket.io connections require JWT auth via httpOnly cookie
- Yjs WebSocket connections require JWT auth via httpOnly cookie
- Vite HMR WebSocket is excluded from auth (dev only)
- All API routes require `authenticateToken` middleware (except auth endpoints, webhooks, health)
- MockDb enforces RLS (tenant isolation) and RBAC (role-based access) on all data access methods

## Data Access Control (mockDb.ts)

- **RLS (Row-Level Security)**: `withRLS()` filters data by `currentTenantId` — applied to getLeads, getLeadById, getPendingProposals, createLead
- **RBAC**: Sales agents only see their own assigned leads. Admin/Team Lead see all tenant leads
- **getLeadById**: RLS + RBAC enforced (returns null if no access)
- **getInteractions**: Validates lead access via getLeadById first (returns [] if no access)
- **getPendingProposals**: RLS + RBAC scoped to accessible leads
- **sendInteraction**: Validates lead exists AND user has access (separate error messages)
- **createLead**: Duplicate phone check within tenant before creation

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
- `server/queue.ts` - BullMQ webhook queue
- `server/ai.ts` - AI service routes

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (optional; app runs without it)
- `REDIS_URL` - Redis connection URL (optional; falls back to in-memory)
- `GEMINI_API_KEY` or `API_KEY` - Google Gemini API key for AI features (server-side only)
- `JWT_SECRET` - JWT signing secret (required for production; auto-generated in dev)
- `FB_VERIFY_TOKEN` - Facebook webhook verification token

## Known Issues (Resolved)

- SVG path error in ListingCard EYE icon: fixed malformed `s` command (13 params → 12)
- Dashboard AI Deflection Rate circle overflow: fixed with `overflow-hidden`, responsive sizing, `min-w-0`
- Recharts `ResponsiveContainer` negative dimensions: fixed by adding `minHeight`/`minWidth` to all instances
- Vite HMR WebSocket in Replit webview: infrastructure limitation, non-blocking (page loads fine, hot reload may not work)
- Dashboard KPI cards data inconsistency: all 4 cards now show unified layout with computed metrics and delta trends
- winProbability was hardcoded 30%: now computed as weighted average from pipeline data
- Missing RLS/RBAC in getLeadById, getInteractions, getPendingProposals: all now enforced
- /api/courses missing auth: added authenticateToken middleware
- systemService SIMULATION_ROUTES referenced non-existent /api/v1/* paths: updated to real routes

## Dev Credentials

- Email: `admin@sgs.vn`, Password: `admin` (or any password `123456`)

## Scripts

- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - TypeScript type check
