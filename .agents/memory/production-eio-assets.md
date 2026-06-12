---
name: Production EIO static assets
description: Replit VM overlay filesystem returns EIO on large files streamed via express.static; fix with fs.readFile + retry
---

## Rule
Do not rely solely on `express.static()` for serving large JS/CSS chunks in Replit VM deployments.

**Problem:** `express.static()` uses `sendFile()` which streams files via syscall. Replit's VM overlay filesystem occasionally returns `EIO: i/o error, read` for files larger than ~100KB. This causes HTTP 500 on the asset request, breaking the SPA.

**Fix applied in server.ts:**
```javascript
app.get('/assets/*path', (req, res, next) => {
  const filePath = path.join(process.cwd(), 'dist', req.path);
  const tryRead = (attempt: number) => {
    fs.readFile(filePath, (err, data) => {
      if (err?.code === 'ENOENT') return next();
      if (err?.code === 'EIO' && attempt < 2) return setTimeout(() => tryRead(attempt + 1), 50);
      if (err) return next(err);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(data);
    });
  };
  tryRead(1);
});
// express.static kept as fallback for non-/assets files
```

**Why:** `fs.readFile()` reads the entire file into memory buffer before sending, bypassing the streaming syscall that triggers EIO. The 50ms retry handles transient I/O errors in the overlay FS.

**How to apply:** When production shows `EIO: i/o error, read` on static assets in a Replit VM deployment, add a buffered read handler before express.static for the `/assets/*path` route.

**Note:** Remember Express v5 requires `/assets/*path` not `/assets/*` (see express-v5-wildcards.md).
