# Signed-in Overview responsive QA

Date: 2026-08-22

## Coverage

### Reproducible signed-in fixture

The authenticated pass is now isolated from shared accounts. `tests/fixtures/overview-fixture.ts`
intercepts the auth, analytics, visitor, and Guide assistant requests inside each Playwright
browser context and returns deterministic seeded data. It uses no credentials and does not write
to the database. Run the full responsive evidence suite with:

```sh
npm run test:e2e -- --project=overview-desktop --project=overview-tablet --project=overview-mobile
```

Each run writes screenshots and `overview-request-trace.json` under `test-results/overview/`;
Playwright HTML output is written to `playwright-report/`. CI should retain both directories as
release artifacts. Failed runs also retain Playwright traces. The fixture's `.invalid` email is
display data only and is never submitted to the application.

The CI release job installs Chromium and its required Linux libraries with
`npx playwright install --with-deps chromium`. Before the responsive suite starts,
`scripts/verify-playwright-runtime.mjs` launches and closes a headless browser. If a system
dependency is missing, the preflight stops the suite and prints the install command plus the
browser launch error, rather than reporting a misleading test failure. CI retains both
`test-results/overview/` and `playwright-report/` for every run.

The suite also starts the Overview in a seeded analytics error state, verifies the visible retry
branch, and confirms that the seeded data returns after retry. The same tests run in all three
viewport projects, so responsive evidence is produced independently for desktop, tablet, and
mobile.

### Deployed-build verification

The local CI release job verifies the application started by the workflow. The
`overview-deployed` job runs the same fixture and viewport projects against a deployed origin:

```sh
BASE_URL=https://your-deployment.example npm run test:e2e:overview
```

For GitHub Actions, set the repository variable `DEPLOYMENT_URL`, or manually dispatch the
workflow with its `deployment_url` input (the input takes precedence). The job first runs the
browser runtime preflight, then checks that the deployment responds, and only then runs the
responsive suite. This makes failures actionable:

| Failure message/category | Meaning |
| --- | --- |
| `Deployment reachability` | The URL is missing, unavailable, or cannot be reached from the runner. |
| Browser preflight / launch error | Chromium or a required Linux dependency cannot start; this is not an Overview assertion result. |
| `Overview assertion` | The deployed page was reachable and Chromium started, but the seeded Overview behavior failed. |

Every deployed-build run uploads the same `test-results/overview/` screenshots and request traces
plus the `playwright-report/` HTML report. It also uploads `deployment-url.txt`, which records the
tested URL, commit, workflow, and run ID alongside that evidence. The fixture and artifact paths
are intentionally shared with the local release job so evidence can be compared directly.

In this environment, TypeScript validation passed and Playwright enumerated all six fixture
checks, but execution was blocked before page creation because Chromium could not load the
system library `libglib-2.0.so.0`. This is an environment prerequisite failure; CI with the
browser runtime installed will execute the checks and publish the evidence described above.

| Surface | Result | Notes |
| --- | --- | --- |
| 1280px+ | Blocked: no signed-in session | Unauthenticated preview rendered at 1280×720; the Overview’s 12-column desktop grid and span rules were verified in implementation. |
| 768–1279px | Blocked: browser unavailable | The two-column grid and the workbench collapse at 900px were verified in implementation; authenticated tablet interaction could not be launched. |
| Under 768px | Blocked: browser unavailable | The one-column grid, two-up KPI cards through 640px, and stacked controls/footer were verified in implementation; authenticated mobile interaction could not be launched. |
| Light theme | Blocked: no signed-in session | Semantic light-theme tokens are present for Dashboard surfaces and chart tooltips; runtime theme switching needs an authenticated browser pass. |
| Dark theme | Blocked: no signed-in session | Semantic dark-theme tokens are present for Dashboard surfaces and chart tooltips; runtime theme switching needs an authenticated browser pass. |
| Loading / empty / error-retry | Passed in component tests | Dashboard and funnel branches preserve loading, empty, and retryable error states. |
| Chart tooltip | Passed in implementation review | Tooltip content uses the responsive tooltip class and localized values; pointer interaction needs an authenticated browser pass. |
| Keyboard focus | Passed in implementation review | Dashboard controls, links, and assistant controls expose visible `:focus-visible` states; tab traversal needs an authenticated browser pass. |
| Sidebar / routes | Blocked: no signed-in session | Route links remain present and unchanged; authenticated navigation could not be exercised. |
| Analytics requests | Blocked: no signed-in session | Analytics query wiring remains in place and component tests pass; request/response behavior needs an authenticated browser pass. |
| Guide assistant overlay | Blocked: no signed-in session | Responsive fixed panel, trigger, keyboard-visible focus, retry error, and scoped source display are implemented; authenticated interaction could not be launched. |

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

## Release disposition

**Not signed off: authenticated device pass unavailable.** The implementation and focused automated checks are green, but this environment still cannot provide the signed-in session and browser prerequisites required to produce desktop, tablet, and mobile Overview evidence.

## Release limitation

This environment does not provide a usable authenticated account, and the task’s Playwright Chromium browser cannot launch because `libglib-2.0.so.0` is unavailable. The 1280×720 preview smoke check succeeds and `/dashboard` returns `307` to `/login?redirect=%2Fdashboard`, but authenticated interaction across desktop, tablet, and mobile remains unverified. This record covers the available responsive implementation review, component state tests, and preview smoke check; release sign-off still requires a usable signed-in browser session.

## Release verification run (2026-08-22)

- Focused Overview tests: `npm test -- --run src/test/Dashboard.test.tsx` — 8 tests passed.
- TypeScript validation: `npm run lint` — passed.
- Formatting check: `git diff --check` — passed.
- Preview smoke check: the configured `Start application` workflow restarted successfully and served the public site cleanly at 1280×720; no browser console errors were reported.
- Route boundary check: `GET /dashboard` returned `307` with `Location: /login?redirect=%2Fdashboard`, confirming that this environment has no signed-in session available for the Overview route.
- Browser/device limitation: Chromium could not launch because `libglib-2.0.so.0` is unavailable. Therefore desktop, tablet, and mobile authenticated interaction checks—including themes, state transitions, chart tooltip, keyboard focus, sidebar/routes, analytics requests, and Guide assistant behavior—remain unverified with a real account. No device-specific regression was observable in the available unauthenticated preview.
- Evidence screenshot: [1280×720 `/dashboard` route-boundary capture](screenshots/overview-authenticated-check-blocked-1280.jpg) shows the expected login screen rather than an authenticated Overview.
- Fresh evidence screenshot: [1280×720 `/dashboard` preview capture](screenshots/overview-authenticated-check-blocked-1280-current.jpg) taken after the application workflow restart on 2026-08-22 shows the same expected login boundary; browser console contained no application errors.
- Browser runner evidence: `npm run test:e2e -- --project=chromium` reached Playwright but Chromium exited with code 127 before any page/test interaction because `libglib-2.0.so.0` is missing. This is an environment prerequisite failure, not an Overview assertion result.

## Release verification run (2026-08-22, final environment check)

- The `Start application` workflow was restarted successfully and remained healthy. The backend served on port 5001 and the Next.js preview served on port 5000.
- `GET /dashboard` returned `307` with `Location: /login?redirect=%2Fdashboard`; no authenticated session or test credentials are available in this environment.
- The preview capture tool produced a clean 1280×720 route-boundary screenshot with no application errors: [current 1280×720 capture](screenshots/overview-authenticated-check-blocked-1280-current.jpg).
- A direct `npx playwright screenshot` attempt was blocked before page creation because Chromium cannot load `libglib-2.0.so.0`. No tablet or mobile authenticated screenshots could be created.
- Focused automated coverage remains green: `npm test -- --run src/test/Dashboard.test.tsx` — 8 tests passed. TypeScript validation (`npm run lint`) and `git diff --check` also passed.
- This run supplies fresh environment and route-boundary evidence only. It does not convert any authenticated check to pass or fail because the Overview never became available in a signed-in session.

## Sign-off checklist

| Required authenticated check | Result | Evidence |
| --- | --- | --- |
| Overview at 1280px+ | Blocked | No usable signed-in session; route-boundary screenshot above. |
| Overview at 768–1279px | Blocked | Chromium cannot launch; no authenticated tablet viewport available. |
| Overview under 768px | Blocked | Chromium cannot launch; no authenticated mobile viewport available. |
| Light and dark themes | Blocked | Theme tokens and CSS branches reviewed; runtime switching requires signed-in browser access. |
| Loading, empty, and error-retry states | Passed (automated) | Focused Overview suite: 8/8 tests passed. |
| Chart tooltip | Blocked | Tooltip implementation reviewed; pointer interaction requires signed-in browser access. |
| Keyboard focus | Blocked | Focus-visible implementation reviewed; tab traversal requires signed-in browser access. |
| Sidebar and routes | Blocked | Route links reviewed; authenticated navigation requires signed-in browser access. |
| Analytics requests | Blocked | Query wiring covered by component tests; authenticated request/response behavior requires signed-in browser access. |
| Guide assistant overlay | Blocked | Overlay implementation reviewed; authenticated open, retry, focus, and responsive checks require signed-in browser access. |

The blocked results above are intentionally retained: replacing them with pass/fail would claim an authenticated interaction that did not occur.
