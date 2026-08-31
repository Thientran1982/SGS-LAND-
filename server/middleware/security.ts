import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (isProduction) {
    // Static marketing landing pages under /landing/* are hand-written HTML with
    // inline <style>, inline <script>, and inline JSON-LD schemas. They contain
    // no user-controlled data (form posts go to a separate API), so we relax
    // script-src/style-src for that path only — strict CSP elsewhere.
    const isLandingHtml = req.path === '/' || req.path === '/home' || req.path.startsWith('/landing/');
    const scriptInline = isLandingHtml ? "'unsafe-inline' " : '';
    const styleInline = isLandingHtml ? "'unsafe-inline' " : '';

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      `script-src 'self' ${scriptInline}https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms; ` +
      `style-src 'self' ${styleInline}https://fonts.googleapis.com; ` +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' wss: https://www.google-analytics.com https://analytics.google.com https://generativelanguage.googleapis.com https://nominatim.openstreetmap.org https://*.clarity.ms; " +
      "frame-src https://maps.google.com https://www.google.com; " +
      "frame-ancestors 'self' https://*.replit.dev https://*.worf.replit.dev https://replit.com https://*.replit.com;"
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  } else {
    // Development: permissive CSP to allow Vite HMR, eval for source maps, etc.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' ws: wss: https://www.google-analytics.com https://analytics.google.com https://generativelanguage.googleapis.com https://nominatim.openstreetmap.org https://*.clarity.ms; " +
      "frame-src https://maps.google.com https://www.google.com; " +
      "frame-ancestors 'self' https://*.replit.dev https://*.worf.replit.dev https://replit.com https://*.replit.com;"
    );
  }

  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

  const origin = req.headers.origin;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && allowedOrigins && origin) {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    // Unlisted origins get no CORS header — browser blocks them (correct behavior)
  } else if (isProduction && !allowedOrigins) {
    // Production without ALLOWED_ORIGINS — allow same-origin only (no wildcard)
    // Warn is emitted at startup (see server.ts)
  } else if (!isProduction) {
    const devOrigin = origin || 'http://localhost:5000';
    res.setHeader('Access-Control-Allow-Origin', devOrigin);
  }

  // M1 FIX: Added PATCH to Allow-Methods (was missing, causing PATCH requests to fail CORS preflight)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
}

export function verifyWebhookSignature(platform: 'zalo' | 'facebook') {
  return (req: Request, res: Response, next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (platform === 'facebook') {
      const signature = req.headers['x-hub-signature-256'] as string;
      const appSecret = process.env.FB_APP_SECRET;

      if (!appSecret) {
        if (isProduction) {
          return res.status(500).json({ error: 'Webhook secret not configured' });
        }
        // Dev without secret configured — pass with a warning (allows local webhook testing)
        console.warn('[Security] FB_APP_SECRET not set — skipping Facebook webhook verification (dev only)');
        return next();
      }

      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const body = rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');

      if (signature.length !== expectedSignature.length ||
          !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    }

    if (platform === 'zalo') {
      const signature = req.headers['x-zalo-signature'] as string;
      const oaSecret = process.env.ZALO_OA_SECRET;

      if (!oaSecret) {
        if (isProduction) {
          return res.status(500).json({ error: 'Webhook secret not configured' });
        }
        console.warn('[Security] ZALO_OA_SECRET not set — skipping Zalo webhook verification (dev only)');
        return next();
      }

      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const body = rawBody || Buffer.from(JSON.stringify(req.body));
      const mac = crypto.createHmac('sha256', oaSecret).update(body).digest('hex');

      if (mac.length !== signature.length ||
          !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(signature))) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    }

    next();
  };
}

const UNSAFE_QUERY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function preventParamPollution(req: Request, res: Response, next: NextFunction) {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (UNSAFE_QUERY_KEYS.has(key)) continue;
      if (Array.isArray(value)) {
        Object.defineProperty(req.query, key, {
          value: value[value.length - 1],
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// CSRF protection (double-submit-cookie pattern) — ENFORCING mode.
// Because auth is cookie-based (req.cookies.token), state-changing requests are
// vulnerable to CSRF. We issue a non-HttpOnly `csrf_token` cookie and require a
// matching `X-CSRF-Token` header (or _csrf body/query field) on every unsafe
// method (POST/PUT/PATCH/DELETE). Comparison is timing-safe.
// ---------------------------------------------------------------------------

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Path prefixes exempt from CSRF: server-to-server webhooks (signature/token
// verified) and pre-session auth bootstrap endpoints (no session cookie yet).
const CSRF_EXEMPT_PREFIXES = [
  '/api/webhooks',
  // P0.2: agent webhook automations - da xac thuc bang x-automation-secret.
  '/api/public/automations',
  // P1.2: voice transcribe - public, chi nhan audio base64.
  '/api/public/livechat/transcribe',
  '/api/billing/webhook',
  '/api/_client_error',
  '/api/csrf-token',
  '/api/auth/login',
  '/api/auth/sso',
  '/api/auth/register',
  '/api/auth/onboard-vendor',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout',
  '/api/buyer/auth/request-otp',
  '/api/buyer/auth/verify-otp',
  '/api/buyer/auth/logout',
  // Server-to-server scheduled jobs authenticate with x-internal-secret.
  '/api/internal/engagement-email-cron',
  '/api/internal/chat-followup-cron',
];

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/'),
  );
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Ensures every response has a fresh csrf_token cookie available to the SPA.
 * Non-HttpOnly on purpose so the frontend JS can read it and echo it back in
 * the X-CSRF-Token header (double-submit-cookie). Mount BEFORE csrfProtection.
 */
export function csrfTokenIssuer(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies || !req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    // Make it readable within the same request too.
    (req as any).csrfToken = token;
    if (!req.cookies) (req as any).cookies = {};
    (req as any).cookies[CSRF_COOKIE_NAME] = token;
  } else {
    (req as any).csrfToken = req.cookies[CSRF_COOKIE_NAME];
  }
  next();
}

/**
 * Enforcing CSRF guard. Rejects unsafe-method requests whose X-CSRF-Token
 * header does not match the csrf_token cookie. Mount AFTER csrfTokenIssuer.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (CSRF_SAFE_METHODS.has(req.method)) return next();
  if (isCsrfExempt(req.path)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken =
    (req.headers[CSRF_HEADER_NAME] as string | undefined) ||
    (req.body && typeof req.body === 'object' ? req.body._csrf : undefined) ||
    (req.query ? (req.query._csrf as string | undefined) : undefined);

  if (!cookieToken || !headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'EBADCSRFTOKEN',
    });
  }
  return next();
}

// GET handler that returns the current CSRF token for SPA bootstrap.
export function csrfTokenHandler(req: Request, res: Response) {
  const token = (req as any).csrfToken || req.cookies?.[CSRF_COOKIE_NAME] || generateCsrfToken();
  res.json({ csrfToken: token });
}
