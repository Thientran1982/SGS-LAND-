# SGS Land — Mobile App (Buyer)

Expo SDK 52 + Expo Router app for the buyer side of the SGS Land marketplace
(`sgsland.vn`). This is **Phase 1** delivery: discovery, search, listing detail,
local favorites, and lead capture against the existing public REST API.

> **Status:** Sprint 0 (Foundation) + Sprint 1 (Discovery & Search) +
> Sprint 2 (Detail + Lead) of [Task #51](../../.local/tasks/task-51.md)
> are complete. Sprints 3-7 (buyer auth, push, messaging, booking + VNPay,
> Store submission) are tracked as follow-up tasks — they require backend
> work that does not exist yet.

## Stack

- **Expo SDK 52** with the New Architecture enabled
- **Expo Router 4** (file-based routing in `app/`)
- **TanStack Query 5** for server state, caching, and infinite scroll
- **expo-image** for memory- and disk-cached imagery
- **AsyncStorage** for anonymous favorites (will gain server sync in Sprint 3)
- **expo-secure-store** wired (used by future buyer JWT in Sprint 3)
- Pure React Native StyleSheet — no NativeWind / Tailwind RN. Design tokens
  in `src/theme/tokens.ts` mirror the web palette so future white-label can
  override `accent` per CĐT branding.

## Structure

```
apps/mobile/
├── app/                       # Expo Router routes
│   ├── _layout.tsx            # Root: QueryClientProvider, gesture root
│   ├── (tabs)/                # Tab navigator
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Khám phá (Discover feed)
│   │   ├── search.tsx         # Tìm kiếm + filters
│   │   ├── favorites.tsx      # Yêu thích (local AsyncStorage)
│   │   └── account.tsx        # Tài khoản (login placeholder + hotline)
│   ├── bds/[slugId].tsx       # Listing detail + lead form + similar
│   └── +not-found.tsx
├── src/
│   ├── api/                   # fetch client + listings endpoints + types
│   ├── components/            # ListingCard, Skeleton, EmptyState
│   ├── storage/               # favorites.ts (AsyncStorage)
│   ├── theme/tokens.ts        # design tokens
│   └── utils/format.ts        # VND, slug, phone validation
├── app.json                   # Expo config (bundle id, scheme, plugins)
├── eas.json                   # EAS build profiles
└── package.json
```

## Getting started

```bash
cd apps/mobile
npm install            # ~3-5 min, ~500MB (separate node_modules from root)
cp .env.example .env   # then edit EXPO_PUBLIC_API_BASE_URL if needed
npm run start          # opens Expo dev server, scan QR with Expo Go
```

By default the app talks to `https://sgsland.vn`. To point at a Replit
workspace dev URL during development:

```bash
EXPO_PUBLIC_API_BASE_URL=https://<your-repl>.replit.dev npm run start
```

### Type check

```bash
npm run lint   # tsc --noEmit
```

## Backend endpoints consumed

All public — no auth required:

| Endpoint                                       | Used by                  |
| ---------------------------------------------- | ------------------------ |
| `GET  /api/public/listings` (cursor + filters) | Discover, Search         |
| `GET  /api/public/listings/locations`          | Search location chips    |
| `GET  /api/public/listings/:slugId`            | Listing detail           |
| `GET  /api/public/listings/:slugId/similar`    | Listing detail (related) |
| `POST /api/public/listings/:id/leads`          | Listing detail lead form |

Lead submissions are deduped server-side on `(phone, listing_id)` for 24h
and rate-limited to 5/hour/IP — no client-side throttling needed.

## Universal links

`app.json` declares:
- iOS: `applinks:sgsland.vn`
- Android intent filter for `https://sgsland.vn/bds/*`

Web users tapping a `/bds/<slug>-<uuid>` link will open the app (when
installed) on the correct detail screen. The web `apple-app-site-association`
and Digital Asset Links files must be deployed alongside the marketplace —
tracked in Sprint 7 (Store submission).

## Build / submit

```bash
npx eas-cli login
npx eas-cli build --profile preview --platform ios   # Internal TestFlight
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform all
npx eas-cli submit --profile production --platform ios     # needs $99/y Apple Dev
npx eas-cli submit --profile production --platform android # needs $25 Google Play
```

App identifiers (set once in `app.json`):
- iOS bundle: `vn.sgsland.mobile`
- Android package: `vn.sgsland.mobile`

## Roadmap (next sprints)

| Sprint | Scope                                                   | Blocked by                   |
| ------ | ------------------------------------------------------- | ---------------------------- |
| 3      | Buyer Account (OTP login, server-synced favorites)      | Backend: buyer auth + OTP    |
| 4      | Push notifications (price drops, lead replies)          | Backend: notif tokens table  |
| 5      | In-app messaging (buyer ↔ vendor)                       | Backend: thread API          |
| 6      | Booking + VNPay deposit flow                            | Backend: booking + VNPay int |
| 7      | App Store + Google Play submission                      | Apple Dev $99, Google $25    |

## Production assets (required before EAS build)

The dev build uses Expo's default placeholder icon/splash. Before a production
EAS build, drop the following PNGs into `apps/mobile/assets/` and add the
matching fields back to `app.json`:

- `icon.png` — 1024×1024, app icon
- `splash.png` — 1284×2778 (or any tall canvas), splash screen
- `adaptive-icon.png` — 1024×1024 foreground for Android adaptive icon

Then re-add to `app.json`:

```json
"icon": "./assets/icon.png",
"splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#0F172A" },
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#0F172A" } },
"web": { "favicon": "./assets/icon.png" }
```

## First-run smoke checklist

After `npm install && npx expo start`:

1. App boots to Home tab with featured + recent listings.
2. Tap a listing → detail screen opens with gallery + specs.
3. Submit lead form with valid VN phone (e.g. `0971132378`) → success toast.
4. Tap heart on a card → appears in Favorites tab.
5. Search tab: type a keyword, change city filter → list updates.
