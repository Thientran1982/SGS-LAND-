import { Router, Request, Response } from 'express';
import express from 'express';
import { subscriptionRepository } from '../repositories/subscriptionRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { writeAuditLog } from '../middleware/auditLog';
import { pool } from '../db';
import {
  getStripeClient,
  findByProviderSessionId,
  markPaid,
  getPlanInfo,
} from '../services/checkoutService';

async function notifyTenantAdmins(tenantId: string, payload: {
  type: string; title: string; body: string; metadata: Record<string, any>;
}) {
  try {
    const admins = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('ADMIN','TEAM_LEAD') AND status = 'ACTIVE'`,
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
  } catch (err) {
    console.error('Failed to notify admins:', err);
  }
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
            await notifyTenantAdmins(tx.tenantId, {
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
