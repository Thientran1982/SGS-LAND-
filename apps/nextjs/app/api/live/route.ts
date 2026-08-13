import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// LIVENESS PROBE for the Next.js process (the one that owns the PUBLIC port:
// .replit maps localPort 5000 -> externalPort 80).
//
// It deliberately touches NOTHING: no Express backend call, no Neon, no Upstash.
// The only thing it proves is that this Node process still has a working event
// loop and can still write a response.
//
// Why it exists: on 2026-08-11T21:36:08Z production stopped answering for 10h+.
// The load balancer still completed TCP + TLS to the VM, but no HTTP byte ever
// came back, and stdout logging stopped at the same instant - the classic
// "alive but wedged" state of a Node process thrashing in GC on a VM that has
// run out of memory. Nothing detected it because scripts/supervisor.sh only
// probed the Express backend (/api/health on port 5001), never the frontend.
//
// /api/health must NOT be reused for this: it proxies to the backend on purpose
// and mirrors its status code, so a Neon outage would return 503 here and make
// the supervisor restart a perfectly healthy frontend in a loop.
// ---------------------------------------------------------------------------
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'nextjs', pid: process.pid, uptime: Math.round(process.uptime()), ts: new Date().toISOString() },
    { headers: NO_STORE },
  );
}

export function HEAD() {
  return new Response(null, { status: 200, headers: NO_STORE });
}
