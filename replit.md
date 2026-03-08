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

## Entry Points

- `server.ts` - Express + Vite server entry
- `App.tsx` - React frontend entry
- `server/db.ts` - PostgreSQL schema and RLS setup
- `server/queue.ts` - BullMQ webhook queue
- `server/ai.ts` - AI service routes

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (optional; app runs without it)
- `REDIS_URL` - Redis connection URL (optional; falls back to in-memory)
- `GEMINI_API_KEY` or `API_KEY` - Google Gemini API key for AI features
- `JWT_SECRET` - JWT signing secret (defaults to a hardcoded key)
- `FB_VERIFY_TOKEN` - Facebook webhook verification token

## Dev Credentials

- Email: `admin@sgs.vn`, Password: `admin` (or any password `123456`)

## Scripts

- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - TypeScript type check
