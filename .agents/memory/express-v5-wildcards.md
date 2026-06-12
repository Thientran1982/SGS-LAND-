---
name: Express v5 route wildcards
description: path-to-regexp v8 requires named wildcard params — /assets/* crashes server
---

## Rule
Never use bare `*` wildcards in Express route paths. Use named wildcards instead.

**Wrong (Express 5 / path-to-regexp v8):**
```javascript
app.get('/assets/*', handler)
```
Throws at startup: `PathError [TypeError]: Missing parameter name at index N: /assets/*`

**Correct:**
```javascript
app.get('/assets/*path', handler)
// or
app.get('/assets/:filename(*)', handler)
```

**Why:** Express upgraded from path-to-regexp v0.x to v8.x in Express 5. The new version requires all wildcards to have a parameter name. Unnamed `*` is rejected at startup, crashing the server before any request is handled.

**How to apply:** Any time you add a wildcard route (`*`) to server.ts or any Express route file, always give the wildcard a name: `/path/*name`.

**Project version:** Express 5.2.1 + path-to-regexp 8.4.0 (as of 2026-06-12).
