# SGS LAND — Next.js App Router (SSR/SSG)

Nền tảng quản lý & phân phối bất động sản AI số 1 Việt Nam.  
Migration từ CSR (Vite + React) sang **Next.js 15 App Router** với SSR/SSG/ISR.

## 🚀 Tech Stack

- **Next.js 15.3** — App Router, SSR/SSG/ISR
- **React 19** — Server & Client Components  
- **TailwindCSS v4** — Design tokens, dark mode
- **TanStack Query v5** — Data fetching & caching
- **TypeScript 5.8** — Strict mode
- **Framer Motion** — Animations
- **next-themes** — Dark/light mode

## 📁 Cấu trúc

```
app/
├── (public)/          # Public routes — SSG/SSR/ISR
│   ├── page.tsx       # Landing (SSG, revalidate 1h)
│   ├── marketplace/   # Search (SSR force-dynamic)
│   ├── du-an/[slug]/  # Project detail (ISR 6h)
│   ├── p/[code]/      # Mini-site project (ISR 5min)
│   ├── bds/[slug]/    # Listing detail (SSR)
│   └── ...            # About, Contact, Careers, Legal...
├── (private)/         # Auth-required — CSR
│   └── dashboard, leads, contracts, inbox...
├── login/             # Login page
└── layout.tsx         # Root layout + metadata + JSON-LD

components/
├── public/            # Header, Footer, AiChatWidget, pages...
├── private/           # Dashboard shell
└── shared/            # QueryClient + ThemeProvider

middleware.ts          # JWT auth guard
lib/api.ts             # API client (publicApi, authApi, crmApi)
config/routes.ts       # Route constants
```

## 🏃 Chạy locally

```bash
# 1. Cài dependencies
npm install

# 2. Tạo .env.local
cp .env.example .env.local
# Sửa NEXT_PUBLIC_API_URL=http://localhost:5000

# 3. Dev server (Turbopack)
npm run dev

# 4. Build production
npm run build
npm run start
```

## 🌐 Render Strategy

| Route | Strategy | Revalidate |
|-------|----------|------------|
| `/` `/about-us` `/careers` | SSG | ∞ |
| `/bat-dong-san-*` (6 trang) | SSG+ISR | 1h |
| `/du-an/[slug]` | ISR | 6h |
| `/p/[code]` (mini-site) | ISR | 5min |
| `/lai-suat-ngan-hang` | ISR | 24h |
| `/marketplace` `/bds/[slug]` | SSR | dynamic |
| `/dashboard` `/leads`... | CSR | - |

## 🔗 Backend

Express backend chạy trên port 5000 — được proxy qua `next.config.ts`:

```
/api/* → http://localhost:5000/api/*
/socket.io/* → http://localhost:5000/socket.io/*
```

## 🤖 AI Agents (MCP)

Kết nối với [sgsland-mcp](../sgsland-mcp) — 8 AI Agents, 27 tools:
- **Agent 1**: Marketplace Listing (4 tools)
- **Agent 2**: AVM Valuation (3 tools)  
- **Agent 3**: Legal Compliance (3 tools)
- **Agent 4**: Market Intelligence (3 tools)
- **Agent 5**: Project Analyzer (3 tools)
- **Agent 6**: CRM B2B (3 tools)
- **Agent 7**: Live Chat Engine (4 tools)
- **Agent 8**: Dynamic Data Sync (4 tools)

---

**SGS LAND** — [sgsland.vn](https://sgsland.vn) | Hotline: 0971 132 378
