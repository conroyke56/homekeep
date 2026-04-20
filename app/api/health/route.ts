import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const nextjs = 'ok';
  let pocketbase: 'ok' | 'unhealthy' | 'unreachable' = 'unreachable';
  let pbCode: number | null = null;

  try {
    const res = await fetch('http://127.0.0.1:8090/api/health', {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    pbCode = res.status;
    pocketbase = res.ok ? 'ok' : 'unhealthy';
  } catch {
    pocketbase = 'unreachable';
  }

  const ok = pocketbase === 'ok';
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', nextjs, pocketbase, pbCode },
    { status: ok ? 200 : 503 }
  );
}
