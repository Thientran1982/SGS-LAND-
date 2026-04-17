import { Router, Request, Response } from 'express';
import { subscriptionRepository } from '../repositories/subscriptionRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { writeAuditLog } from '../middleware/auditLog';
import { pool } from '../db';
import {
  createTransaction,
  getTransaction,
  getPlanInfo,
  markPaid,
  cancelTransaction,
  findByProviderSessionId,
  isStripeConfigured,
  getStripeClient,
} from '../services/checkoutService';
import { emailService } from '../services/emailService';

const SELF_UPGRADEABLE_PLANS = ['TEAM', 'ENTERPRISE'];

// Build a trusted origin for payment redirect URLs. Prefer an explicit
// configured public URL; fall back to REPLIT_DOMAINS; only use request
// headers as a last resort. This avoids host/forwarded-header injection
// where a spoofed header could redirect a paying user to an attacker site.
function resolveAppOrigin(req: Request): string {
  const explicit = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const replitDomains = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim();
  if (replitDomains) return `https://${replitDomains}`;
  // Local-dev fallback only.
  const proto = req.protocol === 'https' ? 'https' : 'http';
  const host = req.headers.host || 'localhost:5000';
  return `${proto}://${host}`;
}

async function notifyTenantAdmins(tenantId: string, payload: {
  type: string;
  title: string;
  body: string;
  metadata: Record<string, any>;
}): Promise<Array<{ id: string; email: string; name: string | null }>> {
  try {
    const admins = await pool.query(
      `SELECT id, email, name FROM users WHERE tenant_id = $1 AND role IN ('ADMIN','TEAM_LEAD') AND status = 'ACTIVE'`,
      [tenantId]
    );
    for (const row of admins.rows) {
      await notificationRepository.create({
        tenantId,
        userId: row.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        metadata: payload.metadata,
      });
    }
    return admins.rows.map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
  } catch (err) {
    console.error('Failed to notify admins:', err);
    return [];
  }
}

async function sendBillingPaymentEmails(args: {
  tenantId: string;
  payerEmail: string | null;
  payerName?: string | null;
  planName: string;
  amount: number;
  currency: string;
  sessionId: string;
  paidAt: string | Date;
  billingUrl: string;
  admins: Array<{ id: string; email: string; name: string | null }>;
}) {
  const tasks: Promise<unknown>[] = [];

  if (args.payerEmail) {
    tasks.push(
      emailService.sendBillingReceiptEmail(args.tenantId, args.payerEmail, {
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        sessionId: args.sessionId,
        paidAt: args.paidAt,
        billingUrl: args.billingUrl,
      }).catch(err => console.error('Failed to send billing receipt:', err)),
    );
  }

  const adminEmails = new Set<string>();
  for (const admin of args.admins) {
    if (!admin.email) continue;
    if (args.payerEmail && admin.email.toLowerCase() === args.payerEmail.toLowerCase()) continue;
    if (adminEmails.has(admin.email.toLowerCase())) continue;
    adminEmails.add(admin.email.toLowerCase());
    tasks.push(
      emailService.sendBillingAdminAlertEmail(args.tenantId, admin.email, {
        payerEmail: args.payerEmail || 'unknown',
        payerName: args.payerName || null,
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        sessionId: args.sessionId,
        paidAt: args.paidAt,
        billingUrl: args.billingUrl,
      }).catch(err => console.error('Failed to send admin alert:', err)),
    );
  }

  await Promise.all(tasks);
}

async function applyPaidUpgrade(args: {
  tenantId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName?: string | null;
  planId: string;
  amount: number;
  sessionId: string;
  ipAddress?: string;
  source: 'mock' | 'stripe_webhook' | 'stripe_redirect';
  origin?: string;
}) {
  const planInfo = getPlanInfo(args.planId);
  if (!planInfo) throw new Error('Invalid plan');
  const subscription = await subscriptionRepository.updatePlan(args.tenantId, args.planId);

  await writeAuditLog(
    args.tenantId,
    args.actorUserId || '',
    'SETTINGS_UPDATE',
    'subscription',
    subscription?.id,
    {
      source: args.source,
      planId: args.planId,
      amount: args.amount,
      currency: 'USD',
      sessionId: args.sessionId,
    },
    args.ipAddress,
  );

  const admins = await notifyTenantAdmins(args.tenantId, {
    type: 'BILLING_PAYMENT',
    title: `Đã nâng cấp gói ${planInfo.name}`,
    body: `${args.actorEmail || 'Một thành viên'} vừa thanh toán $${planInfo.price}/tháng cho gói ${planInfo.name}.`,
    metadata: {
      planId: args.planId,
      amount: args.amount,
      currency: 'USD',
      paidByUserId: args.actorUserId,
      paidByEmail: args.actorEmail,
      sessionId: args.sessionId,
      source: args.source,
    },
  });

  const billingUrl = `${(args.origin || '').replace(/\/+$/, '') || 'https://sgsland.vn'}/billing`;
  await sendBillingPaymentEmails({
    tenantId: args.tenantId,
    payerEmail: args.actorEmail,
    payerName: args.actorName || null,
    planName: planInfo.name,
    amount: args.amount,
    currency: 'USD',
    sessionId: args.sessionId,
    paidAt: new Date(),
    billingUrl,
    admins,
  });

  return subscription;
}

export function createBillingRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/subscription', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      let subscription = await subscriptionRepository.getByTenant(user.tenantId);
      if (!subscription) {
        subscription = await subscriptionRepository.createSubscription(user.tenantId, {
          planId: 'INDIVIDUAL',
          status: 'ACTIVE',
        });
      }
      res.json(subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  router.post('/upgrade', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can upgrade the subscription plan directly. Use checkout instead.' });
      }
      const { planId } = req.body;
      const validPlans = ['INDIVIDUAL', 'TEAM', 'ENTERPRISE'];
      if (!planId || !validPlans.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }
      const subscription = await subscriptionRepository.updatePlan(user.tenantId, planId);
      res.json(subscription);
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  });

  // ─── Self-upgrade requests from non-admins ───────────────────────────────────
  // A non-admin who hits the quota gate cannot pay for the team plan. We let
  // them notify their workspace admins instead.
  router.post('/upgrade-request', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { planId, reason } = req.body || {};
      if (!planId || !SELF_UPGRADEABLE_PLANS.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      const planInfo = getPlanInfo(planId);
      await notifyTenantAdmins(user.tenantId, {
        type: 'BILLING_UPGRADE_REQUEST',
        title: `${user.name || user.email} yêu cầu nâng cấp gói ${planInfo?.name || planId}`,
        body: reason
          ? `Lý do: ${reason}`
          : `Người dùng vừa chạm trần quota AI và muốn nâng cấp lên gói ${planInfo?.name || planId}.`,
        metadata: {
          planId,
          requestedByUserId: user.id,
          requestedByEmail: user.email,
          reason: reason || null,
        },
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending upgrade request:', error);
      res.status(500).json({ error: 'Failed to send upgrade request' });
    }
  });

  // Create a checkout session — billing-admin only
  router.post('/checkout', authenticateToken, async (req: Request, res: Response) => {
    try {

      const user = (req as any).user;
      const { planId } = req.body || {};
      if (!planId || !SELF_UPGRADEABLE_PLANS.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan. Choose TEAM or ENTERPRISE.' });
      }

      const origin = resolveAppOrigin(req);

      const tx = await createTransaction({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        planId,
        successPath: `/checkout`,
        cancelPath: `/billing`,
        origin,
      });

      // For Stripe, success_url already contains the session template; for mock,
      // the client uses /checkout?session=<id> directly.
      res.json({
        sessionId: tx.id,
        planId: tx.planId,
        planName: tx.planName,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        provider: tx.provider,
        providerCheckoutUrl: tx.providerCheckoutUrl,
        expiresAt: tx.expiresAt,
      });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error?.message || 'Failed to create checkout session' });
    }
  });

  router.get('/checkout/:sessionId', authenticateToken, async (req: Request, res: Response) => {
    try {

      const user = (req as any).user;
      const tx = await getTransaction(String(req.params.sessionId), user.tenantId);
      if (!tx) return res.status(404).json({ error: 'Session not found' });
      res.json({
        sessionId: tx.id,
        planId: tx.planId,
        planName: tx.planName,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        provider: tx.provider,
        providerCheckoutUrl: tx.providerCheckoutUrl,
        expiresAt: tx.expiresAt,
        paidAt: tx.paidAt,
      });
    } catch (error) {
      console.error('Error fetching checkout session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  // Confirm — for the mock provider only. Real Stripe confirmations come via
  // the signed webhook above.
  router.post('/checkout/:sessionId/confirm', authenticateToken, async (req: Request, res: Response) => {
    try {

      const user = (req as any).user;
      const tx = await getTransaction(String(req.params.sessionId), user.tenantId);
      if (!tx) return res.status(404).json({ error: 'Session not found' });
      if (tx.userId !== user.id) {
        return res.status(403).json({ error: 'Only the user who started this checkout can confirm it.' });
      }
      if (tx.provider !== 'mock') {
        return res.status(400).json({
          error: 'This session must be confirmed via the payment provider.',
          providerCheckoutUrl: tx.providerCheckoutUrl,
        });
      }
      if (tx.status === 'EXPIRED') return res.status(410).json({ error: 'Session expired' });
      if (tx.status === 'CANCELLED') return res.status(400).json({ error: 'Session was cancelled' });
      if (tx.status === 'PAID') {
        return res.json({ sessionId: tx.id, status: tx.status, idempotent: true });
      }

      const paid = await markPaid(tx.id);
      if (!paid) return res.status(409).json({ error: 'Could not finalize session' });

      const subscription = await applyPaidUpgrade({
        tenantId: user.tenantId,
        actorUserId: user.id,
        actorEmail: user.email,
        actorName: user.name || null,
        planId: tx.planId,
        amount: tx.amount,
        sessionId: tx.id,
        ipAddress: req.ip,
        source: 'mock',
        origin: resolveAppOrigin(req),
      });

      res.json({
        sessionId: tx.id,
        status: paid.status,
        planId: tx.planId,
        planName: tx.planName,
        amount: tx.amount,
        currency: tx.currency,
        paidAt: paid.paidAt,
        subscription,
      });
    } catch (error) {
      console.error('Error confirming checkout:', error);
      res.status(500).json({ error: 'Failed to confirm checkout' });
    }
  });

  router.post('/checkout/:sessionId/cancel', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const existing = await getTransaction(String(req.params.sessionId), user.tenantId);
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      const isOwner = existing.userId === user.id;
      const isAdmin = user.role === 'ADMIN' || user.role === 'TEAM_LEAD';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the user who started this checkout (or a tenant admin) can cancel it.' });
      }
      const tx = await cancelTransaction(String(req.params.sessionId), user.tenantId);
      if (!tx) return res.status(404).json({ error: 'Session not found' });
      res.json({ sessionId: tx.id, status: tx.status });
    } catch (error) {
      console.error('Error cancelling checkout:', error);
      res.status(500).json({ error: 'Failed to cancel checkout' });
    }
  });

  // Sync helper for the Stripe redirect-back: client passes ?stripe_session_id=
  // and we proactively reconcile in case the webhook is delayed.
  router.post('/checkout/sync-stripe', authenticateToken, async (req: Request, res: Response) => {
    try {

      const user = (req as any).user;
      const stripe = getStripeClient();
      if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });

      const { stripeSessionId } = req.body || {};
      if (!stripeSessionId) return res.status(400).json({ error: 'stripeSessionId required' });

      const tx = await findByProviderSessionId(String(stripeSessionId));
      if (!tx || tx.tenantId !== user.tenantId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (tx.status === 'PAID') {
        return res.json({ sessionId: tx.id, status: tx.status, idempotent: true });
      }

      const session: any = await stripe.checkout.sessions.retrieve(String(stripeSessionId));
      if (session.payment_status === 'paid') {
        const paid = await markPaid(tx.id, session.payment_intent || session.id);
        if (paid) {
          await applyPaidUpgrade({
            tenantId: tx.tenantId,
            actorUserId: tx.userId,
            actorEmail: tx.userEmail,
            planId: tx.planId,
            amount: tx.amount,
            sessionId: tx.id,
            ipAddress: req.ip,
            source: 'stripe_redirect',
            origin: resolveAppOrigin(req),
          });
        }
        return res.json({ sessionId: tx.id, status: 'PAID' });
      }
      res.json({ sessionId: tx.id, status: tx.status });
    } catch (error) {
      console.error('Error syncing stripe session:', error);
      res.status(500).json({ error: 'Failed to sync stripe session' });
    }
  });

  router.get('/usage', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const usage = await subscriptionRepository.getUsageSummary(user.tenantId);
      res.json(usage);
    } catch (error) {
      console.error('Error fetching usage:', error);
      res.status(500).json({ error: 'Failed to fetch usage metrics' });
    }
  });

  router.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const invoices = await subscriptionRepository.getInvoices(user.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  router.get('/config', authenticateToken, async (_req: Request, res: Response) => {
    res.json({
      stripeEnabled: isStripeConfigured(),
      provider: isStripeConfigured() ? 'stripe' : 'mock',
    });
  });

  return router;
}
