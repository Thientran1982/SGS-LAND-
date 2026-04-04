import type { Request } from 'express';

/**
 * Resolve the canonical base URL for email links and external callbacks.
 * Priority:
 *   1. APP_URL env var (explicit override, e.g. https://sgsland.vn)
 *   2. Custom domain from REPLIT_DOMAINS (non-replit.app / non-repl.co)
 *   3. Default Replit subdomain from REPLIT_DOMAINS (e.g. sgs-land.replit.app)
 *   4. REPLIT_DEV_DOMAIN (Replit dev proxy domain)
 *   5. req.protocol + host header (last resort / self-hosted)
 */
export function resolveBaseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;

  const domains = (process.env.REPLIT_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  const customDomain = domains.find(
    (d) => !d.endsWith('.replit.app') && !d.endsWith('.repl.co')
  );
  if (customDomain) return `https://${customDomain}`;

  if (domains[0]) return `https://${domains[0]}`;

  if (process.env.REPLIT_DEV_DOMAIN)
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;

  return `${req.protocol}://${req.get('host')}`;
}
