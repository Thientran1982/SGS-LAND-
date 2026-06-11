// @ts-nocheck
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'sgsland-nextjs', timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
