# SGS Land

SGS Land is an AI-powered real estate CRM and management platform for the Vietnamese market, streamlining operations and enhancing sales with data-driven insights.

## Run & Operate

*   **Run Development Server**: `npm run dev`
*   **Build Frontend**: `npm run build:client`
*   **Build Backend**: `npm run build:server`
*   **Typecheck**: `npm run typecheck`
*   **Database Migrations**:
    *   **Latest**: `npm run db:migrate-latest`
    *   **Rollback**: `npm run db:migrate-rollback`
    *   **Seed**: `npm run db:seed`
*   **Required Environment Variables**:
    *   `JWT_SECRET`
    *   `AIVEN_DATABASE_URL`
    *   `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` (for VNPay integration)
    *   `EXPO_PUBLIC_API_BASE_URL` (for mobile app)
    *   `EXPO_PUBLIC_SENTRY_DSN` (for mobile app Sentry)
    *   `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `XAI_API_KEY` (for AI probes)
    *   `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` (for Google Custom Search)
    *   `GEO_MONITOR_CRON_SECRET`

## Stack

*   **Frontend**: React 18 (TypeScript), Tailwind CSS, Framer Motion, TanStack Query, Recharts, Expo (for mobile)
*   **Backend**: Node.js, Express, Socket.io
*   **Database**: PostgreSQL (with RLS for multi-tenancy)
*   **ORM/Query Builder**: Knex.js (implicit via migrations and direct SQL)
*   **Validation**: Zod (via `server/middleware/validation.ts`)
*   **Build Tool**: Vite

## Where things live

*   **Frontend Source**: `client/`
*   **Backend Source**: `server/`
*   **Mobile App Source**: `apps/mobile/`
*   **Database Migrations**: `server/db/migrations/`
*   **Database Seeds**: `server/db/seeds/`
*   **API Routes**: `server/routes/`
*   **Repositories (Data Access)**: `server/repositories/`
*   **Services (Business Logic)**: `server/services/`
*   **AI Integration**: `server/ai/`
*   **UI Components**: `client/components/`
*   **UI Pages**: `client/pages/`
*   **Database Schema**: Defined across migration files in `server/db/migrations/`
*   **API Contracts**: Implicit from `server/routes/` and validation schemas in `server/middleware/validation.ts`
*   **Theme Files**: `client/tailwind.config.js`, `client/src/index.css`, `apps/mobile/src/theme/tokens.ts`

## Architecture decisions

*   **Multi-tenancy via PostgreSQL RLS**: Tenant isolation is enforced at the database level using Row Level Security, with a dedicated `sgs_app` role to prevent bypasses, ensuring data separation for different real estate agencies/vendors.
*   **Unified Backend Server**: A single Node.js Express server handles both API requests and serves the frontend in development, simplifying deployment and development workflows.
*   **AI Integration via durable LangGraph adapter**: Durable execution remains the outer boundary for tenant scope, leases, fencing, checkpoints, guardrails, approvals and outbox recovery. The approved LangGraph runtime now owns the orchestration adapter boundary, with explicit environment flags for immediate rollback to the TypeScript path.
*   **SEO & GEO Optimization**: A 3-layer SEO strategy combines SSR, client-side meta management (React Helmet), and dynamic DOM manipulation, complemented by GEO for localized, entity-rich content.
*   **Anonymous Device-based Mobile Push Notifications**: To support early mobile app features without requiring immediate user authentication, push notifications are managed via stable UUIDs per device installation, enabling targeted communication for saved searches.

## Product

*   **CRM & Lead Management**: Comprehensive tools for managing leads, including AI-powered lead scoring and analysis.
*   **Listing Management**: Features for managing property listings, including public microsites and internal project management.
*   **AI-powered Valuation Engine**: Real-time property valuation using 9 AVM coefficients, multi-source price blending, and an income approach.
*   **Automated Content Generation**: AI-powered content generation for marketing and documentation.
*   **Real-time Communication**: Socket.io for live updates on messages, lead changes, and presence.
*   **B2B Vendor Self-Signup**: Allows real estate agencies/vendors to self-onboard and create independent SaaS workspaces.
*   **Buyer Mobile Application**: A green-field Expo app for end-buyers featuring property discovery, search, lead forms, and push notifications for new listings.
*   **Online Booking & Payments**: Buyers can place refundable hold deposits on listings via VNPay, with real-time status updates.
*   **SEO & GEO Management**: Tools for optimizing search engine visibility and localized content, including a GEO Monitor for tracking brand mentions and SERP performance.

## User preferences

- I prefer clear and concise communication.
- I like to follow an iterative development process.
- Please ask for confirmation before implementing major architectural changes.
- Ensure all AI responses and system outputs are in Vietnamese.
- All documentation and code comments should be in English.
- Do not make changes to folder `node_modules`.
- Do not make changes to file `package-lock.json`.

## Gotchas

*   **RLS Bypass**: Some raw `pool.query` operations still run as the owner role, potentially bypassing RLS. While currently deemed safe due to manual WHERE clauses or non-sensitive tables, these should eventually be migrated to `withTenantContext`.
*   **Mobile Native Dependencies**: Optional native dependencies (like Sentry, Tracking Transparency) are loaded dynamically. They are *not* in `package.json` and require manual installation for production builds as documented in `apps/mobile/README.md` and `docs/mobile-store-submission.md`.
*   **VNPay Configuration**: The VNPay booking endpoint will return a 503 error if `VNPAY_TMN_CODE` or `VNPAY_HASH_SECRET` environment variables are not properly configured.
*   **Project Route Shadowing**: When adding new public project routes, ensure they are mounted *before* general `/:code` routes in Express to avoid shadowing.
*   **i18n Keys for UI**: Always use `useTranslation` for all UI labels; do not hardcode English literals in the frontend.

## Pointers

*   **PostgreSQL RLS Documentation**: _Populate as you build_
*   **LangChain/LangGraph Documentation**: _Populate as you build_
*   **Expo Documentation**: `https://docs.expo.dev/`
*   **Tailwind CSS Documentation**: `https://tailwindcss.com/docs`
*   **TanStack Query Documentation**: `https://tanstack.com/query/latest`
*   **VNPay Integration Guide**: _Populate as you build_
*   **Replit Object Storage API**: _Populate as you build_
*   **Brevo API Documentation**: _Populate as you build_