/**
 * Brevo (Sendinblue) API Service
 * Handles transactional email sending and inbound email webhook parsing.
 *
 * Priority: Used automatically when BREVO_API_KEY is set.
 * Fallback: System falls back to SMTP (nodemailer) when Brevo key is absent.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BrevoClient, BrevoEnvironment } = require('@getbrevo/brevo');

import { logger } from '../middleware/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrevoSendOptions {
  to: string | { email: string; name?: string }[];
  subject: string;
  html?: string;
  text?: string;
  from?: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  attachments?: { content: string; name: string; type?: string }[];
  tags?: string[];
  headers?: Record<string, string>;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'brevo';
}

export interface BrevoInboundEmail {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: { name: string; contentType: string; size: number; downloadToken?: string }[];
  rawPayload?: unknown;
}

// ── Client factory ─────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');
  return new BrevoClient({ apiKey, environment: BrevoEnvironment.Production });
}

export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

// ── Send transactional email ──────────────────────────────────────────────────

export async function brevoSendEmail(options: BrevoSendOptions): Promise<BrevoSendResult> {
  try {
    const client = getClient();

    const toArray: { email: string; name?: string }[] = Array.isArray(options.to)
      ? options.to
      : [{ email: options.to }];

    const defaultFrom = {
      email: process.env.BREVO_FROM_EMAIL || 'no-reply@sgsland.vn',
      name: process.env.BREVO_FROM_NAME || 'SGS LAND',
    };

    const effectiveSender = options.from ?? defaultFrom;

    // Warn when sender is a Gmail address — Gmail DMARC p=reject will silently
    // drop delivery even if Brevo API returns 200. Fix: set BREVO_FROM_EMAIL to
    // a verified non-Gmail sender (e.g. noreply@sgsland.vn) after authenticating
    // the domain in Brevo dashboard (Senders & IP → Domains).
    if (effectiveSender.email.endsWith('@gmail.com')) {
      logger.warn(
        `[Brevo] ⚠️  Sender is ${effectiveSender.email} (Gmail). Gmail DMARC p=reject will cause silent delivery failure at most recipients. ` +
        `Set BREVO_FROM_EMAIL env var to a verified non-Gmail sender (e.g. noreply@sgsland.vn).`
      );
    }

    const payload: Record<string, unknown> = {
      to: toArray,
      subject: options.subject,
      sender: effectiveSender,
    };

    if (options.html) payload.htmlContent = options.html;
    if (options.text) payload.textContent = options.text;
    if (options.replyTo) payload.replyTo = options.replyTo;
    if (options.attachments?.length) payload.attachment = options.attachments;
    if (options.tags?.length) payload.tags = options.tags;
    if (options.headers) payload.headers = options.headers;

    const result = await client.transactionalEmails.sendTransacEmail(payload);

    // SDK returns data directly (not wrapped in .body)
    const messageId = (result as any)?.messageId || `brevo-${Date.now()}`;
    logger.info(`[Brevo] Email sent → ${toArray.map(t => t.email).join(', ')} | messageId: ${messageId}`);

    return { success: true, messageId, provider: 'brevo' };
  } catch (error: any) {
    const msg = error?.response?.body?.message || error?.message || String(error);
    logger.error(`[Brevo] Send error: ${msg}`);
    return { success: false, error: msg, provider: 'brevo' };
  }
}

// ── Parse Brevo inbound webhook payload ───────────────────────────────────────

export function parseBrevoInbound(body: unknown): BrevoInboundEmail | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, any>;

  // Brevo inbound format (Inbound Parsing):
  // { From, To, Subject, RawTextBody, HtmlBody, Attachments, Headers }
  const from =
    b.From ||
    b.from ||
    b.sender ||
    '';

  if (!from) return null;

  const to = b.To || b.to || b.recipient || '';

  // Extract display name from "Name <email>" format
  const nameMatch = from.match(/^(.+?)\s*<.+>/);
  const fromName = b.FromName || b.fromName || (nameMatch ? nameMatch[1].trim() : undefined);

  const subject = b.Subject || b.subject || '(Không có tiêu đề)';
  const body_text = b.RawTextBody || b['body-plain'] || b.text || b.TextBody || b.body || '';
  const htmlBody = b.HtmlBody || b.html || b.HtmlContent || b.HtmlContent || undefined;

  // Attachments
  const attachments = (b.Attachments || b.attachments || []).map((a: any) => ({
    name: a.Name || a.name || 'attachment',
    contentType: a.ContentType || a.contentType || 'application/octet-stream',
    size: a.ContentLength || a.size || 0,
    downloadToken: a.DownloadToken || a.downloadToken,
  }));

  return { from, fromName, to, subject, body: body_text, htmlBody, attachments, rawPayload: body };
}

// ── Parse Brevo event/delivery webhook ────────────────────────────────────────

export interface BrevoEmailEvent {
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed' | 'blocked' | string;
  email: string;
  messageId?: string;
  subject?: string;
  timestamp: number;
  tags?: string[];
}

export function parseBrevoEvents(body: unknown): BrevoEmailEvent[] {
  if (!body || typeof body !== 'object') return [];

  // Brevo sends a single event object OR an array
  const events: any[] = Array.isArray(body) ? body : [body];

  return events
    .filter(e => e && typeof e === 'object' && (e.event || e.type))
    .map(e => ({
      event: e.event || e.type || 'unknown',
      email: e.email || e.to || '',
      messageId: e['message-id'] || e.messageId || e['msg-id'],
      subject: e.subject || e.Subject,
      timestamp: e.ts ? e.ts * 1000 : e.timestamp || Date.now(),
      tags: e.tags || e.TAG || [],
    }));
}

// ── Verify Brevo webhook signature ────────────────────────────────────────────
// Brevo signs webhook payloads with an HMAC-SHA256 using the BREVO_WEBHOOK_SECRET
// when a secret is set in the Brevo dashboard.

import crypto from 'crypto';

export function verifyBrevoWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return (
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}

// ── Account info (test connection) ────────────────────────────────────────────

export async function getBrevoAccountInfo(): Promise<{ email: string; firstName: string; lastName: string; plan: string } | null> {
  try {
    const client = getClient();
    const result = await client.account.getAccount();
    // SDK returns data directly (not wrapped in .body)
    const acct = (result as any) || {};
    return {
      email: acct.email || '',
      firstName: acct.firstName || '',
      lastName: acct.lastName || '',
      plan: acct.plan?.[0]?.type || 'free',
    };
  } catch (error: any) {
    logger.error('[Brevo] Account info error:', error?.response?.body?.message || error?.message);
    return null;
  }
}
