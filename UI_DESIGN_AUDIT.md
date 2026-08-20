# SGS LAND — UI Design System Audit

**Audit date:** 2026-08-20  
**Scope:** màu sắc, màu nút chức năng, màu chữ, font, cỡ chữ, dark mode và tính nhất quán trên CRM/Vite, public Next.js, auth, dashboard và shared components.  
**Method:** source scan, token inventory, representative page review, semantic-token migration và runtime/typecheck verification.

## Executive summary

The application has a useful semantic-token foundation, but it is not yet the single source of truth. Four visual systems currently coexist:

1. `--sgs-*` brand/application tokens.
2. `--bg-*`, `--glass-*`, `--text-*` CRM tokens.
3. `--lp-*` public landing-page tokens.
4. `--cw-*` chat-widget scoped tokens.

On top of these tokens, many pages use literal Tailwind palettes (`slate`, `rose`, `emerald`, `indigo`, `amber`, `sky`), inline hex/RGB values, and locally composed buttons. Typography is also split between Fraunces, Be Vietnam Pro, IBM Plex Mono, Noto Serif, JetBrains Mono and browser/system fallbacks.

**Overall status: Semantic palette consolidated for the audited high-traffic routes.** Legacy utility markup is covered by semantic adapters while lower-traffic screens are migrated.

## Priority matrix

| Priority | Finding | Impact | Main surfaces |
|---|---|---|---|
| P0 | Public proxy/app URL can be confused with a port-specific URL | Users see “couldn't reach this app” before UI loads | Replit preview, all routes |
| P1 | No shared button primitive or semantic state contract | Primary/secondary/danger actions differ in color, radius, height, shadow and disabled behavior | Auth, header/footer, listing, CRM |
| P1 | Multiple typography families and mono implementations | Visual hierarchy changes between public, CRM and audit screens | Public header, landing, dashboard, security |
| P1 | Muted/faint text is not centrally contrast-tested per theme | Small labels and technical metadata can fall below WCAG AA | Dark mode, dashboard, login |
| P2 | Hard-coded colors bypass tokens | Theme changes and brand updates require page-by-page edits | Charts, maps, public pages, admin pages |
| P2 | Custom micro type scale is heavily used without semantic roles | Labels become too small and inconsistent on dense screens | `text-2xs`, `text-3xs`, `text-xs2`, `text-xs3` |
| P2 | Focus rings and interactive states use arbitrary colors | Keyboard accessibility and brand consistency drift | `TopicSelect`, auth, controls |
| P3 | Repeated route wrappers inherit inconsistencies from shared templates | Fixes are duplicated or hard to reason about | ~70 public route families |

## 1. Token inventory

### 1.1 Public SGS tokens

Defined in `styles/globals.css:25-60`.

Light tokens include:

- `--sgs-bg: #FFFFFF`
- `--sgs-surface: #FFFFFF`
- `--sgs-primary: #1B3A5C`
- `--sgs-primary-deep: #0F2740`
- `--sgs-accent: #C8963E`
- `--sgs-accent-text: #8C6420`
- `--sgs-text: #16202B`
- `--sgs-text-muted: #5C6B7A`
- `--sgs-text-heading: #1B3A5C`
- `--sgs-verified: #1E7F5C`
- `--sgs-on-dark-muted: #93A6B8`
- `--sgs-border: rgba(27,58,92,.12)`

Dark tokens are defined in the same file and use lighter blue/gold/green variants. This is a good semantic direction, but the tokens overlap in purpose with the CRM tokens below.

### 1.2 CRM/glass tokens

Also defined in `styles/globals.css:44-85`.

- Surface: `--bg-app`, `--bg-surface`, `--bg-sidebar`
- Layer: `--glass-surface`, `--glass-surface-hover`, `--glass-border`
- Text: `--text-primary`, `--text-secondary`, `--text-tertiary`
- Fonts: `--font-display`, `--font-ui`, `--font-mono`

The names imply glassmorphism even where the newer quiet dashboard no longer uses glass. Renaming these to neutral semantic roles would reduce coupling between a visual treatment and a design token.

### 1.3 Landing-page tokens

Defined in `styles/globals.css:238-255`:

- `--lp-bg`, `--lp-paper`, `--lp-ink`, `--lp-muted`, `--lp-soft`
- `--lp-hair`, `--lp-line`, `--lp-navy`, `--lp-gold`, `--lp-ok`
- `--lp-shadow`, `--lp-cardbg`, `--lp-navbg`

These are valid for a branded marketing surface, but they duplicate the public SGS palette. For long-term consistency, `--lp-*` should alias the canonical brand tokens where the semantic meaning is the same.

### 1.4 Chat-widget tokens

Defined in `styles/globals.css:283-296`:

- `--cw-navy`, `--cw-parchment`, `--cw-paper`, `--cw-gold`
- `--cw-ink`, `--cw-ink-dim`, `--cw-line`, `--cw-recording`

Scoped chat tokens are reasonable because the widget is an independently styled product surface. The widget should still consume canonical status/focus tokens instead of inventing separate success/error/focus colors.

### 1.5 Dashboard aliases

`styles/globals.css:306-313` adds dashboard aliases. This is directionally correct. The remaining work is to make other high-traffic surfaces consume the same semantic roles instead of adding route-specific aliases.

## 2. Color and contrast findings

### P1 — duplicated semantic palettes

The same conceptual roles have several values:

- Primary brand: `--sgs-primary`, `--lp-navy`, CRM primary utilities, arbitrary `blue/indigo/slate`.
- Accent: `--sgs-accent`, `--lp-gold`, `--cw-gold`, arbitrary `amber`.
- Success: `--sgs-verified`, `--lp-ok`, arbitrary `emerald/green`.
- Muted text: `--sgs-text-muted`, `--text-secondary`, `--text-tertiary`, `--lp-muted`, `--lp-soft`.
- Borders: `--sgs-border`, `--glass-border`, `--lp-hair`, `--lp-line`, arbitrary `slate-*`.

This makes a theme change non-deterministic: some screens update via variables while others remain visually unchanged.

### P1 — muted text and small labels

The combination of custom micro sizes and muted tokens is a contrast risk. The most sensitive places are:

- dashboard technical metadata and activity timestamps;
- security/audit IDs and table labels;
- login helper text and OTP instructions;
- public footer/legal metadata;
- dark mode tertiary labels.

Every text token should be tested at the actual background it is used on, not only against the root background. In particular, `--text-tertiary`, `--ink-faint`-like roles, and text over translucent surfaces require separate checks.

### P2 — hard-coded color usage

Representative sources found in the audit:

- `pages/Dashboard.tsx` had chart colors and utility palette literals; the dashboard redesign removed the known chart hex literals, but the wider repository still contains arbitrary palette use.
- `apps/nextjs/components/public/PublicHeaderNav.tsx` and `PublicFooter.tsx` contain local color choices instead of consistently consuming tokens.
- `apps/nextjs/components/public/TopicSelect.tsx` now uses the canonical focus token.
- `pages/SecurityCompliance.tsx` mixes semantic colors with local slate/rose/emerald utility colors.
- `pages/ListingDetail.tsx` and `apps/nextjs/components/public/ListingDetailPage.tsx` use independent inline and utility color conventions.

### P2 — state colors are not standardized

Error, warning, success, info, disabled and focus states now resolve through the shared status contract:

```text
action-primary
action-secondary
action-danger
state-success
state-warning
state-error
state-info
focus-ring
text-disabled
border-subtle
```

### 2.1 Final canonical color table

| Role | Light | Dark |
|---|---|---|
| Brand / primary | `#1B3A5C` | `#A9C7E5` |
| Brand strong | `#0F2740` | `#7FA8D0` |
| Accent | `#C8963E` | `#D4A855` |
| App background | `#F7F9FA` | `#0E1620` |
| Surface | `#FFFFFF` | `#16222F` |
| Text | `#16202B` | `#E8ECF1` |
| Secondary text | `#4C6471` | `#AEC1C6` |
| Muted / disabled | `#5C6B7A` / `#71838D` | `#9AAAB8` / `#80969D` |
| Success | `#1E7F5C` | `#59D19D` |
| Warning | `#8C6420` | `#F0C978` |
| Danger | `#B42318` | `#FF8A80` |
| Info / focus | `#1B5E8A` | `#8DC7F0` |

Approved exceptions are map/chart series, property-photo overlays, and the
chat widget's independent navy/gold brand treatment. Chat state colors still
use canonical semantic status and focus tokens.

## 3. Button and functional-control audit

There is no shared Button primitive across the audited surfaces. Buttons are locally composed in:

- `pages/Leads.tsx:1042,1185`
- `pages/SecurityCompliance.tsx:52,177`
- `pages/Login.tsx:584-585,608-612`
- `apps/nextjs/components/public/LoginView8.tsx:1369`
- `apps/nextjs/components/public/ListingDetailPage.tsx:79-80`
- `apps/nextjs/components/public/TopicSelect.tsx:42-80`

Observed differences:

- radius: `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`;
- height/padding: `py-1.5` through `py-4`;
- primary fills: navy, slate, white, gold, and local dark surfaces;
- hover: background replacement, opacity, border, or no visible change;
- disabled: inconsistent opacity and cursor treatment;
- motion: inconsistent `active:scale-*`;
- focus: different ring colors and widths;
- icon sizing and text alignment are not standardized.

### Recommended functional-control contract

Create one shared primitive with variants:

```text
primary     filled navy, white text
secondary   transparent/surface, token border
accent      gold reserved for one high-priority action
danger      semantic error color
ghost       no border, token hover surface
link        text-only action with underline/focus state
```

Use one minimum control height for normal actions, a smaller explicit compact variant for tables, and a touch-safe minimum for mobile. Do not use gold on every action; reserve it for the single most important action in a region.

## 4. Typography audit

### Current families

The repository currently uses:

- Fraunces: intended display/hero family.
- Be Vietnam Pro: intended UI family.
- IBM Plex Mono: CSS token for metrics and technical labels.
- Noto Serif: used by parts of the public header.
- JetBrains Mono: used by Tailwind `font-mono` in the current config.
- Georgia/system fallbacks in public and legacy components.

The key inconsistency is that `font-mono` resolves to a different family than `--font-mono`. IDs and metrics therefore look different depending on whether a component uses a utility class or the CSS variable.

### High-risk sources

- `apps/nextjs/components/public/PublicHeaderNav.tsx:102,131` uses Noto Serif/Be Vietnam conventions.
- `apps/nextjs/components/public/LandingHome.tsx:11-13,217-253,327,393` defines `.lp-serif`, `.lp-sans`, `.lp-mono` and inline sizes.
- `pages/Dashboard.tsx:78,94,112,116,125,130` uses `font-mono` for technical values.
- `pages/SecurityCompliance.tsx:42,125,195,229` uses `font-mono`.
- `pages/ListingDetail.tsx:72,971-976` uses `font-mono`.
- `apps/nextjs/components/public/LoginView8.tsx` contains dense custom micro-label sizes.

### Size risks

The custom Tailwind scale in `tailwind.config.js:22-40` adds `text-2xs`, `text-3xs`, `text-xs2` and `text-xs3`. These are heavily used in:

- `pages/Dashboard.tsx:36,78,145-146`
- `pages/SecurityCompliance.tsx:158,168,195`
- `apps/nextjs/components/public/LoginView8.tsx:1174,1182,1187,1223,1231`

Some are appropriate for technical metadata, but there is no documented semantic rule distinguishing metadata from readable body copy. This creates a risk of labels below a comfortable reading size, especially on mobile and in dark mode.

### Recommended type roles

Define semantic roles rather than adding more one-off sizes:

```text
display-xl    Fraunces, page hero
heading-lg    Fraunces, page/section heading
heading-md    Be Vietnam Pro, subsection heading
body          Be Vietnam Pro, normal copy
label         Be Vietnam Pro, controls and form labels
kicker        IBM Plex Mono, uppercase technical label
metric        IBM Plex Mono, numbers and deltas
caption       Be Vietnam Pro, supporting copy
```

The roles should map to a documented minimum size and line-height at mobile and desktop. `font-mono` should be remapped to IBM Plex Mono or replaced by an explicit semantic class.

## 5. Page and shared-component findings

### Highest priority

1. `apps/nextjs/components/public/PublicHeaderNav.tsx`  
   Shared across public pages; local font/color choices amplify across every route.
2. `apps/nextjs/components/public/PublicFooter.tsx` and `components/PublicFooter.tsx`  
   Repeated footer text and links use local sizes/colors rather than one footer contract.
3. `pages/Login.tsx` and `apps/nextjs/components/public/LoginView8.tsx`  
   Two auth surfaces must visually agree; buttons, OTP fields, helper text, dark mode and error states are especially sensitive.
4. `pages/ListingDetail.tsx` and `apps/nextjs/components/public/ListingDetailPage.tsx`  
   High-information screens with independent button, price, metadata and badge styling.
5. `pages/Dashboard.tsx`  
   Recently redesigned toward semantic tokens; remaining shared components and chart/status states should be used as the reference implementation.
6. `pages/SecurityCompliance.tsx`  
   Dense tables and technical content expose the typography and muted-text risks.

### Lower-risk / positive examples

- `apps/nextjs/components/public/TopicSelect.tsx:42-80` uses semantic variables for surface, border, text and selected state.
- `apps/nextjs/components/public/ProjectDetailPage.tsx:61,91,99,106,115-120` is mostly token-based.
- `apps/nextjs/components/public/UserGuideView.tsx:462-608` uses semantic text variables in most content areas.
- `apps/nextjs/app/(public)/layout.tsx:14-21` correctly centralizes providers, header, footer and chat widget.

## 6. Cross-page architecture observations

- Public Next.js and private CRM/Vite share a workspace but not a fully unified UI contract.
- The public layout is centralized, but individual shared components still bypass tokens.
- Approximately 70 public route families inherit style decisions from shared templates; fixing templates is more effective than editing route wrappers.
- Existing `services/themeConfig.ts` / `services/theme.tsx` should be treated as the theme configuration authority. There is no `services/themeConfig.tsx`.
- The actual shared navigation module is `components/Navigation.tsx`; there is no `components/CommandCenter/Navigation` path.

## 7. Recommended remediation sequence

### Phase 1 — establish the contract

1. Consolidate brand, surface, text, border and status tokens into one semantic namespace.
2. Keep route-specific aliases only where the surface genuinely needs independent branding.
3. Make `font-mono` and `--font-mono` resolve to IBM Plex Mono consistently.
4. Document the type roles and minimum readable sizes.
5. Add a contrast-check script/page for light and dark token combinations.

### Phase 2 — shared primitives

1. Add shared `Button`, `IconButton`, `Badge`, `Input`, `Select` and `FocusRing` primitives.
2. Migrate `PublicHeaderNav`, both footers and both login views first.
3. Standardize hover, active, disabled, loading and keyboard focus states.
4. Keep the dashboard as the visual reference for quiet CRM surfaces.

### Phase 3 — page families

1. Migrate listing detail and marketplace templates.
2. Migrate security/audit and other dense admin pages.
3. Migrate remaining CRM pages by shared patterns rather than route-by-route color replacement.
4. Remove arbitrary palette usage once the semantic primitive exists.

### Phase 4 — verification

1. Run screenshots at 375px, 768px, 1024px and 1440px.
2. Verify light/dark and VI/EN on every shared surface.
3. Keyboard-test every functional control.
4. Check focus indicators and contrast for normal, hover, disabled and error states.
5. Add a lint rule or review check for new hard-coded UI colors outside token definitions.

## 8. Separate infrastructure finding

The screenshot showing “Hmm... We couldn't reach this app” was caused by opening the Replit development domain with `:5000`. The configured webview maps the local `5000` process to the default HTTPS domain; the correct public preview URL does not include `:5000`. This is unrelated to the UI color/font audit.

## Implemented in this migration

- Added the canonical `--ui-*` semantic contract for light and dark mode in both `styles/globals.css` and `apps/nextjs/app/globals.css`.
- Kept legacy variables as compatibility aliases so existing pages do not lose behavior during migration.
- Unified Tailwind `sans`, `display`, `serif` and `mono` mappings to Be Vietnam Pro, Fraunces and IBM Plex Mono.
- Removed unused Inter, JetBrains Mono and Noto Serif font loading from the Next.js root layout and the Vite document font links.
- Added shared `Button`, `IconButton`, `Field` and `Badge` primitives in `components/ui.tsx`.
- Added shared states for primary, secondary, accent, danger, ghost, link, loading, disabled and keyboard focus.
- Connected shared public footer/header surfaces to the canonical tokens.
- Remapped landing-page and chat-widget font/color aliases to the canonical contract.
- Raised the legacy micro-size aliases to readable semantic values while keeping their class names for non-breaking migration.

## Verification

- `npm run lint` passed during the audit session.
- `npm run lint` passed.
- `cd apps/nextjs && npm run type-check` passed.
- `cd apps/nextjs && npm run build` passed, generating all 114 routes.
- `git diff --check` passed.
- Workflow restart succeeded; `/` and `/login` returned HTTP 200 and were visually inspected after restart.
- The remaining Socket.IO proxy timeout and invalid QStash token are pre-existing runtime/infrastructure concerns, not caused by this design-system migration.