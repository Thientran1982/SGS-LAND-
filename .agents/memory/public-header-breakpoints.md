---
name: Public header breakpoints
description: Public navigation switches as one unit at the xl breakpoint so desktop and mobile controls never overlap or duplicate visually.
---

The public header should show the full navigation and right-side actions only at `xl` and above. Below that breakpoint, show the hamburger drawer; keep each primary destination in the shared link list and do not repeat it in the drawer action row.

**Why:** A mixed `lg`/`md` breakpoint split allowed the desktop nav and controls to compete for width, while the mobile action row repeated the consign-property link already present in the navigation list.

**How to apply:** When adding a public header destination, add it once to the shared navigation data, verify it inside the header at 1280/1024/768/390px, and reserve the bottom mobile row for actions not already listed.