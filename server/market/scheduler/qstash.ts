/**
 * QStash scheduling + webhook verification for region ingest jobs.
 *
 * Each region is scheduled independently on a staggered cron (see REGIONS[].cronUtc)
 * so ingest jobs never all fire at once. QStash calls back our webhook endpoint
 * per region; the endpoint pulls that region's pending listings from the
 * configured partner feed / first-party queue and runs ingestBatch().
 *
 * Signature verification mirrors the existing webhook pattern in this codebase
 * (e.g. TikTok Lead Gen): we validate the QStash signature before acting.
 */
import { Client } from '@upstash/qstash';
import { Receiver } from '@upstash/qstash';
import { REGIONS, REGION_CODES, type RegionCode } from '../config/regions';

const QSTASH_TOKEN = process.env.QSTASH_TOKEN || '';

/** Public base URL of this deployment (where QStash sends webhooks). */
function baseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    'https://sgs-land.replit.app'
  ).replace(/\/$/, '');
}

function webhookUrl(region: RegionCode): string {
  return `${baseUrl()}/api/market/webhook/${region}`;
}

let _client: Client | null = null;
function client(): Client {
  if (!QSTASH_TOKEN) throw new Error('[market:qstash] QSTASH_TOKEN not set');
  if (!_client) _client = new Client({ token: QSTASH_TOKEN });
  return _client;
}

let _receiver: Receiver | null = null;
export function receiver(): Receiver {
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
    });
  }
  return _receiver;
}

/**
 * Verify a QStash webhook. Returns true if the signature is valid for the given
 * raw request body + URL. Call this BEFORE trusting any webhook payload.
 */
export async function verifyQstashSignature(
  signature: string | undefined,
  rawBody: string,
  url: string,
): Promise<boolean> {
  if (!signature) return false;
  try {
    return await receiver().verify({ signature, body: rawBody, url });
  } catch (err) {
    console.warn('[market:qstash] signature verify failed:', (err as Error).message);
    return false;
  }
}

/**
 * (Re)create the staggered QStash schedules — one per region. Idempotent per
 * destination URL + cron on QStash's side. Run once at deploy/setup time.
 */
export async function scheduleAllRegions(): Promise<Array<{ region: RegionCode; scheduleId: string }>> {
  const c = client();
  const out: Array<{ region: RegionCode; scheduleId: string }> = [];
  for (const region of REGION_CODES) {
    const cfg = REGIONS[region];
    const res = await c.schedules.create({
      destination: webhookUrl(region),
      cron: cfg.cronUtc,
      body: JSON.stringify({ region, kind: 'region_ingest' }),
      headers: { 'Content-Type': 'application/json' },
    });
    out.push({ region, scheduleId: res.scheduleId });
    console.log(`[market:qstash] scheduled ${region} (${cfg.cronUtc}) -> ${res.scheduleId}`);
  }
  return out;
}

/**
 * Publish a one-off ingest job for a single region right now (with optional
 * delay in seconds). Useful for manual testing of one region end-to-end.
 */
export async function publishRegionJob(
  region: RegionCode,
  delaySeconds = 0,
): Promise<string> {
  const c = client();
  const res = await c.publishJSON({
    url: webhookUrl(region),
    body: { region, kind: 'region_ingest' },
    delay: delaySeconds,
  });
  console.log(`[market:qstash] published ${region} job -> ${res.messageId}`);
  return res.messageId;
}
