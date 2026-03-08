import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
  } else if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (platform === 'facebook') {
      const signature = req.headers['x-hub-signature-256'] as string;
      const appSecret = process.env.FB_APP_SECRET;

      if (!appSecret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const body = rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    }

    if (platform === 'zalo') {
      const signature = req.headers['x-zalo-signature'] as string;
      const oaSecret = process.env.ZALO_OA_SECRET;

      if (!oaSecret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const body = rawBody || Buffer.from(JSON.stringify(req.body));
      const mac = crypto.createHmac('sha256', oaSecret).update(body).digest('hex');

      if (mac !== signature) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    }

    next();
  };
}

export function preventParamPollution(req: Request, res: Response, next: NextFunction) {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        (req.query as any)[key] = value[value.length - 1];
      }
    }
  }
  next();
}
