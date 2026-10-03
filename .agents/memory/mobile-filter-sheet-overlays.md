---
name: Mobile filter sheet overlays
description: Keep the mobile homepage filter sheet above consent UI and use controls that remain selectable inside its constrained panel.
---

Render the mobile filter sheet through a portal to `document.body`. A large z-index on a sheet nested under the hero does not escape the hero's stacking context, so fixed cookie-consent and chat overlays can still intercept taps. The sheet's z-index must also exceed the global chat bubble's z-index. Use native selects for the mobile type and budget controls; the desktop custom dropdown can be clipped or hit-tested behind the modal backdrop inside a scroll-constrained sheet. Keep their values controlled by the same state so the existing search fields and query parameters remain unchanged.

**Why:** Browser interaction checks showed the hero's stacking context left the sheet under cookie consent, the global chat bubble could overlap a selector, and the backdrop intercepted the custom dropdown options. Portaling the sheet, raising its overlay above global UI, and using native selects fixed those issues without changing search values.

**How to apply:** Use this pattern for mobile sheets nested in stacked page sections. Verify with consent UI visible at 375px and 414px, including selection, apply, Escape, and focus return.