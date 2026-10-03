---
name: Lazy Three.js preview timing
description: First-time Next development compilation can make the lazy city scene outlast automated screenshot settling.
---

## Rule

In development, treat the static hero photo as expected during first paint; wait for the 3D canvas to mount before evaluating the city render.

**Why:** The deferred scene chunk compiles only when mounted, and the browser-preview capture can finish before that first development compilation completes.

**How to apply:** Use a browser check that waits for the scene canvas. Test the photo fallback separately with reduced motion or unavailable WebGL.