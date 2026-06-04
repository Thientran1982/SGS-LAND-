---
name: Next.js 15.5 prerender fix
description: How to prevent OuterLayoutRouter.useContext null crash during /_not-found static prerender in Next.js 15.5
---

## Rule
Add `export const dynamic = "force-dynamic"` to `app/layout.tsx` (the root layout).

## Why
Next.js 15.5's new prerender phase uses a restricted React dispatcher (ContextOnlyDispatcher / null). The built-in `/_not-found` route is always statically prerendered regardless of `force-dynamic` on the custom `not-found.tsx`. During that prerender, Next.js's own `OuterLayoutRouter` calls `useContext(LayoutRouterContext)` — if the React dispatcher is null at that point (caused by any "use client" ancestor), it crashes with `TypeError: Cannot read properties of null (reading 'useContext')`.

**How to apply:** Root layout `force-dynamic` makes `_not-found` use standard SSR, bypassing the prerender. All user pages under `(public)` and `(private)` route groups already had their own `force-dynamic`, so there is no net performance change for them.

## Providers pattern
With root layout `force-dynamic`, it is safe to use full `useState`-based providers (`QueryClientProvider` + `ThemeProvider`) in group layouts. Standard SSR treats `useState` as returning the initial value and `useEffect` as a no-op — no crash, no bailout template, no #418.

Pattern used:
- `components/shared/Providers.tsx` — `"use client"`, `useState(() => new QueryClient())`, `QueryClientProvider` + `ThemeProvider`
- `(public)/layout.tsx` — wraps content with `<Providers>`, has `force-dynamic`
- `(private)/layout.tsx` — wraps `<CrmShell>` with `<Providers>`, has `force-dynamic`
- `app/layout.tsx` — `force-dynamic` only, no Providers (not-found page doesn't need QueryClient)
