# SGS Land - AI-powered Real Estate CRM

## Overview

SGS Land is an AI-powered real estate CRM and management platform designed for the Vietnamese market. It provides a comprehensive suite of tools for managing leads, listings, proposals, and contracts, enhanced with advanced AI capabilities for property valuation, lead scoring, and content generation. The platform aims to streamline real estate operations, improve sales efficiency, and offer data-driven insights. Key capabilities include a real-time property valuation engine, automated lead nurturing sequences, and an intelligent AI assistant that can interact with clients, analyze leads, and draft documents. The project focuses on a robust, scalable architecture with a strong emphasis on security, performance, and a user-friendly experience tailored to the Vietnamese market.

## User Preferences

- I prefer clear and concise communication.
- I like to follow an iterative development process.
- Please ask for confirmation before implementing major architectural changes.
- Ensure all AI responses and system outputs are in Vietnamese.
- All documentation and code comments should be in English.
- Do not make changes to folder `node_modules`.
- Do not make changes to file `package-lock.json`.

## System Architecture

**Frontend**:
- React 18 + TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Recharts.
- Custom browser history router for clean URLs, with legacy hash URL redirection.
- The UI/UX prioritizes a dark mode-first design with a customizable theme system allowing primary color, background colors, and font family adjustments, persisted via `localStorage` and `enterprise_config` table.
- All UI components are designed with responsiveness in mind, using Tailwind CSS and ensuring accessibility (e.g., SVG `role="img"`, `aria-label`, `<title>` for screen readers).
- Internationalization is fully supported with a two-language dictionary (Vietnamese and English) using dot-notation keys.

**Backend**:
- Node.js + Express (unified server with Vite middleware in development).
- Single unified server (`server.ts`) running on port 5000.
- **Repository Pattern**: Centralized data access logic in `server/repositories/` for CRUD operations on all entities, enforcing PostgreSQL Row Level Security (RLS) for multi-tenancy.
- **API Routes**: Organized by resource in `server/routes/` (e.g., `/api/leads`, `/api/listings`).
- **Middleware**: Includes security headers, CORS, input validation, error handling, rate limiting, structured logging, and audit logging.
- **Services**: `emailService`, `systemService`, `geoService`, `marketDataService`, `priceCalibrationService` for core business logic.
- **Valuation Engine**: A complex 1,647-line module (`server/valuationEngine.ts`) implementing 9 AVM coefficients, multi-source price blending, an income approach, and regional/project-specific price tables. Includes RLHF price correction.
- **File Upload System**: `POST /api/upload` endpoint supporting multi-file upload (up to 10 files, 10MB each), with storage to Replit Object Storage in production and local disk in development. Supports serving and deleting files with tenant-scoped authentication. Text extraction for PDF/DOCX documents is performed on upload for Knowledge Base integration.
- **Real-time Events**: Socket.io for immediate updates on messages, lead changes, and presence tracking.
- **AI Integration**:
    - **Architecture**: 9-node LangGraph pipeline for processing messages: ROUTER → [INVENTORY|FINANCE|LEGAL|SALES|MARKETING|CONTRACT|LEAD_ANALYST|VALUATION|ESCALATION] → WRITER → END.
    - Uses Google Gemini via `@google/genai`.
    - Features per-tenant model selection, spend tracking, safety logging, and prompt templates (DB-backed).
    - Includes advanced memory layers: conversation history, memory digest for older topics, intent history, lead analysis persistence, RLHF few-shot examples, and agent observations.
    - RLHF (Reinforcement Learning from Human Feedback) loop for self-improvement, with user feedback and daily recomputation of reward signals.
    - Agent self-learning through observation logging at each specialist node.
    - AI-powered Lead Scoring and Lead Analysis persistence.
    - AI-powered Content Generation with streaming SSE.
    - Intelligent `VALUATION_AGENT` incorporating 8 AVM coefficients, internal comparables, and real-time market data.
- **Security**: JWT authentication with httpOnly cookies, PostgreSQL RLS for tenant isolation, Role-Based Access Control (RBAC) in repositories, audit logging, session revocation, and input sanitization to prevent XSS. Rate limiting on key endpoints.
- **Database**: PostgreSQL with 35 tables, leveraging Row Level Security for multi-tenancy. Includes tables for CRM, organization, automation, knowledge base, analytics, billing, AI governance, security, task management, and market/valuation data.
- **Performance at Scale**:
    - **DB Query Optimization**: Merged COUNT+stats queries into a single parallel operation with data retrieval.
    - **GIN Trigram Indexes**: Implemented `pg_trgm` extension and GIN indexes for efficient `ILIKE '%query%'` searches on text fields.
    - **Compound Indexes**: Added specific compound indexes to optimize common multi-filter queries.
    - **Cursor-Based Pagination**: Implemented for the Inventory page using `(created_at, id)` as a composite cursor to achieve O(log N) performance for deep pagination.
    - **LazyImage Component**: Frontend component with IntersectionObserver, skeleton shimmer, and `decoding="async"` for efficient image loading.
- **SEO & GEO Optimization**:
    - 3-layer SEO stack: SSR for initial crawl, React Helmet for client-side SPA navigation, and DOM manipulation for dynamic content.
    - Comprehensive meta tag generation (title, description, canonical, OG, Twitter Card, JSON-LD).
    - Admin-only SEO Manager dashboard for SERP preview, meta editing, SEO health checks, and structured data viewing.
    - Dynamic SEO injection for listing and article detail pages.
    - Per-route noscript injection with auto-extracted facts + FAQ from JSON-LD (`server/seo/metaInjector.ts`).
    - GEO (Generative Engine Optimization) content: entity-rich descriptions, statistics, expert FAQ, E-E-A-T signals.
    - Full support for Vietnamese translation keys across all UI elements.
- **Homepage (Landing.tsx)**:
    - Hero: H1 "BẤT ĐỘNG SẢN" typewriter, badge "Đại Lý BĐS + AI Định Giá", entity-rich description (Aqua City 1.000ha, The Global City 117ha, Izumi City 170ha, Vinhomes Cần Giờ 2.870ha), hotline 0971 132 378.
    - Metrics bar (4 real BĐS stats): 11+ Dự Án, 95% Chính Xác AI, 5 Tỉnh, 24/7 Hỗ Trợ.
    - Partners ticker: 11 real project names (Aqua City Novaland, The Global City Masterise, Izumi City Nam Long, Vinhomes Cần Giờ, Vinhomes Grand Park, etc.).
    - Featured Projects section: 6 project cards (FEATURED_PROJECTS const) with AI-rendered project images (16:9 aspect ratio, lazy load, hover zoom), badge overlay, links to /du-an/{slug}. Images at `public/images/projects/*.png`.
    - GEO FAQ section: 8 Q&A pairs optimized for AI citation (HOME_FAQ const), accordion UI, E-E-A-T byline with source citations (CBRE Vietnam, Savills Vietnam, Bộ Xây Dựng).
    - CTA section: buyer/investor focused, phone button `tel:+84971132378`, "Xem Bảng Giá Miễn Phí".
    - Zalo float button: fixed bottom-right (all viewports), `href=https://zalo.me/0971132378`.
    - Sticky mobile bottom bar: fixed bottom-0 (md:hidden) — phone + Zalo + tư vấn buttons.
- **Project Directory (`pages/ProjectDirectory.tsx`)**: `/du-an` index page.
    - Hero with H1, entity tags (Aqua City 1.000ha, The Global City 117ha, Izumi City 170ha, Vinhomes Cần Giờ 2.870ha), 11-project count.
    - Sticky filter bar: text search + khu vực (TP.HCM/Đồng Nai) + loại hình (3 types) + trạng thái (6 states). Mobile-responsive collapse.
    - 11 project cards with real AI-generated images, province/status badges, developer info, price range, description snippet.
    - Filters: useMemo for reactive filtering with badge count.
    - CTA section + E-E-A-T disclaimer + footer.
    - Rendered by `ProjectLandingPage` when no slug (fallback from "not found" to directory).
- **Server-side JSON-LD expanded (`server/seo/metaInjector.ts`)**:
    - Homepage (`''` and `'home'` routes): Added `FAQPage` (8 Q&As matching HOME_FAQ) + `ItemList` (6 FEATURED_PROJECTS) to @graph. Updated title/desc to reflect distributor identity.
    - New `'du-an'` route: `BreadcrumbList` + `ItemList` (11 projects) + `RealEstateAgent`. Route lookup: `/du-an` → fullKey `'du-an'` → exact match in STATIC_PAGE_META.

## External Dependencies

- **Database**: PostgreSQL
- **Real-time**: Socket.io, Yjs + y-websocket
- **Queue**: QStash (Upstash) with in-memory fallback
- **AI**: Google Gemini (via `@google/genai`)
- **Email**: Brevo API (primary), Nodemailer (SMTP fallback), console (fallback)
- **Object Storage**: Replit Object Storage (production), local disk (development fallback)
- **Geolocation**: ip-api.com
- **Text Extraction**: pdf-parse, mammoth (for PDF and DOCX)
- **Redis**: Optional, for job queues and multi-instance scaling
- **Social Media Integration**: Facebook Webhooks, Zalo OA Webhooks
## B2B Page Audit (April 19, 2026)
- Verified 4 deployed B2B private pages: `/dashboard`, `/inventory`, `/leads`, `/billing`. All render correctly with Vietnamese UI labels (sidebar: Trang Chủ, Tổng Quan, Sàn Giao Dịch, Khách Hàng (CRM), Hợp Đồng, Kho Bất Động Sản, Hộp Thư Đa Kênh, BĐS Quan Tâm, Phê Duyệt, Luật Phân Bổ Lead, Đăng xuất). No undefined/NaN, no English literals, no untranslated strings. All pages use `useTranslation` (40–130 calls per page).
- Fixed Billing currency bug: plan price and CSV invoice amount now use `formatCurrency(...)` (renders VND) instead of hard-coded `$` symbol (`pages/Billing.tsx` lines 102, 198).
- **Orphaned file**: `pages/Projects.tsx` exists in the repo but is **NOT registered** in `PAGE_REGISTRY` / `config/routes.ts` and is not imported anywhere. Visiting `/projects` shows a blank shell. Decide: either wire it up (add `PROJECTS: 'projects'` to `ROUTES` and `[ROUTES.PROJECTS]: Projects` to `PAGE_REGISTRY`) or delete the file.
