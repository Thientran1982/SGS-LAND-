import crypto from 'crypto';
import Stripe from 'stripe';
import { pool } from '../db';

export type CheckoutStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type CheckoutProvider = 'mock' | 'stripe';

export interface CheckoutTransaction {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number; // dollars
  currency: 'USD';
  status: CheckoutStatus;
  provider: CheckoutProvider;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  providerCheckoutUrl?: string | null;
  expiresAt: string;
  paidAt?: string | null;
  createdAt: string;
}

const PLAN_CATALOG: Record<string, { name: string; price: number }> = {
  TEAM: { name: 'Team', price: 49 },
  ENTERPRISE: { name: 'Enterprise', price: 199 },
};

export function getPlanInfo(planId: string) {
  return PLAN_CATALOG[planId];
}

let stripeClient: Stripe | null = null;
export function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function rowToTransaction(row: any): CheckoutTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    userEmail: row.user_email,
    planId: row.plan_id,
    planName: row.plan_name,
    amount: Math.round(Number(row.amount_cents)) / 100,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerSessionId: row.provider_session_id,
    providerPaymentId: row.provider_payment_id,
    providerCheckoutUrl: row.metadata?.providerCheckoutUrl ?? null,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export async function createTransaction(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  planId: string;
  successPath: string;
  cancelPath: string;
  origin: string;
}): Promise<CheckoutTransaction> {
  const plan = PLAN_CATALOG[args.planId];
  if (!plan) throw new Error('Invalid plan');

  const idempotencyKey = crypto.randomBytes(18).toString('hex');
  const localSessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const stripe = getStripeClient();
  const provider: CheckoutProvider = stripe ? 'stripe' : 'mock';

  let providerSessionId: string | null = null;
  let providerCheckoutUrl: string | null = null;

  if (stripe) {
    const successBase = `${args.origin}${args.successPath}`;
    const sep = successBase.includes('?') ? '&' : '?';
    const successUrl = `${successBase}${sep}session=${localSessionId}&stripe_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${args.origin}${args.cancelPath}`;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: args.userEmail,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              recurring: { interval: 'month' },
              unit_amount: plan.price * 100,
              product_data: {
                name: `SGS Land — ${plan.name} plan`,
                description: `Monthly subscription · self-upgrade for tenant ${args.tenantId}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: args.tenantId,
        metadata: {
          tenantId: args.tenantId,
          userId: args.userId,
          planId: args.planId,
          localSessionId,
          idempotencyKey,
        },
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      },
      { idempotencyKey }
    );
    providerSessionId = session.id;
    providerCheckoutUrl = session.url;
  }

  const inserted = await pool.query(
    `INSERT INTO payment_transactions (
        id, tenant_id, user_id, user_email, plan_id, plan_name,
        amount_cents, currency, status, provider,
        provider_session_id, idempotency_key, metadata, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      localSessionId,
      args.tenantId,
      args.userId,
      args.userEmail,
      args.planId,
      plan.name,
      plan.price * 100,
      'USD',
      provider,
      providerSessionId,
      idempotencyKey,
      JSON.stringify({ providerCheckoutUrl }),
      expiresAt.toISOString(),
    ]
  );
  return rowToTransaction(inserted.rows[0]);
}

export async function getTransaction(
  id: string,
  tenantId: string
): Promise<CheckoutTransaction | null> {
  const result = await pool.query(
    `SELECT * FROM payment_transactions WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (!result.rows[0]) return null;
  // Lazy-expire
  const tx = rowToTransaction(result.rows[0]);
  if (tx.status === 'PENDING' && new Date(tx.expiresAt).getTime() < Date.now()) {
    await pool.query(
      `UPDATE payment_transactions SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'`,
      [id]
    );
    tx.status = 'EXPIRED';
  }
  return tx;
}

export async function findByProviderSessionId(
  providerSessionId: string
): Promise<CheckoutTransaction | null> {
  const result = await pool.query(
    `SELECT * FROM payment_transactions WHERE provider_session_id = $1 LIMIT 1`,
    [providerSessionId]
  );
  return result.rows[0] ? rowToTransaction(result.rows[0]) : null;
}

export async function markPaid(
  id: string,
  providerPaymentId?: string | null
): Promise<CheckoutTransaction | null> {
  const result = await pool.query(
    `UPDATE payment_transactions
        SET status = 'PAID',
            paid_at = NOW(),
            updated_at = NOW(),
            provider_payment_id = COALESCE($2, provider_payment_id)
      WHERE id = $1 AND status IN ('PENDING')
      RETURNING *`,
    [id, providerPaymentId || null]
  );
  return result.rows[0] ? rowToTransaction(result.rows[0]) : null;
}

export async function cancelTransaction(
  id: string,
  tenantId: string
): Promise<CheckoutTransaction | null> {
  const result = await pool.query(
    `UPDATE payment_transactions
        SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'
      RETURNING *`,
    [id, tenantId]
  );
  if (result.rows[0]) return rowToTransaction(result.rows[0]);
  // Already finalized — return current state
  return getTransaction(id, tenantId);
}

export async function listTransactions(
  tenantId: string,
  limit = 24
): Promise<CheckoutTransaction[]> {
  const result = await pool.query(
    `SELECT * FROM payment_transactions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows.map(rowToTransaction);
}
