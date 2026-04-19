import { Router, Request, Response } from 'express';
import express from 'express';
import { subscriptionRepository } from '../repositories/subscriptionRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { writeAuditLog } from '../middleware/auditLog';
import { pool, withTenantContext, withRlsBypass } from '../db';
import {
  getStripeClient,
  findByProviderSessionId,
  markPaid,
  getPlanInfo,
} from '../services/checkoutService';
import { emailService } from '../services/emailService';

async function notifyTenantAdmins(tenantId: string, payload: {
  type: string; title: string; body: string; metadata: Record<string, any>;
}): Promise<Array<{ id: string; email: string; name: string | null }>> {
  try {
    const admins = await withTenantContext(tenantId, (client) => client.query(
      `SELECT id, email, name FROM users WHERE tenant_id = $1 AND role IN ('ADMIN','TEAM_LEAD') AND status = 'ACTIVE'`,
      [tenantId]
    ));
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

function resolveBillingUrl(): string {
  const base = process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : 'https://sgsland.vn');
  return `${base.replace(/\/+$/, '')}/billing`;
}

async function dispatchBillingEmails(args: {
  tenantId: string;
  payerEmail: string | null;
  payerName?: string | null;
  planName: string;
  amount: number;
  currency: string;
  sessionId: string;
  admins: Array<{ id: string; email: string; name: string | null }>;
}) {
  const billingUrl = resolveBillingUrl();
  const paidAt = new Date();
  const tasks: Promise<unknown>[] = [];

  if (args.payerEmail) {
    tasks.push(
      emailService.sendBillingReceiptEmail(args.tenantId, args.payerEmail, {
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        sessionId: args.sessionId,
        paidAt,
        billingUrl,
      }).catch(err => console.error('Failed to send billing receipt:', err)),
    );
  }

  const seen = new Set<string>();
  for (const admin of args.admins) {
    if (!admin.email) continue;
    const key = admin.email.toLowerCase();
    if (args.payerEmail && key === args.payerEmail.toLowerCase()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(
      emailService.sendBillingAdminAlertEmail(args.tenantId, admin.email, {
        payerEmail: args.payerEmail || 'unknown',
        payerName: args.payerName || null,
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        sessionId: args.sessionId,
        paidAt,
        billingUrl,
      }).catch(err => console.error('Failed to send admin alert:', err)),
    );
  }

  await Promise.all(tasks);
}

// Mounted at /api/billing/webhook BEFORE the global JSON parser so the raw
// body is preserved for Stripe signature verification.
export function createBillingWebhookRouter() {
  const router = Router();

  router.post(
    '/',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req: Request, res: Response) => {
      const stripe = getStripeClient();
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripe || !secret) {
        return res.status(503).json({ error: 'Stripe webhook not configured' });
      }
      const sig = req.headers['stripe-signature'] as string | undefined;
      if (!sig) return res.status(400).json({ error: 'Missing signature' });

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
      } catch (err: any) {
        console.error('Stripe signature verification failed:', err?.message);
        return res.status(400).json({ error: `Webhook error: ${err?.message}` });
      }

      try {
        if (event.type === 'checkout.session.completed') {
          const session: any = event.data.object;
          const tx = await findByProviderSessionId(session.id);
          if (!tx) {
            return res.json({ received: true, note: 'no local tx' });
          }
          if (tx.status === 'PAID') {
            return res.json({ received: true, idempotent: true });
          }
          const paid = await markPaid(tx.id, session.payment_intent || session.id);
          if (paid) {
            const planInfo = getPlanInfo(tx.planId);
            const subscription = await subscriptionRepository.updatePlan(tx.tenantId, tx.planId);
            await writeAuditLog(
              tx.tenantId,
              tx.userId,
              'SETTINGS_UPDATE',
              'subscription',
              subscription?.id,
              {
                source: 'stripe_webhook',
                planId: tx.planId,
                amount: tx.amount,
                currency: tx.currency,
                sessionId: tx.id,
                stripeSessionId: session.id,
              },
            );
            const admins = await notifyTenantAdmins(tx.tenantId, {
              type: 'BILLING_PAYMENT',
              title: `Đã nâng cấp gói ${planInfo?.name || tx.planId}`,
              body: `${tx.userEmail} vừa thanh toán $${tx.amount}/tháng cho gói ${planInfo?.name || tx.planId}.`,
              metadata: {
                planId: tx.planId,
                amount: tx.amount,
                currency: tx.currency,
                paidByUserId: tx.userId,
                paidByEmail: tx.userEmail,
                sessionId: tx.id,
                stripeSessionId: session.id,
                source: 'stripe_webhook',
              },
            });
            let payerName: string | null = null;
            try {
              const payerRow = await withRlsBypass((client) => client.query(
                `SELECT name FROM users WHERE id = $1 LIMIT 1`,
                [tx.userId],
              ));
              payerName = payerRow.rows[0]?.name || null;
            } catch (err) {
              console.error('Failed to lookup payer name:', err);
            }
            await dispatchBillingEmails({
              tenantId: tx.tenantId,
              payerEmail: tx.userEmail,
              payerName,
              planName: planInfo?.name || tx.planId,
              amount: tx.amount,
              currency: tx.currency,
              sessionId: tx.id,
              admins,
            });
          }
        }
        res.json({ received: true });
      } catch (err) {
        console.error('Webhook handler error:', err);
        res.status(500).json({ error: 'Webhook handler error' });
      }
    }
  );

  return router;
}
