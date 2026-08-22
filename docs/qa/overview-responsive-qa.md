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

## Release limitation

This environment does not provide a usable authenticated account, and the task’s Playwright browser cannot launch because a required system library is unavailable. Consequently, a real-account interaction pass across physical device sizes remains a release follow-up; this record covers the available responsive implementation review, component state tests, and preview smoke check.