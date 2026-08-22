# Signed-in Overview responsive QA

Date: 2026-08-22

## Coverage

| Surface | Result | Notes |
| --- | --- | --- |
| 1280px+ | Ready for signed-in pass | Overview uses the 12-column desktop grid; two-column and three-column blocks retain their spans. |
| 768–1279px | Ready for signed-in pass | Overview switches to a two-column grid and collapses the workbench chart/sidebar layout at 900px. |
| Under 768px | Ready for signed-in pass | Overview uses one column; KPI cards remain two-up through 640px, then controls and footer stack. |
| Light theme | Reviewed in implementation | Dashboard surfaces and chart tooltip use semantic theme tokens. |
| Dark theme | Reviewed in implementation | Dashboard surfaces and chart tooltip use semantic theme tokens; no route/sidebar changes. |
| Loading / empty / error-retry | Automated | Dashboard and funnel branches preserve loading, empty, and retryable error states. |
| Chart tooltip | Hardened and automated | Tooltip content now wraps within the viewport on narrow screens and long localized labels. |
| Keyboard focus | Reviewed in implementation | Dashboard controls, links, and assistant controls expose visible `:focus-visible` states. |
| Guide assistant overlay | Reviewed in implementation | Responsive fixed panel and trigger remain within the viewport sizing rules. |

## Validation

- `npm test -- --run src/test/Dashboard.test.tsx` — 8 tests passed.
- `npm run lint` — passed.
- `git diff --check` — passed.
- Preview smoke check — app starts and the unauthenticated boundary renders.

## Release verification run

Date: 2026-08-22

- The configured application workflow restarted successfully. The public preview rendered cleanly at 1280×720, and `/dashboard` returned the expected unauthenticated redirect (307); no signed-in Overview was available.
- The responsive implementation remains covered for desktop (1280px+), tablet (768–1279px), and mobile (under 768px) through the CSS review and component tests above. No sidebar, route, or analytics API contract changes were present in the working tree.
- The browser-based device check remains blocked: Chromium fails before launching because `libglib-2.0.so.0` is unavailable. A real authenticated account and physical-device pass are still required before release.
- No device-specific visual regression was observed in the available preview; this is not a substitute for the blocked signed-in pass.

## Release limitation

This environment does not provide a usable authenticated account, and the task’s Playwright browser cannot launch because a required system library is unavailable. Consequently, a real-account interaction pass across physical device sizes remains a release follow-up; this record covers the available responsive implementation review, component state tests, and preview smoke check.

## Release verification run (2026-08-22)

- Focused Overview tests: `npm test -- --run src/test/Dashboard.test.tsx` — 8 tests passed.
- TypeScript validation: `npm run lint` — passed.
- Formatting check: `git diff --check` — passed.
- Preview smoke check: the configured `Start application` workflow restarted successfully and served the public site cleanly at 1280×720; no browser console errors were reported.
- Route boundary check: `GET /dashboard` returned `307` with `Location: /login?redirect=%2Fdashboard`, confirming that this environment has no signed-in session available for the Overview route.
- Browser/device limitation: Chromium could not launch because `libglib-2.0.so.0` is unavailable. Therefore desktop, tablet, and mobile authenticated interaction checks—including themes, state transitions, chart tooltip, keyboard focus, sidebar/routes, analytics requests, and Guide assistant behavior—remain unverified with a real account. No device-specific regression was observable in the available unauthenticated preview.