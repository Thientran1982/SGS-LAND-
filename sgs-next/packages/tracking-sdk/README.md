# @sgs/tracking-sdk

Framework-agnostic visitor tracking + consent beacon consumed by the future
Next.js frontend. Ships as plain ES module JavaScript — no build step, so it
can be copied straight into `apps/web/public` (or any static host) once the
frontend app exists.

## Legal requirement this SDK exists to enforce

Nghi dinh 13/2023/ND-CP (effective 01/07/2023) and Luat Bao ve du lieu ca nhan
so 91/2025/QH15 treat cookie/behavioral data (IP, device, browsing journey)
as personal data requiring **prior, explicit, freely-given consent** —
silence or a pre-checked box is not valid consent, and a "Reject" action must
be as easy to find as "Accept".

This SDK is built so behavioral tracking is *structurally* impossible before
consent, not just "off by convention":

- `trackEvent()` / `trackPageExit()` check `hasBehavioralConsent` and no-op
  (returning `{ tracked: false, reason: 'behavioral_consent_not_granted' }`)
  if the visitor has not opted in.
- The backend (`TrackingService.trackEvent`) enforces the exact same rule
  server-side, so a compromised or modified frontend cannot bypass it.
- ESSENTIAL is not tracked by this file at all — only the two opt-in
  categories (BEHAVIORAL, ADVERTISING) are gated here.

## Minimal integration (two-layer consent banner)

```html
<script type="module">
  import { SgsTracker } from '/vendor/sgs-tracker.js';

  const tracker = new SgsTracker({
    apiBaseUrl: 'https://api.sgsland.vn',
    tenantId: window.__SGS_TENANT_ID__,
  });
  await tracker.init(); // loads any previously-granted consent

  // Layer 1: essential — always on, no banner needed.
  // Layer 2: behavioral/advertising — only after an explicit banner action:
  document.querySelector('#consent-accept').addEventListener('click', () => {
    tracker.setConsent('BEHAVIORAL', true);
    tracker.setConsent('ADVERTISING', true);
  });
  document.querySelector('#consent-reject').addEventListener('click', () => {
    tracker.setConsent('BEHAVIORAL', false);
    tracker.setConsent('ADVERTISING', false);
  });

  tracker.trackPageView();
  window.addEventListener('beforeunload', () => tracker.trackPageExit());
</script>
```

See `../../docs/tracking-and-recommendations.md` for the full architecture
(identity resolution, recommendation engine, roadmap phases).
