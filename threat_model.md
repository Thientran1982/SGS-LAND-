# Threat Model

## Project Overview

SGS Land is a multi-tenant real-estate CRM and AI platform for Vietnamese brokers, agencies, and partner vendors. The production application consists of a React/Vite frontend (`index.tsx`, `App.tsx`) served by a large Express/TypeScript backend (`server.ts`) backed by PostgreSQL, with JWT cookie authentication, role-based access control, Row Level Security for tenant isolation, Stripe billing, SCIM provisioning, upload/storage flows, webhook ingestion, email delivery, AI features, and partner cross-tenant sharing.

Production scope for this scan is the deployed Express server and the routes, repositories, services, and frontend flows it exposes in production. The mockup sandbox under `artifacts/mockup-sandbox/`, local build output under `dist/`, and other development-only helpers are out of scope unless production reachability is demonstrated. Per scan assumptions: `NODE_ENV` is `production` in deployed environments, transport TLS is handled by the platform, and the mockup sandbox is never deployed.

## Assets

- **User accounts and sessions** — JWT cookies, password hashes, session records, reset tokens, verification tokens, SCIM tokens, SSO secrets. Compromise allows impersonation and tenant takeover.
- **Tenant-isolated business data** — leads, listings, projects, contracts, tasks, notifications, analytics, partner access grants, and internal CRM notes. Cross-tenant disclosure or tampering breaks the core SaaS security boundary.
- **Uploaded content and knowledge documents** — images, videos, PDFs, DOCX/TXT files, extracted document text, and attachment URLs. These may contain proprietary customer or deal information.
- **Billing and subscription state** — Stripe checkout sessions, subscription plans, transaction status, invoices/receipts, and audit metadata. Tampering could grant paid access or misstate financial records.
- **Administrative and integration secrets** — database URLs, JWT secret, Stripe webhook secret, email webhook secrets, cron/internal secrets, SCIM bearer tokens, SSO shared secret, AI API keys. Exposure would enable system-wide compromise.
- **AI prompts, outputs, and governance data** — valuation inputs, prompt templates, safety logs, feedback, and cost/quota metadata. Abuse can leak tenant data or create expensive workloads.
- **Audit and operational data** — logs, error reports, backups, campaign activity, and metrics. These often aggregate sensitive data across users and tenants.

## Trust Boundaries

- **Browser / Mobile client to Express API** — all request bodies, query params, headers, cookies, uploads, and route params are untrusted.
- **Unauthenticated / Authenticated / Admin / Super-admin / Partner boundaries** — the system has multiple roles and partner-sharing modes that must be enforced server-side, not just in the UI.
- **Tenant to tenant boundary** — the application is multi-tenant; requests from one tenant must never read or mutate another tenant’s data unless an explicit cross-tenant sharing feature authorizes it.
- **Express server to PostgreSQL** — repositories and raw queries cross into the data store; tenant context and parameterization must be preserved on every query path.
- **Express server to external services** — Stripe, email providers, Gemini, geolocation, Facebook/Zalo/Brevo webhooks, and scraper/network fetches all cross a trust boundary and require origin/authentication validation.
- **Authenticated app to public/static media surfaces** — uploaded files and public listing/article endpoints intentionally expose some data; those paths must not accidentally expose private tenant documents or metadata.
- **Internal automation to public internet** — cron-style internal endpoints (`/api/internal/*`, QStash/webhooks) are internet-reachable in production and must authenticate requests as if they are hostile.

## Scan Anchors

- **Production entry points:** `server.ts`, `index.tsx`, `App.tsx`.
- **Highest-risk backend areas:** `server/routes/`, `server/repositories/`, `server/services/`, `server/db.ts`, `server/middleware/`.
- **Public or semi-public surfaces:** `/api/auth/*`, `/api/public/*`, `/api/landing-*`, `/uploads/*`, `/scim/v2`, `/api/webhooks/*`, `/api/billing/webhook`, `/api/internal/*`.
- **Privileged surfaces:** `/api/users`, `/api/projects`, `/api/tenant`, `/api/vendors`, `/api/admin/*`, `/api/enterprise`, `/api/connectors`, `/api/error-logs`, `/api/scraper`, `/api/backup*`.
- **Usually dev-only / ignore unless proven reachable:** `artifacts/mockup-sandbox/`, `dist/`, `fixes/`, local scripts and reports.

## Threat Categories

### Spoofing

The application accepts JWT cookies, SCIM bearer tokens, SSO shared-secret requests, Stripe and email webhooks, and internal cron-style requests. The system must authenticate each of these channels with strong server-side verification, reject missing or malformed credentials, and ensure alternate login or provisioning flows cannot impersonate another tenant or privilege tier.

### Tampering

Clients can submit CRM records, tenant configuration, uploads, campaign actions, billing-related inputs, and AI prompts. The server must validate and constrain all user-controlled input, compute sensitive state transitions server-side, and prevent unauthorized modification of records across role or tenant boundaries. Internal endpoints and webhook handlers must not trust caller-supplied body fields without authentication.

### Information Disclosure

The highest-impact failure mode is cross-tenant data exposure through RLS bypasses, raw SQL paths, permissive file serving, verbose logs, or admin/reporting endpoints that return more than the caller should see. Uploaded documents, CRM data, billing records, backups, notifications, and AI context must only be disclosed to authorized users in the correct tenant, and secrets or PII must not leak through logs or error messages.

### Denial of Service

The platform exposes public lead capture, live chat, valuation, upload, webhook, and AI-assisted endpoints that can trigger expensive database, AI, or file-processing work. These endpoints must enforce practical rate limits, body-size limits, upload limits, and timeouts so unauthenticated or low-privilege users cannot exhaust CPU, memory, third-party quotas, or email/AI spend.

### Elevation of Privilege

This project has multiple privilege tiers (`VIEWER`, standard users, tenant admins, super-admins, partner roles) and explicit cross-tenant sharing features. The system must enforce authorization on every privileged route and every repository path, preserve tenant context for database access, restrict RLS bypass helpers to tightly scoped use cases, and prevent IDOR, missing role checks, or raw query paths from expanding access beyond the caller’s role or tenant.