/**
 * bookingRoutes.ts (Task #56) — Buyer deposit booking + VNPay integration.
 *
 * Endpoints:
 *   POST /api/bookings                — buyer creates a PENDING booking → paymentUrl
 *   GET  /api/bookings/me             — buyer lists own bookings
 *   GET  /api/bookings/:id            — buyer/agent/admin reads one
 *   GET  /api/payments/vnpay/return   — public, redirects to mobile deep-link
 *   POST /api/payments/vnpay/ipn      — public, server-to-server signed callback
 *
 * Trust model:
 *   - Browser callback (return) is informational only. We re-hash and show
 *     the buyer "đang xử lý" if invalid; never mutate booking.status here.
 *   - IPN is the source of truth. We verify the HMAC, then idempotently
 *     transition PENDING → PAID/FAILED inside a transaction so a retry
 *     IPN from VNPay (they fire up to 5 times) doesn't double-fire emails.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { authenticateBuyer } from '../middleware/buyerAuth';
import { loadVnpayConfig, isVnpayConfigured } from '../config/env';
import { buildPaymentUrl, verifyCallback } from '../services/vnpayService';
import { brevoSendEmail, isBrevoConfigured } from '../services/brevoService';
import { withRlsBypass } from '../db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_DEPOSIT_VND = 100_000;        // 100k VND lower bound (sandbox-friendly)
const MAX_DEPOSIT_VND = 500_000_000;    // 500M VND upper bound (sanity cap)
const BOOKING_TTL_MIN = 30;             // PENDING expires after 30 minutes

function sanitizeBookingRow(r: any) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    listingId: r.listing_id,
    unitId: r.unit_id,
    buyerUserId: r.buyer_user_id,
    agentUserId: r.agent_user_id,
    buyerEmail: r.buyer_email,
    depositAmount: Number(r.deposit_amount),
    currency: r.currency,
    status: r.status,
    vnpayTxnRef: r.vnpay_txn_ref,
    vnpayResponseCode: r.vnpay_response_code,
    vnpayBankCode: r.vnpay_bank_code,
    paidAt: r.paid_at,
    expiresAt: r.expires_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function clientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
}

async function logBookingEvent(
  pool: Pool,
  bookingId: string,
  kind: string,
  opts: {
    verified?: boolean;
    responseCode?: string | null;
    message?: string | null;
    payload?: unknown;
    ip?: string | null;
  } = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO booking_events
         (booking_id, kind, verified, response_code, message, payload, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        bookingId,
        kind,
        opts.verified === true,
        opts.responseCode || null,
        opts.message || null,
        opts.payload ? JSON.stringify(opts.payload) : null,
        opts.ip || null,
      ],
    );
  } catch (err: any) {
    logger.warn(`[bookings] event log failed (${kind}): ${err?.message || err}`);
  }
}

function depositReceiptHtml(b: {
  id: string;
  listingTitle: string;
  listingCode: string | null;
  amountVnd: number;
  bankCode: string | null;
  payDate: string | null;
  txnRef: string;
}): string {
  const fmtVnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
  return `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <div style="max-width:560px;margin:0 auto;padding:24px;background:#FFFFFF">
    <h2 style="color:#0F766E;margin:0 0 8px">Đã nhận đặt cọc giữ chỗ</h2>
    <p>Cảm ơn quý khách đã đặt cọc qua <strong>SGS Land</strong>. Dưới đây là biên nhận giao dịch:</p>
    <table cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
      <tr><td style="color:#64748B">Sản phẩm</td><td><strong>${b.listingTitle}</strong>${b.listingCode ? ` (${b.listingCode})` : ''}</td></tr>
      <tr><td style="color:#64748B">Số tiền cọc</td><td><strong>${fmtVnd(b.amountVnd)}</strong></td></tr>
      <tr><td style="color:#64748B">Mã đặt cọc</td><td><code>${b.id}</code></td></tr>
      <tr><td style="color:#64748B">Mã giao dịch</td><td><code>${b.txnRef}</code></td></tr>
      ${b.bankCode ? `<tr><td style="color:#64748B">Ngân hàng</td><td>${b.bankCode}</td></tr>` : ''}
      ${b.payDate ? `<tr><td style="color:#64748B">Thời điểm</td><td>${b.payDate}</td></tr>` : ''}
    </table>
    <p>Chuyên viên SGS Land sẽ liên hệ trong vòng <strong>24 giờ</strong> để hướng dẫn bước tiếp theo.</p>
    <p style="color:#64748B;font-size:12px;margin-top:24px">Hotline: 0971 132 378 · sgsland.vn</p>
  </div></body></html>`;
}

export function createBookingRoutes(
  pool: Pool,
  jwtSecret: string,
  io: SocketIOServer | null = null,
): Router {
  const router = Router();
  const requireBuyer = authenticateBuyer(jwtSecret);

  // ── POST /api/bookings ────────────────────────────────────────────────────
  router.post('/api/bookings', requireBuyer, async (req: Request, res: Response) => {
    try {
      if (!isVnpayConfigured()) {
        return res.status(503).json({
          error: 'Cổng thanh toán VNPay chưa được cấu hình. Liên hệ admin.',
        });
      }
      let cfg;
      try {
        cfg = loadVnpayConfig();
      } catch (err: any) {
        logger.error('[bookings] VNPay config invalid: ' + err.message);
        return res.status(500).json({ error: 'Cổng thanh toán cấu hình sai' });
      }
      if (!cfg) return res.status(503).json({ error: 'Cổng thanh toán chưa sẵn sàng' });

      const buyerId = (req as any).buyerUser.id as string;
      const body = (req.body as any) || {};
      const listingId = String(body.listingId || '').toLowerCase();
      const unitId = body.unitId ? String(body.unitId).toLowerCase() : null;
      if (!UUID_RE.test(listingId)) {
        return res.status(400).json({ error: 'listingId không hợp lệ' });
      }
      if (unitId && !UUID_RE.test(unitId)) {
        return res.status(400).json({ error: 'unitId không hợp lệ' });
      }
      const buyerEmail = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : null;

      // Deposit amount: caller-supplied (clamped) or fallback to project default.
      let amount = Number(body.depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) amount = cfg.defaultDepositVnd;
      amount = Math.round(amount);
      if (amount < MIN_DEPOSIT_VND || amount > MAX_DEPOSIT_VND) {
        return res.status(400).json({
          error: `Số tiền cọc phải từ ${MIN_DEPOSIT_VND.toLocaleString('vi-VN')}₫ đến ${MAX_DEPOSIT_VND.toLocaleString('vi-VN')}₫`,
        });
      }

      // Look up the listing (cross-tenant — RLS bypass) to bind tenant + agent.
      const listingRow = await withRlsBypass(async (client) => {
        const r = await client.query(
          `SELECT id, tenant_id, title, status, assigned_to
             FROM listings WHERE id = $1 LIMIT 1`,
          [listingId],
        );
        return r.rows[0] || null;
      });
      if (!listingRow) return res.status(404).json({ error: 'Không tìm thấy BĐS' });
      if (!['AVAILABLE', 'BOOKING', 'OPENING'].includes(listingRow.status)) {
        return res.status(409).json({ error: 'Sản phẩm không còn nhận đặt cọc' });
      }

      // Insert PENDING row. txnRef = 14-digit timestamp + 6 random hex →
      // unique within the tenant and short enough for VNPay's 100-char cap.
      const ts = new Date();
      const yyyymmddhhmmss =
        ts.getFullYear().toString() +
        String(ts.getMonth() + 1).padStart(2, '0') +
        String(ts.getDate()).padStart(2, '0') +
        String(ts.getHours()).padStart(2, '0') +
        String(ts.getMinutes()).padStart(2, '0') +
        String(ts.getSeconds()).padStart(2, '0');
      const rand = Math.random().toString(16).slice(2, 8).padEnd(6, '0');
      const txnRef = `SGS${yyyymmddhhmmss}${rand}`;
      const expiresAt = new Date(Date.now() + BOOKING_TTL_MIN * 60 * 1000);

      const inserted = await pool.query(
        `INSERT INTO bookings
           (tenant_id, listing_id, unit_id, buyer_user_id, agent_user_id,
            buyer_email, deposit_amount, vnpay_txn_ref, expires_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          listingRow.tenant_id,
          listingId,
          unitId,
          buyerId,
          listingRow.assigned_to || null,
          buyerEmail || null,
          amount,
          txnRef,
          expiresAt,
          notes,
        ],
      );
      const booking = inserted.rows[0];

      // Build VNPay redirect URL. Use the per-booking return URL so the
      // browser callback can deep-link to /bookings/<id> in the mobile app.
      const orderInfo = `Dat coc giu cho BDS ${(listingRow.title || '').slice(0, 80)}`;
      const paymentUrl = buildPaymentUrl(cfg, {
        txnRef,
        amount,
        orderInfo,
        ipAddr: clientIp(req),
        locale: 'vn',
      });

      await logBookingEvent(pool, booking.id, 'CREATED', {
        verified: true,
        message: `txnRef=${txnRef} amount=${amount}`,
        ip: clientIp(req),
      });

      res.status(201).json({
        booking: sanitizeBookingRow(booking),
        paymentUrl,
      });
    } catch (err: any) {
      logger.error('[bookings POST] ' + (err?.message || err));
      res.status(500).json({ error: 'Không tạo được đơn cọc' });
    }
  });

  // ── GET /api/bookings/me ──────────────────────────────────────────────────
  router.get('/api/bookings/me', requireBuyer, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const r = await pool.query(
        `SELECT b.*, l.title AS listing_title, l.code AS listing_code
           FROM bookings b
           LEFT JOIN listings l ON l.id = b.listing_id
          WHERE b.buyer_user_id = $1
          ORDER BY b.created_at DESC
          LIMIT $2`,
        [buyerId, limit],
      );
      res.json({
        bookings: r.rows.map((row) => ({
          ...sanitizeBookingRow(row),
          listingTitle: row.listing_title,
          listingCode: row.listing_code,
        })),
      });
    } catch (err: any) {
      logger.error('[bookings/me] ' + (err?.message || err));
      res.status(500).json({ error: 'Không tải được danh sách đơn cọc' });
    }
  });

  // ── GET /api/bookings/:id ─────────────────────────────────────────────────
  // Buyer reads their own. Agent/admin access happens via the web CRM (cookie
  // session); we don't need to support both auth modes here for the mobile sprint.
  router.get('/api/bookings/:id', requireBuyer, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '').toLowerCase();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const buyerId = (req as any).buyerUser.id as string;
      const r = await pool.query(
        `SELECT b.*, l.title AS listing_title, l.code AS listing_code
           FROM bookings b
           LEFT JOIN listings l ON l.id = b.listing_id
          WHERE b.id = $1 AND b.buyer_user_id = $2
          LIMIT 1`,
        [id, buyerId],
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Không tìm thấy đơn cọc' });
      const row = r.rows[0];
      res.json({
        booking: {
          ...sanitizeBookingRow(row),
          listingTitle: row.listing_title,
          listingCode: row.listing_code,
        },
      });
    } catch (err: any) {
      logger.error('[bookings/:id] ' + (err?.message || err));
      res.status(500).json({ error: 'Không tải được đơn cọc' });
    }
  });

  // ── GET /api/payments/vnpay/return ────────────────────────────────────────
  // Browser hits this after the buyer completes/cancels payment. We verify
  // the signature for display purposes only and 302-redirect to the mobile
  // deep-link so expo-web-browser auto-closes the auth session.
  router.get('/api/payments/vnpay/return', async (req: Request, res: Response) => {
    try {
      let cfg;
      try {
        cfg = loadVnpayConfig();
      } catch {
        cfg = null;
      }
      if (!cfg) return res.status(503).send('VNPay not configured');

      const result = verifyCallback(cfg, req.query as Record<string, unknown>);
      const txnRef = result.txnRef || '';
      // Resolve our booking id from the txnRef so the deep-link can target it.
      let bookingId: string | null = null;
      if (txnRef) {
        const r = await pool.query(
          `SELECT id FROM bookings WHERE vnpay_txn_ref = $1 LIMIT 1`,
          [txnRef],
        );
        bookingId = r.rows[0]?.id || null;
        if (bookingId) {
          await logBookingEvent(pool, bookingId, 'RETURN', {
            verified: result.valid,
            responseCode: result.responseCode,
            payload: result.raw,
            ip: clientIp(req),
          });
        }
      }
      const status = !result.valid
        ? 'invalid'
        : result.responseCode === '00'
          ? 'paid'
          : 'failed';
      const target = bookingId
        ? `sgsland://bookings/${bookingId}?status=${status}`
        : `sgsland://bookings?status=${status}`;
      // 302 → expo-web-browser openAuthSessionAsync intercepts the
      // sgsland:// scheme and auto-closes the in-app browser.
      return res.redirect(302, target);
    } catch (err: any) {
      logger.error('[vnpay/return] ' + (err?.message || err));
      return res.redirect(302, 'sgsland://bookings?status=error');
    }
  });

  // ── /api/payments/vnpay/ipn ───────────────────────────────────────────────
  // Server-to-server callback. VNPay expects a strict JSON response shape
  // (RspCode + Message); anything else and they'll keep retrying for hours.
  // VNPay v2.1.0 defaults to GET for the IPN; we accept both verbs so future
  // gateway changes don't silently break it.
  const ipnHandler = async (req: Request, res: Response) => {
      try {
        let cfg;
        try {
          cfg = loadVnpayConfig();
        } catch {
          return res.json({ RspCode: '99', Message: 'Config error' });
        }
        if (!cfg) return res.json({ RspCode: '99', Message: 'Not configured' });

        // Merge query + body so we accept both transports.
        const merged: Record<string, unknown> = {
          ...(req.query as Record<string, unknown>),
          ...(req.body as Record<string, unknown> || {}),
        };
        const result = verifyCallback(cfg, merged);

        if (!result.txnRef) {
          return res.json({ RspCode: '01', Message: 'Order not found' });
        }
        const r = await pool.query(
          `SELECT * FROM bookings WHERE vnpay_txn_ref = $1 LIMIT 1`,
          [result.txnRef],
        );
        const booking = r.rows[0];
        if (!booking) {
          return res.json({ RspCode: '01', Message: 'Order not found' });
        }
        await logBookingEvent(pool, booking.id, 'IPN', {
          verified: result.valid,
          responseCode: result.responseCode,
          payload: result.raw,
          ip: clientIp(req),
        });
        if (!result.valid) {
          return res.json({ RspCode: '97', Message: 'Invalid signature' });
        }
        // Amount integrity — VNPay MUST always send vnp_Amount; treat
        // missing/non-numeric as a hard failure to prevent tampered or
        // truncated callbacks from silently passing the signature check
        // (signature alone proves origin, not amount equality).
        if (result.amount === null || !Number.isFinite(result.amount)) {
          return res.json({ RspCode: '04', Message: 'Invalid amount' });
        }
        if (Math.round(result.amount) !== Math.round(Number(booking.deposit_amount))) {
          return res.json({ RspCode: '04', Message: 'Invalid amount' });
        }

        // Idempotent transition — if already PAID/FAILED, ack with 02.
        if (booking.status !== 'PENDING') {
          return res.json({ RspCode: '02', Message: 'Order already confirmed' });
        }

        const isPaid = result.responseCode === '00';
        const newStatus = isPaid ? 'PAID' : 'FAILED';

        // Atomic transition — RETURNING tells us whether THIS request was
        // the one that flipped PENDING→PAID. Concurrent duplicate IPNs
        // (VNPay retries on timeout) will see rowCount===0 here and skip
        // the side effects, guaranteeing exactly-once email + socket emit.
        const upd = await pool.query(
          `UPDATE bookings
              SET status = $1,
                  vnpay_response_code = $2,
                  vnpay_bank_code = $3,
                  vnpay_pay_date = $4,
                  paid_at = CASE WHEN $1 = 'PAID' THEN NOW() ELSE paid_at END,
                  updated_at = NOW()
            WHERE id = $5 AND status = 'PENDING'
            RETURNING id`,
          [newStatus, result.responseCode, result.bankCode, result.payDate, booking.id],
        );
        const transitioned = (upd.rowCount ?? 0) === 1;
        if (!transitioned) {
          // Another concurrent IPN already won the race; ack VNPay so it
          // stops retrying, but do NOT re-fire side effects.
          return res.json({ RspCode: '02', Message: 'Order already confirmed' });
        }

        // Side effects — best-effort, never block the IPN ack.
        if (isPaid) {
          // Realtime nudge to the assigned agent (web CRM picks this up).
          if (io && booking.agent_user_id) {
            try {
              io.to(`user:${booking.agent_user_id}`).emit('booking:paid', {
                bookingId: booking.id,
                listingId: booking.listing_id,
                amount: Number(booking.deposit_amount),
              });
            } catch (e: any) {
              logger.warn('[vnpay/ipn] socket emit failed: ' + (e?.message || e));
            }
          }
          // Email receipt to the buyer (if they provided one) — Brevo only.
          if (booking.buyer_email && isBrevoConfigured()) {
            try {
              const meta = await pool.query(
                `SELECT title, code FROM listings WHERE id = $1 LIMIT 1`,
                [booking.listing_id],
              );
              await brevoSendEmail({
                to: booking.buyer_email,
                subject: 'Biên nhận đặt cọc — SGS Land',
                html: depositReceiptHtml({
                  id: booking.id,
                  listingTitle: meta.rows[0]?.title || 'Sản phẩm',
                  listingCode: meta.rows[0]?.code || null,
                  amountVnd: Number(booking.deposit_amount),
                  bankCode: result.bankCode,
                  payDate: result.payDate,
                  txnRef: result.txnRef!,
                }),
                tags: ['booking-receipt'],
              });
            } catch (e: any) {
              logger.warn('[vnpay/ipn] receipt email failed: ' + (e?.message || e));
            }
          }
        }

        return res.json({ RspCode: '00', Message: 'Confirm Success' });
      } catch (err: any) {
        logger.error('[vnpay/ipn] ' + (err?.message || err));
        return res.json({ RspCode: '99', Message: 'Unknown error' });
      }
  };
  router.post('/api/payments/vnpay/ipn', ipnHandler);
  router.get('/api/payments/vnpay/ipn', ipnHandler);

  return router;
}
