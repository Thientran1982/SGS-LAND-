// @ts-nocheck
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// RELIABILITY FIX (audit): truoc day route nay tra cung { status: 'ok' }.
// Vi Next chay o port public (5000) va rewrite /api/:path* -> backend chi la
// afterFiles, route handler nay CHE endpoint /api/health that cua Express
// (server.ts:3994, port 5001). Ket qua: uptime monitor goi
// https://<domain>/api/health luon thay 200 "ok" du Neon/Upstash chet.
//
// Gio route nay proxy nguyen van sang backend va GIU NGUYEN status code, nen
// 503 tu backend (DB/Redis down) di duoc ra ngoai. Neu backend khong reachable
// thi tra 503 thay vi 200.
// ---------------------------------------------------------------------------
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/health`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'critical',
        service: 'sgsland-nextjs',
        error: `backend unreachable: ${err?.message || String(err)}`,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  } finally {
    clearTimeout(timer);
  }
}
