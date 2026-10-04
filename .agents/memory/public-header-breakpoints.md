---
name: Public header breakpoints
description: Public navigation uses one xl breakpoint and keeps secondary contact and preference controls out of the shared header.
---

The public header should show the full navigation and right-side actions only at `xl` and above. Below that breakpoint, show the hamburger drawer; keep each primary destination in the shared link list and do not repeat it in the drawer action row.

On every public route, keep phone and Zalo shortcuts plus language and light/dark toggles out of both the desktop header and mobile drawer. Leave page and footer controls untouched, and retain primary navigation, sign-in, and the free-valuation action.

**Why:** A mixed `lg`/`md` breakpoint split allowed the desktop nav and controls to compete for width, while the mobile action row repeated the consign-property link already present in the navigation list.

**How to apply:** When changing the public header, preserve the secondary-action boundary on internal routes and check the desktop header plus the open mobile drawer at 1280/1024/768/390px. Add each primary destination only once to the shared navigation data.