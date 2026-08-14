/**
 * bookingLifecycleService.ts - closes the deposit-booking lifecycle.
 *
 * Two write paths open a hold on inventory:
 *   1. POST /api/bookings   -> PENDING booking, expires_at = now + 30m
 *   2. VNPay IPN (PAID)     -> listing.status = HOLD, hold_expires_at set
 *
 * Nothing used to close them: an abandoned checkout stayed PENDING forever
 * and a paid hold never returned to the market. This sweeper is the single
 * closing path. It is idempotent, cheap (three indexed UPDATEs) and safe to
 * run concurrently with the request path.
 *
 * Interval defaults to 15 minutes to match the other in-process crons - the
 * Use a moderate cadence so the managed database is not queried unnecessarily.
 */
import type { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { withRlsBypass } from '../db';

export interface BookingSweepResult {
  expiredBookings: number;
  releasedListings: number;
  releasedUnits: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

/** Log a booking_events row without ever failing the sweep. */
async function logEvent(pool: Pool, bookingId: string, message: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO booking_events (booking_id, kind, verified, message)
       VALUES ($1, 'EXPIRED', true, $2)`,
      [bookingId, message],
    );
  } catch (err: any) {
    logger.warn('[bookingLifecycle] event log failed: ' + (err?.message || err));
  }
}

export async function runBookingLifecycleSweep(pool: Pool): Promise<BookingSweepResult> {
  // 1) PENDING checkouts past their TTL. The buyer never completed payment
  //    (a completed one is flipped by the IPN inside the same window), so
  //    the row is closed as CANCELLED - the status CHECK on `bookings` has
  //    no EXPIRED value and migration 099 documents CANCELLED as
  //    "buyer abandoned / expired".
  const expired = await pool.query(
    `UPDATE bookings
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE status = 'PENDING'
        AND expires_at <= NOW()
      RETURNING id`,
  );
  for (const row of expired.rows.slice(0, 200)) {
    await logEvent(pool, row.id, 'TTL reached, booking auto-cancelled by sweeper');
  }

  // 2) Listings whose paid hold window elapsed go back on the market.
  //    Only rows that carry an explicit deadline are touched, so a manual
  //    open-ended HOLD set by staff is never released behind their back.
  const releasedListings = await withRlsBypass((client) =>
    client.query(
      `UPDATE listings
          SET status = 'AVAILABLE', hold_expires_at = NULL, updated_at = NOW()
        WHERE status = 'HOLD'
          AND hold_expires_at IS NOT NULL
          AND hold_expires_at <= NOW()
        RETURNING id`,
    ),
  );

  // 3) Units reserved by a booking that is no longer active. Guarded by the
  //    EXISTS() so a unit reserved by hand (no booking behind it) stays put.
  const releasedUnits = await withRlsBypass((client) =>
    client.query(
      `UPDATE units u
          SET status = 'available', updated_at = NOW()
        WHERE u.status = 'reserved'
          AND EXISTS (
                SELECT 1 FROM bookings b
                 WHERE b.unit_id = u.id
                   AND b.status IN ('CANCELLED','FAILED','REFUNDED'))
          AND NOT EXISTS (
                SELECT 1 FROM bookings b2
                 WHERE b2.unit_id = u.id
                   AND b2.status IN ('PENDING','PAID'))
        RETURNING u.id`,
    ),
  );

  return {
    expiredBookings: expired.rowCount ?? 0,
    releasedListings: releasedListings.rowCount ?? 0,
    releasedUnits: releasedUnits.rowCount ?? 0,
  };
}

export function startBookingLifecycleCron(pool: Pool, opts?: { intervalMs?: number }): void {
  if (timer) return;
  const intervalMs = opts?.intervalMs ?? 15 * 60 * 1000;
  const tick = async (): Promise<void> => {
    if (inFlight) return; // never stack ticks on a slow/cold database
    inFlight = true;
    try {
      const r = await runBookingLifecycleSweep(pool);
      if (r.expiredBookings || r.releasedListings || r.releasedUnits) {
        logger.info(
          `[bookingLifecycle] expired=${r.expiredBookings} listingsReleased=${r.releasedListings} unitsReleased=${r.releasedUnits}`,
        );
      }
    } catch (err: any) {
      logger.warn('[bookingLifecycle] sweep failed: ' + (err?.message || err));
    } finally {
      inFlight = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  if (typeof (timer as any).unref === 'function') (timer as any).unref();
  const kickoff = setTimeout(tick, 30 * 1000); // first pass shortly after boot
  if (typeof (kickoff as any).unref === 'function') (kickoff as any).unref();
  logger.info(`[bookingLifecycle] cron started (every ${Math.round(intervalMs / 60000)}m)`);
}

export function stopBookingLifecycleCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
